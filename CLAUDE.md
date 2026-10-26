# Context & File Access Instructions for Claude

## Codebase Access Rules
1. **Never read or scan the entire repository or directory tree upfront.**
2. **Do NOT run multi-file bulk dumps or re-read files unless specifically required** to answer the user's immediate question.
3. **Use targeted reads**: When investigating a bug or answering questions, only inspect the specific file(s) and lines directly related to the inquiry using the filesystem tools (`read_file` or targeted search).
4. If you need more context from another file, ask or read ONLY that single file.

## Obsidian vault (token saver)
This repo is an Obsidian vault. **Read `INDEX.md` first** to find the right note or file, then open only that. Prefer notes in `Notes/Daily/` and `Hunch/nasa-llaso-cad/review/docs/` over re-reading code. Log decisions in a dated `Notes/Daily/` note and add new docs to `INDEX.md`.
