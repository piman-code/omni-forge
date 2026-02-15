# Changelog

All notable changes to this project are documented in this file.

## [0.2.17] - 2026-02-15

### Changed

- Corrected release packaging alignment for `0.2.17`:
  - release tag now points to the `0.2.17` version commit
  - bundled `manifest.json` version set to `0.2.17`
  - `versions.json` includes `0.2.17`
- Functional changes are the same as `0.2.16` (UI alignment fixes, bilingual UI updates, role-specific model and pipeline controls).

### Security

- Re-ran full release checks with local-endpoint-first policy unchanged.

## [0.2.16] - 2026-02-15

### Added

- Added role-specific local model settings for Local Q&A:
  - `Ask model (text)`
  - `Ask model (vision)`
  - `Image generator model`
  - `Coder model`
  - `Architect model`
  - `Orchestrator model`
  - `Safeguard model`
- Added Q&A pipeline preset selector:
  - `Orchestrator -> Safeguard` (default)
  - `Orchestrator -> Coder -> Safeguard`
  - `Orchestrator -> Architect -> Safeguard`
  - `Orchestrator -> Architect -> Coder -> Safeguard`
  - `Legacy auto` (previous behavior)

### Changed

- Local Q&A pipeline execution now applies stage-specific models when configured.
- Settings bilingual rendering now uses stacked EN/KO lines with improved wrapping to avoid clipped/misaligned text.
- Local chat panel labels/buttons/placeholders were expanded with EN/KO bilingual text.
- Chat composer layout was adjusted so the input area uses full width and no longer appears narrow/shifted.

### Security

- Re-ran full release security and integrity checks while keeping local-endpoint-first policy unchanged.

## [0.2.15] - 2026-02-15

### Added

- Added optional orchestration/safeguard post-processing controls for Local Q&A:
  - `Enable orchestrator pipeline`
  - `Enable safeguard verification`
- Added full settings-screen bilingual pass (EN/KO) for section headers, setting names, and setting descriptions.
- Added bilingual labels for key setting controls (provider options, role preset options, model refresh/recommend buttons, cleanup picker button).
- Added Ollama agent model recommendation guide (EN/KO README) for M4 Pro 48GB, including role-to-model mapping and vision/image-generation notes.

### Changed

- Clarified in docs that current plugin chat pipeline is text-note based (`/api/chat`, `/api/generate`) and image input/generation is not yet wired in-chat.
- Expanded Korean co-labeling coverage to nearly all setting areas for first-time domestic users.

### Security

- Revalidated release checks with local-endpoint-first policy unchanged and non-local endpoint guard preserved by default.

## [0.2.14] - 2026-02-15

### Added

- Added `Stop` control in Local AI Chat to cancel in-flight streaming generation.
- Added Q&A response control settings:
  - `Always detailed answers`
  - `Minimum answer chars`
  - `Preferred response language`
  - `Role preset` (`ask`, `orchestrator`, `coder`, `debugger`, `architect`, `safeguard`)
  - `Custom system prompt`
- Added selection inventory context option for large-scope Q&A to reduce sparse-evidence failures.
- Added active-note auto-tagging workflow:
  - `Auto-tag active note`
  - cooldown control
  - manual command `Auto-tag active note (tags only)`

### Changed

- Expanded settings labels with Korean/English bilingual wording for key controls.
- Updated README (EN/KO) to include long-answer tuning, inventory guidance, Stop control, and auto-tag usage.

### Security

- Re-verified release with repeated security checks while preserving local-endpoint guard and vault-relative path validation.

## [0.2.13] - 2026-02-15

### Changed

- Rebranded user-facing plugin name from `Auto-Linker` to `Auto Link` across UI and docs.
- Rewrote `README.md` and `README_KO.md` for first-time global/Korean users with clearer install, setup, workflow, and troubleshooting guidance.
- Updated BRAT/repository references from `piman-code/auto-linker` to `piman-code/auto-link`.

### Performance

- Added `Analyze changed notes only` option to skip unchanged files based on cache metadata/signature.
- Added pre-analysis early-exit in changed-only mode to avoid unnecessary semantic/indexing work.

### Added

- Added watched-folder workflow:
  - `Watch folders for new notes`
  - `Watched folders`
- New-note modal now prompts user to ignore, add to selection, or add and analyze immediately.

## [0.2.12] - 2026-02-15

### Changed

- Local Q&A now prefers richer answers by default (unless user explicitly asks for brevity), with stronger output contracts for depth and readability.
- Structured output guard now also repairs overly short answers, not only missing table/checklist/source-list structure.
- Detailed answer mode now uses a non-conflicting system prompt tone to avoid collapsing into one-line responses.

### Performance

- Added in-memory runtime file-vector cache keyed by endpoint/model/context/file to reduce repeated embedding work across ongoing chat turns.
- Added in-memory runtime query-vector cache to avoid re-embedding repeated user queries in the same session.
- Added in-memory embedding-cache object reuse to reduce repeated disk cache reads/parsing during large-scope chat sessions.

## [0.2.11] - 2026-02-15

### Security

- Hardened `backupRootPath` handling with vault-relative safe-path validation.
- Hardened `mocPath` handling with vault-relative safe markdown-path validation.
- Added settings-time validation and rejection for invalid backup/MOC paths.
- Added load-time normalization fallback to safe defaults for invalid stored paths.

## [0.2.10] - 2026-02-15

### Changed

- Local AI Chat now renders thinking progress as always-visible timeline cards with clearer stage labels and live status.
- Local Q&A generation keeps `/api/chat` as primary path while preserving automatic `/api/generate` fallback behavior.
- Markdown answer styling was further stabilized for tables/checklists/code/blockquote rendering across themes.

### Fixed

- Fixed empty-answer failure path by falling back when `/api/chat` returns no final text.
- Reduced “improvement not visible” UX issue by removing dependence on collapsed thinking details UI.

## [0.2.9] - 2026-02-15

### Changed

- Thinking UI now renders as always-visible timeline cards (no collapsed details dependency).
- Thinking card header now shows live status badge while generation is in progress.

### Fixed

- If Ollama `/api/chat` returns an empty answer, local Q&A now automatically falls back to `/api/generate`.
- Reduced empty-answer failure path for local chat by strengthening endpoint fallback behavior.

## [0.2.8] - 2026-02-15

### Added

- Live `Thinking` timeline card for retrieval/generation progress in local Q&A.
- Thinking timeline now shows stage-typed event cards (`retrieval`, `generation`, `thinking`, `warning`, `error`) with timestamps.
- Auto-sync chat thread mode for continuously updating a single transcript note.
- New chat actions: `New thread`, `Open chat note`, and left ribbon shortcut.
- Configurable folders for chat transcripts and cleanup dry-run reports.
- Q&A settings: `Prefer Ollama /api/chat (with fallback)` and `Structured answer guard`.

### Changed

- Local AI chat UI was redesigned for clearer structure and readability.
- Assistant responses are rendered as markdown (tables/lists/headers supported).
- Q&A retrieval pipeline now expands candidates more aggressively before reranking.
- Local Q&A generation path now prefers Ollama `/api/chat` and automatically falls back to `/api/generate`.
- Q&A prompt policy now enforces intent-aware structured output (comparison table/checklist/source-only list).
- RAG snippet extraction changed from line-based to paragraph/heading blocks with reduced path-bias reranking.
- Transcript `scope_files` now focuses on top retrieved sources (instead of full scope dump).

### Fixed

- Command palette labels no longer duplicate `Auto Link:` prefixes.
- Cleanup dry-run report path now uses safe vault-relative validation.
- Improved source row visibility in themes with high color-contrast differences.
- Markdown render consistency improvements for table/checklist/blockquote/code blocks across themes.

## [0.1.1] - 2026-02-15

### Added

- Ribbon icon to open `Auto Link Local Chat` quickly.
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

- Command palette labels no longer show duplicated `Auto Link:` prefix.
- Cleanup dry-run report output path is now safely configurable (vault-relative validation).

## [0.1.0] - 2026-02-14

### Added

- Initial Obsidian community plugin scaffold for `Auto Link`.
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
