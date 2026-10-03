// The names, lists and sentences the checks rest on. Each sentence comes from a page that is saved, with its address on
// the first line, in research/sources, and test/data.test.js compares this file with the saved text. Change a sentence
// here only after saving the new page text and updating docs/rules-and-sources.md. The checks in src/ use these
// constants and never write a quoted sentence of their own.

const WCAG = 'https://www.w3.org/WAI/WCAG22/Understanding/';

export const SOURCES = [
  { id: 'wcag-non-text', file: 'wcag-non-text-content.txt', url: `${WCAG}non-text-content.html`, label: 'Understanding WCAG 2.2, SC 1.1.1 Non-text Content' },
  { id: 'wcag-info', file: 'wcag-info-and-relationships.txt', url: `${WCAG}info-and-relationships.html`, label: 'Understanding WCAG 2.2, SC 1.3.1 Info and Relationships' },
  { id: 'wcag-audio', file: 'wcag-audio-control.txt', url: `${WCAG}audio-control.html`, label: 'Understanding WCAG 2.2, SC 1.4.2 Audio Control' },
  { id: 'wcag-resize', file: 'wcag-resize-text.txt', url: `${WCAG}resize-text.html`, label: 'Understanding WCAG 2.2, SC 1.4.4 Resize Text' },
  { id: 'wcag-focus', file: 'wcag-focus-order.txt', url: `${WCAG}focus-order.html`, label: 'Understanding WCAG 2.2, SC 2.4.3 Focus Order' },
  { id: 'wcag-link', file: 'wcag-link-purpose-in-context.txt', url: `${WCAG}link-purpose-in-context.html`, label: 'Understanding WCAG 2.2, SC 2.4.4 Link Purpose (In Context)' },
  { id: 'wcag-headings', file: 'wcag-headings-and-labels.txt', url: `${WCAG}headings-and-labels.html`, label: 'Understanding WCAG 2.2, SC 2.4.6 Headings and Labels' },
  { id: 'wcag-language', file: 'wcag-language-of-page.txt', url: `${WCAG}language-of-page.html`, label: 'Understanding WCAG 2.2, SC 3.1.1 Language of Page' },
  { id: 'wcag-name', file: 'wcag-name-role-value.txt', url: `${WCAG}name-role-value.html`, label: 'Understanding WCAG 2.2, SC 4.1.2 Name, Role, Value' },
  { id: 'html-alt', file: 'html-img-alt.txt', url: 'https://html.spec.whatwg.org/multipage/images.html#alt', label: 'HTML Living Standard, Requirements for providing text to act as an alternative for images' },
  { id: 'html-title', file: 'html-title-element.txt', url: 'https://html.spec.whatwg.org/multipage/semantics.html#the-title-element', label: 'HTML Living Standard, The title element' },
  { id: 'html-global', file: 'html-global-attributes.txt', url: 'https://html.spec.whatwg.org/multipage/dom.html#global-attributes', label: 'HTML Living Standard, Global attributes (id and title)' },
  { id: 'aria-hidden', file: 'aria-hidden.txt', url: 'https://www.w3.org/TR/wai-aria-1.2/#aria-hidden', label: 'WAI-ARIA 1.2, aria-hidden state' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// Sentences quoted in the findings and the documents. Every text is on its saved page word for word
// (test/data.test.js compares them), and holds no year.
export const FACTS = {
  textAlternative: { source: 'wcag-non-text', section: 'Success Criterion (SC)', text: 'All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below.' },
  controlName: { source: 'wcag-non-text', section: 'Success Criterion (SC)', text: 'If non-text content is a control or accepts user input, then it has a name that describes its purpose.' },
  decorationIgnored: { source: 'wcag-non-text', section: 'Success Criterion (SC)', text: 'If non-text content is pure decoration, is used only for visual formatting, or is not presented to users, then it is implemented in a way that it can be ignored by assistive technology.' },
  altRequired: { source: 'html-alt', section: 'General guidelines', text: 'Except where otherwise specified, the alt attribute must be specified and its value must not be empty; the value must be an appropriate replacement for the image.' },
  altMeaning: { source: 'html-alt', section: 'General guidelines', text: 'The most general rule to consider when writing alternative text is the following: the intent is that replacing every image with the text of its alt attribute does not change the meaning of the page.' },
  altLinkButton: { source: 'html-alt', section: 'A link or button containing nothing but the image', text: 'When an a element that creates a hyperlink, or a button element, has no textual content but contains one or more images, the alt attributes must contain text that together convey the purpose of the link or button.' },
  altDecorative: { source: 'html-alt', section: "A purely decorative image that doesn't add any information", text: 'In these cases, the alt attribute must be present but its value must be the empty string.' },
  altChecker: { source: 'html-alt', section: 'Guidance for conformance checkers', text: 'A conformance checker must report the lack of an alt attribute as an error unless one of the conditions listed below applies:' },
  structure: { source: 'wcag-info', section: 'Success Criterion (SC)', text: 'Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text.' },
  structurePerceivable: { source: 'wcag-info', section: 'Intent', text: 'Having these structures and these relationships programmatically determined or available in text ensures that information important for comprehension will be perceivable to all.' },
  audioControl: { source: 'wcag-audio', section: 'Success Criterion (SC)', text: 'If any audio on a web page plays automatically for more than 3 seconds, either a mechanism is available to pause or stop the audio, or a mechanism is available to control audio volume independently from the overall system volume level.' },
  audioScreenReader: { source: 'wcag-audio', section: 'Intent', text: 'Individuals who use screen reading software can find it hard to hear the speech output if there is other audio playing at the same time.' },
  resizeText: { source: 'wcag-resize', section: 'Success Criterion (SC)', text: 'Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality.' },
  resizeAuthor: { source: 'wcag-resize', section: 'Intent', text: "The author's responsibility is to create web content that does not prevent the user agent from scaling the content effectively." },
  focusOrder: { source: 'wcag-focus', section: 'Success Criterion (SC)', text: 'If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability.' },
  focusDefault: { source: 'wcag-focus', section: 'Intent', text: 'If no scripting or tabindex attributes are used, the navigation order is the order that components appear in the content stream.' },
  linkPurpose: { source: 'wcag-link', section: 'Success Criterion (SC)', text: 'The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general.' },
  linkList: { source: 'wcag-link', section: 'Intent', text: 'Link text that is as meaningful as possible will aid users who want to choose from this list of links.' },
  headingsLabels: { source: 'wcag-headings', section: 'Success Criterion (SC)', text: 'Headings and labels describe topic or purpose.' },
  headingsFind: { source: 'wcag-headings', section: 'Intent', text: 'When headings are clear and descriptive, users can find the information they seek more easily, and they can understand the relationships between different parts of the content more easily.' },
  pageLanguage: { source: 'wcag-language', section: 'Success Criterion (SC)', text: 'The default human language of each web page can be programmatically determined.' },
  pronunciation: { source: 'wcag-language', section: 'Intent', text: 'Screen readers can load the correct pronunciation rules.' },
  nameForAll: { source: 'wcag-name', section: 'Intent', text: 'Success Criterion 4.1.2 Name, Role, Value requires a programmatically determinable name for all user interface components.' },
  nameIntent: { source: 'wcag-name', section: 'Intent', text: 'The intent of this success criterion is to ensure that Assistive Technologies (AT) can gather appropriate information about, activate (or set) and keep up to date on the status of user interface controls in the content.' },
  titleElement: { source: 'html-title', section: 'The title element', text: "The title element represents the document's title or name." },
  titleIdentify: { source: 'html-title', section: 'The title element', text: "Authors should use titles that identify their documents even when they are used out of context, for example in a user's history or bookmarks, or in search results." },
  titleOnce: { source: 'html-title', section: 'The title element', text: 'There must be no more than one title element per document.' },
  idUnique: { source: 'html-global', section: 'Global attributes', text: "When specified on HTML elements, the id attribute value must be unique amongst all the IDs in the element's tree and must contain at least one character." },
  titleAttribute: { source: 'html-global', section: 'The title attribute', text: 'Relying on the title attribute is currently discouraged as many user agents do not expose the attribute in an accessible manner as required by this specification (e.g., requiring a pointing device such as a mouse to cause a tooltip to appear, which excludes keyboard-only users and touch-only users, such as anyone with a modern phone or tablet).' },
  ariaHidden: { source: 'aria-hidden', section: 'aria-hidden state', text: 'Indicates whether the element is exposed to an accessibility API.' },
  ariaHiddenEquivalent: { source: 'aria-hidden', section: 'aria-hidden state', text: 'Authors using aria-hidden to hide visible content from screen readers MUST ensure that identical or equivalent meaning and functionality is exposed to assistive technologies.' },
  ariaHiddenTrue: { source: 'aria-hidden', section: 'aria-hidden state', text: 'The element is hidden from the accessibility API.' }
};

// The page of a quoted sentence.
export const factPage = (key) => source(FACTS[key].source).url;

// Elements that have no end tag and no content (HTML Living Standard, void elements).
export const VOID_ELEMENTS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param', 'keygen', 'frame'];

// Elements whose content is raw text: no tags and no character references inside. Their text is not markup.
export const RAW_TEXT = ['script', 'style', 'xmp', 'iframe', 'noembed', 'noframes'];

// Elements whose content is text with character references but no tags.
export const ESCAPABLE_RAW_TEXT = ['title', 'textarea'];

// Start tags that close an open p element (the parser's "close a p element" step), the tool's subset.
export const CLOSES_P = ['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul', 'li', 'dd', 'dt'];

// Input types that a person types into, where a placeholder can stand in for a name.
export const TEXT_INPUT_TYPES = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];

// Input types that are form fields: everything but the buttons and the hidden input. The image button is an image.
export const NOT_FIELD_INPUT_TYPES = ['hidden', 'button', 'submit', 'reset', 'image'];

// Link texts that say nothing about where the link goes when read alone. The list is the tool's own.
export const VAGUE_LINK_TEXT = ['click here', 'click', 'here', 'read more', 'more', 'learn more', 'more info', 'more information', 'link', 'this', 'this link', 'details', 'go'];

// Folders that hold tools, caches or copies of packages, not the built site. They are not entered; a note names them.
export const SKIP_FOLDERS = ['.git', '.hg', '.svn', 'node_modules', '.cache'];

// The file endings of an HTML file.
export const isHtmlName = (name) => /\.html?$/i.test(name);

// Named character references the tool decodes, with their code points. Any other name is kept as written. HTML defines
// no way for a page to declare entities of its own, so nothing ever expands to more than one character.
export const NAMED_REFERENCES = {
  amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, nbsp: 160, copy: 169, reg: 174, trade: 8482, hellip: 8230,
  mdash: 8212, ndash: 8211, lsquo: 8216, rsquo: 8217, ldquo: 8220, rdquo: 8221, laquo: 171, raquo: 187,
  times: 215, divide: 247, euro: 8364, pound: 163, yen: 165, cent: 162, deg: 176, middot: 183, bull: 8226,
  larr: 8592, rarr: 8594, uarr: 8593, darr: 8595, check: 10003, minus: 8722, plus: 43, num: 35, excl: 33
};

// The named references that browsers also read without the closing semicolon.
export const LEGACY_REFERENCES = ['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg'];
