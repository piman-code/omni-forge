# PR-2 Step1: Embedding Policy Draft

## 목적
- PR-2 Step1에서 임베딩 단위/갱신 조건/보안 경계를 명시한다.
- Step1은 정책 문서화만 수행하며, 구현 세부는 Step2+에서 적용한다.

## 청크 기준
- 청크 크기: `400~800` 토큰.
- 청크 오버랩: `10~15%`.
- chunking은 선택된 scope 입력에만 적용한다.
- vault-wide chunking/scan은 금지한다.

## 재임베딩 정책
- 문서/청크 해시를 비교해 변경된 청크만 재임베딩한다.
- 기본 식별자: `chunkHash` (예: `sha256(normalizedChunkText)`).
- `chunkHash`가 동일한 청크는 기존 임베딩을 재사용한다.
- 신규/변경/삭제 청크만 증분 반영한다.

## 보안 정책
- 기본값: `Cloud Off`, `allowNetwork=false`.
- 외부 전송 및 네트워크 호출(`fetch`, `http`, `https`) 금지.
- scope 외 경로 접근 금지, path traversal(`..`) 금지.

## 실패/폴백
- 임베딩 비활성/실패 시 즉시 keyword retrieval로 fallback.
- 상태값은 최소 `disabled | partial | error | ok`로 기록한다.

## 비범위
- PR-1 `src/pr1/types.ts` 직접 수정.
- 원격 임베딩 API 연동.
