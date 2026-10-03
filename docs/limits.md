# Limits

## Markup only

The tool reads the HTML of built pages as text. It never opens a page in a browser and never runs its scripts, so it sees what the markup says and nothing else. A clean report means that none of the checks below found anything in the markup; it does not mean that the page is accessible. [decisions/0001-read-the-markup-never-run-the-page.md](decisions/0001-read-the-markup-never-run-the-page.md) says why it reads the markup and does not run the page.

## What the checks cannot see

- **CSS.** The tool cannot see CSS. Content hidden with `display: none` or `visibility: hidden` is checked as if it were shown, and an element that CSS hides does not really take focus. Text added with `::before` or `::after`, images set as backgrounds, and icon fonts are not seen. A link that CSS makes look like a button is still a link.
- **Contrast and size.** Colors, the contrast of text against its background, font sizes and the size of touch targets are set in CSS and design tokens, not in the markup. The sibling tool `design-token-check` checks contrast and target sizes from design tokens; this tool does neither.
- **Focus visibility and focus order on screen.** Whether a focused element shows a visible focus indicator, whether focus is trapped in a dialog, and whether the order of the Tab key matches the visual layout depend on CSS and scripts. The tool sees a positive tabindex and focusable content inside aria-hidden, nothing more.
- **Scripts at runtime.** A page that builds its content with JavaScript is checked as it is written in the file, before any script runs. Content added later, attributes set by a script, a player started by a script, ids added at runtime and the content of templates are not seen. Check the pages as they are built and served (server-rendered or prerendered HTML), not the empty shell of a single-page app.
- **Real screen reader behaviour.** The accessible name is computed from the markup, in the order of the name computation, but browsers and screen readers differ, and the tool does not run either. A name the tool accepts may still be read badly, and a page that passes may still be hard to use with a screen reader, a switch device or voice control.
- **Meaning.** The tool does not judge whether alt text describes the image, whether a label describes its field, whether a heading describes its section, whether a title names the page, or whether a lang value is the language of the text. A link text that is not on the list of vague texts passes, however vague it is.
- **Custom controls.** Elements made into controls with a role (`div role="button"`, `span role="checkbox"`) are not checked for a name, and their keyboard support is not seen. ARIA roles, states and properties are not validated, apart from the id references listed in docs/method.md.
- **Headings and tables, best effort.** Headings made with `role="heading"` and `aria-level` are not seen. Whether a table holds data or only lays out the page is guessed from its shape (two rows and two columns, a caption or a thead); a table with `th` cells passes even when they are in the wrong place.
- **Media.** Whether a video or audio has sound, how long it plays, and whether it has captions or a transcript are not in the markup.
- **References across files.** Ids are compared within one file. A reference to an id in another file, or to one added by a script, is reported missing.
- **Not a full HTML parser.** The tree follows the parser where it decides which element holds which (docs/inputs.md lists the rules), but it does not add a missing head or body, does not move misplaced content out of tables, and does not repair misnested formatting tags as a browser does. On badly broken markup the parent of an element, and so a wrapping label or an aria-hidden ancestor, can differ from what a browser builds.

A full accessibility audit still needs people: testing with a keyboard, with screen readers on more than one platform, with zoom and with the people who use the product. This tool finds the problems that are written in the markup, early and on every pull request, so that the audit can spend its time on what only people can judge.

## Size and counts

- An input with more than 20,000 files and folders, folders nested more than 32 deep, or more than 5,000 HTML files is refused with exit code `2`.
- An HTML file over 8 MB is not read and is named in a note; together the files read may hold at most 256 MB, or the input is refused.
- A file with a null byte in its first 8,000 bytes is binary and is not read.
- At most 400,000 tokens and 200,000 elements of one file are read; elements nested more than 512 deep are read as if they were not nested; at most 256 attributes of one tag are kept. A note says when a limit was reached.
- The text of one accessible name is collected from at most 5,000 nodes.
- A check that finds more than 200 things lists the first 200 in a fixed order, counts the rest in the totals and the gate, and says so in a note.
- Text from the input shown in a report is cut to a fixed length: 120 characters for the markup of an element, 40 to 80 for a quoted value, 1,500 for a message.

Every limit is reported, as a note or a refusal with exit code `2`, so a cut is never silent.
