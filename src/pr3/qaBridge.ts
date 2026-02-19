export type Evidence = {
  docPath: string;
  chunkId: string;
  chunkHash: string;
  score: number;
  tokenCount?: number;
};

export type RetrievalHitLike = {
  docPath: string;
  chunkId: string;
  chunkHash: string;
  score: number;
  tokenCount?: number;
};

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Number(score.toFixed(6));
}

function normalizeTokenCount(tokenCount: number | undefined): number | undefined {
  if (!Number.isFinite(tokenCount)) {
    return undefined;
  }

  const normalized = Math.floor(tokenCount as number);
  if (normalized < 0) {
    return undefined;
  }
  return normalized;
}

export function toEvidence(hits: ReadonlyArray<RetrievalHitLike>): Evidence[] {
  if (hits.length === 0) {
    return [];
  }

  return hits.map((hit) => {
    const evidence: Evidence = {
      docPath: String(hit.docPath),
      chunkId: String(hit.chunkId),
      chunkHash: String(hit.chunkHash),
      score: normalizeScore(hit.score),
    };

    const tokenCount = normalizeTokenCount(hit.tokenCount);
    if (tokenCount !== undefined) {
      evidence.tokenCount = tokenCount;
    }

    return evidence;
  });
}

function escapeInlineCode(value: string): string {
  return value.replace(/`/g, "\\`");
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) {
    return "0.000000";
  }
  return score.toFixed(6);
}

export function formatEvidenceMarkdown(evidence: ReadonlyArray<Evidence>): string {
  if (evidence.length === 0) {
    return "";
  }

  return evidence
    .map(
      (item, index) =>
        `${index + 1}. \`${escapeInlineCode(item.docPath)}\` | chunk: \`${escapeInlineCode(item.chunkId)}\`| hash: \`${escapeInlineCode(item.chunkId)}\` | score: ${formatScore(item.score)}`,
    )
    .join("\n");
}
