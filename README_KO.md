# Auto-Linker (한국어)

언어: [English Guide](docs/USER_GUIDE_EN.md) | [한국어 가이드](docs/USER_GUIDE_KO.md)

Auto-Linker는 로컬 우선(Local-first) 원칙으로 만든 옵시디언 플러그인입니다.

주요 기능:
- 선택한 노트 범위만 AI 분석(`tags`, `topic`, `linked`, `index`)
- 선택 범위 기반 로컬 Q&A 채팅
- 속성(cleanup) 일괄 정리 + 백업 중심 안전 워크플로우

## 릴리즈 변경사항 (2026-02-15)

- `Local AI Chat (Selected Notes)` UI 전면 정돈(헤더/컨트롤/메시지 카드/소스 리스트/입력부).
- 채팅 `Sources`가 클릭 가능한 링크로 동작(해당 노트 즉시 열기).
- 채팅 저장 시 `scope_files`는 전체 선택 파일이 아닌 상위 검색 소스 중심으로 기록.
- `Cleanup dry-run report folder` 설정 추가.
- `Chat transcript folder path` 설정 추가.
- 채팅 스레드 자동 동기화 저장 기능 추가(동일 thread 노트 갱신).
- 왼쪽 리본 아이콘으로 채팅 패널 바로 열기 추가.
- 명령 팔레트의 중복 접두어(`Auto-Linker: Auto-Linker: ...`) 정리.

## 빠른 시작

1. BRAT으로 설치: `piman-code/auto-linker`
2. `설정 -> Auto-Linker` 열기
3. Provider/Model 설정 (로컬 사용은 `Ollama` 권장)
4. 명령 실행: `Select target notes/folders`
5. 명령 실행:
- `Analyze selected notes (suggestions by default)` 또는
- `Ask local AI from selected notes`

## 채팅 사용 흐름 (선택 노트 기반)

1. 채팅 열기:
- 좌측 리본 아이콘(`message-square`)
- 명령 팔레트 `Ask local AI from selected notes`
2. 분석/질의 대상 노트/폴더를 선택
3. 자연어로 질문
4. 응답의 소스 링크를 클릭해 원문 노트로 이동
5. `Open chat note` 버튼으로 현재 동기화된 스레드 노트 열기

스레드 저장 동작:
- 기본값은 자동 동기화(`Auto-sync chat thread = ON`)입니다.
- 스레드 단위로 markdown 파일이 생성/갱신됩니다.
- 대화가 추가될 때마다 같은 스레드 파일이 업데이트됩니다(중복 파일 난립 방지).

## 설정 창 사용법

Core AI:
- `Provider`
- `Ollama base URL`, `Ollama model`
- `Refresh Ollama model detection`

Semantic linking / 임베딩:
- `Enable semantic linking`
- `Embedding model` 및 감지 새로고침
- `Semantic top-k candidates`
- `Semantic min similarity`
- `Semantic source max chars`

Local Q&A:
- `Q&A Ollama base URL`
- `Q&A model`
- `Q&A retrieval top-k`
- `Q&A max context chars`
- `Chat transcript folder path`
- `Auto-sync chat thread` (권장: ON)
- `Allow non-local Q&A endpoint (danger)` (권장: OFF)

Property cleanup:
- `Cleanup exact keys`
- `Pick cleanup keys from selected notes`
- `Cleanup key prefixes`
- `Never remove these keys`
- `Cleanup dry-run report folder`

Backup / selection:
- `Include subfolders for selected folders`
- `Selection path width percent`
- `Backup selected notes before apply`
- `Backup root path`
- `Backup retention count`

MOC:
- `Generate MOC after apply`
- `MOC file path`

## 명령 목록

- `Select target notes/folders`
- `Analyze selected notes (suggestions by default)`
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

## 보안 원칙

- 기본은 로컬 우선(Ollama/LM Studio).
- Q&A endpoint 안전장치 기본 활성화(로컬호스트 권장).
- 채팅/리포트/백업 경로는 vault-relative 안전 검증을 거칩니다.
- 상세 정책은 `SECURITY.md`를 참고하세요.
