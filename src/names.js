// What the markup says about names and focus: the accessible name of a control as far as the markup shows it, whether
// an element takes focus from the keyboard, the value of tabindex, and the settings of a viewport meta tag. The name
// follows the order of the accessible name computation for HTML: aria-labelledby, aria-label, the native label (a label
// element, alt or value), the text inside for buttons and links, then title and placeholder as a last resort. It is
// computed from the markup alone, so CSS that hides or adds text is not seen (docs/limits.md).

import { NOT_FIELD_INPUT_TYPES, TEXT_INPUT_TYPES } from './data.js';
import { attr, hasAttr } from './tree.js';

export const NAME_LIMITS = { maxNodesPerName: 5000 };

const clean = (s) => s.replace(/\s+/g, ' ').trim();

// The type of an input, lower case, text when absent or unknown.
export function inputType(el) {
  const t = (attr(el, 'type') ?? '').trim().toLowerCase();
  return t === '' ? 'text' : t;
}

// A form field: an input that takes a value from the person, a select or a textarea.
export function isFormField(el) {
  if (el.name === 'select' || el.name === 'textarea') return true;
  return el.name === 'input' && !NOT_FIELD_INPUT_TYPES.includes(inputType(el));
}

const isEmbeddedControl = (el) => el.name === 'input' || el.name === 'select' || el.name === 'textarea';

// The text of a node and what is inside it, as a name from content reads it: text, the alt of images, the aria-label of
// an element inside, the title of an svg. Elements with the hidden attribute or aria-hidden="true" are left out, unless
// includeHidden is set (content named by aria-labelledby counts even when it is hidden). Stops after a fixed number of
// nodes, so one name can never cost more than that.
export function textOf(node, options = {}) {
  const budget = { left: options.maxNodes ?? NAME_LIMITS.maxNodesPerName };
  const parts = [];
  const visit = (n, top) => {
    if (budget.left <= 0) return;
    budget.left -= 1;
    if (n.type === 'text') {
      parts.push(n.text);
      return;
    }
    if (!top && !options.includeHidden && (hasAttr(n, 'hidden') || (attr(n, 'aria-hidden') ?? '').trim().toLowerCase() === 'true')) return;
    if (!top) {
      const label = (attr(n, 'aria-label') ?? '').trim();
      if (label) {
        parts.push(` ${label} `);
        return;
      }
    }
    if (n.name === 'img' || (n.name === 'input' && inputType(n) === 'image') || n.name === 'area') {
      parts.push(` ${attr(n, 'alt') ?? ''} `);
      return;
    }
    if (options.skipControls && !top && isEmbeddedControl(n)) return;
    if (n.name === 'svg' && !top) {
      const title = n.children.find((c) => c.type === 'element' && c.name === 'title');
      parts.push(` ${title ? textOf(title, { maxNodes: 50 }) : ''} `);
      return;
    }
    for (const c of n.children) {
      if (c.type === 'element') parts.push(' ');
      visit(c, false);
      if (c.type === 'element') parts.push(' ');
    }
  };
  visit(node, true);
  return clean(parts.join(''));
}

// The ids of an attribute that holds a list of ids.
export const idList = (value) => (value ?? '').split(/[\t\n\f\r ]+/).filter(Boolean);

// The labels of a labelable element: label elements whose for names its id, and the label around it when that label
// has no for of its own.
export function labelsOf(el, doc) {
  const out = [];
  const id = attr(el, 'id');
  // A label's for names the first element with that id, as in a browser.
  if (id && doc.ids.get(id)?.[0] === el) for (const l of doc.labelsFor.get(id) ?? []) out.push(l);
  if (el.label && (attr(el.label, 'for') === null || attr(el.label, 'for') === id) && !out.includes(el.label)) out.push(el.label);
  return out;
}

// The accessible name of an element as far as the markup shows it: { name, from }. from is aria-labelledby,
// aria-label, label, alt, value, default, content, title, placeholder, or null when there is no name.
export function accessibleName(el, doc) {
  const refs = idList(attr(el, 'aria-labelledby')).map((id) => doc.ids.get(id)?.[0]).filter(Boolean);
  if (refs.length) {
    const name = clean(refs.map((r) => textOf(r, { includeHidden: true })).join(' '));
    if (name) return { name, from: 'aria-labelledby' };
  }
  const label = clean(attr(el, 'aria-label') ?? '');
  if (label) return { name: label, from: 'aria-label' };
  const type = el.name === 'input' ? inputType(el) : null;
  if (type === 'image') {
    const alt = clean(attr(el, 'alt') ?? '');
    if (alt) return { name: alt, from: 'alt' };
  } else if (type === 'button' || type === 'submit' || type === 'reset') {
    const value = clean(attr(el, 'value') ?? '');
    if (value) return { name: value, from: 'value' };
    if (type !== 'button') return { name: type === 'submit' ? 'Submit' : 'Reset', from: 'default' };
  } else if (isFormField(el)) {
    const name = clean(labelsOf(el, doc).map((l) => textOf(l, { skipControls: true })).join(' '));
    if (name) return { name, from: 'label' };
  } else if (el.name === 'img') {
    const alt = clean(attr(el, 'alt') ?? '');
    if (alt) return { name: alt, from: 'alt' };
  } else if (el.name === 'button' || el.name === 'a') {
    const name = textOf(el);
    if (name) return { name, from: 'content' };
  }
  const title = clean(attr(el, 'title') ?? '');
  if (title) return { name: title, from: 'title' };
  if ((el.name === 'textarea' || (el.name === 'input' && TEXT_INPUT_TYPES.includes(type))) && clean(attr(el, 'placeholder') ?? '')) {
    return { name: clean(attr(el, 'placeholder')), from: 'placeholder' };
  }
  return { name: '', from: null };
}

// tabindex read as HTML reads an integer: optional white space, an optional sign and digits. null when it is not one.
export function parseTabindex(value) {
  if (value === null || value === undefined) return null;
  const m = /^[\t\n\f\r ]*([+-]?[0-9]{1,10})/.exec(value);
  return m ? Number(m[1]) : null;
}

const DISABLEABLE = new Set(['button', 'input', 'select', 'textarea', 'optgroup', 'option', 'fieldset']);

// Whether the element takes focus from the keyboard (the Tab key), as far as the markup shows: links and area with
// href, buttons, form fields that are not hidden or disabled, iframes, summary, media with controls, editable content,
// and anything with a tabindex of 0 or more. A negative tabindex takes the element out of the order.
export function isFocusable(el) {
  if (el.hidden || el.inert) return false;
  if (DISABLEABLE.has(el.name) && hasAttr(el, 'disabled')) return false;
  const tab = parseTabindex(attr(el, 'tabindex'));
  if (tab !== null) return tab >= 0;
  switch (el.name) {
    case 'a':
    case 'area':
      return hasAttr(el, 'href');
    case 'button':
    case 'select':
    case 'textarea':
    case 'iframe':
      return true;
    case 'input':
      return inputType(el) !== 'hidden';
    case 'summary':
      return el.parent?.name === 'details';
    case 'audio':
    case 'video':
      return hasAttr(el, 'controls');
    default: {
      const editable = attr(el, 'contenteditable');
      return editable !== null && ['', 'true', 'plaintext-only'].includes(editable.trim().toLowerCase());
    }
  }
}

// The settings of a viewport meta tag that stop zoom: { userScalable, maximumScale, blocks }. user-scalable=no (or a
// number between -1 and 1) turns zoom off; a maximum-scale below 2 stops it short of the 200 percent of WCAG.
export function parseViewport(content) {
  const settings = new Map();
  for (const part of String(content ?? '').split(/[,;]/)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (key && !settings.has(key)) settings.set(key, part.slice(eq + 1).trim().toLowerCase());
  }
  const reasons = [];
  const us = settings.get('user-scalable');
  if (us !== undefined) {
    const num = /^[+-]?[0-9]{1,6}(?:\.[0-9]{1,6})?$/.test(us) ? Number(us) : null;
    if (us === 'no' || (num !== null && num > -1 && num < 1)) reasons.push(`user-scalable=${us}`);
  }
  const ms = settings.get('maximum-scale');
  if (ms !== undefined && /^[+-]?[0-9]{0,6}(?:\.[0-9]{1,6})?$/.test(ms) && ms !== '' && Number(ms) < 2) reasons.push(`maximum-scale=${ms}`);
  return { userScalable: us ?? null, maximumScale: ms ?? null, reasons, blocks: reasons.length > 0 };
}
