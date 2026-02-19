import type {
  ChunkRef,
  EmbeddingRecord,
  RetrievalHit,
} from "./types.ts";

export interface RetrievalScopeInput {
  chunks: ChunkRef[];
  embeddingEnabled?: boolean;
  embeddings?: EmbeddingRecord[] | Record<string, number[]>;
  queryVector?: number[];
  embedQuery?: (query: string) => number[] | null | undefined;
}

function normalizeText(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function clampTopK(topK: number): number {
  if (!Number.isFinite(topK) || topK <= 0) {
    return 1;
  }
  return Math.floor(topK);
}

function tokenize(query: string): string[] {
  const tokens = normalizeText(query)
    .toLowerCase()
    .split(/[^0-9a-zA-Z가-힣_]+/)
    .filter((token) => token.length > 0);
  return [...new Set(tokens)];
}

function isNumberVector(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index];
    const bv = b[index];
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }

  if (aNorm <= 0 || bNorm <= 0) {
    return null;
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function buildEmbeddingMap(
  embeddings: RetrievalScopeInput["embeddings"],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  if (!embeddings) {
    return map;
  }

  if (Array.isArray(embeddings)) {
    for (const record of embeddings) {
      if (!record || !record.chunkRef || !isNumberVector(record.vector)) {
        continue;
      }
      map.set(record.chunkRef.chunkId, record.vector);
    }
    return map;
  }

  for (const [chunkId, vector] of Object.entries(embeddings)) {
    if (!isNumberVector(vector)) {
      continue;
    }
    map.set(chunkId, vector);
  }
  return map;
}

function keywordScore(
  chunk: ChunkRef,
  query: string,
  queryTokens: string[],
): { score: number; matchedTerms: string[] } | null {
  const source = normalizeText(chunk.text).toLowerCase();
  if (!source) {
    return null;
  }

  const queryLower = query.toLowerCase();
  const matchedTerms: string[] = [];
  let score = 0;
  let firstHit = Number.POSITIVE_INFINITY;

  const exactIndex = source.indexOf(queryLower);
  if (queryLower.length > 0 && exactIndex >= 0) {
    score += 0.62;
    firstHit = exactIndex;
  }

  let tokenHitCount = 0;
  let tokenFrequency = 0;
  for (const token of queryTokens) {
    const tokenIndex = source.indexOf(token);
    if (tokenIndex < 0) {
      continue;
    }
    tokenHitCount += 1;
    matchedTerms.push(token);
    firstHit = Math.min(firstHit, tokenIndex);

    let cursor = tokenIndex;
    let localCount = 0;
    while (cursor >= 0 && localCount < 4) {
      tokenFrequency += 1;
      localCount += 1;
      cursor = source.indexOf(token, cursor + token.length);
    }
  }

  if (score <= 0 && tokenHitCount === 0) {
    return null;
  }

  const coverage = queryTokens.length > 0 ? tokenHitCount / queryTokens.length : 1;
  score += coverage * 0.28;
  score += Math.min(0.12, tokenFrequency / 40);
  if (Number.isFinite(firstHit)) {
    score += Math.max(0, 0.14 - firstHit / 2400);
  }

  return { score, matchedTerms };
}

function buildHitId(chunk: ChunkRef, mode: "vector" | "keyword", rank: number): string {
  return `${mode}:${chunk.chunkId}:${rank}`;
}

function rankHits(
  source: Array<Omit<RetrievalHit, "hitId"> & { _mode: "vector" | "keyword" }>,
  topK: number,
): RetrievalHit[] {
  return source
    .sort((a, b) => b.score - a.score || a.chunkRef.fileRef.vaultRelativePath.localeCompare(b.chunkRef.fileRef.vaultRelativePath))
    .slice(0, topK)
    .map((item, index) => ({
      hitId: buildHitId(item.chunkRef, item._mode, index + 1),
      chunkRef: item.chunkRef,
      score: Number(item.score.toFixed(6)),
      reason: item.reason,
    }));
}

function retrieveVector(
  scope: RetrievalScopeInput,
  query: string,
  topK: number,
): RetrievalHit[] {
  if (!scope.embeddingEnabled) {
    return [];
  }

  const queryVector = scope.queryVector ?? scope.embedQuery?.(query);
  if (!isNumberVector(queryVector)) {
    return [];
  }

  const embeddingMap = buildEmbeddingMap(scope.embeddings);
  if (embeddingMap.size === 0) {
    return [];
  }

  const hits: Array<Omit<RetrievalHit, "hitId"> & { _mode: "vector" }> = [];
  for (const chunk of scope.chunks) {
    const chunkVector = embeddingMap.get(chunk.chunkId);
    if (!isNumberVector(chunkVector)) {
      continue;
    }
    const similarity = cosineSimilarity(queryVector, chunkVector);
    if (similarity === null || !Number.isFinite(similarity) || similarity <= 0) {
      continue;
    }
    hits.push({
      chunkRef: chunk,
      score: similarity,
      reason: "vector:cosine",
      _mode: "vector",
    });
  }

  return rankHits(hits, topK);
}

function retrieveKeyword(
  scope: RetrievalScopeInput,
  query: string,
  topK: number,
): RetrievalHit[] {
  const tokens = tokenize(query);
  const hits: Array<Omit<RetrievalHit, "hitId"> & { _mode: "keyword" }> = [];

  for (const chunk of scope.chunks) {
    const scored = keywordScore(chunk, query, tokens);
    if (!scored) {
      continue;
    }
    const terms = scored.matchedTerms.join(", ");
    hits.push({
      chunkRef: chunk,
      score: scored.score,
      reason: terms ? `keyword:terms(${terms})` : "keyword:substring",
      _mode: "keyword",
    });
  }

  return rankHits(hits, topK);
}

export function retrieve(
  scope: RetrievalScopeInput,
  query: string,
  topK: number,
): RetrievalHit[] {
  if (!scope || !Array.isArray(scope.chunks) || scope.chunks.length === 0) {
    return [];
  }

  const safeQuery = normalizeText(query);
  if (!safeQuery) {
    return [];
  }
  const safeTopK = clampTopK(topK);

  const vectorHits = retrieveVector(scope, safeQuery, safeTopK);
  if (vectorHits.length > 0) {
    return vectorHits;
  }
  return retrieveKeyword(scope, safeQuery, safeTopK);
}
