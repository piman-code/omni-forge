# OAuth + HWP E2E Checklist

This checklist verifies the two critical flows:
- Google OAuth login UX/path
- HWP/HWPX ingest conversion path

## 1) OAuth (Google) Success Path

1. Open `Settings -> Omni Forge -> Cloud provider config`.
2. Click `Google OAuth Login` (or `Google quick preset` + `Start OAuth Login`).
3. Confirm required fields:
   - `OAuth authorization URL`: `https://accounts.google.com/o/oauth2/v2/auth`
   - `OAuth token URL`: `https://oauth2.googleapis.com/token`
   - `OAuth client ID`: non-empty
   - `OAuth redirect URI`: `http://127.0.0.1:8765/callback`
4. Complete browser consent and return to Obsidian.
5. Check `OAuth session actions` summary:
   - `access token: present`
   - `refresh token: present` (provider-dependent)
   - `expiry: active ...` (or provider-specific no-expiry behavior)

Expected:
- Browser opens successfully.
- Login completes without generic/ambiguous error.
- Status text is human-readable and does not expose token values.

## 2) OAuth Failure Repro

### Case A: Missing client ID
1. Clear `OAuth client ID`.
2. Click `Start OAuth Login`.

Expected:
- Validation notice includes `Missing required fields: client ID`.
- Guidance points to `OAuth client ID` field.

### Case B: Redirect URI mismatch
1. Set valid client ID, but do not register `http://127.0.0.1:8765/callback` in provider console.
2. Start OAuth login.

Expected:
- Failure notice includes actionable hint for redirect registration.

### Case C: OAuth endpoint mismatch (Google OAuth + direct OpenAI host)
1. Keep `OAuth provider preset=google`, `oauthEnabled=true`, and `OAuth bridge mode=OFF`.
2. Set `OpenAI base URL` to `https://api.openai.com/v1`.
3. Trigger cloud Q&A request.

Expected:
- Error/hint indicates transport mismatch.
- Suggested action: enable bridge mode or apply bridge defaults.

## 3) HWP Success Path (`.hwp`)

Prerequisites:
- LibreOffice installed (`soffice` available in PATH or standard install path).
- Parser inbox watch enabled (or run scan command manually).
- Install links:
  - LibreOffice: `https://www.libreoffice.org/download/download-libreoffice/`
  - Poppler (Windows): `https://github.com/oschwartz10612/poppler-windows/releases`
  - Tesseract (Windows): `https://github.com/UB-Mannheim/tesseract/wiki`
  - Korean OCR data (`kor.traineddata`): `https://github.com/tesseract-ocr/tessdata_fast/blob/main/kor.traineddata`

1. Put a sample `.hwp` file into parser inbox folder.
2. Choose `PDF -> MD` when prompted (or equivalent guided option).
3. Wait for conversion.

Expected:
- `hwp -> pdf -> parser` pipeline runs.
- Output file is created as `.parser.md` or `.parser.xml` according to setting.
- Parser status/diagnostics are visible in UI/log.

## 4) HWP Failure Repro

### Case A: `soffice` unavailable
1. Temporarily remove `soffice` from PATH (or test on machine without LibreOffice).
2. Ingest `.hwp`.

Expected:
- Error/guidance clearly reports `soffice missing` and installation guidance.

### Case B: `readBinary` unavailable
1. Run in a runtime environment where vault adapter lacks `readBinary`.
2. Ingest binary formats (PDF/image/HWP path requiring binary read).

Expected:
- Error/guidance reports `readBinary API unavailable`.

### Case C: PDF parser chain failure
1. Force malformed PDF output (or broken parser toolchain) after HWP conversion.
2. Ingest `.hwp`.

Expected:
- Error/guidance reports parser chain failure with retry suggestion.

## 5) Suggested Smoke Commands

- Parser readiness:
  - `Parser inbox: Show supported formats`
  - `Parser inbox: Scan now`
- Optional environment helper (PowerShell):
  - `.\scripts\hwp-e2e-check.ps1 -SampleHwp <path-to-sample.hwp>`
