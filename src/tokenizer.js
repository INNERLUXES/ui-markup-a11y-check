// A tolerant HTML tokenizer. It reads the text of a page in one pass, left to right, and never goes back: start tags
// with their attributes (quoted, single-quoted, unquoted or with no value), end tags, comments, the doctype, text with
// character references, and the raw text of script, style and the like. A broken page does not stop it: a tag or a
// comment that runs to the end of the file is reported in .problems, as a browser would read it. Nothing is fetched and
// no script is run; the text of a script is skipped, never read as markup.

import { ESCAPABLE_RAW_TEXT, LEGACY_REFERENCES, NAMED_REFERENCES, RAW_TEXT } from './data.js';

export const TOKEN_LIMITS = {
  maxTokens: 400000,
  maxAttributes: 256
};

const REPLACEMENT = String.fromCharCode(0xfffd);
const REFERENCE = /&(?:#([0-9]{1,10})|#[xX]([0-9a-fA-F]{1,8})|([A-Za-z][A-Za-z0-9]{1,31}))(;?)/g;

// Code points a reference may not produce: null, surrogates and values past the last code point.
function fromCodePoint(n) {
  if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return REPLACEMENT;
  return String.fromCodePoint(n);
}

// Decodes character references once: &amp;amp; becomes &amp;, never &. A name the tool does not know is kept as
// written. In an attribute value a legacy name without its semicolon is kept when a letter, a digit or = follows, as
// browsers do.
export function decodeReferences(text, inAttribute = false) {
  if (!text.includes('&')) return text;
  return text.replace(REFERENCE, (match, dec, hex, name, semi, offset, all) => {
    if (dec !== undefined) return fromCodePoint(Number(dec));
    if (hex !== undefined) return fromCodePoint(parseInt(hex, 16));
    if (Object.hasOwn(NAMED_REFERENCES, name)) {
      if (semi) return String.fromCharCode(NAMED_REFERENCES[name]);
      if (!LEGACY_REFERENCES.includes(name)) return match;
      if (inAttribute && /[A-Za-z0-9=]/.test(all[offset + match.length] ?? '')) return match;
      return String.fromCharCode(NAMED_REFERENCES[name]);
    }
    // A legacy name followed by more letters (&ampx) still starts with a reference; the rest is text.
    if (!inAttribute) {
      for (const legacy of LEGACY_REFERENCES) {
        if (name.startsWith(legacy) && name.length > legacy.length) return `${String.fromCharCode(NAMED_REFERENCES[legacy])}${name.slice(legacy.length)}${semi}`;
      }
    }
    return match;
  });
}

// The offsets where each line starts. LF, CRLF and a lone CR each end a line.
export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10) starts.push(i + 1);
    else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i += 1;
      starts.push(i + 1);
    }
  }
  return starts;
}

// The line and column (both from 1) of an offset, by a binary search in the line starts.
export function positionOf(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 };
}

const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

// Reads the name and the attributes of a tag that starts at i (at the "<" or "</"). Returns the tag and the offset after
// it, or closed: false when the file ends inside the tag.
function readTag(text, i, isEnd, limits) {
  const n = text.length;
  let j = i + (isEnd ? 2 : 1);
  const nameStart = j;
  while (j < n && !isSpace(text[j]) && text[j] !== '/' && text[j] !== '>') j += 1;
  const name = text.slice(nameStart, j).toLowerCase();
  const attrs = [];
  const names = new Set();
  let selfClosing = false;
  let closed = false;
  let unquoted = false;
  let dropped = 0;
  while (j < n) {
    while (j < n && isSpace(text[j])) j += 1;
    if (j >= n) break;
    const c = text[j];
    if (c === '>') {
      j += 1;
      closed = true;
      break;
    }
    if (c === '/') {
      if (text[j + 1] === '>') {
        selfClosing = true;
        j += 2;
        closed = true;
        break;
      }
      j += 1;
      continue;
    }
    const attrStart = j;
    j += 1;
    while (j < n && !isSpace(text[j]) && text[j] !== '/' && text[j] !== '>' && text[j] !== '=') j += 1;
    const attrName = text.slice(attrStart, j).toLowerCase();
    let k = j;
    while (k < n && isSpace(text[k])) k += 1;
    let value = '';
    if (text[k] === '=') {
      j = k + 1;
      while (j < n && isSpace(text[j])) j += 1;
      const q = text[j];
      if (q === '"' || q === "'") {
        const close = text.indexOf(q, j + 1);
        if (close < 0) {
          value = text.slice(j + 1);
          j = n;
          unquoted = true;
        } else {
          value = text.slice(j + 1, close);
          j = close + 1;
        }
      } else {
        const s = j;
        while (j < n && !isSpace(text[j]) && text[j] !== '>') j += 1;
        value = text.slice(s, j);
      }
    }
    // The first of two attributes with the same name wins, as in a browser.
    if (names.has(attrName)) continue;
    if (attrs.length >= limits.maxAttributes) {
      dropped += 1;
      continue;
    }
    names.add(attrName);
    attrs.push({ name: attrName, value: decodeReferences(value, true) });
  }
  return { name, attrs, selfClosing, closed: closed && !unquoted, end: j, dropped };
}

// Finds where the raw text of an element ends: the offset of its end tag, or the end of the file.
function rawTextEnd(text, from, name) {
  const re = new RegExp(`</${name}(?=[\\t\\n\\f\\r />]|$)`, 'gi');
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? m.index : text.length;
}

// Finds the end tag that closes a template, counting templates nested inside it.
function templateEnd(text, from) {
  const re = /<(\/?)template(?=[\t\n\f\r />]|$)/gi;
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(text)) !== null) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return text.length;
}

// Splits the text into tokens: { type: 'start' | 'end' | 'text' | 'raw' | 'comment' | 'doctype', offset, end, ... }.
// Start tags carry name, attrs and selfClosing; text carries the decoded text. Past maxTokens the rest of the file is not
// read and .truncated says so. .problems lists tags, comments and quotes that the end of the file cut off.
export function tokenize(text, limits = TOKEN_LIMITS) {
  const lim = { ...TOKEN_LIMITS, ...limits };
  const tokens = [];
  const problems = [];
  let truncated = false;
  let dropped = 0;
  const n = text.length;
  let i = 0;
  const push = (token) => {
    if (tokens.length >= lim.maxTokens) {
      truncated = true;
      return false;
    }
    tokens.push(token);
    return true;
  };
  const toClose = (from, what) => {
    const close = text.indexOf('>', from);
    if (close < 0) {
      problems.push({ kind: what, offset: i });
      return n;
    }
    return close + 1;
  };
  while (i < n && !truncated) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      push({ type: 'text', text: decodeReferences(text.slice(i)), offset: i, end: n });
      break;
    }
    if (lt > i && !push({ type: 'text', text: decodeReferences(text.slice(i, lt)), offset: i, end: lt })) break;
    i = lt;
    const next = text[i + 1] ?? '';
    if (next === '!') {
      if (text.startsWith('<!--', i)) {
        let end;
        if (text[i + 4] === '>') end = i + 5;
        else if (text.startsWith('->', i + 4)) end = i + 6;
        else {
          const close = text.indexOf('-->', i + 4);
          if (close < 0) {
            problems.push({ kind: 'comment', offset: i });
            end = n;
          } else end = close + 3;
        }
        push({ type: 'comment', offset: i, end });
        i = end;
      } else if (text.slice(i + 2, i + 9).toLowerCase() === 'doctype') {
        const end = toClose(i + 9, 'doctype');
        push({ type: 'doctype', offset: i, end });
        i = end;
      } else {
        const end = toClose(i + 2, 'tag');
        push({ type: 'comment', offset: i, end });
        i = end;
      }
    } else if (next === '/') {
      if (isLetter(text[i + 2] ?? '')) {
        const tag = readTag(text, i, true, lim);
        if (!tag.closed) {
          problems.push({ kind: 'tag', offset: i, name: tag.name });
          break;
        }
        push({ type: 'end', name: tag.name, offset: i, end: tag.end });
        i = tag.end;
      } else if (text[i + 2] === '>') i += 3;
      else {
        const end = toClose(i + 2, 'tag');
        push({ type: 'comment', offset: i, end });
        i = end;
      }
    } else if (next === '?') {
      const end = toClose(i + 2, 'tag');
      push({ type: 'comment', offset: i, end });
      i = end;
    } else if (isLetter(next)) {
      const tag = readTag(text, i, false, lim);
      if (!tag.closed) {
        problems.push({ kind: 'tag', offset: i, name: tag.name });
        break;
      }
      dropped += tag.dropped;
      if (!push({ type: 'start', name: tag.name, attrs: tag.attrs, selfClosing: tag.selfClosing, offset: i, end: tag.end })) break;
      i = tag.end;
      if (tag.selfClosing && (RAW_TEXT.includes(tag.name) || ESCAPABLE_RAW_TEXT.includes(tag.name))) continue;
      if (tag.name === 'plaintext') {
        push({ type: 'text', text: text.slice(i), offset: i, end: n });
        break;
      }
      if (RAW_TEXT.includes(tag.name)) {
        const end = rawTextEnd(text, i, tag.name);
        if (end > i) push({ type: 'raw', offset: i, end });
        i = end;
      } else if (ESCAPABLE_RAW_TEXT.includes(tag.name)) {
        const end = rawTextEnd(text, i, tag.name);
        if (end > i) push({ type: 'text', text: decodeReferences(text.slice(i, end)), offset: i, end });
        i = end;
      } else if (tag.name === 'template') {
        // The content of a template is not part of the page until a script uses it; it is skipped and counted.
        const end = templateEnd(text, i);
        push({ type: 'raw', template: true, offset: i, end });
        i = end;
      }
    } else {
      if (!push({ type: 'text', text: '<', offset: i, end: i + 1 })) break;
      i += 1;
    }
  }
  return { tokens, problems, truncated, droppedAttributes: dropped };
}
