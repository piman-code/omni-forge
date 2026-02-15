# Auto-Linker

Language: [English Guide](docs/USER_GUIDE_EN.md) | [한국어 가이드](docs/USER_GUIDE_KO.md)

Auto-Linker is a local-first Obsidian plugin for:
- AI-assisted note metadata analysis (`tags`, `topic`, `linked`, `index`)
- Selected-scope local Q&A chat over your notes
- Safe property cleanup and backup-aware batch operations

## Release update (2026-02-15)

- Redesigned `Local AI Chat (Selected Notes)` layout (header, controls, message cards, source list, composer).
- Source references in chat are now clickable and open the target note directly.
- Chat transcript scope was reduced to top retrieval sources instead of linking every selected file.
- Added configurable dry-run cleanup report folder.
- Added configurable chat transcript root folder.
- Added auto-sync thread mode for chat transcripts (thread note is continuously updated).
- Added ribbon icon to open chat quickly from the left sidebar.
- Removed duplicate `Auto-Linker: Auto-Linker: ...` command naming.

## Quick start

1. Install with BRAT (`piman-code/auto-linker`) and enable the plugin.
2. Open `Settings -> Auto-Linker`.
3. Select your provider/model (`Ollama` recommended for local-first use).
4. Run command: `Select target notes/folders`.
5. Run command: `Analyze selected notes (suggestions by default)` or open `Ask local AI from selected notes`.

## Chat workflow (selected notes)

1. Open chat from:
- Left ribbon icon (`message-square`)
- Command palette: `Ask local AI from selected notes`
2. Select notes/folders scope.
3. Ask questions in natural language.
4. Click source links in each answer to jump to notes.
5. Use `Open chat note` to open the synced thread note.

Thread behavior:
- Default mode is auto-sync (`Auto-sync chat thread = ON`).
- Each thread is written to a markdown file under your configured chat folder.
- As messages update, the same thread note is updated (synchronized), not duplicated.

## Settings guide

Core AI:
- `Provider`
- `Ollama base URL` / `Ollama model`
- `Refresh Ollama model detection`

Semantic linking / embeddings:
- `Enable semantic linking`
- `Embedding model` + detection refresh
- `Semantic top-k candidates`
- `Semantic min similarity`
- `Semantic source max chars`

Local Q&A:
- `Q&A Ollama base URL`
- `Q&A model`
- `Q&A retrieval top-k`
- `Q&A max context chars`
- `Chat transcript folder path`
- `Auto-sync chat thread` (recommended ON)
- `Allow non-local Q&A endpoint (danger)` (recommended OFF)

Property cleanup:
- `Cleanup exact keys`
- `Pick cleanup keys from selected notes`
- `Cleanup key prefixes`
- `Never remove these keys`
- `Cleanup dry-run report folder`

Backup / selection:
- `Include subfolders for selected folders`
- `Selection path width percent`
- `Backup selected notes before apply`
- `Backup root path`
- `Backup retention count`

MOC:
- `Generate MOC after apply`
- `MOC file path`

## Commands

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

## Security model

- Local-first by design (Ollama/LM Studio recommended).
- Q&A endpoint safety guard is enabled by default (`127.0.0.1` expected).
- Vault-relative path validation is applied to chat/report/backup folders.
- See `SECURITY.md` for details.

## Development

```bash
npm install
npm run release:check
```

Related docs:
- `SECURITY.md`
- `RELEASE.md`
- `COMMUNITY_SUBMISSION_CHECKLIST.md`
