import {
  LocalEmbeddingEngine,
  type EmbeddingEngineOptions,
} from "./embeddingEngine.ts";
import { JsonlVectorStore } from "./vectorStore.ts";

export type ChangeKind = "added" | "updated" | "deleted" | "moved" | "unchanged";

export type DocChange = {
  kind: ChangeKind;
  docPath: string;
  prevDocPath?: string;
};

export type Chunk = {
  docPath: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  chunkHash: string;
  tokenCount?: number;
};

export type PipelineInput = {
  scopeRoot: string;
  scopeId: string;
  engineId: string;
  changes: DocChange[];
  chunks: Chunk[];
};

export type PipelineReport = {
  processedDocs: number;
  processedChunks: number;
  embeddedChunks: number;
  tombstonedChunks: number;
  mode: "EMBEDDING_ACTIVE" | "EMBEDDING_FALLBACK_KEYWORD";
  aborted?: boolean;
  abortReason?: string;
};

type PipelineOptions = {
  embedding?: EmbeddingEngineOptions;
};

function toAbortReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toDocSet(changes: DocChange[], chunks: Chunk[]): Set<string> {
  const docs = new Set<string>();
  for (const change of changes) {
    const nextPath = String(change.docPath ?? "").trim();
    if (nextPath) {
      docs.add(nextPath);
    }
    const prevPath = String(change.prevDocPath ?? "").trim();
    if (prevPath) {
      docs.add(prevPath);
    }
  }
  for (const chunk of chunks) {
    const path = String(chunk.docPath ?? "").trim();
    if (path) {
      docs.add(path);
    }
  }
  return docs;
}

function toTombstoneDocPaths(changes: DocChange[]): Set<string> {
  const paths = new Set<string>();
  for (const change of changes) {
    if (change.kind !== "deleted" && change.kind !== "moved") {
      continue;
    }
    const path =
      change.kind === "moved"
        ? String(change.prevDocPath ?? change.docPath ?? "").trim()
        : String(change.docPath ?? "").trim();
    if (path) {
      paths.add(path);
    }
  }
  return paths;
}

// Abort rules:
// 1) scopeRoot 외 경로 접근은 VectorStore가 throw -> 파이프라인은 abort 처리.
// 2) 네트워크 호출은 금지이며, 이 파일에는 관련 코드(fetch/http/https)가 없다.
// 3) 허용 파일 외 변경 금지 규칙은 개발 프로세스에서 강제한다.
export async function runPipeline(
  input: PipelineInput,
  options: PipelineOptions = {},
): Promise<PipelineReport> {
  const changes = Array.isArray(input.changes) ? input.changes : [];
  const chunks = Array.isArray(input.chunks) ? input.chunks : [];
  const processedDocs = toDocSet(changes, chunks).size;

  const reportBase: PipelineReport = {
    processedDocs,
    processedChunks: chunks.length,
    embeddedChunks: 0,
    tombstonedChunks: 0,
    mode: "EMBEDDING_ACTIVE",
  };

  try {
    const embeddingEngine = new LocalEmbeddingEngine(options.embedding ?? {});
    const vectorStore = new JsonlVectorStore({
      scopeRoot: input.scopeRoot,
      scopeId: input.scopeId,
      embedDim: embeddingEngine.getDimension(),
      engineId: input.engineId,
    });

    await vectorStore.ensureInitialized();

    for (const change of changes) {
      if (change.kind !== "deleted" && change.kind !== "moved") {
        continue;
      }
      const docPath =
        change.kind === "moved"
          ? String(change.prevDocPath ?? change.docPath ?? "").trim()
          : String(change.docPath ?? "").trim();
      if (!docPath) {
        continue;
      }
      await vectorStore.tombstone({
        docPath,
        chunkId: `__doc__:${docPath}`,
        chunkHash: `__doc_tombstone__:${change.kind}:${docPath}`,
      });
      reportBase.tombstonedChunks += 1;
    }

    const tombstoneTargets = toTombstoneDocPaths(changes);
    const tombstonedKeys = new Set<string>();
    for (const chunk of chunks) {
      if (!tombstoneTargets.has(chunk.docPath)) {
        continue;
      }
      const key = `${chunk.docPath}::${chunk.chunkId}`;
      if (tombstonedKeys.has(key)) {
        continue;
      }
      await vectorStore.tombstone({
        docPath: chunk.docPath,
        chunkId: chunk.chunkId,
        chunkHash: chunk.chunkHash,
      });
      tombstonedKeys.add(key);
      reportBase.tombstonedChunks += 1;
    }

    for (const chunk of chunks) {
      let vector: number[];
      try {
        const embedded = embeddingEngine.embed(chunk.text);
        vector = embedded.vector;
      } catch (error) {
        return {
          ...reportBase,
          mode: "EMBEDDING_FALLBACK_KEYWORD",
          aborted: true,
          abortReason: `embedding failed: ${toAbortReason(error)}`,
        };
      }

      await vectorStore.upsert({
        docPath: chunk.docPath,
        chunkId: chunk.chunkId,
        chunkHash: chunk.chunkHash,
        vector,
        tokenCount: chunk.tokenCount,
      });
      reportBase.embeddedChunks += 1;
    }

    return reportBase;
  } catch (error) {
    return {
      ...reportBase,
      aborted: true,
      abortReason: toAbortReason(error),
    };
  }
}
