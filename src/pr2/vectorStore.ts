import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type VectorMeta = {
  schemaVersion: number;
  embedDim: number;
  engineId: string;
  createdAt: string;
  lastCompactionAt?: string;
};

export type VectorRecord = {
  scopeId: string;
  docPath: string;
  chunkId: string;
  chunkHash: string;
  vector: number[];
  dim: number;
  engineId: string;
  updatedAt: string;
  tokenCount?: number;
  tombstone: boolean;
};

type JsonlVectorStoreParams = {
  scopeRoot: string;
  scopeId: string;
  embedDim: number;
  engineId: string;
};

type UpsertInput = {
  docPath: string;
  chunkId: string;
  chunkHash: string;
  vector: number[];
  tokenCount?: number;
  updatedAt?: string;
};

type TombstoneInput = {
  docPath: string;
  chunkId: string;
  chunkHash: string;
  updatedAt?: string;
};

const META_SCHEMA_VERSION = 1;
const RECORDS_SUFFIX = ".jsonl";
const META_SUFFIX = ".meta.json";

function nowIso(): string {
  return new Date().toISOString();
}

function assertNonEmpty(value: string, label: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} is empty.`);
  }
  if (trimmed.includes("\0")) {
    throw new Error(`${label} contains null byte.`);
  }
  return trimmed;
}

function normalizeScopeId(rawScopeId: string): string {
  const scopeId = assertNonEmpty(rawScopeId, "scopeId");
  if (scopeId.includes("/") || scopeId.includes("\\") || scopeId.includes("..")) {
    throw new Error("scopeId contains invalid path token.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(scopeId)) {
    throw new Error("scopeId contains unsupported character.");
  }
  return scopeId;
}

function normalizeDocPath(rawDocPath: string): string {
  const source = assertNonEmpty(rawDocPath, "docPath").replace(/\\/g, "/");
  if (source.startsWith("/") || /^[A-Za-z]:/.test(source)) {
    throw new Error("docPath must be vault-relative.");
  }

  const parts: string[] = [];
  for (const part of source.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      throw new Error("docPath traversal is not allowed.");
    }
    parts.push(part);
  }

  if (parts.length === 0) {
    throw new Error("docPath is empty after normalization.");
  }
  return parts.join("/");
}

function ensureFiniteVector(vector: number[], dim: number): number[] {
  if (!Array.isArray(vector) || vector.length !== dim) {
    throw new Error(`vector dimension mismatch (expected ${dim}).`);
  }
  for (const value of vector) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("vector contains non-finite number.");
    }
  }
  return vector;
}

function normalizePositiveInt(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite.`);
  }
  const n = Math.floor(value);
  if (n <= 0) {
    throw new Error(`${label} must be > 0.`);
  }
  return n;
}

function normalizeTimestamp(raw: string | undefined): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return nowIso();
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return nowIso();
  }
  return new Date(parsed).toISOString();
}

function resolveScopeRoot(rawScopeRoot: string): string {
  const scopeRoot = assertNonEmpty(rawScopeRoot, "scopeRoot");
  return path.resolve(scopeRoot);
}

function assertPathInScopeRoot(scopeRoot: string, targetPath: string): string {
  const resolvedRoot = path.resolve(scopeRoot);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolvedTarget;
  }
  throw new Error(`path outside scope root: ${resolvedTarget}`);
}

function stableRecordKey(record: VectorRecord): string {
  return `${record.scopeId}::${record.docPath}::${record.chunkId}`;
}

function parseJsonLine(line: string): unknown {
  return JSON.parse(line);
}

function toVectorMeta(raw: unknown): VectorMeta {
  if (!raw || typeof raw !== "object") {
    throw new Error("meta is not an object.");
  }
  const source = raw as Partial<VectorMeta>;
  return {
    schemaVersion: normalizePositiveInt(source.schemaVersion as number, "meta.schemaVersion"),
    embedDim: normalizePositiveInt(source.embedDim as number, "meta.embedDim"),
    engineId: assertNonEmpty(String(source.engineId ?? ""), "meta.engineId"),
    createdAt: normalizeTimestamp(source.createdAt),
    lastCompactionAt: source.lastCompactionAt ? normalizeTimestamp(source.lastCompactionAt) : undefined,
  };
}

function toVectorRecord(raw: unknown, expectedScopeId: string, expectedDim: number, expectedEngineId: string): VectorRecord {
  if (!raw || typeof raw !== "object") {
    throw new Error("record is not an object.");
  }
  const source = raw as Partial<VectorRecord>;
  const scopeId = normalizeScopeId(String(source.scopeId ?? ""));
  if (scopeId !== expectedScopeId) {
    throw new Error(`record scopeId mismatch: ${scopeId}`);
  }
  const engineId = assertNonEmpty(String(source.engineId ?? ""), "record.engineId");
  if (engineId !== expectedEngineId) {
    throw new Error(`record engineId mismatch: ${engineId}`);
  }
  const dim = normalizePositiveInt(source.dim as number, "record.dim");
  if (dim !== expectedDim) {
    throw new Error(`record dim mismatch: ${dim}`);
  }

  const tombstone = Boolean(source.tombstone);
  const vectorRaw = Array.isArray(source.vector) ? source.vector : [];
  const vector = tombstone ? [] : ensureFiniteVector(vectorRaw, expectedDim).slice();

  const tokenCountRaw = source.tokenCount;
  let tokenCount: number | undefined;
  if (typeof tokenCountRaw === "number" && Number.isFinite(tokenCountRaw)) {
    tokenCount = Math.max(0, Math.floor(tokenCountRaw));
  }

  return {
    scopeId,
    docPath: normalizeDocPath(String(source.docPath ?? "")),
    chunkId: assertNonEmpty(String(source.chunkId ?? ""), "record.chunkId"),
    chunkHash: assertNonEmpty(String(source.chunkHash ?? ""), "record.chunkHash"),
    vector,
    dim,
    engineId,
    updatedAt: normalizeTimestamp(source.updatedAt),
    tokenCount,
    tombstone,
  };
}

export class JsonlVectorStore {
  private readonly scopeRoot: string;
  private readonly scopeId: string;
  private readonly embedDim: number;
  private readonly engineId: string;
  private readonly scopeDir: string;
  private readonly recordsPath: string;
  private readonly metaPath: string;

  constructor(params: JsonlVectorStoreParams) {
    this.scopeRoot = resolveScopeRoot(params.scopeRoot);
    this.scopeId = normalizeScopeId(params.scopeId);
    this.embedDim = normalizePositiveInt(params.embedDim, "embedDim");
    this.engineId = assertNonEmpty(params.engineId, "engineId");

    const scopeDir = path.join(this.scopeRoot, ".omni-forge", "pr2", "vector");
    this.scopeDir = assertPathInScopeRoot(this.scopeRoot, scopeDir);
    this.recordsPath = assertPathInScopeRoot(this.scopeRoot, path.join(this.scopeDir, `${this.scopeId}${RECORDS_SUFFIX}`));
    this.metaPath = assertPathInScopeRoot(this.scopeRoot, path.join(this.scopeDir, `${this.scopeId}${META_SUFFIX}`));
  }

  getPaths(): { recordsPath: string; metaPath: string } {
    return {
      recordsPath: this.recordsPath,
      metaPath: this.metaPath,
    };
  }

  async ensureInitialized(): Promise<void> {
    await mkdir(this.scopeDir, { recursive: true });

    const metaExists = await this.exists(this.metaPath);
    if (!metaExists) {
      const meta: VectorMeta = {
        schemaVersion: META_SCHEMA_VERSION,
        embedDim: this.embedDim,
        engineId: this.engineId,
        createdAt: nowIso(),
      };
      await writeFile(this.metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
    } else {
      const meta = await this.readMeta();
      if (meta.embedDim !== this.embedDim) {
        throw new Error(`embedDim mismatch (meta=${meta.embedDim}, expected=${this.embedDim}).`);
      }
      if (meta.engineId !== this.engineId) {
        throw new Error(`engineId mismatch (meta=${meta.engineId}, expected=${this.engineId}).`);
      }
    }

    const recordsExists = await this.exists(this.recordsPath);
    if (!recordsExists) {
      await writeFile(this.recordsPath, "", "utf8");
    }
  }

  async readMeta(): Promise<VectorMeta> {
    const raw = await readFile(this.metaPath, "utf8");
    const parsed = toVectorMeta(JSON.parse(raw));
    if (parsed.schemaVersion !== META_SCHEMA_VERSION) {
      throw new Error(`unsupported schemaVersion: ${parsed.schemaVersion}`);
    }
    return parsed;
  }

  async append(record: VectorRecord): Promise<void> {
    await this.ensureInitialized();
    const normalized = toVectorRecord(record, this.scopeId, this.embedDim, this.engineId);
    await this.appendLine(normalized);
  }

  async upsert(input: UpsertInput): Promise<VectorRecord> {
    await this.ensureInitialized();
    const record: VectorRecord = {
      scopeId: this.scopeId,
      docPath: normalizeDocPath(input.docPath),
      chunkId: assertNonEmpty(input.chunkId, "chunkId"),
      chunkHash: assertNonEmpty(input.chunkHash, "chunkHash"),
      vector: ensureFiniteVector(input.vector, this.embedDim).slice(),
      dim: this.embedDim,
      engineId: this.engineId,
      updatedAt: normalizeTimestamp(input.updatedAt),
      tokenCount:
        typeof input.tokenCount === "number" && Number.isFinite(input.tokenCount)
          ? Math.max(0, Math.floor(input.tokenCount))
          : undefined,
      tombstone: false,
    };
    await this.appendLine(record);
    return record;
  }

  async tombstone(input: TombstoneInput): Promise<VectorRecord> {
    await this.ensureInitialized();
    const record: VectorRecord = {
      scopeId: this.scopeId,
      docPath: normalizeDocPath(input.docPath),
      chunkId: assertNonEmpty(input.chunkId, "chunkId"),
      chunkHash: assertNonEmpty(input.chunkHash, "chunkHash"),
      vector: [],
      dim: this.embedDim,
      engineId: this.engineId,
      updatedAt: normalizeTimestamp(input.updatedAt),
      tombstone: true,
    };
    await this.appendLine(record);
    return record;
  }

  async readAll(): Promise<VectorRecord[]> {
    await this.ensureInitialized();
    const content = await readFile(this.recordsPath, "utf8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const records: VectorRecord[] = [];
    for (const line of lines) {
      const parsed = parseJsonLine(line);
      records.push(toVectorRecord(parsed, this.scopeId, this.embedDim, this.engineId));
    }
    return records;
  }

  async compact(): Promise<{ kept: number; dropped: number }> {
    await this.ensureInitialized();
    const records = await this.readAll();
    const latestByKey = new Map<string, VectorRecord>();
    for (const record of records) {
      latestByKey.set(stableRecordKey(record), record);
    }

    const compacted = [...latestByKey.values()]
      .filter((record) => !record.tombstone)
      .sort((a, b) => a.docPath.localeCompare(b.docPath) || a.chunkId.localeCompare(b.chunkId));

    const tmpPath = assertPathInScopeRoot(this.scopeRoot, path.join(this.scopeDir, "records.compact.tmp"));
    const payload = compacted.map((record) => JSON.stringify(record)).join("\n");
    await writeFile(tmpPath, payload.length > 0 ? `${payload}\n` : "", "utf8");
    await rename(tmpPath, this.recordsPath);

    const meta = await this.readMeta();
    const nextMeta: VectorMeta = {
      ...meta,
      lastCompactionAt: nowIso(),
    };
    await writeFile(this.metaPath, `${JSON.stringify(nextMeta, null, 2)}\n`, "utf8");

    return {
      kept: compacted.length,
      dropped: records.length - compacted.length,
    };
  }

  private async appendLine(record: VectorRecord): Promise<void> {
    const nextLine = `${JSON.stringify(record)}\n`;
    await appendFile(this.recordsPath, nextLine, "utf8");
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      const result = await stat(filePath);
      return result.isFile();
    } catch (_error) {
      return false;
    }
  }
}
