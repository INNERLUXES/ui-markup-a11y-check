# Secure defaults

The default run is the safe run. Nothing below needs a flag, and none of it can be switched off.

## How the tool behaves by default

- **Never runs the page.** The tool reads HTML as text. It never runs a script, an event handler or an inline style, never starts a browser and never evaluates anything it reads. The content of `script` and `style` is skipped as raw text. A page can be checked before anyone trusts it.
- **No network.** The tool reads the files it is given and sends nothing anywhere. It never fetches an image, a stylesheet, a frame, a font or a link named in a page, does not check for updates, and refuses an argument that looks like an address. It can run in a locked-down job with no outbound access at all.
- **No commands.** The tool never runs a program. No name, path or value from a page is ever put on a command line.
- **No dependencies.** Node 22 or newer and nothing else, so a check does not add a supply chain of its own. There is no `node_modules` to install before it runs.
- **Never follows a link.** Inside a folder, every entry is looked at with `lstat`. A symbolic link or a junction is listed and never followed, so it cannot lead the tool to files outside the folder or round in a loop.
- **Reads only what it needs.** Only files that end in `.html` or `.htm` are read. Other files are counted by name and never opened. A path or an address written in a page is text; it is never opened.
- **Regular files only, bounded.** Each file is opened once, its type and size are taken from the open file, and anything that is not a regular file or is over 8 MB is not read. The number of entries, the depth of folders, the number of HTML files and the total bytes read are capped, and past a cap the input is refused.
- **A bounded reader.** The tokenizer reads the text once, from left to right, and never goes back. Every pattern is anchored or bounded, with no nested repetition. Tokens, elements, nesting, attributes and the work of one accessible name are capped. Character references are decoded once and never expand: a page cannot declare entities.
- **Nothing is guessed.** A file not read, a tag or a comment that is never closed, a limit reached, a link not followed and a fragment that is not a whole page are named in a note. Paths that hold no HTML file are refused, so an empty run does not pass.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message, so a hostile file name, attribute or id cannot rewrite the terminal or reorder what a reader sees. Markdown cells escape pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks and `<`, `>` and `&`. CSV cells are quoted as RFC 4180 says, and a cell that a spreadsheet would read as a formula gets a leading `'`.
- **No prototype tricks.** Attributes, ids and labels are kept in maps, and findings in arrays, so an id or an attribute named `__proto__` is just data.
- **The gate is on.** Without any option, an error makes the run exit with `1`.
- **Writes nothing to disk.** The report goes to the screen. Redirect it to a file or the job summary only when you need to keep it.

## Running it safely on pages you do not know

1. A page is data, and the tool treats it as data. Still, run it as a user with read access to the pages and nothing else; it needs no account, no key, no browser and no network.
2. Read the notes and the summaries: they say what was not read and why, so a pass is not taken for more than it is.
3. A report quotes the markup of the elements it reports. Keep that in mind before you post a report of a private site in a public place.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline, with `ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS, with hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
