# Auto-Linker (한국어)

Auto-Linker는 Obsidian 커뮤니티 플러그인입니다.  
선택한 노트만 분석해서 `tags`, `topic`, `linked`, `index`를 제안하고, 그래프 기반 지식 관리를 돕습니다.

## 무엇을 하나요?

- 전체 볼트가 아니라, 내가 고른 노트만 분석합니다.
- `tags`, `topic`, `linked`, `index`를 AI가 제안합니다.
- `linked`는 실제 볼트에 존재하는 마크다운 파일만 남기도록 검증합니다.
- 기본 동작은 자동 적용이 아니라 `제안 -> 미리보기 -> 승인 적용`입니다.
- 선택 노트 기반 MOC 파일을 생성할 수 있습니다.

## Frontmatter 정책

관리하는 키는 다음 4개입니다.

- `tags`
- `topic`
- `linked`
- `index`

설정에서 **Clean unknown frontmatter keys**를 켜면, 위 4개 외 속성은 적용 시 정리됩니다.

## 지원 AI Provider

로컬 우선:

- Ollama
- LM Studio (OpenAI 호환 엔드포인트)

확장 Provider:

- OpenAI / Codex 호환
- Anthropic Claude
- Google Gemini

Provider 호출이 실패하면, 워크플로가 멈추지 않도록 로컬 휴리스틱 fallback이 동작합니다.

## Obsidian에서 사용 방법 (초보용)

1. 명령 팔레트에서 `Auto-Linker: Select target notes` 실행
2. 분석할 노트 선택 후 저장
3. `Auto-Linker: Analyze selected notes (suggestions by default)` 실행
4. 제안 미리보기에서 변경 전/후 및 이유 확인
5. `Apply changes`로 반영
6. 필요하면 `Auto-Linker: Generate MOC from selected notes` 실행

## BRAT으로 설치/업데이트 (사용자 입장)

1. Obsidian에서 BRAT 플러그인 실행
2. `Add Beta Plugin` 선택
3. 저장소 입력: `piman-code/auto-linker`
4. 설치 또는 업데이트 실행

## 개발/빌드

```bash
npm install
npm run build
```

개발 감시 모드:

```bash
npm run dev
```

## 릴리즈 전 점검

```bash
npm run release:check
```

위 명령은 아래를 한 번에 실행합니다.

- 타입 검사
- 빌드
- 보안 점검(시크릿/개인경로/런타임 파일)

추가 문서:

- 보안: `SECURITY.md`
- 릴리즈 절차: `RELEASE.md`
- 커뮤니티 제출 체크리스트: `COMMUNITY_SUBMISSION_CHECKLIST.md`
