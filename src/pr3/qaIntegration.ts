import { retrieveByVector, type RetrievalInput } from "../pr2/retrievalBridge.ts";
import { composeAnswer } from "../pr4/answerComposer.ts";

type HitLike = {
  docPath?: unknown;
  path?: unknown;
  chunkId?: unknown;
  id?: unknown;
  score?: unknown;
};

type EvidenceItem = {
  docPath: string;
  chunkId: string;
  score: number | null;
};

function normalizeConfidenceScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score >= 0 && score <= 1) return score;
  if (score <= 0) return 0;
  // 0..1 범위를 벗어난 양수 score는 완만하게 1에 수렴
  return score / (1 + score);
}

type HitLike = {
  docPath?: unknown;
  path?: unknown;
  chunkId?: unknown;
  id?: unknown;
  score?: unknown;
};

type EvidenceItem = {
  docPath: string;
  chunkId: string;
  score: number | null;
};

export async function runQA(input: RetrievalInput): Promise<string> {
  const result = await retrieveByVector(input);

  // 1) 기존 동작(근거 마크다운 생성)은 그대로 유지

  // 2) hits를 안전하게 가져오기
  const hits = (result.hits ?? []) as HitLike[];

  // 3) 요약: evidenceMarkdown의 앞부분 2~3줄만 뽑기
  const summary = composeAnswer({ question: input.query, hits });

  // 4) 근거 bullet: (docPath, chunkId) 중복 제거 + score 내림차순 정렬
  const evidenceMap = new Map<string, EvidenceItem>();
  const referencePathSet = new Set<string>();

  for (const hit of hits) {
    const rawDocPath = hit.docPath ?? hit.path;
    const rawChunkId = hit.chunkId ?? hit.id;

    const docPath =
      typeof rawDocPath === "string" && rawDocPath.trim().length > 0
        ? rawDocPath
        : "unknown";
    const chunkId =
      typeof rawChunkId === "string" && rawChunkId.trim().length > 0
        ? rawChunkId
        : "unknown";
    const score =
      typeof hit.score === "number" && Number.isFinite(hit.score) ? hit.score : null;

    if (docPath !== "unknown") referencePathSet.add(docPath);

    const key = `${docPath}::${chunkId}`;
    const prev = evidenceMap.get(key);
    const prevScore = prev?.score ?? Number.NEGATIVE_INFINITY;
    const nextScore = score ?? Number.NEGATIVE_INFINITY;

    if (!prev || nextScore > prevScore) {
      evidenceMap.set(key, { docPath, chunkId, score });
    }
  }

  const evidenceItems = Array.from(evidenceMap.values()).sort((a, b) => {
    const scoreA = a.score ?? Number.NEGATIVE_INFINITY;
    const scoreB = b.score ?? Number.NEGATIVE_INFINITY;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.docPath.localeCompare(b.docPath) || a.chunkId.localeCompare(b.chunkId);
  });

  const evidenceBullets = evidenceItems
    .map((item) => {
      const scoreStr =
        typeof item.score === "number" ? item.score.toFixed(4) : "n/a";
      return `- [[${item.docPath}]] - ${item.chunkId} (score: ${scoreStr})`;
    })
    .join("\n");

  // 5) 참조 노트 섹션: hits에서 docPath를 수집해 중복 제거
  const referenceNotes = Array.from(referencePathSet)
    .sort((a, b) => a.localeCompare(b))
    .map((docPath) => `- [[${docPath}]]`)
    .join("\n");

  // 6) 신뢰도: 0..1은 그대로, 그 외 score는 완만한 변환 적용
  const scores = evidenceItems
    .map((item) => item.score)
    .filter((s): s is number => typeof s === "number");

  const maxScore = scores.length > 0 ? Math.max(...scores) : Number.NaN;
  const confidence = Math.round(normalizeConfidenceScore(maxScore) * 100);

  // 7) 스펙 템플릿으로 최종 문자열 반환
  return [
    "## 📌 답변 요약",
    summary,
    "",
    "## 🔎 근거",
    evidenceBullets || "- (근거 없음)",
    "",
    "## 🔗 참조 노트",
    referenceNotes || "- (참조 노트 없음)",
    "",
    "## 📊 신뢰도",
    `${confidence}%`,
    "",
  ].join("\n");
}