# Omni Forge (한국어)

언어: [English](README.md) | [한국어](README_KO.md)

Omni Forge는 보안 기본값을 강하게 유지하면서, 선택한 노트 범위에서만 AI 메타데이터 분석과 로컬 Q&A를 수행하도록 설계된 Obsidian 플러그인입니다.

다음이 필요한 사용자에게 맞춰져 있습니다.
- 선택 범위 기반 AI 메타데이터 분석 (`tags`, `topic`, `linked`, `index`)
- 소스 링크와 진행 타임라인이 있는 로컬 노트 챗
- 백업/정리 중심의 안전한 일괄 작업

## 왜 Omni Forge인가

일반적인 AI 노트 워크플로우는 보통 두 가지 문제가 있습니다.
- 범위가 너무 넓어 전체를 매번 재분석함
- 외부 전송이 기본이라 보안 통제가 약함

Omni Forge는 반대로 동작합니다.
- 먼저 분석 대상(파일/폴더)을 명시적으로 선택
- 로컬 엔드포인트를 기본값으로 사용
- 채팅/리포트/백업 경로는 안전한 vault-relative 검증 수행

## 핵심 기능

- 선택 범위 분석(선택한 파일/폴더만)
- 제안 우선 워크플로우(미리보기 후 적용)
- 선택 노트 기반 로컬 AI 챗(markdown 렌더링)
- 첨부 기반 채팅 지원(드래그/업로드/붙여넣기, 최대 10개, 이미지 미리보기)
- 선택 노트가 없어도 일반 대화 가능(첨부 우선 근거 모드 지원)
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

신뢰 경계를 검토하지 않은 non-local endpoint는 기본값(비활성) 유지가 안전합니다.

## 설치

### A. BRAT 설치(권장)

1. Obsidian에 BRAT 설치
2. 플러그인 저장소 추가: `piman-code/omni-forge`
3. **Omni Forge** 활성화
4. 설정에서 초기 구성

### B. 수동 설치(릴리즈 파일)

1. 최신 GitHub Release에서 다음 파일 다운로드:
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. `.obsidian/plugins/omni-forge/` 경로에 배치
3. Obsidian 재시작 후 **Omni Forge** 활성화

## 5분 빠른 시작

1. `설정 -> Omni Forge` 열기
   - `Settings view mode`를 `Simple / 간결`로 두면 핵심 항목만 깔끔하게 볼 수 있습니다.
   - 필요할 때만 `Open Full / 전체 열기`로 고급 항목을 펼치세요.
   - 상단 탭(`Quick/Models/Chat/Workflow/Advanced`)으로 설정 영역을 분리해 볼 수 있습니다.
2. Provider/Model 선택
   - 로컬 우선 권장: `Ollama`
3. `One-click local presets`에서 기본은 `Balanced` 권장
4. 명령 실행: `Select target notes/folders`
5. 명령 실행: `Analyze selected notes (suggestions by default)`
6. 제안 미리보기 확인 후 적용
7. (선택) `Ask local AI from selected notes` 실행

## 권장 설정

| 영역 | 설정 | 권장값 |
|---|---|---|
| UI | Settings view mode | Simple (평소), Full (고급 조정 시) |
| UI | Settings UI language | KO (기본), 필요 시 EN/Bilingual |
| UI | One-click local presets | Balanced 기본, Fast/Quality+는 목적별 선택 |
| 안전 | Allow non-local Q&A endpoint | OFF |
| Q&A | Prefer Ollama /api/chat (with fallback) | ON |
| Q&A | Structured answer guard | ON |
| Q&A | Always detailed answers | ON |
| Q&A | Preferred response language | 한국어 중심이면 Korean |
| Q&A | Include selection inventory | ON (대규모 선택 시) |
| Chat | Auto-sync chat thread | ON |
| Chat | Allow PDF attachments in chat (experimental) | 필요 시 ON (정확도 향상을 위해 PDF 변환본 병행 권장) |
| 분석 | Analyze changed notes only | ON (대형 볼트 권장) |
| 감시 | Watch folders for new notes | Inbox 워크플로우면 ON |
| 자동 태깅 | Auto-tag active note | ON (선택, 태그 자동화) |
| 백업 | Backup selected notes before apply | ON |

## Ollama Agent 모델 가이드 (M4 Pro 48GB)

현재 Omni Forge의 로컬 Q&A는 노트 RAG + 첨부 문서/이미지 기반 흐름입니다.
채팅 UI는 Ollama `/api/chat`, `/api/generate`를 사용하며, 이미지 첨부가 있으면 비전 모델 우선으로 `/api/generate` 경로를 사용합니다.

| Agent 역할 | 기본 권장 모델 | 경량 대안 | 메모 |
|---|---|---|---|
| Orchestrator + Architect | `qwen3:14b` | `qwen3:8b` | 계획/설계형 구조화 답변 품질과 속도의 균형이 좋습니다. |
| Coder + Debugger | `qwen3-coder:30b` | `qwen3:14b` | 코딩 품질 우선이면 `qwen3-coder`, 동시 에이전트가 많으면 `qwen3:14b` 권장. |
| Ask (일반 Q&A) | `gpt-oss:20b` | `qwen3:8b` | 범용 비서 성향이 안정적이며, 대안은 더 빠르고 가볍습니다. |
| Safeguard (보안/사실 점검) | `gpt-oss-safeguard:20b` | `llama-guard3:8b` | 전용 안전 모델 우선, 메모리 압박 시 guard 모델 사용. |
| Vision 사이드카(선택) | `gemma3:12b` 또는 `llama3.2-vision:11b` | `gemma3:4b` | 향후 이미지 입력 확장을 대비한 사이드카 용도. 현재 플러그인 채팅은 텍스트 전용. |

48GB 통합 메모리에서 Agent 4개를 동시에 돌릴 때는 8B/14B 위주로 시작하고, 20B+ 모델은 한 번에 1개만 활성화하는 구성이 안정적입니다.

이미지 생성 관련:
- Ollama는 실험적 Images API 경로(예: `gpt-image-1`)를 제공하지만, 본 플러그인 채팅에는 아직 이미지 생성 파이프라인이 연결되어 있지 않습니다.
- 실사용 이미지 생성 워크플로우는 ComfyUI/Stable Diffusion 같은 별도 스택을 함께 쓰는 경우가 많습니다.

공식 참고 링크:
- [Qwen3](https://ollama.com/library/qwen3)
- [Qwen3-Coder](https://ollama.com/library/qwen3-coder)
- [GPT-OSS](https://ollama.com/library/gpt-oss)
- [GPT-OSS-Safeguard](https://ollama.com/library/gpt-oss-safeguard)
- [Llama Guard 3](https://ollama.com/library/llama-guard3)
- [Gemma 3](https://ollama.com/library/gemma3)
- [Llama 3.2 Vision](https://ollama.com/library/llama3.2-vision)
- [Ollama Vision 문서](https://docs.ollama.com/capabilities/vision)
- [Ollama 이미지 생성 업데이트](https://ollama.com/blog/image-generation)

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

관련 문서:
- [README.md](README.md)

- [docs/oauth-hwp-e2e-checklist.md](docs/oauth-hwp-e2e-checklist.md)

## OAuth / HWP Update Notes

### OAuth (Google)
- `Google OAuth Login` / `Google quick preset` now auto-applies:
  - `provider=openai`
  - `qaChatModelFamily=cloud`
  - `qaChatModelProfile=codex`
  - Google OAuth preset URLs + `oauthEnabled=true`
- Required fields are validated with actionable guidance:
  - auth URL
  - token URL
  - client ID
  - redirect URI
- `OAuth endpoint compatibility` row now highlights transport mismatch and offers `Apply bridge defaults`.
  - helper default bridge URL: `http://127.0.0.1:8787/v1`
- OAuth status text now shows token presence and expiry state in user-friendly form (without exposing token values).

### HWP ingest
- `.hwp` auto route requires LibreOffice `soffice` (`hwp -> pdf -> parser`).
- `.hwpx` uses XML first-pass extraction with guided fallback.
- Parser output format is configurable:
  - `md`: chat-ready markdown
  - `xml`: structured metadata + content

### Common failure guidance
- `Missing required fields: client ID`
  - Fill `OAuth client ID` in Cloud provider config.
- `redirect_uri_mismatch`
  - Register `http://127.0.0.1:8765/callback` in provider console.
- `OAuth transport mismatch`
  - Enable `OAuth bridge mode` or click `Apply bridge defaults`.
- `soffice missing`
  - Install LibreOffice and make `soffice` discoverable in PATH.
