import { createHash } from "node:crypto";
import {
  PR1_ERROR_CODES,
  type FileRef,
  type IIndexer,
  type IScopedVault,
  type IndexStatus,
  type ScopeRef
} from "./types.ts";
import {
  SCOPE_STORE_VERSION,
  ScopeStore,
  type ScopeDiffSnapshot,
  type ScopeMoveRecord,
  type ScopeIndexState,
  type StoredFileEntry
} from "./scopeStore.ts";

type ScopeError = Error & { code?: string };

export interface ScopedVaultListResult {
  files: string[];
  folders: string[];
}

export interface ScopedVaultStat {
  mtime?: number;
  size?: number;
}

export interface ScopedVaultAdapter {
  list(path: string): Promise<ScopedVaultListResult>;
  read(path: string): Promise<string>;
  stat(path: string): Promise<ScopedVaultStat | null>;
}

export interface ScopedFileSnapshot {
  fileRef: FileRef;
  mtimeMs: number;
  size: number;
}

export interface IndexScopeResult {
  status: IndexStatus;
  diff: ScopeDiffSnapshot;
}

function buildScopeError(code: string, message: string): ScopeError {
  const error = new Error(`${code}: ${message}`) as ScopeError;
  error.code = code;
  return error;
}

function normalizeVaultRelativePath(rawPath: string, label: string): string {
  const source = String(rawPath ?? "").replace(/\\/g, "/").trim();
  if (!source) {
    throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} is empty.`);
  }
  if (source.includes("\0")) {
    throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} contains null byte.`);
  }
  if (source.startsWith("/") || /^[A-Za-z]:/.test(source)) {
    throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} must be vault-relative.`);
  }

  const parts: string[] = [];
  for (const part of source.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} contains traversal token.`);
    }
    parts.push(part);
  }
  if (parts.length === 0) {
    throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, `${label} is invalid after normalize.`);
  }
  return parts.join("/");
}

function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function isInsideRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value >= 0 ? value : 0;
}

function toFileId(scopeId: string, path: string): string {
  return `${scopeId}:${path}`;
}

function normalizeListResult(source: ScopedVaultListResult): ScopedVaultListResult {
  const files = Array.isArray(source?.files) ? source.files.filter((item): item is string => typeof item === "string") : [];
  const folders = Array.isArray(source?.folders)
    ? source.folders.filter((item): item is string => typeof item === "string")
    : [];
  return { files, folders };
}

function toSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function buildInitialDiff(): ScopeDiffSnapshot {
  return {
    added: [],
    updated: [],
    deleted: [],
    moved: [],
    unchanged: []
  };
}

function detectMoves(added: string[], deleted: string[], nextFiles: Record<string, StoredFileEntry>, previousFiles: Record<string, StoredFileEntry>): {
  moved: ScopeMoveRecord[];
  addedAfterMove: string[];
  deletedAfterMove: string[];
} {
  const addedByChecksum = new Map<string, string[]>();
  const deletedByChecksum = new Map<string, string[]>();

  for (const path of added) {
    const checksum = nextFiles[path]?.checksum;
    if (!checksum) {
      continue;
    }
    const list = addedByChecksum.get(checksum) ?? [];
    list.push(path);
    addedByChecksum.set(checksum, list);
  }

  for (const path of deleted) {
    const checksum = previousFiles[path]?.checksum;
    if (!checksum) {
      continue;
    }
    const list = deletedByChecksum.get(checksum) ?? [];
    list.push(path);
    deletedByChecksum.set(checksum, list);
  }

  const moved: ScopeMoveRecord[] = [];
  const movedAdded = new Set<string>();
  const movedDeleted = new Set<string>();

  for (const [checksum, addedPaths] of addedByChecksum.entries()) {
    const deletedPaths = deletedByChecksum.get(checksum);
    if (!deletedPaths || deletedPaths.length === 0) {
      continue;
    }
    const sortedAdded = sortPaths(addedPaths);
    const sortedDeleted = sortPaths(deletedPaths);
    const pairCount = Math.min(sortedAdded.length, sortedDeleted.length);
    for (let index = 0; index < pairCount; index += 1) {
      const fromPath = sortedDeleted[index];
      const toPath = sortedAdded[index];
      moved.push({ fromPath, toPath, checksum });
      movedAdded.add(toPath);
      movedDeleted.add(fromPath);
    }
  }

  moved.sort((a, b) => a.fromPath.localeCompare(b.fromPath) || a.toPath.localeCompare(b.toPath));
  return {
    moved,
    addedAfterMove: sortPaths(added.filter((path) => !movedAdded.has(path))),
    deletedAfterMove: sortPaths(deleted.filter((path) => !movedDeleted.has(path)))
  };
}

export class ScopedVault implements IScopedVault {
  constructor(private readonly adapter: ScopedVaultAdapter) {}

  private resolveScopeRoots(scopeRef: ScopeRef): string[] {
    const rootsRaw = [scopeRef.rootPath, ...(Array.isArray(scopeRef.includePaths) ? scopeRef.includePaths : [])];
    const roots: string[] = [];
    for (const rootPath of rootsRaw) {
      const normalized = normalizeVaultRelativePath(rootPath, "scopeRoot");
      if (normalized === ".") {
        throw buildScopeError(PR1_ERROR_CODES.DEFAULT_DENY_SCOPE_VIOLATION, "vault-wide root is prohibited.");
      }
      if (!roots.includes(normalized)) {
        roots.push(normalized);
      }
    }
    if (roots.length === 0) {
      throw buildScopeError(PR1_ERROR_CODES.CONTRACT_INVALID_PATH, "scope roots are empty.");
    }
    return roots;
  }

  private resolveExcludePaths(scopeRef: ScopeRef): string[] {
    const excludes = Array.isArray(scopeRef.excludePaths) ? scopeRef.excludePaths : [];
    const normalizedExcludes: string[] = [];
    for (const path of excludes) {
      const normalized = normalizeVaultRelativePath(path, "excludePath");
      if (!normalizedExcludes.includes(normalized)) {
        normalizedExcludes.push(normalized);
      }
    }
    return normalizedExcludes;
  }

  private isPathExcluded(path: string, excludePaths: string[]): boolean {
    return excludePaths.some((excluded) => isInsideRoot(path, excluded));
  }

  private inScope(path: string, roots: string[]): boolean {
    return roots.some((root) => isInsideRoot(path, root));
  }

  async assertPathInScope(scopeRef: ScopeRef, vaultRelativePath: string): Promise<FileRef> {
    const roots = this.resolveScopeRoots(scopeRef);
    const excludes = this.resolveExcludePaths(scopeRef);
    const normalizedPath = normalizeVaultRelativePath(vaultRelativePath, "vaultRelativePath");
    if (this.isPathExcluded(normalizedPath, excludes) || !this.inScope(normalizedPath, roots)) {
      throw buildScopeError(
        PR1_ERROR_CODES.DEFAULT_DENY_SCOPE_VIOLATION,
        `path is outside scope roots (${scopeRef.scopeId}): ${normalizedPath}`
      );
    }
    return {
      fileId: toFileId(scopeRef.scopeId, normalizedPath),
      vaultRelativePath: normalizedPath,
      scopeId: scopeRef.scopeId
    };
  }

  async listScopedFiles(scopeRef: ScopeRef): Promise<FileRef[]> {
    const snapshots = await this.listFilesInScope(scopeRef);
    return snapshots.map((snapshot) => snapshot.fileRef);
  }

  async readFile(fileRef: FileRef): Promise<string> {
    const normalizedPath = normalizeVaultRelativePath(fileRef.vaultRelativePath, "fileRef.vaultRelativePath");
    return this.adapter.read(normalizedPath);
  }

  async listFilesInScope(scopeRef: ScopeRef): Promise<ScopedFileSnapshot[]> {
    const roots = this.resolveScopeRoots(scopeRef);
    const excludes = this.resolveExcludePaths(scopeRef);
    const visited = new Set<string>();
    const snapshots = new Map<string, ScopedFileSnapshot>();

    const tryAddFile = async (filePath: string): Promise<void> => {
      const normalizedPath = normalizeVaultRelativePath(filePath, "listedFile");
      if (this.isPathExcluded(normalizedPath, excludes)) {
        return;
      }
      const fileRef = await this.assertPathInScope(scopeRef, normalizedPath);
      if (!isMarkdownPath(fileRef.vaultRelativePath)) {
        return;
      }
      const stat = await this.adapter.stat(fileRef.vaultRelativePath);
      if (!stat) {
        return;
      }
      snapshots.set(fileRef.vaultRelativePath, {
        fileRef: {
          ...fileRef,
          modifiedAt: toNonNegativeNumber(stat.mtime)
        },
        mtimeMs: toNonNegativeNumber(stat.mtime),
        size: toNonNegativeNumber(stat.size)
      });
    };

    const walk = async (folderPath: string): Promise<void> => {
      const normalizedFolder = normalizeVaultRelativePath(folderPath, "scopeFolder");
      if (visited.has(normalizedFolder)) {
        return;
      }
      if (this.isPathExcluded(normalizedFolder, excludes)) {
        return;
      }
      await this.assertPathInScope(scopeRef, normalizedFolder);
      visited.add(normalizedFolder);

      let listing: ScopedVaultListResult | null = null;
      try {
        listing = normalizeListResult(await this.adapter.list(normalizedFolder));
      } catch (_error) {
        await tryAddFile(normalizedFolder);
        return;
      }

      for (const childFolder of listing.folders) {
        const normalizedChild = normalizeVaultRelativePath(childFolder, "listedFolder");
        if (!this.inScope(normalizedChild, roots) || this.isPathExcluded(normalizedChild, excludes)) {
          continue;
        }
        await walk(normalizedChild);
      }

      for (const childFile of listing.files) {
        await tryAddFile(childFile);
      }
    };

    for (const root of roots) {
      await walk(root);
    }

    return [...snapshots.values()].sort((a, b) => a.fileRef.vaultRelativePath.localeCompare(b.fileRef.vaultRelativePath));
  }
}

export class FolderScopedIndexer implements IIndexer {
  constructor(private readonly scopedVault: ScopedVault, private readonly scopeStore: ScopeStore) {}

  async ensureReady(scopeRef: ScopeRef): Promise<IndexStatus> {
    const status = await this.getStatus(scopeRef);
    if (status.ready) {
      return status;
    }
    return this.indexScope(scopeRef);
  }

  async getStatus(scopeRef: ScopeRef): Promise<IndexStatus> {
    const state = await this.scopeStore.load(scopeRef.scopeId);
    const indexedFiles = Object.keys(state.files).length;
    return {
      scopeId: scopeRef.scopeId,
      ready: indexedFiles > 0,
      indexedFiles,
      indexedChunks: 0,
      updatedAt: state.updatedAt
    };
  }

  async indexScope(scopeRef: ScopeRef): Promise<IndexStatus> {
    const result = await this.indexScopeWithDiff(scopeRef);
    return result.status;
  }

  async indexScopeWithDiff(scopeRef: ScopeRef): Promise<IndexScopeResult> {
    const previousState = await this.scopeStore.load(scopeRef.scopeId);
    const snapshots = await this.scopedVault.listFilesInScope(scopeRef);
    const now = new Date().toISOString();

    const nextFiles: Record<string, StoredFileEntry> = {};
    const diff = buildInitialDiff();

    for (const snapshot of snapshots) {
      const path = snapshot.fileRef.vaultRelativePath;
      const previous = previousState.files[path];
      let checksum = previous?.checksum ?? "";

      if (!previous || previous.mtimeMs !== snapshot.mtimeMs || previous.size !== snapshot.size || !checksum) {
        const content = await this.scopedVault.readFile(snapshot.fileRef);
        checksum = toSha256(content);
      }

      nextFiles[path] = {
        fileRef: {
          ...snapshot.fileRef,
          checksum,
          modifiedAt: snapshot.mtimeMs
        },
        mtimeMs: snapshot.mtimeMs,
        size: snapshot.size,
        checksum,
        indexedAt: now
      };

      if (!previous) {
        diff.added.push(path);
      } else if (previous.checksum !== checksum) {
        diff.updated.push(path);
      } else {
        diff.unchanged.push(path);
      }
    }

    for (const path of Object.keys(previousState.files)) {
      if (!nextFiles[path]) {
        diff.deleted.push(path);
      }
    }

    const moveDetection = detectMoves(diff.added, diff.deleted, nextFiles, previousState.files);
    diff.added = moveDetection.addedAfterMove;
    diff.deleted = moveDetection.deletedAfterMove;
    diff.moved = moveDetection.moved;
    diff.updated = sortPaths(diff.updated);
    diff.unchanged = sortPaths(diff.unchanged);

    const nextState: ScopeIndexState = {
      version: SCOPE_STORE_VERSION,
      scopeId: scopeRef.scopeId,
      rootPath: normalizeVaultRelativePath(scopeRef.rootPath, "scopeRef.rootPath"),
      files: nextFiles,
      updatedAt: now,
      lastDiff: diff
    };
    const savedState = await this.scopeStore.save(scopeRef.scopeId, nextState);
    const status: IndexStatus = {
      scopeId: scopeRef.scopeId,
      ready: Object.keys(savedState.files).length > 0,
      indexedFiles: Object.keys(savedState.files).length,
      indexedChunks: 0,
      updatedAt: savedState.updatedAt
    };
    return {
      status,
      diff
    };
  }
}
