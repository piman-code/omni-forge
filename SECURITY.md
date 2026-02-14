# Security Checklist for Release

Use this checklist before publishing the plugin to GitHub or Obsidian community channels.

## 1) Secrets

- No hardcoded API keys in source, docs, examples, tests, or build scripts.
- No committed `.env` files.
- No runtime `data.json` with personal API keys in repository history.

## 2) Personal information

- No absolute personal file paths (for example `/Users/<name>/...`) in committed files.
- No personal vault names, private project names, or private URLs in docs/log output.

## 3) Telemetry and logs

- Do not log API keys or full prompts that may contain private note content.
- Keep user-facing error messages high-level and non-sensitive.

## 4) Supply chain and dependencies

- Pin dependencies to known versions.
- Review dependency updates before release.

## 5) Pre-release command

Run:

```bash
npm run security:check
```

If the command fails, fix every flagged item before release.
