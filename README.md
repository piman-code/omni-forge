# Auto-Linker

Auto-Linker is an Obsidian community plugin for selective AI-driven metadata updates.
It helps users build a cleaner graph-based second brain by proposing metadata changes for only the notes they choose.

## Core capabilities

- Select target notes manually (no forced full-vault run).
- Generate `tags`, `topic`, `linked`, and `index` suggestions.
- Validate `linked` values against real vault files only.
- Run in suggestion-first mode: preview, inspect reasons, then apply.
- Optionally generate a grouped MOC from selected notes.

## Frontmatter policy

Managed keys are intentionally simple and lowercase:

- `tags`
- `topic`
- `linked`
- `index`

If **Clean unknown frontmatter keys** is enabled, all other frontmatter keys are removed on apply.

## Provider support

Local-first:

- Ollama
- LM Studio (OpenAI-compatible endpoint)

Cloud adapters included:

- OpenAI / Codex-compatible
- Anthropic Claude
- Google Gemini

When provider calls fail, Auto-Linker falls back to a deterministic local heuristic so workflows are not blocked.

## Commands

- `Auto-Linker: Select target notes`
- `Auto-Linker: Analyze selected notes (suggestions by default)`
- `Auto-Linker: Clear selected target notes`
- `Auto-Linker: Generate MOC from selected notes`

## Build

```bash
npm install
npm run build
```

For development watch mode:

```bash
npm run dev
```

## Security and release

Run the built-in secret/path checks before release:

```bash
npm run security:check
```

See `SECURITY.md` for full release hygiene guidance.
See `RELEASE.md` for release steps and tagging rules.
See `COMMUNITY_SUBMISSION_CHECKLIST.md` for submission readiness.
