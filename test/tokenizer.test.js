import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeReferences, lineStarts, positionOf, tokenize, parseHtml, attr, snippetOf } from '../src/index.js';

const starts = (text) => tokenize(text).tokens.filter((t) => t.type === 'start');

test('tokenizer: attributes quoted, single-quoted, unquoted and with no value, names in lower case, the first of two wins', () => {
  const [t] = starts('<INPUT Type=email id=\'e\' required data-x="a > b" ID="second">');
  assert.equal(t.name, 'input');
  assert.deepEqual(t.attrs.map((a) => [a.name, a.value]), [['type', 'email'], ['id', 'e'], ['required', ''], ['data-x', 'a > b']]);
});

test('tokenizer: void elements and the self-closing slash; an HTML element with a slash still opens', () => {
  const doc = parseHtml('<p>a<br>b<img src=x />c</p><div/><span>in div</span>');
  const div = doc.elements.find((e) => e.name === 'div');
  assert.equal(doc.elements.find((e) => e.name === 'span').parent, div);
  assert.equal(doc.elements.find((e) => e.name === 'img').children.length, 0);
  const svg = parseHtml('<svg><path d="M0"/><title>Cart</title></svg>');
  assert.equal(svg.elements.find((e) => e.name === 'title').parent.name, 'svg');
});

test('tokenizer: comments, the doctype, bogus comments and processing instructions are not tags', () => {
  const t = tokenize('<!DOCTYPE html><!-- <img> --><!--><!---><?xml x?><!x><b>t</b></ >');
  assert.deepEqual(t.tokens.map((x) => x.type), ['doctype', 'comment', 'comment', 'comment', 'comment', 'comment', 'start', 'text', 'end', 'comment']);
  assert.equal(starts('<!-- <img src=a> -->').length, 0);
});

test('tokenizer: script, style and template content is raw text, never markup; title and textarea decode references', () => {
  const html = '<script>if (a < b) { x = "<img>"; }</script><style>p > a {}</style><template><img></template><title>A &amp; B</title><textarea><b>x</b></textarea>';
  assert.deepEqual(starts(html).map((t) => t.name), ['script', 'style', 'template', 'title', 'textarea']);
  const doc = parseHtml(html);
  assert.equal(doc.templates, 1);
  assert.equal(doc.elements.find((e) => e.name === 'title').children[0].text, 'A & B');
  assert.equal(doc.elements.find((e) => e.name === 'textarea').children[0].text, '<b>x</b>');
  assert.deepEqual(starts('<template><template><img></template><img></template><a>').map((t) => t.name), ['template', 'a']);
  assert.deepEqual(starts('<SCRIPT>x</script ><p>').map((t) => t.name), ['script', 'p']);
});

test('character references: named, decimal and hex, decoded once; unknown names kept; bad code points replaced', () => {
  assert.equal(decodeReferences('a &amp; b &lt;c&gt; &#65;&#x42; &quot;'), 'a & b <c> AB "');
  assert.equal(decodeReferences('&amp;amp;'), '&amp;');
  assert.equal(decodeReferences('&unknown; &zz'), '&unknown; &zz');
  assert.equal(decodeReferences('&#0;&#x110000;&#xD800;'), String.fromCharCode(0xfffd).repeat(3));
  assert.equal(decodeReferences('&amp x'), '& x');
  assert.equal(decodeReferences('?a=1&copy=2', true), '?a=1&copy=2');
  assert.equal(decodeReferences('&nbsp;').charCodeAt(0), 160);
});

test('lines and columns: LF, CRLF and a lone CR each end a line', () => {
  const s = lineStarts('a\nb\r\nc\rd');
  assert.deepEqual(s, [0, 2, 5, 7]);
  assert.deepEqual(positionOf(s, 6), { line: 3, column: 2 });
  const doc = parseHtml('<p>\r\n  <img src=x>\r\n</p>');
  const img = doc.elements.find((e) => e.name === 'img');
  assert.deepEqual([img.line, img.column], [2, 3]);
  assert.equal(snippetOf(doc, img), '<img src=x>');
});

test('the tree: a new paragraph, list item, row or cell closes the open one; an end tag with no open element is ignored', () => {
  const doc = parseHtml('<ul><li>a<li>b</ul><p>x<p>y</span><table><tr><td>1<td>2<tr><td>3</table><dl><dt>a<dd>b</dl>');
  const parents = (name) => doc.elements.filter((e) => e.name === name).map((e) => e.parent.name);
  assert.deepEqual(parents('li'), ['ul', 'ul']);
  assert.deepEqual(parents('p'), ['#document', '#document']);
  assert.deepEqual(parents('td'), ['tr', 'tr', 'tr']);
  assert.deepEqual(parents('dd'), ['dl']);
  assert.equal(doc.elements.filter((e) => e.name === 'td').every((td) => td.table === doc.elements.find((e) => e.name === 'table')), true);
});

test('the tree: flags for hidden, aria-hidden, inert, label and the ids of the page', () => {
  const doc = parseHtml('<div hidden><a href=x>a</a></div><div aria-hidden="TRUE"><span><button>b</button></span></div><label>Name <input id=n></label><p id=n></p>');
  const a = doc.elements.find((e) => e.name === 'a');
  const button = doc.elements.find((e) => e.name === 'button');
  const input = doc.elements.find((e) => e.name === 'input');
  assert.equal(a.hidden, true);
  assert.equal(button.ariaHiddenRoot.name, 'div');
  assert.equal(input.label.name, 'label');
  assert.equal(doc.ids.get('n').length, 2);
  assert.equal(attr(input, 'id'), 'n');
  assert.equal(doc.isPage, false);
  assert.equal(parseHtml('<!doctype html><p>').isPage, true);
});

test('broken markup: a tag, a quote or a comment that runs to the end of the file is reported, never a crash', () => {
  for (const html of ['<p>ok<img src="x', '<p>ok<div class=a', '<p>ok<!-- open', '<p>ok</div', '<!DOCTYPE html']) {
    const t = tokenize(html);
    assert.equal(t.problems.length, 1, html);
  }
  const doc = parseHtml('<a href="x>text');
  assert.equal(doc.elements.length, 0);
  assert.equal(doc.problems[0].kind, 'tag');
});
