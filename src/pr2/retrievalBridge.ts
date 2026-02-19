import { LocalEmbeddingEngine } from "./embeddingEngine.ts";
import { JsonlVectorStore, type VectorRecord } from "./vectorStore.ts";

export type RetrievalHit = {
  docPath: string;
  chunkId: string;
  chunkHash: string;
  score: number;
  tokenCount?: number;
};

export type RetrievalInput = {
  scopeRoot: string;
  scopeId: string;
  engineId: string;
  query: string;
  topK: number;
  embedding?: {
    dimension?: number;
    seed?: number;
  };
};

export type RetrievalOutput = {
  hits: RetrievalHit[];
  mode: "EMBEDDING_ACTIVE" | "EMBEDDING_FALLBACK_KEYWORD";
  aborted?: boolean;
  abortReason?: string;
};

const DEFAULT_TOP_K = 5;
const MIN_TOP_K = 1;
const MAX_TOP_K = 50;

function clampTopK(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TOP_K;
  }
  const n = Math.floor(value);
  if (n < MIN_TOP_K) {
    return MIN_TOP_K;
  }
  if (n > MAX_TOP_K) {
    return MAX_TOP_K;
  }
  return n;
}

function toAbortReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function logicalKey(record: VectorRecord): string {
  return `${record.scopeId}::${record.docPath}::${record.chunkId}`;
}

function isFiniteVector(vector: number[], dim: number): boolean {
  if (!Array.isArray(vector) || vector.length !== dim) {
    return false;
  }
  return vector.every((value) => typeof value === "number" && Number.isFinite(value));
}

function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }

  if (aNorm <= 0 || bNorm <= 0) {
    return null;
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

// Security guard:
// - No network call in this module.
// - scope/path validation is delegated to JsonlVectorStore.
export async function retrieveByVector(input: RetrievalInput): Promise<RetrievalOutput> {
  const embeddingEngine = new LocalEmbeddingEngine(input.embedding ?? {});
  const embedDim = embeddingEngine.getDimension();

  let queryVector: number[];
  try {
    queryVector = embeddingEngine.embed(input.query).vector;
  } catch (error) {
    return {
      hits: [],
      mode: "EMBEDDING_FALLBACK_KEYWORD",
      aborted: true,
      abortReason: `embedding failed: ${toAbortReason(error)}`,
    };
  }

  try {
    const vectorStore = new JsonlVectorStore({
      scopeRoot: input.scopeRoot,
      scopeId: input.scopeId,
      embedDim,
      engineId: input.engineId,
    });

    await vectorStore.ensureInitialized();
    const records = await vectorStore.readAll();

    const latestByKey = new Map<string, VectorRecord>();
    for (const record of records) {
      latestByKey.set(logicalKey(record), record);
    }

    // Collect doc-level tombstones
    const tombstonedDocs = new Set<string>();
    for (const record of latestByKey.values()) {
      if (
        record.tombstone &&
        typeof record.chunkId === "string" &&
        record.chunkId.startsWith("__doc__:")
      ) {
        tombstonedDocs.add(record.docPath);
      }
    }

    const scored: Array<{ record: VectorRecord; score: number }> = [];
    for (const record of latestByKey.values()) {
      if (record.tombstone) {
        continue;
      }
      if (tombstonedDocs.has(record.docPath)) {
        continue;
      }
      const score = cosineSimilarity(queryVector, record.vector);
      if (score === null || !Number.isFinite(score)) {
        continue;
      }
      scored.push({ record, score: Number(score.toFixed(6)) });
    }

    const topK = clampTopK(input.topK);
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.record.docPath.localeCompare(b.record.docPath) ||
        a.record.chunkId.localeCompare(b.record.chunkId),
    );

    const hits: RetrievalHit[] = scored.slice(0, topK).map(({ record, score }) => ({
      docPath: record.docPath,
      chunkId: record.chunkId,
      chunkHash: record.chunkHash,
      score,
      tokenCount: record.tokenCount,
    }));

    return {
      hits,
      mode: "EMBEDDING_ACTIVE",
    };
  } catch (error) {
    return {
      hits: [],
      mode: "EMBEDDING_ACTIVE",
      aborted: true,
      abortReason: toAbortReason(error),
    };
  }
}
