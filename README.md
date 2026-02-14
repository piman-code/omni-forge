# Auto-Linker

Language: [English](README.md) | [한국어](README_KO.md)

Auto-Linker is an Obsidian community plugin for selective AI-assisted knowledge metadata.
It analyzes only the notes you choose, then proposes clean frontmatter updates for graph-friendly knowledge management.

## Core capabilities

- Select **files and folders** together as targets.
- Optional recursive folder expansion.
- Suggest metadata for:
  - `tags`
  - `topic`
  - `linked`
  - `index`
- Validate `linked` so it keeps only real markdown files in the vault.
- Suggestion-first workflow (preview before apply).
- Per-run preview summary with:
  - provider
  - model
  - fallback usage count
  - elapsed time
- Progress updates while analyzing/applying (count-based notices + status bar text).
- Backup selected notes before apply, and restore from latest backup.

## Frontmatter behavior

Managed keys are simple lowercase fields:

- `tags`
- `topic`
- `linked`
- `index`

Default merge behavior is conservative:

- Existing metadata is preserved when possible.
- `tags` and `linked` are additive (existing + suggestions, deduplicated).
- Existing unknown keys are preserved by default.
- Linter-like date keys (for example `date created`, `date updated`) are preserved.

If you enable **Clean unknown frontmatter keys**, non-managed keys are removed except protected date keys.

## Setup (important)

### 1) Install and enable plugin

Use BRAT beta installation with repo:

- `piman-code/auto-linker`

### 2) Open Auto-Linker settings

Go to:

- `Settings -> Community plugins -> Auto-Linker`

### 3) Choose provider

- Recommended local-first:
  - `Ollama`
  - `LM Studio`
- Cloud options:
  - OpenAI/Codex-compatible
  - Claude
  - Gemini

### 4) Ollama auto model detection

Key settings:

- `Ollama base URL`
- `Ollama model`
- `Auto-pick recommended Ollama model`
- `Detected Ollama models -> Refresh`

How auto-pick works:

1. Plugin calls Ollama `GET /api/tags`.
2. It scores detected models (chat/instruct-friendly models are preferred; embedding-only models are deprioritized).
3. If current model is empty or missing from installed models, it auto-sets a recommended model.
4. Detection runs on startup (best effort) and before analysis when provider is Ollama.

### 5) Configure analysis behavior

Main toggles:

- `Suggestion mode (recommended)`
- `Show reasons for each field`
- `Show progress notices`
- `Analyze tags/topic/linked/index`
- `Max tags`, `Max linked`

### 6) Configure selection and safety

- `Include subfolders for selected folders`
- `Backup selected notes before apply`
- `Backup root path`

### 7) Optional MOC generation

- `Generate MOC after apply`
- `MOC file path`

## Commands

- `Auto-Linker: Select target notes/folders`
- `Auto-Linker: Analyze selected notes (suggestions by default)`
- `Auto-Linker: Clear selected target notes/folders`
- `Auto-Linker: Backup selected notes`
- `Auto-Linker: Restore from latest backup`
- `Auto-Linker: Refresh Ollama model detection`
- `Auto-Linker: Generate MOC from selected notes`

## Typical workflow

1. Select targets (files/folders).
2. Run analyze command.
3. Review preview summary and per-field changes.
4. Apply changes.
5. If needed, restore from latest backup.

## Development

```bash
npm install
npm run build
npm run dev
```

## Release checks

```bash
npm run release:check
```

Additional docs:

- Security: `SECURITY.md`
- Release process: `RELEASE.md`
- Community checklist: `COMMUNITY_SUBMISSION_CHECKLIST.md`
