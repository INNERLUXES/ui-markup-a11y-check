import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FINDINGS, USAGE, VERSION, checkPaths, csvCell, decodeText, displayPath, fileError, grouped, listText, main, mdCell, parseArgs, placeOf, plural, readBounded, readInputs, toCsv, toJson, toMarkdown, toText } from '../src/index.js';
import { fileURLToPath } from 'node:url';
import { check, cli, page, run, withFiles } from './helpers.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');

// Runs the tool on folders of the repository, with the root of the repository as the base for relative paths.
async function inRoot(argv) {
  let o = '';
  let err = '';
  const code = await main(argv, { out: (t) => { o += t; }, err: (t) => { err += t; } }, undefined, root);
  return { code, out: o, err };
}

const broken = { 'page.html': page('<h2>Shoes</h2><img src="a.png"><a href="/x">here</a>') };

test('text report: the input, files and markup lines, the areas, each finding with its place, markup, quotation and fix, and the gate', () => {
  const o = toText(check(broken));
  const lines = o.split('\n');
  assert.equal(lines[0], 'ui-markup-a11y-check: site');
  assert.equal(lines[1], 'files: 1 HTML file, 1 read, 0 not read, 0 other files not read, 0 links not followed, 0 folders skipped');
  assert.match(lines[2], /^markup: 1 page, 0 fragments, \d+ elements, 1 image, 1 control, 1 heading$/);
  assert.equal(lines[3], 'areas:');
  assert.match(o, /^ {2}Images and media {5}fail {2}img-no-alt x1$/m);
  assert.match(o, /^ {2}Focus {16}pass {2}no finding$/m);
  assert.match(o, /^findings: 1 error, 2 warning, 1 info$/m);
  assert.match(o, /^ {2}ERROR {4}img-no-alt {2}page\.html:9:15$/m);
  assert.match(o, /^ {11}markup: <img src="a\.png">$/m);
  assert.match(o, /^ {11}basis: "Except where otherwise specified, the alt attribute must be specified and its value must not be empty; the value must be an appropriate replacement for the image\." \(General guidelines, https:\/\/html\.spec\.whatwg\.org\/multipage\/images\.html#alt\)$/m);
  assert.match(o, /^ {11}fix: Add an alt attribute/m);
  assert.match(o, /^ {2}INFO {5}summary {2}page\.html$/m);
  assert.match(o, /\nGATE: FAIL - 1 error\n$/);
});

test('text report: no findings and notes are said before the gate', () => {
  const r = check({ 'a.html': '<p>x</p>' });
  r.findings = [];
  r.counts = { error: 0, warning: 0, info: 0 };
  const o = toText(r);
  assert.match(o, /^findings: 0 error, 0 warning, 0 info\n\nno findings$/m);
  assert.match(o, /\nnote: 1 file is a fragment of a page .*\n\nGATE: PASS \(--fail-on error\)\n$/);
});

test('markdown report: the summary line, the area table, a table per area with the markup, the notes and the gate in bold', () => {
  const o = toMarkdown(check(broken));
  assert.match(o, /^## ui-markup-a11y-check: 1 error, 2 warning, 1 info$/m);
  assert.match(o, /^Input: site\. Files: 1 HTML file/m);
  assert.match(o, /^\| Images and media \| \*\*fail\*\* \| img-no-alt x1 \|$/m);
  assert.match(o, /^\| Severity \| Check \| Where \| Markup \| Message \| Basis \| Fix \|$/m);
  assert.match(o, /\| &lt;img src="a\.png"&gt; \|/);
  assert.match(o, /\*\*Gate failed:\*\* 1 error\./);
  assert.match(toMarkdown(check(page())), /\*\*Gate passed\*\* \(--fail-on error\)\./);
  assert.equal(mdCell('x\r\ny'), 'x y');
  assert.equal(mdCell('a_b|c'), 'a\\_b\\|c');
});

test('json report: the whole report, with the files, the areas, every finding with its basis, the notes and the gate', () => {
  const r = JSON.parse(toJson(check(broken, { version: '9.9.9' })));
  assert.deepEqual(Object.keys(r), ['tool', 'version', 'inputs', 'files', 'areas', 'findings', 'notes', 'counts', 'gate']);
  assert.equal(r.tool, 'ui-markup-a11y-check');
  assert.equal(r.version, '9.9.9');
  assert.deepEqual(Object.keys(r.files), ['html', 'read', 'notRead', 'otherFiles', 'links', 'skippedFolders', 'pages', 'fragments', 'elements', 'images', 'controls', 'headings']);
  assert.deepEqual(r.areas.map((a) => a.id), ['page', 'images', 'names', 'structure', 'ids', 'focus']);
  assert.deepEqual(Object.keys(r.findings[0]), ['id', 'severity', 'area', 'file', 'line', 'column', 'snippet', 'subject', 'message', 'fix', 'basis', 'source']);
  assert.deepEqual(Object.keys(r.findings[0].basis[0]), ['text', 'section', 'source']);
  assert.deepEqual(r.gate, { failOn: 'error', pass: false, reason: '1 error' });
});

test('csv report: RFC 4180, one row per finding, CRLF line ends, quotes doubled, and a leading quote on a cell a spreadsheet would run', () => {
  const o = toCsv(check(broken));
  const lines = o.split('\r\n');
  assert.equal(lines[0], 'severity,area,id,file,line,column,snippet,subject,message,basis,source,fix');
  assert.equal(lines.at(-1), '');
  assert.ok(lines[1].startsWith('info,page,summary,page.html,0,0,,summary,'));
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('@a'), "'@a");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '');
  assert.equal(placeOf({ file: 'a.html', line: 3, column: 7 }), 'a.html:3:7');
  assert.equal(placeOf({ file: 'a.html', line: 0, column: 0 }), 'a.html');
});

test('the usage text lists every check, the options and the exit codes', () => {
  for (const f of FINDINGS) assert.ok(USAGE.includes(f.id), f.id);
  assert.match(USAGE, /Exit codes: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error\./);
  for (const o of ['--format <name>', '--fail-on <level>']) assert.ok(USAGE.includes(o), o);
  assert.match(USAGE, /info never fails the run/);
  assert.match(USAGE, /never runs a script, never fetches anything/);
});

test('arguments: every option, several paths, and the errors for a missing value, an unknown option, no path, a URL and standard input', () => {
  assert.deepEqual(parseArgs(['a.html', 'site', '--format', 'json', '--fail-on', 'warning']), { paths: ['a.html', 'site'], format: 'json', failOn: 'warning', help: false, version: false });
  for (const [argv, message] of [[['--format'], /--format needs a value/], [['x', '--bad'], /unknown argument --bad/], [[], /give the path of an HTML file or a folder/], [['https://example.test/page.html'], /never fetches a URL/], [['-'], /standard input is not supported/], [['x', '--format', 'xml'], /unknown format xml/], [['x', '--fail-on', 'info'], /--fail-on takes error or warning, not info/]]) {
    assert.throws(() => parseArgs(argv), message, argv.join(' '));
  }
});

test('lists and numbers as the reports write them', () => {
  assert.equal(grouped(1234567), '1,234,567');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'file'), '1 file');
  assert.equal(plural(2, 'entry', 'entries'), '2 entries');
});

test('exit code 0: a page with no finding at the level, and --help and --version', async () => {
  assert.equal((await run({ 'index.html': page() }, ['index.html', '--fail-on', 'warning'])).code, 0);
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  const version = await cli(['--version']);
  assert.equal(version.out, `${VERSION}\n`);
  assert.equal(VERSION, JSON.parse(await read('package.json')).version);
});

test('exit code 1: an error fails the default gate, a warning fails only --fail-on warning, and info never fails', async () => {
  assert.equal((await run({ 'a.html': page('<h1>x</h1><img src="a.png">') }, ['a.html'])).code, 1);
  const warn = { 'a.html': page('<h2>x</h2>') };
  assert.equal((await run(warn, ['a.html'])).code, 0);
  assert.equal((await run(warn, ['a.html', '--fail-on', 'warning'])).code, 1);
  const info = await run({ 'a.html': page('<h1>x</h1><h1>y</h1>') }, ['a.html', '--fail-on', 'warning']);
  assert.equal(info.code, 0);
  assert.match(info.out, /INFO {5}several-h1/);
});

test('exit code 2: a path that does not exist, a file that is not HTML, a folder with no HTML, and a bad argument', async () => {
  const missing = await run({}, ['nope']);
  assert.equal(missing.code, 2);
  assert.equal(missing.err, 'ui-markup-a11y-check: nope: no such file or folder\n');
  const txt = await run({ 'a.txt': 'x' }, ['a.txt']);
  assert.match(txt.err, /a\.txt: not an HTML file/);
  const empty = await run({ 'site/a.css': 'x' }, ['site']);
  assert.equal(empty.code, 2);
  assert.match(empty.err, /no file ending in \.html or \.htm was found/);
  const bad = await run({}, ['--fail-on']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /Usage: ui-markup-a11y-check/);
});

test('folders and files: a folder is walked in name order, other files are counted, a path named twice is read once, paths use forward slashes', async () => {
  const files = { 'site/index.html': page(), 'site/shop/b.htm': page('<h2>x</h2>'), 'site/shop/a.HTML': page(), 'site/style.css': 'x', 'site/node_modules/x.html': 'x', 'one.html': page() };
  await withFiles(files, async (dir) => {
    const r = await readInputs(['site', 'one.html', 'one.html'], dir);
    assert.deepEqual(r.files.map((f) => f.file), ['one.html', 'site/index.html', 'site/shop/a.HTML', 'site/shop/b.htm']);
    assert.equal(r.otherFiles, 1);
    assert.deepEqual(r.skipped, ['site/node_modules']);
    const report = await checkPaths(['site'], { base: dir });
    assert.deepEqual(report.inputs, ['site']);
    assert.ok(report.findings.some((f) => f.file === 'site/shop/b.htm' && f.id === 'no-h1'));
  });
  for (const [format, pattern] of [['text', /site\/a\.html:\d+:\d+/], ['markdown', /site\/a\.html:\d+:\d+/], ['json', /"file": "site\/a\.html"/], ['csv', /,site\/a\.html,/]]) {
    const r = await run({ 'site/a.html': page('<h1>x</h1><img src="a.png">') }, ['site', '--format', format]);
    assert.equal(r.code, 1, format);
    assert.match(r.out, pattern, format);
  }
});

test('files: a path shown relative with forward slashes, or absolute outside the base; a bounded read; text without a byte order mark', async () => {
  assert.equal(displayPath(resolve('/base/sub/a.html'), resolve('/base')), 'sub/a.html');
  assert.equal(displayPath(resolve('/base'), resolve('/base')), '.');
  assert.ok(!displayPath(resolve('/other/a.html'), resolve('/base')).startsWith('..'));
  assert.deepEqual([fileError('x', 'gone').message, fileError('x', 'gone').reason], ['x: gone', 'gone']);
  assert.equal(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), 'a');
  await withFiles({ 'a.html': 'hello', 'big.html': 'x'.repeat(100) }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a.html'))).toString(), 'hello');
    await assert.rejects(readBounded(resolve(dir, 'big.html'), 10), /100 bytes is over the 10 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'none.html')), /no such file/);
    await assert.rejects(readBounded(dir), /not a regular file|cannot be read/);
  });
});

test('the example sites: the broken one fails as the README shows, the fixed one passes at --fail-on warning', async () => {
  const b = await inRoot(['examples/site-broken', '--fail-on', 'warning']);
  assert.equal(b.code, 1);
  assert.match(b.out, /^findings: 13 error, 8 warning, 4 info$/m);
  for (const f of FINDINGS) assert.match(b.out, new RegExp(` ${f.id} `), `the broken site shows ${f.id}`);
  const f = await inRoot(['examples/site-fixed', '--fail-on', 'warning']);
  assert.equal(f.code, 0);
  assert.match(f.out, /^findings: 0 error, 0 warning, 3 info$/m);
});

test('the example output in the repository is what the tool prints now', async () => {
  const b = await inRoot(['examples/site-broken', '--fail-on', 'warning']);
  assert.equal(await read('examples/output/site-broken.txt'), b.out);
  assert.equal(await read('examples/output/site-fixed.txt'), (await inRoot(['examples/site-fixed', '--fail-on', 'warning'])).out);
  for (const [format, file] of [['markdown', 'site-broken.md'], ['json', 'site-broken.json'], ['csv', 'site-broken.csv']]) {
    assert.equal(await read(`examples/output/${file}`), (await inRoot(['examples/site-broken', '--fail-on', 'warning', '--format', format])).out, file);
  }
  assert.deepEqual((await readdir(resolve(root, 'examples/output'))).sort(), ['site-broken.csv', 'site-broken.json', 'site-broken.md', 'site-broken.txt', 'site-fixed.txt']);
});

test('the example sites give the same report with CRLF line ends as with LF', async () => {
  const files = {};
  for (const name of await readdir(resolve(root, 'examples/site-broken'))) files[name] = await read(`examples/site-broken/${name}`);
  assert.ok(Object.values(files).every((t) => !t.includes('\r')), 'the example files are stored with LF');
  const crlf = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.split('\n').join('\r\n')]));
  const a = await run(files, ['.', '--format', 'json']);
  const b = await run(crlf, ['.', '--format', 'json']);
  const strip = (o) => JSON.parse(o).findings.map((f) => [f.id, f.file, f.line, f.column]);
  assert.deepEqual(strip(b.out), strip(a.out));
});
