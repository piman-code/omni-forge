# PR-2: Vector Store Specification (v1.0 Draft)

## 목적
- PR-2 벡터 저장소를 로컬 파일 기반으로 설계한다.
- PR-1/보안 철학(Default Deny, scope 제한)과 정합되는 저장/조회 규칙을 정의한다.

## 격리 단위 (scopeRoot + scopeId)
- 저장 단위는 `(scopeRoot, scopeId)` 조합이다.
- `scopeRoot`는 선택된 루트 경로이며, 모든 문서 경로(`docPath`)는 해당 root 기준 상대 경로여야 한다.
- `scopeId`는 같은 `scopeRoot` 내부의 논리 네임스페이스로 사용한다.
- 서로 다른 `(scopeRoot, scopeId)` 간 레코드 혼합 조회/갱신은 금지한다 (Default Deny 정합).

## 저장 매체 및 전송 정책
- 저장소는 로컬 파일(`.jsonl`, `.meta.json`)만 사용한다.
- 벡터 데이터 생성/적재/조회 과정에서 네트워크 호출(`fetch`, `http/https`)을 금지한다.
- Cloud 모드는 기본 `Off`이며, PR-2 VectorStore 범위에서는 클라우드 전송을 지원하지 않는다.

## 파일 구조
- 레코드 파일: `<scopeRoot>/.omni-forge/pr2/vector/<scopeId>.jsonl`
- 메타 파일: `<scopeRoot>/.omni-forge/pr2/vector/<scopeId>.meta.json`

## 메타 파일/헤더 스키마
- 메타 파일은 최소 아래 필드를 포함한다.
  - `schemaVersion`
  - `embedDim`
  - `engineId`
  - `createdAt`
  - `lastCompactionAt`
- `schemaVersion`, `embedDim`, `engineId` 불일치 시 읽기/쓰기 중단(호환성 오류)한다.

예시:
```json
{
  "schemaVersion": 1,
  "embedDim": 768,
  "engineId": "local-embedder-v1",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "lastCompactionAt": "2026-02-19T12:00:00.000Z"
}
```

## JSONL 레코드 포맷
- 한 줄은 하나의 chunk 상태를 나타낸다.
- 레코드 키(식별자 역할):
  - `scopeId`
  - `docPath` (normalized)
  - `chunkId`
  - `chunkHash`
- 레코드 값:
  - `vector`
  - `dim`
  - `engineId`
  - `updatedAt`
  - `tokenCount` (선택)
- 운영 플래그:
  - `tombstone` (`true`면 삭제 상태)

예시(활성 레코드):
```json
{"scopeId":"scope-a","docPath":"notes/project/a.md","chunkId":"scope-a:notes/project/a.md:3","chunkHash":"sha256:ab12...","vector":[0.12,0.02,0.44],"dim":3,"engineId":"local-embedder-v1","updatedAt":"2026-02-19T12:10:00.000Z","tokenCount":182,"tombstone":false}
```

예시(삭제 tombstone):
```json
{"scopeId":"scope-a","docPath":"notes/project/a.md","chunkId":"scope-a:notes/project/a.md:3","chunkHash":"sha256:ab12...","vector":[],"dim":0,"engineId":"local-embedder-v1","updatedAt":"2026-02-19T13:00:00.000Z","tombstone":true}
```

## 삭제 전략 (tombstone)
- 물리 삭제 대신 tombstone 레코드를 append 한다.
- 최신 레코드 우선 규칙:
  - 동일 `(scopeId, docPath, chunkId)` 키의 마지막 레코드가 유효 상태를 결정한다.
- 조회 시 `tombstone=true`인 최신 상태는 비활성으로 간주한다.

## Compaction 전략
- 목적: tombstone/중복 상태 정리 및 파일 크기 제어.
- 범위: 반드시 단일 `scopeId` 파일 내에서만 실행한다.
- 주기:
  - 기본 주기: 24시간
- 트리거:
  - tombstone 비율 30% 이상
  - 또는 레코드 파일 크기 64MB 초과
  - 또는 마지막 compaction 이후 10,000 append 초과
- 결과:
  - 최신 상태만 남긴 새 JSONL로 원자적 교체
  - 메타 파일의 `lastCompactionAt` 갱신

## 안전 규칙
- 모든 입력 경로는 normalize 후 사용한다 (`\` -> `/`, 중복 슬래시/`.` 제거).
- 절대경로(`/`, `C:\` 등), `..` traversal, null byte 포함 경로는 즉시 거부한다.
- `docPath`는 반드시 `scopeRoot` 내부 상대 경로여야 한다.
- scope roots 외 경로 접근은 금지한다.
- vault-wide scan은 금지하며, 호출자는 명시된 scope roots 내 파일만 전달해야 한다.

## 비범위
- 실제 임베딩 엔진 연결/성능 튜닝은 후속 단계에서 다룬다.
