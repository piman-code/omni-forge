import type { ChunkRef, FileRef, IChunker } from "./types.ts";

export interface ChunkerOptions {
  maxChars?: number;
  includeFrontmatterChunk?: boolean;
}

export interface FrontmatterSegment {
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ChunkMetadata {
  heading?: string;
  sectionOrdinal: number;
  sectionChunkOrdinal: number;
  containsCodeFence: boolean;
}

interface LineWithOffset {
  text: string;
  startOffset: number;
  endOffset: number;
}

interface MarkdownSection {
  heading?: string;
  lines: LineWithOffset[];
  sectionOrdinal: number;
}

interface SectionChunk {
  text: string;
  startOffset: number;
  endOffset: number;
  containsCodeFence: boolean;
  sectionChunkOrdinal: number;
}

const DEFAULT_MAX_CHARS = 3600;
const MIN_MAX_CHARS = 512;
const HEADING_REGEX = /^(#{1,3})\s+(.+?)\s*$/;

function clampMaxChars(value?: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_CHARS;
  }
  const normalized = Math.floor(value as number);
  return normalized >= MIN_MAX_CHARS ? normalized : MIN_MAX_CHARS;
}

function toLinesWithOffsets(content: string, baseOffset = 0): LineWithOffset[] {
  const lines: LineWithOffset[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const nextNewline = content.indexOf("\n", cursor);
    if (nextNewline < 0) {
      const startOffset = baseOffset + cursor;
      const endOffset = baseOffset + content.length;
      lines.push({ text: content.slice(cursor), startOffset, endOffset });
      cursor = content.length;
      break;
    }

    const lineEndExclusive = nextNewline + 1;
    const startOffset = baseOffset + cursor;
    const endOffset = baseOffset + lineEndExclusive;
    lines.push({
      text: content.slice(cursor, lineEndExclusive),
      startOffset,
      endOffset,
    });
    cursor = lineEndExclusive;
  }

  if (content.length === 0) {
    lines.push({ text: "", startOffset: baseOffset, endOffset: baseOffset });
  }

  return lines;
}

function extractFrontmatter(content: string): FrontmatterSegment | null {
  if (!content.startsWith("---")) {
    return null;
  }

  const firstLineEnd = content.indexOf("\n");
  if (firstLineEnd < 0) {
    return null;
  }

  const firstLine = content.slice(0, firstLineEnd).trim();
  if (firstLine !== "---") {
    return null;
  }

  let cursor = firstLineEnd + 1;
  while (cursor < content.length) {
    const nextNewline = content.indexOf("\n", cursor);
    const lineEndExclusive = nextNewline < 0 ? content.length : nextNewline + 1;
    const line = content.slice(cursor, lineEndExclusive).trim();

    if (line === "---") {
      return {
        text: content.slice(0, lineEndExclusive),
        startOffset: 0,
        endOffset: lineEndExclusive,
      };
    }

    cursor = lineEndExclusive;
  }

  return null;
}

function splitSections(content: string, baseOffset: number): MarkdownSection[] {
  const lines = toLinesWithOffsets(content, baseOffset);
  if (lines.length === 0) {
    return [];
  }

  const sections: MarkdownSection[] = [];
  let sectionStart = 0;
  let currentHeading: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].text.trimEnd().match(HEADING_REGEX);
    if (!headingMatch) {
      continue;
    }

    if (index > sectionStart) {
      sections.push({
        heading: currentHeading,
        lines: lines.slice(sectionStart, index),
        sectionOrdinal: sections.length,
      });
    }

    sectionStart = index;
    currentHeading = headingMatch[2].trim();
  }

  if (sectionStart < lines.length) {
    sections.push({
      heading: currentHeading,
      lines: lines.slice(sectionStart),
      sectionOrdinal: sections.length,
    });
  }

  return sections.filter((section) => section.lines.length > 0);
}

function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter((token) => token.length > 0).length;
}

function splitSectionByLength(section: MarkdownSection, maxChars: number): SectionChunk[] {
  const lines = section.lines;
  if (lines.length === 0) {
    return [];
  }

  const chunks: SectionChunk[] = [];
  let chunkStart = 0;
  let chunkLength = 0;
  let inCodeFence = false;
  let chunkContainsCodeFence = false;

  const flushChunk = (endExclusive: number): void => {
    if (endExclusive <= chunkStart) {
      return;
    }
    const range = lines.slice(chunkStart, endExclusive);
    const text = range.map((line) => line.text).join("");
    chunks.push({
      text,
      startOffset: range[0].startOffset,
      endOffset: range[range.length - 1].endOffset,
      containsCodeFence: chunkContainsCodeFence,
      sectionChunkOrdinal: chunks.length,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.text.trimStart();
    const isFenceLine = trimmed.startsWith("```");

    if (!inCodeFence && chunkLength > 0 && chunkLength + line.text.length > maxChars) {
      flushChunk(index);
      chunkStart = index;
      chunkLength = 0;
      chunkContainsCodeFence = false;
    }

    chunkLength += line.text.length;

    if (isFenceLine) {
      inCodeFence = !inCodeFence;
      chunkContainsCodeFence = true;
    }
  }

  flushChunk(lines.length);
  return chunks.filter((chunk) => chunk.text.length > 0);
}

export class MarkdownChunker implements IChunker {
  private readonly maxChars: number;
  private readonly includeFrontmatterChunk: boolean;
  private readonly metadataByChunkId = new Map<string, ChunkMetadata>();
  private readonly frontmatterByFileId = new Map<string, FrontmatterSegment>();

  constructor(options: ChunkerOptions = {}) {
    this.maxChars = clampMaxChars(options.maxChars);
    this.includeFrontmatterChunk = Boolean(options.includeFrontmatterChunk);
  }

  getChunkMetadata(chunkId: string): ChunkMetadata | undefined {
    return this.metadataByChunkId.get(chunkId);
  }

  getFrontmatter(fileId: string): FrontmatterSegment | undefined {
    return this.frontmatterByFileId.get(fileId);
  }

  getMaxChars(): number {
    return this.maxChars;
  }

  chunkFile(fileRef: FileRef, content: string): ChunkRef[] {
    const source = typeof content === "string" ? content : "";
    this.metadataByChunkId.clear();

    const frontmatter = extractFrontmatter(source);
    if (frontmatter) {
      this.frontmatterByFileId.set(fileRef.fileId, frontmatter);
    } else {
      this.frontmatterByFileId.delete(fileRef.fileId);
    }

    const bodyStartOffset = frontmatter ? frontmatter.endOffset : 0;
    const bodyContent = source.slice(bodyStartOffset);
    const sections = splitSections(bodyContent, bodyStartOffset);

    const chunks: ChunkRef[] = [];
    let ordinal = 0;

    if (this.includeFrontmatterChunk && frontmatter) {
      const chunkId = `${fileRef.fileId}:chunk:${ordinal}:fm`;
      const frontmatterChunk: ChunkRef = {
        chunkId,
        fileRef,
        ordinal,
        text: frontmatter.text,
        startOffset: frontmatter.startOffset,
        endOffset: frontmatter.endOffset,
        tokenCount: estimateTokenCount(frontmatter.text),
      };
      chunks.push(frontmatterChunk);
      this.metadataByChunkId.set(chunkId, {
        sectionOrdinal: -1,
        sectionChunkOrdinal: 0,
        containsCodeFence: false,
      });
      ordinal += 1;
    }

    for (const section of sections) {
      const sectionChunks = splitSectionByLength(section, this.maxChars);
      for (const sectionChunk of sectionChunks) {
        const chunkId = `${fileRef.fileId}:chunk:${ordinal}:${sectionChunk.startOffset}-${sectionChunk.endOffset}`;
        const chunkRef: ChunkRef = {
          chunkId,
          fileRef,
          ordinal,
          text: sectionChunk.text,
          startOffset: sectionChunk.startOffset,
          endOffset: sectionChunk.endOffset,
          tokenCount: estimateTokenCount(sectionChunk.text),
        };
        chunks.push(chunkRef);
        this.metadataByChunkId.set(chunkId, {
          heading: section.heading,
          sectionOrdinal: section.sectionOrdinal,
          sectionChunkOrdinal: sectionChunk.sectionChunkOrdinal,
          containsCodeFence: sectionChunk.containsCodeFence,
        });
        ordinal += 1;
      }
    }

    return chunks;
  }
}
