import { PR1_ERROR_CODES, type FileRef } from "./types.ts";

export const SCOPE_STORE_VERSION = 1;
export const DEFAULT_SCOPE_STORE_BASE_DIR = ".omni-forge/pr1/index";

type ScopeStoreError = Error & { code?: string };

export interface ScopeStoreAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  mkdir?(path: string): Promise<void>;
}

export interface ScopeStoreOptions {
  baseDir?: string;
}

export interface ScopeMoveRecord {
  fromPath: string;
  toPath: string;
  checksum: string;
}

export interface ScopeDiffSnapshot {
  added: string[];
  updated: string[];
  deleted: string[];
  moved: ScopeMoveRecord[];
  unchanged: string[];
}

export interface StoredFileEntry {
  fileRef: FileRef;
  mtimeMs: number;
  size: number;
  checksum: string;
  indexedAt: string;
}

export interface ScopeIndexState {
  version: number;
  scopeId: string;
  rootPath: string;
  files: Record<string, StoredFileEntry>;
  updatedAt?: string;
  lastDiff?: ScopeDiffSnapshot;
}

function buildScopeStoreError(code: string, message: string): ScopeStoreError {
  const error = new Error(`${code}: ${message}`) as ScopeStoreError;
  error.code = code;
  return error;
}

function normalizeVaultRelativePath(rawPath: string, label: string): string {
  const source = String(rawPath ?? "").replace(/\\/g, "/").trim();
  if (!source) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} is empty.`);
  }
  if (source.includes("\0")) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} contains null byte.`);
  }
  if (source.startsWith("/") || /^[A-Za-z]:/.test(source)) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} must be vault-relative.`);
  }

  const parts: string[] = [];
  for (const part of source.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} contains traversal token.`);
    }
    parts.push(part);
  }
  if (parts.length === 0) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} is invalid after normalize.`);
  }
  return parts.join("/");
}

function normalizeScopeId(rawScopeId: string): string {
  const scopeId = String(rawScopeId ?? "").trim();
  if (!scopeId) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, "scopeId is empty.");
  }
  if (scopeId.startsWith("/") || /^[A-Za-z]:/.test(scopeId)) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, "scopeId must not be absolute path.");
  }
  if (scopeId.includes("/") || scopeId.includes("\\") || scopeId.includes("..") || scopeId.includes("\0")) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, "scopeId contains invalid characters.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(scopeId)) {
    throw buildScopeStoreError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, "scopeId contains unsupported characters.");
  }
  return scopeId;
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value >= 0 ? value : 0;
}

function toIsoString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString();
}

function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function normalizeFileRef(rawFileRef: unknown, expectedScopeId: string, fallbackPath: string): FileRef | null {
  if (!rawFileRef || typeof rawFileRef !== "object") {
    return null;
  }
  const source = rawFileRef as Partial<FileRef>;
  const rawPath = typeof source.vaultRelativePath === "string" ? source.vaultRelativePath : fallbackPath;
  let vaultRelativePath = "";
  try {
    vaultRelativePath = normalizeVaultRelativePath(rawPath, "stored.fileRef.vaultRelativePath");
  } catch (_error) {
    return null;
  }

  const scopeId = typeof source.scopeId === "string" && source.scopeId.trim().length > 0 ? source.scopeId.trim() : expectedScopeId;
  if (scopeId !== expectedScopeId) {
    return null;
  }

  const fileId = typeof source.fileId === "string" && source.fileId.trim().length > 0 ? source.fileId.trim() : `${scopeId}:${vaultRelativePath}`;
  const checksum = typeof source.checksum === "string" && source.checksum.trim().length > 0 ? source.checksum.trim() : undefined;
  const modifiedAt = typeof source.modifiedAt === "number" && Number.isFinite(source.modifiedAt) ? source.modifiedAt : undefined;

  return {
    fileId,
    vaultRelativePath,
    scopeId,
    checksum,
    modifiedAt
  };
}

function normalizeStoredFileEntry(rawEntry: unknown, expectedScopeId: string, fallbackPath: string): StoredFileEntry | null {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }
  const source = rawEntry as Partial<StoredFileEntry> & { fileRef?: unknown };
  const fileRef = normalizeFileRef(source.fileRef, expectedScopeId, fallbackPath);
  if (!fileRef) {
    return null;
  }
  const checksum = typeof source.checksum === "string" ? source.checksum.trim() : "";
  if (!checksum) {
    return null;
  }

  return {
    fileRef: {
      ...fileRef,
      checksum
    },
    checksum,
    mtimeMs: toNonNegativeNumber(source.mtimeMs),
    size: toNonNegativeNumber(source.size),
    indexedAt: toIsoString(source.indexedAt) || new Date().toISOString()
  };
}

function normalizeMoveRecord(rawRecord: unknown): ScopeMoveRecord | null {
  if (!rawRecord || typeof rawRecord !== "object") {
    return null;
  }
  const source = rawRecord as Partial<ScopeMoveRecord>;
  if (typeof source.fromPath !== "string" || typeof source.toPath !== "string" || typeof source.checksum !== "string") {
    return null;
  }
  try {
    const fromPath = normalizeVaultRelativePath(source.fromPath, "lastDiff.moved.fromPath");
    const toPath = normalizeVaultRelativePath(source.toPath, "lastDiff.moved.toPath");
    const checksum = source.checksum.trim();
    if (!checksum) {
      return null;
    }
    return { fromPath, toPath, checksum };
  } catch (_error) {
    return null;
  }
}

function normalizeDiffSnapshot(rawDiff: unknown): ScopeDiffSnapshot | undefined {
  if (!rawDiff || typeof rawDiff !== "object") {
    return undefined;
  }
  const source = rawDiff as Partial<ScopeDiffSnapshot>;
  const normalizePathList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }
      try {
        out.push(normalizeVaultRelativePath(item, "lastDiff.path"));
      } catch (_error) {
        continue;
      }
    }
    return sortPaths(Array.from(new Set(out)));
  };

  const moved = Array.isArray(source.moved) ? source.moved.map((item) => normalizeMoveRecord(item)).filter((item): item is ScopeMoveRecord => Boolean(item)) : [];
  moved.sort((a, b) => a.fromPath.localeCompare(b.fromPath) || a.toPath.localeCompare(b.toPath));
  return {
    added: normalizePathList(source.added),
    updated: normalizePathList(source.updated),
    deleted: normalizePathList(source.deleted),
    moved,
    unchanged: normalizePathList(source.unchanged)
  };
}

function buildEmptyState(scopeId: string): ScopeIndexState {
  return {
    version: SCOPE_STORE_VERSION,
    scopeId,
    rootPath: "",
    files: {},
    updatedAt: undefined,
    lastDiff: {
      added: [],
      updated: [],
      deleted: [],
      moved: [],
      unchanged: []
    }
  };
}

function sortStoredFiles(files: Record<string, StoredFileEntry>): Record<string, StoredFileEntry> {
  const sorted: Record<string, StoredFileEntry> = {};
  for (const path of sortPaths(Object.keys(files))) {
    sorted[path] = files[path];
  }
  return sorted;
}

export class ScopeStore {
  private readonly baseDir: string;

  constructor(private readonly adapter: ScopeStoreAdapter, options: ScopeStoreOptions = {}) {
    this.baseDir = normalizeVaultRelativePath(options.baseDir ?? DEFAULT_SCOPE_STORE_BASE_DIR, "scopeStore.baseDir");
  }

  private buildStatePath(scopeId: string): string {
    const normalizedScopeId = normalizeScopeId(scopeId);
    return `${this.baseDir}/${encodeURIComponent(normalizedScopeId)}.json`;
  }

  private async ensureBaseDir(): Promise<void> {
    if (!this.adapter.mkdir) {
      return;
    }
    const parts = this.baseDir.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      let exists = false;
      try {
        exists = await this.adapter.exists(current);
      } catch (_error) {
        exists = false;
      }
      if (exists) {
        continue;
      }
      try {
        await this.adapter.mkdir(current);
      } catch (_error) {
        // Ignore already-exists race.
      }
    }
  }

  private normalizeState(rawState: unknown, scopeId: string): ScopeIndexState {
    const fallback = buildEmptyState(scopeId);
    if (!rawState || typeof rawState !== "object") {
      return fallback;
    }
    const source = rawState as Partial<ScopeIndexState>;
    const rawFiles = source.files && typeof source.files === "object" ? source.files : {};
    const normalizedFiles: Record<string, StoredFileEntry> = {};

    for (const [rawPath, rawEntry] of Object.entries(rawFiles)) {
      const normalizedPath = (() => {
        try {
          return normalizeVaultRelativePath(rawPath, "stored.files.key");
        } catch (_error) {
          return "";
        }
      })();
      if (!normalizedPath) {
        continue;
      }
      const normalizedEntry = normalizeStoredFileEntry(rawEntry, scopeId, normalizedPath);
      if (!normalizedEntry) {
        continue;
      }
      normalizedFiles[normalizedPath] = normalizedEntry;
    }

    const rootPath = typeof source.rootPath === "string" ? source.rootPath.trim() : "";
    const normalizedRootPath = rootPath ? normalizeVaultRelativePath(rootPath, "stored.rootPath") : "";

    return {
      version: SCOPE_STORE_VERSION,
      scopeId,
      rootPath: normalizedRootPath,
      files: sortStoredFiles(normalizedFiles),
      updatedAt: toIsoString(source.updatedAt) || undefined,
      lastDiff: normalizeDiffSnapshot(source.lastDiff) ?? fallback.lastDiff
    };
  }

  async load(scopeId: string): Promise<ScopeIndexState> {
    const normalizedScopeId = normalizeScopeId(scopeId);
    const statePath = this.buildStatePath(normalizedScopeId);
    const exists = await this.adapter.exists(statePath);
    if (!exists) {
      return buildEmptyState(normalizedScopeId);
    }
    try {
      const raw = await this.adapter.read(statePath);
      return this.normalizeState(JSON.parse(raw), normalizedScopeId);
    } catch (_error) {
      return buildEmptyState(normalizedScopeId);
    }
  }

  async save(scopeId: string, state: ScopeIndexState): Promise<ScopeIndexState> {
    const normalizedScopeId = normalizeScopeId(scopeId);
    const normalizedState = this.normalizeState(state, normalizedScopeId);
    const finalState: ScopeIndexState = {
      ...normalizedState,
      updatedAt: new Date().toISOString(),
      files: sortStoredFiles(normalizedState.files)
    };
    const statePath = this.buildStatePath(normalizedScopeId);
    await this.ensureBaseDir();
    await this.adapter.write(statePath, JSON.stringify(finalState, null, 2));
    return finalState;
  }
}
