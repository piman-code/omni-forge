# Auto-Linker 사용자 가이드 (KO)

## 플러그인이 하는 일

Auto-Linker는 선택한 노트만 분석해 Obsidian 그래프에 유리한 메타데이터를 제안합니다.

관리 필드:

- `tags`
- `topic`
- `linked`
- `index`

## 기본 사용 순서

1. `Auto-Linker: Select target notes/folders` 실행
2. 파일/폴더 대상 선택
3. `Auto-Linker: Analyze selected notes (suggestions by default)` 실행
4. 백업 여부 확인(권장: 백업)
5. 미리보기에서 provider/model/시간/fallback 확인
6. 적용
7. 필요 시 백업 복구

## 선택 모달 팁

- **Files / Folders** 탭으로 전환해서 선택
- 필터로 빠르게 검색
- 파일명이 길면 **Path width** 슬라이더로 표시 너비 조절
- 폴더는 하위 폴더 포함 여부 선택 가능

## 진행 모달

분석/적용 중:

- 완료 또는 중지 전까지 모달이 계속 표시됩니다.
- 현재 파일, 진행 개수, 경과 시간, ETA를 표시합니다.
- `중지` 버튼으로 현재 파일 처리 후 안전 중단됩니다.
- 오류/활동 로그에서 `Show only errors` 필터를 사용할 수 있습니다.

## 백업/복구

- 분석 시작 전에 백업 확인 창이 표시됩니다.
- 백업 명령:
  - `Auto-Linker: Backup selected notes`
- 복구 명령:
  - `Auto-Linker: Restore from latest backup`
- `Backup retention count`로 최신 N개만 보관하도록 설정 가능

## Ollama 모델 탐지/선택

- 설정에서 감지 모델 새로고침 가능
- 드롭다운 라벨 의미:
  - `(추천)` 분석에 권장되는 모델
  - `(불가)` 분석에 부적합(임베딩/음성/리랭크 계열)
- 자동 추천 옵션을 켜면 현재 모델이 비었거나 없는 경우 권장 모델로 자동 설정

## 중요 설정

- `Provider`
- `Suggestion mode (recommended)`
- `Show reasons for each field`
- `Analyze tags/topic/linked/index`
- `Max tags`, `Max linked`
- `Excluded folder patterns`
- `Backup selected notes before apply`
- `Backup root path`
- `Backup retention count`
- `Generate MOC after apply`

## Frontmatter 안전 정책

기본 정책은 보수적입니다.

- 기존 메타데이터를 최대한 보존
- `tags`, `linked`는 기존 + 제안 병합(union)
- 미관리 속성은 기본적으로 유지
- `date created`, `date updated` 같은 linter 계열 날짜 키 보호

## 개발/릴리즈

```bash
npm install
npm run release:check
```

관련 문서:

- `SECURITY.md`
- `RELEASE.md`
- `COMMUNITY_SUBMISSION_CHECKLIST.md`
