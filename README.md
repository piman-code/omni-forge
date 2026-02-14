# Auto-Linker

Language: [English Guide](docs/USER_GUIDE_EN.md) | [한국어 가이드](docs/USER_GUIDE_KO.md)

Auto-Linker is an Obsidian community plugin for selective AI-assisted metadata suggestions.
It targets only the notes you choose (files and folders), validates real links, and helps build a cleaner graph-based knowledge base.

## Highlights

- File + folder target selection
- Suggestion-first workflow (preview before apply)
- Backup confirmation before analysis
- Persistent progress modal with ETA and stop button
- Ollama detected-model picker with `(추천)` / `(불가)` labels
- Safe frontmatter merge behavior (`tags/topic/linked/index`)

## Quick start

1. Install via BRAT repo: `piman-code/auto-linker`
2. Open plugin settings and configure provider/model
3. Run `Auto-Linker: Select target notes/folders`
4. Run `Auto-Linker: Analyze selected notes (suggestions by default)`

## Commands

- `Auto-Linker: Select target notes/folders`
- `Auto-Linker: Analyze selected notes (suggestions by default)`
- `Auto-Linker: Clear selected target notes/folders`
- `Auto-Linker: Backup selected notes`
- `Auto-Linker: Restore from latest backup`
- `Auto-Linker: Refresh Ollama model detection`
- `Auto-Linker: Generate MOC from selected notes`

## Development

```bash
npm install
npm run release:check
```

Related docs:

- `SECURITY.md`
- `RELEASE.md`
- `COMMUNITY_SUBMISSION_CHECKLIST.md`
