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

function isTombstonedDocPath(docPath: string): boolean {
  const normalized = normalizeText(docPath).toLowerCase();
  if (normalized === "tombstoned") return true;
  if (normalized.startsWith("tombstoned ")) return true;
  return false;
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

    if (isTombstonedDocPath(docPath)) {
      continue;
    }

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

function pickTopDistinctDocPaths(rankedHits: ReadonlyArray<RankedHit>, max: number): RankedHit[] {
  const picked: RankedHit[] = [];
  const seen = new Set<string>();

  for (const hit of rankedHits) {
    if (seen.has(hit.docPath)) continue;
    seen.add(hit.docPath);
    picked.push(hit);
    if (picked.length >= max) break;
  }

  return picked;
}

export function composeAnswer({ question, hits }: ComposeAnswerInput): string {
  const rankedHits = rankHits(hits);

  if (rankedHits.length === 0) {
    return [
      "## 📌 답변 요약",
      "관련 근거가 충분하지 않습니다. (근거 부족)",
      "",
      "## 🔎 근거",
      "- 없음",
      "",
      "## 🔗 참조 노트",
      "- 없음",
      "",
      "## 📊 신뢰도",
      "0",
    ].join("\n");
  }

  const topHits = pickTopDistinctDocPaths(rankedHits, 2);

  const normalizedQuestion = normalizeText(question);
  const questionLine =
    normalizedQuestion.length > 0 ? `질문: ${normalizedQuestion}` : "질문: (미입력)";

  const insufficient = rankedHits.length < 2;
  const evidenceLine = insufficient
    ? `근거 ${rankedHits.length}건 기반 요약 (근거 부족)`
    : `근거 ${rankedHits.length}건 기반 요약`;
  const topLine = `핵심 근거: ${formatTopEvidence(topHits[0])}`;

  const evidenceBullets = [`- ${topLine}`];

  if (topHits.length > 1) {
    const secondLine = `보조 근거: ${formatTopEvidence(topHits[1])}`;
    evidenceBullets.push(`- ${secondLine}`);
  }

  const referenceNotes = Array.from(
    new Set(topHits.map((h) => `- [[${h.docPath}]]`))
  );

  // 간단 신뢰도 계산 (PR-6 계산과 충돌 없음, 출력용 보조 지표)
  const confidence = Math.min(
    100,
    Math.max(0, Math.round((rankedHits.length / 5) * 100))
  );

  return [
    "## 📌 답변 요약",
    questionLine,
    evidenceLine,
    "",
    "## 🔎 근거",
    ...evidenceBullets,
    "",
    "## 🔗 참조 노트",
    ...referenceNotes,
    "",
    "## 📊 신뢰도",
    String(confidence),
  ].join("\n");
}