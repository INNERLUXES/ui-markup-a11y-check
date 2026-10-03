# Changes

## 1.0.0

First release.

- Reads built HTML files: one file, several, or folders of `.html` and `.htm` files. Walks a folder with `lstat` and never follows a symbolic link inside it. Never runs a script, never fetches an image, a stylesheet or a frame, and opens no network connection.
- A tolerant HTML tokenizer of its own: void elements, attributes with and without quotes or values, comments, the doctype, the raw text of script and style, template content set aside, and character references decoded once. A light tree follows the parser where it matters: implied end tags of paragraphs, list items, rows and cells, end tags with no open element ignored, and svg and math read as foreign content.
- Page: no `lang` on the html element, or one that is not a language tag (`html-no-lang`); no title or an empty one (`page-no-title`); a viewport that blocks zoom with `user-scalable=no` or a `maximum-scale` below 2 (`viewport-blocks-zoom`). A summary of each file (`summary`, info).
- Images and media: an img with no alt, and an image button with no alt text (`img-no-alt`); video and audio that play by themselves and are not muted (`autoplay-media`).
- Names and labels: buttons, links and `input type="button"` with no accessible name (`control-no-name`); form fields with no label (`form-field-no-label`); a name that comes only from `title` or `placeholder` (`title-only-name`); link text such as "click here" and "read more" (`vague-link-text`).
- Headings and tables: a skipped heading level (`heading-skip`); no h1 (`no-h1`); more than one h1 (`several-h1`, info); a data table with no header cells (`table-no-headers`).
- IDs and references: an id used twice in a file (`duplicate-id`); `aria-labelledby`, `aria-describedby`, `aria-controls` or the `for` of a label that names an id no element has (`aria-reference-missing`).
- Focus: focusable content inside `aria-hidden="true"` (`aria-hidden-focusable`); a tabindex above 0 (`positive-tabindex`).
- Every finding has an id, a severity (error, warning, info), the file, the line and column, the markup of the element, a message, a fix, and the sentence of the page it rests on, with the address.
- Every quoted sentence comes from nine Understanding WCAG 2.2 pages, the HTML Living Standard (alt text, the title element, the id and title attributes) and WAI-ARIA 1.2 (`aria-hidden`), saved in `research/sources`; a test compares `src/data.js` and the documents with the saved text.
- Reports as text, Markdown, JSON and CSV; `--fail-on` for a pipeline gate; info never fails the run; exit code `2` for a usage or input error.
- Safe input: no link inside a folder is followed, at most 20,000 entries, 32 levels of folders and 5,000 HTML files, files up to 8 MB and 256 MB in all, binary files are not read, 400,000 tokens and 200,000 elements per file, nesting past 512 read flat, 256 attributes per tag, names computed within a fixed budget, and control characters removed from every text shown.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
