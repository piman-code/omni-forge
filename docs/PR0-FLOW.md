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

---

## 6) 2026-02-28 운영 요구사항 추가 (#omniforge)
아래 항목은 우선순위 높음(실사용 장애/품질 이슈)으로 즉시 반영 대상이다.

### 6-1) Agent/Orchestration 실행권한 강화
- Agent 모드에서 실제 파일 생성/수정/이동/삭제 실행이 가능해야 한다.
- Orchestration 모드에서도 동일하게 실행 가능해야 하며, 채팅 응답만으로 종료되면 안 된다.
- 로컬 권한 확대 요청/승인 플로우를 명확히 제공한다.

### 6-2) OAuth 기능 안정화 (OpenAI/Google)
- OAuth 흐름을 기본 경로로 우선 지원한다(API 키 강제 유도 금지).
- 사용자 개입이 필요한 값(Client ID, Redirect URI)은 설정창에서 명확히 안내한다.
- 런타임 오류(예: opener 함수 누락)와 모호한 실패 메시지를 제거한다.
- 로그인 탭/동선은 단순화하고, 실패 시 즉시 조치 가능한 문구를 제공한다.

### 6-3) 채팅 UI 개선
- 접힘/펼침 UI가 채팅 영역을 침범하지 않도록 레이아웃을 고정한다.
- 긴 대화에서도 상단 잘림/클리핑이 없어야 한다.
- 채팅창에는 최소 핵심 제어만 남기고, 고급 옵션은 설정창으로 이동한다.

### 6-4) 설정창 구조 정리 + 한글화
- 불필요/중복 항목을 제거하고 우선순위 중심으로 재배치한다.
- 한글 라벨/설명/오류 문구를 전수 점검해 깨짐/직역/혼용 문제를 수정한다.

### 6-5) 한글 파서 품질 및 링크 정확성
- HWP/PDF 파싱에서 한글/표 추출 품질을 개선한다.
- 링크/참조 연결 불량을 수정한다.
- 도구 미설치 시 바이너리 쓰레기 텍스트 출력 대신, 실패 원인+설치/조치 안내를 표시한다.
