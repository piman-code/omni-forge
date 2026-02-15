import { App, TFile, normalizePath } from "obsidian";
import type { ManagedFrontmatter } from "./types";

export const MANAGED_KEYS = ["tags", "topic", "linked", "index"] as const;
const MANAGED_KEY_SET = new Set<string>(MANAGED_KEYS.map((key) => key.toLowerCase()));

export const PROTECTED_FRONTMATTER_KEYS = new Set<string>([
  "date created",
  "date modified",
  "date updated",
  "date_created",
  "date_modified",
  "date_updated",
  "created",
  "updated",
  "modified",
]);

const LEGACY_REMOVABLE_KEY_PREFIXES = ["ai_", "autolinker_", "auto_linker_"];

export interface FrontmatterCleanupConfig {
  removeKeys: Set<string>;
  removePrefixes: string[];
  keepKeys: Set<string>;
}

interface FrontmatterRetentionOptions {
  cleanUnknown: boolean;
  cleanupConfig?: FrontmatterCleanupConfig;
  dropManaged: boolean;
}

interface FrontmatterBuildOptions {
  cleanUnknown: boolean;
  sortArrays: boolean;
  cleanupConfig?: FrontmatterCleanupConfig;
}

interface FrontmatterCleanupOnlyOptions {
  cleanUnknown: boolean;
  cleanupConfig?: FrontmatterCleanupConfig;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toSingleString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTag(rawTag: string): string {
  const normalized = rawTag
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[`"'\\]+/g, "");

  if (!normalized) {
    return "";
  }

  const lower = normalized.toLowerCase();
  const looksLikePath =
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    /^[A-Za-z]:[\\/]/.test(normalized) ||
    /^\/(usr|bin|sbin|etc|opt|var|tmp|home|users)\//i.test(lower) ||
    lower.startsWith("usr/bin/") ||
    lower.includes("/usr/bin/env");
  const looksLikeCode =
    normalized.startsWith("!") ||
    normalized.startsWith("#!") ||
    normalized.includes("://") ||
    /[{}()[\];|<>$]/.test(normalized);

  if (looksLikePath || looksLikeCode || normalized.length > 64) {
    return "";
  }

  if (!/[0-9A-Za-z가-힣]/.test(normalized)) {
    return "";
  }

  return normalized;
}

export function normalizeTags(tags: string[]): string[] {
  const deduped = new Set<string>();

  for (const rawTag of tags) {
    const normalized = normalizeTag(rawTag);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

function stripWikiSyntax(raw: string): string {
  return raw
    .trim()
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .split("#")[0]
    .trim();
}

function resolveExistingMarkdownFile(
  app: App,
  sourcePath: string,
  rawLink: string,
): TFile | null {
  const cleaned = stripWikiSyntax(rawLink);
  if (!cleaned) {
    return null;
  }

  const directPath = cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
  const direct = app.vault.getAbstractFileByPath(normalizePath(directPath));
  if (direct instanceof TFile && direct.extension === "md") {
    return direct;
  }

  const resolved = app.metadataCache.getFirstLinkpathDest(cleaned, sourcePath);
  if (resolved instanceof TFile && resolved.extension === "md") {
    return resolved;
  }

  return null;
}

export function normalizeLinked(
  app: App,
  sourcePath: string,
  linked: string[],
  allowedPaths?: Set<string>,
): string[] {
  const deduped = new Set<string>();

  for (const candidate of linked) {
    const file = resolveExistingMarkdownFile(app, sourcePath, candidate);
    if (!file) {
      continue;
    }
    if (allowedPaths && !allowedPaths.has(file.path)) {
      continue;
    }
    if (file.path === sourcePath) {
      continue;
    }

    const linkText = app.metadataCache.fileToLinktext(file, sourcePath, true);
    deduped.add(`[[${linkText}]]`);
  }

  return [...deduped];
}

export function extractManagedFrontmatter(
  frontmatter: Record<string, unknown> | null | undefined,
): ManagedFrontmatter {
  const source = frontmatter ?? {};
  return {
    tags: normalizeTags(toStringArray(source.tags)),
    topic: toSingleString(source.topic),
    linked: toStringArray(source.linked),
    index: toSingleString(source.index),
  };
}

export function normalizeManagedFrontmatter(
  managed: ManagedFrontmatter,
): ManagedFrontmatter {
  const topic = managed.topic?.trim();
  const index = managed.index?.trim();

  return {
    tags: normalizeTags(managed.tags),
    topic: topic && topic.length > 0 ? topic : undefined,
    linked: managed.linked
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, idx, arr) => arr.indexOf(item) === idx),
    index: index && index.length > 0 ? index : undefined,
  };
}

function shouldRemoveByRules(
  normalizedKey: string,
  options: FrontmatterRetentionOptions,
): boolean {
  if (PROTECTED_FRONTMATTER_KEYS.has(normalizedKey)) {
    return false;
  }

  const keepKeys = options.cleanupConfig?.keepKeys;
  if (keepKeys && keepKeys.has(normalizedKey)) {
    return false;
  }

  const legacyRemovable = LEGACY_REMOVABLE_KEY_PREFIXES.some((prefix) =>
    normalizedKey.startsWith(prefix),
  );

  if (options.cleanUnknown && legacyRemovable) {
    return true;
  }

  const removeKeys = options.cleanupConfig?.removeKeys;
  if (removeKeys && removeKeys.has(normalizedKey)) {
    return true;
  }

  const removePrefixes = options.cleanupConfig?.removePrefixes ?? [];
  if (removePrefixes.some((prefix) => normalizedKey.startsWith(prefix))) {
    return true;
  }

  return false;
}

function buildRetainedFrontmatter(
  current: Record<string, unknown>,
  options: FrontmatterRetentionOptions,
): { next: Record<string, unknown>; removedKeys: string[] } {
  const next: Record<string, unknown> = {};
  const removedKeys: string[] = [];

  for (const [key, value] of Object.entries(current)) {
    const normalizedKey = key.trim().toLowerCase();
    const isManaged = MANAGED_KEY_SET.has(normalizedKey);

    if (isManaged && options.dropManaged) {
      removedKeys.push(key);
      continue;
    }

    if (shouldRemoveByRules(normalizedKey, options)) {
      removedKeys.push(key);
      continue;
    }

    next[key] = value;
  }

  return { next, removedKeys };
}

export function cleanupFrontmatterRecord(
  current: Record<string, unknown>,
  options: FrontmatterCleanupOnlyOptions,
): { next: Record<string, unknown>; removedKeys: string[] } {
  return buildRetainedFrontmatter(current, {
    cleanUnknown: options.cleanUnknown,
    cleanupConfig: options.cleanupConfig,
    dropManaged: false,
  });
}

export function buildNextFrontmatter(
  current: Record<string, unknown>,
  proposed: ManagedFrontmatter,
  options: FrontmatterBuildOptions,
): Record<string, unknown> {
  const { next } = buildRetainedFrontmatter(current, {
    cleanUnknown: options.cleanUnknown,
    cleanupConfig: options.cleanupConfig,
    dropManaged: true,
  });

  const tags = options.sortArrays
    ? [...proposed.tags].sort((a, b) => a.localeCompare(b))
    : [...proposed.tags];
  const linked = options.sortArrays
    ? [...proposed.linked].sort((a, b) => a.localeCompare(b))
    : [...proposed.linked];

  if (tags.length > 0) {
    next.tags = tags;
  }
  if (proposed.topic) {
    next.topic = proposed.topic;
  }
  if (linked.length > 0) {
    next.linked = linked;
  }
  if (proposed.index) {
    next.index = proposed.index;
  }

  return next;
}

export function managedFrontmatterChanged(
  before: ManagedFrontmatter,
  after: ManagedFrontmatter,
): boolean {
  if (before.topic !== after.topic) {
    return true;
  }
  if (before.index !== after.index) {
    return true;
  }

  const beforeTags = before.tags.join("\u0000");
  const afterTags = after.tags.join("\u0000");
  if (beforeTags !== afterTags) {
    return true;
  }

  const beforeLinked = before.linked.join("\u0000");
  const afterLinked = after.linked.join("\u0000");
  return beforeLinked !== afterLinked;
}
