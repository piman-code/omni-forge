# Changelog

All notable changes to this project are documented in this file.

## [0.2.8] - 2026-02-15

### Added

- Live `Thinking` timeline card for retrieval/generation progress in local Q&A.
- Auto-sync chat thread mode for continuously updating a single transcript note.
- New chat actions: `New thread`, `Open chat note`, and left ribbon shortcut.
- Configurable folders for chat transcripts and cleanup dry-run reports.

### Changed

- Local AI chat UI was redesigned for clearer structure and readability.
- Assistant responses are rendered as markdown (tables/lists/headers supported).
- Q&A retrieval pipeline now expands candidates more aggressively before reranking.
- Transcript `scope_files` now focuses on top retrieved sources (instead of full scope dump).

### Fixed

- Command palette labels no longer duplicate `Auto-Linker:` prefixes.
- Cleanup dry-run report path now uses safe vault-relative validation.
- Improved source row visibility in themes with high color-contrast differences.

## [0.1.1] - 2026-02-15

### Added

- Ribbon icon to open `Auto-Linker Local Chat` quickly.
- Configurable `Chat transcript folder path`.
- Configurable `Cleanup dry-run report folder`.
- `Auto-sync chat thread` setting for continuous thread-note synchronization.
- Live `Thinking` timeline card for retrieval/generation progress.

### Changed

- Redesigned Local AI chat workspace UI for clearer layout and readability.
- Assistant responses are rendered as markdown (tables/lists/headers supported).
- Source list in chat messages now renders as clickable note links.
- Chat transcript `scope_files` now stores top retrieval sources instead of full selected scope.

### Fixed

- Command palette labels no longer show duplicated `Auto-Linker:` prefix.
- Cleanup dry-run report output path is now safely configurable (vault-relative validation).

## [0.1.0] - 2026-02-14

### Added

- Initial Obsidian community plugin scaffold for `Auto-Linker`.
- Target-note selector modal to analyze only chosen notes.
- Suggestion-first workflow: analyze, preview, then apply.
- Per-field rationale display for `tags`, `topic`, `linked`, and `index`.
- Strict `linked` validation to keep only real markdown files in the vault.
- Managed frontmatter policy with clean lowercase keys:
  - `tags`
  - `topic`
  - `linked`
  - `index`
- Optional clean mode to remove only legacy AI-prefixed keys (for example `ai_*`) while preserving existing custom fields.
- Local-first provider support:
  - Ollama
  - LM Studio
- Extensible cloud provider adapters:
  - OpenAI/Codex-compatible
  - Anthropic Claude
  - Google Gemini
- Selected-note MOC generation command.
- Release security checks and release documentation.
