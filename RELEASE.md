# Release Guide

This guide defines the release process for `Auto Link`.

## Versioning Rules

- Use Semantic Versioning: `MAJOR.MINOR.PATCH`.
- Use plain tags with no `v` prefix. Example: `0.1.0`.
- Keep these versions aligned:
  - `manifest.json` -> `version`
  - `package.json` -> `version`
  - `versions.json` -> add an entry for the release version

## Before You Tag

1. Update `CHANGELOG.md` for the new version.
2. Run:
   - `npm run release:check`
3. Confirm release files exist and are current:
   - `main.js`
   - `manifest.json`
   - `versions.json`
   - `README.md`
   - `LICENSE`

## Git Tag and GitHub Release

1. Commit release files.
2. Create tag:
   - `git tag 0.1.0`
3. Push commit and tag:
   - `git push origin <branch>`
   - `git push origin 0.1.0`
4. Create GitHub Release using the same tag name.
5. Attach build artifacts:
   - `main.js`
   - `manifest.json`
   - `styles.css` (only if used)

## Obsidian Community Plugin Submission

For first-time submission or metadata updates, follow the official guide:

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)

Before submitting, run through `COMMUNITY_SUBMISSION_CHECKLIST.md`.
