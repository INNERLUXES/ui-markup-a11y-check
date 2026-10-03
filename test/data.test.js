import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { FACTS, FINDINGS, NAMED_REFERENCES, LEGACY_REFERENCES, SOURCES, VAGUE_LINK_TEXT, VOID_ELEMENTS, factPage, source } from '../src/index.js';

// These tests read the saved pages again and compare them with src/data.js: every sentence that a finding or a
// document quotes.

const text = async (id) => readFile(new URL(`../research/sources/${source(id).file}`, import.meta.url), 'utf8');
// Text compared without line breaks or runs of white space.
const flat = (t) => t.replace(/\s+/g, ' ').trim();
const has = (page, needle) => flat(page).includes(flat(needle));
// The words of a tool that wrote a text, built from pieces so that this file does not hold them.
const WRITTEN = new RegExp(`\\b(?:${['A', 'I'].join('')}|${['cha', 't'].join('')}|${['clau', 'de'].join('')}|${['anthro', 'pic'].join('')}|${['ope', 'nai'].join('')}|${['gene', 'rated'].join('')}|${['assis', 'tants?'].join('')}|${['g', 'pt'].join('')}|${['l', 'lms?'].join('')})\\b`, 'i');
const YEAR = /\b(?:19|20)\d{2}\b/;

test('sources: every saved page has its address on the first line, as listed in src/data.js, and holds text', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.equal(page.split('\n')[0], `Source: ${s.url}`, s.file);
    assert.ok(page.length > 800, `${s.file} holds the page text`);
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/._-]+(?:#[a-z-]+)?$/);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.url)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.file)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.id)).size);
});

test('sources: every file in research/sources is listed in src/data.js, and the other way round', async () => {
  const files = (await readdir(new URL('../research/sources/', import.meta.url))).sort();
  assert.deepEqual(files, SOURCES.map((s) => s.file).sort());
});

test('sources: nine Understanding WCAG 2.2 pages, three sections of the HTML Living Standard and WAI-ARIA aria-hidden', () => {
  const hosts = SOURCES.map((s) => new URL(s.url).host);
  assert.deepEqual([...new Set(hosts)].sort(), ['html.spec.whatwg.org', 'www.w3.org']);
  assert.equal(SOURCES.filter((s) => s.url.includes('/WAI/WCAG22/Understanding/')).length, 9);
  for (const sc of ['1.1.1', '1.3.1', '1.4.2', '1.4.4', '2.4.3', '2.4.4', '2.4.6', '3.1.1', '4.1.2']) assert.ok(SOURCES.some((s) => s.label.includes(`SC ${sc} `)), sc);
  assert.ok(SOURCES.some((s) => s.url.endsWith('#aria-hidden')));
});

test('sources: no saved page holds a year, a mention of a tool that wrote it, a control byte, a carriage return or a character that is not ASCII', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.doesNotMatch(page, YEAR, s.file);
    assert.doesNotMatch(page, WRITTEN, s.file);
    assert.doesNotMatch(page, new RegExp(`[${String.fromCharCode(1)}-${String.fromCharCode(8)}]`), s.file);
    assert.ok(!page.includes('\r'), s.file);
    assert.ok([...page].every((c) => c.charCodeAt(0) < 128), s.file);
  }
});

test('the saved pages show what the checks rely on: the success criteria, the empty alt for decoration, one title, unique ids', async () => {
  assert.ok(has(await text('wcag-non-text'), '## Understanding SC 1.1.1 Non-text Content (Level A)'));
  assert.ok(has(await text('wcag-resize'), 'up to 200 percent'));
  assert.ok(has(await text('wcag-audio'), 'for more than 3 seconds'));
  assert.ok(has(await text('html-alt'), '<img src="shalott.jpeg" alt="">'));
  assert.ok(has(await text('html-title'), 'There must be no more than one title element per document.'));
  assert.ok(has(await text('html-global'), 'The value must not contain any ASCII whitespace.'));
  assert.ok(has(await text('aria-hidden'), 'The element is hidden from the accessibility API.'));
});

test('facts: every quoted sentence is on its saved page, word for word, with its section, no year and no mention of a tool that wrote it', async () => {
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(SOURCES.some((s) => s.id === fact.source), key);
    assert.ok(has(await text(fact.source), fact.text), `${key}: "${fact.text}"`);
    assert.ok(has(await text(fact.source), fact.section), `${key}: the section ${fact.section} is on the page`);
    assert.doesNotMatch(fact.text, YEAR, key);
    assert.doesNotMatch(fact.text, WRITTEN, key);
    assert.ok(fact.text.length <= 360, `${key} is short`);
    assert.match(fact.text, /[.:)]$/, `${key} is a whole sentence`);
    assert.equal(factPage(key), source(fact.source).url);
  }
});

test('facts: every finding quotes sentences of src/data.js, and every source page is quoted at least once', () => {
  for (const f of FINDINGS) {
    assert.ok(['error', 'warning', 'info'].includes(f.severity), f.id);
    assert.match(f.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, f.id);
    assert.ok(f.what.length > 20, f.id);
    assert.ok(f.facts.length >= 1 && f.facts.length <= 2, f.id);
    for (const k of f.facts) assert.ok(FACTS[k], `${f.id}: ${k}`);
  }
  const quoted = new Set(Object.values(FACTS).map((f) => f.source));
  for (const s of SOURCES) assert.ok(quoted.has(s.id), s.id);
  assert.deepEqual(FINDINGS.filter((f) => f.severity === 'error').map((f) => f.id), ['html-no-lang', 'page-no-title', 'viewport-blocks-zoom', 'img-no-alt', 'control-no-name', 'form-field-no-label', 'duplicate-id', 'aria-reference-missing', 'aria-hidden-focusable']);
  assert.deepEqual(FINDINGS.filter((f) => f.severity === 'warning').map((f) => f.id), ['autoplay-media', 'title-only-name', 'vague-link-text', 'heading-skip', 'no-h1', 'table-no-headers', 'positive-tabindex']);
  assert.deepEqual(FINDINGS.filter((f) => f.severity === 'info').map((f) => f.id), ['summary', 'several-h1']);
});

test('lists: no duplicates, lower case, and legacy references are named references', () => {
  for (const list of [VOID_ELEMENTS, VAGUE_LINK_TEXT, LEGACY_REFERENCES]) {
    assert.equal(new Set(list).size, list.length);
    for (const x of list) assert.equal(x, x.toLowerCase(), x);
  }
  for (const l of LEGACY_REFERENCES) assert.ok(Object.hasOwn(NAMED_REFERENCES, l), l);
  for (const v of Object.values(NAMED_REFERENCES)) assert.ok(Number.isInteger(v) && v > 0 && v < 0x10000);
});

test('src writes no quoted sentence outside src/data.js', async () => {
  for (const file of ['rules.js', 'check.js', 'tree.js', 'names.js', 'tokenizer.js', 'report.js', 'cli.js', 'files.js']) {
    const code = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const fact of Object.values(FACTS)) if (fact.text.length > 40) assert.ok(!code.includes(fact.text.slice(0, 40)), `${file} writes "${fact.text.slice(0, 40)}" itself`);
  }
});

test('docs: every sentence that the documents quote from a saved page is on a saved page', async () => {
  const pages = (await Promise.all(SOURCES.map((s) => text(s.id)))).map(flat).join(' ');
  let checked = 0;
  for (const file of ['docs/method.md', 'docs/rules-and-sources.md', 'docs/inputs.md', 'docs/limits.md', 'docs/decisions/0001-read-the-markup-never-run-the-page.md', 'README.md']) {
    const doc = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const prose = file === 'README.md' ? doc.replace(/```[\s\S]*?```/g, '') : doc;
    for (const m of prose.matchAll(/"([^"\n]{40,400})"/g)) {
      assert.ok(pages.includes(flat(m[1])), `${file}: ${m[1]}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `${checked} quotes checked`);
});

test('docs: docs/rules-and-sources.md names every saved page, every quoted sentence and every finding', async () => {
  const doc = await readFile(new URL('../docs/rules-and-sources.md', import.meta.url), 'utf8');
  for (const s of SOURCES) {
    assert.ok(doc.includes(s.file), s.file);
    assert.ok(doc.includes(s.url), s.url);
  }
  for (const [key, fact] of Object.entries(FACTS)) assert.ok(doc.includes(`| \`${key}\` |`) && doc.includes(fact.text), key);
  for (const f of FINDINGS) {
    assert.ok(doc.includes(`| \`${f.id}\` | ${f.severity} |`), f.id);
    assert.ok(doc.includes(`(method.md#${f.id}-${f.severity})`), f.id);
    for (const k of f.facts) assert.ok(new RegExp(`\\| \`${k}\` \\| [^|]*\`${f.id}\``).test(doc), `${k} is used by ${f.id}`);
  }
});
