# Community Submission Checklist

Use this before submitting or updating `Auto Link` in Obsidian community channels.

Official references:

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [obsidian-releases repository](https://github.com/obsidianmd/obsidian-releases)
- [community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)

## A. Project Readiness

- [ ] `manifest.json` has correct:
  - [ ] `id`
  - [ ] `name`
  - [ ] `version`
  - [ ] `minAppVersion`
  - [ ] `description`
- [ ] `versions.json` includes current release version.
- [ ] `README.md` explains features and setup.
- [ ] `LICENSE` file is present.
- [ ] No personal or secret data in repository.

## B. Build and Quality

- [ ] `npm run release:check` passes.
- [ ] Generated `main.js` is up to date.
- [ ] Plugin loads correctly in a clean test vault.
- [ ] Core commands work:
  - [ ] select target notes
  - [ ] analyze suggestions
  - [ ] apply changes
  - [ ] generate MOC
- [ ] `linked` only contains resolvable vault files.
- [ ] Frontmatter output is clean with only expected keys when clean mode is enabled.

## C. Security and Privacy

- [ ] `npm run security:check` passes.
- [ ] No API keys committed.
- [ ] No absolute personal file paths committed.
- [ ] No runtime `data.json`, `.env`, or `.env.local` committed.
- [ ] Error messages avoid leaking note content or credentials.

## D. Release Assets

- [ ] Git tag created using plain semantic version (for example `0.1.0`).
- [ ] GitHub release created with same tag.
- [ ] Release assets attached:
  - [ ] `manifest.json`
  - [ ] `main.js`
  - [ ] `styles.css` (if used)

## E. Submission and Update

- [ ] First release:
  - [ ] Add plugin entry through official submission process.
- [ ] Existing plugin update:
  - [ ] Follow the update flow from official docs.
- [ ] Verify the plugin page displays correct metadata after publish.
