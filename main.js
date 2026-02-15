/* eslint-disable */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KnowledgeWeaverPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/frontmatter.ts
var import_obsidian = require("obsidian");
var MANAGED_KEYS = ["tags", "topic", "linked", "index"];
var MANAGED_KEY_SET = new Set(MANAGED_KEYS.map((key) => key.toLowerCase()));
var PROTECTED_FRONTMATTER_KEYS = /* @__PURE__ */ new Set([
  "date created",
  "date modified",
  "date updated",
  "date_created",
  "date_modified",
  "date_updated",
  "created",
  "updated",
  "modified"
]);
var LEGACY_REMOVABLE_KEY_PREFIXES = ["ai_", "autolinker_", "auto_linker_"];
function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
function toSingleString(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : void 0;
}
function normalizeTag(rawTag) {
  return rawTag.trim().replace(/^#+/, "").replace(/\s+/g, "-");
}
function normalizeTags(tags) {
  const deduped = /* @__PURE__ */ new Set();
  for (const rawTag of tags) {
    const normalized = normalizeTag(rawTag);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped];
}
function stripWikiSyntax(raw) {
  return raw.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
}
function resolveExistingMarkdownFile(app, sourcePath, rawLink) {
  const cleaned = stripWikiSyntax(rawLink);
  if (!cleaned) {
    return null;
  }
  const directPath = cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
  const direct = app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(directPath));
  if (direct instanceof import_obsidian.TFile && direct.extension === "md") {
    return direct;
  }
  const resolved = app.metadataCache.getFirstLinkpathDest(cleaned, sourcePath);
  if (resolved instanceof import_obsidian.TFile && resolved.extension === "md") {
    return resolved;
  }
  return null;
}
function normalizeLinked(app, sourcePath, linked, allowedPaths) {
  const deduped = /* @__PURE__ */ new Set();
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
function extractManagedFrontmatter(frontmatter) {
  const source = frontmatter != null ? frontmatter : {};
  return {
    tags: normalizeTags(toStringArray(source.tags)),
    topic: toSingleString(source.topic),
    linked: toStringArray(source.linked),
    index: toSingleString(source.index)
  };
}
function normalizeManagedFrontmatter(managed) {
  var _a, _b;
  const topic = (_a = managed.topic) == null ? void 0 : _a.trim();
  const index = (_b = managed.index) == null ? void 0 : _b.trim();
  return {
    tags: normalizeTags(managed.tags),
    topic: topic && topic.length > 0 ? topic : void 0,
    linked: managed.linked.map((item) => item.trim()).filter(Boolean).filter((item, idx, arr) => arr.indexOf(item) === idx),
    index: index && index.length > 0 ? index : void 0
  };
}
function shouldRemoveByRules(normalizedKey, options) {
  var _a, _b, _c, _d;
  if (PROTECTED_FRONTMATTER_KEYS.has(normalizedKey)) {
    return false;
  }
  const keepKeys = (_a = options.cleanupConfig) == null ? void 0 : _a.keepKeys;
  if (keepKeys && keepKeys.has(normalizedKey)) {
    return false;
  }
  const legacyRemovable = LEGACY_REMOVABLE_KEY_PREFIXES.some(
    (prefix) => normalizedKey.startsWith(prefix)
  );
  if (options.cleanUnknown && legacyRemovable) {
    return true;
  }
  const removeKeys = (_b = options.cleanupConfig) == null ? void 0 : _b.removeKeys;
  if (removeKeys && removeKeys.has(normalizedKey)) {
    return true;
  }
  const removePrefixes = (_d = (_c = options.cleanupConfig) == null ? void 0 : _c.removePrefixes) != null ? _d : [];
  if (removePrefixes.some((prefix) => normalizedKey.startsWith(prefix))) {
    return true;
  }
  return false;
}
function buildRetainedFrontmatter(current, options) {
  const next = {};
  const removedKeys = [];
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
function cleanupFrontmatterRecord(current, options) {
  return buildRetainedFrontmatter(current, {
    cleanUnknown: options.cleanUnknown,
    cleanupConfig: options.cleanupConfig,
    dropManaged: false
  });
}
function buildNextFrontmatter(current, proposed, options) {
  const { next } = buildRetainedFrontmatter(current, {
    cleanUnknown: options.cleanUnknown,
    cleanupConfig: options.cleanupConfig,
    dropManaged: true
  });
  const tags = options.sortArrays ? [...proposed.tags].sort((a, b) => a.localeCompare(b)) : [...proposed.tags];
  const linked = options.sortArrays ? [...proposed.linked].sort((a, b) => a.localeCompare(b)) : [...proposed.linked];
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
function managedFrontmatterChanged(before, after) {
  if (before.topic !== after.topic) {
    return true;
  }
  if (before.index !== after.index) {
    return true;
  }
  const beforeTags = before.tags.join("\0");
  const afterTags = after.tags.join("\0");
  if (beforeTags !== afterTags) {
    return true;
  }
  const beforeLinked = before.linked.join("\0");
  const afterLinked = after.linked.join("\0");
  return beforeLinked !== afterLinked;
}

// src/providers.ts
var import_obsidian2 = require("obsidian");
function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max);
}
function extractJsonFromText(text) {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (e) {
  }
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch == null ? void 0 : fencedMatch[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (e) {
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (e) {
    }
  }
  return null;
}
function toStringArray2(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
}
function toOptionalString(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : void 0;
}
function toReasons(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const asRecord = value;
  return {
    tags: toOptionalString(asRecord.tags),
    topic: toOptionalString(asRecord.topic),
    linked: toOptionalString(asRecord.linked),
    index: toOptionalString(asRecord.index)
  };
}
function sanitizeProposal(record) {
  return {
    tags: toStringArray2(record.tags),
    topic: toOptionalString(record.topic),
    linked: toStringArray2(record.linked),
    index: toOptionalString(record.index),
    reasons: toReasons(record.reasons)
  };
}
function buildPrompt(request) {
  const candidateList = request.candidateLinkPaths.map((path) => `- ${path}`).join("\n");
  const source = truncate(request.sourceText, 12e3);
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
    source
  ].join("\n");
}
var BaseProvider = class {
  constructor(settings) {
    this.settings = settings;
  }
  parseOrThrow(rawText) {
    const parsed = extractJsonFromText(rawText);
    if (!parsed) {
      throw new Error("Provider returned non-JSON output.");
    }
    return sanitizeProposal(parsed);
  }
};
var OllamaProvider = class extends BaseProvider {
  async analyze(request) {
    var _a;
    const url = `${this.settings.ollamaBaseUrl.replace(/\/$/, "")}/api/generate`;
    const response = await (0, import_obsidian2.requestUrl)({
      url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: this.settings.ollamaModel,
        prompt: buildPrompt(request),
        stream: false,
        format: "json"
      }),
      throw: false
    });
    if (response.status >= 300) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    const responseBody = typeof ((_a = response.json) == null ? void 0 : _a.response) === "string" ? response.json.response : response.text;
    return this.parseOrThrow(responseBody);
  }
};
var OpenAICompatibleProvider = class extends BaseProvider {
  constructor(settings, config) {
    super(settings);
    this.config = config;
  }
  async analyze(request) {
    var _a, _b, _c, _d;
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    const response = await (0, import_obsidian2.requestUrl)({
      url,
      method: "POST",
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: "You are an assistant that returns strict JSON for Obsidian metadata."
          },
          { role: "user", content: buildPrompt(request) }
        ],
        temperature: 0.2
      }),
      throw: false
    });
    if (response.status >= 300) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }
    const content = (_d = (_c = (_b = (_a = response.json) == null ? void 0 : _a.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI-compatible response missing content.");
    }
    return this.parseOrThrow(content);
  }
};
var AnthropicProvider = class extends BaseProvider {
  async analyze(request) {
    var _a, _b, _c;
    const apiKey = this.settings.anthropicApiKey.trim();
    if (!apiKey) {
      throw new Error("Anthropic API key is missing.");
    }
    const response = await (0, import_obsidian2.requestUrl)({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      contentType: "application/json",
      body: JSON.stringify({
        model: this.settings.anthropicModel,
        max_tokens: 1e3,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: buildPrompt(request)
          }
        ]
      }),
      throw: false
    });
    if (response.status >= 300) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    const content = (_c = (_b = (_a = response.json) == null ? void 0 : _a.content) == null ? void 0 : _b[0]) == null ? void 0 : _c.text;
    if (typeof content !== "string") {
      throw new Error("Anthropic response missing text.");
    }
    return this.parseOrThrow(content);
  }
};
var GeminiProvider = class extends BaseProvider {
  async analyze(request) {
    var _a, _b, _c, _d, _e, _f;
    const apiKey = this.settings.geminiApiKey.trim();
    if (!apiKey) {
      throw new Error("Gemini API key is missing.");
    }
    const model = this.settings.geminiModel.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await (0, import_obsidian2.requestUrl)({
      url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2
        },
        contents: [
          {
            parts: [
              {
                text: buildPrompt(request)
              }
            ]
          }
        ]
      }),
      throw: false
    });
    if (response.status >= 300) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }
    const content = (_f = (_e = (_d = (_c = (_b = (_a = response.json) == null ? void 0 : _a.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) == null ? void 0 : _e[0]) == null ? void 0 : _f.text;
    if (typeof content !== "string") {
      throw new Error("Gemini response missing text.");
    }
    return this.parseOrThrow(content);
  }
};
var HeuristicFallbackProvider = class extends BaseProvider {
  async analyze(request) {
    const tags = request.analyzeTags ? extractHashTags(request.sourceText).slice(0, request.maxTags) : [];
    const topic = request.analyzeTopic ? extractTopicFromContent(request.sourceText, request.sourcePath) : void 0;
    const linked = request.analyzeLinked ? request.candidateLinkPaths.slice(0, request.maxLinked) : [];
    const index = request.analyzeIndex ? extractIndexFromPath(request.sourcePath) : void 0;
    return {
      tags,
      topic,
      linked,
      index,
      reasons: request.includeReasons ? {
        tags: request.analyzeTags ? "Found hashtag-like tokens in the note text." : void 0,
        topic: request.analyzeTopic ? "Used the first heading or note title." : void 0,
        linked: request.analyzeLinked ? "Used top candidates because AI provider was unavailable." : void 0,
        index: request.analyzeIndex ? "Used top-level folder name as category." : void 0
      } : {}
    };
  }
};
function extractHashTags(sourceText) {
  const found = /* @__PURE__ */ new Set();
  const regex = /(^|\s)#([^\s#]+)/g;
  let match = regex.exec(sourceText);
  while (match) {
    found.add(match[2].trim());
    match = regex.exec(sourceText);
  }
  return [...found];
}
function extractTopicFromContent(sourceText, sourcePath) {
  var _a;
  const firstHeading = sourceText.split("\n").map((line) => line.trim()).find((line) => /^#\s+\S+/.test(line));
  if (firstHeading) {
    return firstHeading.replace(/^#\s+/, "").trim();
  }
  const fileName = (_a = sourcePath.split("/").pop()) != null ? _a : sourcePath;
  return fileName.replace(/\.md$/i, "");
}
function extractIndexFromPath(sourcePath) {
  const chunks = sourcePath.split("/");
  if (chunks.length <= 1) {
    return void 0;
  }
  return chunks[0].trim() || void 0;
}
function toOpenAICompatibleBase(baseUrl) {
  const cleaned = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${cleaned}/v1`;
}
function getProviderModelLabel(settings) {
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
function scoreOllamaModel(modelName) {
  const lower = modelName.toLowerCase();
  if (/embed|embedding/.test(lower)) {
    return -100;
  }
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
var UNAVAILABLE_MODEL_REGEX = /(embed|embedding|bge|e5-|e5:|rerank|whisper|tts|speech|transcribe|stt)/i;
function isOllamaModelAnalyzable(modelName) {
  return !UNAVAILABLE_MODEL_REGEX.test(modelName);
}
function describeOllamaModel(modelName) {
  const lower = modelName.toLowerCase();
  if (!isOllamaModelAnalyzable(modelName)) {
    return "Looks like an embedding/speech/rerank model and is not suitable for metadata text analysis.";
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
function buildOllamaModelOptions(models, recommended) {
  const options = models.map((model) => {
    if (!isOllamaModelAnalyzable(model)) {
      return {
        model,
        status: "unavailable",
        reason: describeOllamaModel(model)
      };
    }
    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: describeOllamaModel(model)
      };
    }
    return {
      model,
      status: "available",
      reason: describeOllamaModel(model)
    };
  });
  const weight = (status) => {
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
    (a, b) => weight(a.status) - weight(b.status) || a.model.localeCompare(b.model)
  );
}
function recommendOllamaModel(models) {
  var _a;
  if (models.length === 0) {
    return {
      reason: "No local Ollama models were detected. Install at least one chat/instruct model first."
    };
  }
  const analyzableModels = models.filter((model) => isOllamaModelAnalyzable(model));
  if (analyzableModels.length === 0) {
    return {
      reason: "No analyzable Ollama model detected. Install a chat/instruct LLM (not embedding-only)."
    };
  }
  const scored = analyzableModels.map((name) => ({ name, score: scoreOllamaModel(name) })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const winner = (_a = scored[0]) == null ? void 0 : _a.name;
  if (!winner) {
    return { reason: "Could not select a recommended Ollama model." };
  }
  const reason = scoreOllamaModel(winner) >= 0 ? `Recommended '${winner}' based on chat/instruct capability and balanced size.` : `Recommended '${winner}' as fallback among detected models.`;
  return {
    recommended: winner,
    reason
  };
}
async function detectOllamaModels(baseUrl) {
  var _a;
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const response = await (0, import_obsidian2.requestUrl)({
    url,
    method: "GET",
    throw: false
  });
  if (response.status >= 300) {
    throw new Error(`Ollama model detection failed: ${response.status}`);
  }
  const rawModels = Array.isArray(
    (_a = response.json) == null ? void 0 : _a.models
  ) ? response.json.models : [];
  const modelNames = rawModels.map((item) => {
    const nameValue = item.name;
    if (typeof nameValue === "string") {
      return nameValue.trim();
    }
    const modelValue = item.model;
    if (typeof modelValue === "string") {
      return modelValue.trim();
    }
    return "";
  }).filter((name) => name.length > 0);
  const uniqueSorted = [...new Set(modelNames)].sort(
    (a, b) => a.localeCompare(b)
  );
  const recommendation = recommendOllamaModel(uniqueSorted);
  return {
    models: uniqueSorted,
    recommended: recommendation.recommended,
    reason: recommendation.reason
  };
}
function createProvider(settings) {
  const providerMap = {
    ollama: () => new OllamaProvider(settings),
    lmstudio: () => new OpenAICompatibleProvider(settings, {
      baseUrl: toOpenAICompatibleBase(settings.lmStudioBaseUrl),
      model: settings.lmStudioModel,
      apiKey: settings.lmStudioApiKey.trim() || void 0
    }),
    openai: () => new OpenAICompatibleProvider(settings, {
      baseUrl: toOpenAICompatibleBase(settings.openAIBaseUrl),
      model: settings.openAIModel,
      apiKey: settings.openAIApiKey.trim()
    }),
    anthropic: () => new AnthropicProvider(settings),
    gemini: () => new GeminiProvider(settings)
  };
  return providerMap[settings.provider]();
}
async function analyzeWithFallback(settings, request) {
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
        usedFallback: false
      }
    };
  } catch (e) {
    const fallback = new HeuristicFallbackProvider(settings);
    const proposal = await fallback.analyze(request);
    return {
      proposal,
      meta: {
        provider: settings.provider,
        model: providerModel,
        elapsedMs: Date.now() - startedAt,
        usedFallback: true
      }
    };
  }
}

// src/semantic.ts
var import_obsidian3 = require("obsidian");
var EMBEDDING_BATCH_SIZE = 8;
var EMBEDDING_CACHE_PATH = "Auto-Linker Cache/semantic-embedding-cache.json";
var EMBEDDING_CACHE_VERSION = 1;
var EMBEDDING_MODEL_REGEX = /(embed|embedding|nomic-embed|mxbai|bge|e5|gte|arctic-embed|jina-emb)/i;
var NON_EMBEDDING_MODEL_REGEX = /(whisper|tts|speech|transcribe|stt|rerank)/i;
function isOllamaModelEmbeddingCapable(modelName) {
  return EMBEDDING_MODEL_REGEX.test(modelName) && !NON_EMBEDDING_MODEL_REGEX.test(modelName);
}
function scoreEmbeddingModel(modelName) {
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
function describeEmbeddingModel(modelName) {
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
function recommendEmbeddingModel(models) {
  var _a;
  if (models.length === 0) {
    return {
      reason: "No local Ollama models were detected. Install at least one embedding model."
    };
  }
  const candidates = models.filter((model) => isOllamaModelEmbeddingCapable(model));
  if (candidates.length === 0) {
    return {
      reason: "No embedding-capable model detected. Install nomic-embed-text, bge, e5, or similar."
    };
  }
  const scored = candidates.map((name) => ({ name, score: scoreEmbeddingModel(name) })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const winner = (_a = scored[0]) == null ? void 0 : _a.name;
  if (!winner) {
    return { reason: "Could not choose an embedding model." };
  }
  return {
    recommended: winner,
    reason: `Recommended '${winner}' for semantic embedding quality/speed balance.`
  };
}
function buildOllamaEmbeddingModelOptions(models, recommended) {
  const options = models.map((model) => {
    if (!isOllamaModelEmbeddingCapable(model)) {
      return {
        model,
        status: "unavailable",
        reason: describeEmbeddingModel(model)
      };
    }
    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: describeEmbeddingModel(model)
      };
    }
    return {
      model,
      status: "available",
      reason: describeEmbeddingModel(model)
    };
  });
  const weight = (status) => {
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
    (a, b) => weight(a.status) - weight(b.status) || a.model.localeCompare(b.model)
  );
}
async function detectOllamaEmbeddingModels(baseUrl) {
  var _a;
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const response = await (0, import_obsidian3.requestUrl)({
    url,
    method: "GET",
    throw: false
  });
  if (response.status >= 300) {
    throw new Error(`Ollama embedding model detection failed: ${response.status}`);
  }
  const rawModels = Array.isArray(
    (_a = response.json) == null ? void 0 : _a.models
  ) ? response.json.models : [];
  const modelNames = rawModels.map((item) => {
    if (typeof item.name === "string") {
      return item.name.trim();
    }
    if (typeof item.model === "string") {
      return item.model.trim();
    }
    return "";
  }).filter((name) => name.length > 0);
  const uniqueSorted = [...new Set(modelNames)].sort(
    (a, b) => a.localeCompare(b)
  );
  const recommendation = recommendEmbeddingModel(uniqueSorted);
  return {
    models: uniqueSorted,
    recommended: recommendation.recommended,
    reason: recommendation.reason
  };
}
function clampSimilarity(raw) {
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
function cosineSimilarity(a, b) {
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
function toNumberVector(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  const out = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      return null;
    }
    out.push(item);
  }
  return out.length > 0 ? out : null;
}
function parseEmbeddings(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload;
  const embeddingSingle = toNumberVector(record.embedding);
  if (embeddingSingle) {
    return [embeddingSingle];
  }
  const embeddings = record.embeddings;
  if (!Array.isArray(embeddings)) {
    return [];
  }
  const out = [];
  for (const item of embeddings) {
    const vector = toNumberVector(item);
    if (!vector) {
      return [];
    }
    out.push(vector);
  }
  return out;
}
function fingerprintText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function buildCacheKey(baseUrl, model, filePath) {
  return `${baseUrl}::${model}::${filePath}`;
}
async function ensureParentFolder(app, path) {
  const normalized = (0, import_obsidian3.normalizePath)(path);
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
async function readEmbeddingCache(app) {
  const path = (0, import_obsidian3.normalizePath)(EMBEDDING_CACHE_PATH);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    return { version: EMBEDDING_CACHE_VERSION, entries: {} };
  }
  try {
    const raw = await app.vault.adapter.read(path);
    const parsed = JSON.parse(raw);
    const version = typeof parsed.version === "number" ? parsed.version : EMBEDDING_CACHE_VERSION;
    const entries = parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {};
    if (version !== EMBEDDING_CACHE_VERSION) {
      return { version: EMBEDDING_CACHE_VERSION, entries: {} };
    }
    return { version, entries };
  } catch (e) {
    return { version: EMBEDDING_CACHE_VERSION, entries: {} };
  }
}
async function writeEmbeddingCache(app, cache) {
  const path = (0, import_obsidian3.normalizePath)(EMBEDDING_CACHE_PATH);
  await ensureParentFolder(app, path);
  await app.vault.adapter.write(path, JSON.stringify(cache));
}
function normalizeSourceText(raw, maxChars) {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "(empty note)";
  }
  return collapsed.slice(0, Math.max(200, maxChars));
}
async function requestOllamaEmbeddings(baseUrl, model, inputs) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/embed`;
  const response = await (0, import_obsidian3.requestUrl)({
    url,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      model,
      input: inputs
    }),
    throw: false
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
function resolveEmbeddingConfig(settings) {
  const baseUrl = settings.semanticOllamaBaseUrl.trim() || settings.ollamaBaseUrl.trim();
  const model = settings.semanticOllamaModel.trim();
  if (!baseUrl) {
    throw new Error("Semantic embedding base URL is empty.");
  }
  if (!model) {
    throw new Error("Semantic embedding model is empty.");
  }
  return { baseUrl, model };
}
async function buildFileVectorIndex(app, files, config, maxChars) {
  const corpus = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    corpus.push({
      file,
      text: normalizeSourceText(content, maxChars)
    });
  }
  const vectorsByPath = /* @__PURE__ */ new Map();
  const errors = [];
  const cache = await readEmbeddingCache(app);
  let cacheHits = 0;
  let cacheWrites = 0;
  let cacheDirty = false;
  const missing = [];
  for (const item of corpus) {
    const fingerprint = fingerprintText(item.text);
    const cacheKey = buildCacheKey(config.baseUrl, config.model, item.file.path);
    const hit = cache.entries[cacheKey];
    if (hit && hit.fingerprint === fingerprint && Array.isArray(hit.vector) && hit.vector.length > 0) {
      vectorsByPath.set(item.file.path, hit.vector);
      cacheHits += 1;
      continue;
    }
    missing.push({
      file: item.file,
      text: item.text,
      cacheKey,
      fingerprint
    });
  }
  for (let i = 0; i < missing.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = missing.slice(i, i + EMBEDDING_BATCH_SIZE);
    try {
      const embeddings = await requestOllamaEmbeddings(
        config.baseUrl,
        config.model,
        batch.map((item) => item.text)
      );
      if (embeddings.length !== batch.length) {
        throw new Error(
          `Embedding count mismatch (${embeddings.length} vs ${batch.length}).`
        );
      }
      for (let idx = 0; idx < batch.length; idx += 1) {
        const entry = batch[idx];
        const vector = embeddings[idx];
        vectorsByPath.set(entry.file.path, vector);
        cache.entries[entry.cacheKey] = {
          fingerprint: entry.fingerprint,
          vector,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      const message = error instanceof Error ? error.message : "Unknown embedding cache write error";
      errors.push(`cache-write: ${message}`);
    }
  }
  return {
    vectorsByPath,
    cacheHits,
    cacheWrites,
    errors
  };
}
async function buildSemanticNeighborMap(app, files, settings) {
  const neighborMap = /* @__PURE__ */ new Map();
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
      errors: []
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
    maxChars
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
    const scored = [];
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
        similarity
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
    errors
  };
}
async function searchSemanticNotesByQuery(app, files, settings, query, topK) {
  var _a;
  if (files.length === 0) {
    return {
      hits: [],
      model: settings.semanticOllamaModel,
      generatedVectors: 0,
      cacheHits: 0,
      cacheWrites: 0,
      errors: []
    };
  }
  const config = resolveEmbeddingConfig(settings);
  const maxChars = Math.max(400, settings.semanticMaxChars);
  const queryText = normalizeSourceText(query, maxChars);
  const safeTopK = Math.max(1, topK);
  const vectorBuild = await buildFileVectorIndex(app, files, config, maxChars);
  const hits = [];
  const errors = [...vectorBuild.errors];
  let queryVector = null;
  try {
    const queryEmbeddings = await requestOllamaEmbeddings(config.baseUrl, config.model, [
      queryText
    ]);
    queryVector = (_a = queryEmbeddings[0]) != null ? _a : null;
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
        similarity
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
    errors
  };
}

// src/main.ts
var DEFAULT_SETTINGS = {
  provider: "ollama",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "",
  ollamaAutoPickEnabled: true,
  lmStudioBaseUrl: "http://127.0.0.1:1234",
  lmStudioModel: "local-model",
  lmStudioApiKey: "",
  openAIBaseUrl: "https://api.openai.com/v1",
  openAIModel: "gpt-5-mini",
  openAIApiKey: "",
  anthropicModel: "claude-3-7-sonnet-latest",
  anthropicApiKey: "",
  geminiModel: "gemini-2.5-pro",
  geminiApiKey: "",
  suggestionMode: true,
  includeReasons: true,
  cleanUnknownFrontmatter: false,
  sortArrays: true,
  analyzeTags: true,
  analyzeTopic: true,
  analyzeLinked: true,
  analyzeIndex: true,
  maxTags: 8,
  maxLinked: 8,
  semanticLinkingEnabled: false,
  semanticOllamaBaseUrl: "http://127.0.0.1:11434",
  semanticOllamaModel: "",
  semanticAutoPickEnabled: true,
  semanticTopK: 24,
  semanticMinSimilarity: 0.25,
  semanticMaxChars: 5e3,
  qaOllamaBaseUrl: "http://127.0.0.1:11434",
  qaOllamaModel: "",
  qaTopK: 5,
  qaMaxContextChars: 12e3,
  qaAllowNonLocalEndpoint: false,
  propertyCleanupEnabled: false,
  propertyCleanupKeys: "related",
  propertyCleanupPrefixes: "",
  propertyCleanupKeepKeys: "date created,date updated,date modified,created,updated,modified",
  targetFilePaths: [],
  targetFolderPaths: [],
  includeSubfoldersInFolderSelection: true,
  selectionPathWidthPercent: 72,
  backupBeforeApply: true,
  backupRootPath: "Auto-Linker Backups",
  backupRetentionCount: 10,
  excludedFolderPatterns: ".obsidian,Auto-Linker Backups",
  showProgressNotices: true,
  generateMoc: true,
  mocPath: "MOC/Selected Knowledge MOC.md"
};
function stringifyValue(value) {
  if (value === void 0 || value === null) {
    return "(empty)";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "(empty)";
    }
    return value.join(", ");
  }
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : "(empty)";
  }
  return String(value);
}
function readManagedValueByKey(managed, key) {
  return managed[key];
}
function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0ms";
  }
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  return `${(ms / 1e3).toFixed(1)}s`;
}
function formatSimilarity(score) {
  const clamped = Math.max(-1, Math.min(1, score));
  return `${(clamped * 100).toFixed(1)}%`;
}
function formatBackupStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${sec}`;
}
function mergeUniqueStrings(base, additions) {
  const out = [...base];
  const seen = new Set(base);
  for (const item of additions) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}
var SelectionModal = class extends import_obsidian4.Modal {
  constructor(app, allFiles, allFolders, initialFiles, initialFolders, includeSubfolders, pathWidthPercent, onSubmit) {
    super(app);
    this.searchValue = "";
    this.activeTab = "files";
    this.allFiles = allFiles;
    this.allFolders = allFolders;
    this.onSubmit = onSubmit;
    this.selectedFilePaths = new Set(initialFiles);
    this.selectedFolderPaths = new Set(initialFolders);
    this.includeSubfolders = includeSubfolders;
    this.pathWidthPercent = pathWidthPercent;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes and folders" });
    const info = contentEl.createEl("p", {
      text: "Use tabs to switch between Files and Folders. Long paths are shown compactly with full path on hover."
    });
    info.style.marginTop = "0";
    const searchWrapper = contentEl.createDiv();
    searchWrapper.createEl("label", { text: "Filter files/folders" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      placeholder: "Type part of file or folder path"
    });
    searchInput.style.width = "100%";
    searchInput.oninput = () => {
      this.searchValue = searchInput.value.trim().toLowerCase();
      this.renderList();
    };
    const subfolderRow = contentEl.createDiv();
    subfolderRow.style.display = "flex";
    subfolderRow.style.alignItems = "center";
    subfolderRow.style.gap = "8px";
    subfolderRow.style.marginTop = "8px";
    const subfolderCheckbox = subfolderRow.createEl("input", { type: "checkbox" });
    subfolderCheckbox.checked = this.includeSubfolders;
    subfolderCheckbox.onchange = () => {
      this.includeSubfolders = subfolderCheckbox.checked;
      this.updateFooterCounter();
    };
    subfolderRow.createEl("span", { text: "Include subfolders when folder is selected" });
    const widthRow = contentEl.createDiv();
    widthRow.style.display = "flex";
    widthRow.style.alignItems = "center";
    widthRow.style.gap = "8px";
    widthRow.style.marginTop = "6px";
    widthRow.createEl("span", { text: "Path width" });
    const widthInput = widthRow.createEl("input", {
      type: "range",
      attr: { min: "45", max: "100", step: "1" }
    });
    widthInput.value = String(this.pathWidthPercent);
    const widthLabel = widthRow.createEl("span", {
      text: `${this.pathWidthPercent}%`
    });
    widthInput.oninput = () => {
      const next = Number.parseInt(widthInput.value, 10);
      if (Number.isFinite(next) && next >= 45 && next <= 100) {
        this.pathWidthPercent = next;
        widthLabel.setText(`${next}%`);
        this.renderList();
      }
    };
    const tabRow = contentEl.createDiv();
    tabRow.style.display = "flex";
    tabRow.style.gap = "8px";
    tabRow.style.marginTop = "10px";
    const filesTab = tabRow.createEl("button", { text: "Files" });
    const foldersTab = tabRow.createEl("button", { text: "Folders" });
    const switchTab = (tab) => {
      this.activeTab = tab;
      filesTab.toggleClass("mod-cta", tab === "files");
      foldersTab.toggleClass("mod-cta", tab === "folders");
      this.renderList();
    };
    filesTab.onclick = () => switchTab("files");
    foldersTab.onclick = () => switchTab("folders");
    const actionRow = contentEl.createDiv();
    actionRow.style.display = "flex";
    actionRow.style.gap = "8px";
    actionRow.style.marginTop = "10px";
    const selectFilteredButton = actionRow.createEl("button", {
      text: "Select filtered"
    });
    selectFilteredButton.onclick = () => {
      if (this.activeTab === "files") {
        for (const file of this.filteredFiles()) {
          this.selectedFilePaths.add(file.path);
        }
      } else {
        for (const folder of this.filteredFolders()) {
          this.selectedFolderPaths.add(folder.path);
        }
      }
      this.renderList();
    };
    const clearFilteredButton = actionRow.createEl("button", {
      text: "Clear filtered"
    });
    clearFilteredButton.onclick = () => {
      if (this.activeTab === "files") {
        for (const file of this.filteredFiles()) {
          this.selectedFilePaths.delete(file.path);
        }
      } else {
        for (const folder of this.filteredFolders()) {
          this.selectedFolderPaths.delete(folder.path);
        }
      }
      this.renderList();
    };
    this.listContainer = contentEl.createDiv();
    this.listContainer.style.maxHeight = "48vh";
    this.listContainer.style.overflow = "auto";
    this.listContainer.style.border = "1px solid var(--background-modifier-border)";
    this.listContainer.style.borderRadius = "8px";
    this.listContainer.style.marginTop = "10px";
    this.footerCounterEl = contentEl.createEl("p");
    this.footerCounterEl.style.marginTop = "8px";
    switchTab("files");
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.justifyContent = "flex-end";
    footer.style.marginTop = "10px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.close();
    const saveButton = footer.createEl("button", {
      text: "Save selection",
      cls: "mod-cta"
    });
    saveButton.onclick = async () => {
      await this.onSubmit({
        selectedFilePaths: [...this.selectedFilePaths].sort(
          (a, b) => a.localeCompare(b)
        ),
        selectedFolderPaths: [...this.selectedFolderPaths].sort(
          (a, b) => a.localeCompare(b)
        ),
        includeSubfolders: this.includeSubfolders,
        pathWidthPercent: this.pathWidthPercent
      });
      this.close();
    };
  }
  filteredFiles() {
    if (!this.searchValue) {
      return this.allFiles;
    }
    return this.allFiles.filter(
      (file) => file.path.toLowerCase().includes(this.searchValue)
    );
  }
  filteredFolders() {
    if (!this.searchValue) {
      return this.allFolders;
    }
    return this.allFolders.filter(
      (folder) => folder.path.toLowerCase().includes(this.searchValue)
    );
  }
  renderList() {
    this.listContainer.empty();
    if (this.activeTab === "files") {
      for (const file of this.filteredFiles()) {
        const row = this.createRow(file.path, this.selectedFilePaths.has(file.path));
        const checkbox = row.querySelector("input");
        checkbox.onchange = () => {
          if (checkbox.checked) {
            this.selectedFilePaths.add(file.path);
          } else {
            this.selectedFilePaths.delete(file.path);
          }
          this.updateFooterCounter();
        };
      }
    } else {
      for (const folder of this.filteredFolders()) {
        const row = this.createRow(folder.path, this.selectedFolderPaths.has(folder.path));
        const checkbox = row.querySelector("input");
        checkbox.onchange = () => {
          if (checkbox.checked) {
            this.selectedFolderPaths.add(folder.path);
          } else {
            this.selectedFolderPaths.delete(folder.path);
          }
          this.updateFooterCounter();
        };
      }
    }
    this.updateFooterCounter();
  }
  createRow(path, checked) {
    const row = this.listContainer.createDiv();
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.padding = "6px 8px";
    row.style.borderBottom = "1px solid var(--background-modifier-border)";
    const checkbox = row.createEl("input", { type: "checkbox" });
    checkbox.checked = checked;
    const pathEl = row.createEl("span", { text: path });
    pathEl.style.flex = "1";
    pathEl.style.whiteSpace = "nowrap";
    pathEl.style.overflow = "hidden";
    pathEl.style.textOverflow = "ellipsis";
    pathEl.style.maxWidth = `${this.pathWidthPercent}%`;
    pathEl.title = path;
    return row;
  }
  updateFooterCounter() {
    this.footerCounterEl.setText(
      `Selected files: ${this.selectedFilePaths.size}, selected folders: ${this.selectedFolderPaths.size}, include subfolders: ${this.includeSubfolders ? "yes" : "no"}, path width: ${this.pathWidthPercent}%`
    );
  }
};
var CleanupKeyPickerModal = class extends import_obsidian4.Modal {
  constructor(app, keyStats, initialSelectedKeys, onSubmit) {
    super(app);
    this.searchValue = "";
    this.keyStats = keyStats;
    this.onSubmit = onSubmit;
    this.selectedKeys = new Set(initialSelectedKeys);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select cleanup keys from selected notes" });
    contentEl.createEl("p", {
      text: "Only checked keys will be written to 'Cleanup exact keys'. Counts show in how many selected notes each key appears."
    });
    const searchWrapper = contentEl.createDiv();
    searchWrapper.createEl("label", { text: "Filter keys" });
    const searchInput = searchWrapper.createEl("input", { type: "text" });
    searchInput.style.width = "100%";
    searchInput.placeholder = "type key fragment...";
    searchInput.oninput = () => {
      this.searchValue = searchInput.value.trim().toLowerCase();
      this.renderList();
    };
    const actions = contentEl.createDiv();
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";
    const selectAll = actions.createEl("button", { text: "Select all (filtered)" });
    const clearAll = actions.createEl("button", { text: "Clear all (filtered)" });
    this.listContainer = contentEl.createDiv();
    this.listContainer.style.maxHeight = "48vh";
    this.listContainer.style.overflow = "auto";
    this.listContainer.style.border = "1px solid var(--background-modifier-border)";
    this.listContainer.style.borderRadius = "8px";
    this.listContainer.style.marginTop = "8px";
    this.listContainer.style.padding = "6px";
    this.footerSummaryEl = contentEl.createDiv();
    this.footerSummaryEl.style.marginTop = "8px";
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.close();
    const saveButton = footer.createEl("button", { text: "Save", cls: "mod-cta" });
    saveButton.onclick = async () => {
      const selected = [...this.selectedKeys].sort((a, b) => a.localeCompare(b));
      await this.onSubmit(selected);
      this.close();
    };
    selectAll.onclick = () => {
      for (const item of this.filteredStats()) {
        this.selectedKeys.add(item.key);
      }
      this.renderList();
    };
    clearAll.onclick = () => {
      for (const item of this.filteredStats()) {
        this.selectedKeys.delete(item.key);
      }
      this.renderList();
    };
    this.renderList();
  }
  filteredStats() {
    if (!this.searchValue) {
      return this.keyStats;
    }
    return this.keyStats.filter((item) => item.key.includes(this.searchValue));
  }
  renderList() {
    this.listContainer.empty();
    const rows = this.filteredStats();
    if (rows.length === 0) {
      this.listContainer.createEl("div", { text: "No matching keys." });
      this.footerSummaryEl.setText(`Selected: ${this.selectedKeys.size}`);
      return;
    }
    for (const item of rows) {
      const row = this.listContainer.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 8px";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedKeys.has(item.key);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedKeys.add(item.key);
        } else {
          this.selectedKeys.delete(item.key);
        }
        this.footerSummaryEl.setText(`Selected: ${this.selectedKeys.size}`);
      };
      row.createEl("span", { text: item.key });
      const countEl = row.createEl("small", { text: `${item.count}` });
      countEl.style.marginLeft = "auto";
    }
    this.footerSummaryEl.setText(
      `Listed: ${rows.length} keys | Selected: ${this.selectedKeys.size}`
    );
  }
};
var BackupConfirmModal = class _BackupConfirmModal extends import_obsidian4.Modal {
  constructor(app, defaultBackup, onResolve) {
    super(app);
    this.rememberAsDefault = false;
    this.defaultBackup = defaultBackup;
    this.onResolve = onResolve;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\uBC31\uC5C5\uC744 \uC9C4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?" });
    contentEl.createEl("p", {
      text: "\uBD84\uC11D \uC804\uC5D0 \uC120\uD0DD\uB41C \uBB38\uC11C\uB97C \uBC31\uC5C5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBCF5\uAD6C\uAC00 \uD544\uC694\uD560 \uB54C \uC548\uC804\uD569\uB2C8\uB2E4."
    });
    const defaultText = this.defaultBackup ? "\uD604\uC7AC \uAE30\uBCF8\uAC12: \uBC31\uC5C5 \uD6C4 \uC9C4\uD589" : "\uD604\uC7AC \uAE30\uBCF8\uAC12: \uBC31\uC5C5 \uC5C6\uC774 \uC9C4\uD589";
    contentEl.createEl("p", { text: defaultText });
    const rememberRow = contentEl.createDiv();
    rememberRow.style.display = "flex";
    rememberRow.style.alignItems = "center";
    rememberRow.style.gap = "8px";
    const rememberCheckbox = rememberRow.createEl("input", { type: "checkbox" });
    rememberCheckbox.onchange = () => {
      this.rememberAsDefault = rememberCheckbox.checked;
    };
    rememberRow.createEl("span", { text: "\uC774 \uC120\uD0DD\uC744 \uAE30\uBCF8\uAC12\uC73C\uB85C \uC800\uC7A5" });
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "\uCDE8\uC18C" });
    cancelButton.onclick = () => {
      this.resolve({
        proceed: false,
        backupBeforeRun: this.defaultBackup,
        rememberAsDefault: false
      });
    };
    const noBackupButton = footer.createEl("button", { text: "\uBC31\uC5C5 \uC5C6\uC774 \uC9C4\uD589" });
    noBackupButton.onclick = () => {
      this.resolve({
        proceed: true,
        backupBeforeRun: false,
        rememberAsDefault: this.rememberAsDefault
      });
    };
    const backupButton = footer.createEl("button", {
      text: "\uBC31\uC5C5 \uD6C4 \uC9C4\uD589(\uAD8C\uC7A5)",
      cls: "mod-cta"
    });
    backupButton.onclick = () => {
      this.resolve({
        proceed: true,
        backupBeforeRun: true,
        rememberAsDefault: this.rememberAsDefault
      });
    };
  }
  onClose() {
    this.contentEl.empty();
  }
  resolve(decision) {
    this.onResolve(decision);
    this.close();
  }
  static ask(app, defaultBackup) {
    return new Promise((resolve) => {
      new _BackupConfirmModal(app, defaultBackup, resolve).open();
    });
  }
};
var RunProgressModal = class extends import_obsidian4.Modal {
  constructor(app, titleText) {
    super(app);
    this.showOnlyErrors = true;
    this.cancelled = false;
    this.titleText = titleText;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.titleText });
    this.statusEl = contentEl.createEl("p", { text: "Preparing..." });
    this.currentFileEl = contentEl.createEl("p", { text: "Current file: -" });
    this.etaEl = contentEl.createEl("p", { text: "ETA: -" });
    const filterRow = contentEl.createDiv();
    filterRow.style.display = "flex";
    filterRow.style.alignItems = "center";
    filterRow.style.gap = "8px";
    const onlyErrorsCheckbox = filterRow.createEl("input", { type: "checkbox" });
    onlyErrorsCheckbox.checked = this.showOnlyErrors;
    onlyErrorsCheckbox.onchange = () => {
      this.showOnlyErrors = onlyErrorsCheckbox.checked;
    };
    filterRow.createEl("span", { text: "Show only errors" });
    this.errorsSummaryEl = contentEl.createEl("p", { text: "Errors: 0" });
    this.errorsListEl = contentEl.createDiv();
    this.errorsListEl.style.maxHeight = "22vh";
    this.errorsListEl.style.overflow = "auto";
    this.errorsListEl.style.border = "1px solid var(--background-modifier-border)";
    this.errorsListEl.style.borderRadius = "8px";
    this.errorsListEl.style.padding = "8px";
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", {
      text: "\uC911\uC9C0",
      cls: "mod-warning"
    });
    cancelButton.onclick = () => {
      this.cancelled = true;
      this.statusEl.setText(`${this.titleText}: stopping after current file...`);
    };
  }
  isCancelled() {
    return this.cancelled;
  }
  update(params) {
    var _a;
    const elapsedMs = Date.now() - params.startedAt;
    const avgMs = params.current > 0 ? elapsedMs / params.current : 0;
    const remaining = Math.max(0, params.total - params.current);
    const etaMs = remaining * avgMs;
    this.statusEl.setText(`${params.stage}: ${params.current}/${params.total}`);
    this.currentFileEl.setText(`Current file: ${(_a = params.currentFile) != null ? _a : "-"}`);
    this.etaEl.setText(
      `Elapsed: ${formatDurationMs(elapsedMs)} | ETA: ${params.current > 0 ? formatDurationMs(Math.round(etaMs)) : "-"}`
    );
    this.errorsSummaryEl.setText(`Errors: ${params.errors.length}`);
    this.renderEvents(params.errors, params.events);
  }
  setFinished(message) {
    this.statusEl.setText(message);
  }
  renderEvents(errors, events) {
    var _a, _b, _c;
    this.errorsListEl.empty();
    const showRows = this.showOnlyErrors ? events.filter((item) => item.status === "error") : events;
    if (showRows.length === 0) {
      this.errorsListEl.createEl("div", {
        text: this.showOnlyErrors ? "No errors." : "No activity yet."
      });
      return;
    }
    for (const item of showRows.slice(-200)) {
      const row = this.errorsListEl.createDiv();
      row.style.marginBottom = "6px";
      const label = item.status === "error" ? "ERROR" : "OK";
      row.createEl("div", { text: `${label}: ${item.filePath}` });
      if (item.status === "error") {
        const errorMessage = (_c = (_b = (_a = errors.find((error) => error.filePath === item.filePath)) == null ? void 0 : _a.message) != null ? _b : item.message) != null ? _c : "Unknown error";
        row.createEl("small", { text: errorMessage });
      } else if (item.message) {
        row.createEl("small", { text: item.message });
      }
    }
  }
};
var SuggestionPreviewModal = class extends import_obsidian4.Modal {
  constructor(app, summary, suggestions, includeReasons, onApply) {
    super(app);
    this.summary = summary;
    this.suggestions = suggestions;
    this.includeReasons = includeReasons;
    this.onApply = onApply;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "AI suggestions (preview mode)" });
    const summaryEl = contentEl.createDiv();
    summaryEl.style.border = "1px solid var(--background-modifier-border)";
    summaryEl.style.borderRadius = "8px";
    summaryEl.style.padding = "8px";
    summaryEl.style.marginBottom = "10px";
    summaryEl.createEl("div", {
      text: `Provider: ${this.summary.provider} | Model: ${this.summary.model}`
    });
    summaryEl.createEl("div", {
      text: `Analyzed: ${this.summary.totalFiles} | Changed: ${this.summary.changedFiles}`
    });
    summaryEl.createEl("div", {
      text: `Fallback used: ${this.summary.usedFallbackCount} | Errors: ${this.summary.errorCount} | Elapsed: ${formatDurationMs(this.summary.elapsedMs)}${this.summary.cancelled ? " | Cancelled" : ""}`
    });
    const list = contentEl.createDiv();
    list.style.maxHeight = "52vh";
    list.style.overflow = "auto";
    list.style.border = "1px solid var(--background-modifier-border)";
    list.style.borderRadius = "8px";
    list.style.padding = "8px";
    for (const suggestion of this.suggestions) {
      const section = list.createDiv();
      section.style.padding = "8px";
      section.style.marginBottom = "8px";
      section.style.border = "1px solid var(--background-modifier-border)";
      section.style.borderRadius = "8px";
      section.createEl("h3", { text: suggestion.file.path });
      section.createEl("p", {
        text: `Suggest source: ${suggestion.analysis.provider}/${suggestion.analysis.model} | ${formatDurationMs(suggestion.analysis.elapsedMs)}${suggestion.analysis.usedFallback ? " | fallback" : ""}`
      });
      this.renderSemanticCandidates(section, (_a = suggestion.semanticCandidates) != null ? _a : []);
      this.renderFieldChange(section, "tags", suggestion);
      this.renderFieldChange(section, "topic", suggestion);
      this.renderFieldChange(section, "linked", suggestion);
      this.renderFieldChange(section, "index", suggestion);
    }
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.close();
    const applyButton = footer.createEl("button", {
      text: "Apply changes",
      cls: "mod-cta"
    });
    applyButton.onclick = async () => {
      await this.onApply();
      this.close();
    };
  }
  renderFieldChange(parent, key, suggestion) {
    const before = readManagedValueByKey(suggestion.existing, key);
    const after = readManagedValueByKey(suggestion.proposed, key);
    if (stringifyValue(before) === stringifyValue(after)) {
      return;
    }
    const row = parent.createDiv();
    row.style.marginBottom = "6px";
    row.createEl("strong", { text: key });
    row.createEl("div", { text: `Before: ${stringifyValue(before)}` });
    row.createEl("div", { text: `After: ${stringifyValue(after)}` });
    if (!this.includeReasons) {
      return;
    }
    const reason = suggestion.reasons[key];
    if (reason) {
      row.createEl("div", { text: `Reason: ${reason}` });
    }
  }
  renderSemanticCandidates(parent, candidates) {
    if (candidates.length === 0) {
      return;
    }
    const section = parent.createDiv();
    section.style.marginBottom = "8px";
    section.createEl("strong", { text: "Semantic candidates" });
    const list = section.createDiv();
    const previewCount = Math.min(candidates.length, 8);
    for (const item of candidates.slice(0, previewCount)) {
      list.createEl("div", {
        text: `- ${item.path} (${formatSimilarity(item.similarity)})`
      });
    }
    if (candidates.length > previewCount) {
      list.createEl("small", {
        text: `...and ${candidates.length - previewCount} more`
      });
    }
  }
};
var LocalQAInputModal = class extends import_obsidian4.Modal {
  constructor(app, defaultTopK, onSubmit) {
    super(app);
    this.defaultTopK = defaultTopK;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Ask local AI from selected notes" });
    const questionLabel = contentEl.createEl("label", { text: "Question" });
    questionLabel.style.display = "block";
    questionLabel.style.marginBottom = "6px";
    const questionInput = contentEl.createEl("textarea");
    questionInput.style.width = "100%";
    questionInput.style.minHeight = "120px";
    questionInput.placeholder = "What do you want to find from selected notes?";
    const topKWrapper = contentEl.createDiv();
    topKWrapper.style.marginTop = "10px";
    topKWrapper.createEl("label", { text: "Top sources (1-15)" });
    const topKInput = topKWrapper.createEl("input", { type: "number" });
    topKInput.min = "1";
    topKInput.max = "15";
    topKInput.value = String(this.defaultTopK);
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.close();
    const askButton = footer.createEl("button", { text: "Ask", cls: "mod-cta" });
    askButton.onclick = async () => {
      const question = questionInput.value.trim();
      if (!question) {
        new import_obsidian4.Notice("Question is empty.");
        return;
      }
      const parsedTopK = Number.parseInt(topKInput.value, 10);
      const topK = Number.isFinite(parsedTopK) && parsedTopK >= 1 ? Math.min(15, parsedTopK) : this.defaultTopK;
      await this.onSubmit({ question, topK });
      this.close();
    };
  }
};
var LocalQAResultModal = class extends import_obsidian4.Modal {
  constructor(app, payload) {
    super(app);
    this.payload = payload;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Local AI answer from selected notes" });
    const meta = contentEl.createDiv();
    meta.style.border = "1px solid var(--background-modifier-border)";
    meta.style.borderRadius = "8px";
    meta.style.padding = "8px";
    meta.style.marginBottom = "8px";
    meta.createEl("div", { text: `Model: ${this.payload.model}` });
    meta.createEl("div", { text: `Embedding model: ${this.payload.embeddingModel}` });
    meta.createEl("div", { text: `Question: ${this.payload.question}` });
    const answerBlock = contentEl.createDiv();
    answerBlock.style.border = "1px solid var(--background-modifier-border)";
    answerBlock.style.borderRadius = "8px";
    answerBlock.style.padding = "10px";
    answerBlock.style.whiteSpace = "pre-wrap";
    answerBlock.style.maxHeight = "46vh";
    answerBlock.style.overflow = "auto";
    answerBlock.setText(this.payload.answer || "(empty answer)");
    const sourcesBlock = contentEl.createDiv();
    sourcesBlock.style.marginTop = "10px";
    sourcesBlock.createEl("strong", { text: "Sources" });
    if (this.payload.sources.length === 0) {
      sourcesBlock.createEl("div", { text: "No sources." });
    } else {
      for (const source of this.payload.sources) {
        sourcesBlock.createEl("div", {
          text: `- ${source.path} (${formatSimilarity(source.similarity)})`
        });
      }
    }
  }
};
var KnowledgeWeaverSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Auto-Linker Settings" });
    containerEl.createEl("p", {
      text: "Language docs: README.md (index) | README_KO.md (Korean quick access)"
    });
    new import_obsidian4.Setting(containerEl).setName("Provider").setDesc("Choose AI provider. Local providers are recommended first.").addDropdown(
      (dropdown) => dropdown.addOption("ollama", "Ollama (local)").addOption("lmstudio", "LM Studio (local)").addOption("openai", "OpenAI / Codex").addOption("anthropic", "Claude").addOption("gemini", "Gemini").setValue(this.plugin.settings.provider).onChange(async (value) => {
        this.plugin.settings.provider = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    containerEl.createEl("h3", { text: "Local provider config" });
    new import_obsidian4.Setting(containerEl).setName("Ollama base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.ollamaBaseUrl).onChange(async (value) => {
        this.plugin.settings.ollamaBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const ollamaOptions = this.plugin.getOllamaModelOptions();
    new import_obsidian4.Setting(containerEl).setName("Ollama detected model picker").setDesc(
      "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for analysis."
    ).addDropdown((dropdown) => {
      if (ollamaOptions.length === 0) {
        dropdown.addOption("", "(No models detected)");
        dropdown.setValue("");
      } else {
        for (const option of ollamaOptions) {
          const suffix = option.status === "recommended" ? " (\uCD94\uCC9C)" : option.status === "unavailable" ? " (\uBD88\uAC00)" : "";
          dropdown.addOption(option.model, `${option.model}${suffix}`);
        }
        const current = this.plugin.settings.ollamaModel;
        if (current && ollamaOptions.some((option) => option.model === current)) {
          dropdown.setValue(current);
        } else {
          dropdown.setValue(ollamaOptions[0].model);
        }
      }
      dropdown.onChange(async (value) => {
        if (!value) {
          return;
        }
        this.plugin.settings.ollamaModel = value;
        await this.plugin.saveSettings();
        if (!isOllamaModelAnalyzable(value)) {
          new import_obsidian4.Notice(`Selected model is marked as (\uBD88\uAC00): ${value}`, 4500);
        }
        this.display();
      });
    }).addButton(
      (button) => button.setButtonText("Refresh").onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText("Use recommended").onClick(async () => {
        await this.plugin.applyRecommendedOllamaModel(true);
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Ollama model (manual)").setDesc("Manual override if you want a custom model name.").addText(
      (text) => text.setPlaceholder("qwen2.5:7b").setValue(this.plugin.settings.ollamaModel).onChange(async (value) => {
        this.plugin.settings.ollamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Auto-pick recommended Ollama model").setDesc("Detect local models and auto-choose recommended when current is missing.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.ollamaAutoPickEnabled).onChange(async (value) => {
        this.plugin.settings.ollamaAutoPickEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Ollama detection summary").setDesc(this.plugin.getOllamaDetectionSummary());
    new import_obsidian4.Setting(containerEl).setName("LM Studio base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:1234").setValue(this.plugin.settings.lmStudioBaseUrl).onChange(async (value) => {
        this.plugin.settings.lmStudioBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("LM Studio model").addText(
      (text) => text.setPlaceholder("local-model").setValue(this.plugin.settings.lmStudioModel).onChange(async (value) => {
        this.plugin.settings.lmStudioModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("LM Studio API key (optional)").addText(
      (text) => text.setPlaceholder("Leave empty if not required").setValue(this.plugin.settings.lmStudioApiKey).onChange(async (value) => {
        this.plugin.settings.lmStudioApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Cloud provider config" });
    new import_obsidian4.Setting(containerEl).setName("OpenAI base URL").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.openAIBaseUrl).onChange(async (value) => {
        this.plugin.settings.openAIBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("OpenAI model").addText(
      (text) => text.setPlaceholder("gpt-5-mini").setValue(this.plugin.settings.openAIModel).onChange(async (value) => {
        this.plugin.settings.openAIModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("OpenAI API key").addText(
      (text) => text.setPlaceholder("sk-...").setValue(this.plugin.settings.openAIApiKey).onChange(async (value) => {
        this.plugin.settings.openAIApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Anthropic model").addText(
      (text) => text.setPlaceholder("claude-3-7-sonnet-latest").setValue(this.plugin.settings.anthropicModel).onChange(async (value) => {
        this.plugin.settings.anthropicModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Anthropic API key").addText(
      (text) => text.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).onChange(async (value) => {
        this.plugin.settings.anthropicApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Gemini model").addText(
      (text) => text.setPlaceholder("gemini-2.5-pro").setValue(this.plugin.settings.geminiModel).onChange(async (value) => {
        this.plugin.settings.geminiModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Gemini API key").addText(
      (text) => text.setPlaceholder("AIza...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Behavior" });
    new import_obsidian4.Setting(containerEl).setName("Suggestion mode (recommended)").setDesc("Analyze first, preview changes, and apply only when approved.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.suggestionMode).onChange(async (value) => {
        this.plugin.settings.suggestionMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Show reasons for each field").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReasons).onChange(async (value) => {
        this.plugin.settings.includeReasons = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Show progress notices").setDesc("In addition to persistent progress modal, show short notices.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showProgressNotices).onChange(async (value) => {
        this.plugin.settings.showProgressNotices = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Analyze tags").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeTags).onChange(async (value) => {
        this.plugin.settings.analyzeTags = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Analyze topic").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeTopic).onChange(async (value) => {
        this.plugin.settings.analyzeTopic = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Analyze linked").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeLinked).onChange(async (value) => {
        this.plugin.settings.analyzeLinked = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Analyze index").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeIndex).onChange(async (value) => {
        this.plugin.settings.analyzeIndex = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Max tags").addText(
      (text) => text.setPlaceholder("8").setValue(String(this.plugin.settings.maxTags)).onChange(async (value) => {
        this.plugin.settings.maxTags = parsePositiveInt(
          value,
          this.plugin.settings.maxTags
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Max linked").addText(
      (text) => text.setPlaceholder("8").setValue(String(this.plugin.settings.maxLinked)).onChange(async (value) => {
        this.plugin.settings.maxLinked = parsePositiveInt(
          value,
          this.plugin.settings.maxLinked
        );
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Semantic linking (Ollama embeddings)" });
    new import_obsidian4.Setting(containerEl).setName("Enable semantic candidate ranking").setDesc(
      "Use local Ollama embeddings to rank likely related notes before AI linked suggestion."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.semanticLinkingEnabled).onChange(async (value) => {
        this.plugin.settings.semanticLinkingEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Embedding Ollama base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.semanticOllamaBaseUrl).onChange(async (value) => {
        this.plugin.settings.semanticOllamaBaseUrl = value.trim();
        await this.plugin.saveSettings();
        await this.plugin.refreshEmbeddingModelDetection({
          notify: false,
          autoApply: true
        });
      })
    );
    const embeddingOptions = this.plugin.getEmbeddingModelOptions();
    new import_obsidian4.Setting(containerEl).setName("Embedding detected model picker").setDesc(
      "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for embeddings."
    ).addDropdown((dropdown) => {
      var _a, _b;
      if (embeddingOptions.length === 0) {
        dropdown.addOption("", "(No models detected)");
        dropdown.setValue("");
      } else {
        for (const option of embeddingOptions) {
          const suffix = option.status === "recommended" ? " (\uCD94\uCC9C)" : option.status === "unavailable" ? " (\uBD88\uAC00)" : "";
          dropdown.addOption(option.model, `${option.model}${suffix}`);
        }
        const current = this.plugin.settings.semanticOllamaModel;
        if (current && embeddingOptions.some((option) => option.model === current)) {
          dropdown.setValue(current);
        } else {
          dropdown.setValue((_b = (_a = embeddingOptions[0]) == null ? void 0 : _a.model) != null ? _b : "");
        }
      }
      dropdown.onChange(async (value) => {
        if (!value) {
          return;
        }
        this.plugin.settings.semanticOllamaModel = value;
        await this.plugin.saveSettings();
        if (!isOllamaModelEmbeddingCapable(value)) {
          new import_obsidian4.Notice(`Selected model is marked as (\uBD88\uAC00): ${value}`, 4500);
        }
        this.display();
      });
    }).addButton(
      (button) => button.setButtonText("Refresh").onClick(async () => {
        await this.plugin.refreshEmbeddingModelDetection({
          notify: true,
          autoApply: true
        });
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText("Use recommended").onClick(async () => {
        await this.plugin.applyRecommendedEmbeddingModel(true);
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Embedding model (manual)").setDesc("Manual override if you want a custom embedding model name.").addText(
      (text) => text.setPlaceholder("nomic-embed-text").setValue(this.plugin.settings.semanticOllamaModel).onChange(async (value) => {
        this.plugin.settings.semanticOllamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Auto-pick recommended embedding model").setDesc(
      "Detect local models and auto-choose recommended when current is missing."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.semanticAutoPickEnabled).onChange(async (value) => {
        this.plugin.settings.semanticAutoPickEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Embedding detection summary").setDesc(this.plugin.getEmbeddingDetectionSummary());
    new import_obsidian4.Setting(containerEl).setName("Semantic top-k candidates").addText(
      (text) => text.setPlaceholder("24").setValue(String(this.plugin.settings.semanticTopK)).onChange(async (value) => {
        this.plugin.settings.semanticTopK = parsePositiveInt(
          value,
          this.plugin.settings.semanticTopK
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Semantic min similarity").setDesc("Range: 0.0 to 1.0").addText(
      (text) => text.setPlaceholder("0.25").setValue(String(this.plugin.settings.semanticMinSimilarity)).onChange(async (value) => {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          this.plugin.settings.semanticMinSimilarity = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Semantic source max chars").setDesc("Trim note text before embedding to keep local runs fast.").addText(
      (text) => text.setPlaceholder("5000").setValue(String(this.plugin.settings.semanticMaxChars)).onChange(async (value) => {
        this.plugin.settings.semanticMaxChars = parsePositiveInt(
          value,
          this.plugin.settings.semanticMaxChars
        );
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Local Q&A (security-first)" });
    new import_obsidian4.Setting(containerEl).setName("Q&A Ollama base URL").setDesc("Leave empty to use main Ollama base URL.").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.qaOllamaBaseUrl).onChange(async (value) => {
        this.plugin.settings.qaOllamaBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A model").setDesc("Leave empty to use main analysis model.").addText(
      (text) => text.setPlaceholder("qwen2.5:7b").setValue(this.plugin.settings.qaOllamaModel).onChange(async (value) => {
        this.plugin.settings.qaOllamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A retrieval top-k").addText(
      (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings.qaTopK)).onChange(async (value) => {
        this.plugin.settings.qaTopK = parsePositiveInt(
          value,
          this.plugin.settings.qaTopK
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A max context chars").setDesc("Maximum total note characters to send to local LLM.").addText(
      (text) => text.setPlaceholder("12000").setValue(String(this.plugin.settings.qaMaxContextChars)).onChange(async (value) => {
        this.plugin.settings.qaMaxContextChars = parsePositiveInt(
          value,
          this.plugin.settings.qaMaxContextChars
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Allow non-local Q&A endpoint (danger)").setDesc("Off by default. Keep disabled to prevent note data leaving localhost.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAllowNonLocalEndpoint).onChange(async (value) => {
        this.plugin.settings.qaAllowNonLocalEndpoint = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Remove legacy AI-prefixed keys").setDesc(
      "If enabled, removes only legacy keys like ai_*/autolinker_* while preserving other existing keys (including linter date fields)."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.cleanUnknownFrontmatter).onChange(async (value) => {
        this.plugin.settings.cleanUnknownFrontmatter = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Property cleanup" });
    new import_obsidian4.Setting(containerEl).setName("Enable cleanup rules during apply").setDesc("When applying AI suggestions, also remove frontmatter keys by rules below.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.propertyCleanupEnabled).onChange(async (value) => {
        this.plugin.settings.propertyCleanupEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Cleanup exact keys").setDesc("Comma/newline separated keys. Example: related, linked_context").addTextArea(
      (text) => text.setPlaceholder("related").setValue(this.plugin.settings.propertyCleanupKeys).onChange(async (value) => {
        this.plugin.settings.propertyCleanupKeys = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Pick cleanup keys from selected notes").setDesc("Scan selected notes and choose keys by checkbox.").addButton(
      (button) => button.setButtonText("Open picker").onClick(async () => {
        await this.plugin.openCleanupKeyPicker();
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Cleanup key prefixes").setDesc("Comma/newline separated prefixes. Example: temp_, draft_").addTextArea(
      (text) => text.setPlaceholder("temp_,draft_").setValue(this.plugin.settings.propertyCleanupPrefixes).onChange(async (value) => {
        this.plugin.settings.propertyCleanupPrefixes = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Never remove these keys").setDesc("Comma/newline separated keys that override cleanup rules.").addTextArea(
      (text) => text.setPlaceholder("date created,date updated").setValue(this.plugin.settings.propertyCleanupKeepKeys).onChange(async (value) => {
        this.plugin.settings.propertyCleanupKeepKeys = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Run cleanup command").setDesc(
      "Use command palette: apply='Auto-Linker: Cleanup frontmatter properties for selected notes', preview='Auto-Linker: Dry-run cleanup frontmatter properties for selected notes'."
    );
    new import_obsidian4.Setting(containerEl).setName("Sort tags and linked arrays").setDesc("Helps keep stable output and reduce linter churn.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.sortArrays).onChange(async (value) => {
        this.plugin.settings.sortArrays = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Selection and backup" });
    new import_obsidian4.Setting(containerEl).setName("Include subfolders for selected folders").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeSubfoldersInFolderSelection).onChange(async (value) => {
        this.plugin.settings.includeSubfoldersInFolderSelection = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Selection path width percent").setDesc("Controls path width in Select target notes/folders modal (45-100).").addText(
      (text) => text.setPlaceholder("72").setValue(String(this.plugin.settings.selectionPathWidthPercent)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed >= 45 && parsed <= 100) {
          this.plugin.settings.selectionPathWidthPercent = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Excluded folder patterns").setDesc("Comma-separated substrings. Matched folders are ignored during selection/analysis.").addText(
      (text) => text.setPlaceholder(".obsidian,Auto-Linker Backups").setValue(this.plugin.settings.excludedFolderPatterns).onChange(async (value) => {
        this.plugin.settings.excludedFolderPatterns = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Backup selected notes before apply").setDesc("You can also override this every run from the backup confirmation dialog.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.backupBeforeApply).onChange(async (value) => {
        this.plugin.settings.backupBeforeApply = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Backup root path").setDesc("Vault-relative folder path used for versioned backups.").addText(
      (text) => text.setPlaceholder("Auto-Linker Backups").setValue(this.plugin.settings.backupRootPath).onChange(async (value) => {
        this.plugin.settings.backupRootPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Backup retention count").setDesc("Keep only latest N backups (old backups are deleted automatically).").addText(
      (text) => text.setPlaceholder("10").setValue(String(this.plugin.settings.backupRetentionCount)).onChange(async (value) => {
        this.plugin.settings.backupRetentionCount = parsePositiveInt(
          value,
          this.plugin.settings.backupRetentionCount
        );
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "MOC" });
    new import_obsidian4.Setting(containerEl).setName("Generate MOC after apply").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.generateMoc).onChange(async (value) => {
        this.plugin.settings.generateMoc = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("MOC file path").setDesc("Vault-relative markdown path.").addText(
      (text) => text.setPlaceholder("MOC/Selected Knowledge MOC.md").setValue(this.plugin.settings.mocPath).onChange(async (value) => {
        this.plugin.settings.mocPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
  }
};
var KnowledgeWeaverPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.statusBarEl = null;
    this.ollamaDetectionCache = null;
    this.ollamaDetectionOptions = [];
    this.ollamaDetectionSummary = "Model detection has not run yet. Click refresh to detect installed Ollama models.";
    this.embeddingDetectionCache = null;
    this.embeddingDetectionOptions = [];
    this.embeddingDetectionSummary = "Embedding model detection has not run yet. Click refresh to detect installed Ollama models.";
  }
  async onload() {
    await this.loadSettings();
    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("idle");
    this.addCommand({
      id: "select-target-notes",
      name: "Auto-Linker: Select target notes/folders",
      callback: async () => this.openSelectionModal()
    });
    this.addCommand({
      id: "analyze-target-notes",
      name: "Auto-Linker: Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis()
    });
    this.addCommand({
      id: "clear-target-notes",
      name: "Auto-Linker: Clear selected target notes/folders",
      callback: async () => {
        this.settings.targetFilePaths = [];
        this.settings.targetFolderPaths = [];
        await this.saveSettings();
        this.notice("Target file/folder selection cleared.");
      }
    });
    this.addCommand({
      id: "backup-selected-notes",
      name: "Auto-Linker: Backup selected notes",
      callback: async () => this.backupSelectedNotesNow()
    });
    this.addCommand({
      id: "restore-latest-backup",
      name: "Auto-Linker: Restore from latest backup",
      callback: async () => this.restoreFromLatestBackup()
    });
    this.addCommand({
      id: "cleanup-selected-frontmatter",
      name: "Auto-Linker: Cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(false)
    });
    this.addCommand({
      id: "cleanup-selected-frontmatter-dry-run",
      name: "Auto-Linker: Dry-run cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(true)
    });
    this.addCommand({
      id: "select-cleanup-keys-from-selected-notes",
      name: "Auto-Linker: Select cleanup keys from selected notes",
      callback: async () => this.openCleanupKeyPicker()
    });
    this.addCommand({
      id: "refresh-ollama-models",
      name: "Auto-Linker: Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      }
    });
    this.addCommand({
      id: "refresh-embedding-models",
      name: "Auto-Linker: Refresh embedding model detection",
      callback: async () => {
        await this.refreshEmbeddingModelDetection({ notify: true, autoApply: true });
      }
    });
    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection()
    });
    this.addCommand({
      id: "ask-local-ai-from-selected-notes",
      name: "Auto-Linker: Ask local AI from selected notes",
      callback: async () => this.openLocalQaInputModal()
    });
    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
    await this.refreshOllamaDetection({ notify: false, autoApply: true });
    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
  }
  onunload() {
    this.setStatus("idle");
  }
  getOllamaDetectionSummary() {
    return this.ollamaDetectionSummary;
  }
  getOllamaModelOptions() {
    return this.ollamaDetectionOptions;
  }
  getEmbeddingDetectionSummary() {
    return this.embeddingDetectionSummary;
  }
  getEmbeddingModelOptions() {
    return this.embeddingDetectionOptions;
  }
  async applyRecommendedOllamaModel(notify) {
    var _a;
    if (!((_a = this.ollamaDetectionCache) == null ? void 0 : _a.recommended)) {
      if (notify) {
        this.notice("No recommended Ollama model found. Refresh detection first.");
      }
      return;
    }
    this.settings.ollamaModel = this.ollamaDetectionCache.recommended;
    await this.saveSettings();
    if (notify) {
      this.notice(`Ollama model set to recommended: ${this.settings.ollamaModel}`);
    }
  }
  async applyRecommendedEmbeddingModel(notify) {
    var _a;
    if (!((_a = this.embeddingDetectionCache) == null ? void 0 : _a.recommended)) {
      if (notify) {
        this.notice("No recommended embedding model found. Refresh detection first.");
      }
      return;
    }
    this.settings.semanticOllamaModel = this.embeddingDetectionCache.recommended;
    await this.saveSettings();
    if (notify) {
      this.notice(
        `Embedding model set to recommended: ${this.settings.semanticOllamaModel}`
      );
    }
  }
  async refreshOllamaDetection(options) {
    try {
      const detected = await detectOllamaModels(this.settings.ollamaBaseUrl);
      this.ollamaDetectionCache = detected;
      this.ollamaDetectionOptions = buildOllamaModelOptions(
        detected.models,
        detected.recommended
      );
      const modelListPreview = detected.models.length > 0 ? detected.models.slice(0, 5).join(", ") : "(none)";
      this.ollamaDetectionSummary = [
        `Detected: ${detected.models.length} model(s).`,
        `Current: ${this.settings.ollamaModel || "(not set)"}.`,
        `Recommended: ${detected.recommended || "(none)"}.`,
        `Reason: ${detected.reason}`,
        `Preview: ${modelListPreview}`
      ].join(" ");
      if (options.autoApply && this.settings.ollamaAutoPickEnabled) {
        const current = this.settings.ollamaModel.trim();
        const currentExists = current.length > 0 && detected.models.includes(current);
        if ((!current || !currentExists) && detected.recommended) {
          this.settings.ollamaModel = detected.recommended;
          await this.saveSettings();
          if (options.notify) {
            this.notice(
              `Auto-selected Ollama model: ${detected.recommended} (${detected.reason})`
            );
          }
        }
      }
      if (options.notify) {
        this.notice(this.ollamaDetectionSummary, 5e3);
      }
      return detected;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Ollama detection error";
      this.ollamaDetectionCache = null;
      this.ollamaDetectionOptions = [];
      this.ollamaDetectionSummary = `Detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Ollama model detection failed: ${message}`);
      }
      return null;
    }
  }
  async refreshEmbeddingModelDetection(options) {
    const baseUrl = this.settings.semanticOllamaBaseUrl.trim() || this.settings.ollamaBaseUrl.trim();
    if (!baseUrl) {
      this.embeddingDetectionSummary = "Embedding detection skipped: base URL is empty.";
      if (options.notify) {
        this.notice(this.embeddingDetectionSummary);
      }
      return null;
    }
    try {
      const detected = await detectOllamaEmbeddingModels(baseUrl);
      this.embeddingDetectionCache = detected;
      this.embeddingDetectionOptions = buildOllamaEmbeddingModelOptions(
        detected.models,
        detected.recommended
      );
      const modelListPreview = detected.models.length > 0 ? detected.models.slice(0, 5).join(", ") : "(none)";
      this.embeddingDetectionSummary = [
        `Detected: ${detected.models.length} model(s).`,
        `Current: ${this.settings.semanticOllamaModel || "(not set)"}.`,
        `Recommended: ${detected.recommended || "(none)"}.`,
        `Reason: ${detected.reason}`,
        `Preview: ${modelListPreview}`
      ].join(" ");
      if (options.autoApply && this.settings.semanticAutoPickEnabled) {
        const current = this.settings.semanticOllamaModel.trim();
        const currentExists = current.length > 0 && detected.models.includes(current);
        if ((!current || !currentExists) && detected.recommended) {
          this.settings.semanticOllamaModel = detected.recommended;
          await this.saveSettings();
          if (options.notify) {
            this.notice(
              `Auto-selected embedding model: ${detected.recommended} (${detected.reason})`
            );
          }
        }
      }
      if (options.notify) {
        this.notice(this.embeddingDetectionSummary, 5e3);
      }
      return detected;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown embedding detection error";
      this.embeddingDetectionCache = null;
      this.embeddingDetectionOptions = [];
      this.embeddingDetectionSummary = `Embedding detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Embedding model detection failed: ${message}`);
      }
      return null;
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.settings.targetFilePaths)) {
      this.settings.targetFilePaths = [];
    }
    if (!Array.isArray(this.settings.targetFolderPaths)) {
      this.settings.targetFolderPaths = [];
    }
    if (!Number.isFinite(this.settings.selectionPathWidthPercent)) {
      this.settings.selectionPathWidthPercent = DEFAULT_SETTINGS.selectionPathWidthPercent;
    }
    if (!this.settings.backupRootPath) {
      this.settings.backupRootPath = DEFAULT_SETTINGS.backupRootPath;
    }
    if (!this.settings.excludedFolderPatterns) {
      this.settings.excludedFolderPatterns = DEFAULT_SETTINGS.excludedFolderPatterns;
    }
    if (!Number.isFinite(this.settings.backupRetentionCount)) {
      this.settings.backupRetentionCount = DEFAULT_SETTINGS.backupRetentionCount;
    }
    if (!Number.isFinite(this.settings.semanticTopK)) {
      this.settings.semanticTopK = DEFAULT_SETTINGS.semanticTopK;
    }
    if (!Number.isFinite(this.settings.semanticMinSimilarity)) {
      this.settings.semanticMinSimilarity = DEFAULT_SETTINGS.semanticMinSimilarity;
    }
    if (!Number.isFinite(this.settings.semanticMaxChars)) {
      this.settings.semanticMaxChars = DEFAULT_SETTINGS.semanticMaxChars;
    }
    if (!Number.isFinite(this.settings.qaTopK)) {
      this.settings.qaTopK = DEFAULT_SETTINGS.qaTopK;
    }
    if (!Number.isFinite(this.settings.qaMaxContextChars)) {
      this.settings.qaMaxContextChars = DEFAULT_SETTINGS.qaMaxContextChars;
    }
    if (!this.settings.semanticOllamaBaseUrl) {
      this.settings.semanticOllamaBaseUrl = DEFAULT_SETTINGS.semanticOllamaBaseUrl;
    }
    if (!this.settings.semanticOllamaModel) {
      this.settings.semanticOllamaModel = DEFAULT_SETTINGS.semanticOllamaModel;
    }
    if (typeof this.settings.qaOllamaBaseUrl !== "string") {
      this.settings.qaOllamaBaseUrl = DEFAULT_SETTINGS.qaOllamaBaseUrl;
    }
    if (typeof this.settings.qaOllamaModel !== "string") {
      this.settings.qaOllamaModel = DEFAULT_SETTINGS.qaOllamaModel;
    }
    if (typeof this.settings.semanticAutoPickEnabled !== "boolean") {
      this.settings.semanticAutoPickEnabled = DEFAULT_SETTINGS.semanticAutoPickEnabled;
    }
    if (typeof this.settings.qaAllowNonLocalEndpoint !== "boolean") {
      this.settings.qaAllowNonLocalEndpoint = DEFAULT_SETTINGS.qaAllowNonLocalEndpoint;
    }
    if (typeof this.settings.propertyCleanupKeys !== "string") {
      this.settings.propertyCleanupKeys = DEFAULT_SETTINGS.propertyCleanupKeys;
    }
    if (typeof this.settings.propertyCleanupPrefixes !== "string") {
      this.settings.propertyCleanupPrefixes = DEFAULT_SETTINGS.propertyCleanupPrefixes;
    }
    if (typeof this.settings.propertyCleanupKeepKeys !== "string") {
      this.settings.propertyCleanupKeepKeys = DEFAULT_SETTINGS.propertyCleanupKeepKeys;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  setStatus(text) {
    var _a;
    (_a = this.statusBarEl) == null ? void 0 : _a.setText(`Auto-Linker: ${text}`);
  }
  notice(text, timeout = 3500) {
    if (!this.settings.showProgressNotices) {
      return;
    }
    new import_obsidian4.Notice(text, timeout);
  }
  parseSimpleList(raw) {
    return raw.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);
  }
  parseFrontmatterFromContent(content) {
    const lines = content.split("\n");
    if (lines.length < 3 || lines[0].trim() !== "---") {
      return null;
    }
    let end = -1;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === "---") {
        end = i;
        break;
      }
    }
    if (end < 1) {
      return null;
    }
    const yamlRaw = lines.slice(1, end).join("\n").trim();
    if (!yamlRaw) {
      return {};
    }
    try {
      const parsed = (0, import_obsidian4.parseYaml)(yamlRaw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return {};
    } catch (e) {
      return null;
    }
  }
  async readFrontmatterSnapshot(file) {
    const raw = await this.app.vault.cachedRead(file);
    return this.parseFrontmatterFromContent(raw);
  }
  async collectCleanupKeyStats(files) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const file of files) {
      const frontmatter = await this.readFrontmatterSnapshot(file);
      if (!frontmatter) {
        continue;
      }
      const keys = Object.keys(frontmatter).map((key) => key.trim().toLowerCase()).filter((key) => key.length > 0);
      const unique = new Set(keys);
      for (const key of unique) {
        counts.set(key, ((_a = counts.get(key)) != null ? _a : 0) + 1);
      }
    }
    return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
  async openCleanupKeyPicker() {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    this.setStatus("scanning cleanup keys...");
    const keyStats = await this.collectCleanupKeyStats(selectedFiles);
    this.setStatus("idle");
    if (keyStats.length === 0) {
      this.notice("No frontmatter keys found in selected notes.");
      return;
    }
    const currentKeys = this.parseSimpleList(this.settings.propertyCleanupKeys);
    new CleanupKeyPickerModal(
      this.app,
      keyStats,
      currentKeys,
      async (selected) => {
        this.settings.propertyCleanupKeys = selected.join(", ");
        await this.saveSettings();
        this.notice(`Cleanup exact keys updated (${selected.length} selected).`, 5e3);
      }
    ).open();
  }
  isLocalEndpoint(urlText) {
    try {
      const parsed = new URL(urlText);
      const host = parsed.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
    } catch (e) {
      return false;
    }
  }
  resolveQaBaseUrl() {
    const qa = this.settings.qaOllamaBaseUrl.trim();
    const fallback = this.settings.ollamaBaseUrl.trim();
    return qa || fallback;
  }
  resolveQaModel() {
    const qa = this.settings.qaOllamaModel.trim();
    const fallback = this.settings.ollamaModel.trim();
    return qa || fallback;
  }
  trimTextForContext(source, maxChars) {
    const collapsed = source.replace(/\s+/g, " ").trim();
    return collapsed.slice(0, Math.max(400, maxChars));
  }
  tokenizeQuery(text) {
    return [...new Set(
      text.toLowerCase().split(/[\s,.;:!?()[\]{}"'<>\\/|`~!@#$%^&*+=_-]+/).map((token) => token.trim()).filter((token) => token.length >= 2)
    )];
  }
  rerankQaHits(hits, question, topK) {
    const terms = this.tokenizeQuery(question);
    const scored = hits.map((hit) => {
      if (terms.length === 0) {
        return { ...hit, boosted: hit.similarity };
      }
      const lowerPath = hit.path.toLowerCase();
      let matched = 0;
      for (const term of terms) {
        if (lowerPath.includes(term)) {
          matched += 1;
        }
      }
      const boost = Math.min(0.24, matched * 0.08);
      return {
        ...hit,
        boosted: hit.similarity + boost
      };
    });
    scored.sort((a, b) => b.boosted - a.boosted || a.path.localeCompare(b.path));
    return scored.slice(0, Math.max(1, topK)).map((item) => ({
      path: item.path,
      similarity: item.similarity
    }));
  }
  extractRelevantSnippet(source, query, maxChars) {
    const normalized = source.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const terms = this.tokenizeQuery(query);
    if (terms.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }
    const lowerLines = lines.map((line) => line.toLowerCase());
    const scored = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lowerLines[i];
      if (!line.trim()) {
        continue;
      }
      let score = 0;
      for (const term of terms) {
        if (line.includes(term)) {
          score += 1;
        }
      }
      if (score > 0) {
        scored.push({ idx: i, score });
      }
    }
    if (scored.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    const pickedIndexes = /* @__PURE__ */ new Set();
    for (const item of scored.slice(0, 12)) {
      const start = Math.max(0, item.idx - 1);
      const end = Math.min(lines.length - 1, item.idx + 1);
      for (let i = start; i <= end; i += 1) {
        pickedIndexes.add(i);
      }
    }
    const ordered = [...pickedIndexes].sort((a, b) => a - b);
    let output = "";
    let prev = -10;
    for (const idx of ordered) {
      const line = lines[idx].trimEnd();
      if (!line.trim()) {
        continue;
      }
      if (idx - prev > 2 && output.length > 0) {
        output += "\n...\n";
      }
      const candidate = output.length > 0 ? `${output}
${line}` : line;
      if (candidate.length > maxChars) {
        break;
      }
      output = candidate;
      prev = idx;
    }
    if (!output) {
      return this.trimTextForContext(source, maxChars);
    }
    return output;
  }
  buildLocalQaPrompt(question, sourceBlocks) {
    const contextText = sourceBlocks.map(
      (item, index) => `Source ${index + 1}
Path: ${item.path}
Similarity: ${formatSimilarity(item.similarity)}
Content:
${item.content}`
    ).join("\n\n---\n\n");
    return [
      "You are a local-note assistant for Obsidian.",
      "Answer only from the provided sources.",
      "Use the same language as the user's question.",
      "Tone: natural conversation, concise, not stiff.",
      "Do not force rigid sections. Use bullets only if they improve clarity.",
      "Start with a direct answer in 1-3 sentences.",
      "If useful, add short insight synthesis (patterns, contradictions, implications).",
      "If evidence is insufficient, clearly say what is missing.",
      "When making claims, cite source paths inline in parentheses.",
      "",
      `Question: ${question}`,
      "",
      "Sources:",
      contextText
    ].join("\n");
  }
  async openLocalQaInputModal() {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    new LocalQAInputModal(
      this.app,
      this.settings.qaTopK,
      async (payload) => {
        await this.runLocalQa(payload.question, payload.topK);
      }
    ).open();
  }
  async runLocalQa(question, topK) {
    var _a;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      return;
    }
    const qaBaseUrl = this.resolveQaBaseUrl();
    if (!qaBaseUrl) {
      this.notice("Q&A base URL is empty.");
      return;
    }
    if (!this.settings.qaAllowNonLocalEndpoint && !this.isLocalEndpoint(qaBaseUrl)) {
      this.notice(
        "Blocked by security policy: Q&A endpoint must be localhost unless explicitly allowed.",
        7e3
      );
      return;
    }
    const qaModel = this.resolveQaModel();
    if (!qaModel) {
      this.notice("Q&A model is empty.");
      return;
    }
    if (!isOllamaModelAnalyzable(qaModel)) {
      this.notice(`Q&A model is not suitable: ${qaModel}`, 6e3);
      return;
    }
    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
    const embeddingModel = this.settings.semanticOllamaModel.trim();
    if (!embeddingModel) {
      this.notice("Embedding model is empty. Refresh embedding detection first.", 6e3);
      return;
    }
    this.setStatus("semantic retrieval for local qa...");
    const retrievalCandidateK = Math.max(topK * 3, topK);
    const retrieval = await searchSemanticNotesByQuery(
      this.app,
      selectedFiles,
      this.settings,
      question,
      retrievalCandidateK
    );
    if (retrieval.errors.length > 0) {
      this.notice(
        `Semantic retrieval had ${retrieval.errors.length} issue(s).`,
        6e3
      );
    }
    if (retrieval.hits.length === 0) {
      this.notice("No relevant notes were found for this question.");
      this.setStatus("idle");
      return;
    }
    const rankedHits = this.rerankQaHits(retrieval.hits, question, topK);
    if (rankedHits.length === 0) {
      this.notice("No relevant notes were found for this question.");
      this.setStatus("idle");
      return;
    }
    const maxContextChars = Math.max(2e3, this.settings.qaMaxContextChars);
    const sourceBlocks = [];
    let usedChars = 0;
    for (const hit of rankedHits) {
      if (usedChars >= maxContextChars) {
        break;
      }
      const entry = this.app.vault.getAbstractFileByPath(hit.path);
      if (!(entry instanceof import_obsidian4.TFile)) {
        continue;
      }
      const raw = await this.app.vault.cachedRead(entry);
      const remaining = Math.max(500, maxContextChars - usedChars);
      const snippet = this.extractRelevantSnippet(raw, question, remaining);
      if (!snippet) {
        continue;
      }
      sourceBlocks.push({
        path: hit.path,
        similarity: hit.similarity,
        content: snippet
      });
      usedChars += snippet.length;
    }
    if (sourceBlocks.length === 0) {
      this.notice("Relevant notes found but no readable content extracted.");
      this.setStatus("idle");
      return;
    }
    const prompt = this.buildLocalQaPrompt(question, sourceBlocks);
    this.setStatus("asking local qa model...");
    const response = await (0, import_obsidian4.requestUrl)({
      url: `${qaBaseUrl.replace(/\/$/, "")}/api/generate`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        prompt,
        stream: false
      }),
      throw: false
    });
    if (response.status >= 300) {
      this.notice(`Local Q&A request failed: ${response.status}`, 6e3);
      this.setStatus("idle");
      return;
    }
    const answer = typeof ((_a = response.json) == null ? void 0 : _a.response) === "string" ? response.json.response.trim() : response.text.trim();
    if (!answer) {
      this.notice("Local Q&A returned an empty answer.");
      this.setStatus("idle");
      return;
    }
    const sourceList = sourceBlocks.map((item) => ({
      path: item.path,
      similarity: item.similarity
    }));
    new LocalQAResultModal(this.app, {
      question,
      answer,
      model: qaModel,
      embeddingModel,
      sources: sourceList
    }).open();
    this.notice(
      `Local Q&A done. Sources=${sourceList.length}, cacheHits=${retrieval.cacheHits}, cacheWrites=${retrieval.cacheWrites}`,
      6e3
    );
    this.setStatus("idle");
  }
  getPropertyCleanupConfig() {
    const removeKeys = new Set(this.parseSimpleList(this.settings.propertyCleanupKeys));
    const removePrefixes = this.parseSimpleList(this.settings.propertyCleanupPrefixes);
    const keepKeys = new Set(this.parseSimpleList(this.settings.propertyCleanupKeepKeys));
    if (removeKeys.size === 0 && removePrefixes.length === 0) {
      return void 0;
    }
    return {
      removeKeys,
      removePrefixes,
      keepKeys
    };
  }
  getCandidateLinkPathsForFile(filePath, selectedFiles, semanticNeighbors) {
    var _a;
    const fallback = selectedFiles.filter((candidate) => candidate.path !== filePath).map((candidate) => candidate.path);
    if (!semanticNeighbors || !this.settings.semanticLinkingEnabled) {
      return fallback;
    }
    const semantic = ((_a = semanticNeighbors.get(filePath)) != null ? _a : []).map((item) => item.path);
    if (semantic.length === 0) {
      return fallback;
    }
    const candidateLimit = Math.max(this.settings.maxLinked * 3, this.settings.semanticTopK);
    return mergeUniqueStrings(semantic, fallback).slice(0, candidateLimit);
  }
  parseExcludedPatterns() {
    return this.settings.excludedFolderPatterns.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);
  }
  isPathExcluded(path) {
    const lower = path.toLowerCase();
    const patterns = this.parseExcludedPatterns();
    return patterns.some((pattern) => lower.includes(pattern));
  }
  getAllMarkdownFiles() {
    return this.app.vault.getMarkdownFiles().filter((file) => !this.isPathExcluded(file.path)).sort((a, b) => a.path.localeCompare(b.path));
  }
  getAllFolders() {
    const folders = this.app.vault.getAllLoadedFiles().filter(
      (entry) => entry instanceof import_obsidian4.TFolder && entry.path.trim().length > 0 && !this.isPathExcluded(entry.path)
    );
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
  collectFilesFromFolder(folder, includeSubfolders, out) {
    if (this.isPathExcluded(folder.path)) {
      return;
    }
    for (const child of folder.children) {
      if (child instanceof import_obsidian4.TFile && child.extension === "md") {
        if (!this.isPathExcluded(child.path)) {
          out.add(child.path);
        }
        continue;
      }
      if (child instanceof import_obsidian4.TFolder && includeSubfolders) {
        this.collectFilesFromFolder(child, includeSubfolders, out);
      }
    }
  }
  getSelectedFiles() {
    const selectedPaths = /* @__PURE__ */ new Set();
    for (const path of this.settings.targetFilePaths) {
      if (this.isPathExcluded(path)) {
        continue;
      }
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof import_obsidian4.TFile && entry.extension === "md") {
        selectedPaths.add(entry.path);
      }
    }
    for (const folderPath of this.settings.targetFolderPaths) {
      if (this.isPathExcluded(folderPath)) {
        continue;
      }
      const entry = this.app.vault.getAbstractFileByPath(folderPath);
      if (entry instanceof import_obsidian4.TFolder) {
        this.collectFilesFromFolder(
          entry,
          this.settings.includeSubfoldersInFolderSelection,
          selectedPaths
        );
      }
    }
    const out = [];
    for (const path of selectedPaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof import_obsidian4.TFile && entry.extension === "md") {
        out.push(entry);
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }
  async openSelectionModal() {
    const allFiles = this.getAllMarkdownFiles();
    const allFolders = this.getAllFolders();
    new SelectionModal(
      this.app,
      allFiles,
      allFolders,
      this.settings.targetFilePaths,
      this.settings.targetFolderPaths,
      this.settings.includeSubfoldersInFolderSelection,
      this.settings.selectionPathWidthPercent,
      async (payload) => {
        this.settings.targetFilePaths = payload.selectedFilePaths;
        this.settings.targetFolderPaths = payload.selectedFolderPaths;
        this.settings.includeSubfoldersInFolderSelection = payload.includeSubfolders;
        this.settings.selectionPathWidthPercent = payload.pathWidthPercent;
        await this.saveSettings();
        const expandedCount = this.getSelectedFiles().length;
        this.notice(
          `Selection saved. Files: ${payload.selectedFilePaths.length}, folders: ${payload.selectedFolderPaths.length}, expanded markdown files: ${expandedCount}`,
          5e3
        );
      }
    ).open();
  }
  async askBackupDecision() {
    return BackupConfirmModal.ask(this.app, this.settings.backupBeforeApply);
  }
  async backupSelectedNotesNow() {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No selected notes to back up. Select targets first.");
      return;
    }
    const backupFolder = await this.createBackupForFiles(selectedFiles);
    this.notice(
      backupFolder ? `Backup created: ${backupFolder}` : "Backup skipped (no files).",
      5e3
    );
  }
  async runPropertyCleanup(dryRun) {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    const cleanupConfig = this.getPropertyCleanupConfig();
    if (!cleanupConfig && !this.settings.cleanUnknownFrontmatter) {
      this.notice(
        "No cleanup rules configured. Set cleanup keys/prefixes or enable legacy key cleanup first.",
        6e3
      );
      return;
    }
    let backupFolder = null;
    if (!dryRun) {
      const decision = await this.askBackupDecision();
      if (!decision.proceed) {
        this.notice("Cleanup cancelled.");
        return;
      }
      if (decision.rememberAsDefault) {
        this.settings.backupBeforeApply = decision.backupBeforeRun;
        await this.saveSettings();
      }
      if (decision.backupBeforeRun) {
        this.setStatus("creating backup...");
        backupFolder = await this.createBackupForFiles(selectedFiles);
        if (backupFolder) {
          this.notice(`Backup completed before cleanup: ${backupFolder}`, 5e3);
        }
      }
    }
    const progressModal = new RunProgressModal(
      this.app,
      dryRun ? "Dry-run cleanup for selected frontmatter" : "Cleaning selected frontmatter"
    );
    progressModal.open();
    const errors = [];
    const events = [];
    const startedAt = Date.now();
    let cancelled = false;
    let changedFiles = 0;
    let removedKeysTotal = 0;
    const dryRunReportRows = [];
    for (let index = 0; index < selectedFiles.length; index += 1) {
      if (progressModal.isCancelled()) {
        cancelled = true;
        break;
      }
      const file = selectedFiles[index];
      progressModal.update({
        stage: dryRun ? "Dry-run" : "Cleaning",
        current: index + 1,
        total: selectedFiles.length,
        startedAt,
        currentFile: file.path,
        errors,
        events
      });
      this.setStatus(
        `${dryRun ? "dry-run cleanup" : "cleaning"} ${index + 1}/${selectedFiles.length}`
      );
      try {
        if (dryRun) {
          const snapshot = await this.readFrontmatterSnapshot(file);
          if (!snapshot || Object.keys(snapshot).length === 0) {
            events.push({ filePath: file.path, status: "ok", message: "no-frontmatter" });
            continue;
          }
          const previewCleaned = cleanupFrontmatterRecord(snapshot, {
            cleanUnknown: this.settings.cleanUnknownFrontmatter,
            cleanupConfig
          });
          const previewRemoved = previewCleaned.removedKeys;
          if (previewRemoved.length === 0) {
            events.push({ filePath: file.path, status: "ok", message: "no-change" });
            continue;
          }
          changedFiles += 1;
          removedKeysTotal += previewRemoved.length;
          events.push({
            filePath: file.path,
            status: "ok",
            message: `would remove ${previewRemoved.length}`
          });
          dryRunReportRows.push(`## ${file.path}`);
          dryRunReportRows.push(
            `- Remove keys (${previewRemoved.length}): ${previewRemoved.sort((a, b) => a.localeCompare(b)).join(", ")}`
          );
          dryRunReportRows.push(
            `- Before keys: ${Object.keys(snapshot).sort((a, b) => a.localeCompare(b)).join(", ")}`
          );
          dryRunReportRows.push(
            `- After keys: ${Object.keys(previewCleaned.next).sort((a, b) => a.localeCompare(b)).join(", ")}`
          );
          dryRunReportRows.push("");
          continue;
        }
        let removedForFile = 0;
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const current = frontmatter;
          const cleaned = cleanupFrontmatterRecord(current, {
            cleanUnknown: this.settings.cleanUnknownFrontmatter,
            cleanupConfig
          });
          removedForFile = cleaned.removedKeys.length;
          if (removedForFile === 0) {
            return;
          }
          for (const key of Object.keys(current)) {
            delete current[key];
          }
          for (const [key, value] of Object.entries(cleaned.next)) {
            current[key] = value;
          }
        });
        if (removedForFile === 0) {
          events.push({ filePath: file.path, status: "ok", message: "no-change" });
          continue;
        }
        changedFiles += 1;
        removedKeysTotal += removedForFile;
        events.push({
          filePath: file.path,
          status: "ok",
          message: `removed ${removedForFile}`
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown cleanup error";
        errors.push({ filePath: file.path, message });
        events.push({ filePath: file.path, status: "error", message });
      }
    }
    progressModal.setFinished(
      cancelled ? `${dryRun ? "Dry-run cleanup" : "Cleanup"} stopped by user.` : `${dryRun ? "Dry-run cleanup" : "Cleanup"} complete: ${changedFiles} changed of ${selectedFiles.length}`
    );
    progressModal.close();
    this.setStatus(
      cancelled ? `${dryRun ? "dry-run cleanup" : "cleanup"} stopped (${changedFiles}/${selectedFiles.length})` : `${dryRun ? "dry-run cleanup" : "cleanup"} done (${changedFiles}/${selectedFiles.length})`
    );
    let reportPath = null;
    if (dryRun) {
      const removeKeys = cleanupConfig ? [...cleanupConfig.removeKeys].sort((a, b) => a.localeCompare(b)).join(", ") : "(none)";
      const removePrefixes = cleanupConfig ? cleanupConfig.removePrefixes.join(", ") || "(none)" : "(none)";
      const keepKeys = cleanupConfig ? [...cleanupConfig.keepKeys].sort((a, b) => a.localeCompare(b)).join(", ") : "(none)";
      const lines = [];
      lines.push("# Auto-Linker Cleanup Dry-Run Report");
      lines.push("");
      lines.push(`Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      lines.push(`Selected files: ${selectedFiles.length}`);
      lines.push(`Would change files: ${changedFiles}`);
      lines.push(`Would remove keys total: ${removedKeysTotal}`);
      lines.push(`Legacy cleanup enabled: ${this.settings.cleanUnknownFrontmatter}`);
      lines.push(`Cleanup keys: ${removeKeys || "(none)"}`);
      lines.push(`Cleanup prefixes: ${removePrefixes}`);
      lines.push(`Keep keys: ${keepKeys || "(none)"}`);
      lines.push("");
      if (dryRunReportRows.length === 0) {
        lines.push("No files would change.");
      } else {
        lines.push(...dryRunReportRows);
      }
      try {
        reportPath = (0, import_obsidian4.normalizePath)(
          `Auto-Linker Reports/cleanup-dry-run-${formatBackupStamp(/* @__PURE__ */ new Date())}.md`
        );
        await this.ensureParentFolder(reportPath);
        await this.app.vault.adapter.write(
          reportPath,
          `${lines.join("\n").trim()}
`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown dry-run report error";
        this.notice(`Dry-run report write failed: ${message}`, 6e3);
      }
    }
    const summary = `${dryRun ? "Dry-run cleanup" : "Cleanup"} finished. Changed files=${changedFiles}, removed keys=${removedKeysTotal}, errors=${errors.length}${cancelled ? " (stopped early)" : ""}.`;
    if (dryRun && reportPath) {
      this.notice(`${summary} Report: ${reportPath}`, 8e3);
      return;
    }
    if (backupFolder) {
      this.notice(`${summary} Backup: ${backupFolder}`, 7e3);
    } else {
      this.notice(summary, 6e3);
    }
  }
  async runAnalysis() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    if (this.settings.provider === "ollama") {
      await this.refreshOllamaDetection({ notify: false, autoApply: true });
      const selectedModel = this.settings.ollamaModel.trim();
      if (!selectedModel) {
        this.notice("Ollama model is empty. Refresh model detection and select one.");
        return;
      }
      if (!isOllamaModelAnalyzable(selectedModel)) {
        this.notice(
          `Selected Ollama model is marked as (\uBD88\uAC00): ${selectedModel}. Choose a chat/instruct model first.`,
          6e3
        );
        return;
      }
    }
    if (this.settings.semanticLinkingEnabled && this.settings.analyzeLinked) {
      await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
      const embeddingModel = this.settings.semanticOllamaModel.trim();
      if (!embeddingModel) {
        this.notice(
          "Embedding model is empty. Refresh embedding detection and select one.",
          6e3
        );
        return;
      }
      if (!isOllamaModelEmbeddingCapable(embeddingModel)) {
        this.notice(
          `Selected embedding model is marked as (\uBD88\uAC00): ${embeddingModel}. Choose an embedding model first.`,
          6e3
        );
        return;
      }
    }
    const decision = await this.askBackupDecision();
    if (!decision.proceed) {
      this.notice("Analysis cancelled.");
      return;
    }
    if (decision.rememberAsDefault) {
      this.settings.backupBeforeApply = decision.backupBeforeRun;
      await this.saveSettings();
    }
    let backupFolder = null;
    if (decision.backupBeforeRun) {
      this.setStatus("creating backup...");
      backupFolder = await this.createBackupForFiles(selectedFiles);
      if (backupFolder) {
        this.notice(`Backup completed before analysis: ${backupFolder}`, 5e3);
      }
    }
    let semanticNeighbors = /* @__PURE__ */ new Map();
    if (this.settings.semanticLinkingEnabled && this.settings.analyzeLinked) {
      this.setStatus("building semantic candidates...");
      try {
        const semanticResult = await buildSemanticNeighborMap(
          this.app,
          selectedFiles,
          this.settings
        );
        semanticNeighbors = semanticResult.neighborMap;
        const neighborCount = [...semanticResult.neighborMap.values()].reduce(
          (sum, items) => sum + items.length,
          0
        );
        this.notice(
          `Semantic candidates ready: vectors=${semanticResult.generatedVectors}, cacheHits=${semanticResult.cacheHits}, cacheWrites=${semanticResult.cacheWrites}, edges=${neighborCount}, model=${semanticResult.model}.`,
          5e3
        );
        if (semanticResult.errors.length > 0) {
          this.notice(
            `Semantic embedding had ${semanticResult.errors.length} issue(s). Falling back per file where needed.`,
            6e3
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown semantic embedding error";
        this.notice(`Semantic candidate ranking skipped: ${message}`, 6e3);
      }
    }
    const progressModal = new RunProgressModal(this.app, "Analyzing selected notes");
    progressModal.open();
    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions = [];
    const errors = [];
    const events = [];
    const runStartedAt = Date.now();
    let usedFallbackCount = 0;
    let cancelled = false;
    for (let index = 0; index < selectedFiles.length; index += 1) {
      if (progressModal.isCancelled()) {
        cancelled = true;
        break;
      }
      const file = selectedFiles[index];
      progressModal.update({
        stage: "Analyzing",
        current: index + 1,
        total: selectedFiles.length,
        startedAt: runStartedAt,
        currentFile: file.path,
        errors,
        events
      });
      this.setStatus(`analyzing ${index + 1}/${selectedFiles.length}`);
      try {
        const request = {
          sourcePath: file.path,
          sourceText: await this.app.vault.cachedRead(file),
          candidateLinkPaths: this.getCandidateLinkPathsForFile(
            file.path,
            selectedFiles,
            semanticNeighbors
          ),
          maxTags: this.settings.maxTags,
          maxLinked: this.settings.maxLinked,
          analyzeTags: this.settings.analyzeTags,
          analyzeTopic: this.settings.analyzeTopic,
          analyzeLinked: this.settings.analyzeLinked,
          analyzeIndex: this.settings.analyzeIndex,
          includeReasons: this.settings.includeReasons
        };
        const outcome = await analyzeWithFallback(this.settings, request);
        if (outcome.meta.usedFallback) {
          usedFallbackCount += 1;
        }
        const currentFrontmatter = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
        const existingBase = normalizeManagedFrontmatter(
          extractManagedFrontmatter(currentFrontmatter)
        );
        const existingValidated = {
          tags: existingBase.tags,
          topic: existingBase.topic,
          linked: normalizeLinked(this.app, file.path, existingBase.linked),
          index: existingBase.index
        };
        const proposed = {
          tags: existingValidated.tags,
          topic: existingValidated.topic,
          linked: existingValidated.linked,
          index: existingValidated.index
        };
        if (this.settings.analyzeTags) {
          const proposedTags = normalizeTags(
            ((_c = outcome.proposal.tags) != null ? _c : []).slice(0, this.settings.maxTags)
          );
          proposed.tags = mergeUniqueStrings(existingValidated.tags, proposedTags);
        }
        if (this.settings.analyzeTopic) {
          const maybeTopic = (_d = outcome.proposal.topic) == null ? void 0 : _d.trim();
          if (maybeTopic) {
            proposed.topic = maybeTopic;
          }
        }
        if (this.settings.analyzeLinked) {
          const proposedLinked = normalizeLinked(
            this.app,
            file.path,
            ((_e = outcome.proposal.linked) != null ? _e : []).slice(0, this.settings.maxLinked),
            selectedPathSet
          );
          proposed.linked = mergeUniqueStrings(existingValidated.linked, proposedLinked);
        }
        if (this.settings.analyzeIndex) {
          const maybeIndex = (_f = outcome.proposal.index) == null ? void 0 : _f.trim();
          if (maybeIndex) {
            proposed.index = maybeIndex;
          }
        }
        const normalizedProposed = normalizeManagedFrontmatter(proposed);
        if (!managedFrontmatterChanged(existingValidated, normalizedProposed)) {
          continue;
        }
        const semanticCandidates = ((_g = semanticNeighbors.get(file.path)) != null ? _g : []).map((item) => ({
          path: item.path,
          similarity: item.similarity
        }));
        suggestions.push({
          file,
          existing: existingValidated,
          proposed: normalizedProposed,
          reasons: (_h = outcome.proposal.reasons) != null ? _h : {},
          analysis: outcome.meta,
          semanticCandidates
        });
        events.push({
          filePath: file.path,
          status: "ok",
          message: normalizedProposed.tags.length > 0 ? "suggested" : "no-change"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown analysis error";
        errors.push({ filePath: file.path, message });
        events.push({ filePath: file.path, status: "error", message });
      }
    }
    progressModal.setFinished(
      cancelled ? "Analysis stopped by user." : `Analysis complete: ${suggestions.length} changed of ${selectedFiles.length}`
    );
    progressModal.close();
    const summary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: selectedFiles.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt,
      cancelled,
      errorCount: errors.length
    };
    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);
    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes. Provider=${summary.provider}, Model=${summary.model}, Errors=${summary.errorCount}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
        5e3
      );
      return;
    }
    if (cancelled) {
      this.notice(
        `Analysis stopped. Showing partial suggestions (${suggestions.length} file(s)).`,
        5e3
      );
    }
    if (this.settings.suggestionMode) {
      new SuggestionPreviewModal(
        this.app,
        summary,
        suggestions,
        this.settings.includeReasons,
        async () => {
          const applyResult2 = await this.applySuggestions(
            suggestions,
            selectedFiles,
            backupFolder,
            decision.backupBeforeRun,
            decision.backupBeforeRun
          );
          if (!applyResult2.cancelled && this.settings.generateMoc) {
            await this.generateMocFromSelection(suggestions);
          }
        }
      ).open();
      return;
    }
    const applyResult = await this.applySuggestions(
      suggestions,
      selectedFiles,
      backupFolder,
      decision.backupBeforeRun,
      decision.backupBeforeRun
    );
    if (!applyResult.cancelled && this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }
  async applySuggestions(suggestions, selectedFilesForBackup, existingBackupFolder, alreadyBackedUp, backupEnabledForRun) {
    let backupFolder = existingBackupFolder;
    if (!alreadyBackedUp && backupEnabledForRun) {
      backupFolder = await this.createBackupForFiles(selectedFilesForBackup);
    }
    const progressModal = new RunProgressModal(this.app, "Applying suggestions");
    progressModal.open();
    const errors = [];
    const events = [];
    const startedAt = Date.now();
    const cleanupConfig = this.settings.propertyCleanupEnabled ? this.getPropertyCleanupConfig() : void 0;
    let cancelled = false;
    for (let index = 0; index < suggestions.length; index += 1) {
      if (progressModal.isCancelled()) {
        cancelled = true;
        break;
      }
      const suggestion = suggestions[index];
      progressModal.update({
        stage: "Applying",
        current: index + 1,
        total: suggestions.length,
        startedAt,
        currentFile: suggestion.file.path,
        errors,
        events
      });
      this.setStatus(`applying ${index + 1}/${suggestions.length}`);
      try {
        await this.app.fileManager.processFrontMatter(
          suggestion.file,
          (frontmatter) => {
            const current = frontmatter;
            const next = buildNextFrontmatter(current, suggestion.proposed, {
              cleanUnknown: this.settings.cleanUnknownFrontmatter,
              sortArrays: this.settings.sortArrays,
              cleanupConfig
            });
            for (const key of Object.keys(current)) {
              delete current[key];
            }
            for (const [key, value] of Object.entries(next)) {
              current[key] = value;
            }
          }
        );
        events.push({ filePath: suggestion.file.path, status: "ok", message: "applied" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown apply error";
        errors.push({ filePath: suggestion.file.path, message });
        events.push({ filePath: suggestion.file.path, status: "error", message });
      }
    }
    progressModal.setFinished(
      cancelled ? "Apply stopped by user." : `Apply complete: ${suggestions.length - errors.length} succeeded`
    );
    progressModal.close();
    this.setStatus(
      cancelled ? `apply stopped (${suggestions.length - errors.length}/${suggestions.length})` : `apply done (${suggestions.length - errors.length}/${suggestions.length})`
    );
    if (backupFolder) {
      this.notice(
        `Apply finished. Backup: ${backupFolder}. Errors: ${errors.length}${cancelled ? " (stopped early)" : ""}`,
        6e3
      );
    } else {
      this.notice(
        `Apply finished. Errors: ${errors.length}${cancelled ? " (stopped early)" : ""}`,
        5e3
      );
    }
    return { cancelled, errors };
  }
  async createBackupForFiles(files) {
    const uniquePaths = [...new Set(files.map((file) => file.path))].sort(
      (a, b) => a.localeCompare(b)
    );
    if (uniquePaths.length === 0) {
      return null;
    }
    const backupRoot = (0, import_obsidian4.normalizePath)(this.settings.backupRootPath);
    const backupFolder = (0, import_obsidian4.normalizePath)(
      `${backupRoot}/${formatBackupStamp(/* @__PURE__ */ new Date())}`
    );
    await this.ensureFolderPath(backupFolder);
    for (const path of uniquePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (!(entry instanceof import_obsidian4.TFile)) {
        continue;
      }
      const content = await this.app.vault.cachedRead(entry);
      const outputPath = (0, import_obsidian4.normalizePath)(`${backupFolder}/${path}`);
      await this.ensureParentFolder(outputPath);
      await this.app.vault.adapter.write(outputPath, content);
    }
    const manifest = {
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      backupFolder,
      fileCount: uniquePaths.length,
      files: uniquePaths
    };
    const manifestPath = (0, import_obsidian4.normalizePath)(`${backupFolder}/manifest.json`);
    await this.app.vault.adapter.write(manifestPath, JSON.stringify(manifest, null, 2));
    await this.pruneOldBackups();
    return backupFolder;
  }
  async pruneOldBackups() {
    const keepCount = this.settings.backupRetentionCount;
    if (!Number.isFinite(keepCount) || keepCount < 1) {
      return;
    }
    const backupRoot = (0, import_obsidian4.normalizePath)(this.settings.backupRootPath);
    const exists = await this.app.vault.adapter.exists(backupRoot);
    if (!exists) {
      return;
    }
    const list = await this.app.vault.adapter.list(backupRoot);
    if (list.folders.length <= keepCount) {
      return;
    }
    const sorted = [...list.folders].sort((a, b) => b.localeCompare(a));
    const toDelete = sorted.slice(keepCount);
    for (const folder of toDelete) {
      await this.app.vault.adapter.rmdir(folder, true);
    }
  }
  async getLatestBackupFolder() {
    var _a;
    const backupRoot = (0, import_obsidian4.normalizePath)(this.settings.backupRootPath);
    const exists = await this.app.vault.adapter.exists(backupRoot);
    if (!exists) {
      return null;
    }
    const list = await this.app.vault.adapter.list(backupRoot);
    if (list.folders.length === 0) {
      return null;
    }
    const sorted = [...list.folders].sort((a, b) => a.localeCompare(b));
    return (_a = sorted[sorted.length - 1]) != null ? _a : null;
  }
  async restoreFromLatestBackup() {
    const latestBackupFolder = await this.getLatestBackupFolder();
    if (!latestBackupFolder) {
      this.notice("No backup folder found.");
      return;
    }
    const manifestPath = (0, import_obsidian4.normalizePath)(`${latestBackupFolder}/manifest.json`);
    const manifestExists = await this.app.vault.adapter.exists(manifestPath);
    if (!manifestExists) {
      this.notice(`Backup manifest is missing: ${manifestPath}`);
      return;
    }
    const manifestRaw = await this.app.vault.adapter.read(manifestPath);
    const manifest = JSON.parse(manifestRaw);
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      this.notice("Backup manifest does not contain files.");
      return;
    }
    let restoredCount = 0;
    for (const originalPath of manifest.files) {
      const backupFilePath = (0, import_obsidian4.normalizePath)(`${latestBackupFolder}/${originalPath}`);
      const exists = await this.app.vault.adapter.exists(backupFilePath);
      if (!exists) {
        continue;
      }
      const content = await this.app.vault.adapter.read(backupFilePath);
      await this.ensureParentFolder(originalPath);
      const current = this.app.vault.getAbstractFileByPath(originalPath);
      if (current instanceof import_obsidian4.TFile) {
        await this.app.vault.modify(current, content);
      } else {
        await this.app.vault.create(originalPath, content);
      }
      restoredCount += 1;
    }
    this.notice(
      `Restore completed from ${latestBackupFolder}. Restored ${restoredCount} file(s).`,
      6e3
    );
  }
  async generateMocFromSelection(suggestions) {
    var _a, _b, _c;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No selected notes available for MOC.");
      return;
    }
    const suggestionMap = /* @__PURE__ */ new Map();
    for (const item of suggestions != null ? suggestions : []) {
      suggestionMap.set(item.file.path, item);
    }
    const records = selectedFiles.map((file) => {
      var _a2, _b2;
      const suggested = suggestionMap.get(file.path);
      if (suggested) {
        return { file, metadata: suggested.proposed };
      }
      const frontmatter = (_b2 = (_a2 = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a2.frontmatter) != null ? _b2 : {};
      return {
        file,
        metadata: normalizeManagedFrontmatter(
          extractManagedFrontmatter(frontmatter)
        )
      };
    });
    const groups = /* @__PURE__ */ new Map();
    for (const record of records) {
      const group = ((_a = record.metadata.index) == null ? void 0 : _a.trim()) || "uncategorized";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      (_b = groups.get(group)) == null ? void 0 : _b.push(record);
    }
    const lines = [];
    lines.push("# Selected Knowledge MOC");
    lines.push("");
    lines.push(`Updated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
    lines.push(`Source notes: ${selectedFiles.length}`);
    lines.push("");
    const sortedGroups = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    for (const group of sortedGroups) {
      lines.push(`## ${group}`);
      const items = (_c = groups.get(group)) != null ? _c : [];
      items.sort((a, b) => a.file.path.localeCompare(b.file.path));
      for (const item of items) {
        const linkText = this.app.metadataCache.fileToLinktext(item.file, "", true);
        const topicSuffix = item.metadata.topic ? ` - ${item.metadata.topic}` : "";
        lines.push(`- [[${linkText}]]${topicSuffix}`);
      }
      lines.push("");
    }
    const outputPath = (0, import_obsidian4.normalizePath)(this.settings.mocPath);
    await this.ensureParentFolder(outputPath);
    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    const content = `${lines.join("\n").trim()}
`;
    if (existing instanceof import_obsidian4.TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
    this.notice(`MOC updated: ${outputPath}`);
  }
  async ensureFolderPath(folderPath) {
    const normalized = (0, import_obsidian4.normalizePath)(folderPath);
    if (normalized.length === 0) {
      return;
    }
    const parts = normalized.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing instanceof import_obsidian4.TFolder) {
        continue;
      }
      if (existing instanceof import_obsidian4.TFile) {
        continue;
      }
      await this.app.vault.createFolder(currentPath);
    }
  }
  async ensureParentFolder(path) {
    const normalized = (0, import_obsidian4.normalizePath)(path);
    const chunks = normalized.split("/");
    chunks.pop();
    if (chunks.length === 0) {
      return;
    }
    await this.ensureFolderPath(chunks.join("/"));
  }
};
