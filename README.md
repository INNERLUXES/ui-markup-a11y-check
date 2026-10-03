# ui-markup-a11y-check

Reads the built HTML of a web site or a web app and reports the accessibility problems that are visible in the markup. You give it one page, several pages, or the folder of a build. It reads them as text, never runs them, and reports images with no alt text, buttons, links and form fields with no name, pages with no language or no title, a viewport that turns zoom off, skipped heading levels, ids used twice, labels and aria attributes that point at ids that are not there, vague link text, a positive tabindex, video that plays by itself, links that a keyboard can reach inside an aria-hidden region, and data tables with no header cells. Every finding names the file, the line and the column, shows the start tag as written, and gives a sentence on how to fix it and the sentence of the page that it rests on, with its address.

A design can be right in the design tool and still lose its meaning on the way to the browser: the icon button that was labelled in the mockup ships as an empty `<button>`, the placeholder takes the place of the label, the product photo has no alt, a carousel hides its copies with `aria-hidden` and leaves their links in the tab order. Each of these is written in the HTML. This tool reads it in a second, on every pull request and before a release, so the problems are fixed while the screen is still fresh in everyone's mind.

- Every finding has an id, a severity (error, warning or info), the file with line and column, the markup of the element, a plain message, a fix, and the quoted sentence of the page it rests on, with the address of the saved page.
- Nothing runs. The HTML is read by the tool's own tolerant tokenizer: no script is run, no browser is started, nothing a page names is fetched, and no symbolic link inside a folder is followed. [docs/limits.md](docs/limits.md) says what reading the markup cannot show, starting with the main thing: it cannot see CSS, scripts at runtime, contrast, visible focus or how a screen reader really reads the page. A full audit still needs people.
- Every quoted sentence comes from the Understanding pages of WCAG 2.2, the HTML Living Standard or WAI-ARIA 1.2, saved in [research/sources](research/sources); a test compares [src/data.js](src/data.js) and the documents with the saved text.
- Reports as text, Markdown, JSON and CSV, with an exit code for a pipeline gate. Info findings never fail the run.
- Plain JavaScript, no dependencies; the same files always give the same report, with LF or CRLF line ends.

```
npm test
```

```
tests 102
pass 98
fail 0
skipped 4
```

These are the summary lines that `npm test` prints at the end. The skipped tests are the ones that need a system other than Windows: links out of the folder and in a loop, paths named through a link, a link to a device, and a file name with a control character. They are guarded with `process.platform`, and run on Linux and macOS.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/ui-markup-a11y-check.git
cd ui-markup-a11y-check
node bin/ui-markup-a11y-check.js examples/site-broken
```

Or without a clone, on the folder of your build:

```
npx --yes github:INNERLUXES/ui-markup-a11y-check dist
```

`examples/` holds two made-up versions of a small shop: a home page, a sign-up page and a product page. `examples/site-broken/` is wrong on purpose. The sign-up page has no lang, blocks zoom, skips from h1 to h3, names its email field only with a placeholder, has a password label that points at the wrong id, an icon-only submit button with a positive tabindex, and an id used twice. The product page has no title and no h1, a photo with no alt, a video that plays by itself, a size table with no header cells, a size select and an image button with no name, and a carousel copy whose link stays in the tab order under `aria-hidden`. `examples/site-fixed/` is the same shop repaired; it passes at the strictest level.

## Usage

```
node bin/ui-markup-a11y-check.js examples/site-broken --fail-on warning
```

The report starts with what was read and the result of each area:

```
ui-markup-a11y-check: examples/site-broken
files: 3 HTML files, 3 read, 0 not read, 0 other files not read, 0 links not followed, 0 folders skipped
markup: 3 pages, 0 fragments, 72 elements, 4 images, 12 controls, 6 headings
areas:
  Page                 fail  summary x3, html-no-lang x1, page-no-title x1, viewport-blocks-zoom x1
  Images and media     fail  img-no-alt x2, autoplay-media x1
  Names and labels     fail  control-no-name x1, form-field-no-label x3, title-only-name x2, vague-link-text x1
  Headings and tables  warn  heading-skip x1, no-h1 x1, table-no-headers x1, several-h1 x1
  IDs and references   fail  duplicate-id x1, aria-reference-missing x2
  Focus                fail  aria-hidden-focusable x1, positive-tabindex x1
findings: 13 error, 8 warning, 4 info
```

Then every finding follows, grouped by area. One of them:

```
  ERROR    img-no-alt  examples/site-broken/product.html:10:5
           markup: <img src="img/ridge-runner-red.jpg" width="480" height="320">
           The image "ridge-runner-red.jpg" has no alt attribute. A screen reader then reads the file name or says only "image", and a person who cannot see it gets nothing in its place. alt="" is right for an image that is only decoration.
           basis: "Except where otherwise specified, the alt attribute must be specified and its value must not be empty; the value must be an appropriate replacement for the image." (General guidelines, https://html.spec.whatwg.org/multipage/images.html#alt)
           basis: "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below." (Success Criterion (SC), https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)
           fix: Add an alt attribute: the text that would replace the image if it could not be shown (alt="Red trail running shoe, side view"), or alt="" if the image adds nothing to the text around it.
```

The whole report is in [examples/output/site-broken.txt](examples/output/site-broken.txt). It ends with `GATE: FAIL - 13 errors, 8 warnings`, and the exit code is `1`: errors fail the run by default, and the warnings fail it too here, because of `--fail-on warning`. The `info` findings (a summary per file, and the home page with two h1) never fail a run.

The repaired shop passes, also with `--fail-on warning`:

```
node bin/ui-markup-a11y-check.js examples/site-fixed --fail-on warning
```

```
ui-markup-a11y-check: examples/site-fixed
files: 3 HTML files, 3 read, 0 not read, 0 other files not read, 0 links not followed, 0 folders skipped
markup: 3 pages, 0 fragments, 74 elements, 4 images, 12 controls, 6 headings
areas:
  Page                 info  summary x3
  Images and media     pass  no finding
  Names and labels     pass  no finding
  Headings and tables  pass  no finding
  IDs and references   pass  no finding
  Focus                pass  no finding
findings: 0 error, 0 warning, 3 info

Page (3 findings)

  INFO     summary  examples/site-fixed/index.html
           Page with 19 elements: 2 images (1 with alt text, 1 with alt="", 0 with no alt), 4 controls (0 buttons, 4 links, 0 form fields), 2 headings: h1 Shoes for every path and h2 New this season.
           basis: "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." (Success Criterion (SC), https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
           fix: Nothing to fix; this is what the tool read. A clean report means none of the checks found anything in the markup, not that the page is accessible.

  INFO     summary  examples/site-fixed/product.html
           Page with 34 elements: 2 images (2 with alt text, 0 with alt="", 0 with no alt), 3 controls (1 button, 1 link, 1 form field), 2 headings: h1 Ridge Runner trail shoe and h2 Sizes.
           basis: "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." (Success Criterion (SC), https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
           fix: Nothing to fix; this is what the tool read. A clean report means none of the checks found anything in the markup, not that the page is accessible.

  INFO     summary  examples/site-fixed/signup.html
           Page with 21 elements: 0 images (0 with alt text, 0 with alt="", 0 with no alt), 5 controls (1 button, 0 links, 4 form fields), 2 headings: h1 Create your account and h2 Your details.
           basis: "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." (Success Criterion (SC), https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
           fix: Nothing to fix; this is what the tool read. A clean report means none of the checks found anything in the markup, not that the page is accessible.

GATE: PASS (--fail-on warning)
```

Every image has alt text or an empty alt, every field has a label, the icon button has an `aria-label`, the headings go down one level at a time, the size table has `th` cells, the video waits to be started, and the hidden carousel link is out of the tab order. Passing means that none of the checks found anything in the markup. It does not mean that the pages are accessible; only testing with people and assistive technology shows that.

```
ui-markup-a11y-check <file or folder>... [options]
```

```
--format <name>     text, markdown, json or csv (default: text)
--fail-on <level>   exit with 1 when a finding is at this level or above: error or warning
                    (default: error); info never fails the run
--help              show the usage
--version           show the version
```

Paths in the report are relative to the folder you run the command in, with forward slashes on every system; a path outside it is shown in full.

## What is read

[docs/inputs.md](docs/inputs.md) has the details. Folders are walked without following links, and only files ending in `.html` or `.htm` are read; other files are counted and never opened.

| Part of the markup | What the tool takes from it |
| --- | --- |
| start tags and attributes | names, values (quoted, unquoted or none), the line and column, and the tag as written |
| text and character references | the text of headings, labels, links and buttons, decoded once |
| `script`, `style` and the like | skipped as raw text, never read as markup and never run |
| `template` | set aside: its content is not part of the page until a script uses it |
| comments and the doctype | whether the file is a whole page or a fragment |

## The checks

| Id | Severity | What it reports |
| --- | --- | --- |
| `html-no-lang` | error | The html element has no `lang`, an empty one, or one that is not a language tag |
| `page-no-title` | error | No title element, or an empty one |
| `viewport-blocks-zoom` | error | A viewport meta tag with `user-scalable=no` or a `maximum-scale` below 2 |
| `img-no-alt` | error | An img with no `alt` (an empty alt is fine: it marks decoration), or an image button with no alt text |
| `control-no-name` | error | A button, a link with `href` or an input button with no accessible name |
| `form-field-no-label` | error | An input, select or textarea with no label and no other name |
| `duplicate-id` | error | An id used by more than one element of a file |
| `aria-reference-missing` | error | `aria-labelledby`, `aria-describedby`, `aria-controls` or the `for` of a label naming an id that is not there |
| `aria-hidden-focusable` | error | Content that takes keyboard focus inside an element with aria-hidden set to true |
| `autoplay-media` | warning | A video or audio with `autoplay` and without `muted` |
| `title-only-name` | warning | A name that comes only from `title`, or from the `placeholder` of a text field |
| `vague-link-text` | warning | Link text such as click here, read more, here or more, with no aria-label |
| `heading-skip` | warning | A heading more than one level below the one before it (h2 then h4) |
| `no-h1` | warning | A page with no h1 |
| `table-no-headers` | warning | A data table with no `th` and no other header markup |
| `positive-tabindex` | warning | A tabindex above 0 |
| `several-h1` | info | A page with more than one h1 |
| `summary` | info | What was read in each file: elements, images, controls and the outline of headings |

[docs/method.md](docs/method.md) gives each check, its exact rule, what it can see and what it cannot. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every quoted sentence with the saved page it comes from.

## Where the facts come from

| Fact | Source |
| --- | --- |
| Text alternatives, and names for image controls | Understanding WCAG 2.2, SC 1.1.1 Non-text Content, https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html |
| Structure and relationships in the markup | Understanding WCAG 2.2, SC 1.3.1 Info and Relationships, https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html |
| Audio that plays by itself | Understanding WCAG 2.2, SC 1.4.2 Audio Control, https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html |
| Zoom to 200 percent | Understanding WCAG 2.2, SC 1.4.4 Resize Text, https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html |
| The order of keyboard focus | Understanding WCAG 2.2, SC 2.4.3 Focus Order, https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html |
| The purpose of a link from its text | Understanding WCAG 2.2, SC 2.4.4 Link Purpose (In Context), https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html |
| Headings and labels | Understanding WCAG 2.2, SC 2.4.6 Headings and Labels, https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html |
| The language of the page | Understanding WCAG 2.2, SC 3.1.1 Language of Page, https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html |
| A name for every control | Understanding WCAG 2.2, SC 4.1.2 Name, Role, Value, https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html |
| When alt is required and what it holds | HTML Living Standard, https://html.spec.whatwg.org/multipage/images.html#alt |
| The title element | HTML Living Standard, https://html.spec.whatwg.org/multipage/semantics.html#the-title-element |
| Unique ids, and the title attribute | HTML Living Standard, https://html.spec.whatwg.org/multipage/dom.html#global-attributes |
| What aria-hidden hides | WAI-ARIA 1.2, https://www.w3.org/TR/wai-aria-1.2/#aria-hidden |

## Formats

- `text`: for a terminal: the input, files and markup lines, the areas with their result, then the findings grouped by area, each with its id, file:line:column, the markup, the message, the quotation and the fix.
- `markdown`: the same for a pull request comment or the job summary. Pipes, square brackets, backticks, asterisks, underscores, line breaks and angle brackets from the input are escaped, so markup cannot break a table, make a link or be read as HTML.
- `json`: the whole report: the inputs, the file counts, the areas, every finding with id, severity, area, file, line, column, snippet, subject, message, fix, basis and source, the notes and the gate.
- `csv`: one row per finding, quoted as RFC 4180 says. A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.

[examples/output](examples/output) holds the broken shop in every format.

To put the report in the job summary of a GitHub Actions run, after the step that builds the site into `dist`:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  # build the site into dist here
  - name: Accessibility report
    run: npx --yes github:INNERLUXES/ui-markup-a11y-check dist --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Accessibility gate
    run: npx --yes github:INNERLUXES/ui-markup-a11y-check dist --fail-on warning
```

It needs no secrets, no browser and no server; a Linux runner is enough. Start with the default gate (errors only), and move to `--fail-on warning` when the first report is clean.

## Exit codes

`0` no finding at the `--fail-on` level, `1` at least one such finding (by default: an error, such as an image with no alt or a field with no label), `2` a usage or input error (a path that does not exist, a file that is not HTML, paths with no HTML file, an input over the limits of entries, depth, files or bytes, an unknown option).

## Limits

The tool reads markup; it does not run the page, so it cannot see CSS, scripts at runtime, colors and contrast, visible focus, or how a screen reader really reads the page. It does not judge whether alt text, labels, headings or titles are good, only whether they are there. Custom controls made with a `role` are not checked for a name, and ids are compared within one file. A finding is a review item, and a clean report is a good start, not a proof; a full audit still needs people. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Related

Color contrast and the size of touch targets live in CSS and design tokens, not in the markup. They are the subject of `design-token-check` in the same organization, which reads the design tokens of a design system and checks contrast pairs and target sizes; this tool checks neither.

## Background

- How web and mobile interfaces are designed so that every screen keeps its labels, names and structure all the way to the shipped code, with checks like this one in the pipeline: [UI design services for web and mobile](https://innerluxes.dev/application/ui-design).

## License

MIT
