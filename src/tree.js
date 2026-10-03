// Builds a light tree from the tokens of one page: elements with their attributes, parents, children and text, in
// document order. It follows the parts of the HTML parser that decide which element holds which: void elements never
// hold content, a new paragraph, list item, row or cell closes the open one, an end tag closes the elements opened after
// its start tag, and an end tag with no open element is ignored. It is not a full parser (docs/limits.md says where it
// differs); it is enough to know which text names which control, which element is inside which, and on which line each
// one starts. Nothing here opens a file or runs a script.

import { CLOSES_P, VOID_ELEMENTS } from './data.js';
import { TOKEN_LIMITS, lineStarts, positionOf, tokenize } from './tokenizer.js';

export const TREE_LIMITS = {
  ...TOKEN_LIMITS,
  maxElements: 200000,
  maxNesting: 512
};

// Elements that stop the search for an open p, li, dt or dd: past them, the open element belongs to an outer part.
const SCOPE = new Set(['html', 'table', 'td', 'th', 'caption', 'button', 'object', 'marquee', 'applet', 'template', 'svg', 'math']);
const LIST_SCOPE = new Set([...SCOPE, 'ul', 'ol']);
const DL_SCOPE = new Set([...SCOPE, 'dl']);
const TABLE_SCOPE = new Set(['html', 'table', 'template']);
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// The value of an attribute, or null when it is absent.
export const attr = (el, name) => (el.attrs.has(name) ? el.attrs.get(name) : null);
export const hasAttr = (el, name) => el.attrs.has(name);

// Closes the nearest open element named in names, when one is open before a scope boundary.
function closeNearest(stack, names, scope) {
  for (let k = stack.length - 1; k > 0; k -= 1) {
    const name = stack[k].name;
    if (names.has(name)) {
      stack.length = k;
      return true;
    }
    if (scope.has(name)) return false;
  }
  return false;
}

// The implied end tags of the parser that this tool follows: a start tag closes elements that cannot hold it.
function closeFor(stack, name) {
  const top = stack[stack.length - 1];
  if (CLOSES_P.includes(name)) closeNearest(stack, new Set(['p']), SCOPE);
  if (name === 'li') closeNearest(stack, new Set(['li']), LIST_SCOPE);
  else if (name === 'dt' || name === 'dd') closeNearest(stack, new Set(['dt', 'dd']), DL_SCOPE);
  else if (name === 'option' || name === 'optgroup') {
    if (top.name === 'option') stack.pop();
    if (name === 'optgroup' && stack[stack.length - 1].name === 'optgroup') stack.pop();
  } else if (name === 'tr') closeNearest(stack, new Set(['tr']), TABLE_SCOPE);
  else if (name === 'td' || name === 'th') closeNearest(stack, new Set(['td', 'th']), new Set([...TABLE_SCOPE, 'tr']));
  else if (name === 'thead' || name === 'tbody' || name === 'tfoot') closeNearest(stack, new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']), TABLE_SCOPE);
  else if (HEADINGS.has(name) && HEADINGS.has(stack[stack.length - 1].name)) stack.pop();
  else if (name === 'a') closeNearest(stack, new Set(['a']), SCOPE);
  else if (name === 'button') closeNearest(stack, new Set(['button']), new Set(['html', 'template']));
}

const ariaTrue = (el) => (attr(el, 'aria-hidden') ?? '').trim().toLowerCase() === 'true';

// Parses one page. Returns { root, elements, html, doctype, ids, title, text, problems, notes } where elements are in
// document order and each element has name, attrs (a Map), parent, children, offset, end, line, column, and the flags
// that the checks need: hidden (the hidden attribute on it or an ancestor), ariaHiddenRoot (the nearest element with
// aria-hidden="true", itself included), inert, foreign (inside svg or math), label (the nearest label ancestor) and
// table (the nearest table ancestor).
export function parseHtml(text, limits = TREE_LIMITS) {
  const lim = { ...TREE_LIMITS, ...limits };
  const { tokens, problems, truncated, droppedAttributes } = tokenize(text, lim);
  const starts = lineStarts(text);
  const root = { type: 'element', name: '#document', attrs: new Map(), parent: null, children: [], hidden: false, ariaHiddenRoot: null, inert: false, foreign: false, label: null, table: null };
  const elements = [];
  const stack = [root];
  const doc = { root, elements, html: null, doctype: false, templates: 0, text, starts, notes: [], problems, deepest: 0, flattened: 0, capped: false };
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.type === 'text') {
      top.children.push({ type: 'text', text: t.text });
      continue;
    }
    if (t.type === 'raw') {
      if (t.template) doc.templates += 1;
      continue;
    }
    if (t.type === 'doctype') {
      doc.doctype = true;
      continue;
    }
    if (t.type === 'comment') continue;
    if (t.type === 'end') {
      if (VOID_ELEMENTS.includes(t.name)) continue;
      for (let k = stack.length - 1; k > 0; k -= 1) {
        if (stack[k].name === t.name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    // A start tag.
    if (t.name === 'html' && doc.html) {
      for (const a of t.attrs) if (!doc.html.attrs.has(a.name)) doc.html.attrs.set(a.name, a.value);
      continue;
    }
    if (elements.length >= lim.maxElements) {
      doc.capped = true;
      break;
    }
    if (!top.foreign) closeFor(stack, t.name);
    const parent = stack[stack.length - 1];
    const attrs = new Map();
    for (const a of t.attrs) attrs.set(a.name, a.value);
    const el = {
      type: 'element',
      name: t.name,
      attrs,
      parent,
      children: [],
      offset: t.offset,
      end: t.end,
      index: elements.length,
      foreign: parent.foreign || t.name === 'svg' || t.name === 'math',
      hidden: parent.hidden || attrs.has('hidden'),
      inert: parent.inert || attrs.has('inert'),
      label: parent.name === 'label' ? parent : parent.label,
      table: parent.name === 'table' ? parent : parent.table
    };
    el.ariaHiddenRoot = ariaTrue(el) ? el : parent.ariaHiddenRoot;
    if (el.foreign && parent.foreign && parent.name === 'foreignobject') el.foreign = false;
    const pos = positionOf(starts, t.offset);
    el.line = pos.line;
    el.column = pos.column;
    parent.children.push(el);
    elements.push(el);
    if (t.name === 'html' && !doc.html) doc.html = el;
    const isVoid = !el.foreign && VOID_ELEMENTS.includes(t.name);
    const selfClosed = el.foreign && t.selfClosing;
    if (isVoid || selfClosed) continue;
    if (stack.length > lim.maxNesting) {
      // Past the nesting limit an element is kept but holds nothing: what follows is read as part of its parent.
      doc.flattened += 1;
      continue;
    }
    stack.push(el);
    if (stack.length - 1 > doc.deepest) doc.deepest = stack.length - 1;
  }
  if (truncated) doc.notes.push(`more than ${lim.maxTokens.toLocaleString('en-US')} tags and texts; the rest of the file was not read`);
  if (doc.capped) doc.notes.push(`more than ${lim.maxElements.toLocaleString('en-US')} elements; the rest of the file was not read`);
  if (doc.flattened) doc.notes.push(`elements nested more than ${lim.maxNesting.toLocaleString('en-US')} deep were read as if they were not nested`);
  if (droppedAttributes) doc.notes.push(`${droppedAttributes.toLocaleString('en-US')} attributes past ${lim.maxAttributes} on one tag were not read`);
  doc.ids = new Map();
  for (const el of elements) {
    const id = attr(el, 'id');
    if (id === null || id === '') continue;
    if (!doc.ids.has(id)) doc.ids.set(id, []);
    doc.ids.get(id).push(el);
  }
  doc.labelsFor = new Map();
  for (const el of elements) {
    if (el.name !== 'label') continue;
    const target = attr(el, 'for');
    if (target === null || target === '') continue;
    if (!doc.labelsFor.has(target)) doc.labelsFor.set(target, []);
    doc.labelsFor.get(target).push(el);
  }
  // A page has a doctype or an html start tag; anything else is a fragment of a page, such as an include.
  doc.isPage = doc.doctype || doc.html !== null;
  return doc;
}

// The start tag of an element as written in the file, with runs of white space as one space, cut to max characters.
export function snippetOf(doc, el, max = 120) {
  const raw = doc.text.slice(el.offset, Math.min(el.end, el.offset + max * 4)).replace(/\s+/g, ' ');
  return raw.length > max ? `${raw.slice(0, max - 3)}...` : raw;
}

// The position of an offset in the file.
export const positionIn = (doc, offset) => positionOf(doc.starts, offset);
