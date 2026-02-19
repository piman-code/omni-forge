import {
  INSUFFICIENT_CITATIONS,
  toCitations,
} from "./citations.ts";
import type {
  AnswerDraft,
  Citation,
  ComposeInput,
  RetrievalHit,
  ScopeRef,
} from "./types.ts";

export interface ComposeAnswerDraftInput extends ComposeInput {
  answerCandidate?: string;
  minCitations?: number;
  maxCitations?: number;
}

function buildDraftId(scopeRef: ScopeRef): string {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `draft-${scopeRef.scopeId}-${stamp}`;
}

function buildCitationBlock(citations: Citation[]): string {
  if (citations.length === 0) {
    return "";
  }
  return citations
    .map((citation, index) => `[${index + 1}] ${citation.fileRef.vaultRelativePath}`)
    .join("\n");
}

function buildDefaultAnswer(question: string, citations: Citation[]): string {
  const evidence = citations
    .slice(0, 2)
    .map((citation) => `${citation.fileRef.vaultRelativePath}: ${citation.quote}`)
    .join(" | ");

  return [
    `질문 요약: ${question.trim()}`,
    `근거 요약: ${evidence || "확인 가능한 근거 없음"}`,
  ].join("\n");
}

function buildFollowUpQuestions(question: string, hits: RetrievalHit[]): string[] {
  const paths = [...new Set(hits.slice(0, 3).map((hit) => hit.chunkRef.fileRef.vaultRelativePath))];
  const list = [
    "근거 범위를 더 좁혀 주세요. (예: 폴더/기간/파일)",
    "질문 핵심 키워드를 2~3개로 다시 지정해 주세요.",
  ];

  if (paths.length > 0) {
    list.push(`우선 확인할 파일을 지정해 주세요: ${paths.join(", ")}`);
  } else {
    list.push("참고할 파일 경로나 본문 일부를 추가로 제공해 주세요.");
  }

  if (question.trim().length < 8) {
    list.push("질문 의도를 한 문장으로 구체화해 주세요.");
  }

  return list.slice(0, 3);
}

function buildInsufficientTemplate(required: number, found: number, questions: string[]): string {
  return [
    "답변 보류/추가 질문",
    `근거 인용이 부족합니다. (필요 ${required}, 확보 ${found})`,
    "추가 질문:",
    ...questions.map((question, index) => `${index + 1}. ${question}`),
  ].join("\n");
}

export function composeAnswerDraft(input: ComposeAnswerDraftInput): AnswerDraft {
  const citationResult = toCitations(input.hits, {
    minCitations: input.minCitations,
    maxCitations: input.maxCitations,
  });

  if (!citationResult.policyResult.isGrounded) {
    const followUpQuestions = buildFollowUpQuestions(input.question, input.hits);
    return {
      draftId: buildDraftId(input.scopeRef),
      question: input.question,
      answerMarkdown: buildInsufficientTemplate(
        citationResult.minCitations,
        citationResult.found,
        followUpQuestions,
      ),
      citations: citationResult.citations,
      unsupportedClaims: [
        `${INSUFFICIENT_CITATIONS}: 최소 ${citationResult.minCitations}개 인용이 필요합니다.`,
      ],
      policyResult: {
        isGrounded: false,
        violations: citationResult.policyResult.violations,
      },
    };
  }

  const body = input.answerCandidate?.trim()
    ? input.answerCandidate.trim()
    : buildDefaultAnswer(input.question, citationResult.citations);
  const citationBlock = buildCitationBlock(citationResult.citations);

  return {
    draftId: buildDraftId(input.scopeRef),
    question: input.question,
    answerMarkdown: citationBlock ? `${body}\n\n근거 인용:\n${citationBlock}` : body,
    citations: citationResult.citations,
    unsupportedClaims: [],
    policyResult: citationResult.policyResult,
  };
}
