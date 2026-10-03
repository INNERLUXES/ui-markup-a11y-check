// Command line: ui-markup-a11y-check <file or folder>... [options]

import { readFileSync } from 'node:fs';
import { FINDINGS, LIMITS, checkPaths, safeText } from './check.js';
import { toText, toMarkdown, toJson, toCsv } from './report.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, csv: toCsv };
const THRESHOLDS = ['error', 'warning'];

export const USAGE = `Usage: ui-markup-a11y-check <file or folder>... [options]

Reads built HTML files (one file, several, or folders of .html and .htm files) and reports the accessibility problems
that are visible in the markup: images with no alt, buttons, links and form fields with no name, no lang, no title, a
viewport that blocks zoom, skipped heading levels, duplicate ids, aria references to missing ids, vague link text, a
positive tabindex, autoplay media, focusable content inside aria-hidden, and data tables with no headers. It reads the
files as text: it never runs a script, never fetches anything, never follows a symbolic link inside a folder, and opens
no network connection.

Options:
  --format <name>     text, markdown, json or csv (default: text)
  --fail-on <level>   exit with 1 when a finding is at this level or above: error or warning
                      (default: error); info never fails the run
  --help              show this text
  --version           show the version

Checks: ${FINDINGS.map((f) => f.id).join(', ')}

Exit codes: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { paths: [], format: 'text', failOn: 'error', help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--format') o.format = next();
    else if (a === '--fail-on') o.failOn = next();
    else if (a === '-') throw new Error('reading from standard input is not supported; give the path of an HTML file or a folder');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else o.paths.push(a);
  }
  if (!o.help && !o.version) {
    if (!o.paths.length) throw new Error('give the path of an HTML file or a folder of built pages');
    for (const p of o.paths) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or csv)`);
    if (!THRESHOLDS.includes(o.failOn)) throw new Error(`--fail-on takes error or warning, not ${o.failOn}`);
  }
  return o;
}

function clean(text) {
  return safeText(text, 1500);
}

// Exit code: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = LIMITS, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`ui-markup-a11y-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths(o.paths, { failOn: o.failOn, version: VERSION, limits: { ...LIMITS, ...limits }, base });
  } catch (error) {
    io.err(`ui-markup-a11y-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report));
  return report.gate.pass ? 0 : 1;
}
