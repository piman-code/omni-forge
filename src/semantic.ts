import { App, TFile, normalizePath, requestUrl } from "obsidian";
import type { KnowledgeWeaverSettings } from "./types";

const EMBEDDING_BATCH_SIZE = 8;
const EMBEDDING_CACHE_PATH = "Auto-Linker Cache/semantic-embedding-cache.json";
const EMBEDDING_CACHE_VERSION = 1;
const EMBEDDING_MODEL_REGEX =
  /(embed|embedding|nomic-embed|mxbai|bge|e5|gte|arctic-embed|jina-emb)/i;
const NON_EMBEDDING_MODEL_REGEX =
  /(whisper|tts|speech|transcribe|stt|rerank)/i;

export interface SemanticNeighbor {
  path: string;
  similarity: number;
}

export interface SemanticNeighborResult {
  neighborMap: Map<string, SemanticNeighbor[]>;
  model: string;
  generatedVectors: number;
  cacheHits: number;
  cacheWrites: number;
  errors: string[];
}

export interface SemanticQueryHit {
  path: string;
  similarity: number;
}

export interface SemanticQueryResult {
  hits: SemanticQueryHit[];
  model: string;
  generatedVectors: number;
  cacheHits: number;
  cacheWrites: number;
  errors: string[];
}

interface EmbeddingCacheEntry {
  fingerprint: string;
  vector: number[];
  updatedAt: string;
}

interface EmbeddingCacheData {
  version: number;
  entries: Record<string, EmbeddingCacheEntry>;
}

interface EmbeddingConfig {
  baseUrl: string;
  model: string;
}

interface FileVectorBuildResult {
  vectorsByPath: Map<string, number[]>;
  cacheHits: number;
  cacheWrites: number;
  errors: string[];
}

export interface OllamaEmbeddingDetectionResult {
  models: string[];
  recommended?: string;
  reason: string;
}

export interface OllamaEmbeddingModelOption {
  model: string;
  status: "recommended" | "available" | "unavailable";
  reason: string;
}

export function isOllamaModelEmbeddingCapable(modelName: string): boolean {
  return (
    EMBEDDING_MODEL_REGEX.test(modelName) &&
    !NON_EMBEDDING_MODEL_REGEX.test(modelName)
  );
}

function scoreEmbeddingModel(modelName: string): number {
  const lower = modelName.toLowerCase();
  let score = 0;

  if (/nomic-embed-text/.test(lower)) {
    score += 40;
  }
  if (/bge-m3|bge-large|bge-base/.test(lower)) {
    score += 35;
  }
  if (/mxbai-embed-large/.test(lower)) {
    score += 30;
  }
  if (/e5-large|gte-large/.test(lower)) {
    score += 25;
  }
  if (/embed|embedding/.test(lower)) {
    score += 10;
  }
  if (/:large|:xl/.test(lower)) {
    score += 5;
  }
  if (/:small|:mini|:base/.test(lower)) {
    score -= 2;
  }

  return score;
}

function describeEmbeddingModel(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (!isOllamaModelEmbeddingCapable(modelName)) {
    return "Looks non-embedding model for semantic retrieval.";
  }
  if (/nomic-embed-text/.test(lower)) {
    return "Strong local embedding baseline with broad retrieval quality.";
  }
  if (/bge|e5|gte|mxbai/.test(lower)) {
    return "Embedding family suitable for semantic note similarity.";
  }
  return "Embedding-capable model candidate.";
}

function recommendEmbeddingModel(models: string[]): {
  recommended?: string;
  reason: string;
} {
  if (models.length === 0) {
    return {
      reason:
        "No local Ollama models were detected. Install at least one embedding model.",
    };
  }

  const candidates = models.filter((model) => isOllamaModelEmbeddingCapable(model));
  if (candidates.length === 0) {
    return {
      reason:
        "No embedding-capable model detected. Install nomic-embed-text, bge, e5, or similar.",
    };
  }

  const scored = candidates
    .map((name) => ({ name, score: scoreEmbeddingModel(name) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const winner = scored[0]?.name;
  if (!winner) {
    return { reason: "Could not choose an embedding model." };
  }

  return {
    recommended: winner,
    reason: `Recommended '${winner}' for semantic embedding quality/speed balance.`,
  };
}

export function buildOllamaEmbeddingModelOptions(
  models: string[],
  recommended?: string,
): OllamaEmbeddingModelOption[] {
  const options = models.map((model): OllamaEmbeddingModelOption => {
    if (!isOllamaModelEmbeddingCapable(model)) {
      return {
        model,
        status: "unavailable",
        reason: describeEmbeddingModel(model),
      };
    }
    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: describeEmbeddingModel(model),
      };
    }
    return {
      model,
      status: "available",
      reason: describeEmbeddingModel(model),
    };
  });

  const weight = (status: OllamaEmbeddingModelOption["status"]): number => {
    switch (status) {
      case "recommended":
        return 0;
      case "available":
        return 1;
      case "unavailable":
        return 2;
      default:
        return 3;
    }
  };

  return options.sort(
    (a, b) => weight(a.status) - weight(b.status) || a.model.localeCompare(b.model),
  );
}

export async function detectOllamaEmbeddingModels(
  baseUrl: string,
): Promise<OllamaEmbeddingDetectionResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const response = await requestUrl({
    url,
    method: "GET",
    throw: false,
  });

  if (response.status >= 300) {
    throw new Error(`Ollama embedding model detection failed: ${response.status}`);
  }

  const rawModels: Array<Record<string, unknown>> = Array.isArray(
    response.json?.models,
  )
    ? (response.json.models as Array<Record<string, unknown>>)
    : [];

  const modelNames = rawModels
    .map((item) => {
      if (typeof item.name === "string") {
        return item.name.trim();
      }
      if (typeof item.model === "string") {
        return item.model.trim();
      }
      return "";
    })
    .filter((name) => name.length > 0);

  const uniqueSorted = [...new Set(modelNames)].sort((a, b) =>
    a.localeCompare(b),
  );
  const recommendation = recommendEmbeddingModel(uniqueSorted);

  return {
    models: uniqueSorted,
    recommended: recommendation.recommended,
    reason: recommendation.reason,
  };
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

function fingerprintText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildCacheKey(baseUrl: string, model: string, filePath: string): string {
  return `${baseUrl}::${model}::${filePath}`;
}

async function ensureParentFolder(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  const chunks = normalized.split("/");
  chunks.pop();
  if (chunks.length === 0) {
    return;
  }

  let currentPath = "";
  for (const part of chunks) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(currentPath);
    if (existing) {
      continue;
    }
    await app.vault.createFolder(currentPath);
  }
}

async function readEmbeddingCache(app: App): Promise<EmbeddingCacheData> {
  const path = normalizePath(EMBEDDING_CACHE_PATH);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    return { version: EMBEDDING_CACHE_VERSION, entries: {} };
  }

  try {
    const raw = await app.vault.adapter.read(path);
    const parsed = JSON.parse(raw) as Partial<EmbeddingCacheData>;
    const version =
      typeof parsed.version === "number" ? parsed.version : EMBEDDING_CACHE_VERSION;
    const entries =
      parsed.entries && typeof parsed.entries === "object"
        ? (parsed.entries as Record<string, EmbeddingCacheEntry>)
        : {};

    if (version !== EMBEDDING_CACHE_VERSION) {
      return { version: EMBEDDING_CACHE_VERSION, entries: {} };
    }

    return { version, entries };
  } catch {
    return { version: EMBEDDING_CACHE_VERSION, entries: {} };
  }
}

async function writeEmbeddingCache(app: App, cache: EmbeddingCacheData): Promise<void> {
  const path = normalizePath(EMBEDDING_CACHE_PATH);
  await ensureParentFolder(app, path);
  await app.vault.adapter.write(path, JSON.stringify(cache));
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

function resolveEmbeddingConfig(settings: KnowledgeWeaverSettings): EmbeddingConfig {
  const baseUrl =
    settings.semanticOllamaBaseUrl.trim() || settings.ollamaBaseUrl.trim();
  const model = settings.semanticOllamaModel.trim();
  if (!baseUrl) {
    throw new Error("Semantic embedding base URL is empty.");
  }
  if (!model) {
    throw new Error("Semantic embedding model is empty.");
  }

  return { baseUrl, model };
}

async function buildFileVectorIndex(
  app: App,
  files: TFile[],
  config: EmbeddingConfig,
  maxChars: number,
): Promise<FileVectorBuildResult> {
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
  const cache = await readEmbeddingCache(app);
  let cacheHits = 0;
  let cacheWrites = 0;
  let cacheDirty = false;
  const missing: Array<{
    file: TFile;
    text: string;
    cacheKey: string;
    fingerprint: string;
  }> = [];

  for (const item of corpus) {
    const fingerprint = fingerprintText(item.text);
    const cacheKey = buildCacheKey(config.baseUrl, config.model, item.file.path);
    const hit = cache.entries[cacheKey];
    if (
      hit &&
      hit.fingerprint === fingerprint &&
      Array.isArray(hit.vector) &&
      hit.vector.length > 0
    ) {
      vectorsByPath.set(item.file.path, hit.vector);
      cacheHits += 1;
      continue;
    }

    missing.push({
      file: item.file,
      text: item.text,
      cacheKey,
      fingerprint,
    });
  }

  for (let i = 0; i < missing.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = missing.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      const embeddings = await requestOllamaEmbeddings(
        config.baseUrl,
        config.model,
        batch.map((item) => item.text),
      );

      if (embeddings.length !== batch.length) {
        throw new Error(
          `Embedding count mismatch (${embeddings.length} vs ${batch.length}).`,
        );
      }

      for (let idx = 0; idx < batch.length; idx += 1) {
        const entry = batch[idx];
        const vector = embeddings[idx];
        vectorsByPath.set(entry.file.path, vector);
        cache.entries[entry.cacheKey] = {
          fingerprint: entry.fingerprint,
          vector,
          updatedAt: new Date().toISOString(),
        };
        cacheWrites += 1;
        cacheDirty = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown embedding error";
      for (const item of batch) {
        errors.push(`${item.file.path}: ${message}`);
      }
    }
  }

  if (cacheDirty) {
    try {
      await writeEmbeddingCache(app, cache);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown embedding cache write error";
      errors.push(`cache-write: ${message}`);
    }
  }

  return {
    vectorsByPath,
    cacheHits,
    cacheWrites,
    errors,
  };
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
      cacheHits: 0,
      cacheWrites: 0,
      errors: [],
    };
  }

  const config = resolveEmbeddingConfig(settings);
  const model = config.model;
  const maxChars = Math.max(400, settings.semanticMaxChars);
  const minSimilarity = Math.max(0, Math.min(1, settings.semanticMinSimilarity));
  const topK = Math.max(1, settings.semanticTopK);
  const vectorBuild = await buildFileVectorIndex(
    app,
    files,
    config,
    maxChars,
  );
  const vectorsByPath = vectorBuild.vectorsByPath;
  const errors = [...vectorBuild.errors];
  const cacheHits = vectorBuild.cacheHits;
  const cacheWrites = vectorBuild.cacheWrites;

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
    cacheHits,
    cacheWrites,
    errors,
  };
}

export async function searchSemanticNotesByQuery(
  app: App,
  files: TFile[],
  settings: KnowledgeWeaverSettings,
  query: string,
  topK: number,
): Promise<SemanticQueryResult> {
  if (files.length === 0) {
    return {
      hits: [],
      model: settings.semanticOllamaModel,
      generatedVectors: 0,
      cacheHits: 0,
      cacheWrites: 0,
      errors: [],
    };
  }

  const config = resolveEmbeddingConfig(settings);
  const maxChars = Math.max(400, settings.semanticMaxChars);
  const queryText = normalizeSourceText(query, maxChars);
  const safeTopK = Math.max(1, topK);

  const vectorBuild = await buildFileVectorIndex(app, files, config, maxChars);
  const hits: SemanticQueryHit[] = [];
  const errors = [...vectorBuild.errors];

  let queryVector: number[] | null = null;
  try {
    const queryEmbeddings = await requestOllamaEmbeddings(config.baseUrl, config.model, [
      queryText,
    ]);
    queryVector = queryEmbeddings[0] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown query embedding error";
    errors.push(`query: ${message}`);
  }

  if (queryVector) {
    for (const file of files) {
      const fileVector = vectorBuild.vectorsByPath.get(file.path);
      if (!fileVector) {
        continue;
      }
      const similarity = cosineSimilarity(queryVector, fileVector);
      if (similarity === null) {
        continue;
      }
      hits.push({
        path: file.path,
        similarity,
      });
    }
  }

  hits.sort((a, b) => b.similarity - a.similarity || a.path.localeCompare(b.path));

  return {
    hits: hits.slice(0, safeTopK),
    model: config.model,
    generatedVectors: vectorBuild.vectorsByPath.size,
    cacheHits: vectorBuild.cacheHits,
    cacheWrites: vectorBuild.cacheWrites,
    errors,
  };
}
