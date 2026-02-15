# Auto Link User Guide (EN)

## What this plugin does

Auto Link helps you build a cleaner Obsidian knowledge graph by suggesting frontmatter metadata from selected notes only.

Managed fields:

- `tags`
- `topic`
- `linked`
- `index`

## Key workflow

1. Run `Auto Link: Select target notes/folders`
2. Choose files and/or folders
3. Run `Auto Link: Analyze selected notes (suggestions by default)`
4. Confirm backup choice (recommended)
5. Review preview (provider/model/time/fallback info)
6. Apply changes
7. Restore from backup if needed

## Selection modal tips

- Use **Files / Folders** tabs.
- Use filter input for quick narrowing.
- Use **Path width** slider when long paths are hard to read.
- Folder selection can include subfolders.

## Progress modal

During analyze/apply:

- Persistent modal stays open until completion/cancel.
- Shows current file, processed count, elapsed time, ETA.
- `Stop` button cancels safely after current file.
- Error/activity log supports "Show only errors" filter.

## Backup and restore

- Backup confirmation appears before analysis.
- Backup command:
  - `Auto Link: Backup selected notes`
- Restore command:
  - `Auto Link: Restore from latest backup`
- Backup retention is configurable (`Backup retention count`).

## Ollama model detection and picker

- Refresh detected models from settings.
- Picker labels:
  - `(추천)` recommended
  - `(불가)` unsuitable for analysis (embedding/speech/rerank type)
- Auto-pick can set a recommended model when current one is empty/missing.

## Important settings

- `Provider`
- `Suggestion mode (recommended)`
- `Show reasons for each field`
- `Analyze tags/topic/linked/index`
- `Max tags`, `Max linked`
- `Excluded folder patterns`
- `Backup selected notes before apply`
- `Backup root path`
- `Backup retention count`
- `Generate MOC after apply`

## Frontmatter safety behavior

Default behavior is conservative:

- Existing metadata is preserved where possible.
- `tags` and `linked` are additive (union).
- Existing non-managed keys are preserved by default.
- Linter-style date keys (for example `date created`, `date updated`) are protected.

## Development and release

```bash
npm install
npm run release:check
```

Related docs:

- `SECURITY.md`
- `RELEASE.md`
- `COMMUNITY_SUBMISSION_CHECKLIST.md`
