// Reads the HTML files, parses each one (src/tree.js), runs the checks of src/rules.js and returns one report: what was
// read, the areas with their result, the findings grouped by area, notes and the gate. docs/method.md gives the reason
// behind every finding. The tool reads the files it is given and opens no connection.

import { resolve } from 'node:path';
import { FILE_LIMITS, displayPath, readInputs } from './files.js';
import { TREE_LIMITS, parseHtml, positionIn } from './tree.js';
import { AREAS, AREA_ORDER, BY_ID_SEVERITY, FINDINGS, ORDER, RANK, SEVERITIES, checkDocument, meetsThreshold, safeText } from './rules.js';
import { grouped, listText, plural } from './size.js';

export const LIMITS = { ...FILE_LIMITS, ...TREE_LIMITS, maxListedPerFinding: 200 };
export { AREAS, FINDINGS, ORDER, RANK, SEVERITIES, meetsThreshold, safeText };

const PROBLEM_TEXT = { tag: 'a tag', comment: 'a comment', doctype: 'the doctype' };

// Builds the report from files already read: { files: [{ file, size, text, reason }], links, skipped, special,
// otherFiles }. options: inputs (the paths shown in the report), failOn, version and limits.
export function checkFiles(read, options = {}) {
  const limits = { ...LIMITS, ...(options.limits ?? {}) };
  const failOn = options.failOn ?? 'error';
  const cap = limits.maxListedPerFinding;
  const files = read.files ?? [];
  const all = [];
  const notes = [];
  const fragments = [];
  const totals = { pages: 0, fragments: 0, elements: 0, images: 0, controls: 0, headings: 0 };
  let templates = 0;
  for (const f of files) {
    if (f.text === null) continue;
    const doc = parseHtml(f.text, limits);
    const { findings, counts } = checkDocument(doc, f.file);
    all.push(...findings);
    if (doc.isPage) totals.pages += 1;
    else {
      totals.fragments += 1;
      fragments.push(f.file);
    }
    totals.elements += counts.elements;
    totals.images += counts.images;
    totals.controls += counts.controls;
    totals.headings += counts.headings;
    templates += doc.templates;
    const where = (p) => {
      const pos = positionIn(doc, p.offset);
      return `${PROBLEM_TEXT[p.kind] ?? 'a tag'} at ${pos.line}:${pos.column}`;
    };
    if (doc.problems.length) notes.push(`${safeText(f.file, 200)}: ${listText(doc.problems.map(where), 3)} ${doc.problems.length === 1 ? 'is' : 'are'} not closed before the end of the file; ${doc.problems.some((p) => p.kind === 'tag') ? 'a tag that is not closed is not read, as in a browser' : 'the rest of the file is read as part of it, as in a browser'}`);
    for (const n of doc.notes) notes.push(`${safeText(f.file, 200)}: ${n}`);
  }

  // Order, and the cap per kind.
  all.sort((a, b) => AREA_ORDER[a.area] - AREA_ORDER[b.area] || ORDER[a.id] - ORDER[b.id] || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || a.column - b.column);
  const omitted = {};
  const findings = [];
  const perId = {};
  for (const f of all) {
    perId[f.id] = (perId[f.id] ?? 0) + 1;
    if (perId[f.id] <= cap) findings.push(f);
    else omitted[f.id] = (omitted[f.id] ?? 0) + 1;
  }

  const unread = files.filter((f) => f.text === null);
  if (unread.length) notes.push(`${plural(unread.length, 'HTML file')} ${unread.length === 1 ? 'was' : 'were'} not read and not checked: ${listText(unread.map((u) => `${safeText(u.file, 160)} (${safeText(u.reason, 80)})`), 5)}`);
  if (fragments.length) notes.push(`${plural(fragments.length, 'file')} ${fragments.length === 1 ? 'is a fragment' : 'are fragments'} of a page (no doctype and no html start tag), so the checks of lang, title and h1 did not run on ${fragments.length === 1 ? 'it' : 'them'}: ${listText(fragments.map((x) => safeText(x, 160)), 5)}`);
  if (templates) notes.push(`${plural(templates, 'template element')}: the content of a template is not part of the page until a script uses it, and was not checked`);
  if (read.links?.length) notes.push(`${plural(read.links.length, 'symbolic link')} ${read.links.length === 1 ? 'was' : 'were'} not followed: ${listText(read.links.map((l) => safeText(l, 160)), 5)}`);
  if (read.skipped?.length) notes.push(`${plural(read.skipped.length, 'folder')} of tools or caches ${read.skipped.length === 1 ? 'was' : 'were'} not entered: ${listText(read.skipped.map((l) => safeText(l, 160)), 5)}`);
  if (read.special?.length) notes.push(`${plural(read.special.length, 'entry', 'entries')} ${read.special.length === 1 ? 'is' : 'are'} not a regular file or folder, or could not be read: ${listText(read.special.map((u) => `${safeText(u.path, 160)} (${safeText(u.reason, 80)})`), 5)}`);
  for (const [id, n] of Object.entries(omitted)) notes.push(`${grouped(n)} more findings of ${id} are counted but not listed`);

  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  for (const [id, n] of Object.entries(omitted)) counts[BY_ID_SEVERITY[id]] += n;

  const areas = AREAS.map((a) => {
    const own = findings.filter((f) => f.area === a.id);
    const worst = own.length ? own.reduce((w, f) => (RANK[f.severity] < RANK[w] ? f.severity : w), 'info') : null;
    const result = worst === 'error' ? 'fail' : worst === 'warning' ? 'warn' : worst === 'info' ? 'info' : 'pass';
    const detail = own.length ? [...new Set(own.map((f) => f.id))].map((id) => `${id} x${own.filter((f) => f.id === id).length + (omitted[id] ?? 0)}`).join(', ') : 'no finding';
    return { id: a.id, title: a.title, result, detail: safeText(detail, 400), findings: own.length };
  });

  const eCount = meetsThreshold('error', failOn) ? counts.error : 0;
  const wCount = meetsThreshold('warning', failOn) ? counts.warning : 0;
  const reason = [eCount ? plural(eCount, 'error') : null, wCount ? plural(wCount, 'warning') : null].filter(Boolean).join(', ');

  return {
    tool: 'ui-markup-a11y-check',
    version: options.version ?? '0.0.0',
    inputs: (options.inputs ?? ['.']).map((p) => safeText(p, 300)),
    files: {
      html: files.length,
      read: files.length - unread.length,
      notRead: unread.length,
      otherFiles: read.otherFiles ?? 0,
      links: read.links?.length ?? 0,
      skippedFolders: read.skipped?.length ?? 0,
      ...totals
    },
    areas,
    findings,
    notes: notes.map((n) => safeText(n, 1200)),
    counts,
    gate: { failOn, pass: eCount + wCount === 0, reason }
  };
}

// Reads the paths (files and folders) and builds the report. The paths in the report are relative to base, with
// forward slashes.
export async function checkPaths(paths, options = {}) {
  const base = options.base ?? process.cwd();
  const limits = { ...LIMITS, ...(options.limits ?? {}) };
  const read = await readInputs(paths, base, limits);
  return checkFiles(read, { ...options, limits, inputs: paths.map((p) => displayPath(resolve(base, p), base)) });
}
