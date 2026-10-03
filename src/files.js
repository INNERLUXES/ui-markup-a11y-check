// Reading the input: one HTML file, several, or folders of them. A folder is walked with lstat, so a symbolic link (or a
// Windows junction) inside it is listed and never followed: a link cannot lead the tool out of the folder or round in
// a loop. Only files ending in .html or .htm are read, each one only when it is a regular file under the size limit,
// with the size taken from the open file.

import { lstat, open, readdir, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { SKIP_FOLDERS, isHtmlName } from './data.js';

export const FILE_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxEntries: 20000,
  maxDepth: 32,
  maxHtmlFiles: 5000
};

// An error with the path in its message and the reason alone in .reason, so a caller can show its own path.
export function fileError(path, reason) {
  return Object.assign(new Error(`${path}: ${reason}`), { reason });
}

function megabytes(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('en-US')} MB` : `${bytes.toLocaleString('en-US')} byte`;
}

// The whole file, or an error when it is not a regular file or is over the limit. The file is opened once and its type
// and size are taken from the open handle, so a file swapped for a link or a pipe after the walk is refused.
export async function readBounded(path, maxBytes = FILE_LIMITS.maxFileBytes) {
  let handle;
  try {
    handle = await open(resolve(path), 'r');
  } catch (error) {
    if (error.code === 'ENOENT') throw fileError(path, 'no such file');
    throw fileError(path, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw fileError(path, 'not a regular file');
    if (opened.size > maxBytes) throw fileError(path, `${opened.size.toLocaleString('en-US')} bytes is over the ${megabytes(maxBytes)} limit`);
    const buffer = Buffer.alloc(opened.size);
    let read = 0;
    while (read < opened.size) {
      const { bytesRead } = await handle.read(buffer, read, opened.size - read, read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    return buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

// A path as shown in a report: relative to the base folder with forward slashes; a path outside it is shown
// absolute, also with forward slashes.
export function displayPath(path, base) {
  const rel = relative(base, path);
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return toPosix(path);
  return toPosix(rel);
}

// A file holds binary data when its first 8,000 bytes hold a null byte.
export const isBinary = (buffer) => buffer.subarray(0, 8000).includes(0);

// UTF-8 text without a leading byte order mark.
export const decodeText = (buffer) => {
  const text = buffer.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

// Reads one file that was named or found, into { shown, text, reason }.
async function readOne(full, shown, size, limits, budget) {
  const file = { file: shown, size, text: null, reason: null };
  if (size > limits.maxFileBytes) {
    file.reason = `${size.toLocaleString('en-US')} bytes is over the ${megabytes(limits.maxFileBytes)} limit`;
    return file;
  }
  if (budget.total + size > limits.maxTotalBytes) throw fileError(shown, `the HTML files to read hold more than ${megabytes(limits.maxTotalBytes)}`);
  try {
    const buffer = await readBounded(full, limits.maxFileBytes);
    budget.total += buffer.length;
    if (isBinary(buffer)) file.reason = 'holds binary data';
    else file.text = decodeText(buffer);
  } catch (error) {
    file.reason = error.reason ?? error.message;
  }
  return file;
}

// Walks one folder: the HTML files with their text, the symbolic links that were not followed, the folders that were
// skipped and the entries that are neither files nor folders. More entries, more depth, more HTML files or more bytes
// than the limits is an error: the folder is refused rather than half read.
async function walkFolder(full, shown, limits, budget, out) {
  let entries = 0;
  const pending = [{ dir: full, rel: '', depth: 0 }];
  while (pending.length) {
    const { dir, rel, depth } = pending.pop();
    let names;
    try {
      names = (await readdir(dir)).sort();
    } catch (error) {
      out.special.push({ path: rel ? `${shown}/${rel}` : shown, reason: `folder cannot be read (${error.code ?? error.message})` });
      continue;
    }
    const folders = [];
    for (const name of names) {
      entries += 1;
      if (entries > limits.maxEntries) throw fileError(shown, `holds more than ${limits.maxEntries.toLocaleString('en-US')} files and folders; give the folder of one built site`);
      const childRel = rel ? `${rel}/${name}` : name;
      const childShown = shown === '.' ? childRel : `${shown}/${childRel}`;
      const child = resolve(dir, name);
      let st;
      try {
        st = await lstat(child);
      } catch (error) {
        out.special.push({ path: childShown, reason: `cannot be read (${error.code ?? error.message})` });
        continue;
      }
      if (st.isSymbolicLink()) out.links.push(childShown);
      else if (st.isDirectory()) {
        if (SKIP_FOLDERS.includes(name)) {
          out.skipped.push(childShown);
          continue;
        }
        if (depth + 1 > limits.maxDepth) throw fileError(shown, `has folders nested more than ${limits.maxDepth} deep (${childRel.slice(0, 120)}...)`);
        folders.push({ dir: child, rel: childRel, depth: depth + 1 });
      } else if (st.isFile()) {
        if (!isHtmlName(name)) {
          out.otherFiles += 1;
          continue;
        }
        if (out.files.length + 1 > limits.maxHtmlFiles) throw fileError(shown, `holds more than ${limits.maxHtmlFiles.toLocaleString('en-US')} HTML files`);
        out.files.push(await readOne(child, childShown, st.size, limits, budget));
      } else out.special.push({ path: childShown, reason: 'not a regular file or folder' });
    }
    // Folders are walked in name order: the last pushed is taken first.
    for (const f of folders.reverse()) pending.push(f);
  }
}

// Reads every path given: a file is read when it ends in .html or .htm, a folder is walked. A path named on the command
// line may itself be a symbolic link, because the person who runs the tool named it; inside a folder no link is
// followed. Returns { files, links, skipped, special, otherFiles } with paths relative to base.
export async function readInputs(paths, base = process.cwd(), limits = FILE_LIMITS) {
  const out = { files: [], links: [], skipped: [], special: [], otherFiles: 0 };
  const budget = { total: 0 };
  const seen = new Set();
  for (const path of paths) {
    const full = resolve(base, path);
    const shown = displayPath(full, base);
    if (seen.has(full)) continue;
    seen.add(full);
    let info;
    try {
      info = await stat(full);
    } catch (error) {
      if (error.code === 'ENOENT') throw fileError(shown, 'no such file or folder');
      throw fileError(shown, `cannot be read (${error.code ?? error.message})`);
    }
    if (info.isDirectory()) await walkFolder(full, shown, limits, budget, out);
    else if (info.isFile()) {
      if (!isHtmlName(full)) throw fileError(shown, 'not an HTML file; give files ending in .html or .htm, or a folder');
      if (out.files.length + 1 > limits.maxHtmlFiles) throw fileError(shown, `more than ${limits.maxHtmlFiles.toLocaleString('en-US')} HTML files`);
      out.files.push(await readOne(full, shown, info.size, limits, budget));
    } else throw fileError(shown, 'not a file or a folder');
  }
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  out.files.sort((a, b) => order(a.file, b.file));
  out.links.sort(order);
  out.skipped.sort(order);
  if (!out.files.length) throw fileError(paths.map((p) => displayPath(resolve(base, p), base)).join(', ').slice(0, 300), 'no file ending in .html or .htm was found');
  return out;
}
