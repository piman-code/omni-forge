#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { runPipeline, type Chunk, type DocChange } from "../src/pr2/pipeline.ts";
import { runQA } from "../src/pr3/qaIntegration.ts";

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rmDirSafe(dirPath: string): void {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const scopeRoot = path.join(repoRoot, ".tmp", "pr3-runqa-smoke");
  const scopeId = "pr3-smoke-scope";
  const engineId = "local";

  // Clean + prepare sandbox directory inside repo (no /tmp usage).
  rmDirSafe(scopeRoot);
  ensureDir(scopeRoot);

  const docPath = "notes/pr3-smoke.md";
  const absDocPath = path.join(scopeRoot, docPath);
  ensureDir(path.dirname(absDocPath));

  const content = [
    "PR3 smoke note line 1.",
    "This note should be indexed by PR2 pipeline.",
    "runQA should return non-empty evidence markdown.",
  ].join("\n");
  fs.writeFileSync(absDocPath, content, "utf8");

  const changes: DocChange[] = [{ kind: "added", docPath }];
  const chunks: Chunk[] = [
    {
      docPath,
      chunkId: `${docPath}#0`,
      chunkIndex: 0,
      text: content,
      chunkHash: "pr3-smoke-chunk-0",
    },
  ];

  await runPipeline({ scopeRoot, scopeId, engineId, changes, chunks });

  const markdown = await runQA({
    scopeRoot,
    scopeId,
    engineId,
    query: "What does the PR3 smoke note say?",
    topK: 3,
  });

  if (typeof markdown !== "string" || !markdown.trim()) {
    throw new Error("runQA returned an empty string");
  }

  console.log(markdown);
  console.log("PR3 RUNQA SMOKE PASS");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
