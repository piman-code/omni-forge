import { App, TFile, requestUrl } from "obsidian";
import type { KnowledgeWeaverSettings } from "./types";

const EMBEDDING_BATCH_SIZE = 8;

export interface SemanticNeighbor {
  path: string;
  similarity: number;
}

export interface SemanticNeighborResult {
  neighborMap: Map<string, SemanticNeighbor[]>;
  model: string;
  generatedVectors: number;
  errors: string[];
}

function clampSimilarity(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 0;
  }
  if (raw > 1) {
    return 1;
  }
  if (raw < -1) {
    return -1;
  }
  return raw;
}

function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }

  if (aNorm <= 0 || bNorm <= 0) {
    return null;
  }

  return clampSimilarity(dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm)));
}

function toNumberVector(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      return null;
    }
    out.push(item);
  }

  return out.length > 0 ? out : null;
}

function parseEmbeddings(payload: unknown): number[][] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  const embeddingSingle = toNumberVector(record.embedding);
  if (embeddingSingle) {
    return [embeddingSingle];
  }

  const embeddings = record.embeddings;
  if (!Array.isArray(embeddings)) {
    return [];
  }

  const out: number[][] = [];
  for (const item of embeddings) {
    const vector = toNumberVector(item);
    if (!vector) {
      return [];
    }
    out.push(vector);
  }

  return out;
}

function normalizeSourceText(raw: string, maxChars: number): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "(empty note)";
  }
  return collapsed.slice(0, Math.max(200, maxChars));
}

async function requestOllamaEmbeddings(
  baseUrl: string,
  model: string,
  inputs: string[],
): Promise<number[][]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/embed`;
  const response = await requestUrl({
    url,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      model,
      input: inputs,
    }),
    throw: false,
  });

  if (response.status >= 300) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const parsed = parseEmbeddings(response.json);
  if (parsed.length === 0) {
    throw new Error("Embedding response was empty or invalid.");
  }

  return parsed;
}

export async function buildSemanticNeighborMap(
  app: App,
  files: TFile[],
  settings: KnowledgeWeaverSettings,
): Promise<SemanticNeighborResult> {
  const neighborMap = new Map<string, SemanticNeighbor[]>();
  for (const file of files) {
    neighborMap.set(file.path, []);
  }

  if (files.length < 2) {
    return {
      neighborMap,
      model: settings.semanticOllamaModel,
      generatedVectors: 0,
      errors: [],
    };
  }

  const baseUrl =
    settings.semanticOllamaBaseUrl.trim() || settings.ollamaBaseUrl.trim();
  const model = settings.semanticOllamaModel.trim();
  if (!baseUrl) {
    throw new Error("Semantic embedding base URL is empty.");
  }
  if (!model) {
    throw new Error("Semantic embedding model is empty.");
  }

  const maxChars = Math.max(400, settings.semanticMaxChars);
  const minSimilarity = Math.max(0, Math.min(1, settings.semanticMinSimilarity));
  const topK = Math.max(1, settings.semanticTopK);

  const corpus: Array<{ file: TFile; text: string }> = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    corpus.push({
      file,
      text: normalizeSourceText(content, maxChars),
    });
  }

  const vectorsByPath = new Map<string, number[]>();
  const errors: string[] = [];

  for (let i = 0; i < corpus.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = corpus.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      const embeddings = await requestOllamaEmbeddings(
        baseUrl,
        model,
        batch.map((item) => item.text),
      );

      if (embeddings.length !== batch.length) {
        throw new Error(
          `Embedding count mismatch (${embeddings.length} vs ${batch.length}).`,
        );
      }

      for (let idx = 0; idx < batch.length; idx += 1) {
        vectorsByPath.set(batch[idx].file.path, embeddings[idx]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown embedding error";
      for (const item of batch) {
        errors.push(`${item.file.path}: ${message}`);
      }
    }
  }

  for (const sourceFile of files) {
    const sourceVector = vectorsByPath.get(sourceFile.path);
    if (!sourceVector) {
      continue;
    }

    const scored: SemanticNeighbor[] = [];

    for (const targetFile of files) {
      if (targetFile.path === sourceFile.path) {
        continue;
      }

      const targetVector = vectorsByPath.get(targetFile.path);
      if (!targetVector) {
        continue;
      }

      const similarity = cosineSimilarity(sourceVector, targetVector);
      if (similarity === null || similarity < minSimilarity) {
        continue;
      }

      scored.push({
        path: targetFile.path,
        similarity,
      });
    }

    scored.sort((a, b) => b.similarity - a.similarity || a.path.localeCompare(b.path));
    neighborMap.set(sourceFile.path, scored.slice(0, topK));
  }

  return {
    neighborMap,
    model,
    generatedVectors: vectorsByPath.size,
    errors,
  };
}
