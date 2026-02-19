#!/usr/bin/env node

import {
  formatEvidenceMarkdown,
  toEvidence,
  type RetrievalHitLike,
} from "../src/pr3/qaBridge.ts";

function run(): void {
  const hits: RetrievalHitLike[] = [
    {
      docPath: "notes/a.md",
      chunkId: "notes/a.md#0",
      chunkHash: "hash-a-0",
      score: 0.932145,
      tokenCount: 128,
    },
    {
      docPath: "notes/b.md",
      chunkId: "notes/b.md#1",
      chunkHash: "hash-b-1",
      score: 0.812345,
      tokenCount: 96,
    },
  ];

  const evidence = toEvidence(hits);
  if (evidence.length !== 2) {
    throw new Error(`expected 2 evidence items, got ${evidence.length}`);
  }

  const markdown = formatEvidenceMarkdown(evidence);
  if (!markdown.includes("notes/a.md") || !markdown.includes("notes/b.md")) {
    throw new Error("markdown output missing expected docPath values");
  }
  if (!markdown.includes("notes/a.md#0") || !markdown.includes("notes/b.md#1")) {
    throw new Error("markdown output missing expected chunkId values");
  }

  console.log(
    JSON.stringify(
      {
        evidence,
        markdown,
      },
      null,
      2,
    ),
  );
  console.log("PR3 QA SMOKE PASS");
}

run();
