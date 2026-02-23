# Omni-Forge Architecture Snapshot

## Recent Update (v1.4)

### Unified diff proposal pipeline (linked frontmatter)
- Engine: `BrainLinkQualityEngineV1.proposeLinkedFrontmatterUnifiedDiffV1`
- Output: STANDARD unified diff with hunk header `@@ -a,b +c,d @@`
- Line ranges are computed from `NoteSnapshotV1.content`
- Preview UI renders raw unified diff in a monospaced block and shows `scopeWouldBlock` as a read-only indicator
- Apply remains NO-OP (preview-only), with no filesystem mutation

### Linked Frontmatter Unified Diff Engine v1 (Sealed)
- Parser hardening is sealed: UTF-8 BOM support, delimiter trailing whitespace acceptance, and closing delimiter recognition at EOF
- YAML matching is sealed: `linked` is detected only at true top-level (`^linked\\s*:`) and terminates at the next true top-level key (`^[A-Za-z0-9_-]+\\s*:`)
- Unified diff output is sealed to standard hunk header form: `@@ -a,b +c,d @@`
- Line ranges are sealed to derive from `NoteSnapshotV1.content` only (no file reads)
- Output behavior is sealed as deterministic (no reordering; no scoring/order changes)
- Guard behavior is preview-only; Apply remains NO-OP
- Any modification to these guarantees requires DECISION_REQUIRED (design review) before implementation

### Data flow
- Input: `NoteSnapshotV1` includes `content`
- Plan: `computeFrontmatterLinkedPatchPlanV1 -> mergeLinkedFrontmatterV1` (no scoring/order changes)
- Proposal: `proposeUnifiedDiffForLinkedFrontmatterV1(plan, target.content)`
- UI payload may include: `linkedUnifiedDiffPreview { diffText, changed, scope }`

### Edge-case hardening (`parseLinkedFrontmatterRangeV1`)
- Supports UTF-8 BOM at start (`\uFEFF`)
- Frontmatter delimiter lines accept trailing spaces/tabs: `---[ \t]*`
- Closing delimiter is allowed even if it is the last line
- `linked` key detection is true top-level only: `^linked\s*:`
- Linked block terminates at the next true top-level key: `^[A-Za-z0-9_-]+\s*:`

### Guardrail alignment
- No vault-wide scan added; operations remain per-target note
- Default-deny scope gating is unchanged; preview may show "would block" and does not override
- Apply remains NO-OP pending explicit approval

### Step 2 scope scaffolding (design prep only)
- Scope model is a default-deny allowlist: `roots[]` is an allowlist of vault-relative folder roots only
- No implicit traversal beyond selected roots is assumed in the Step 2 model
- Step 2 scaffolding is not wired into runtime behavior yet: warn-only, no enforcement, no behavior change
- Path semantics are undecided and must be finalized before any enforcement: traversal handling (`..`), symlinks, and absolute vs vault-relative interpretation
- Until path semantics are explicitly decided, enforcement remains disabled

### Path Semantics Decision Checklist (Step 2 Prep)
- Vault-relative vs absolute path interpretation (proposed baseline: vault-relative only)
- Traversal handling policy for `.` and `..` (normalize vs reject; decision pending)
- Symlink handling within vault roots (allow, block, or warn-only; decision pending)
- Path separator normalization (`/` vs `\\`) and cross-platform consistency
- Case sensitivity policy (platform-dependent vs normalized)
- Root boundary matching rule for `roots[]` (must prevent prefix overreach, e.g., `/foo` vs `/foobar`)
- Until these decisions are finalized, enforcement remains disabled (warn-only, no behavior change)

### Path Semantics Decisions (Finalized)
- Path interpretation: vault-relative only (absolute paths are out-of-scope)
- Traversal handling (`.` / `..`): normalize for comparison; any normalized path escaping `roots[]` is considered out-of-scope
- Symlinks: treat as risk boundary; warn-only until a future enforcement design decides realpath-based handling (no enforcement in Step 2)
- Separator normalization: normalize `\\` to `/` for internal comparisons
- Case sensitivity: compare deterministically (policy: case-sensitive) regardless of platform variance
- Root boundary matching: folder-boundary aware matching (prevent prefix overreach like `/foo` matching `/foobar`)
- Even with these decisions finalized, Step 2 remains design-prep only (warn-only; enforcement disabled; no behavior change)

### Step 2 Enforcement Design Draft (Not Wired)
- Not wired: enforcement is disabled; warn-only diagnostics may exist; no behavior change
- Draft pure interface (documentation-only): `evaluateVaultRelativePathAgainstRootsV1(path, roots) -> { wouldBlock, reason, matchedRoot }`
- Inputs are vault-relative paths only; absolute-like paths are out-of-scope and wouldBlock in a future enforcement layer (not enforced now)
- Comparison rules in the draft must follow finalized semantics: normalize `\\` to `/` and normalize `.` / `..` for comparison
- Case-sensitive comparisons are required in the draft regardless of platform variance
- `roots[]` matching in the draft must be folder-boundary aware (prevent `/foo` matching `/foobar`)
- Symlink handling is explicitly deferred: no realpath resolution in Step 2 draft; design decision required before enforcement
- Default-deny posture in the draft: empty `roots[]` implies wouldBlock in enforcement design (not enforced now)
- Apply remains NO-OP, with no filesystem mutation and no vault-wide scan
- Any runtime wiring or enforcement enablement requires DECISION_REQUIRED before implementation

### Folder Intelligence (Preview-Only) Design Draft
- Purpose: folder-scoped diagnosis and reclassification suggestions to improve link quality and MOC organization, with no auto-apply
- Default Deny scope: operate only on an explicitly user-selected folder scope, never vault-wide
- Inputs: explicit folder root(s) and a bounded set of note snapshots already in memory, with no traversal beyond selected folder scope
- Outputs: diagnostics/suggestions only (cohesion score, clusters, outliers, suggested destination folders) with evidence sentences and a `검증 필요` flag
- Evidence policy alignment: evidence cap (`<= 3` lines) remains enforced only by `normalizeFolderReclassEvidenceLines` (no external truncation, no `maxLines` at call sites)
- Determinism note: no hidden randomness unless explicitly seeded; outputs should remain reviewable
- Preview UI expectation: proposed changes are presented via unified diff preview only; Apply remains NO-OP until explicit approval step
- No moves, renames, or writes in this draft; no background scanning
- Any runtime wiring, enforcement, or Apply enablement requires DECISION_REQUIRED before implementation

### PR3 Folder Reclassification (Sealed Invariants)
- Evidence cap (`<= 3` lines) is enforced only inside `normalizeFolderReclassEvidenceLines` (no external truncation paths)
- No `maxLines` argument is passed at call sites (`maxLines 전달 0`)
- Apply remains NO-OP (preview-only): no move/rename/write filesystem mutation
- Vault-wide scan is forbidden; operations remain explicitly scoped to selected folder/targets only
- Sorting and best-per-filePath selection behavior is sealed and must not change
- Score and confidence behavior is sealed and must not change
- Step 2 remains design prep only: default-deny scope object scaffolding, no runtime wiring, and no enforcement until path semantics are decided
- Any modification to these sealed invariants requires DECISION_REQUIRED (design review) before implementation
