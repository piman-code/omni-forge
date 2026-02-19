export const PR1_ERROR_CODES = {
  DEFAULT_DENY_SCOPE_VIOLATION: "DEFAULT_DENY_SCOPE_VIOLATION",
  CONTRACT_INVALID_PATH: "CONTRACT_INVALID_PATH",
  INDEX_NOT_READY: "INDEX_NOT_READY",
  INSUFFICIENT_CITATIONS: "INSUFFICIENT_CITATIONS",
} as const;

export type PR1ErrorCode = (typeof PR1_ERROR_CODES)[keyof typeof PR1_ERROR_CODES];

export interface LocalFirstPolicy {
  readonly defaultDeny: true;
  readonly folderScopedOnly: true;
  readonly prohibitVaultWideScan: true;
  readonly cloudMode: "Off";
  readonly allowNetwork: false;
  readonly requireCitations: true;
}

export interface ScopeRef {
  scopeId: string;
  rootPath: string;
  includePaths: string[];
  excludePaths?: string[];
  createdAt: string;
}

export interface FileRef {
  fileId: string;
  vaultRelativePath: string;
  scopeId: string;
  checksum?: string;
  modifiedAt?: number;
}

export interface ChunkRef {
  chunkId: string;
  fileRef: FileRef;
  ordinal: number;
  text: string;
  startOffset: number;
  endOffset: number;
  tokenCount?: number;
}

export interface EmbeddingRecord {
  embeddingId: string;
  chunkRef: ChunkRef;
  model: string;
  dimension: number;
  vector: number[];
  createdAt: string;
}

export interface RetrievalHit {
  hitId: string;
  chunkRef: ChunkRef;
  score: number;
  reason?: string;
}

export interface Citation {
  citationId: string;
  fileRef: FileRef;
  chunkRef: ChunkRef;
  quote: string;
}

export interface AnswerPolicyResult {
  isGrounded: boolean;
  violations: PR1ErrorCode[];
}

export interface AnswerDraft {
  draftId: string;
  question: string;
  answerMarkdown: string;
  citations: Citation[];
  unsupportedClaims: string[];
  policyResult: AnswerPolicyResult;
}

export interface IndexStatus {
  scopeId: string;
  ready: boolean;
  indexedFiles: number;
  indexedChunks: number;
  updatedAt?: string;
}

export interface RetrievalQuery {
  scopeRef: ScopeRef;
  question: string;
  topK: number;
}

export interface ComposeInput {
  scopeRef: ScopeRef;
  question: string;
  hits: RetrievalHit[];
  policy: LocalFirstPolicy;
}

export interface IScopedVault {
  assertPathInScope(scopeRef: ScopeRef, vaultRelativePath: string): Promise<FileRef>;
  listScopedFiles(scopeRef: ScopeRef): Promise<FileRef[]>;
  readFile(fileRef: FileRef): Promise<string>;
}

export interface IIndexer {
  ensureReady(scopeRef: ScopeRef): Promise<IndexStatus>;
  indexScope(scopeRef: ScopeRef): Promise<IndexStatus>;
  getStatus(scopeRef: ScopeRef): Promise<IndexStatus>;
}

export interface IChunker {
  chunkFile(fileRef: FileRef, content: string): ChunkRef[];
}

export interface IEmbedder {
  embed(chunks: ChunkRef[]): Promise<EmbeddingRecord[]>;
}

export interface IRetriever {
  retrieve(query: RetrievalQuery): Promise<RetrievalHit[]>;
}

export interface IAnswerComposer {
  compose(input: ComposeInput): Promise<AnswerDraft>;
  validateCitations(draft: AnswerDraft): AnswerPolicyResult;
}
