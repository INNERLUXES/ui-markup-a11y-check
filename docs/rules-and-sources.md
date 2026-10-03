# Rules and sources

Every sentence that the tool quotes comes from a page that is saved in [research/sources](../research/sources), with its address on the first line. `src/data.js` holds them, and `test/data.test.js` compares each one with the saved text. Nothing was added from memory. Change a sentence only after saving the new page text and updating this file.

## The saved pages

| File | Address | What it is used for |
| --- | --- | --- |
| `wcag-non-text-content.txt` | https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html | text alternatives for images, and names for controls that are images |
| `wcag-info-and-relationships.txt` | https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html | structure and relationships that the markup must carry: headings, labels, tables, references |
| `wcag-audio-control.txt` | https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html | audio that plays by itself and a way to stop it |
| `wcag-resize-text.txt` | https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html | text that can be zoomed to 200 percent |
| `wcag-focus-order.txt` | https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html | the order in which the Tab key moves through a page, and tabindex |
| `wcag-link-purpose-in-context.txt` | https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html | the purpose of a link from its text |
| `wcag-headings-and-labels.txt` | https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html | headings and labels that describe topic or purpose |
| `wcag-language-of-page.txt` | https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html | the language of the page in the markup |
| `wcag-name-role-value.txt` | https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html | a name for every control |
| `html-img-alt.txt` | https://html.spec.whatwg.org/multipage/images.html#alt | when alt is required, what it holds, alt="" for decoration, images inside links and buttons |
| `html-title-element.txt` | https://html.spec.whatwg.org/multipage/semantics.html#the-title-element | what the title element is, and one title per document |
| `html-global-attributes.txt` | https://html.spec.whatwg.org/multipage/dom.html#global-attributes | unique ids, and why the title attribute is not a reliable name |
| `aria-hidden.txt` | https://www.w3.org/TR/wai-aria-1.2/#aria-hidden | what aria-hidden="true" hides, and what an author must keep reachable |

The pages were fetched once and saved as plain text, from the heading of each kept section to its end, with the navigation, figures, browser support tables and footers left out. From each Understanding WCAG 2.2 page the In Brief part, the success criterion, the intent and the benefits are kept. From the HTML Living Standard the requirements for alternative text (general guidelines, a link or button that holds only an image, a purely decorative image, and the guidance for conformance checkers), the title element, and the id and title attributes are kept. From WAI-ARIA 1.2 the definition of the aria-hidden state is kept. Sentences that name a year, and the few sentences that use a word the repository checks do not allow, were left out of the saved text. Typographic quotes and dashes are written as plain ASCII.

The pages say what accessible markup is, not how a tool should judge a page. The severities, the limits, the list of vague link texts and the rule for what counts as a data table are the tool's own; docs/method.md says so where each is used.

## The sentences that the findings quote

Each sentence is on its saved page word for word. A key used by "docs" is quoted in the documents and in no finding.

| Key | Used by | Sentence | Page and section |
| --- | --- | --- | --- |
| `textAlternative` | `img-no-alt` | "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below." | `wcag-non-text-content.txt`, Success Criterion (SC) |
| `controlName` | docs | "If non-text content is a control or accepts user input, then it has a name that describes its purpose." | `wcag-non-text-content.txt`, Success Criterion (SC) |
| `decorationIgnored` | docs | "If non-text content is pure decoration, is used only for visual formatting, or is not presented to users, then it is implemented in a way that it can be ignored by assistive technology." | `wcag-non-text-content.txt`, Success Criterion (SC) |
| `altRequired` | `img-no-alt` | "Except where otherwise specified, the alt attribute must be specified and its value must not be empty; the value must be an appropriate replacement for the image." | `html-img-alt.txt`, General guidelines |
| `altMeaning` | docs | "The most general rule to consider when writing alternative text is the following: the intent is that replacing every image with the text of its alt attribute does not change the meaning of the page." | `html-img-alt.txt`, General guidelines |
| `altLinkButton` | `control-no-name` | "When an a element that creates a hyperlink, or a button element, has no textual content but contains one or more images, the alt attributes must contain text that together convey the purpose of the link or button." | `html-img-alt.txt`, A link or button containing nothing but the image |
| `altDecorative` | docs | "In these cases, the alt attribute must be present but its value must be the empty string." | `html-img-alt.txt`, A purely decorative image that doesn't add any information |
| `altChecker` | docs | "A conformance checker must report the lack of an alt attribute as an error unless one of the conditions listed below applies:" | `html-img-alt.txt`, Guidance for conformance checkers |
| `structure` | `summary`, `form-field-no-label`, `heading-skip`, `table-no-headers`, `duplicate-id`, `aria-reference-missing` | "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." | `wcag-info-and-relationships.txt`, Success Criterion (SC) |
| `structurePerceivable` | `no-h1`, `table-no-headers` | "Having these structures and these relationships programmatically determined or available in text ensures that information important for comprehension will be perceivable to all." | `wcag-info-and-relationships.txt`, Intent |
| `audioControl` | `autoplay-media` | "If any audio on a web page plays automatically for more than 3 seconds, either a mechanism is available to pause or stop the audio, or a mechanism is available to control audio volume independently from the overall system volume level." | `wcag-audio-control.txt`, Success Criterion (SC) |
| `audioScreenReader` | `autoplay-media` | "Individuals who use screen reading software can find it hard to hear the speech output if there is other audio playing at the same time." | `wcag-audio-control.txt`, Intent |
| `resizeText` | `viewport-blocks-zoom` | "Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality." | `wcag-resize-text.txt`, Success Criterion (SC) |
| `resizeAuthor` | `viewport-blocks-zoom` | "The author's responsibility is to create web content that does not prevent the user agent from scaling the content effectively." | `wcag-resize-text.txt`, Intent |
| `focusOrder` | `positive-tabindex` | "If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability." | `wcag-focus-order.txt`, Success Criterion (SC) |
| `focusDefault` | `positive-tabindex` | "If no scripting or tabindex attributes are used, the navigation order is the order that components appear in the content stream." | `wcag-focus-order.txt`, Intent |
| `linkPurpose` | `vague-link-text` | "The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general." | `wcag-link-purpose-in-context.txt`, Success Criterion (SC) |
| `linkList` | `vague-link-text` | "Link text that is as meaningful as possible will aid users who want to choose from this list of links." | `wcag-link-purpose-in-context.txt`, Intent |
| `headingsLabels` | docs | "Headings and labels describe topic or purpose." | `wcag-headings-and-labels.txt`, Success Criterion (SC) |
| `headingsFind` | `heading-skip`, `no-h1`, `several-h1` | "When headings are clear and descriptive, users can find the information they seek more easily, and they can understand the relationships between different parts of the content more easily." | `wcag-headings-and-labels.txt`, Intent |
| `pageLanguage` | `html-no-lang` | "The default human language of each web page can be programmatically determined." | `wcag-language-of-page.txt`, Success Criterion (SC) |
| `pronunciation` | `html-no-lang` | "Screen readers can load the correct pronunciation rules." | `wcag-language-of-page.txt`, Intent |
| `nameForAll` | `control-no-name`, `form-field-no-label`, `title-only-name`, `aria-reference-missing` | "Success Criterion 4.1.2 Name, Role, Value requires a programmatically determinable name for all user interface components." | `wcag-name-role-value.txt`, Intent |
| `nameIntent` | docs | "The intent of this success criterion is to ensure that Assistive Technologies (AT) can gather appropriate information about, activate (or set) and keep up to date on the status of user interface controls in the content." | `wcag-name-role-value.txt`, Intent |
| `titleElement` | `page-no-title` | "The title element represents the document's title or name." | `html-title-element.txt`, The title element |
| `titleIdentify` | `page-no-title` | "Authors should use titles that identify their documents even when they are used out of context, for example in a user's history or bookmarks, or in search results." | `html-title-element.txt`, The title element |
| `titleOnce` | docs | "There must be no more than one title element per document." | `html-title-element.txt`, The title element |
| `idUnique` | `duplicate-id` | "When specified on HTML elements, the id attribute value must be unique amongst all the IDs in the element's tree and must contain at least one character." | `html-global-attributes.txt`, Global attributes |
| `titleAttribute` | `title-only-name` | "Relying on the title attribute is currently discouraged as many user agents do not expose the attribute in an accessible manner as required by this specification (e.g., requiring a pointing device such as a mouse to cause a tooltip to appear, which excludes keyboard-only users and touch-only users, such as anyone with a modern phone or tablet)." | `html-global-attributes.txt`, The title attribute |
| `ariaHidden` | `aria-hidden-focusable` | "Indicates whether the element is exposed to an accessibility API." | `aria-hidden.txt`, aria-hidden state |
| `ariaHiddenEquivalent` | `aria-hidden-focusable` | "Authors using aria-hidden to hide visible content from screen readers MUST ensure that identical or equivalent meaning and functionality is exposed to assistive technologies." | `aria-hidden.txt`, aria-hidden state |
| `ariaHiddenTrue` | docs | "The element is hidden from the accessibility API." | `aria-hidden.txt`, aria-hidden state |

## The findings

| Id | Severity | Area | Sentences | Where the rule is written |
| --- | --- | --- | --- | --- |
| `summary` | info | Page | `structure` | [method.md](method.md#summary-info) |
| `html-no-lang` | error | Page | `pageLanguage`, `pronunciation` | [method.md](method.md#html-no-lang-error) |
| `page-no-title` | error | Page | `titleElement`, `titleIdentify` | [method.md](method.md#page-no-title-error) |
| `viewport-blocks-zoom` | error | Page | `resizeText`, `resizeAuthor` | [method.md](method.md#viewport-blocks-zoom-error) |
| `img-no-alt` | error | Images and media | `altRequired`, `textAlternative` | [method.md](method.md#img-no-alt-error) |
| `autoplay-media` | warning | Images and media | `audioControl`, `audioScreenReader` | [method.md](method.md#autoplay-media-warning) |
| `control-no-name` | error | Names and labels | `nameForAll`, `altLinkButton` | [method.md](method.md#control-no-name-error) |
| `form-field-no-label` | error | Names and labels | `nameForAll`, `structure` | [method.md](method.md#form-field-no-label-error) |
| `title-only-name` | warning | Names and labels | `titleAttribute`, `nameForAll` | [method.md](method.md#title-only-name-warning) |
| `vague-link-text` | warning | Names and labels | `linkPurpose`, `linkList` | [method.md](method.md#vague-link-text-warning) |
| `heading-skip` | warning | Headings and tables | `structure`, `headingsFind` | [method.md](method.md#heading-skip-warning) |
| `no-h1` | warning | Headings and tables | `headingsFind`, `structurePerceivable` | [method.md](method.md#no-h1-warning) |
| `table-no-headers` | warning | Headings and tables | `structure`, `structurePerceivable` | [method.md](method.md#table-no-headers-warning) |
| `several-h1` | info | Headings and tables | `headingsFind` | [method.md](method.md#several-h1-info) |
| `duplicate-id` | error | IDs and references | `idUnique`, `structure` | [method.md](method.md#duplicate-id-error) |
| `aria-reference-missing` | error | IDs and references | `structure`, `nameForAll` | [method.md](method.md#aria-reference-missing-error) |
| `aria-hidden-focusable` | error | Focus | `ariaHiddenEquivalent`, `ariaHidden` | [method.md](method.md#aria-hidden-focusable-error) |
| `positive-tabindex` | warning | Focus | `focusOrder`, `focusDefault` | [method.md](method.md#positive-tabindex-warning) |
