# PR-0 Single Apply Flow (Agent Mode)

## 0) 현재 저장소 구조(Step 0)
- 확인 경로: `/Users/piman/Documents/Vault/.obsidian/plugins/omni-forge`
- 현재는 소스 트리(`src/*.ts`)가 아닌 배포 번들 중심 구조(`main.js`, `styles.css`, `manifest.json`, `versions.json`)다.
- PR-0 안정화는 번들 코드 내부에서 단일 플로우를 강제하는 방식으로 반영했다.

## 1) 단일 적용 오케스트레이터
- 진입점: `executeSelectionDiffAction` (`main.js:15283`)
- 단일 플로우: `applyPatchFlow(scope, patchPayload)` (`main.js:14802`)
- `EDIT_NOTE`에서 우회 경로 차단: `executeQaAgentAction` (`main.js:15569`, `main.js:15576`)

## 2) 강제 파이프라인
1. `validateSelectionDiffActionAgainstOpenSelection(...)` 계약 검증 (`main.js:12403`)
2. `ScopedVault.assertPathInScope(...)` 스코프/경로 검증 (`main.js:8931`, `main.js:14816`)
3. `applySelectionPatchWithPatchApplier(..., {allowFuzzy})` dry-run (`main.js:14684`, `main.js:14960`)
4. `runFrontmatterLintGuardAfterPatch(...)` guard 선검증 (`main.js:11545`, `main.js:14976`)
5. `PatchPreviewModal`에 `dryRunSummary`, `guardResult` 표시 (`main.js:2441`, `main.js:2511`)
6. `canApply = dryRun.ok && guard.ok`일 때만 Apply 활성 (`main.js:14992`, `main.js:2701`, `main.js:2712`)
7. 승인 후 최신 스냅샷 재검증 + apply + selection 갱신 (`main.js:15024`~`main.js:15274`)
8. 로컬 audit JSONL append (`main.js:11100`, `main.js:15307`)

## 3) 우회 금지 규칙
- `CURRENT_SELECTION` 헤더 + unified diff 계약 미준수 시 즉시 차단.
- path는 vault-relative 정규화 후 scope 밖 접근 즉시 차단.
- `EDIT_NOTE`에서 `write_note/append_note/delete_note/run_shell` 경로는 실행 단계에서 차단.
- Preview 승인 전 `editor.setValue(...)` 호출 없음.
- FrontmatterGuard 실패 시 적용 차단.
- fuzzy는 기본 비활성, `allowFuzzy: true` 명시 시에만 허용.

## 4) 에러 코드
- `DEFAULT_DENY_SCOPE_VIOLATION`
- `CONTRACT_INVALID_PATH`

## 5) 네트워크/클라우드 기본 정책
- 기본값은 non-local endpoint OFF: `qaAllowNonLocalEndpoint: false` (`main.js:1465`)
- 비로컬 endpoint는 `validateQaEndpointPolicy`에서 정책 검증 후 차단 (`main.js:11672`)
