import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LIMITS, decodeReferences, isBinary, main, parseHtml, readInputs, textOf, toCsv, toMarkdown, toText, tokenize } from '../src/index.js';
import { check, find, page, problems, run, withFiles } from './helpers.js';

// Hostile input: a page that tries to exhaust the memory or the time, to lead the tool out of the folder or round in a
// loop, to make it run a script or fetch a file, to rewrite the terminal, to break a table or to change how objects
// behave. Each test also checks the time, because work that grows faster than the input is a failure even when the
// answer is right.

const LIMIT = { timeout: 60000 };
const fast = async (fn, ms = 5000) => {
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < ms, `took ${Date.now() - start} ms`);
  return result;
};
const quiet = { out: () => {}, err: () => {} };

test('hostile: a file over the size limit is not read and is named in a note', LIMIT, async () => {
  await withFiles({ 'site/a.html': page(), 'site/big.html': `<p>${'x'.repeat(3000)}</p>` }, async (dir) => {
    let out = '';
    const code = await fast(() => main(['site', '--format', 'json'], { out: (t) => { out += t; }, err: () => {} }, { ...LIMITS, maxFileBytes: 1024 }, dir));
    assert.equal(code, 0);
    const r = JSON.parse(out);
    assert.equal(r.files.notRead, 1);
    assert.ok(r.notes.some((n) => /1 HTML file was not read and not checked: site\/big\.html \(3,00\d bytes is over the 1,024 byte limit\)/.test(n)));
  });
});

test('hostile: more entries, deeper folders, more HTML files or more bytes than the limits refuse the input with exit code 2', LIMIT, async () => {
  await withFiles({ 'a/b/c/d/e.html': 'x', 'f.html': 'x', 'g.html': 'x' }, async (dir) => {
    let err = '';
    const e = { out: () => {}, err: (t) => { err += t; } };
    assert.equal(await main(['.'], e, { ...LIMITS, maxEntries: 3 }, dir), 2);
    assert.match(err, /holds more than 3 files and folders/);
    err = '';
    assert.equal(await main(['.'], e, { ...LIMITS, maxDepth: 2 }, dir), 2);
    assert.match(err, /has folders nested more than 2 deep/);
    err = '';
    assert.equal(await main(['.'], e, { ...LIMITS, maxHtmlFiles: 2 }, dir), 2);
    assert.match(err, /more than 2 HTML files/);
    err = '';
    assert.equal(await main(['.'], e, { ...LIMITS, maxTotalBytes: 2 }, dir), 2);
    assert.match(err, /the HTML files to read hold more than 2 byte/);
  });
});

test('hostile: a binary file with an .html name is not read as markup', LIMIT, async () => {
  await withFiles({ 'b.html': page() }, async (dir) => {
    await writeFile(resolve(dir, 'a.html'), Buffer.from([0x3c, 0x00, 0x01, 0xff]));
    const r = await readInputs(['.'], dir);
    assert.equal(r.files.find((f) => f.file === 'a.html').reason, 'holds binary data');
    assert.equal(isBinary(Buffer.from('<p>text</p>')), false);
  });
});

test('hostile: elements nested a hundred thousand deep are read in one pass, past the nesting limit as if flat, with a note', LIMIT, async () => {
  const deep = `${'<div>'.repeat(100000)}<button></button>${'</div>'.repeat(100000)}`;
  const r = await fast(() => check(page(`<h1>x</h1>${deep}`)));
  assert.equal(find(r, 'control-no-name').length, 1);
  assert.ok(r.notes.some((n) => /elements nested more than 512 deep were read as if they were not nested/.test(n)));
  const doc = await fast(() => parseHtml(`${'<span>'.repeat(50000)}x`));
  assert.ok(doc.deepest <= 513);
  await fast(() => textOf(doc.root));
});

test('hostile: tags, quotes and comments that never end, stray end tags and lone brackets run in one pass', LIMIT, async () => {
  for (const html of [`<img src="${'a'.repeat(200000)}`, `<!--${'-'.repeat(200000)}`, `${'</div>'.repeat(50000)}<p>`, `${'<'.repeat(100000)}`, `${'<a'.repeat(100000)}`, `<div ${'a='.repeat(50000)}>`, `${'<!x'.repeat(50000)}`, `<script>${'<script>'.repeat(50000)}`, `${'<template>'.repeat(20000)}`, `${'&amp;'.repeat(100000)}`, `<p title='${"'".repeat(1)}${'x'.repeat(100000)}`]) {
    await fast(() => check({ 'a.html': html }), 4000);
  }
});

test('hostile: a tag with thousands of attributes keeps the first 256 and says so', LIMIT, async () => {
  const attrs = Array.from({ length: 3000 }, (_, i) => `data-a${i}="x"`).join(' ');
  const r = await fast(() => check(page(`<h1>x</h1><div ${attrs}></div>`)));
  assert.ok(r.notes.some((n) => /2,744 attributes past 256 on one tag were not read/.test(n)));
});

test('hostile: entity tricks never expand: a doctype with entity declarations is not read, references decode once, huge numbers are replaced', LIMIT, async () => {
  const laughs = '<!DOCTYPE html [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]><html lang="en"><title>&c;</title><h1>&c;&c;&c;</h1>';
  const doc = await fast(() => parseHtml(laughs));
  const h1 = doc.elements.find((e) => e.name === 'h1');
  assert.equal(textOf(h1), '&c;&c;&c;');
  assert.ok(doc.text.length === laughs.length);
  assert.equal(decodeReferences('&amp;lt;'), '&lt;');
  assert.equal(decodeReferences('&#99999999999;'), `${String.fromCharCode(0xfffd)}9;`);
  const big = `${'&#x41;'.repeat(100000)}`;
  assert.equal((await fast(() => decodeReferences(big))).length, 100000);
});

test('hostile: thousands of findings of one kind are capped at 200 and counted', LIMIT, async () => {
  const r = await fast(() => check(page(`<h1>x</h1>${'<img src="a.png">'.repeat(3000)}`)), 8000);
  assert.equal(find(r, 'img-no-alt').length, 200);
  assert.equal(r.counts.error, 3000);
  assert.ok(r.notes.includes('2,800 more findings of img-no-alt are counted but not listed'));
});

test('hostile: many labels, ids and references do not grow the work faster than the page', LIMIT, async () => {
  const n = 5000;
  const fields = Array.from({ length: n }, (_, i) => `<label for="f${i}">F</label><input id="f${i}" aria-describedby="h${i} big">`).join('');
  const big = `<div id="big">${'<span>t</span>'.repeat(n)}</div>`;
  const labelled = Array.from({ length: n }, () => '<button aria-labelledby="big"></button>').join('');
  const r = await fast(() => check(page(`<h1>x</h1>${big}${fields}${labelled}<table>${'<tr><td>a<td>b'.repeat(n)}</table>`)), 15000);
  assert.equal(find(r, 'aria-reference-missing').length, 200);
});

test('hostile: the text of a file name, an attribute or an id with control, direction and line separator characters is cleaned in every format', LIMIT, () => {
  const bad = ['x', String.fromCharCode(27), '[31m', String.fromCharCode(0x202e), 'y', String.fromCharCode(0x2028), 'z', String.fromCharCode(0x85)].join('');
  const r = check({ [`${bad}.html`]: page(`<h1>x</h1><img src="${bad}.png"><p id="${bad}"></p><p id="${bad}"></p><label for="${bad}q">x</label>`) });
  assert.ok(problems(r).includes('img-no-alt'));
  for (const o of [toText(r), toMarkdown(r), toCsv(r), JSON.stringify(r)]) {
    for (const code of [27, 0x202e, 0x2028, 0x85]) assert.ok(!o.includes(String.fromCharCode(code)), `character ${code}`);
  }
});

test('hostile: ids and attribute names such as __proto__, constructor and toString are only names', LIMIT, () => {
  const r = check({ '__proto__.html': page('<h1>x</h1><p id="__proto__"></p><p id="__proto__"></p><label for="constructor">x</label><input id="toString" __proto__="1" aria-labelledby="hasOwnProperty">') });
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
  assert.equal(find(r, 'duplicate-id').length, 1);
  assert.deepEqual(find(r, 'aria-reference-missing').map((f) => f.subject).sort(), ['aria-labelledby', 'for']);
});

test('hostile: markup that starts with = or holds a link or a tag cannot run in a spreadsheet or break a Markdown table', LIMIT, () => {
  const evil = '=HYPERLINK("x","y")|a<script>[click](https://evil.example.test)`x`';
  const r = check({ [`${evil}.html`]: page('<h1>x</h1><img src="a.png">') });
  const md = toMarkdown(r);
  assert.ok(!md.includes('<script>'));
  assert.ok(!md.includes('[click]('));
  for (const row of md.split('\n').filter((l) => l.startsWith('| error |'))) assert.equal(row.replace(/\\\|/g, '').split('|').length, 9, row.slice(0, 80));
  assert.ok(!/(^|,)=HYPERLINK/m.test(toCsv(r)));
});

test('hostile: scripts are never run and nothing is fetched, whatever the page asks for', LIMIT, async () => {
  const marker = 'ran-the-script.txt';
  const html = page(`<h1>x</h1><script>require('fs').writeFileSync('${marker}', 'x'); process.exit(3);</script><img src="https://example.test/a.png" alt="A"><iframe src="https://example.test/" title="x"></iframe><link rel="stylesheet" href="https://example.test/a.css"><button onclick="process.exit(4)">Go</button>`);
  await withFiles({ 'a.html': html }, async (dir) => {
    const code = await main(['a.html'], quiet, undefined, dir);
    assert.equal(code, 0);
    const r = await readInputs(['.'], dir);
    assert.deepEqual(r.files.map((f) => f.file), ['a.html']);
    assert.equal(r.otherFiles, 0, 'no file was written');
  });
  assert.equal(tokenize('<script>document.write("<img>")</script>').tokens.filter((t) => t.type === 'start').length, 1);
});

test('hostile: an argument that is a URL, a very long path, or a path with control characters is refused cleanly', LIMIT, async () => {
  const url = await run({}, ['https://example.test/index.html']);
  assert.equal(url.code, 2);
  assert.match(url.err, /never fetches a URL/);
  const long = await run({}, [`${'a'.repeat(5000)}.html`]);
  assert.equal(long.code, 2);
  assert.ok(long.err.length < 8000);
  const control = await run({}, [`x${String.fromCharCode(27)}[31m.html`]);
  assert.equal(control.code, 2);
  assert.ok(!control.err.includes(String.fromCharCode(27)));
});

test('hostile: a symbolic link to a folder outside, a link to a file, and a link loop are listed and never followed', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('creating a symbolic link needs a privilege on Windows');
    return;
  }
  await withFiles({ 'outside/secret.html': '<img src="x">', 'site/index.html': page() }, async (dir) => {
    await symlink(resolve(dir, 'outside'), resolve(dir, 'site/escape'));
    await mkdir(resolve(dir, 'site/pages'));
    await symlink(resolve(dir, 'outside/secret.html'), resolve(dir, 'site/pages/linked.html'));
    await symlink(resolve(dir, 'site'), resolve(dir, 'site/loop'));
    let out = '';
    const code = await fast(() => main(['site', '--format', 'json'], { out: (x) => { out += x; }, err: () => {} }, undefined, dir));
    assert.equal(code, 0);
    const r = JSON.parse(out);
    assert.equal(r.files.links, 3);
    assert.equal(r.files.html, 1, 'the page outside the folder was not read');
    assert.ok(r.notes.some((n) => /3 symbolic links were not followed: site\/escape, site\/loop and site\/pages\/linked\.html/.test(n)));
  });
});

test('hostile: a file or folder named on the command line may itself be a link, because the person named it', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('creating a symbolic link needs a privilege on Windows');
    return;
  }
  await withFiles({ 'real/index.html': page() }, async (dir) => {
    await symlink(resolve(dir, 'real'), resolve(dir, 'named'));
    await symlink(resolve(dir, 'real/index.html'), resolve(dir, 'page.html'));
    assert.equal(await main(['named', 'page.html'], quiet, undefined, dir), 0);
  });
});

test('hostile: a device inside the folder is never opened', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('there is no device file to link to on Windows');
    return;
  }
  await withFiles({ 'index.html': page() }, async (dir) => {
    await symlink('/dev/zero', resolve(dir, 'zero.html'));
    let out = '';
    const code = await fast(() => main(['.', '--format', 'json'], { out: (x) => { out += x; }, err: () => {} }, undefined, dir));
    assert.equal(code, 0);
    assert.equal(JSON.parse(out).files.links, 1);
  });
});

test('hostile: a file name with control characters is cleaned in the report, where the system allows such a name', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows does not allow a control character in a file name');
    return;
  }
  const name = `evil${String.fromCharCode(27)}[31m.html`;
  let r;
  try {
    r = await run({ [name]: page('<h1>x</h1><img src="a.png">') }, ['.']);
  } catch (error) {
    if (!['EINVAL', 'EILSEQ', 'ENOENT', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    t.skip(`this file system does not allow the name (${error.code})`);
    return;
  }
  assert.equal(r.code, 1);
  assert.ok(!r.out.includes(String.fromCharCode(27)));
});

test('hostile: a Windows path with backslashes in the markup is only text, on every system', LIMIT, () => {
  const r = check(page('<h1>x</h1><img src="C:\\Users\\ann\\shoe.png"><a href="..\\..\\secret.html">Secret plans</a>'));
  assert.match(find(r, 'img-no-alt')[0].message, /"shoe\.png"|C:\\Users/);
});
