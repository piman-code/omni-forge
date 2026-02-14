import { App, TFile, normalizePath } from "obsidian";
import type { ManagedFrontmatter } from "./types";

export const MANAGED_KEYS = ["tags", "topic", "linked", "index"] as const;

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
  return rawTag
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-");
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

interface FrontmatterBuildOptions {
  cleanUnknown: boolean;
  sortArrays: boolean;
}

export function buildNextFrontmatter(
  current: Record<string, unknown>,
  proposed: ManagedFrontmatter,
  options: FrontmatterBuildOptions,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if (!options.cleanUnknown) {
    for (const [key, value] of Object.entries(current)) {
      if (!(MANAGED_KEYS as readonly string[]).includes(key)) {
        next[key] = value;
      }
    }
  }

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
