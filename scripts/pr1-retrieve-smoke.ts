#!/usr/bin/env node

import { composeAnswerDraft } from "../src/pr1/answerComposer.ts";
import {
  INSUFFICIENT_CITATIONS,
  toCitations,
} from "../src/pr1/citations.ts";
import {
  retrieve,
  type RetrievalScopeInput,
} from "../src/pr1/retriever.ts";
import type {
  ChunkRef,
  EmbeddingRecord,
  FileRef,
  LocalFirstPolicy,
  ScopeRef,
} from "../src/pr1/types.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const policy: LocalFirstPolicy = {
  defaultDeny: true,
  folderScopedOnly: true,
  prohibitVaultWideScan: true,
  cloudMode: "Off",
  allowNetwork: false,
  requireCitations: true,
};

const scopeRef: ScopeRef = {
  scopeId: "pr1-demo",
  rootPath: "notes",
  includePaths: ["notes"],
  createdAt: new Date("2026-02-19T00:00:00.000Z").toISOString(),
};

function makeFileRef(fileId: string, path: string): FileRef {
  return {
    fileId,
    vaultRelativePath: path,
    scopeId: scopeRef.scopeId,
  };
}

function makeChunk(
  chunkId: string,
  fileRef: FileRef,
  text: string,
  ordinal: number,
): ChunkRef {
  return {
    chunkId,
    fileRef,
    ordinal,
    text,
    startOffset: 0,
    endOffset: text.length,
    tokenCount: text.split(/\s+/).filter(Boolean).length,
  };
}

function runSmoke(): void {
  const fileA = makeFileRef("f-1", "notes/pr1-plan.md");
  const fileB = makeFileRef("f-2", "notes/pr1-citations.md");
  const fileC = makeFileRef("f-3", "notes/pr1-misc.md");

  const chunkA = makeChunk(
    "c-1",
    fileA,
    "PR1 retriever는 vector 검색과 keyword fallback을 모두 지원해야 한다.",
    0,
  );
  const chunkB = makeChunk(
    "c-2",
    fileB,
    "Citation 최소 개수는 기본 2로 강제하고 부족하면 답변 보류 템플릿을 사용한다.",
    0,
  );
  const chunkC = makeChunk("c-3", fileC, "무관한 메모", 0);

  const embeddings: EmbeddingRecord[] = [
    {
      embeddingId: "e-1",
      chunkRef: chunkA,
      model: "local-test",
      dimension: 3,
      vector: [0.98, 0.02, 0.01],
      createdAt: new Date().toISOString(),
    },
    {
      embeddingId: "e-2",
      chunkRef: chunkB,
      model: "local-test",
      dimension: 3,
      vector: [0.93, 0.05, 0.04],
      createdAt: new Date().toISOString(),
    },
    {
      embeddingId: "e-3",
      chunkRef: chunkC,
      model: "local-test",
      dimension: 3,
      vector: [0.1, 0.8, 0.9],
      createdAt: new Date().toISOString(),
    },
  ];

  const scopeWithEmbedding: RetrievalScopeInput = {
    chunks: [
      chunkA,
      chunkB,
      chunkC,
    ],
    embeddingEnabled: true,
    embeddings,
    queryVector: [1, 0, 0],
  };

  const vectorHits = retrieve(scopeWithEmbedding, "retriever citations", 2);
  assert(vectorHits.length === 2, "vector retrieval: topK 적용 실패");
  assert(vectorHits[0].reason?.includes("vector"), "vector retrieval: mode 실패");

  const scopeKeywordOnly: RetrievalScopeInput = {
    ...scopeWithEmbedding,
    embeddingEnabled: false,
  };

  const keywordHits = retrieve(scopeKeywordOnly, "fallback citation", 3);
  assert(keywordHits.length >= 2, "keyword fallback: 결과 부족");
  assert(keywordHits[0].reason?.includes("keyword"), "keyword fallback: mode 실패");

  const citationResult = toCitations(keywordHits, { minCitations: 2 });
  assert(citationResult.policyResult.isGrounded, "citation grounding 실패");

  const readyDraft = composeAnswerDraft({
    scopeRef,
    question: "PR1 근거 정책이 뭐야?",
    hits: keywordHits,
    answerCandidate: "PR1은 인용 최소 개수를 강제한다.",
    policy,
  });
  assert(readyDraft.policyResult.isGrounded, "answer ready 상태 실패");
  assert(readyDraft.citations.length >= 2, "answer ready 인용 개수 실패");

  const insufficientDraft = composeAnswerDraft({
    scopeRef,
    question: "근거가 충분한가?",
    hits: keywordHits.slice(0, 1),
    minCitations: 2,
    policy,
  });
  assert(
    !insufficientDraft.policyResult.isGrounded,
    "insufficient 상태 실패",
  );
  assert(
    insufficientDraft.policyResult.violations.includes(INSUFFICIENT_CITATIONS),
    "insufficient code 실패",
  );
  assert(
    insufficientDraft.answerMarkdown.includes("답변 보류/추가 질문"),
    "insufficient 템플릿 실패",
  );

  console.log("pr1 retrieve smoke: OK");
  console.log(
    JSON.stringify(
      {
        vectorTopPath: vectorHits[0]?.chunkRef.fileRef.vaultRelativePath ?? "",
        keywordTopPath: keywordHits[0]?.chunkRef.fileRef.vaultRelativePath ?? "",
        readyCitationCount: readyDraft.citations.length,
        insufficientCode: insufficientDraft.policyResult.violations[0] ?? "",
      },
      null,
      2,
    ),
  );
}

runSmoke();
