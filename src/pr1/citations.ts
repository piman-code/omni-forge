import {
  PR1_ERROR_CODES,
  type AnswerPolicyResult,
  type Citation,
  type PR1ErrorCode,
  type RetrievalHit,
} from "./types.ts";

export const DEFAULT_MIN_CITATIONS = 2;
export const DEFAULT_MAX_CITATIONS = 5;
export const INSUFFICIENT_CITATIONS = PR1_ERROR_CODES.INSUFFICIENT_CITATIONS;

const MAX_QUOTE_CHARS = 220;

export interface CitationOptions {
  minCitations?: number;
  maxCitations?: number;
}

export interface CitationBuildResult {
  citations: Citation[];
  policyResult: AnswerPolicyResult;
  minCitations: number;
  found: number;
  code?: PR1ErrorCode;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) {
    return fallback;
  }
  return Math.floor(value as number);
}

function quoteFromHit(hit: RetrievalHit): string {
  const text = String(hit.chunkRef.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.length <= MAX_QUOTE_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_QUOTE_CHARS - 3)}...`;
}

function dedupeHits(hits: RetrievalHit[]): RetrievalHit[] {
  const seen = new Set<string>();
  const unique: RetrievalHit[] = [];

  for (const hit of hits) {
    const key = `${hit.chunkRef.chunkId}::${hit.chunkRef.fileRef.vaultRelativePath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(hit);
  }
  return unique;
}

function toCitation(hit: RetrievalHit, index: number): Citation {
  return {
    citationId: `citation-${index + 1}`,
    fileRef: hit.chunkRef.fileRef,
    chunkRef: hit.chunkRef,
    quote: quoteFromHit(hit),
  };
}

export function toCitations(
  hits: RetrievalHit[],
  options: CitationOptions = {},
): CitationBuildResult {
  const safeMin = clampPositiveInteger(options.minCitations, DEFAULT_MIN_CITATIONS);
  const requestedMax = clampPositiveInteger(options.maxCitations, DEFAULT_MAX_CITATIONS);
  const safeMax = Math.max(safeMin, requestedMax);

  const sortedHits = [...dedupeHits(hits)].sort(
    (a, b) =>
      b.score - a.score ||
      a.chunkRef.fileRef.vaultRelativePath.localeCompare(b.chunkRef.fileRef.vaultRelativePath),
  );
  const citations = sortedHits.slice(0, safeMax).map((hit, index) => toCitation(hit, index));
  const grounded = citations.length >= safeMin;

  return {
    citations,
    policyResult: {
      isGrounded: grounded,
      violations: grounded ? [] : [INSUFFICIENT_CITATIONS],
    },
    minCitations: safeMin,
    found: citations.length,
    code: grounded ? undefined : INSUFFICIENT_CITATIONS,
  };
}
