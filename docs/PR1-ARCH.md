# PR-1 Architecture (Shared Contract)

## Goal
- Define a pre-module shared contract for PR-1 so index/chunk/embed/retrieve/compose flow can be implemented without interface drift.

## Security Baseline
- Local-first only.
- Folder-scoped only (Default Deny).
- Vault-wide scan is prohibited.
- Cloud is OFF by default in PR-1 (no network call, no external transmission).
- Answer output must be citation-grounded. Unsupported claims are rejected.

## Core Data Contracts
- `ScopeRef`: selected scope metadata.
- `FileRef`: vault-relative file reference validated by scope.
- `ChunkRef`: normalized chunk unit derived from a file.
- `EmbeddingRecord`: vector record mapped to `ChunkRef`.
- `RetrievalHit`: ranked retrieval result with score and evidence.
- `Citation`: answer evidence pointer (`file + chunk + quote`).
- `AnswerDraft`: composed answer + citation validation result.

## Service Interfaces
- `IScopedVault`: validates path/scope and provides scoped file reads.
- `IIndexer`: builds and serves scoped index status/records.
- `IChunker`: turns `FileRef` content into `ChunkRef[]`.
- `IEmbedder`: creates vectors for chunks and returns `EmbeddingRecord[]`.
- `IRetriever`: returns ranked `RetrievalHit[]` for a query/scope.
- `IAnswerComposer`: composes grounded answer and enforces citation policy.

## Error Codes
- `DEFAULT_DENY_SCOPE_VIOLATION`
- `CONTRACT_INVALID_PATH`
- `INDEX_NOT_READY`
- `INSUFFICIENT_CITATIONS`

## Retrieval-to-Answer Policy
1. Query runs only inside explicit `ScopeRef`.
2. Retriever returns `RetrievalHit[]` with `ChunkRef`.
3. Composer creates `AnswerDraft` with `citations`.
4. If citations are missing for required claims, composer returns/throws `INSUFFICIENT_CITATIONS`.

## Export Surface
- `src/pr1/types.ts`: all shared contracts and error code constants.
- `src/pr1/index.ts`: single PR-1 public export entry.
