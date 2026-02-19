# PR-0 Security Audit (Scope/Path/Network)

## 감사 범위
- 대상: `/Users/piman/Documents/Vault/.obsidian/plugins/omni-forge/main.js`
- 목적: PR-0(Agent EDIT_NOTE 적용 플로우) 관점에서 위험 경로/우회 가능성 점검

## 키워드 스캔 결과

### 1) `getMarkdownFiles`
- 발견: `main.js:17065`
- 결론: 전역 스캔 유틸에 존재하나 PR-0 단일 적용 플로우(`applyPatchFlow`, `executeSelectionDiffAction`)에서는 호출하지 않음.

### 2) `vault.getFiles / vault.getAllLoadedFiles`
- 발견: `main.js:6560`, `main.js:10243`, `main.js:17068`
- 결론: 폴더 목록/설정 UI/선택 유틸 영역. PR-0 적용 플로우 경로와 분리됨.

### 3) `fetch(`, `https://`, `http://`
- 발견: 네트워크 호출/URL 문자열 다수 (`main.js:439`, `main.js:477`, `main.js:13548` 등)
- 결론:
  - 네트워크 코드 자체는 존재.
  - PR-0 적용 플로우(`applyPatchFlow`) 내부에서는 네트워크 호출이 없음.
  - 기본 정책은 `qaAllowNonLocalEndpoint: false` (`main.js:1465`)이며, 비로컬은 `validateQaEndpointPolicy`에서 차단(`main.js:11672`).

### 4) `raw.githubusercontent.com / api.github.com`
- 발견: 없음
- 결론: 직접 하드코딩 흔적 없음.

### 5) `eval / Function(`
- 발견: 없음
- 결론: 동적 코드 실행 흔적 없음.

### 6) path join에서 `..` 허용 여부
- 관련 발견: `nodePath.join(...)` 사용 지점 다수(파서/임시파일/유틸)
- PR-0 경로 검증 핵심:
  - `ScopedVault.normalizeVaultRelativePath`에서 절대경로/`..`/null-byte 차단 (`main.js:8931`~`main.js:8960`)
  - 스코프 밖 경로는 `DEFAULT_DENY_SCOPE_VIOLATION`으로 차단 (`main.js:8978`)
- 결론: PR-0 적용 플로우의 path 검증은 traversal/absolute path를 차단하도록 강화됨.

## PR-0 플로우 강제 점검 요약
- 단일 오케스트레이터: `applyPatchFlow` (`main.js:14802`)
- Preview-before-apply: 미리보기 승인 전 `editor.setValue` 호출 없음
- Confirm 활성 조건: `canApply = dryRun.ok && guard.ok`
- dry-run 기본 strict, fuzzy는 `allowFuzzy: true` 명시 opt-in
- FrontmatterGuard 선검증 + 재검증 후 적용
- audit JSONL: `APPLIED/REJECTED/CANCELED/FAILED` 기록 (`main.js:15307`)

## 결론
- PR-0 단일 적용 경로에 한정하면,
  - Default Deny + scope/path 검증,
  - Preview-before-apply,
  - unified diff 계약,
  - FrontmatterGuard,
  - 결과 로그
  가 코드상 강제되도록 보강됨.
- 저장소 전체에는 전역 스캔/네트워크 기능이 여전히 존재하므로, PR-0 범위 외 동작은 별도 정책(스프린트 2+)으로 추가 축소가 필요함.
