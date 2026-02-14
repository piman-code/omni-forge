# Changelog

All notable changes to this project are documented in this file.

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
- Optional clean mode to remove unknown frontmatter keys.
- Local-first provider support:
  - Ollama
  - LM Studio
- Extensible cloud provider adapters:
  - OpenAI/Codex-compatible
  - Anthropic Claude
  - Google Gemini
- Selected-note MOC generation command.
- Release security checks and release documentation.
