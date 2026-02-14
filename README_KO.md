# Auto-Linker (한국어)

언어: [English](README.md) | [한국어](README_KO.md)

Auto-Linker는 Obsidian 커뮤니티 플러그인입니다.
선택한 노트만 분석해서 지식 그래프에 유리한 메타데이터를 제안합니다.

## 핵심 기능

- 대상 선택: **파일 + 폴더**를 함께 선택 가능
- 폴더 선택 시 하위 폴더 포함 여부 설정 가능
- 다음 속성 제안:
  - `tags`
  - `topic`
  - `linked`
  - `index`
- `linked`는 볼트 내 실제 마크다운 파일만 유지
- 기본 동작은 제안 모드(미리보기 후 적용)
- 미리보기 상단에 실행 정보 표시:
  - provider
  - model
  - fallback 사용 개수
  - 총 소요시간
- 분석/적용 중 진행 알림(현재 n/N 처리)
- 적용 전 백업 + 최신 백업 복구 기능

## Frontmatter 동작 방식

관리 키는 아래 4개입니다.

- `tags`
- `topic`
- `linked`
- `index`

기본 병합 정책(안전 중심):

- 기존 메타데이터를 최대한 유지
- `tags`, `linked`는 기존 값 + 제안 값을 합쳐 중복 제거
- 알 수 없는 기존 속성은 기본적으로 유지
- Linter 계열 날짜 키(예: `date created`, `date updated`)는 보존

`Clean unknown frontmatter keys`를 켜면, 관리 키 외 속성은 정리되지만 날짜 보호 키는 남깁니다.

## 설정 방법 (중요)

### 1) 플러그인 설치/활성화

BRAT에서 아래 저장소로 설치:

- `piman-code/auto-linker`

### 2) 설정 화면 열기

- `설정 -> 커뮤니티 플러그인 -> Auto-Linker`

### 3) Provider 선택

로컬 우선 권장:

- `Ollama`
- `LM Studio`

클라우드:

- OpenAI/Codex 호환
- Claude
- Gemini

### 4) Ollama 자동 모델 탐지/추천

중요 설정:

- `Ollama base URL`
- `Ollama model`
- `Auto-pick recommended Ollama model`
- `Detected Ollama models -> Refresh`

자동 추천 방식:

1. 플러그인이 Ollama `GET /api/tags`로 설치 모델 목록 조회
2. 채팅/지시형 모델을 우선 점수화(embedding 전용 모델은 낮은 우선순위)
3. 현재 모델이 비어 있거나 설치 목록에 없으면 추천 모델 자동 설정
4. 시작 시(가능하면)와 분석 직전에 자동 점검

### 5) 분석 동작 설정

주요 토글:

- `Suggestion mode (recommended)`
- `Show reasons for each field`
- `Show progress notices`
- `Analyze tags/topic/linked/index`
- `Max tags`, `Max linked`

### 6) 선택/안전 설정

- `Include subfolders for selected folders`
- `Backup selected notes before apply`
- `Backup root path`

### 7) MOC 설정

- `Generate MOC after apply`
- `MOC file path`

## 명령어 목록

- `Auto-Linker: Select target notes/folders`
- `Auto-Linker: Analyze selected notes (suggestions by default)`
- `Auto-Linker: Clear selected target notes/folders`
- `Auto-Linker: Backup selected notes`
- `Auto-Linker: Restore from latest backup`
- `Auto-Linker: Refresh Ollama model detection`
- `Auto-Linker: Generate MOC from selected notes`

## 권장 사용 순서

1. 파일/폴더 대상 선택
2. 분석 실행
3. 미리보기에서 변경 내용/근거 확인
4. 적용
5. 필요 시 최신 백업 복구

## 개발/빌드

```bash
npm install
npm run build
npm run dev
```

## 릴리즈 점검

```bash
npm run release:check
```

추가 문서:

- 보안: `SECURITY.md`
- 릴리즈 절차: `RELEASE.md`
- 커뮤니티 제출 체크리스트: `COMMUNITY_SUBMISSION_CHECKLIST.md`
