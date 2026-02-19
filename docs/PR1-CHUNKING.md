# PR1 Chunking + Embedder Scaffold

## 목적
- PR1 Step C에서 Markdown chunker와 embedder의 최소 실행 골격을 제공한다.
- 기본 정책은 로컬 우선이며 Cloud OFF, 네트워크 호출 금지다.

## 분할 전략
- 입력: `fileRef`, `markdown text`
- 출력: `ChunkRef[]`
- 1차 분할: Markdown 헤더 `#`, `##`, `###` 기준 섹션 분할
- 2차 분할: 섹션 본문이 `maxChars`를 넘으면 추가 분할
- 분할 결과는 원문 기준 `startOffset`, `endOffset`를 채운다.
- `chunkId`는 `fileId + ordinal + offset-range` 기반으로 생성한다.

## Frontmatter 처리 정책
- 파일 시작부의 YAML frontmatter(`--- ... ---`)는 기본적으로 본문 chunk에 포함하지 않는다.
- chunker는 frontmatter를 별도 메타(`fileId -> frontmatter segment`)로 보관한다.
- 필요 시 옵션(`includeFrontmatterChunk=true`)으로 frontmatter를 별도 chunk로 포함할 수 있다.
- 이 정책은 본문 검색/인덱싱에서 frontmatter 노이즈를 줄이기 위한 기본값이다.

## 코드블록 정책
- fenced code block(```` ) 내부에서는 분할을 피한다.
- chunk 길이가 `maxChars`를 넘더라도 코드블록 내부는 닫는 fence까지 유지한다.
- 코드블록 시작 전 길이 초과가 예상되면 fence 시작 이전에서 chunk를 종료한다.

## 길이 제한 정책
- 기본 `maxChars`: 3600
- 최소 허용 `maxChars`: 512 (이하 값은 512로 보정)
- 매우 긴 단일 라인/코드블록은 예외적으로 chunk 길이가 `maxChars`를 초과할 수 있다.

## Heading/메타 보존
- `ChunkRef` 계약에는 `heading` 필드가 없으므로, chunker 내부 사이드카 메타(`chunkId -> heading`)로 관리한다.
- 각 chunk는 `sectionOrdinal`, `sectionChunkOrdinal`, `containsCodeFence`를 추가 메타로 제공한다.

## Embedder Scaffold 구조
- `LocalEmbedderScaffold`는 `IEmbedder`를 구현한다.
- 기본값: `isEnabled() = false`
- `embedChunks(chunks)` 결과에 다음 상태를 명확히 포함한다.
  - `status`: `disabled | error | partial | ok`
  - `errorCode`: `EMBEDDING_DISABLED | EMBEDDING_NOT_IMPLEMENTED | EMBEDDING_EMPTY_INPUT`
  - `fallbackMode`: `keyword-only | none`
- 캐시 구조: `Map<chunkId, EmbeddingRecord>`
- 현재 Step C에서는 vector 생성기를 TODO로 유지하며, 누락 chunk가 있으면 retriever가 keyword fallback으로 전환할 수 있도록 신호를 제공한다.

## 향후 확장 포인트
- `generateVector()`에 로컬 임베딩 엔진 연결 (네트워크 금지 유지)
- 캐시 영속화(파일 기반 스냅샷) 추가
- chunk 메타(sidecar)와 인덱서 저장 포맷 연동
