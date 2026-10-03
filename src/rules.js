// The checks. Each one reads the tree of one page (src/tree.js) and reports an accessibility problem that is visible in
// the markup. docs/method.md gives the reason behind every finding and says what each check can and cannot see.
// Nothing here opens a file, fetches anything or runs a script.

import { FACTS, VAGUE_LINK_TEXT, factPage } from './data.js';
import { attr, hasAttr, snippetOf } from './tree.js';
import { accessibleName, idList, inputType, isFocusable, isFormField, parseTabindex, parseViewport, textOf } from './names.js';
import { grouped, listText, plural } from './size.js';

export const SEVERITIES = ['error', 'warning', 'info'];
export const RANK = { error: 0, warning: 1, info: 2 };

// The areas a report is grouped by, in report order.
export const AREAS = [
  { id: 'page', title: 'Page' },
  { id: 'images', title: 'Images and media' },
  { id: 'names', title: 'Names and labels' },
  { id: 'structure', title: 'Headings and tables' },
  { id: 'ids', title: 'IDs and references' },
  { id: 'focus', title: 'Focus' }
];

// Every finding, in report order within an area. facts are the keys of the sentences of src/data.js that the finding
// quotes; the page of the first one is the finding's source.
export const FINDINGS = [
  { id: 'summary', severity: 'info', area: 'page', what: 'What the tool read in each file: elements, images, controls and the outline of headings', facts: ['structure'] },
  { id: 'html-no-lang', severity: 'error', area: 'page', what: 'A page whose html element has no lang attribute, an empty one, or one that is not a language tag', facts: ['pageLanguage', 'pronunciation'] },
  { id: 'page-no-title', severity: 'error', area: 'page', what: 'A page with no title element, or an empty one', facts: ['titleElement', 'titleIdentify'] },
  { id: 'viewport-blocks-zoom', severity: 'error', area: 'page', what: 'A viewport meta tag with user-scalable=no or a maximum-scale below 2', facts: ['resizeText', 'resizeAuthor'] },
  { id: 'img-no-alt', severity: 'error', area: 'images', what: 'An img with no alt attribute, or an image button (input type="image") with no alt text', facts: ['altRequired', 'textAlternative'] },
  { id: 'autoplay-media', severity: 'warning', area: 'images', what: 'A video or audio element that plays by itself (autoplay) and is not muted', facts: ['audioControl', 'audioScreenReader'] },
  { id: 'control-no-name', severity: 'error', area: 'names', what: 'A button, a link with href, or an input type="button" with no accessible name', facts: ['nameForAll', 'altLinkButton'] },
  { id: 'form-field-no-label', severity: 'error', area: 'names', what: 'An input, select or textarea with no label and no other accessible name', facts: ['nameForAll', 'structure'] },
  { id: 'title-only-name', severity: 'warning', area: 'names', what: 'A control or image whose only name comes from its title attribute, or a text field named only by its placeholder', facts: ['titleAttribute', 'nameForAll'] },
  { id: 'vague-link-text', severity: 'warning', area: 'names', what: 'A link whose text, read alone, does not say where it goes: "click here", "read more", "here", "more"', facts: ['linkPurpose', 'linkList'] },
  { id: 'heading-skip', severity: 'warning', area: 'structure', what: 'A heading more than one level below the heading before it, such as h2 then h4', facts: ['structure', 'headingsFind'] },
  { id: 'no-h1', severity: 'warning', area: 'structure', what: 'A page with no h1 element for its main heading', facts: ['headingsFind', 'structurePerceivable'] },
  { id: 'table-no-headers', severity: 'warning', area: 'structure', what: 'A data table with no th cell and no other header markup', facts: ['structure', 'structurePerceivable'] },
  { id: 'several-h1', severity: 'info', area: 'structure', what: 'A page with more than one h1', facts: ['headingsFind'] },
  { id: 'duplicate-id', severity: 'error', area: 'ids', what: 'An id used by more than one element in the same file', facts: ['idUnique', 'structure'] },
  { id: 'aria-reference-missing', severity: 'error', area: 'ids', what: 'aria-labelledby, aria-describedby, aria-controls or a label for that names an id no element has', facts: ['structure', 'nameForAll'] },
  { id: 'aria-hidden-focusable', severity: 'error', area: 'focus', what: 'An element that takes keyboard focus inside aria-hidden="true", or with it', facts: ['ariaHiddenEquivalent', 'ariaHidden'] },
  { id: 'positive-tabindex', severity: 'warning', area: 'focus', what: 'A tabindex above 0, which moves the element ahead of the order of the page', facts: ['focusOrder', 'focusDefault'] }
];

const BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));
export const ORDER = Object.fromEntries(FINDINGS.map((f, i) => [f.id, i]));
export const BY_ID_SEVERITY = Object.fromEntries(FINDINGS.map((f) => [f.id, f.severity]));
export const AREA_ORDER = Object.fromEntries(AREAS.map((a, i) => [a.id, i]));

// Control characters (C0 and C1), the line and paragraph separators and the Unicode direction controls, built from
// their code points so that this file holds only ASCII.
const span = (a, b) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`;
const UNSAFE_CHARACTERS = new RegExp(`[${span(0, 0x1f)}${span(0x7f, 0x9f)}${[0x200e, 0x200f, 0x2028, 0x2029, 0xfeff].map((c) => String.fromCharCode(c)).join('')}${span(0x202a, 0x202e)}${span(0x2066, 0x2069)}]`, 'g');

// Text from the input: control, line separator and direction characters replaced by a space, length capped.
export function safeText(value, max = 300) {
  const s = String(value).slice(0, max * 4).replace(UNSAFE_CHARACTERS, ' ');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

export function meetsThreshold(severity, failOn) {
  return RANK[severity] <= RANK[failOn];
}

const quoted = (v, max = 80) => `"${safeText(v, max)}"`;
const HEADING = /^h([1-6])$/;
const LANGUAGE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,8}$/;

// A short name for an element in a message: <input type="email">, <button>, <a href>.
function tagName(el) {
  if (el.name === 'input') return `<input type="${safeText(inputType(el), 20)}">`;
  if (el.name === 'a') return '<a href>';
  return `<${safeText(el.name, 30)}>`;
}

const at = (el) => `${el.line}:${el.column}`;

// Builds one finding with its quotations.
function finding(id, fields) {
  const def = BY_ID[id];
  const basis = def.facts.map((k) => ({ text: FACTS[k].text, section: FACTS[k].section, source: factPage(k) }));
  return {
    id,
    severity: def.severity,
    area: def.area,
    file: safeText(fields.file, 400),
    line: fields.line ?? 0,
    column: fields.column ?? 0,
    snippet: safeText(fields.snippet ?? '', 160),
    subject: safeText(fields.subject ?? '', 200),
    message: safeText(fields.message, 1500),
    fix: safeText(fields.fix, 600),
    basis,
    source: basis[0].source
  };
}

// Whether an element is out of reach of a screen reader: the hidden attribute, inert, or aria-hidden="true" on it or
// an ancestor. The name checks leave such elements to aria-hidden-focusable.
const outOfReach = (el) => el.hidden || el.inert || el.ariaHiddenRoot !== null;

// What a control holds when it has no name, for the message; null when it holds an image with no alt attribute, which
// img-no-alt reports already.
function emptyContent(el) {
  const imgs = [];
  const svgs = [];
  const walk = (n, depth) => {
    if (depth > 64) return;
    for (const c of n.children) {
      if (c.type !== 'element') continue;
      if (c.name === 'img') imgs.push(c);
      else if (c.name === 'svg') svgs.push(c);
      else walk(c, depth + 1);
    }
  };
  walk(el, 0);
  if (imgs.some((i) => attr(i, 'alt') === null)) return null;
  if (imgs.length && imgs.every((i) => attr(i, 'alt') === '')) return ' Its only content is an image with alt="", which tells a screen reader to skip the image, so nothing is left to read.';
  if (svgs.length && !imgs.length) return ' Its only content is an svg icon with no title, which gives it no text.';
  return '';
}

// The text of a heading for a message or the outline.
const headingText = (el) => safeText(textOf(el, { maxNodes: 400 }) || '(empty)', 40);

// Runs every check on one parsed page. file is the path shown in the report.
export function checkDocument(doc, file) {
  const findings = [];
  const add = (id, el, fields) => findings.push(finding(id, { file, line: el ? el.line : 1, column: el ? el.column : 1, snippet: el ? snippetOf(doc, el) : '', ...fields }));
  const elements = doc.elements;

  // Page.
  if (doc.isPage) {
    const html = doc.html;
    const lang = html ? attr(html, 'lang') : null;
    const langFix = 'Add the main language of the page to the html start tag, such as <html lang="en"> or <html lang="de-CH">.';
    if (!html) add('html-no-lang', null, { subject: 'html', message: 'The page has a doctype but no html start tag, so nothing sets its language. A screen reader reads the page with the rules of its own default language.', fix: langFix });
    else if (lang === null) add('html-no-lang', html, { subject: 'lang', message: 'The html element has no lang attribute, so the language of the page cannot be determined from the markup. A screen reader reads the page with the rules of its own default language, which may be the wrong one.', fix: langFix });
    else if (lang.trim() === '') add('html-no-lang', html, { subject: 'lang', message: 'The lang attribute of the html element is empty, which says that the language is unknown.', fix: langFix });
    else if (!LANGUAGE_TAG.test(lang.trim())) add('html-no-lang', html, { subject: 'lang', message: `The lang attribute of the html element is ${quoted(lang, 40)}, which is not a language tag such as en, fr or pt-BR, so a screen reader cannot use it.`, fix: 'Write a language tag as BCP 47 does: a language code, then optional parts joined with a hyphen (en, en-GB, zh-Hant).' });

    const titles = elements.filter((e) => e.name === 'title' && !e.foreign);
    const titleFix = 'Add a title element to the head that names the page and the site, such as <title>Create your account - Example Shop</title>.';
    if (!titles.length) add('page-no-title', html, { subject: 'title', message: 'The page has no title element. The title is what a browser tab, a bookmark, the history and a screen reader announce first when the page opens.', fix: titleFix });
    else if (textOf(titles[0]) === '') add('page-no-title', titles[0], { subject: 'title', message: 'The title element of the page is empty, so the tab, the bookmark and a screen reader have no name for the page.', fix: titleFix });
  }
  for (const el of elements) {
    if (el.name !== 'meta' || (attr(el, 'name') ?? '').trim().toLowerCase() !== 'viewport') continue;
    const v = parseViewport(attr(el, 'content'));
    if (!v.blocks) continue;
    add('viewport-blocks-zoom', el, { subject: 'viewport', message: `The viewport meta tag sets ${listText(v.reasons.map((r) => safeText(r, 40)))}, which stops people from zooming the page on a phone to at least twice its size.`, fix: 'Remove user-scalable=no and maximum-scale from the content of the viewport meta tag; content="width=device-width, initial-scale=1" is enough.' });
  }

  // Images and media.
  for (const el of elements) {
    if (el.foreign || outOfReach(el)) continue;
    const isImageButton = el.name === 'input' && inputType(el) === 'image';
    if (el.name !== 'img' && !isImageButton) continue;
    const name = accessibleName(el, doc);
    if (isImageButton) {
      if (name.from === 'title') add('title-only-name', el, { subject: 'title', message: `The image button has no alt text; its only name is its title attribute (${quoted(name.name)}). Many screen readers and touch devices do not read a title.`, fix: 'Give the image button an alt attribute that says what it does, such as alt="Search".' });
      else if (!name.from) add('img-no-alt', el, { subject: 'alt', message: 'The image button (input type="image") has no alt text, so it has no name. A screen reader says only "button", or reads the file name of the image.', fix: 'Give the image button an alt attribute that says what it does, such as alt="Search" or alt="Add to cart".' });
      continue;
    }
    if (hasAttr(el, 'alt')) continue;
    if (name.from === 'aria-label' || name.from === 'aria-labelledby') continue;
    if (name.from === 'title') {
      add('title-only-name', el, { subject: 'title', message: `The image has no alt attribute; its only text is its title attribute (${quoted(name.name)}). Many screen readers and touch devices do not read a title.`, fix: 'Move the text into an alt attribute, or write alt="" when the image adds nothing to the text around it.' });
      continue;
    }
    const role = (attr(el, 'role') ?? '').trim().toLowerCase();
    const src = safeText((attr(el, 'src') ?? '').split(/[?#]/)[0].split('/').at(-1) ?? '', 60);
    add('img-no-alt', el, { subject: 'alt', message: role === 'presentation' || role === 'none' ? `The image has role="${role}" but no alt attribute. HTML still requires alt; with alt="" every browser and screen reader skips the image the same way.` : `The image${src ? ` ${quoted(src)}` : ''} has no alt attribute. A screen reader then reads the file name or says only "image", and a person who cannot see it gets nothing in its place. alt="" is right for an image that is only decoration.`, fix: 'Add an alt attribute: the text that would replace the image if it could not be shown (alt="Red trail running shoe, side view"), or alt="" if the image adds nothing to the text around it.' });
  }
  for (const el of elements) {
    if ((el.name !== 'video' && el.name !== 'audio') || !hasAttr(el, 'autoplay') || hasAttr(el, 'muted')) continue;
    add('autoplay-media', el, { subject: 'autoplay', message: `The ${el.name} element plays by itself when the page opens (autoplay) and is not muted. If it has sound that lasts more than 3 seconds, it talks over a screen reader, and the person has to find the control to stop it while it plays.${hasAttr(el, 'controls') ? '' : ' It has no controls attribute, so the markup gives no way to pause it.'}`, fix: `Remove autoplay and let the person start the ${el.name}; or add muted (and playsinline for a video) when it plays with no sound; and keep the controls attribute so it can be paused.` });
  }

  // Names and labels.
  for (const el of elements) {
    if (el.foreign || outOfReach(el)) continue;
    const isLink = el.name === 'a' && hasAttr(el, 'href');
    const isButton = el.name === 'button' || (el.name === 'input' && inputType(el) === 'button');
    const isField = isFormField(el);
    if (!isLink && !isButton && !isField) continue;
    const name = accessibleName(el, doc);
    const kind = isLink ? 'link' : isButton ? 'button' : 'form field';
    if (name.from === 'title' || name.from === 'placeholder') {
      const which = name.from === 'title' ? 'title attribute' : 'placeholder';
      add('title-only-name', el, { subject: name.from, message: `The only name of this ${kind} (${tagName(el)}) comes from its ${which} (${quoted(name.name)}). ${name.from === 'title' ? 'Many screen readers, keyboards and touch devices never show or read a title.' : 'A placeholder disappears as soon as the person types, and not every screen reader reads it.'}`, fix: isField ? 'Add a visible label element with for set to the id of the field, and keep the placeholder only as an example of the input.' : `Put the name in the ${kind} itself: visible text, or an aria-label when the ${kind} shows only an icon.` });
      continue;
    }
    if (name.from) {
      if (isLink && name.from === 'content') {
        const norm = name.name.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').replace(/\s+/g, ' ');
        if (VAGUE_LINK_TEXT.includes(norm)) add('vague-link-text', el, { subject: 'link text', message: `The text of the link is ${quoted(name.name)}. A screen reader can list all the links of a page, and in that list ${quoted(name.name)} says nothing about where the link goes. The sentence around it may give the context, but the link text alone does not.`, fix: 'Write link text that names the destination, such as "Read more about the trail shoe" or "Size guide", or add an aria-label that does.' });
      }
      continue;
    }
    if (isField) {
      const id = attr(el, 'id');
      const what = el.name === 'input' ? `field (${tagName(el)}${id ? `, id ${quoted(id, 40)}` : ''})` : `${el.name}${id ? ` (id ${quoted(id, 40)})` : ''}`;
      add('form-field-no-label', el, { subject: 'label', message: `The ${what} has no label: no label element names it with for or wraps it, and it has no aria-label or aria-labelledby. A screen reader announces only the kind of field, such as "edit text" or "combo box", so the person does not know what to enter.`, fix: id ? `Add a label element with for=${quoted(id, 40)} and visible text, such as <label for=${quoted(id, 40)}>${safeText(id.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), 40)}</label>.` : 'Give the field an id and add a label element with that for and visible text, or wrap the field in its label.' });
    } else {
      const has = emptyContent(el);
      if (has === null) continue;
      add('control-no-name', el, { subject: 'name', message: `The ${kind} (${tagName(el)}) has no accessible name: no text inside it, no aria-label, and no aria-labelledby that points at text.${has} A screen reader says only "${kind}"${isLink ? ' or reads the address' : ''}.`, fix: has.includes('image') ? `Give the image alt text that says what the ${kind} does (alt="Home"), or add an aria-label to the ${kind}.` : `Add visible text to the ${kind}, or an aria-label that says what it does when it shows only an icon (aria-label="Add to cart").` });
    }
  }

  // Headings and tables.
  const headings = elements.filter((e) => HEADING.test(e.name) && !e.foreign && !outOfReach(e));
  let prev = null;
  for (const h of headings) {
    const level = Number(h.name[1]);
    if (prev && level > Number(prev.name[1]) + 1) {
      add('heading-skip', h, { subject: h.name, message: `The ${h.name} ${quoted(headingText(h))} comes after the ${prev.name} ${quoted(headingText(prev))} at line ${prev.line}, so level ${listText(Array.from({ length: level - Number(prev.name[1]) - 1 }, (_, k) => String(Number(prev.name[1]) + k + 1)))} is skipped. A screen reader user who moves from heading to heading takes the gap for a missing section.`, fix: `Use ${prev.name.replace(/\d/, String(Number(prev.name[1]) + 1))} here, or change the level of the heading before it; set the size of a heading with CSS, not with its level.` });
    }
    prev = h;
  }
  const h1s = headings.filter((h) => h.name === 'h1');
  if (doc.isPage && !h1s.length) {
    const anchor = elements.find((e) => e.name === 'body') ?? doc.html;
    add('no-h1', anchor, { subject: 'h1', message: headings.length ? `The page has no h1; its first heading is the ${headings[0].name} ${quoted(headingText(headings[0]))} at line ${headings[0].line}. Screen reader users jump to the h1 to find the main content and to learn what the page is about.` : 'The page has no headings at all, so a screen reader user cannot jump through its parts or find where the main content starts.', fix: 'Mark the main heading of the page as h1, once, at the start of the main content.' });
  }
  if (h1s.length > 1) {
    add('several-h1', h1s[1], { subject: 'h1', message: `The page has ${plural(h1s.length, 'h1')}: ${listText(h1s.map((h) => `${quoted(headingText(h))} (line ${h.line})`), 4)}. HTML allows it, but most pages read best with one h1 for the main heading.`, fix: 'Keep one h1 for the main heading of the page and make the others h2, unless each one starts a separate part of equal weight.' });
  }
  const byTable = new Map();
  for (const e of elements) {
    if (!e.table) continue;
    if (!byTable.has(e.table)) byTable.set(e.table, []);
    byTable.get(e.table).push(e);
  }
  for (const table of elements) {
    if (table.name !== 'table' || table.foreign || outOfReach(table)) continue;
    const role = (attr(table, 'role') ?? '').trim().toLowerCase();
    if (role === 'presentation' || role === 'none') continue;
    const own = byTable.get(table) ?? [];
    const cells = own.filter((e) => e.name === 'td' || e.name === 'th');
    const rows = own.filter((e) => e.name === 'tr');
    const headerish = cells.some((c) => c.name === 'th' || hasAttr(c, 'headers') || ['columnheader', 'rowheader'].includes((attr(c, 'role') ?? '').trim().toLowerCase()));
    if (headerish) continue;
    const perRow = new Map();
    for (const c of cells) perRow.set(c.parent, (perRow.get(c.parent) ?? 0) + 1);
    const widest = Math.max(0, ...perRow.values());
    const looksData = (rows.length >= 2 && widest >= 2) || own.some((e) => e.name === 'caption' || e.name === 'thead');
    if (!looksData) continue;
    add('table-no-headers', table, { subject: 'th', message: `The table has ${plural(rows.length, 'row')} of up to ${plural(widest, 'cell')} and no th cell. A screen reader reads each cell without the column or row it belongs to, so "42" or "In stock" lose their meaning.`, fix: 'Mark the header row or column with th (with scope="col" or scope="row" when it helps). If the table only lays out the page, use CSS instead, or add role="presentation".' });
  }

  // IDs and references.
  const referencedIds = new Set(doc.labelsFor.keys());
  for (const e of elements) for (const a of ['aria-labelledby', 'aria-describedby', 'aria-controls']) for (const id of idList(attr(e, a))) referencedIds.add(id);
  for (const [id, els] of doc.ids) {
    if (els.length < 2) continue;
    const referenced = referencedIds.has(id);
    add('duplicate-id', els[1], { subject: id, message: `The id ${quoted(id, 60)} is used by ${plural(els.length, 'element')} in this file: ${listText(els.map((e) => `${tagName(e)} at ${at(e)}`), 4)}.${referenced ? ' A label or an aria attribute points at this id, and it reaches only the first of them.' : ' Labels, aria attributes and links that point at this id reach only the first of them.'}`, fix: 'Give every element its own id, and update the for, aria-labelledby, aria-describedby or href that should point at the second one.' });
  }
  for (const el of elements) {
    const refs = [];
    for (const a of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
      const missing = idList(attr(el, a)).filter((id) => !doc.ids.has(id));
      if (missing.length) refs.push({ a, missing });
    }
    if (el.name === 'label') {
      const target = attr(el, 'for');
      if (target !== null && target !== '' && !doc.ids.has(target)) refs.push({ a: 'for', missing: [target] });
    }
    for (const r of refs) {
      add('aria-reference-missing', el, { subject: r.a, message: `${r.a} on this ${tagName(el)} names ${listText(r.missing.map((m) => `the id ${quoted(m, 60)}`), 3)}, which no element in the file has. The ${r.a === 'for' ? 'label is tied to no field' : r.a === 'aria-controls' ? 'relationship is lost' : `${r.a === 'aria-labelledby' ? 'name' : 'description'} it should give is not there`}.`, fix: `Point ${r.a} at the id of the element that is really there (ids are case-sensitive), or add the id to that element.` });
    }
  }

  // Focus.
  for (const el of elements) {
    if (!el.ariaHiddenRoot || !isFocusable(el)) continue;
    const rootEl = el.ariaHiddenRoot;
    add('aria-hidden-focusable', el, { subject: 'aria-hidden', message: `This ${tagName(el)} takes keyboard focus, but ${rootEl === el ? 'it has' : `it is inside ${tagName(rootEl)} at ${at(rootEl)}, which has`} aria-hidden="true". A keyboard user can tab to it while a screen reader says nothing about it, or reads something unrelated.`, fix: 'Remove aria-hidden from content that people can reach, or take the element out of the tab order with tabindex="-1" (or the inert attribute on the hidden part) while it is hidden.' });
  }
  for (const el of elements) {
    const tab = parseTabindex(attr(el, 'tabindex'));
    if (tab === null || tab <= 0) continue;
    add('positive-tabindex', el, { subject: 'tabindex', message: `tabindex=${quoted(attr(el, 'tabindex'), 20)} puts this ${tagName(el)} ahead of every element with tabindex 0 or none, so the Tab key jumps here first and then back, out of the order in which the page is read.`, fix: 'Use tabindex="0" (or no tabindex on a link, button or field) and put the element where it belongs in the source order.' });
  }

  // The summary of the file.
  const imgs = elements.filter((e) => e.name === 'img' || (e.name === 'input' && inputType(e) === 'image'));
  const withAlt = imgs.filter((e) => (attr(e, 'alt') ?? '').trim() !== '').length;
  const decorative = imgs.filter((e) => attr(e, 'alt') !== null && attr(e, 'alt').trim() === '').length;
  const buttons = elements.filter((e) => e.name === 'button' || (e.name === 'input' && ['button', 'submit', 'reset'].includes(inputType(e)))).length;
  const links = elements.filter((e) => e.name === 'a' && hasAttr(e, 'href')).length;
  const fields = elements.filter(isFormField).length;
  const outline = headings.map((h) => `${h.name} ${headingText(h)}`);
  const what = doc.isPage ? 'Page' : 'Fragment (no doctype and no html start tag, so the page checks did not run)';
  add('summary', null, {
    line: 0,
    column: 0,
    subject: 'summary',
    message: `${what} with ${plural(elements.length, 'element')}: ${plural(imgs.length, 'image')} (${grouped(withAlt)} with alt text, ${grouped(decorative)} with alt="", ${grouped(imgs.length - withAlt - decorative)} with no alt), ${plural(buttons + links + fields, 'control')} (${plural(buttons, 'button')}, ${plural(links, 'link')}, ${plural(fields, 'form field')}), ${plural(headings.length, 'heading')}${outline.length ? `: ${listText(outline, 8)}` : ''}.`,
    fix: 'Nothing to fix; this is what the tool read. A clean report means none of the checks found anything in the markup, not that the page is accessible.'
  });
  return { findings, counts: { elements: elements.length, images: imgs.length, controls: buttons + links + fields, headings: headings.length } };
}
