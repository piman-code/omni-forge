#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPipeline } from "../src/pr2/pipeline.ts";
import { retrieveByVector } from "../src/pr2/retrievalBridge.ts";

type SmokeMetrics = {
  firstHitCount: number;
  firstTopDocPath: string;
  secondHitCount: number;
  hasAAfterDelete: boolean;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

async function run(): Promise<void> {
  const scopeRoot = await mkdtemp(path.join(os.tmpdir(), "omni-forge-pr2-smoke-"));
  const scopeId = "scope-a";
  const engineId = "local-embedder-v1";
  const chunks = [
    {
      docPath: "notes/a.md",
      chunkId: "notes/a.md#0",
      chunkIndex: 0,
      text: "alpha beta alpha",
      chunkHash: "h-a-0",
    },
    {
      docPath: "notes/b.md",
      chunkId: "notes/b.md#0",
      chunkIndex: 0,
      text: "gamma delta gamma",
      chunkHash: "h-b-0",
    },
  ];

  try {
    const firstRun = await runPipeline({
      scopeRoot,
      scopeId,
      engineId,
      changes: [],
      chunks,
    });
    if (firstRun.aborted) {
      throw new Error(`first pipeline run aborted: ${firstRun.abortReason ?? "unknown"}`);
    }

    const firstSearch = await retrieveByVector({
      scopeRoot,
      scopeId,
      engineId,
      query: "alpha",
      topK: 5,
    });
    if (firstSearch.aborted) {
      throw new Error(`first retrieval aborted: ${firstSearch.abortReason ?? "unknown"}`);
    }
    const hasAInFirst = firstSearch.hits.some((hit) => hit.docPath === "notes/a.md");
    if (!hasAInFirst) {
      throw new Error("first retrieval missing notes/a.md");
    }

    const secondRun = await runPipeline({
      scopeRoot,
      scopeId,
      engineId,
      changes: [{ kind: "deleted", docPath: "notes/a.md" }],
      // Incremental changeset rule: deleted docs must not be included in input chunks.
      chunks: chunks.filter((chunk) => chunk.docPath !== "notes/a.md"),
    });
    if (secondRun.aborted) {
      throw new Error(`second pipeline run aborted: ${secondRun.abortReason ?? "unknown"}`);
    }

    const secondSearch = await retrieveByVector({
      scopeRoot,
      scopeId,
      engineId,
      query: "alpha",
      topK: 5,
    });
    if (secondSearch.aborted) {
      throw new Error(`second retrieval aborted: ${secondSearch.abortReason ?? "unknown"}`);
    }
    const hasAAfterDelete = secondSearch.hits.some((hit) => hit.docPath === "notes/a.md");
    if (hasAAfterDelete) {
      throw new Error("tombstoned notes/a.md was returned");
    }

    const result: SmokeMetrics = {
      firstHitCount: firstSearch.hits.length,
      firstTopDocPath: firstSearch.hits[0]?.docPath ?? "",
      secondHitCount: secondSearch.hits.length,
      hasAAfterDelete,
    };

    console.log("PR2 SMOKE PASS");
    console.log(
      JSON.stringify(
        {
          firstHitCount: result.firstHitCount,
          firstTopDocPath: result.firstTopDocPath,
          secondHitCount: result.secondHitCount,
          hasAAfterDelete: result.hasAAfterDelete,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log("PR2 SMOKE FAIL");
    console.error(toErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await rm(scopeRoot, { recursive: true, force: true });
  }
}

void run();
