// Runs the README examples, checks that they report what the README shows, and writes the reports of both example
// sites to examples/output. CI runs it and then fails if those files changed, so the example output in the repository
// is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// Runs the tool on folders of the repository; the paths shown in the report are relative to the root of the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, undefined, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const brokenArgs = ['examples/site-broken', '--fail-on', 'warning'];
const broken = await run(brokenArgs);
process.stdout.write(broken.out);
expect('broken site', broken, 1, [
  'markup: 3 pages, 0 fragments',
  'findings: 13 error, 8 warning, 4 info',
  'ERROR    html-no-lang  examples/site-broken/signup.html:2:1',
  'ERROR    page-no-title  examples/site-broken/product.html:2:1',
  'ERROR    viewport-blocks-zoom  examples/site-broken/signup.html:5:3',
  'ERROR    img-no-alt  examples/site-broken/product.html:10:5',
  'ERROR    img-no-alt  examples/site-broken/product.html:23:7',
  'WARNING  autoplay-media  examples/site-broken/product.html:11:5',
  'ERROR    control-no-name  examples/site-broken/signup.html:20:7',
  'ERROR    form-field-no-label  examples/site-broken/product.html:19:7',
  'ERROR    form-field-no-label  examples/site-broken/signup.html:14:7',
  'ERROR    form-field-no-label  examples/site-broken/signup.html:16:7',
  'WARNING  title-only-name  examples/site-broken/product.html:24:7',
  'WARNING  title-only-name  examples/site-broken/signup.html:13:7',
  'WARNING  vague-link-text  examples/site-broken/index.html:21:50',
  'WARNING  heading-skip  examples/site-broken/signup.html:12:7',
  'WARNING  no-h1  examples/site-broken/product.html:7:1',
  'WARNING  table-no-headers  examples/site-broken/product.html:13:5',
  'INFO     several-h1  examples/site-broken/index.html:20:5',
  'ERROR    duplicate-id  examples/site-broken/signup.html:19:7',
  'ERROR    aria-reference-missing  examples/site-broken/signup.html:15:7',
  'ERROR    aria-reference-missing  examples/site-broken/signup.html:16:7',
  'ERROR    aria-hidden-focusable  examples/site-broken/product.html:27:7',
  'WARNING  positive-tabindex  examples/site-broken/signup.html:20:7',
  'GATE: FAIL - 13 errors, 8 warnings'
], ['GATE: PASS']);

process.stdout.write('\n');
const fixed = await run(['examples/site-fixed', '--fail-on', 'warning']);
process.stdout.write(fixed.out);
expect('fixed site with --fail-on warning', fixed, 0, ['findings: 0 error, 0 warning, 3 info', 'INFO     summary  examples/site-fixed/signup.html', 'GATE: PASS (--fail-on warning)'], ['ERROR', 'WARNING ']);

// The README shows the fixed run as it is printed, and the broken run in part.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(fixed.out)) problems.push('README: the sample output of the fixed site differs from a real run');
const head = broken.out.split('\n\nPage (')[0];
if (!readme.includes(head)) problems.push('README: the head of the sample output of the broken site differs from a real run');

// The broken site in every format, and the fixed site as text.
await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/site-broken.txt'), broken.out);
for (const [format, name] of [['markdown', 'site-broken.md'], ['json', 'site-broken.json'], ['csv', 'site-broken.csv']]) {
  const r = await run([...brokenArgs, '--format', format]);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}
await writeFile(resolve(root, 'examples/output/site-fixed.txt'), fixed.out);

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
