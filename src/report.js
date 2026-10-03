// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools, CSV for a
// spreadsheet. Findings are grouped by area, and each one quotes the sentence of the page that it rests on.

import { AREAS } from './rules.js';
import { grouped, plural } from './size.js';

function countsLine(c) {
  return `${c.error} error, ${c.warning} warning, ${c.info} info`;
}

function gateLine(r) {
  return r.gate.pass ? `GATE: PASS (--fail-on ${r.gate.failOn})` : `GATE: FAIL - ${r.gate.reason}`;
}

// The findings of one area, for the areas that have any.
function groups(r) {
  const out = [];
  for (const a of AREAS) {
    const own = r.findings.filter((f) => f.area === a.id);
    if (own.length) out.push({ title: a.title, findings: own });
  }
  return out;
}

function filesLine(r) {
  const f = r.files;
  return `files: ${plural(f.html, 'HTML file')}, ${grouped(f.read)} read, ${grouped(f.notRead)} not read, ${plural(f.otherFiles, 'other file')} not read, ${plural(f.links, 'link')} not followed, ${plural(f.skippedFolders, 'folder')} skipped`;
}

function markupLine(r) {
  const f = r.files;
  return `markup: ${plural(f.pages, 'page')}, ${plural(f.fragments, 'fragment')}, ${plural(f.elements, 'element')}, ${plural(f.images, 'image')}, ${plural(f.controls, 'control')}, ${plural(f.headings, 'heading')}`;
}

// The place of a finding: file:line:column, or the file alone for a finding about the whole file.
export const placeOf = (f) => (f.line ? `${f.file}:${f.line}:${f.column}` : f.file);

export function toText(r) {
  const lines = [`ui-markup-a11y-check: ${r.inputs.join(', ')}`, filesLine(r), markupLine(r), 'areas:'];
  for (const a of r.areas) lines.push(`  ${a.title.padEnd(19)}  ${a.result.padEnd(4)}  ${a.detail}`);
  lines.push(`findings: ${countsLine(r.counts)}`);
  if (!r.findings.length) lines.push('', 'no findings');
  for (const g of groups(r)) {
    lines.push('', `${g.title} (${plural(g.findings.length, 'finding')})`);
    for (const f of g.findings) {
      lines.push('', `  ${f.severity.toUpperCase().padEnd(7)}  ${f.id}  ${placeOf(f)}`);
      if (f.snippet) lines.push(`           markup: ${f.snippet}`);
      lines.push(`           ${f.message}`);
      for (const b of f.basis) lines.push(`           basis: "${b.text}" (${b.section}, ${b.source})`);
      lines.push(`           fix: ${f.fix}`);
    }
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`note: ${note}`);
  lines.push('', gateLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes, pipes, square brackets, backticks, asterisks and underscores escaped, line breaks
// flattened, and <, > and & written as entities, so text from the input cannot break the table, make a link or be read
// as HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[[\]`*_]/g, (c) => `\\${c}`)
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r) {
  const lines = [`## ui-markup-a11y-check: ${countsLine(r.counts)}`, '', `Input: ${mdCell(r.inputs.join(', '))}. ${mdCell(filesLine(r).replace(/^files: /, 'Files: '))}. ${mdCell(markupLine(r).replace(/^markup: /, 'Markup: '))}.`];
  lines.push('', '| Area | Result | Detail |', '| --- | --- | --- |');
  for (const a of r.areas) lines.push(`| ${mdCell(a.title)} | ${a.result === 'fail' ? '**fail**' : mdCell(a.result)} | ${mdCell(a.detail)} |`);
  if (!r.findings.length) lines.push('', 'No findings.');
  for (const g of groups(r)) {
    lines.push('', `### ${mdCell(g.title)}`, '', '| Severity | Check | Where | Markup | Message | Basis | Fix |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const f of g.findings) {
      const basis = f.basis.map((b) => `"${b.text}" (${b.section}, ${b.source})`).join(' ');
      lines.push(`| ${f.severity} | ${mdCell(f.id)} | ${mdCell(placeOf(f))} | ${mdCell(f.snippet)} | ${mdCell(f.message)} | ${mdCell(basis)} | ${mdCell(f.fix)} |`);
    }
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`- ${mdCell(note)}`);
  lines.push('', r.gate.pass ? `**Gate passed** (--fail-on ${r.gate.failOn}).` : `**Gate failed:** ${mdCell(r.gate.reason)}.`);
  return lines.join('\n') + '\n';
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}

// RFC 4180 quoting, and a leading quote on cells a spreadsheet would read as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per finding.
export function toCsv(r) {
  const rows = [['severity', 'area', 'id', 'file', 'line', 'column', 'snippet', 'subject', 'message', 'basis', 'source', 'fix']];
  for (const f of r.findings) rows.push([f.severity, f.area, f.id, f.file, String(f.line), String(f.column), f.snippet, f.subject, f.message, f.basis.map((b) => b.text).join(' '), f.source, f.fix]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
