# OAuth 실행 런북 (KO)

## 목적
- Omni Forge에서 Google OAuth 로그인을 안정적으로 완료하고, 실패 원인을 즉시 식별한다.
- API 키 강제 없이 OAuth 우선 흐름으로 운영한다.

## 권장 설정 순서
1. `OAuth provider preset`을 `google`로 설정
2. `OAuth client ID` 입력
3. `OAuth redirect URI` 검증 (`Validate redirect URI` 버튼)
4. `Start OAuth Login` 실행
5. `OAuth session actions`에서 토큰 상태 확인

## 체크포인트
- `OAuth setup checklist`에서 아래 6개 항목을 확인:
  - preset
  - client ID
  - redirect URI
  - start login readiness
  - token status
  - transport 상태

## 성공 시 기대 결과
- 브라우저 인증 완료 후 Obsidian으로 복귀
- `OAuth session actions`에 아래가 표시:
  - `access token: present`
  - `refresh token: present` (공급자 정책에 따라 다를 수 있음)
  - `expiry: active ...`
  - `re-login: not required`

## 실패 케이스 가이드

### 1) Missing client ID
- 증상: `Missing required fields: client ID`
- 조치:
  - Google Cloud Console > Credentials > OAuth 2.0 Client ID 생성
  - `OAuth client ID` 필드에 입력 후 재시도

### 2) Redirect URI mismatch
- 증상: `redirect_uri_mismatch`
- 조치:
  - 플러그인 URI와 콘솔 등록 URI를 완전히 동일하게 맞춤
  - 권장값: `http://127.0.0.1:8765/callback`

### 3) Token exchange failure
- 증상: `OAuth token exchange failed: ...`
- 조치:
  - client ID, redirect URI 재확인
  - OAuth 동의화면/테스트 사용자 설정 확인
  - 만료된 authorization code 재사용 금지 (로그인 재시작)

### 4) Consent/Test user 이슈
- 증상: `access blocked`, `app not verified`, `not authorized to use this app`
- 조치:
  - OAuth consent screen 구성
  - 테스트 모드면 현재 계정을 Test users에 추가
  - 필요한 범위(scope) 최소화 후 재시도

### 5) OAuth transport mismatch
- 증상: Google OAuth + direct `api.openai.com` 조합에서 호출 실패
- 조치:
  - `OAuth bridge mode` 활성화
  - 또는 `Apply bridge defaults` 버튼 실행

## 운영 권장
- 기본: `Google preset + OAuth enabled + bridge mode`
- 장애 대응: 실패 메시지의 `Hint`를 우선 확인 후 필드/콘솔 설정 동기화
- 보안: 토큰 값 자체를 로그/문서에 출력하지 않음
