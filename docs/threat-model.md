# Threat model

## What the tool touches

- It reads the HTML files named on the command line, and the HTML files inside the folders named there. Nothing outside those paths is opened.
- Inside a folder it follows no symbolic link and no junction. A path named on the command line may itself be a link, because the person who runs the tool named it.
- It does not open anything a page names: not an image, a stylesheet, a script, a frame, a font, a link or a base address. An address in a page is text.
- It writes only to the screen (standard output and standard error).
- It opens no network connection and runs no program, and it never runs a script of a page.

## What the input may hold

Built pages often come from somewhere else: a pull request, a build of a branch nobody has reviewed, a site export, an archive downloaded to be checked. The tool treats every file as possibly hostile. A page can hold scripts and event handlers meant to run when it is opened, and links to resources meant to be fetched. A folder can hold symbolic links that point outside it, at a device, or back at a parent folder in a loop. It can hold a huge file of gigabytes, millions of files, folders nested thousands deep, or a binary file with an `.html` name. The markup can nest elements a hundred thousand deep, open a tag, a quote or a comment that is not closed before the end of the file, put thousands of attributes on one tag, repeat ids and references so that a careless check does work that grows with the square of the page, or try entity tricks in the style of the billion laughs: a doctype that declares entities that expand into each other, references to references, or numbers past the last code point. A file name, an attribute, an id or a heading can hold control and direction characters, start with `=` so that a spreadsheet runs it, hold markup that a Markdown table would render, or be `__proto__`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A script in the page runs while it is checked, and does harm | Nothing is run or evaluated; the content of script and style is skipped as raw text. A test writes a page whose script would write a file and exit, and checks that no file appears and the run ends normally |
| The tool fetches what a page names, and leaks that the page was checked or pulls hostile content | No module for network access is imported; a test checks the source for them. Addresses in a page are only text |
| A symbolic link leads the tool to files outside the folder, such as a home folder | Every entry is looked at with `lstat`; a link is listed by name and never followed. A test links to a folder outside with a page in it, and checks that it is not read |
| A link loop, or a link to a parent, makes the walk run for ever | Links are not followed, so there is no loop. The walk keeps its own list of folders and needs no recursion |
| Folders nested thousands deep, or millions of files, exhaust the stack, the memory or the time | The walk is a loop with a list, and more than 32 levels, 20,000 entries or 5,000 HTML files refuse the input with exit code `2` |
| A huge file, or many large files, exhaust memory | Only HTML files are read; one over 8 MB is not read and is named; all files read may hold at most 256 MB. Other files are never opened |
| A pipe or a device named like a page makes the tool hang | The type is looked at with `lstat` before a file is opened, and again on the open file; anything that is not a regular file is never read |
| A binary file with an `.html` name is read as markup | A null byte in the first 8,000 bytes marks a file as binary; it is not read and is named in a note |
| Elements nested a hundred thousand deep overflow a stack or slow every check | The tree is built with a loop and an explicit stack; past 512 levels elements are read as if they were not nested; the flags each check needs (hidden, aria-hidden, label, table) are kept on each element, so no check walks up a long chain |
| A tag, a quote or a comment that is not closed makes the reader scan again and again | The tokenizer reads once and never goes back; whatever runs to the end of the file is handled once, as a browser handles it, and named in a note |
| Thousands of attributes, ids or references make the work grow with the square of the page | At most 256 attributes of a tag are kept; ids, labels and tables are indexed once per file; one accessible name reads at most 5,000 nodes. A test checks the time on a page with thousands of each |
| Entity tricks expand a few bytes into gigabytes | HTML has no entity declarations and the tool reads none: a doctype with declared entities is a doctype and nothing more, every reference is decoded once into at most one character, and numbers past the last code point become the replacement character |
| A very long line or a crafted near miss makes a pattern run for a very long time | Every pattern is anchored or has bounded repeats, with no nested repetition. Tests run long near misses and check the time |
| Thousands of findings of one kind make the report huge | A check lists its first 200 findings in a fixed order, counts the rest in the totals and the gate, and says so in a note |
| An id or an attribute named `__proto__` or `constructor` changes how objects behave | Attributes, ids and labels are kept in maps; a test checks that no prototype changes |
| A name, an attribute or an id rewrites the terminal through escape sequences, or reorders text with direction characters | Control characters (C0 and C1), line and paragraph separators, the byte order mark and Unicode direction controls are replaced by a space before any text reaches a report or an error message, and the length is capped |
| Markup from a page breaks the Markdown table in the job summary, makes a link, or hides text as an HTML tag | Pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks, `<`, `>` and `&` are escaped in every table cell |
| A CSV report runs a formula when opened in a spreadsheet | Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading `'`; every cell is quoted as RFC 4180 says |
| The argument names a URL, so the tool becomes a fetcher | Arguments that look like addresses are refused; reading from standard input is refused |

## Out of scope

Whether a page is accessible to the people who use it: that needs testing with people and assistive technology ([limits.md](limits.md)). The safety of opening a page in a browser yourself. The correctness of the pages the tool quotes.
