# Auto Link (한국어)

언어: [English](README.md) | [한국어](README_KO.md)

Auto Link는 보안 기본값을 강하게 유지하면서, 선택한 노트 범위에서만 AI 메타데이터 분석과 로컬 Q&A를 수행하도록 설계된 Obsidian 플러그인입니다.

다음이 필요한 사용자에게 맞춰져 있습니다.
- 선택 범위 기반 AI 메타데이터 분석 (`tags`, `topic`, `linked`, `index`)
- 소스 링크와 진행 타임라인이 있는 로컬 노트 챗
- 백업/정리 중심의 안전한 일괄 작업

## 왜 Auto Link인가

일반적인 AI 노트 워크플로우는 보통 두 가지 문제가 있습니다.
- 범위가 너무 넓어 전체를 매번 재분석함
- 외부 전송이 기본이라 보안 통제가 약함

Auto Link는 반대로 동작합니다.
- 먼저 분석 대상(파일/폴더)을 명시적으로 선택
- 로컬 엔드포인트를 기본값으로 사용
- 채팅/리포트/백업 경로는 안전한 vault-relative 검증 수행

## 핵심 기능

- 선택 범위 분석(선택한 파일/폴더만)
- 제안 우선 워크플로우(미리보기 후 적용)
- 선택 노트 기반 로컬 AI 챗(markdown 렌더링)
- 장시간 생성 중 `Send/Stop` 제어 지원
- 출처 링크(`[[노트 경로]]`) 제공
- 검색/생성 진행 타임라인 카드
- 사용자 시스템 프롬프트 + 역할 프리셋(orchestrator/coder/debugger/architect/safeguard/ask)
- semantic 후보 랭킹(Ollama 임베딩)
- 대규모 선택 질문용 selection inventory 컨텍스트
- frontmatter 정리 규칙(cleanup)
- 백업/복구 워크플로우
- 현재 문서 자동 태깅(옵션, tags 전용)
- 선택 노트 기반 MOC 생성

## 보안 기본값

- Q&A 엔드포인트 기본값은 로컬(`127.0.0.1`/`localhost`)
- 명시적으로 허용하지 않으면 non-local Q&A 차단
- 다음 경로에 대해 vault-relative 안전성 검증:
  - 채팅 transcript 폴더
  - cleanup report 폴더
  - backup 루트
  - MOC 출력 경로
- 레거시 캐시 정리는 best-effort 방식으로 분리 처리

정책 상세는 [SECURITY.md](SECURITY.md)를 참고하세요.

## 설치

### A. BRAT 설치(권장)

1. Obsidian에 BRAT 설치
2. 플러그인 저장소 추가: `piman-code/auto-link`
3. **Auto Link** 활성화
4. 설정에서 초기 구성

### B. 수동 설치(릴리즈 파일)

1. 최신 GitHub Release에서 다음 파일 다운로드:
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. `.obsidian/plugins/auto-linker/` 경로에 배치
3. Obsidian 재시작 후 **Auto Link** 활성화

## 5분 빠른 시작

1. `설정 -> Auto Link` 열기
2. Provider/Model 선택
   - 로컬 우선 권장: `Ollama`
3. 명령 실행: `Select target notes/folders`
4. 명령 실행: `Analyze selected notes (suggestions by default)`
5. 제안 미리보기 확인 후 적용
6. (선택) `Ask local AI from selected notes` 실행

## 권장 설정

| 영역 | 설정 | 권장값 |
|---|---|---|
| 안전 | Allow non-local Q&A endpoint | OFF |
| Q&A | Prefer Ollama /api/chat (with fallback) | ON |
| Q&A | Structured answer guard | ON |
| Q&A | Always detailed answers | ON |
| Q&A | Preferred response language | 한국어 중심이면 Korean |
| Q&A | Include selection inventory | ON (대규모 선택 시) |
| Chat | Auto-sync chat thread | ON |
| 분석 | Analyze changed notes only | ON (대형 볼트 권장) |
| 감시 | Watch folders for new notes | Inbox 워크플로우면 ON |
| 자동 태깅 | Auto-tag active note | ON (선택, 태그 자동화) |
| 백업 | Backup selected notes before apply | ON |

## 성능 최적화 팁

선택 노트가 많거나 반복 분석이 잦다면:

- `Analyze changed notes only` 활성화
  - 캐시 시그니처 기반으로 변경 없는 노트 스킵
- `linked` 품질이 꼭 필요할 때만 semantic linking 사용
- 하드웨어에 맞게 `Semantic source max chars`, `Q&A max context chars` 조정
- watched folder + 증분 분석으로 전체 재스캔 최소화

## 신규 노트 감시 워크플로우

감시 폴더를 지정하면, 해당 폴더에 새 markdown 문서가 생길 때 다음 동작을 선택할 수 있습니다.
- 무시
- 현재 선택 대상에만 추가
- 선택에 추가하고 즉시 분석

수집형(inbox) 파이프라인에서 메타데이터 최신성을 유지하는 데 유리합니다.

## 명령 목록

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

## 문제 해결

- `No target notes selected`
  - 먼저 `Select target notes/folders`를 실행하세요.
- `Q&A endpoint blocked by security policy`
  - 로컬 엔드포인트를 사용하거나, 위험을 인지하고 non-local 허용을 켜세요.
- `Embedding model is not suitable`
  - 임베딩 가능한 모델로 변경 후 감지 새로고침을 실행하세요.
- 답변이 비어 있거나 너무 짧음
  - Structured answer guard + Always detailed 모드 + 최소 답변 길이 설정을 함께 점검하세요.
- 100개 이상 대규모 선택에서 근거가 부족하다고 나옴
  - selection inventory를 켜고, 하드웨어가 허용하면 Q&A max context chars를 올려보세요.

## 개인정보/보안 주의

- 로컬 모드에서는 노트 내용이 기본적으로 로컬에 머뭅니다.
- 클라우드 Provider를 사용하면 해당 Provider 정책이 적용됩니다.
- non-local endpoint 허용은 신뢰 경계를 이해한 경우에만 사용하세요.

## 개발

```bash
npm install
npm run release:check
```

관련 문서:
- [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md)
- [USER_GUIDE_KO.md](docs/USER_GUIDE_KO.md)
- [SECURITY.md](SECURITY.md)
- [RELEASE.md](RELEASE.md)
- [COMMUNITY_SUBMISSION_CHECKLIST.md](COMMUNITY_SUBMISSION_CHECKLIST.md)
