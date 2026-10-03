# Inputs

The tool takes one or more paths: HTML files, folders of built pages, or both. It reads the HTML files as text. It never runs a script, never loads a page in a browser, never fetches an image, a stylesheet, a frame or anything else a page names, and never reads from standard input. A path named on the command line may itself be a symbolic link, because the person who runs the tool named it; inside a folder, no link is followed.

## The paths

- A file must end in `.html` or `.htm` (in any case); any other file named on the command line is refused with exit code `2`.
- A folder is walked, and every file in it that ends in `.html` or `.htm` is read. Other files (CSS, scripts, images, fonts) are counted and never opened.
- The same path named twice is read once. Files are reported in name order, with paths relative to the folder the command runs in and forward slashes on every system.
- A path that does not exist, or a set of paths with no HTML file in it, is refused with exit code `2`, so an empty run never passes a gate.
- An argument that looks like an address (`https://...`) is refused. Nothing is downloaded.

## The walk

- Every entry inside a folder is looked at with `lstat`. A symbolic link (or a Windows junction) is listed by its name and never followed, whether it points to a file, a folder, a device or back to a parent; a note lists every link.
- Folders of tools and caches are not entered: `.git`, `.hg`, `.svn`, `node_modules` and `.cache`. A note names the ones it met.
- An entry that is neither a file, a folder nor a link (a pipe, a socket, a device) is listed in a note and never opened.
- At most 20,000 files and folders, folders nested at most 32 deep, and at most 5,000 HTML files. Past any limit the input is refused with exit code `2`, rather than read in part.

## Reading a file

- Each file is opened once, and its type and size are taken from the open file. A file over 8 MB is not read and is named in a note; all files read together may hold at most 256 MB, or the input is refused.
- A file whose first 8,000 bytes hold a null byte is binary and is not read; a note names it.
- Text is read as UTF-8, and a leading byte order mark is dropped. LF, CRLF and a lone CR all end a line, so a page written on Windows and one written on Linux give the same report, with the same lines and columns. A column counts characters from the start of the line, starting at 1.

## The tokenizer

The tool has its own tokenizer, written for markup that is not always valid. It reads the text once, from left to right:

- **Start tags** with their attributes: double-quoted, single-quoted, unquoted, or with no value at all (`required`). Tag and attribute names are compared in lower case. When an attribute appears twice on a tag, the first one wins, as in a browser. At most 256 attributes of one tag are kept; a note counts the rest.
- **End tags**, and the empty `</>`, which is ignored.
- **Void elements** (`img`, `input`, `br`, `meta`, `link` and the others) never hold content, with or without a closing slash. On any other HTML element a closing slash is ignored, so `<div/>` opens a div, as in a browser. Inside svg and math the slash closes the element.
- **Comments**, including the short forms `<!-->` and `<!--->`, the **doctype**, and the bogus comments a browser makes of `<?...>` and `<!...>`.
- **Raw text**: the content of `script`, `style`, `xmp`, `iframe`, `noembed` and `noframes` is skipped as text and never read as markup, up to the matching end tag. The content of `title` and `textarea` is text with character references but no tags.
- **Templates**: the content of a `template` element is not part of the page until a script uses it. It is set aside, nested templates included, and a note counts the templates.
- **Character references** in text and attribute values are decoded once: decimal (`&#65;`), hexadecimal (`&#x41;`), and a fixed list of named ones (`&amp;`, `&lt;`, `&nbsp;`, `&rsquo;` and about thirty more). A name not on the list is kept as written. A null, a surrogate or a number past the last code point becomes the replacement character. HTML has no way for a page to declare entities of its own, and the tool reads none: an entity declared in a doctype is never expanded.

A tag, a quoted value or a comment that runs to the end of the file is handled as a browser handles it: a tag that is not closed is dropped, a comment that is not closed takes the rest of the file. A note says where it starts.

## The tree

The tokens are built into a light tree. The tool follows the parts of the HTML parser that decide which element holds which:

- a new `p`, `div`, heading, list, table and the other block elements close an open paragraph; a new `li` closes the open list item; `dt` and `dd` close each other; a new `option` closes the open option; a new row closes the open row and a new cell the open cell; a heading inside a heading, a link inside a link and a button inside a button close the first one
- an end tag closes every element opened after its start tag; an end tag with no open element of its name is ignored
- a second `html` start tag adds its attributes to the first one
- `svg` and `math` start foreign content, where these rules do not apply

It does not create the `head` and `body` elements that a browser adds when they are missing, does not move content out of tables, and does not run the adoption steps for misnested formatting elements. docs/limits.md says what that changes. At most 200,000 elements and 400,000 tokens of one file are read, and elements nested more than 512 deep are kept but read as if they were not nested; a note says when a limit was reached.

From the tree the checks take each element with its attributes, its parent, its text, and the line and column of its start tag, which the report shows with the start tag as written (cut to 120 characters).
