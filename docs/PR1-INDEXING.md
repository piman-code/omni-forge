# PR1 Indexing (Step B)

## 데이터 구조
- 저장 위치: `.omni-forge/pr1/index/<scopeId>.json`
- `ScopeIndexState`:
  - `scopeId`, `rootPath`, `updatedAt`
  - `files`: `vaultRelativePath -> StoredFileEntry`
  - `lastDiff`: `added/updated/deleted/moved/unchanged`
- `StoredFileEntry`:
  - `fileRef`(`fileId`, `scopeId`, `vaultRelativePath`)
  - `mtimeMs`, `size`, `checksum(sha256)`, `indexedAt`

## 증분 알고리즘
1. `ScopedVault.listFilesInScope(scopeRef)`로 scope roots 하위 파일 목록만 수집
2. 각 파일에 대해 우선 `(mtimeMs, size)`를 이전 인덱스와 비교
3. 동일하면 기존 `checksum` 재사용(파일 내용 재읽기 생략)
4. 다르면 파일 내용을 읽고 `sha256` 재계산
5. checksum 동일이면 `unchanged`, 다르면 `updated`

## 삭제/이동 처리
- `deleted`: 이전 인덱스에 있고 현재 스냅샷에 없는 path
- `added`: 현재 스냅샷에 있고 이전 인덱스에 없는 path
- `moved`: `added`/`deleted` 사이 checksum이 같은 항목을 매칭해 `fromPath -> toPath`로 기록
- 이동으로 매칭된 항목은 `added`/`deleted` 목록에서 제외

## 성능 제한
- vault-wide scan 금지: 루트(`rootPath + includePaths`)에서만 재귀 list
- 파일 해시 계산 최소화: `(mtimeMs,size)`가 같으면 hash 재계산 생략
- 기본 대상 확장자: `.md`만 인덱싱
- 저장은 `scopeId` 단위 파일 분리(namespace)로 I/O 범위 제한

## 안전 규칙
- 절대 경로(`/`, `C:\`) 차단
- `..` path traversal 차단
- null byte 경로 차단
- scope 외 경로 접근 시 `DEFAULT_DENY_SCOPE_VIOLATION`
- 잘못된 경로/식별자 입력 시 `CONTRACT_INVALID_PATH`

## Types change request
- 없음 (이번 Step B는 `src/pr1/types.ts` 변경 없이 구현)
