# Auto Link

Language: [English](README.md) | [한국어](README_KO.md)

Auto Link is a local-first Obsidian plugin that helps you manage note metadata and ask questions over selected notes with a strong security baseline.

It is designed for users who want:
- controlled, selected-scope AI analysis (`tags`, `topic`, `linked`, `index`)
- local-note chat with source links and progress timeline
- safe cleanup and backup-aware batch workflows

## Why Auto Link

Most AI note workflows fail in one of two ways: they are too broad (analyze everything) or too risky (send data externally by default).

Auto Link takes the opposite approach:
- you explicitly choose files/folders first
- local endpoints are the default
- path safety checks are enforced for chat/report/backup outputs

## Core Features

- Selected-scope analysis only (files/folders you chose)
- Suggestion-first workflow (preview before apply)
- Local AI chat over selected notes with markdown answers
- Source links for traceability (`[[note path]]`)
- Thinking/progress timeline during retrieval and generation
- Semantic candidate ranking (Ollama embeddings)
- Cleanup rules for frontmatter properties
- Backup + restore workflow before risky operations
- MOC generation from selected notes

## Security-First Defaults

- Q&A endpoint default is local (`127.0.0.1` / `localhost`)
- Non-local Q&A endpoints are blocked unless explicitly enabled
- Vault-relative safe path validation for:
  - chat transcript folder
  - cleanup report folder
  - backup root
  - MOC output path
- Legacy cache cleanup is best-effort and isolated

See [SECURITY.md](SECURITY.md) for policy details.

## Installation

### Option A: BRAT (Recommended)

1. Install BRAT in Obsidian.
2. Add this plugin repo: `piman-code/auto-link`
3. Enable **Auto Link**.
4. Open plugin settings and complete first-run configuration.

### Option B: Manual Release Install

1. Download assets from the latest GitHub release:
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. Place them in: `.obsidian/plugins/auto-linker/`
3. Reload Obsidian and enable **Auto Link**.

## 5-Minute Quick Start

1. Open `Settings -> Auto Link`.
2. Choose provider/model.
   - local-first recommendation: `Ollama`
3. Run command: `Select target notes/folders`.
4. Run command: `Analyze selected notes (suggestions by default)`.
5. Review suggestions and apply.
6. (Optional) Run command: `Ask local AI from selected notes`.

## Recommended Settings

| Area | Setting | Recommended |
|---|---|---|
| Safety | Allow non-local Q&A endpoint | OFF |
| Q&A | Prefer Ollama /api/chat (with fallback) | ON |
| Q&A | Structured answer guard | ON |
| Chat | Auto-sync chat thread | ON |
| Analysis | Analyze changed notes only | ON (for large vaults) |
| Watcher | Watch folders for new notes | ON for inbox workflows |
| Backup | Backup selected notes before apply | ON |

## Performance Tips

For large selections and repeated runs:

- Enable `Analyze changed notes only`.
  - unchanged notes are skipped by cache metadata/signature checks
- Keep semantic linking enabled only when `linked` quality is needed
- Tune `Semantic source max chars` and `Q&A max context chars` to your hardware
- Use watched folders + incremental analysis for inbox-style pipelines

## New Note Watch Workflow

You can define watched folders.
When a new markdown note is created there, Auto Link can prompt you to:
- ignore
- add to current selection
- add and analyze now

This helps maintain metadata freshness without full rescans.

## Command List

- `Select target notes/folders`
- `Analyze selected notes (suggestions by default)`
- `Clear selected target notes/folders`
- `Backup selected notes`
- `Restore from latest backup`
- `Cleanup frontmatter properties for selected notes`
- `Dry-run cleanup frontmatter properties for selected notes`
- `Select cleanup keys from selected notes`
- `Refresh Ollama model detection`
- `Refresh embedding model detection`
- `Generate MOC from selected notes`
- `Ask local AI from selected notes`

## Troubleshooting

- `No target notes selected`
  - Run `Select target notes/folders` first.
- `Q&A endpoint blocked by security policy`
  - Use local endpoint, or explicitly enable non-local endpoint.
- `Embedding model is not suitable`
  - Choose an embedding-capable model and refresh detection.
- Empty or too short answers
  - Keep structured answer guard enabled and verify source scope quality.

## Privacy Notes

- Local mode keeps note content on your machine.
- If you use cloud providers, your provider policy applies.
- Do not enable non-local endpoints unless you understand data flow and trust boundary.

## Development

```bash
npm install
npm run release:check
```

Related docs:
- [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md)
- [USER_GUIDE_KO.md](docs/USER_GUIDE_KO.md)
- [SECURITY.md](SECURITY.md)
- [RELEASE.md](RELEASE.md)
- [COMMUNITY_SUBMISSION_CHECKLIST.md](COMMUNITY_SUBMISSION_CHECKLIST.md)
