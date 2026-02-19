type HitLike = {
  docPath?: unknown;
  path?: unknown;
  chunkId?: unknown;
  id?: unknown;
  score?: unknown;
};

export type ComposeAnswerInput = {
  question: string;
  hits: ReadonlyArray<HitLike>;
};

type RankedHit = {
  docPath: string;
  chunkId: string;
  score: number | null;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function rankHits(hits: ReadonlyArray<HitLike>): RankedHit[] {
  const dedup = new Map<string, RankedHit>();

  for (const hit of hits) {
    const rawDocPath = hit.docPath ?? hit.path;
    const rawChunkId = hit.chunkId ?? hit.id;

    const docPath =
      typeof rawDocPath === "string" && rawDocPath.trim().length > 0
        ? normalizeText(rawDocPath)
        : "unknown";
    const chunkId =
      typeof rawChunkId === "string" && rawChunkId.trim().length > 0
        ? normalizeText(rawChunkId)
        : "unknown";
    const score = normalizeScore(hit.score);

    const key = `${docPath}::${chunkId}`;
    const prev = dedup.get(key);
    const prevScore = prev?.score ?? Number.NEGATIVE_INFINITY;
    const nextScore = score ?? Number.NEGATIVE_INFINITY;

    if (!prev || nextScore > prevScore) {
      dedup.set(key, { docPath, chunkId, score });
    }
  }

  return Array.from(dedup.values()).sort((a, b) => {
    const scoreA = a.score ?? Number.NEGATIVE_INFINITY;
    const scoreB = b.score ?? Number.NEGATIVE_INFINITY;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return a.docPath.localeCompare(b.docPath) || a.chunkId.localeCompare(b.chunkId);
  });
}

function formatTopEvidence(hit: RankedHit): string {
  const scoreText = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
  return `${hit.docPath} (${hit.chunkId}, score ${scoreText})`;
}

export function composeAnswer({ question, hits }: ComposeAnswerInput): string {
  const rankedHits = rankHits(hits);

  if (rankedHits.length === 0) {
    return "관련 근거를 기반으로 답변을 구성했습니다.";
  }

  const normalizedQuestion = normalizeText(question);
  const questionLine =
    normalizedQuestion.length > 0 ? `질문: ${normalizedQuestion}` : "질문: (미입력)";

  const evidenceLine = `근거 ${rankedHits.length}건 기반 요약`;
  const topLine = `핵심 근거: ${formatTopEvidence(rankedHits[0])}`;

  if (rankedHits.length === 1) {
    return [questionLine, evidenceLine, topLine].join("\n");
  }

  const secondLine = `보조 근거: ${formatTopEvidence(rankedHits[1])}`;
  return [questionLine, evidenceLine, topLine, secondLine].join("\n");
}
