import {
  hashEmbed,
  type HashEmbedConfig,
} from "./hashembed.ts";

export interface EmbeddingEngineOptions {
  dimension?: number;
  seed?: number;
}

export interface EmbeddingResult {
  vector: number[];
  dimension: number;
  tokenCount: number;
}

const DEFAULT_DIMENSION = 384;
const MIN_DIMENSION = 64;
const DEFAULT_SEED = 0x9e3779b1;
const TOKEN_REGEX = /[0-9a-zA-Z가-힣_]+/g;

interface ResolvedConfig {
  dimension: number;
  seedIndex: number;
  seedSign: number;
}

function toDimension(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DIMENSION;
  }
  const n = Math.floor(value as number);
  return n >= MIN_DIMENSION ? n : MIN_DIMENSION;
}

function toSeed(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SEED >>> 0;
  }
  return (Math.floor(value as number) >>> 0);
}

function normalizeInput(text: string): string {
  return String(text ?? "").normalize("NFKC").toLowerCase();
}

function tokenize(text: string): string[] {
  const matched = normalizeInput(text).match(TOKEN_REGEX);
  return matched ? matched : [];
}

export class LocalEmbeddingEngine {
  private readonly config: ResolvedConfig;

  constructor(options: EmbeddingEngineOptions = {}) {
    const seedIndex = toSeed(options.seed);
    const derivedSeedSign = (seedIndex ^ 0x85ebca6b) >>> 0;
    const seedSign = derivedSeedSign === seedIndex ? ((seedIndex + 1) >>> 0) : derivedSeedSign;

    this.config = {
      dimension: toDimension(options.dimension),
      seedIndex,
      seedSign,
    };
  }

  getDimension(): number {
    return this.config.dimension;
  }

  getSeed(): number {
    return this.config.seedIndex;
  }

  embed(text: string): EmbeddingResult {
    const tokens = tokenize(text);
    const hashConfig: HashEmbedConfig = {
      dimension: this.config.dimension,
      seedIndex: this.config.seedIndex,
      seedSign: this.config.seedSign,
    };
    const vector = hashEmbed(tokens, hashConfig);

    // TODO(PR2-Step2): Add n-gram features and weighting (e.g., TF/IDF-like scaling).
    // TODO(PR2-Step2): Add optional deterministic quantization/storage format.

    return {
      vector,
      dimension: this.config.dimension,
      tokenCount: tokens.length,
    };
  }

  embedBatch(texts: string[]): EmbeddingResult[] {
    const source = Array.isArray(texts) ? texts : [];
    return source.map((text) => this.embed(text));
  }
}
