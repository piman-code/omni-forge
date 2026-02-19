#!/usr/bin/env node

import { MarkdownChunker } from "../src/pr1/chunker.ts";

type FileRefLike = {
  fileId: string;
  vaultRelativePath: string;
  scopeId: string;
};

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildFileRef(path: string): FileRefLike {
  return {
    fileId: `scope-a:${path}`,
    vaultRelativePath: path,
    scopeId: "scope-a",
  };
}

function runScenarioSingleHeader(): void {
  const chunker = new MarkdownChunker({ maxChars: 200 });
  const content = "# 제목\n짧은 본문입니다.\n";
  const chunks = chunker.chunkFile(buildFileRef("docs/single.md"), content as string);

  assertTrue(chunks.length >= 1 && chunks.length <= 2, "single-header: expected 1~2 chunks");
  assertTrue(chunks[0].startOffset === 0, "single-header: first chunk startOffset must be 0");
  assertTrue(chunks[0].endOffset <= content.length, "single-header: endOffset out of range");
}

function runScenarioMultiHeading(): void {
  const chunker = new MarkdownChunker({ maxChars: 400 });
  const content = "# A\nalpha\n## B\nbeta\n### C\ngamma\n";
  const chunks = chunker.chunkFile(buildFileRef("docs/multi.md"), content);

  assertTrue(chunks.length >= 3, "multi-heading: expected at least 3 chunks");

  const headings = chunks.map((chunk) => chunker.getChunkMetadata(chunk.chunkId)?.heading).filter(Boolean);
  assertTrue(headings.includes("A"), "multi-heading: heading A missing");
  assertTrue(headings.includes("B"), "multi-heading: heading B missing");
  assertTrue(headings.includes("C"), "multi-heading: heading C missing");
}

function runScenarioLongParagraph(): void {
  const requestedMaxChars = 180;
  const chunker = new MarkdownChunker({ maxChars: requestedMaxChars });
  const effectiveMaxChars = chunker.getMaxChars();
  const lines: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(`문단-${i} long text for chunk split validation.\n`);
  }
  const content = `# Long\n${lines.join("")}`;
  const chunks = chunker.chunkFile(buildFileRef("docs/long.md"), content);

  assertTrue(chunks.length >= 2, "long-paragraph: expected split into multiple chunks");
  const longestChunk = chunks.reduce((max, chunk) => Math.max(max, chunk.text.length), 0);
  assertTrue(longestChunk < content.length, "long-paragraph: longest chunk should be shorter than full content");
  for (const chunk of chunks) {
    assertTrue(
      chunk.text.length <= effectiveMaxChars + 80,
      "long-paragraph: chunk unexpectedly oversized for effective maxChars policy",
    );
  }
}

try {
  runScenarioSingleHeader();
  runScenarioMultiHeading();
  runScenarioLongParagraph();
  console.log("[pr1-chunk-smoke] PASS");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pr1-chunk-smoke] FAIL: ${message}`);
  process.exit(1);
}
