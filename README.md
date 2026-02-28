# Omni Forge

Language: [English](README.md) | [한국어](README_KO.md)

Omni Forge is a local-first Obsidian plugin that helps you manage note metadata and ask questions over selected notes with a strong security baseline.

It is designed for users who want:
- controlled, selected-scope AI analysis (`tags`, `topic`, `linked`, `index`)
- local-note chat with source links and progress timeline
- safe cleanup and backup-aware batch workflows

## Why Omni Forge

Most AI note workflows fail in one of two ways: they are too broad (analyze everything) or too risky (send data externally by default).

Omni Forge takes the opposite approach:
- you explicitly choose files/folders first
- local endpoints are the default
- path safety checks are enforced for chat/report/backup outputs

## Core Features

- Selected-scope analysis only (files/folders you chose)
- Suggestion-first workflow (preview before apply)
- Local AI chat over selected notes with markdown answers
- Attachment-aware chat (drag/upload/paste, up to 10 items, image thumbnails)
- General chat works even without selected notes (attachment-first context supported)
- Send/Stop control for long-running local chat generation
- Source links for traceability (`[[note path]]`)
- Thinking/progress timeline during retrieval and generation
- Custom system prompt + role preset (orchestrator/coder/debugger/architect/safeguard/ask)
- Semantic candidate ranking (Ollama embeddings)
- Selection inventory context for large-scope questions
- Cleanup rules for frontmatter properties
- Backup + restore workflow before risky operations
- Optional auto-tagging for active note (tags only)
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

Keep non-local endpoints disabled unless you explicitly trust the destination and data boundary.

## Installation

### Option A: BRAT (Recommended)

1. Install BRAT in Obsidian.
2. Add this plugin repo: `piman-code/omni-forge`
3. Enable **Omni Forge**.
4. Open plugin settings and complete first-run configuration.

### Option B: Manual Release Install

1. Download assets from the latest GitHub release:
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. Place them in: `.obsidian/plugins/omni-forge/`
3. Reload Obsidian and enable **Omni Forge**.

## 5-Minute Quick Start

1. Open `Settings -> Omni Forge`.
   - Keep `Settings view mode` on `Simple` for an essentials-only screen.
   - Use `Open Full` only when you need advanced controls.
   - Use top tabs (`Quick Start/Login (OAuth)/Models & Provider/Parser/Advanced`) to focus on one area at a time.
2. Choose provider/model.
   - local-first recommendation: `Ollama`
3. Pick a `One-click local presets` profile (`Balanced` is the default recommendation).
4. Run command: `Select target notes/folders`.
5. Run command: `Analyze selected notes (suggestions by default)`.
6. Review suggestions and apply.
7. (Optional) Run command: `Ask local AI from selected notes`.

## Recommended Settings

| Area | Setting | Recommended |
|---|---|---|
| UI | Settings view mode | Simple (daily), Full (advanced tuning) |
| UI | One-click local presets | Balanced default, Fast/Quality+ for specific goals |
| Safety | Allow non-local Q&A endpoint | OFF |
| Q&A | Prefer Ollama /api/chat (with fallback) | ON |
| Q&A | Structured answer guard | ON |
| Q&A | Always detailed answers | ON |
| Q&A | Preferred response language | Korean (if primary language is Korean) |
| Q&A | Include selection inventory | ON (large scopes) |
| Chat | Auto-sync chat thread | ON |
| Analysis | Analyze changed notes only | ON (for large vaults) |
| Watcher | Watch folders for new notes | ON for inbox workflows |
| Auto-tag | Auto-tag active note | ON (optional, tags-only automation) |
| Backup | Backup selected notes before apply | ON |

## Ollama Agent Model Guide (M4 Pro 48GB)

Omni Forge Local Q&A is currently a text-note RAG flow.
It calls Ollama `/api/chat` and `/api/generate` with text prompts/messages, and does not yet send image inputs from the chat UI.

| Agent role | Primary model | Lighter fallback | Notes |
|---|---|---|---|
| Orchestrator + Architect | `qwen3:14b` | `qwen3:8b` | Balanced planning quality + speed for long structured outputs. |
| Coder + Debugger | `qwen3-coder:30b` | `qwen3:14b` | Use `qwen3-coder` when coding quality matters most; switch to `qwen3:14b` if running many agents at once. |
| Ask (general Q&A) | `gpt-oss:20b` | `qwen3:8b` | Strong default assistant behavior; fallback is faster and lighter. |
| Safeguard (security/fact check) | `gpt-oss-safeguard:20b` | `llama-guard3:8b` | Dedicated safety model first, guard model fallback for lower memory pressure. |
| Vision sidecar (optional) | `gemma3:12b` or `llama3.2-vision:11b` | `gemma3:4b` | Keep as sidecar for future image-aware flows; current plugin chat is text-only. |

For 4 concurrent agents on 48GB unified memory, start with mostly 8B/14B models and keep at most one 20B+ model active to avoid memory thrashing.

Image generation note:
- Ollama has an experimental Images API path (for example `gpt-image-1`) but this plugin does not yet wire image generation in-chat.
- For production image generation workflows, many users still run a separate stack (ComfyUI/Stable Diffusion).

Official references:
- [Qwen3](https://ollama.com/library/qwen3)
- [Qwen3-Coder](https://ollama.com/library/qwen3-coder)
- [GPT-OSS](https://ollama.com/library/gpt-oss)
- [GPT-OSS-Safeguard](https://ollama.com/library/gpt-oss-safeguard)
- [Llama Guard 3](https://ollama.com/library/llama-guard3)
- [Gemma 3](https://ollama.com/library/gemma3)
- [Llama 3.2 Vision](https://ollama.com/library/llama3.2-vision)
- [Ollama Vision docs](https://docs.ollama.com/capabilities/vision)
- [Ollama Image generation update](https://ollama.com/blog/image-generation)

## Performance Tips

For large selections and repeated runs:

- Enable `Analyze changed notes only`.
  - unchanged notes are skipped by cache metadata/signature checks
- Keep semantic linking enabled only when `linked` quality is needed
- Tune `Semantic source max chars` and `Q&A max context chars` to your hardware
- Use watched folders + incremental analysis for inbox-style pipelines

## New Note Watch Workflow

You can define watched folders.
When a new markdown note is created there, Omni Forge can prompt you to:
- ignore
- add to current selection
- add and analyze now

This helps maintain metadata freshness without full rescans.

## OAuth (Google) Quick Setup

1. Open `Settings -> Omni Forge -> Cloud provider config`.
2. Click `Google OAuth Login` or `Google quick preset`.
3. Confirm required fields:
   - `OAuth authorization URL`: `https://accounts.google.com/o/oauth2/v2/auth`
   - `OAuth token URL`: `https://oauth2.googleapis.com/token`
   - `OAuth client ID`: your Google OAuth client ID
   - `OAuth redirect URI`: `http://127.0.0.1:8765/callback`
   - Google Cloud Console (Credentials): `https://console.cloud.google.com/apis/credentials`
   - Google Cloud Console (Consent): `https://console.cloud.google.com/apis/credentials/consent`
4. Check `OAuth endpoint compatibility`.
   - If it shows endpoint mismatch, click `Apply bridge defaults`.
   - Default bridge URL applied by helper: `http://127.0.0.1:8787/v1`
5. Click `Start OAuth Login`.

Notes:
- The quick action automatically switches profile to `provider=openai`, `family=cloud`, `profile=codex`, and enables OAuth.
- Validation now reports missing fields with direct guidance (for example, `Missing required fields: client ID`).
- OAuth status shows token presence and expiry state (without printing token values).
- OAuth status now also reports transport state (`direct` vs `bridge`) and warns when Google OAuth is paired with direct `api.openai.com`.

## HWP Ingest (HWP -> PDF -> MD/XML)

- `.hwp` auto conversion requires LibreOffice `soffice`.
- `.hwpx` uses XML first-pass extraction and guided fallback.
- Parser output format is configurable: `md` (chat-ready markdown) or `xml` (structured metadata + content).
- Required install links:
  - LibreOffice (soffice): `https://www.libreoffice.org/download/download-libreoffice/`
  - Poppler (Windows pdftotext/pdftoppm): `https://github.com/oschwartz10612/poppler-windows/releases`
  - Tesseract OCR (Windows installer guide): `https://github.com/UB-Mannheim/tesseract/wiki`
  - Korean OCR language data (`kor.traineddata`): `https://github.com/tesseract-ocr/tessdata_fast/blob/main/kor.traineddata`

Common failure reasons:
- `soffice missing`: install LibreOffice and ensure `soffice` is discoverable.
- `readBinary API unavailable`: Obsidian runtime/adapter limitation.
- `pdf parser chain failed`: retry in Detailed mode or run OCR fallback tools.

## Command List

- `Select target notes/folders`
- `Analyze selected notes (suggestions by default)`
- `Auto-tag active note (tags only)`
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
- `Missing required fields: client ID` during OAuth login
  - Fill `OAuth client ID` in Cloud provider config, then retry login.
  - Open: `https://console.cloud.google.com/apis/credentials`
- `redirect_uri_mismatch` during OAuth login
  - Register `http://127.0.0.1:8765/callback` in the provider OAuth console.
- `OAuth transport mismatch` (Google OAuth + direct `api.openai.com`)
  - Enable `OAuth bridge mode` or click `Apply bridge defaults`.
- `soffice missing` during HWP ingest
  - Install LibreOffice and verify `soffice` command/path.
  - Download: `https://www.libreoffice.org/download/download-libreoffice/`
- `Embedding model is not suitable`
  - Choose an embedding-capable model and refresh detection.
- Empty or too short answers
  - Keep structured answer guard enabled, use always-detailed mode, and set minimum answer chars.
- Large selection asks (for example 100+ files) return sparse evidence
  - Enable selection inventory context and increase Q&A max context chars if your hardware allows.

## Privacy Notes

- Local mode keeps note content on your machine.
- If you use cloud providers, your provider policy applies.
- Do not enable non-local endpoints unless you understand data flow and trust boundary.

Related docs:
- [README_KO.md](README_KO.md)
- [docs/oauth-hwp-e2e-checklist.md](docs/oauth-hwp-e2e-checklist.md)
- [docs/OAUTH_RUNBOOK_KO.md](docs/OAUTH_RUNBOOK_KO.md)
- [docs/UI_SIMPLIFICATION.md](docs/UI_SIMPLIFICATION.md)
- [docs/PDF_PARSER_VALIDATION.md](docs/PDF_PARSER_VALIDATION.md)
- [docs/KO_COPY_GUIDE.md](docs/KO_COPY_GUIDE.md)
- [docs/KO_LOCALIZATION_CHECKLIST.md](docs/KO_LOCALIZATION_CHECKLIST.md)

