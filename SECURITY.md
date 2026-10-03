# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "ui-markup-a11y-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up HTML file that shows the problem, what you expected and what happened. Use made-up names, text and addresses, and never a real key, token or password, even a revoked one.

## Scope

In scope:

- a page that makes the tool run any of its scripts, load a module, or run a program
- a page that makes the tool fetch anything or open a network connection: an image, a stylesheet, a frame, a link or a base address
- a folder that makes the tool follow a symbolic link or a junction inside it, or read a file outside the paths it was given
- a page or a folder that makes the tool hang, take very long, or use unbounded memory, such as a very large file, very many files, deep folders, elements nested very deep, a tag or a comment that is never closed, thousands of attributes, many ids and references, or character references meant to expand
- text from a file name, an attribute, an id or a heading that breaks a Markdown table, injects a formula into a CSV report, or rewrites the terminal through control or direction characters
- an id or an attribute name such as `__proto__` that changes how objects behave inside the tool
- an HTML file that the tool fails to read and passes over without a note
- a finding that docs/method.md says is reported, for markup the tool accepts, that the report leaves out
- a sentence in src/data.js that differs from the saved page in research/sources

Out of scope: what reading the markup cannot show (docs/limits.md lists it), whether a page is accessible to the people who use it, the safety of opening a page in a browser yourself, and how your pipeline stores the reports.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
