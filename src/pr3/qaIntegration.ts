import { retrieveByVector, type RetrievalInput } from "../pr2/retrievalBridge.ts";
import { toEvidenceMarkdownFromHits } from "./qaBridge.ts";

export async function runQA(input: RetrievalInput): Promise<string> {
  const result = await retrieveByVector(input);

  // 1) 기존 동작(근거 마크다운 생성)은 그대로 유지
  const evidenceMarkdown = toEvidenceMarkdownFromHits(result.hits);

  // 2) hits를 안전하게 가져오기
  const hits = result.hits ?? [];

  // 3) 요약: evidenceMarkdown의 앞부분 2~3줄만 뽑기
  const summaryLines = evidenceMarkdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)
    .map((l) => l.replace(/^[-*]\s+/, ""));

  const summary =
    summaryLines.length > 0
      ? summaryLines.join("\n")
      : "관련 근거를 기반으로 답변을 구성했습니다.";

  // 4) 근거 bullet 만들기: [[문서경로]] - chunkId (score: nnnn)
  const evidenceBullets = hits
    .map((h: any) => {
      const path = h.docPath ?? h.path ?? "unknown";
      const chunk = h.chunkId ?? h.id ?? "unknown";
      const score =
        typeof h.score === "number" ? h.score.toFixed(4) : "n/a";
      return `- [[${path}]] - ${chunk} (score: ${score})`;
    })
    .join("\n");

  // 5) 신뢰도: 최고 score를 %로 (score가 0~1일 때 잘 동작)
  const scores = hits
    .map((h: any) => h.score)
    .filter((s: any) => typeof s === "number") as number[];

  const confidence =
    scores.length > 0 ? Math.round(Math.max(...scores) * 100) : 0;

  // 6) 스펙 템플릿으로 최종 문자열 반환
  return [
    "## 📌 답변 요약",
    summary,
    "",
    "## 🔎 근거",
    evidenceBullets || "- (근거 없음)",
    "",
    "## 📊 신뢰도",
    `${confidence}%`,
    "",
  ].join("\n");
}