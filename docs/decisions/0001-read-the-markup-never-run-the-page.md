# 1. Read the markup, never run the page

## Context

The tool needs to say which accessibility problems a built page has before it is released. The fullest way to look is to open the page in a real browser, let its scripts run, and ask the browser's accessibility tree, or a rule engine inside the browser, what each element is called and what it does. Tools exist for that, and a release should go through them, and through testing with people.

That run is slow and heavy, and it is not safe on pages nobody has reviewed. It needs a browser and its sandbox in the pipeline, a server for the pages, and the network for the fonts, scripts and images they load. It runs whatever the page holds. And when a page is broken it reports what the browser repaired, not what the author wrote.

Many of the most common problems are written in the markup and can be read without running anything: an image with no alt, a button with only an icon, a field with no label, a page with no lang or title, a viewport that turns zoom off, a skipped heading, a duplicate id, a reference to an id that is not there, a link that says only read more, a positive tabindex, a link inside an aria-hidden region. WCAG 1.3.1 asks for exactly this kind of thing: "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." Each of these is in the text of the file.

## Decision

The tool reads built HTML as text and never runs the page. It has its own tolerant tokenizer and a light tree that follows the HTML parser where it decides which element holds which, so it needs no dependency and no browser. It reads only files that end in `.html` or `.htm`, follows no link inside a folder, never fetches anything a page names, never runs a script and never opens a network connection.

Every sentence it quotes comes from a page saved with its address in research/sources: nine Understanding WCAG 2.2 pages, the HTML Living Standard and WAI-ARIA 1.2. A test compares the code and the documents with the saved text. Where the tool makes its own choice (a severity, the list of vague link texts, the rule for a data table), the documents say so.

A thing the tool cannot read is reported, not passed: a file over the limit, a binary file, a tag that is never closed, a fragment that is not a whole page and a limit reached are named in notes, and paths with no HTML file are refused.

## Consequences

The check runs in a second on Linux, macOS or Windows with only Node: no browser, no server, no account and no network, and no page can make it run code or reach out to a host. It can run on every pull request and on pages before anyone trusts them, and it points at the file, the line and the column of the markup to change.

The cost is that it sees only the markup. CSS, scripts at runtime, contrast, visible focus and the real behaviour of screen readers are out of its sight; docs/limits.md lists them, and the sibling `design-token-check` covers contrast and target sizes from design tokens. A page that passes can still be hard to use. The tool is a step before the browser-based checks and the testing with people, not a replacement for them.
