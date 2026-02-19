#!/usr/bin/env node

import {
  FolderScopedIndexer,
  ScopedVault,
  type ScopedVaultAdapter,
  type ScopedVaultListResult,
  type ScopedVaultStat
} from "../src/pr1/indexer.ts";
import { ScopeStore, type ScopeStoreAdapter } from "../src/pr1/scopeStore.ts";
import { type ScopeRef } from "../src/pr1/types.ts";

type MemoryFile = {
  content: string;
  mtimeMs: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizePath(rawPath: string): string {
  const source = String(rawPath ?? "").replace(/\\/g, "/").trim();
  const parts = source
    .split("/")
    .filter((part) => part.length > 0 && part !== ".");
  return parts.join("/");
}

class MemoryVaultAdapter implements ScopedVaultAdapter {
  private readonly files = new Map<string, MemoryFile>();
  private now = 1_700_000_000_000;
  private readCount = 0;

  put(path: string, content: string): void {
    this.now += 1_000;
    this.files.set(normalizePath(path), {
      content,
      mtimeMs: this.now
    });
  }

  remove(path: string): void {
    this.files.delete(normalizePath(path));
  }

  resetReadCount(): void {
    this.readCount = 0;
  }

  getReadCount(): number {
    return this.readCount;
  }

  async list(path: string): Promise<ScopedVaultListResult> {
    const normalized = normalizePath(path);
    const prefix = normalized ? `${normalized}/` : "";
    const folders = new Set<string>();
    const files = new Set<string>();

    for (const filePath of this.files.keys()) {
      if (normalized && !filePath.startsWith(prefix) && filePath !== normalized) {
        continue;
      }
      if (filePath === normalized) {
        files.add(filePath);
        continue;
      }

      const remainder = normalized ? filePath.slice(prefix.length) : filePath;
      if (!remainder) {
        continue;
      }
      const parts = remainder.split("/");
      if (parts.length === 1) {
        files.add(filePath);
      } else {
        folders.add(normalized ? `${normalized}/${parts[0]}` : parts[0]);
      }
    }

    return {
      files: [...files].sort((a, b) => a.localeCompare(b)),
      folders: [...folders].sort((a, b) => a.localeCompare(b))
    };
  }

  async read(path: string): Promise<string> {
    const hit = this.files.get(normalizePath(path));
    if (!hit) {
      throw new Error(`file not found: ${path}`);
    }
    this.readCount += 1;
    return hit.content;
  }

  async stat(path: string): Promise<ScopedVaultStat | null> {
    const hit = this.files.get(normalizePath(path));
    if (!hit) {
      return null;
    }
    return {
      mtime: hit.mtimeMs,
      size: Buffer.byteLength(hit.content, "utf8")
    };
  }
}

class MemoryScopeStoreAdapter implements ScopeStoreAdapter {
  private readonly files = new Map<string, string>();
  private readonly folders = new Set<string>(["."]);

  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.folders.has(normalized);
  }

  async read(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const hit = this.files.get(normalized);
    if (typeof hit !== "string") {
      throw new Error(`missing file: ${path}`);
    }
    return hit;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(normalizePath(path), content);
  }

  async mkdir(path: string): Promise<void> {
    this.folders.add(normalizePath(path));
  }
}

async function run(): Promise<void> {
  const adapter = new MemoryVaultAdapter();
  const scopeStore = new ScopeStore(new MemoryScopeStoreAdapter());
  const scopedVault = new ScopedVault(adapter);
  const indexer = new FolderScopedIndexer(scopedVault, scopeStore);
  const scopeRef: ScopeRef = {
    scopeId: "scope-alpha",
    rootPath: "Projects/Alpha",
    includePaths: [],
    excludePaths: [],
    createdAt: new Date().toISOString()
  };

  // 시나리오 1: scope 내 파일 인덱싱
  adapter.put("Projects/Alpha/a.md", "alpha-a-v1");
  adapter.put("Projects/Alpha/b.md", "alpha-b-v1");
  adapter.put("Projects/Beta/ignored.md", "out-of-scope");
  const run1 = await indexer.indexScopeWithDiff(scopeRef);
  assert(run1.status.indexedFiles === 2, "run1 indexedFiles should be 2");
  assert(run1.diff.added.length === 2, "run1 added should be 2");
  assert(run1.diff.updated.length === 0, "run1 updated should be 0");

  // 시나리오 2: 변경된 파일만 재처리
  adapter.resetReadCount();
  adapter.put("Projects/Alpha/b.md", "alpha-b-v2");
  const run2 = await indexer.indexScopeWithDiff(scopeRef);
  assert(run2.diff.updated.includes("Projects/Alpha/b.md"), "run2 should update only b.md");
  assert(run2.diff.unchanged.includes("Projects/Alpha/a.md"), "run2 should keep a.md unchanged");
  assert(adapter.getReadCount() === 1, "run2 should read only one changed file");

  // 시나리오 3: 삭제 파일 감지
  adapter.remove("Projects/Alpha/b.md");
  const run3 = await indexer.indexScopeWithDiff(scopeRef);
  assert(run3.diff.deleted.includes("Projects/Alpha/b.md"), "run3 should detect deleted b.md");

  console.log("[pr1-index-smoke] PASS");
  console.log(
    JSON.stringify(
      {
        scenario1: {
          indexedFiles: run1.status.indexedFiles,
          added: run1.diff.added.length
        },
        scenario2: {
          updated: run2.diff.updated,
          unchanged: run2.diff.unchanged,
          readCount: adapter.getReadCount()
        },
        scenario3: {
          deleted: run3.diff.deleted
        }
      },
      null,
      2
    )
  );
}

void run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("[pr1-index-smoke] FAIL");
  console.error(message);
  process.exitCode = 1;
});
