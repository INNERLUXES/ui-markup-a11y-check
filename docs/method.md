# Method

The tool reads built HTML pages as text, builds a light tree of each one, and runs the checks below. Every check says what it reports, why it has the severity it has, what it can see and what it cannot, and the sentence of a saved page that it rests on. The pages are saved in [research/sources](../research/sources), and a test compares every quoted sentence with the saved text. Where the tool makes a choice that the pages do not state (a severity, a list of link texts, a rule for what counts as a data table), the text says so.

The question behind most checks is the one of WCAG 1.3.1: "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." A sighted person sees that a word sits next to a field, that a line is a heading, that a cell is under a column. A screen reader only knows what the markup says. Each check looks for one place where the markup does not say it. Nothing is run: not a script, not a browser, and nothing named in a page is fetched.

## What is read

[inputs.md](inputs.md) lists the inputs and the limits. In short: each HTML file is read as UTF-8 text, split into tokens by the tool's own tokenizer, and built into a tree of elements with their attributes, their parents, their text and the line and column where each start tag begins. A file with a doctype or an html start tag is a page; any other file is a fragment (an include, a partial), and the checks that need a whole page (`html-no-lang`, `page-no-title`, `no-h1`) do not run on it. A note names the fragments.

Some checks need the accessible name of an element, the name a screen reader announces. The tool computes it from the markup in the order the accessible name computation uses for HTML: `aria-labelledby` (the text of the elements it names, even hidden ones), `aria-label`, the native name (a label element for a form field, `alt` for an image or an image button, `value` for an input button, the default name of a submit or reset button), the text inside for buttons and links (with the `alt` of images and the `aria-label` of elements inside, and without content marked `hidden` or with `aria-hidden` set to `true`), then `title`, and for a text field `placeholder`. CSS is not read, so text that CSS hides or adds is not seen.

Elements that a screen reader does not reach are left out of the name and image checks: content with the `hidden` attribute, content under `inert`, content inside an element with `aria-hidden` set to `true`, and the content of a `template`. Focusable content inside an element with `aria-hidden` set to `true` has a check of its own.

## Page

### `summary` (info)

What the tool read in each file: page or fragment, the number of elements, the images (with alt text, with an empty alt, with no alt), the controls (buttons, links, form fields) and the outline of the headings with their text. It is always there, one per file, so a report says what it rests on, and it never fails a run.

### `html-no-lang` (error)

The html element has no `lang` attribute, an empty one, or one that does not have the shape of a language tag (letters, then parts joined with a hyphen, such as `en`, `en-GB` or `zh-Hant`); or the page has a doctype but no html start tag at all. WCAG 3.1.1: "The default human language of each web page can be programmatically determined." The Understanding page gives the reason: "Screen readers can load the correct pronunciation rules." It is an error because a level A criterion fails and the fix is one attribute. The tool checks the shape of the tag, not whether the language is registered or right for the text; `xml:lang` alone does not count in an HTML page.

### `page-no-title` (error)

The page has no title element, or the first one holds no text. A title inside an svg or math element does not count. The HTML Living Standard: "The title element represents the document's title or name." and "Authors should use titles that identify their documents even when they are used out of context, for example in a user's history or bookmarks, or in search results." It is an error: the title is the first thing a screen reader announces and the only name a tab or a bookmark has. The tool does not judge whether the title describes the page.

### `viewport-blocks-zoom` (error)

A viewport `meta` tag whose content sets `user-scalable=no` (or a number between -1 and 1, such as `0`), or a `maximum-scale` below 2. The content is read as browsers read it: settings split on commas or semicolons, names and values in any case, spaces allowed. WCAG 1.4.4: "Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality." and "The author's responsibility is to create web content that does not prevent the user agent from scaling the content effectively." A maximum-scale of 2 or more and `user-scalable=yes` pass. Some mobile browsers now ignore these settings; the tool reports them anyway, because others still obey them and the markup asks for it.

## Images and media

### `img-no-alt` (error)

An `img` with no `alt` attribute, unless `aria-label` or `aria-labelledby` gives it a name; and an image button (an `input` of type `image`) with no alt text and no other name. An empty `alt` passes: it marks an image as decoration. The HTML Living Standard: "Except where otherwise specified, the alt attribute must be specified and its value must not be empty; the value must be an appropriate replacement for the image." and, for decoration, "In these cases, the alt attribute must be present but its value must be the empty string." WCAG 1.1.1: "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below." The standard also says that "A conformance checker must report the lack of an alt attribute as an error unless one of the conditions listed below applies:", and one of those conditions is a non-empty `title`; the tool reports such an image as `title-only-name` instead, because a title is not read reliably. An image with the role presentation and no alt is still reported, because the standard requires the attribute and an empty `alt` does the same job in every browser. The tool does not judge whether the alt text is good, and does not see images drawn by CSS.

### `autoplay-media` (warning)

A `video` or `audio` element with `autoplay` and without `muted`. WCAG 1.4.2: "If any audio on a web page plays automatically for more than 3 seconds, either a mechanism is available to pause or stop the audio, or a mechanism is available to control audio volume independently from the overall system volume level." and "Individuals who use screen reading software can find it hard to hear the speech output if there is other audio playing at the same time." It is a warning, not an error, because the markup does not show whether the file has sound or how long it lasts; the message says when the element also has no `controls` attribute. A player started by a script is not seen.

## Names and labels

### `control-no-name` (error)

A `button`, a link (`a` with `href`) or an `input` of type `button` with no accessible name. WCAG: "Success Criterion 4.1.2 Name, Role, Value requires a programmatically determinable name for all user interface components." For a link or a button that holds only an image, the HTML Living Standard adds: "When an a element that creates a hyperlink, or a button element, has no textual content but contains one or more images, the alt attributes must contain text that together convey the purpose of the link or button." The message says when the only content is an image with an empty `alt` or an svg with no title. A control that holds an image with no alt attribute at all is left to `img-no-alt`, so the same fix is not reported twice. Submit and reset inputs have a name given by the browser and pass. An `a` without `href` is not a link and is not checked. Elements made into controls with a `role` (a `div` with the role button) are not checked.

### `form-field-no-label` (error)

An `input` that takes a value (every type but hidden, button, submit, reset and image), a `select` or a `textarea` with no accessible name: no label element whose `for` names its id, no label around it (with no `for` of its own), no `aria-label` and no `aria-labelledby` that points at text. It is the form field form of the check above, with an id of its own so that a pipeline can count the two apart, and the two never report the same element. WCAG 1.3.1 and the sentence on 4.1.2 above are its basis: the relation between a visible label and its field must be in the markup. A label's `for` reaches the first element with that id, as in a browser.

### `title-only-name` (warning)

A control, a form field or an image whose only name comes from its `title` attribute, or a text field (text, email, password, search, tel, url, number or textarea) whose only name comes from its `placeholder`. The HTML Living Standard: "Relying on the title attribute is currently discouraged as many user agents do not expose the attribute in an accessible manner as required by this specification (e.g., requiring a pointing device such as a mouse to cause a tooltip to appear, which excludes keyboard-only users and touch-only users, such as anyone with a modern phone or tablet)." A placeholder is the same kind of last resort: it disappears when the person types. It is a warning, not an error, because the element does have a name in the computation; it is a weak one.

### `vague-link-text` (warning)

A link whose name comes from its own text, with no `aria-label` or `aria-labelledby`, and whose text, in lower case without punctuation at its ends, is one of: click here, click, here, read more, more, learn more, more info, more information, link, this, this link, details, go. The list is the tool's own. WCAG 2.4.4: "The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general." and "Link text that is as meaningful as possible will aid users who want to choose from this list of links." It is a warning because WCAG accepts context from the sentence, paragraph or table cell around the link, which the tool does not judge; the message says so.

## Headings and tables

### `heading-skip` (warning)

A heading (h1 to h6) whose level is more than one below the heading before it in the page, such as an h4 after an h2. Going back up any number of levels is fine. WCAG 1.3.1, and WCAG 2.4.6: "When headings are clear and descriptive, users can find the information they seek more easily, and they can understand the relationships between different parts of the content more easily." The first heading of a page is not compared with anything. Headings made with `role="heading"` and `aria-level` are not seen. It is a warning: WCAG does not forbid a skip outright, but a skipped level reads as a missing section.

### `no-h1` (warning)

A page with no h1 that a screen reader reaches. The message names the first heading, or says the page has no headings at all. The sentence of 2.4.6 above, and from 1.3.1: "Having these structures and these relationships programmatically determined or available in text ensures that information important for comprehension will be perceivable to all." It is a warning and the rule is the tool's own: WCAG asks for structure, not for an h1 by name, but the h1 is where screen reader users look for the main heading.

### `table-no-headers` (warning)

A data table with no header markup: no `th` cell, no cell with `headers`, and no cell with the role columnheader or rowheader. A table counts as a data table when it has at least two rows and a row with at least two cells, or a caption or a thead; a table with the role presentation or none is a layout table and is left alone. Cells of a table nested inside a cell belong to the inner table. These rules are the tool's own. The basis is WCAG 1.3.1 and its intent, quoted above. It is a warning because the tool cannot be sure that a table holds data.

### `several-h1` (info)

A page with more than one h1 that a screen reader reaches. HTML allows it, so it is info and never fails a run; the message lists them, because most pages read best with one main heading. The basis is the sentence of 2.4.6 above.

## IDs and references

### `duplicate-id` (error)

An id that more than one element of the same file uses (ids inside a template do not count). One finding per id, at the second element, lists every element that uses it and says whether a label or an aria attribute points at it. The HTML Living Standard: "When specified on HTML elements, the id attribute value must be unique amongst all the IDs in the element's tree and must contain at least one character." It is an error because labels and aria references reach only the first element, so the relation that WCAG 1.3.1 asks for is lost for the others. Ids are compared as written: they are case-sensitive.

### `aria-reference-missing` (error)

An `aria-labelledby`, `aria-describedby` or `aria-controls` that names an id no element in the file has, or a label whose `for` names such an id. One finding per element and attribute lists the missing ids. The basis is WCAG 1.3.1 and the sentence of 4.1.2 above: a name or a description that points at nothing is not there. Other id references (`aria-owns`, `aria-activedescendant`, `headers`, `list`) are not checked. An id added later by a script, or one in another file, looks missing.

## Focus

### `aria-hidden-focusable` (error)

An element that takes keyboard focus and has `aria-hidden` set to `true`, itself or on an ancestor. An element takes focus when it is a link or area with `href`, a button, a form field that is not hidden or disabled, an iframe, the summary of a details element, a video or audio with `controls`, editable content, or anything with a tabindex of 0 or more; a negative tabindex, `disabled`, `hidden` and `inert` take it out. WAI-ARIA 1.2 defines aria-hidden: "Indicates whether the element is exposed to an accessibility API." and requires: "Authors using aria-hidden to hide visible content from screen readers MUST ensure that identical or equivalent meaning and functionality is exposed to assistive technologies." A keyboard user can reach the element while a screen reader user is told nothing about it, so it is an error. CSS that hides the element (`display: none`) is not seen, and such an element does not really take focus; the message says what the markup shows.

### `positive-tabindex` (warning)

A tabindex above 0, read as HTML reads an integer. WCAG 2.4.3: "If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability." and "If no scripting or tabindex attributes are used, the navigation order is the order that components appear in the content stream." A positive value moves the element ahead of every other one, so the order no longer follows the page. It is a warning because a page can still keep a sensible order with care; the tool cannot see the visual layout to judge it.
