import { requestUrl } from "obsidian";
import type {
  AIProvider,
  AnalyzeOutcome,
  AnalyzeRequest,
  FieldReasons,
  KnowledgeWeaverSettings,
  MetadataProposal,
  OllamaDetectionResult,
  OllamaModelOption,
  ProviderId,
} from "./types";

interface OpenAICompatibleConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // no-op
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toReasons(value: unknown): FieldReasons {
  if (!value || typeof value !== "object") {
    return {};
  }

  const asRecord = value as Record<string, unknown>;
  return {
    tags: toOptionalString(asRecord.tags),
    topic: toOptionalString(asRecord.topic),
    linked: toOptionalString(asRecord.linked),
    index: toOptionalString(asRecord.index),
  };
}

function sanitizeProposal(record: Record<string, unknown>): MetadataProposal {
  return {
    tags: toStringArray(record.tags),
    topic: toOptionalString(record.topic),
    linked: toStringArray(record.linked),
    index: toOptionalString(record.index),
    reasons: toReasons(record.reasons),
  };
}

function buildPrompt(request: AnalyzeRequest): string {
  const candidateList = request.candidateLinkPaths
    .map((path) => `- ${path}`)
    .join("\n");
  const source = truncate(request.sourceText, 12000);

  return [
    "You generate Obsidian frontmatter metadata for a single note.",
    "Return JSON only with this exact schema:",
    "{",
    '  "tags": string[],',
    '  "topic": string,',
    '  "linked": string[],',
    '  "index": string,',
    '  "reasons": { "tags": string, "topic": string, "linked": string, "index": string }',
    "}",
    "Rules:",
    "- linked MUST only contain values from the candidate list exactly.",
    "- Keep tags concise. No leading #.",
    "- Tags must be conceptual topics only (no shell commands, file paths, shebangs, URLs, or code snippets).",
    "- topic should be one short phrase.",
    "- index should be one category label.",
    `- max tags: ${request.maxTags}`,
    `- max linked: ${request.maxLinked}`,
    "- If a field is disabled, return empty value for it.",
    `- analyze tags: ${request.analyzeTags}`,
    `- analyze topic: ${request.analyzeTopic}`,
    `- analyze linked: ${request.analyzeLinked}`,
    `- analyze index: ${request.analyzeIndex}`,
    `- include reasons: ${request.includeReasons}`,
    "",
    `Source path: ${request.sourcePath}`,
    "Candidate links:",
    candidateList || "- (none)",
    "",
    "Note content:",
    source,
  ].join("\n");
}

abstract class BaseProvider implements AIProvider {
  protected readonly settings: KnowledgeWeaverSettings;

  constructor(settings: KnowledgeWeaverSettings) {
    this.settings = settings;
  }

  protected parseOrThrow(rawText: string): MetadataProposal {
    const parsed = extractJsonFromText(rawText);
    if (!parsed) {
      throw new Error("Provider returned non-JSON output.");
    }
    return sanitizeProposal(parsed);
  }

  abstract analyze(request: AnalyzeRequest): Promise<MetadataProposal>;
}

class OllamaProvider extends BaseProvider {
  async analyze(request: AnalyzeRequest): Promise<MetadataProposal> {
    const url = `${this.settings.ollamaBaseUrl.replace(/\/$/, "")}/api/generate`;
    const response = await requestUrl({
      url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: this.settings.ollamaModel,
        prompt: buildPrompt(request),
        stream: false,
        format: "json",
      }),
      throw: false,
    });

    if (response.status >= 300) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const responseBody =
      typeof response.json?.response === "string"
        ? response.json.response
        : response.text;
    return this.parseOrThrow(responseBody);
  }
}

class OpenAICompatibleProvider extends BaseProvider {
  private readonly config: OpenAICompatibleConfig;

  constructor(settings: KnowledgeWeaverSettings, config: OpenAICompatibleConfig) {
    super(settings);
    this.config = config;
  }

  async analyze(request: AnalyzeRequest): Promise<MetadataProposal> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await requestUrl({
      url,
      method: "POST",
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that returns strict JSON for Obsidian metadata.",
          },
          { role: "user", content: buildPrompt(request) },
        ],
        temperature: 0.2,
      }),
      throw: false,
    });

    if (response.status >= 300) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }

    const content = response.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI-compatible response missing content.");
    }

    return this.parseOrThrow(content);
  }
}

class AnthropicProvider extends BaseProvider {
  async analyze(request: AnalyzeRequest): Promise<MetadataProposal> {
    const apiKey = this.settings.anthropicApiKey.trim();
    if (!apiKey) {
      throw new Error("Anthropic API key is missing.");
    }

    const response = await requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      contentType: "application/json",
      body: JSON.stringify({
        model: this.settings.anthropicModel,
        max_tokens: 1000,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: buildPrompt(request),
          },
        ],
      }),
      throw: false,
    });

    if (response.status >= 300) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }

    const content = response.json?.content?.[0]?.text;
    if (typeof content !== "string") {
      throw new Error("Anthropic response missing text.");
    }

    return this.parseOrThrow(content);
  }
}

class GeminiProvider extends BaseProvider {
  async analyze(request: AnalyzeRequest): Promise<MetadataProposal> {
    const apiKey = this.settings.geminiApiKey.trim();
    if (!apiKey) {
      throw new Error("Gemini API key is missing.");
    }

    const model = this.settings.geminiModel.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await requestUrl({
      url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
        },
        contents: [
          {
            parts: [
              {
                text: buildPrompt(request),
              },
            ],
          },
        ],
      }),
      throw: false,
    });

    if (response.status >= 300) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }

    const content = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== "string") {
      throw new Error("Gemini response missing text.");
    }

    return this.parseOrThrow(content);
  }
}

class HeuristicFallbackProvider extends BaseProvider {
  async analyze(request: AnalyzeRequest): Promise<MetadataProposal> {
    const tags = request.analyzeTags
      ? extractHashTags(request.sourceText).slice(0, request.maxTags)
      : [];

    const topic = request.analyzeTopic
      ? extractTopicFromContent(request.sourceText, request.sourcePath)
      : undefined;

    const linked = request.analyzeLinked
      ? request.candidateLinkPaths.slice(0, request.maxLinked)
      : [];

    const index = request.analyzeIndex
      ? extractIndexFromPath(request.sourcePath)
      : undefined;

    return {
      tags,
      topic,
      linked,
      index,
      reasons: request.includeReasons
        ? {
            tags: request.analyzeTags
              ? "Found hashtag-like tokens in the note text."
              : undefined,
            topic: request.analyzeTopic
              ? "Used the first heading or note title."
              : undefined,
            linked: request.analyzeLinked
              ? "Used top candidates because AI provider was unavailable."
              : undefined,
            index: request.analyzeIndex
              ? "Used top-level folder name as category."
              : undefined,
          }
        : {},
    };
  }
}

function extractHashTags(sourceText: string): string[] {
  const found = new Set<string>();
  const regex = /(^|\s)#([^\s#]+)/g;
  let match: RegExpExecArray | null = regex.exec(sourceText);
  while (match) {
    found.add(match[2].trim());
    match = regex.exec(sourceText);
  }
  return [...found];
}

function extractTopicFromContent(sourceText: string, sourcePath: string): string {
  const firstHeading = sourceText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#\s+\S+/.test(line));
  if (firstHeading) {
    return firstHeading.replace(/^#\s+/, "").trim();
  }
  const fileName = sourcePath.split("/").pop() ?? sourcePath;
  return fileName.replace(/\.md$/i, "");
}

function extractIndexFromPath(sourcePath: string): string | undefined {
  const chunks = sourcePath.split("/");
  if (chunks.length <= 1) {
    return undefined;
  }
  return chunks[0].trim() || undefined;
}

function toOpenAICompatibleBase(baseUrl: string): string {
  const cleaned = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${cleaned}/v1`;
}

export function getProviderModelLabel(settings: KnowledgeWeaverSettings): string {
  switch (settings.provider) {
    case "ollama":
      return settings.ollamaModel;
    case "lmstudio":
      return settings.lmStudioModel;
    case "openai":
      return settings.openAIModel;
    case "anthropic":
      return settings.anthropicModel;
    case "gemini":
      return settings.geminiModel;
    default:
      return "unknown";
  }
}

function scoreOllamaModel(modelName: string): number {
  if (!isOllamaModelAnalyzable(modelName)) {
    return -100;
  }

  const lower = modelName.toLowerCase();

  let score = 0;

  if (/qwen2\.5|qwen3|llama3\.1|llama3\.2|mistral|gemma2|phi-?4/.test(lower)) {
    score += 20;
  }
  if (/instruct|chat|it\b/.test(lower)) {
    score += 10;
  }
  if (/:8b|:7b|:9b/.test(lower)) {
    score += 8;
  }
  if (/:4b|:3b/.test(lower)) {
    score += 5;
  }
  if (/:1b|:0\.[0-9]+b/.test(lower)) {
    score -= 3;
  }

  return score;
}

const UNAVAILABLE_MODEL_REGEX =
  /(embed|embedding|bge|e5-|e5:|rerank|whisper|tts|speech|transcribe|stt|vision|llava|bakllava|moondream|florence|vl\b|image[-_ ]?gen|stable[-_ ]?diffusion|sdxl|flux)/i;

export function isOllamaModelAnalyzable(modelName: string): boolean {
  return !UNAVAILABLE_MODEL_REGEX.test(modelName);
}

function describeOllamaModel(modelName: string): string {
  const lower = modelName.toLowerCase();

  if (!isOllamaModelAnalyzable(modelName)) {
    return "Looks like a vision/embedding/speech/rerank/image-generation model and is not suitable for metadata text analysis.";
  }
  if (/instruct|chat|it\b/.test(lower)) {
    return "Chat/instruct style model suitable for metadata suggestion tasks.";
  }
  if (/:8b|:7b|:9b/.test(lower)) {
    return "General-purpose local model with balanced quality and speed.";
  }
  if (/:4b|:3b/.test(lower)) {
    return "Lightweight model with fast runtime; quality may vary by note complexity.";
  }

  return "General text model candidate.";
}

export function buildOllamaModelOptions(
  models: string[],
  recommended?: string,
): OllamaModelOption[] {
  const options = models.map((model): OllamaModelOption => {
    if (!isOllamaModelAnalyzable(model)) {
      return {
        model,
        status: "unavailable",
        reason: describeOllamaModel(model),
      };
    }

    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: describeOllamaModel(model),
      };
    }

    return {
      model,
      status: "available",
      reason: describeOllamaModel(model),
    };
  });

  const weight = (status: OllamaModelOption["status"]): number => {
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

function recommendOllamaModel(models: string[]): { recommended?: string; reason: string } {
  if (models.length === 0) {
    return {
      reason:
        "No local Ollama models were detected. Install at least one chat/instruct model first.",
    };
  }

  const analyzableModels = models.filter((model) => isOllamaModelAnalyzable(model));

  if (analyzableModels.length === 0) {
    return {
      reason:
        "No analyzable Ollama model detected. Install a chat/instruct LLM (not embedding-only).",
    };
  }

  const scored = analyzableModels
    .map((name) => ({ name, score: scoreOllamaModel(name) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const winner = scored[0]?.name;
  if (!winner) {
    return { reason: "Could not select a recommended Ollama model." };
  }

  const reason =
    scoreOllamaModel(winner) >= 0
      ? `Recommended '${winner}' based on chat/instruct capability and balanced size.`
      : `Recommended '${winner}' as fallback among detected models.`;

  return {
    recommended: winner,
    reason,
  };
}

export async function detectOllamaModels(
  baseUrl: string,
): Promise<OllamaDetectionResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const response = await requestUrl({
    url,
    method: "GET",
    throw: false,
  });

  if (response.status >= 300) {
    throw new Error(`Ollama model detection failed: ${response.status}`);
  }

  const rawModels: Array<Record<string, unknown>> = Array.isArray(
    response.json?.models,
  )
    ? (response.json.models as Array<Record<string, unknown>>)
    : [];

  const modelNames: string[] = rawModels
    .map((item: Record<string, unknown>) => {
      const nameValue = item.name;
      if (typeof nameValue === "string") {
        return nameValue.trim();
      }

      const modelValue = item.model;
      if (typeof modelValue === "string") {
        return modelValue.trim();
      }

      return "";
    })
    .filter((name: string) => name.length > 0);

  const uniqueSorted: string[] = [...new Set(modelNames)].sort((a, b) =>
    a.localeCompare(b),
  );
  const recommendation = recommendOllamaModel(uniqueSorted);

  return {
    models: uniqueSorted,
    recommended: recommendation.recommended,
    reason: recommendation.reason,
  };
}

export function createProvider(settings: KnowledgeWeaverSettings): AIProvider {
  const providerMap: Record<ProviderId, () => AIProvider> = {
    ollama: () => new OllamaProvider(settings),
    lmstudio: () =>
      new OpenAICompatibleProvider(settings, {
        baseUrl: toOpenAICompatibleBase(settings.lmStudioBaseUrl),
        model: settings.lmStudioModel,
        apiKey: settings.lmStudioApiKey.trim() || undefined,
      }),
    openai: () =>
      new OpenAICompatibleProvider(settings, {
        baseUrl: toOpenAICompatibleBase(settings.openAIBaseUrl),
        model: settings.openAIModel,
        apiKey: settings.openAIApiKey.trim(),
      }),
    anthropic: () => new AnthropicProvider(settings),
    gemini: () => new GeminiProvider(settings),
  };

  return providerMap[settings.provider]();
}

export async function analyzeWithFallback(
  settings: KnowledgeWeaverSettings,
  request: AnalyzeRequest,
): Promise<AnalyzeOutcome> {
  const provider = createProvider(settings);
  const providerModel = getProviderModelLabel(settings);
  const startedAt = Date.now();

  try {
    const proposal = await provider.analyze(request);
    return {
      proposal,
      meta: {
        provider: settings.provider,
        model: providerModel,
        elapsedMs: Date.now() - startedAt,
        usedFallback: false,
      },
    };
  } catch {
    const fallback = new HeuristicFallbackProvider(settings);
    const proposal = await fallback.analyze(request);
    return {
      proposal,
      meta: {
        provider: settings.provider,
        model: providerModel,
        elapsedMs: Date.now() - startedAt,
        usedFallback: true,
      },
    };
  }
}
