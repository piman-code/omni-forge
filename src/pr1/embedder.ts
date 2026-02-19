import type { ChunkRef, EmbeddingRecord, IEmbedder } from "./types.ts";

export const EMBEDDER_ERROR_CODES = {
  DISABLED: "EMBEDDING_DISABLED",
  NOT_IMPLEMENTED: "EMBEDDING_NOT_IMPLEMENTED",
  EMPTY_INPUT: "EMBEDDING_EMPTY_INPUT",
} as const;

export type EmbedderErrorCode = (typeof EMBEDDER_ERROR_CODES)[keyof typeof EMBEDDER_ERROR_CODES];

export type EmbedderStatus = "ok" | "disabled" | "partial" | "error";

export interface EmbedderOptions {
  enabled?: boolean;
  model?: string;
  dimension?: number;
  now?: () => string;
}

export interface EmbedResult {
  status: EmbedderStatus;
  isEnabled: boolean;
  records: EmbeddingRecord[];
  cacheHits: number;
  cacheWrites: number;
  fallbackMode: "none" | "keyword-only";
  errorCode?: EmbedderErrorCode;
  errorMessage?: string;
}

interface CacheEntry {
  chunkId: string;
  record: EmbeddingRecord;
}

const DEFAULT_MODEL = "local-disabled";
const DEFAULT_DIMENSION = 0;

function toSafeModelName(value?: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : DEFAULT_MODEL;
}

function toNonNegativeInt(value?: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const n = Math.floor(value as number);
  return n >= 0 ? n : fallback;
}

function makeEmbeddingId(model: string, chunk: ChunkRef): string {
  return `${model}:${chunk.chunkId}`;
}

export class LocalEmbedderScaffold implements IEmbedder {
  private enabled: boolean;
  private model: string;
  private dimension: number;
  private readonly now: () => string;
  private readonly cache = new Map<string, CacheEntry>();
  private lastResult: EmbedResult | null = null;

  constructor(options: EmbedderOptions = {}) {
    this.enabled = Boolean(options.enabled);
    this.model = toSafeModelName(options.model);
    this.dimension = toNonNegativeInt(options.dimension, DEFAULT_DIMENSION);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  setModel(model: string): void {
    this.model = toSafeModelName(model);
  }

  getModel(): string {
    return this.model;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheRecord(chunkId: string): EmbeddingRecord | undefined {
    return this.cache.get(chunkId)?.record;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getLastResult(): EmbedResult | null {
    return this.lastResult;
  }

  async embed(chunks: ChunkRef[]): Promise<EmbeddingRecord[]> {
    const result = await this.embedChunks(chunks);
    return result.records;
  }

  async embedChunks(chunks: ChunkRef[]): Promise<EmbedResult> {
    const source = Array.isArray(chunks) ? chunks : [];
    if (source.length === 0) {
      const emptyResult: EmbedResult = {
        status: "ok",
        isEnabled: this.enabled,
        records: [],
        cacheHits: 0,
        cacheWrites: 0,
        fallbackMode: "none",
        errorCode: EMBEDDER_ERROR_CODES.EMPTY_INPUT,
        errorMessage: "No chunks provided.",
      };
      this.lastResult = emptyResult;
      return emptyResult;
    }

    const cachedRecords: EmbeddingRecord[] = [];
    const missingChunks: ChunkRef[] = [];
    let cacheHits = 0;

    for (const chunk of source) {
      const cached = this.cache.get(chunk.chunkId)?.record;
      if (cached) {
        cachedRecords.push(cached);
        cacheHits += 1;
        continue;
      }
      missingChunks.push(chunk);
    }

    if (!this.enabled) {
      const disabledResult: EmbedResult = {
        status: cachedRecords.length > 0 ? "partial" : "disabled",
        isEnabled: false,
        records: cachedRecords,
        cacheHits,
        cacheWrites: 0,
        fallbackMode: "keyword-only",
        errorCode: EMBEDDER_ERROR_CODES.DISABLED,
        errorMessage: "Embedding is disabled. Use keyword fallback retrieval.",
      };
      this.lastResult = disabledResult;
      return disabledResult;
    }

    const generatedRecords: EmbeddingRecord[] = [];

    for (const chunk of missingChunks) {
      const vector = this.generateVector(chunk);
      if (!vector) {
        continue;
      }
      const record: EmbeddingRecord = {
        embeddingId: makeEmbeddingId(this.model, chunk),
        chunkRef: chunk,
        model: this.model,
        dimension: vector.length,
        vector,
        createdAt: this.now(),
      };
      this.cache.set(chunk.chunkId, { chunkId: chunk.chunkId, record });
      generatedRecords.push(record);
    }

    const allRecords = [...cachedRecords, ...generatedRecords];
    const unresolvedCount = source.length - allRecords.length;

    const result: EmbedResult = {
      status: unresolvedCount > 0 ? (allRecords.length > 0 ? "partial" : "error") : "ok",
      isEnabled: true,
      records: allRecords,
      cacheHits,
      cacheWrites: generatedRecords.length,
      fallbackMode: unresolvedCount > 0 ? "keyword-only" : "none",
      errorCode: unresolvedCount > 0 ? EMBEDDER_ERROR_CODES.NOT_IMPLEMENTED : undefined,
      errorMessage:
        unresolvedCount > 0
          ? `Embedding generator scaffold is not implemented for ${unresolvedCount} chunk(s).`
          : undefined,
    };

    this.lastResult = result;
    return result;
  }

  private generateVector(_chunk: ChunkRef): number[] | null {
    void _chunk;
    // TODO(PR1-StepC): connect local embedding engine (no network) and return numeric vectors.
    return null;
  }
}
