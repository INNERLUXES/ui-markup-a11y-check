import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINDINGS, accessibleName, isFocusable, parseHtml, parseTabindex, parseViewport, textOf, labelsOf, inputType, isFormField, idList, meetsThreshold, safeText } from '../src/index.js';
import { check, find, ids, page, problems } from './helpers.js';

test('a clean page has only its summary', () => {
  const r = check(page('<h1>Shoes</h1><img src="a.png" alt="Red shoe"><a href="/size">Size guide</a><label for="q">Search</label><input id="q" type="search"><button>Add to cart</button>'));
  assert.deepEqual(ids(r), ['summary']);
  assert.equal(r.gate.pass, true);
});

test('summary: elements, images, controls and the outline of headings of each file', () => {
  const r = check(page('<h1>Shoes</h1><h2>Sizes</h2><img src="a.png" alt="x"><img src="b.png" alt=""><a href="/">Home</a><button>Buy</button><label>Q <input></label>'));
  const s = find(r, 'summary')[0];
  assert.equal(s.severity, 'info');
  assert.equal(s.line, 0);
  assert.match(s.message, /^Page with \d+ elements: 2 images \(1 with alt text, 1 with alt="", 0 with no alt\), 3 controls \(1 button, 1 link, 1 form field\), 2 headings: h1 Shoes and h2 Sizes\.$/);
  const frag = check('<div><a href="/">Home</a></div>');
  assert.match(find(frag, 'summary')[0].message, /^Fragment \(no doctype/);
  assert.ok(frag.notes.some((n) => /1 file is a fragment of a page/.test(n)));
  assert.deepEqual(problems(frag), []);
});

test('img-no-alt: an img with no alt, and an image button with no alt text; alt="" and aria-label pass', () => {
  const r = check(page('<h1>x</h1><img src="img/shoe.png?v=3"><img src="d.png" alt=""><img src="l.png" aria-label="Logo"><input type="image" src="go.png"><input type="image" src="ok.png" alt="Search"><img src="p.png" role="presentation">'));
  const f = find(r, 'img-no-alt');
  assert.equal(f.length, 3);
  assert.match(f[0].message, /^The image "shoe\.png" has no alt attribute\./);
  assert.match(f[1].message, /^The image button \(input type="image"\) has no alt text/);
  assert.match(f[2].message, /role="presentation" but no alt attribute/);
  assert.equal(f[0].severity, 'error');
  assert.equal(f[0].snippet, '<img src="img/shoe.png?v=3">');
});

test('img-no-alt: hidden images and images inside aria-hidden are left alone; an image with only a title is title-only-name', () => {
  const r = check(page('<h1>x</h1><div hidden><img src="a.png"></div><div aria-hidden="true"><img src="b.png"></div><img src="c.png" title="Our team">'));
  assert.deepEqual(problems(r), ['title-only-name']);
});

test('control-no-name: buttons, links with href and input type="button" with no name; text, aria-label, aria-labelledby and alt give one', () => {
  const r = check(page('<h1>x</h1><span id="lbl">Close</span><button></button><button><svg><path d="M0"/></svg></button><a href="/"><img src="l.png" alt=""></a><input type="button"><button>Buy</button><button aria-label="Menu"></button><button aria-labelledby="lbl"></button><a href="/"><img src="l.png" alt="Home"></a><a>no href</a><input type="submit"><button><svg><title>Cart</title></svg></button>'));
  const f = find(r, 'control-no-name');
  assert.deepEqual(f.map((x) => x.snippet), ['<button>', '<button>', '<a href="/">', '<input type="button">']);
  assert.match(f[1].message, /Its only content is an svg icon with no title/);
  assert.match(f[2].message, /Its only content is an image with alt=""/);
  assert.match(f[2].fix, /alt="Home"/);
});

test('control-no-name: a link that holds only an image with no alt is left to img-no-alt, not reported twice', () => {
  const r = check(page('<h1>x</h1><a href="/"><img src="l.png"></a>'));
  assert.deepEqual(problems(r), ['img-no-alt']);
});

test('form-field-no-label: inputs, selects and textareas with no label; for, a wrapping label, aria-label and aria-labelledby give one', () => {
  const r = check(page('<h1>x</h1><input id="a"><select name="s"><option>1</option></select><textarea></textarea><input type="checkbox"><input type="hidden" name="t"><input type="submit"><label for="b">B</label><input id="b"><label>C <input></label><input aria-label="D"><span id="e">E</span><input aria-labelledby="e">'));
  const f = find(r, 'form-field-no-label');
  assert.deepEqual(f.map((x) => x.snippet), ['<input id="a">', '<select name="s">', '<textarea>', '<input type="checkbox">']);
  assert.match(f[0].message, /^The field \(<input type="text">, id "a"\) has no label/);
  assert.match(f[0].fix, /<label for="a">/);
  assert.ok(!find(r, 'control-no-name').length, 'the ids are distinct: fields are never control-no-name');
});

test('form-field-no-label: a label whose for names another id does not label the field it wraps, and for reaches only the first of two ids', () => {
  const r = check(page('<h1>x</h1><label for="other">Name <input id="n"></label><p id="other"></p><label for="d">D</label><input id="d"><input id="d">'));
  const f = find(r, 'form-field-no-label');
  assert.equal(f.length, 2);
  assert.ok(find(r, 'duplicate-id').length === 1);
});

test('title-only-name: a name that comes only from title, or only from a placeholder of a text field', () => {
  const r = check(page('<h1>x</h1><button title="Save"></button><input type="email" placeholder="Email"><textarea placeholder="Notes"></textarea><a href="/" title="Home"></a>'));
  const f = find(r, 'title-only-name');
  assert.deepEqual(f.map((x) => x.subject), ['title', 'placeholder', 'placeholder', 'title']);
  assert.equal(f[0].severity, 'warning');
  assert.match(f[1].message, /comes from its placeholder \("Email"\)/);
  assert.deepEqual(find(r, 'control-no-name'), []);
});

test('html-no-lang: no lang, an empty one, one that is not a language tag, and no html tag; fine lang values pass', () => {
  const msg = (attrs) => find(check(page('<h1>x</h1>', { htmlAttrs: attrs })), 'html-no-lang').map((f) => f.message)[0] ?? null;
  assert.match(msg(''), /has no lang attribute/);
  assert.match(msg(' lang=""'), /is empty/);
  assert.match(msg(' lang="en_US"'), /not a language tag/);
  for (const ok of [' lang="en"', ' lang="pt-BR"', ' LANG="zh-Hant-TW"']) assert.equal(msg(ok), null, ok);
  const noHtml = check('<!DOCTYPE html><title>x</title><h1>x</h1>');
  assert.match(find(noHtml, 'html-no-lang')[0].message, /no html start tag/);
  assert.equal(find(noHtml, 'html-no-lang')[0].line, 1);
});

test('page-no-title: no title element, or an empty one; a title inside an svg does not count', () => {
  const none = page('<h1>x</h1><svg><title>Icon</title></svg>').replace('<title>Shoes - Shop</title>', '');
  assert.match(find(check(none), 'page-no-title')[0].message, /has no title element/);
  assert.match(find(check(page('<h1>x</h1>', { title: '  ' })), 'page-no-title')[0].message, /is empty/);
  assert.deepEqual(find(check(page()), 'page-no-title'), []);
});

test('viewport-blocks-zoom: user-scalable=no or 0, and a maximum-scale below 2; a viewport that allows zoom passes', () => {
  const r = (content) => find(check(page('<h1>x</h1>', { head: `<meta name="viewport" content="${content}">` })), 'viewport-blocks-zoom');
  assert.match(r('width=device-width, user-scalable=no')[0].message, /sets user-scalable=no,/);
  assert.match(r('width=device-width; maximum-scale=1.0; user-scalable=0')[0].message, /user-scalable=0 and maximum-scale=1\.0/);
  assert.equal(r('width=device-width, initial-scale=1').length, 0);
  assert.equal(r('maximum-scale=5, user-scalable=yes').length, 0);
  assert.equal(r('maximum-scale=2').length, 0);
  assert.deepEqual(parseViewport('USER-SCALABLE = NO').reasons, ['user-scalable=no']);
});

test('heading-skip, no-h1 and several-h1', () => {
  const r = check(page('<h1>A</h1><h2>B</h2><h4>C</h4><h2>D</h2><h3>E</h3><h1>F</h1><div hidden><h6>G</h6></div>'));
  const skip = find(r, 'heading-skip');
  assert.equal(skip.length, 1);
  assert.match(skip[0].message, /^The h4 "C" comes after the h2 "B" at line \d+, so level 3 is skipped\./);
  assert.match(skip[0].fix, /^Use h3 here/);
  const several = find(r, 'several-h1');
  assert.equal(several.length, 1);
  assert.equal(several[0].severity, 'info');
  const none = check(page('<h2>A</h2><h3>B</h3>'));
  assert.match(find(none, 'no-h1')[0].message, /its first heading is the h2 "A"/);
  assert.match(find(check(page('<p>x</p>')), 'no-h1')[0].message, /no headings at all/);
  assert.match(find(check(page('<h1>A</h1><h3>B</h3><h6>C</h6>')), 'heading-skip')[1].message, /level 4 and 5 are skipped|levels? 4 and 5/);
});

test('table-no-headers: a data table with no th; th, headers, role="presentation" and a one-row table pass', () => {
  const data = '<table><tr><td>Size</td><td>Stock</td></tr><tr><td>40</td><td>Yes</td></tr></table>';
  assert.match(find(check(page(`<h1>x</h1>${data}`)), 'table-no-headers')[0].message, /^The table has 2 rows of up to 2 cells and no th cell\./);
  for (const ok of ['<table><tr><th>Size</th><th>Stock</th></tr><tr><td>40</td><td>Yes</td></tr></table>', '<table role="presentation"><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>', '<table><tr><td>a</td><td>b</td></tr></table>', '<table><tr><td>a</td><td headers="h">b</td></tr><tr><td>c</td><td>d</td></tr></table>']) {
    assert.deepEqual(find(check(page(`<h1>x</h1>${ok}`)), 'table-no-headers'), [], ok);
  }
  const nested = '<table><tr><th>A</th><th>B</th></tr><tr><td><table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table></td><td>x</td></tr></table>';
  assert.equal(find(check(page(`<h1>x</h1>${nested}`)), 'table-no-headers').length, 1, 'the th of the outer table does not count for the inner one');
});

test('duplicate-id: one finding per id, at the second element, naming every place', () => {
  const r = check(page('<h1>x</h1><p id="a">1</p><p id="a">2</p><span id="a">3</span><label for="a">L</label><p id="b"></p>'));
  const f = find(r, 'duplicate-id');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The id "a" is used by 3 elements in this file: <p> at \d+:\d+, <p> at \d+:\d+ and <span> at \d+:\d+\. A label or an aria attribute points at this id/);
});

test('aria-reference-missing: aria-labelledby, aria-describedby, aria-controls and label for that name a missing id', () => {
  const r = check(page('<h1>x</h1><p id="ok">t</p><input aria-label="a" aria-describedby="ok gone"><button aria-controls="menu" aria-labelledby="ok">b</button><label for="nope">x</label><div aria-describedby="ok"></div>'));
  const f = find(r, 'aria-reference-missing');
  assert.deepEqual(f.map((x) => x.subject), ['aria-describedby', 'aria-controls', 'for']);
  assert.match(f[0].message, /names the id "gone", which no element in the file has/);
  assert.deepEqual(idList(' a\tb  c '), ['a', 'b', 'c']);
});

test('vague-link-text: "click here", "read more", "here" and "more" with no aria-label; specific text and aria-label pass', () => {
  const r = check(page('<h1>x</h1><a href="/a">Click here</a><a href="/b">Read more &raquo;</a><a href="/c"> here. </a><a href="/d">More</a><a href="/e" aria-label="More trail shoes">More</a><a href="/f">More trail shoes</a><a href="/g">Where to buy here</a>'));
  assert.deepEqual(find(r, 'vague-link-text').map((f) => f.snippet), ['<a href="/a">', '<a href="/b">', '<a href="/c">', '<a href="/d">']);
});

test('positive-tabindex: a tabindex above 0 is a warning; 0 and -1 pass', () => {
  const r = check(page('<h1>x</h1><span tabindex="2">a</span><a href="/" tabindex=" +7">b</a><span tabindex="0">c</span><span tabindex="-1">d</span><span tabindex="x">e</span>'));
  assert.deepEqual(find(r, 'positive-tabindex').map((f) => f.snippet), ['<span tabindex="2">', '<a href="/" tabindex=" +7">']);
  assert.deepEqual([parseTabindex('3'), parseTabindex(' -1 '), parseTabindex('x'), parseTabindex(null)], [3, -1, null, null]);
});

test('autoplay-media: video and audio with autoplay that are not muted', () => {
  const r = check(page('<h1>x</h1><video src="a.mp4" autoplay></video><audio src="b.mp3" autoplay controls></audio><video src="c.mp4" autoplay muted playsinline></video><video src="d.mp4" controls></video>'));
  const f = find(r, 'autoplay-media');
  assert.equal(f.length, 2);
  assert.match(f[0].message, /It has no controls attribute/);
  assert.doesNotMatch(f[1].message, /no controls attribute/);
});

test('aria-hidden-focusable: links, buttons, fields and tabindex 0 inside aria-hidden; tabindex -1, disabled and hidden pass', () => {
  const r = check(page('<h1>x</h1><div aria-hidden="true"><a href="/a">a</a><button>b</button><input aria-label="c"><span tabindex="0">d</span><a href="/e" tabindex="-1">e</a><button disabled>f</button><div hidden><a href="/g">g</a></div><a>no href</a></div><button aria-hidden="true">h</button><div aria-hidden="false"><a href="/i">i</a></div>'));
  const f = find(r, 'aria-hidden-focusable');
  assert.deepEqual(f.map((x) => x.snippet), ['<a href="/a">', '<button>', '<input aria-label="c">', '<span tabindex="0">', '<button aria-hidden="true">']);
  assert.match(f[0].message, /inside <div> at \d+:\d+, which has aria-hidden="true"/);
  assert.match(f[4].message, /but it has aria-hidden="true"/);
});

test('names: the order of the accessible name, text from content, labels, and what takes focus', () => {
  const doc = parseHtml('<span id="l1">First</span><span id="l2" hidden>Second</span><button id="b" aria-labelledby="l1 l2" aria-label="no">x</button><a href=x>Go <img alt="home"> <span aria-hidden="true">icon</span> <span aria-label="now"></span></a><label for="f">Field</label><input id="f" title="t"><input type="reset"><summary>s</summary><details><summary>d</summary></details><div contenteditable>e</div>');
  const el = (sel) => doc.elements.find(sel);
  assert.deepEqual(accessibleName(el((e) => e.name === 'button'), doc), { name: 'First Second', from: 'aria-labelledby' });
  assert.deepEqual(accessibleName(el((e) => e.name === 'a'), doc), { name: 'Go home now', from: 'content' });
  const field = el((e) => e.name === 'input');
  assert.deepEqual(accessibleName(field, doc), { name: 'Field', from: 'label' });
  assert.equal(labelsOf(field, doc).length, 1);
  assert.deepEqual(accessibleName(el((e) => attr2(e, 'type') === 'reset'), doc), { name: 'Reset', from: 'default' });
  assert.equal(textOf(el((e) => e.name === 'a')), 'Go home now');
  const summaries = doc.elements.filter((e) => e.name === 'summary');
  assert.deepEqual(summaries.map(isFocusable), [false, true]);
  assert.equal(isFocusable(el((e) => e.name === 'div')), true);
  assert.equal(inputType(field), 'text');
  assert.equal(isFormField(field), true);
});

const attr2 = (e, n) => (e.attrs.has(n) ? e.attrs.get(n) : null);

test('elements inside a template are not checked, and ids inside it do not count', () => {
  const r = check(page('<h1>x</h1><template><img src="a.png"><p id="dup"></p><button></button></template><p id="dup"></p>'));
  assert.deepEqual(problems(r), []);
  assert.ok(r.notes.some((n) => /1 template element: the content of a template is not part of the page/.test(n)));
});

test('several files: findings name their file, and the gate counts them all', () => {
  const r = check({ 'a.html': page('<h1>x</h1><img src="a.png">'), 'sub/b.html': page('<h2>y</h2>') });
  assert.deepEqual(problems(r), ['img-no-alt', 'no-h1']);
  assert.deepEqual(r.findings.filter((f) => f.id !== 'summary').map((f) => f.file), ['a.html', 'sub/b.html']);
  assert.equal(r.files.pages, 2);
});

test('findings of one kind are capped, counted in the totals and the gate, and named in a note', () => {
  const r = check(page(`<h1>x</h1>${'<img src="a.png">'.repeat(5)}`), { limits: { maxListedPerFinding: 3 } });
  assert.equal(find(r, 'img-no-alt').length, 3);
  assert.equal(r.counts.error, 5);
  assert.ok(r.notes.includes('2 more findings of img-no-alt are counted but not listed'));
  assert.match(r.areas.find((a) => a.id === 'images').detail, /img-no-alt x5/);
});

test('areas, the gate and the order of the findings', () => {
  const r = check(page('<h2>x</h2><img src="a.png"><span tabindex="1">t</span>'), { failOn: 'warning' });
  assert.deepEqual(r.areas.map((a) => [a.id, a.result]), [['page', 'info'], ['images', 'fail'], ['names', 'pass'], ['structure', 'warn'], ['ids', 'pass'], ['focus', 'warn']]);
  assert.deepEqual(r.gate, { failOn: 'warning', pass: false, reason: '1 error, 2 warnings' });
  assert.equal(r.findings[0].id, 'summary');
  assert.equal(FINDINGS[0].id, 'summary');
  assert.equal(meetsThreshold('info', 'warning'), false);
  assert.equal(meetsThreshold('warning', 'error'), false);
});

test('safeText removes control, line separator and direction characters and caps the length', () => {
  assert.equal(safeText(`a${String.fromCharCode(27)}[31mb${String.fromCharCode(0x202e)}c${String.fromCharCode(0x2028)}d`), 'a [31mb c d');
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
});
