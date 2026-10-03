// Shared test helpers: pages built inline, checked in memory or written into a temporary folder that is removed after
// the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkFiles, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'ui-markup-a11y-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// A whole page that passes every check, with this markup in its main element. head adds to the head; htmlAttrs
// replaces the attributes of the html start tag.
export function page(body = '<h1>Shoes</h1>', { head = '', htmlAttrs = ' lang="en"', title = 'Shoes - Shop' } = {}) {
  return `<!DOCTYPE html>\n<html${htmlAttrs}>\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n${head}</head>\n<body>\n<main>\n${body}\n</main>\n</body>\n</html>\n`;
}

// Checks pages given as { name: text } in memory.
export function check(files, options = {}) {
  const list = Object.entries(typeof files === 'string' ? { 'page.html': files } : files).map(([file, text]) => ({ file, size: text.length, text, reason: null }));
  return checkFiles({ files: list, links: [], skipped: [], special: [], otherFiles: 0, ...options.read }, { inputs: ['site'], ...options });
}

export const ids = (report) => report.findings.map((f) => f.id);
export const find = (report, id) => report.findings.filter((f) => f.id === id);
// The finding ids without the summaries that every report has.
export const problems = (report) => ids(report).filter((id) => id !== 'summary');

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments.
export async function cli(argv) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { code, out, err };
}
