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
  const normalized = rawTag.trim().replace(/^#+/, "").replace(/\s+/g, "-").replace(/[`"'\\]+/g, "");
  if (!normalized) {
    return "";
  }
  const lower = normalized.toLowerCase();
  const looksLikePath = normalized.startsWith("/") || normalized.startsWith("./") || normalized.startsWith("../") || /^[A-Za-z]:[\\/]/.test(normalized) || /^\/(usr|bin|sbin|etc|opt|var|tmp|home|users)\//i.test(lower) || lower.startsWith("usr/bin/") || lower.includes("/usr/bin/env");
  const looksLikeCode = normalized.startsWith("!") || normalized.startsWith("#!") || normalized.includes("://") || /[{}()[\];|<>$]/.test(normalized);
  if (looksLikePath || looksLikeCode || normalized.length > 64) {
    return "";
  }
  if (!/[0-9A-Za-z가-힣]/.test(normalized)) {
    return "";
  }
  return normalized;
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
var UNAVAILABLE_MODEL_REGEX = /(embed|embedding|bge|e5-|e5:|rerank|whisper|tts|speech|transcribe|stt|vision|llava|bakllava|moondream|florence|vl\b|image[-_ ]?gen|stable[-_ ]?diffusion|sdxl|flux)/i;
function isOllamaModelAnalyzable(modelName) {
  return !UNAVAILABLE_MODEL_REGEX.test(modelName);
}
function describeOllamaModel(modelName) {
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
var EMBEDDING_CACHE_VERSION = 1;
var RUNTIME_FILE_VECTOR_CACHE_MAX = 15e3;
var RUNTIME_QUERY_VECTOR_CACHE_MAX = 800;
var EMBEDDING_MODEL_REGEX = /(embed|embedding|nomic-embed|mxbai|bge|e5|gte|arctic-embed|jina-emb)/i;
var NON_EMBEDDING_MODEL_REGEX = /(whisper|tts|speech|transcribe|stt|rerank)/i;
var runtimeFileVectorCache = /* @__PURE__ */ new Map();
var runtimeQueryVectorCache = /* @__PURE__ */ new Map();
var embeddingCacheMemory = /* @__PURE__ */ new Map();
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
function buildRuntimeFileVectorKey(baseUrl, model, maxChars, filePath) {
  return `${baseUrl}::${model}::${maxChars}::${filePath}`;
}
function buildRuntimeQueryKey(baseUrl, model, maxChars, queryText) {
  return `${baseUrl}::${model}::${maxChars}::${queryText}`;
}
function getAppCacheIdentity(app) {
  return `${app.vault.configDir}::${app.vault.getName()}`;
}
function pruneRuntimeFileVectorCache() {
  if (runtimeFileVectorCache.size <= RUNTIME_FILE_VECTOR_CACHE_MAX) {
    return;
  }
  const sorted = [...runtimeFileVectorCache.entries()].sort(
    (a, b) => a[1].updatedAt - b[1].updatedAt || a[0].localeCompare(b[0])
  );
  const removeCount = sorted.length - RUNTIME_FILE_VECTOR_CACHE_MAX;
  for (let i = 0; i < removeCount; i += 1) {
    runtimeFileVectorCache.delete(sorted[i][0]);
  }
}
function setRuntimeFileVector(key, vector, mtime, size) {
  runtimeFileVectorCache.set(key, {
    vector,
    mtime,
    size,
    updatedAt: Date.now()
  });
  pruneRuntimeFileVectorCache();
}
function getRuntimeFileVector(key, mtime, size) {
  const hit = runtimeFileVectorCache.get(key);
  if (!hit) {
    return null;
  }
  if (hit.mtime !== mtime || hit.size !== size || hit.vector.length === 0) {
    runtimeFileVectorCache.delete(key);
    return null;
  }
  hit.updatedAt = Date.now();
  return hit.vector;
}
function pruneRuntimeQueryVectorCache() {
  if (runtimeQueryVectorCache.size <= RUNTIME_QUERY_VECTOR_CACHE_MAX) {
    return;
  }
  const sorted = [...runtimeQueryVectorCache.entries()].sort(
    (a, b) => a[1].updatedAt - b[1].updatedAt || a[0].localeCompare(b[0])
  );
  const removeCount = sorted.length - RUNTIME_QUERY_VECTOR_CACHE_MAX;
  for (let i = 0; i < removeCount; i += 1) {
    runtimeQueryVectorCache.delete(sorted[i][0]);
  }
}
function getEmbeddingCachePath(app) {
  return (0, import_obsidian3.normalizePath)(
    `${app.vault.configDir}/plugins/auto-linker/semantic-embedding-cache.json`
  );
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
  const memoryKey = getAppCacheIdentity(app);
  const cached = embeddingCacheMemory.get(memoryKey);
  if (cached) {
    return cached;
  }
  const path = getEmbeddingCachePath(app);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    const empty = { version: EMBEDDING_CACHE_VERSION, entries: {} };
    embeddingCacheMemory.set(memoryKey, empty);
    return empty;
  }
  try {
    const raw = await app.vault.adapter.read(path);
    const parsed = JSON.parse(raw);
    const version = typeof parsed.version === "number" ? parsed.version : EMBEDDING_CACHE_VERSION;
    const entries = parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {};
    if (version !== EMBEDDING_CACHE_VERSION) {
      const empty = { version: EMBEDDING_CACHE_VERSION, entries: {} };
      embeddingCacheMemory.set(memoryKey, empty);
      return empty;
    }
    const loaded = { version, entries };
    embeddingCacheMemory.set(memoryKey, loaded);
    return loaded;
  } catch (e) {
    const empty = { version: EMBEDDING_CACHE_VERSION, entries: {} };
    embeddingCacheMemory.set(memoryKey, empty);
    return empty;
  }
}
async function writeEmbeddingCache(app, cache) {
  const path = getEmbeddingCachePath(app);
  await ensureParentFolder(app, path);
  await app.vault.adapter.write(path, JSON.stringify(cache));
  embeddingCacheMemory.set(getAppCacheIdentity(app), cache);
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
  const vectorsByPath = /* @__PURE__ */ new Map();
  const errors = [];
  const cache = await readEmbeddingCache(app);
  let cacheHits = 0;
  let cacheWrites = 0;
  let cacheDirty = false;
  const missing = [];
  for (const file of files) {
    const runtimeKey = buildRuntimeFileVectorKey(
      config.baseUrl,
      config.model,
      maxChars,
      file.path
    );
    const runtimeHit = getRuntimeFileVector(runtimeKey, file.stat.mtime, file.stat.size);
    if (runtimeHit) {
      vectorsByPath.set(file.path, runtimeHit);
      cacheHits += 1;
      continue;
    }
    const cacheKey = buildCacheKey(config.baseUrl, config.model, file.path);
    const hit = cache.entries[cacheKey];
    if (hit && typeof hit.mtime === "number" && typeof hit.size === "number" && hit.mtime === file.stat.mtime && hit.size === file.stat.size && Array.isArray(hit.vector) && hit.vector.length > 0) {
      vectorsByPath.set(file.path, hit.vector);
      setRuntimeFileVector(runtimeKey, hit.vector, file.stat.mtime, file.stat.size);
      cacheHits += 1;
      continue;
    }
    const content = await app.vault.cachedRead(file);
    const text = normalizeSourceText(content, maxChars);
    const fingerprint = fingerprintText(text);
    if (hit && hit.fingerprint === fingerprint && Array.isArray(hit.vector) && hit.vector.length > 0) {
      vectorsByPath.set(file.path, hit.vector);
      cache.entries[cacheKey] = {
        ...hit,
        mtime: file.stat.mtime,
        size: file.stat.size,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      setRuntimeFileVector(runtimeKey, hit.vector, file.stat.mtime, file.stat.size);
      cacheHits += 1;
      cacheDirty = true;
      continue;
    }
    missing.push({
      file,
      text,
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
        const runtimeKey = buildRuntimeFileVectorKey(
          config.baseUrl,
          config.model,
          maxChars,
          entry.file.path
        );
        setRuntimeFileVector(
          runtimeKey,
          vector,
          entry.file.stat.mtime,
          entry.file.stat.size
        );
        cache.entries[entry.cacheKey] = {
          fingerprint: entry.fingerprint,
          vector,
          mtime: entry.file.stat.mtime,
          size: entry.file.stat.size,
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
  const queryCacheKey = buildRuntimeQueryKey(
    config.baseUrl,
    config.model,
    maxChars,
    queryText
  );
  const queryCacheHit = runtimeQueryVectorCache.get(queryCacheKey);
  if (queryCacheHit && queryCacheHit.vector.length > 0) {
    queryCacheHit.updatedAt = Date.now();
    queryVector = queryCacheHit.vector;
  }
  try {
    if (!queryVector) {
      const queryEmbeddings = await requestOllamaEmbeddings(config.baseUrl, config.model, [
        queryText
      ]);
      queryVector = (_a = queryEmbeddings[0]) != null ? _a : null;
      if (queryVector && queryVector.length > 0) {
        runtimeQueryVectorCache.set(queryCacheKey, {
          vector: queryVector,
          updatedAt: Date.now()
        });
        pruneRuntimeQueryVectorCache();
      }
    }
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
  forceAllToAllLinkedEnabled: false,
  analyzeIndex: true,
  maxTags: 8,
  maxLinked: 8,
  analysisOnlyChangedNotes: false,
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
  qaPreferChatApi: true,
  qaStructureGuardEnabled: true,
  qaAlwaysDetailedAnswer: true,
  qaMinAnswerChars: 320,
  qaPreferredResponseLanguage: "korean",
  qaCustomSystemPrompt: "",
  qaRolePreset: "ask",
  qaPipelinePreset: "orchestrator_safeguard",
  qaAskModel: "",
  qaAskVisionModel: "",
  qaImageGeneratorModel: "",
  qaCoderModel: "",
  qaArchitectModel: "",
  qaOrchestratorModel: "",
  qaSafeguardModel: "",
  qaAskSystemPrompt: "",
  qaAskVisionSystemPrompt: "",
  qaImageGeneratorSystemPrompt: "",
  qaCoderSystemPrompt: "",
  qaDebuggerSystemPrompt: "",
  qaArchitectSystemPrompt: "",
  qaOrchestratorSystemPrompt: "",
  qaSafeguardSystemPrompt: "",
  qaRoleModelAutoPickEnabled: true,
  qaOrchestratorEnabled: false,
  qaSafeguardPassEnabled: false,
  qaIncludeSelectionInventory: true,
  qaSelectionInventoryMaxFiles: 200,
  qaThreadAutoSyncEnabled: true,
  autoTagActiveNoteEnabled: false,
  autoTagActiveNoteCooldownSec: 90,
  watchNewNotesEnabled: false,
  watchNewNotesFolders: "",
  chatTranscriptRootPath: "Auto Link Chats",
  cleanupReportRootPath: "Auto Link Reports",
  propertyCleanupEnabled: false,
  propertyCleanupKeys: "related",
  propertyCleanupPrefixes: "",
  propertyCleanupKeepKeys: "date created,date updated,date modified,created,updated,modified",
  targetFilePaths: [],
  targetFolderPaths: [],
  includeSubfoldersInFolderSelection: true,
  selectionPathWidthPercent: 72,
  backupBeforeApply: true,
  backupRootPath: "Auto Link Backups",
  backupRetentionCount: 10,
  excludedFolderPatterns: ".obsidian,Auto Link Backups",
  showProgressNotices: true,
  generateMoc: true,
  mocPath: "MOC/Selected Knowledge MOC.md"
};
var LOCAL_QA_VIEW_TYPE = "auto-linker-local-qa-view";
var ANALYSIS_CACHE_FILE = "analysis-proposal-cache.json";
var ANALYSIS_CACHE_VERSION = 1;
var ANALYSIS_CACHE_MAX_ENTRIES = 4e3;
var ANALYSIS_HARD_MAX_CANDIDATES = 120;
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
function splitThinkingBlocks(rawText) {
  const raw = rawText != null ? rawText : "";
  if (!raw) {
    return { answer: "", thinking: "", hasOpenThinking: false };
  }
  let cursor = 0;
  let answer = "";
  let hasOpenThinking = false;
  const thinkingParts = [];
  while (cursor < raw.length) {
    const start = raw.indexOf("<think>", cursor);
    if (start < 0) {
      answer += raw.slice(cursor);
      break;
    }
    answer += raw.slice(cursor, start);
    const thinkStart = start + "<think>".length;
    const end = raw.indexOf("</think>", thinkStart);
    if (end < 0) {
      thinkingParts.push(raw.slice(thinkStart));
      hasOpenThinking = true;
      cursor = raw.length;
      break;
    }
    thinkingParts.push(raw.slice(thinkStart, end));
    cursor = end + "</think>".length;
  }
  return {
    answer: answer.replace(/<\/?think>/g, ""),
    thinking: thinkingParts.join("\n\n").trim(),
    hasOpenThinking
  };
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
function cloneMetadataProposal(proposal) {
  return {
    tags: Array.isArray(proposal.tags) ? [...proposal.tags] : [],
    topic: proposal.topic,
    linked: Array.isArray(proposal.linked) ? [...proposal.linked] : [],
    index: proposal.index,
    reasons: proposal.reasons ? {
      tags: proposal.reasons.tags,
      topic: proposal.reasons.topic,
      linked: proposal.reasons.linked,
      index: proposal.reasons.index
    } : {}
  };
}
function cloneSuggestionMeta(meta) {
  return {
    provider: meta.provider,
    model: meta.model,
    elapsedMs: meta.elapsedMs,
    usedFallback: meta.usedFallback
  };
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
var CapacityGuardModal = class _CapacityGuardModal extends import_obsidian4.Modal {
  constructor(app, selectedCount, recommendedMax, modelName, semanticEnabled, onResolve) {
    super(app);
    this.selectedCount = selectedCount;
    this.recommendedMax = recommendedMax;
    this.modelName = modelName;
    this.semanticEnabled = semanticEnabled;
    this.onResolve = onResolve;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Large selection warning" });
    contentEl.createEl("p", {
      text: `Selected ${this.selectedCount} notes. Recommended max for this setup is about ${this.recommendedMax}.`
    });
    contentEl.createEl("p", {
      text: `Model: ${this.modelName || "(not set)"} | semantic linking: ${this.semanticEnabled ? "on" : "off"}`
    });
    contentEl.createEl("p", {
      text: "Too many candidates can lower linked quality and slow local analysis. Continue anyway?"
    });
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.resolve({ proceed: false });
    const proceedButton = footer.createEl("button", { text: "Continue", cls: "mod-cta" });
    proceedButton.onclick = () => this.resolve({ proceed: true });
  }
  resolve(decision) {
    this.onResolve(decision);
    this.close();
  }
  static ask(app, selectedCount, recommendedMax, modelName, semanticEnabled) {
    return new Promise((resolve) => {
      new _CapacityGuardModal(
        app,
        selectedCount,
        recommendedMax,
        modelName,
        semanticEnabled,
        resolve
      ).open();
    });
  }
};
var NewNoteWatchModal = class _NewNoteWatchModal extends import_obsidian4.Modal {
  constructor(app, filePath, watchedFolder, onResolve) {
    super(app);
    this.resolved = false;
    this.filePath = filePath;
    this.watchedFolder = watchedFolder;
    this.onResolve = onResolve;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New note detected in watched folder" });
    contentEl.createEl("p", { text: `Folder: ${this.watchedFolder}` });
    contentEl.createEl("p", { text: `File: ${this.filePath}` });
    contentEl.createEl("p", {
      text: "Add this note to target selection and run analysis now?"
    });
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";
    const ignoreButton = footer.createEl("button", { text: "Ignore" });
    ignoreButton.onclick = () => this.resolve({ action: "ignore" });
    const addOnlyButton = footer.createEl("button", { text: "Add to selection" });
    addOnlyButton.onclick = () => this.resolve({ action: "add_only" });
    const analyzeNowButton = footer.createEl("button", {
      text: "Add and analyze now",
      cls: "mod-cta"
    });
    analyzeNowButton.onclick = () => this.resolve({ action: "analyze_now" });
  }
  onClose() {
    if (!this.resolved) {
      this.onResolve({ action: "ignore" });
      this.resolved = true;
    }
    this.contentEl.empty();
  }
  resolve(decision) {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.onResolve(decision);
    this.close();
  }
  static ask(app, filePath, watchedFolder) {
    return new Promise((resolve) => {
      new _NewNoteWatchModal(app, filePath, watchedFolder, resolve).open();
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
var LocalQAWorkspaceView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.running = false;
    this.activeRequestController = null;
    this.messages = [];
    this.threadPath = null;
    this.threadId = "";
    this.threadCreatedAt = "";
    this.syncStatus = "Not synced yet";
    this.syncTimer = null;
    this.syncInFlight = false;
    this.syncQueued = false;
    this.renderVersion = 0;
    this.streamRenderTimer = null;
    this.plugin = plugin;
  }
  getViewType() {
    return LOCAL_QA_VIEW_TYPE;
  }
  getDisplayText() {
    return "Auto Link Local Chat / \uB85C\uCEEC \uCC44\uD305";
  }
  getIcon() {
    return "message-square";
  }
  async onOpen() {
    this.resetThreadState();
    this.render();
    this.refreshModelOptions();
    await this.refreshScopeLabel();
    this.refreshThreadMeta();
  }
  async onClose() {
    var _a;
    (_a = this.activeRequestController) == null ? void 0 : _a.abort();
    this.activeRequestController = null;
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.streamRenderTimer !== null) {
      window.clearTimeout(this.streamRenderTimer);
      this.streamRenderTimer = null;
    }
    if (this.plugin.isQaThreadAutoSyncEnabledForQa() || this.threadPath) {
      await this.flushThreadSync(true);
    }
  }
  resetThreadState() {
    const now = /* @__PURE__ */ new Date();
    this.threadId = `chat-${formatBackupStamp(now)}`;
    this.threadCreatedAt = now.toISOString();
    this.threadPath = null;
    this.syncStatus = this.plugin.isQaThreadAutoSyncEnabledForQa() ? "Auto-sync ready / \uC790\uB3D9 \uB3D9\uAE30\uD654 \uC900\uBE44" : "Manual save mode / \uC218\uB3D9 \uC800\uC7A5 \uBAA8\uB4DC";
    this.refreshThreadMeta();
  }
  refreshThreadMeta() {
    if (!this.threadInfoEl || !this.syncInfoEl) {
      return;
    }
    const threadLabel = this.threadPath ? this.threadPath : `${this.threadId}.md (pending)`;
    this.threadInfoEl.setText(`Thread / \uC2A4\uB808\uB4DC: ${threadLabel}`);
    this.syncInfoEl.setText(`Sync / \uB3D9\uAE30\uD654: ${this.syncStatus}`);
  }
  setSyncStatus(next) {
    this.syncStatus = next;
    this.refreshThreadMeta();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-linker-chat-view");
    const root = contentEl.createDiv({ cls: "auto-linker-chat-root" });
    const header = root.createDiv({ cls: "auto-linker-chat-header" });
    header.createEl("h3", { text: "Local AI Chat (Selected Notes) / \uB85C\uCEEC AI \uCC44\uD305 (\uC120\uD0DD \uB178\uD2B8)" });
    this.scopeEl = header.createDiv({ cls: "auto-linker-chat-scope" });
    const metaRow = header.createDiv({ cls: "auto-linker-chat-meta" });
    this.threadInfoEl = metaRow.createDiv({ cls: "auto-linker-chat-thread-info" });
    this.syncInfoEl = metaRow.createDiv({ cls: "auto-linker-chat-sync-info" });
    const actionRow = root.createDiv({ cls: "auto-linker-chat-actions" });
    const newThreadButton = actionRow.createEl("button", { text: "New thread / \uC0C8 \uC2A4\uB808\uB4DC" });
    newThreadButton.addClass("auto-linker-chat-btn");
    newThreadButton.onclick = async () => {
      await this.startNewThread();
    };
    const selectButton = actionRow.createEl("button", { text: "Select notes / \uB178\uD2B8 \uC120\uD0DD" });
    selectButton.addClass("auto-linker-chat-btn");
    selectButton.onclick = async () => {
      await this.plugin.openSelectionForQa();
      await this.refreshScopeLabel();
    };
    const cleanupPickerButton = actionRow.createEl("button", { text: "Cleanup keys / \uC815\uB9AC \uD0A4" });
    cleanupPickerButton.addClass("auto-linker-chat-btn");
    cleanupPickerButton.onclick = async () => {
      await this.plugin.openCleanupKeyPickerForQa();
      await this.refreshScopeLabel();
    };
    const cleanupApplyButton = actionRow.createEl("button", { text: "Run cleanup / \uC815\uB9AC \uC2E4\uD589" });
    cleanupApplyButton.addClass("auto-linker-chat-btn");
    cleanupApplyButton.onclick = async () => {
      await this.plugin.runCleanupForQa(false);
      await this.refreshScopeLabel();
    };
    const cleanupDryRunButton = actionRow.createEl("button", { text: "Cleanup dry-run / \uC815\uB9AC \uBBF8\uB9AC\uBCF4\uAE30" });
    cleanupDryRunButton.addClass("auto-linker-chat-btn");
    cleanupDryRunButton.onclick = async () => {
      await this.plugin.runCleanupForQa(true);
      await this.refreshScopeLabel();
    };
    const refreshButton = actionRow.createEl("button", { text: "Refresh scope / \uBC94\uC704 \uC0C8\uB85C\uACE0\uCE68" });
    refreshButton.addClass("auto-linker-chat-btn");
    refreshButton.onclick = async () => {
      await this.plugin.refreshOllamaDetection({ notify: false, autoApply: false });
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    const folderButton = actionRow.createEl("button", { text: "Chat folder / \uCC44\uD305 \uD3F4\uB354" });
    folderButton.addClass("auto-linker-chat-btn");
    folderButton.onclick = async () => {
      const current = this.plugin.getChatTranscriptRootPathForQa() || "Auto Link Chats";
      const next = window.prompt("Chat transcript folder (vault-relative) / \uCC44\uD305 \uC800\uC7A5 \uD3F4\uB354", current);
      if (next === null) {
        return;
      }
      try {
        await this.plugin.setChatTranscriptRootPathForQa(next);
        new import_obsidian4.Notice(`Chat folder set / \uCC44\uD305 \uD3F4\uB354 \uC124\uC815: ${this.plugin.getChatTranscriptRootPathForQa()}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown transcript folder error";
        new import_obsidian4.Notice(`Invalid chat folder / \uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uCC44\uD305 \uD3F4\uB354: ${message}`, 7e3);
      }
      await this.refreshScopeLabel();
    };
    const openThreadButton = actionRow.createEl("button", { text: "Open chat note / \uCC44\uD305 \uB178\uD2B8 \uC5F4\uAE30" });
    openThreadButton.addClass("auto-linker-chat-btn");
    openThreadButton.onclick = async () => {
      await this.openThreadNote();
    };
    const controlRow = root.createDiv({ cls: "auto-linker-chat-controls" });
    const roleWrap = controlRow.createDiv({ cls: "auto-linker-chat-control" });
    roleWrap.createEl("label", { text: "Role / \uC5ED\uD560" });
    this.roleSelect = roleWrap.createEl("select", { cls: "auto-linker-chat-model-select" });
    this.roleSelect.onchange = async () => {
      await this.plugin.setQaRolePresetForQa(this.roleSelect.value);
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    const pipelineWrap = controlRow.createDiv({ cls: "auto-linker-chat-control" });
    pipelineWrap.createEl("label", { text: "Pipeline / \uD30C\uC774\uD504\uB77C\uC778" });
    this.pipelineSelect = pipelineWrap.createEl("select", {
      cls: "auto-linker-chat-model-select"
    });
    this.pipelineSelect.onchange = async () => {
      await this.plugin.setQaPipelinePresetForQa(
        this.pipelineSelect.value
      );
      await this.refreshScopeLabel();
    };
    const modelWrap = controlRow.createDiv({ cls: "auto-linker-chat-control" });
    modelWrap.createEl("label", { text: "Q&A fallback model / Q&A \uD3F4\uBC31 \uBAA8\uB378" });
    this.modelSelect = modelWrap.createEl("select", { cls: "auto-linker-chat-model-select" });
    this.modelSelect.onchange = async () => {
      const next = this.modelSelect.value;
      await this.plugin.setQaModelOverrideForQa(next === "__fallback__" ? "" : next);
      await this.refreshScopeLabel();
    };
    const topKWrap = controlRow.createDiv({ cls: "auto-linker-chat-control" });
    topKWrap.createEl("label", { text: "Top sources / \uC0C1\uC704 \uC18C\uC2A4 \uC218" });
    this.topKInput = topKWrap.createEl("input", {
      type: "number",
      cls: "auto-linker-chat-topk-input"
    });
    this.topKInput.min = "1";
    this.topKInput.max = "15";
    this.topKInput.value = String(this.plugin.settings.qaTopK);
    this.topKInput.onchange = async () => {
      const parsed = Number.parseInt(this.topKInput.value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        this.topKInput.value = String(this.plugin.settings.qaTopK);
        return;
      }
      this.plugin.settings.qaTopK = Math.min(15, parsed);
      await this.plugin.saveSettings();
    };
    this.threadEl = root.createDiv({ cls: "auto-linker-chat-thread" });
    this.threadEl.createDiv({
      cls: "auto-linker-chat-empty",
      text: "\uC9C8\uBB38\uC744 \uC785\uB825\uD574 \uB300\uD654\uB97C \uC2DC\uC791\uD558\uC138\uC694. / Ask a question to start."
    });
    const composer = root.createDiv({ cls: "auto-linker-chat-composer" });
    this.inputEl = composer.createEl("textarea", { cls: "auto-linker-chat-input" });
    this.inputEl.placeholder = "\uC120\uD0DD \uB178\uD2B8/\uD3F4\uB354 \uBC94\uC704\uC5D0\uC11C \uC9C8\uBB38\uD558\uC138\uC694... / Ask from selected notes/folders...";
    const footer = composer.createDiv({ cls: "auto-linker-chat-footer" });
    this.sendButton = footer.createEl("button", { text: "Send / \uC804\uC1A1", cls: "mod-cta" });
    this.sendButton.addClass("auto-linker-chat-send");
    this.sendButton.onclick = async () => {
      await this.submitQuestion();
    };
    this.stopButton = footer.createEl("button", { text: "Stop / \uC911\uC9C0" });
    this.stopButton.addClass("auto-linker-chat-stop");
    this.stopButton.disabled = true;
    this.stopButton.onclick = () => {
      var _a;
      (_a = this.activeRequestController) == null ? void 0 : _a.abort();
    };
    this.inputEl.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await this.submitQuestion();
      }
    });
    this.refreshRoleOptions();
    this.refreshPipelineOptions();
    this.refreshThreadMeta();
  }
  refreshRoleOptions() {
    const options = this.plugin.getQaRolePresetOptionsForQa();
    const current = this.plugin.getQaRolePresetForQa();
    this.roleSelect.empty();
    for (const option of options) {
      this.roleSelect.createEl("option", { text: option.label, value: option.value });
    }
    this.roleSelect.value = current;
  }
  refreshPipelineOptions() {
    const options = this.plugin.getQaPipelinePresetOptionsForQa();
    const current = this.plugin.getQaPipelinePresetForQa();
    this.pipelineSelect.empty();
    for (const option of options) {
      this.pipelineSelect.createEl("option", {
        text: option.label,
        value: option.value
      });
    }
    this.pipelineSelect.value = current;
  }
  refreshModelOptions() {
    const currentOverride = this.plugin.getQaModelOverrideForQa();
    const role = this.plugin.getQaRolePresetForQa();
    const roleLabel = getQaRolePresetLabel(role);
    const fallbackLabel = this.plugin.getQaModelLabelForQa(role);
    const options = this.plugin.getQaModelOptionsForQa();
    this.modelSelect.empty();
    this.modelSelect.createEl("option", {
      text: `Use role/default model / \uC5ED\uD560\xB7\uAE30\uBCF8 \uBAA8\uB378 \uC0AC\uC6A9 (${roleLabel}: ${fallbackLabel})`,
      value: "__fallback__"
    });
    for (const model of options) {
      this.modelSelect.createEl("option", { text: model, value: model });
    }
    const selected = currentOverride && options.includes(currentOverride) ? currentOverride : "__fallback__";
    this.modelSelect.value = selected;
  }
  formatTime(iso) {
    const date = new Date(iso);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  formatThinkingStage(stage) {
    switch (stage) {
      case "retrieval":
        return "RETRIEVE";
      case "generation":
        return "GENERATE";
      case "thinking":
        return "THINK";
      case "warning":
        return "WARN";
      case "error":
        return "ERROR";
      default:
        return "INFO";
    }
  }
  buildThinkingTranscriptText(timeline, modelThinking) {
    const lines = timeline.map(
      (event) => `- [${this.formatTime(event.timestamp)}] [${this.formatThinkingStage(event.stage)}] ${event.message}`
    );
    const trimmedThinking = modelThinking.trim();
    if (!trimmedThinking) {
      return lines.join("\n");
    }
    return [
      ...lines,
      "",
      "Model thinking (raw):",
      trimmedThinking
    ].join("\n");
  }
  scheduleStreamRender(delayMs = 80) {
    if (this.streamRenderTimer !== null) {
      return;
    }
    this.streamRenderTimer = window.setTimeout(() => {
      this.streamRenderTimer = null;
      this.renderMessages();
    }, delayMs);
  }
  renderMarkdownBody(container, markdown, sourcePath, version) {
    container.empty();
    void import_obsidian4.MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, this).catch(() => {
      container.setText(markdown);
    }).finally(() => {
      if (version === this.renderVersion) {
        this.threadEl.scrollTop = this.threadEl.scrollHeight;
      }
    });
  }
  renderThinkingCard(parent, message) {
    var _a, _b;
    const timeline = (_a = message.timeline) != null ? _a : [];
    const latest = timeline.length > 0 ? timeline[timeline.length - 1] : void 0;
    const panel = parent.createDiv({ cls: "auto-linker-chat-thinking-panel" });
    const head = panel.createDiv({ cls: "auto-linker-chat-thinking-head" });
    const summaryText = latest ? `Thinking timeline \xB7 ${timeline.length} events \xB7 ${this.formatThinkingStage(latest.stage)}` : "Thinking timeline";
    head.createDiv({
      text: summaryText,
      cls: "auto-linker-chat-thinking-summary"
    });
    if (message.isDraft) {
      head.createDiv({
        cls: "auto-linker-chat-thinking-live",
        text: "LIVE"
      });
    }
    const body = panel.createDiv({ cls: "auto-linker-chat-thinking-body" });
    if (timeline.length > 0) {
      const timelineEl = body.createDiv({ cls: "auto-linker-chat-thinking-timeline" });
      for (const event of timeline.slice(-24)) {
        const card = timelineEl.createDiv({
          cls: `auto-linker-chat-thinking-event auto-linker-chat-thinking-event-${event.stage}`
        });
        card.createEl("span", {
          cls: "auto-linker-chat-thinking-event-stage",
          text: this.formatThinkingStage(event.stage)
        });
        const content = card.createDiv({ cls: "auto-linker-chat-thinking-event-content" });
        content.createDiv({
          cls: "auto-linker-chat-thinking-event-message",
          text: event.message
        });
        if (event.detail) {
          content.createDiv({
            cls: "auto-linker-chat-thinking-event-detail",
            text: event.detail
          });
        }
        card.createEl("span", {
          cls: "auto-linker-chat-thinking-event-time",
          text: this.formatTime(event.timestamp)
        });
      }
    }
    if ((_b = message.thinkingDetails) == null ? void 0 : _b.trim()) {
      const raw = body.createDiv({ cls: "auto-linker-chat-thinking-raw" });
      raw.createEl("div", {
        cls: "auto-linker-chat-thinking-raw-title",
        text: "Model thinking (raw)"
      });
      raw.createEl("pre", {
        cls: "auto-linker-chat-thinking-raw-body",
        text: message.thinkingDetails.trim()
      });
    } else if (!timeline.length) {
      body.setText(message.text || "(empty)");
    }
  }
  async startNewThread() {
    if (this.messages.length > 0 && (this.plugin.isQaThreadAutoSyncEnabledForQa() || this.threadPath)) {
      await this.flushThreadSync(true);
    }
    this.messages = [];
    this.renderMessages();
    this.resetThreadState();
    this.inputEl.focus();
  }
  scheduleThreadSync(delayMs = 850) {
    if (!this.plugin.isQaThreadAutoSyncEnabledForQa() || this.messages.length === 0) {
      return;
    }
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
    }
    this.setSyncStatus("Pending...");
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      void this.flushThreadSync(false);
    }, delayMs);
  }
  async flushThreadSync(force) {
    var _a;
    if (!force && !this.plugin.isQaThreadAutoSyncEnabledForQa()) {
      return;
    }
    if (this.messages.length === 0) {
      return;
    }
    if (this.syncInFlight) {
      this.syncQueued = true;
      return;
    }
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.syncInFlight = true;
    this.setSyncStatus("Syncing...");
    try {
      const synced = await this.plugin.syncLocalQaTranscript({
        messages: this.messages,
        threadPath: (_a = this.threadPath) != null ? _a : void 0,
        threadId: this.threadId,
        createdAt: this.threadCreatedAt
      });
      this.threadPath = synced.path;
      this.threadId = synced.threadId;
      this.threadCreatedAt = synced.createdAt;
      this.setSyncStatus(`Synced ${this.formatTime(synced.updatedAt)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown thread sync error";
      this.setSyncStatus("Sync failed");
      new import_obsidian4.Notice(`Chat sync failed: ${message}`, 7e3);
    } finally {
      this.syncInFlight = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        this.scheduleThreadSync(350);
      }
    }
  }
  async openThreadNote() {
    if (this.messages.length === 0) {
      new import_obsidian4.Notice("No chat messages yet. / \uC544\uC9C1 \uCC44\uD305 \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    await this.flushThreadSync(true);
    if (!this.threadPath) {
      new import_obsidian4.Notice("Thread note is not ready yet. / \uC2A4\uB808\uB4DC \uB178\uD2B8\uAC00 \uC544\uC9C1 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const target = this.app.vault.getAbstractFileByPath(this.threadPath);
    if (target instanceof import_obsidian4.TFile) {
      await this.app.workspace.getLeaf(true).openFile(target);
      return;
    }
    new import_obsidian4.Notice(`Thread note not found / \uC2A4\uB808\uB4DC \uB178\uD2B8 \uC5C6\uC74C: ${this.threadPath}`, 7e3);
  }
  renderSourceLink(parent, source) {
    const row = parent.createDiv({ cls: "auto-linker-chat-source-row" });
    const link = row.createEl("a", {
      text: source.path,
      href: "#",
      cls: "auto-linker-chat-source-link"
    });
    link.setAttr("title", source.path);
    link.onclick = async (event) => {
      event.preventDefault();
      const target = this.app.vault.getAbstractFileByPath(source.path);
      if (target instanceof import_obsidian4.TFile) {
        await this.app.workspace.getLeaf(true).openFile(target);
      } else {
        new import_obsidian4.Notice(`Source not found: ${source.path}`, 5e3);
      }
    };
    row.createEl("span", {
      text: formatSimilarity(source.similarity),
      cls: "auto-linker-chat-source-similarity"
    });
  }
  renderMessages() {
    var _a;
    this.renderVersion += 1;
    const version = this.renderVersion;
    this.threadEl.empty();
    if (this.messages.length === 0) {
      this.threadEl.createDiv({
        cls: "auto-linker-chat-empty",
        text: "\uC9C8\uBB38\uC744 \uC785\uB825\uD574 \uB300\uD654\uB97C \uC2DC\uC791\uD558\uC138\uC694. / Ask a question to start."
      });
      return;
    }
    for (const message of this.messages) {
      const box = this.threadEl.createDiv({
        cls: `auto-linker-chat-message auto-linker-chat-message-${message.role}`
      });
      if (message.role === "thinking") {
        this.renderThinkingCard(box, message);
        continue;
      }
      const head = box.createDiv({ cls: "auto-linker-chat-message-head" });
      head.createEl("strong", {
        text: message.role === "assistant" ? "Assistant / \uC5B4\uC2DC\uC2A4\uD134\uD2B8" : message.role === "user" ? "You / \uC0AC\uC6A9\uC790" : "System / \uC2DC\uC2A4\uD15C"
      });
      head.createEl("small", {
        text: this.formatTime(message.timestamp),
        cls: "auto-linker-chat-message-time"
      });
      const body = box.createDiv({ cls: "auto-linker-chat-message-body" });
      if (message.role === "assistant" && !message.isDraft) {
        body.addClass("auto-linker-chat-markdown");
        this.renderMarkdownBody(body, message.text, (_a = this.threadPath) != null ? _a : "", version);
      } else {
        body.setText(message.text);
      }
      if (message.role === "assistant" && message.sources && message.sources.length > 0) {
        const src = box.createDiv({ cls: "auto-linker-chat-sources" });
        src.createDiv({
          cls: "auto-linker-chat-sources-title",
          text: `Sources / \uCD9C\uCC98 (${message.sources.length})`
        });
        for (const source of message.sources) {
          this.renderSourceLink(src, source);
        }
      }
      if (message.role === "assistant" && message.model && message.embeddingModel) {
        box.createDiv({
          cls: "auto-linker-chat-message-meta",
          text: `model=${message.model} | embedding=${message.embeddingModel}`
        });
      }
    }
    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }
  pushMessage(message) {
    this.messages.push(message);
    if (this.messages.length > 120) {
      this.messages = this.messages.slice(-120);
    }
    this.renderMessages();
    this.scheduleThreadSync();
  }
  buildHistoryTurns() {
    const turns = this.messages.filter((item) => item.role === "user" || item.role === "assistant").map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: item.text
    }));
    return turns.slice(-12);
  }
  async refreshScopeLabel() {
    const fileCount = this.plugin.getSelectedFilesForQa().length;
    const folderCount = this.plugin.getSelectedFolderPathsForQa().length;
    const role = this.plugin.getQaRolePresetForQa();
    const roleLabel = getQaRolePresetLabel(role);
    const model = this.plugin.getQaModelLabelForQa(role);
    const embedding = this.plugin.getQaEmbeddingModelForQa();
    const syncMode = this.plugin.isQaThreadAutoSyncEnabledForQa() ? "auto / \uC790\uB3D9" : "manual / \uC218\uB3D9";
    const pipeline = getQaPipelinePresetLabel(this.plugin.getQaPipelinePresetForQa());
    const roleModels = this.plugin.getQaRoleModelSummaryForQa();
    const chatFolder = this.plugin.getChatTranscriptRootPathForQa() || "(not set / \uBBF8\uC124\uC815)";
    this.scopeEl.setText(
      `Scope / \uBC94\uC704: files=${fileCount}, folders=${folderCount} | role=${roleLabel} | QA=${model} | embedding=${embedding || "(not set / \uBBF8\uC124\uC815)"} | pipeline=${pipeline} | role-models=${roleModels} | sync=${syncMode} | chats=${chatFolder}`
    );
  }
  async submitQuestion() {
    var _a, _b, _c;
    if (this.running) {
      return;
    }
    const question = this.inputEl.value.trim();
    if (!question) {
      new import_obsidian4.Notice("Question is empty. / \uC9C8\uBB38\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const selectedFiles = this.plugin.getSelectedFilesForQa();
    if (selectedFiles.length === 0) {
      this.pushMessage({
        role: "system",
        text: "\uC120\uD0DD\uB41C \uB178\uD2B8\uAC00 \uC5C6\uC5B4 \uC120\uD0DD \uCC3D\uC744 \uC5FD\uB2C8\uB2E4.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      await this.plugin.openSelectionForQa();
      await this.refreshScopeLabel();
      return;
    }
    const parsedTopK = Number.parseInt(this.topKInput.value, 10);
    const topK = Number.isFinite(parsedTopK) && parsedTopK >= 1 ? Math.min(15, parsedTopK) : this.plugin.settings.qaTopK;
    this.inputEl.value = "";
    this.pushMessage({
      role: "user",
      text: question,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.running = true;
    this.sendButton.disabled = true;
    this.stopButton.disabled = false;
    const abortController = new AbortController();
    this.activeRequestController = abortController;
    const thinkingMessage = {
      role: "thinking",
      text: "- Retrieving relevant notes...",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      isDraft: true
    };
    this.messages.push(thinkingMessage);
    const thinkingIndex = this.messages.length - 1;
    const draftMessage = {
      role: "assistant",
      text: "",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      isDraft: true
    };
    this.messages.push(draftMessage);
    const draftIndex = this.messages.length - 1;
    this.renderMessages();
    this.scheduleThreadSync(300);
    const timeline = [];
    let modelThinking = "";
    let rawResponse = "";
    let thinkingStreamAnnounced = false;
    const updateThinkingMessage = (isDraft, forceTimestamp) => {
      const item = this.messages[thinkingIndex];
      if (!item || item.role !== "thinking") {
        return;
      }
      item.timeline = [...timeline];
      item.thinkingDetails = modelThinking.trim() || void 0;
      item.text = this.buildThinkingTranscriptText(timeline, modelThinking);
      item.isDraft = isDraft;
      item.timestamp = forceTimestamp != null ? forceTimestamp : (/* @__PURE__ */ new Date()).toISOString();
      this.scheduleStreamRender(80);
      this.scheduleThreadSync(900);
    };
    const pushTimelineEvent = (event) => {
      var _a2;
      const timestamp = (_a2 = event.timestamp) != null ? _a2 : (/* @__PURE__ */ new Date()).toISOString();
      const prev = timeline[timeline.length - 1];
      if (prev && prev.stage === event.stage && prev.message === event.message && prev.detail === event.detail) {
        return;
      }
      timeline.push({
        stage: event.stage,
        message: event.message,
        detail: event.detail,
        timestamp
      });
      if (timeline.length > 80) {
        timeline.splice(0, timeline.length - 80);
      }
      updateThinkingMessage(true, timestamp);
    };
    pushTimelineEvent({
      stage: "retrieval",
      message: "Retrieval started"
    });
    try {
      const result = await this.plugin.askLocalQa(
        question,
        topK,
        this.buildHistoryTurns(),
        (token) => {
          rawResponse += token;
          const parsed = splitThinkingBlocks(rawResponse);
          const draft2 = this.messages[draftIndex];
          if (draft2 && draft2.role === "assistant") {
            draft2.text = parsed.answer;
            draft2.isDraft = true;
          }
          if (parsed.thinking.trim()) {
            modelThinking = parsed.thinking.trim();
          }
          updateThinkingMessage(parsed.hasOpenThinking || modelThinking.length > 0);
          if (!parsed.thinking.trim()) {
            this.scheduleStreamRender(70);
            this.scheduleThreadSync(1100);
          }
        },
        (event) => {
          if (event.thinkingChunk) {
            modelThinking += event.thinkingChunk;
            if (!thinkingStreamAnnounced) {
              pushTimelineEvent({
                stage: "thinking",
                message: "Model thinking stream started",
                timestamp: event.timestamp
              });
              thinkingStreamAnnounced = true;
            } else {
              updateThinkingMessage(true, event.timestamp);
            }
            return;
          }
          pushTimelineEvent(event);
        },
        abortController.signal
      );
      const draft = this.messages[draftIndex];
      if (draft && draft.role === "assistant") {
        draft.text = result.answer;
        draft.timestamp = (/* @__PURE__ */ new Date()).toISOString();
        draft.sources = result.sources;
        draft.model = result.model;
        draft.embeddingModel = result.embeddingModel;
        draft.retrievalCacheHits = result.retrievalCacheHits;
        draft.retrievalCacheWrites = result.retrievalCacheWrites;
        draft.isDraft = false;
        if (result.thinking.trim()) {
          modelThinking = result.thinking.trim();
          if (!thinkingStreamAnnounced) {
            pushTimelineEvent({
              stage: "thinking",
              message: "Model thinking captured"
            });
            thinkingStreamAnnounced = true;
          }
        }
        pushTimelineEvent({
          stage: "generation",
          message: "Answer generated"
        });
        updateThinkingMessage(false);
        this.renderMessages();
        this.scheduleThreadSync(120);
      } else {
        this.pushMessage({
          role: "assistant",
          text: result.answer,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sources: result.sources,
          model: result.model,
          embeddingModel: result.embeddingModel,
          retrievalCacheHits: result.retrievalCacheHits,
          retrievalCacheWrites: result.retrievalCacheWrites,
          isDraft: false
        });
      }
      const thinking = this.messages[thinkingIndex];
      if (thinking && thinking.role === "thinking") {
        const hasTimeline = ((_b = (_a = thinking.timeline) == null ? void 0 : _a.length) != null ? _b : 0) > 0;
        const hasThinkingText = Boolean((_c = thinking.thinkingDetails) == null ? void 0 : _c.trim());
        if (!hasTimeline && !hasThinkingText) {
          this.messages.splice(thinkingIndex, 1);
        } else {
          thinking.isDraft = false;
          thinking.timestamp = (/* @__PURE__ */ new Date()).toISOString();
          thinking.text = this.buildThinkingTranscriptText(timeline, modelThinking);
        }
      }
      this.renderMessages();
    } catch (error) {
      const cancelled = this.plugin.isAbortError(error);
      const message = cancelled ? "\uC694\uCCAD\uC774 \uC911\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : error instanceof Error ? error.message : "Unknown local QA error";
      const draft = this.messages[draftIndex];
      if (draft && draft.role === "assistant" && !draft.text.trim()) {
        this.messages.splice(draftIndex, 1);
      } else if (draft && draft.role === "assistant") {
        draft.isDraft = false;
      }
      const thinking = this.messages[thinkingIndex];
      if (thinking && thinking.role === "thinking") {
        pushTimelineEvent({
          stage: cancelled ? "warning" : "error",
          message: cancelled ? "Request cancelled by user" : `Error: ${message}`
        });
        thinking.isDraft = false;
        thinking.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      }
      this.pushMessage({
        role: "system",
        text: cancelled ? `\uC911\uC9C0: ${message}` : `\uC624\uB958: ${message}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (!cancelled) {
        new import_obsidian4.Notice(`Local Q&A failed: ${message}`, 7e3);
      }
    } finally {
      this.running = false;
      this.sendButton.disabled = false;
      this.stopButton.disabled = true;
      this.activeRequestController = null;
      if (this.streamRenderTimer !== null) {
        window.clearTimeout(this.streamRenderTimer);
        this.streamRenderTimer = null;
      }
      this.inputEl.focus();
    }
  }
};
var SETTINGS_HEADER_KO_MAP = {
  "Local provider config": "\uB85C\uCEEC \uC81C\uACF5\uC790 \uC124\uC815",
  "Cloud provider config": "\uD074\uB77C\uC6B0\uB4DC \uC81C\uACF5\uC790 \uC124\uC815",
  Behavior: "\uB3D9\uC791 \uC124\uC815",
  "Semantic linking (Ollama embeddings)": "\uC2DC\uB9E8\uD2F1 \uB9C1\uD06C(\uC62C\uB77C\uB9C8 \uC784\uBCA0\uB529)",
  "Property cleanup": "\uC18D\uC131 \uC815\uB9AC",
  "Selection and backup": "\uC120\uD0DD \uBC0F \uBC31\uC5C5",
  MOC: "MOC"
};
var SETTINGS_NAME_KO_MAP = {
  Provider: "\uC81C\uACF5\uC790",
  "Ollama base URL": "Ollama \uAE30\uBCF8 URL",
  "Ollama detected model picker": "Ollama \uAC10\uC9C0 \uBAA8\uB378 \uC120\uD0DD\uAE30",
  "Ollama model (manual)": "Ollama \uBAA8\uB378(\uC218\uB3D9)",
  "Auto-pick recommended Ollama model": "\uAD8C\uC7A5 Ollama \uBAA8\uB378 \uC790\uB3D9 \uC120\uD0DD",
  "Ollama detection summary": "Ollama \uAC10\uC9C0 \uC694\uC57D",
  "LM Studio base URL": "LM Studio \uAE30\uBCF8 URL",
  "LM Studio model": "LM Studio \uBAA8\uB378",
  "LM Studio API key (optional)": "LM Studio API \uD0A4(\uC120\uD0DD)",
  "OpenAI base URL": "OpenAI \uAE30\uBCF8 URL",
  "OpenAI model": "OpenAI \uBAA8\uB378",
  "OpenAI API key": "OpenAI API \uD0A4",
  "Anthropic model": "Anthropic \uBAA8\uB378",
  "Anthropic API key": "Anthropic API \uD0A4",
  "Gemini model": "Gemini \uBAA8\uB378",
  "Gemini API key": "Gemini API \uD0A4",
  "Suggestion mode (recommended)": "\uC81C\uC548 \uBAA8\uB4DC(\uAD8C\uC7A5)",
  "Show reasons for each field": "\uAC01 \uD544\uB4DC \uADFC\uAC70 \uD45C\uC2DC",
  "Show progress notices": "\uC9C4\uD589 \uC54C\uB9BC \uD45C\uC2DC",
  "Analyze tags": "\uD0DC\uADF8 \uBD84\uC11D",
  "Analyze topic": "\uC8FC\uC81C \uBD84\uC11D",
  "Analyze linked": "\uC5F0\uACB0 \uB178\uD2B8 \uBD84\uC11D",
  "Analyze index": "\uC778\uB371\uC2A4 \uBD84\uC11D",
  "Max tags": "\uCD5C\uB300 \uD0DC\uADF8 \uC218",
  "Max linked": "\uCD5C\uB300 linked \uC218",
  "Enable semantic candidate ranking": "\uC2DC\uB9E8\uD2F1 \uD6C4\uBCF4 \uB7AD\uD0B9 \uC0AC\uC6A9",
  "Embedding Ollama base URL": "\uC784\uBCA0\uB529 Ollama \uAE30\uBCF8 URL",
  "Embedding detected model picker": "\uC784\uBCA0\uB529 \uAC10\uC9C0 \uBAA8\uB378 \uC120\uD0DD\uAE30",
  "Embedding model (manual)": "\uC784\uBCA0\uB529 \uBAA8\uB378(\uC218\uB3D9)",
  "Auto-pick recommended embedding model": "\uAD8C\uC7A5 \uC784\uBCA0\uB529 \uBAA8\uB378 \uC790\uB3D9 \uC120\uD0DD",
  "Embedding detection summary": "\uC784\uBCA0\uB529 \uAC10\uC9C0 \uC694\uC57D",
  "Semantic top-k candidates": "\uC2DC\uB9E8\uD2F1 top-k \uD6C4\uBCF4 \uC218",
  "Semantic min similarity": "\uC2DC\uB9E8\uD2F1 \uCD5C\uC18C \uC720\uC0AC\uB3C4",
  "Semantic source max chars": "\uC2DC\uB9E8\uD2F1 \uC18C\uC2A4 \uCD5C\uB300 \uBB38\uC790 \uC218",
  "Q&A Ollama base URL": "Q&A Ollama \uAE30\uBCF8 URL",
  "Q&A model": "Q&A \uBAA8\uB378",
  "Q&A pipeline preset": "Q&A \uD30C\uC774\uD504\uB77C\uC778 \uD504\uB9AC\uC14B",
  "Role model detection controls": "\uC5ED\uD560 \uBAA8\uB378 \uAC10\uC9C0 \uC81C\uC5B4",
  "Role model detection summary": "\uC5ED\uD560 \uBAA8\uB378 \uAC10\uC9C0 \uC694\uC57D",
  "Auto-pick recommended role models": "\uAD8C\uC7A5 \uC5ED\uD560 \uBAA8\uB378 \uC790\uB3D9 \uC120\uD0DD",
  "Apply role recommendations now": "\uC5ED\uD560 \uCD94\uCC9C\uAC12 \uC989\uC2DC \uC801\uC6A9",
  "Role recommendation summary": "\uC5ED\uD560\uBCC4 \uCD94\uCC9C \uC694\uC57D",
  "Ask model (text)": "Ask \uBAA8\uB378(\uD14D\uC2A4\uD2B8)",
  "Ask model (vision)": "Ask \uBAA8\uB378(\uBE44\uC804)",
  "Image generator model": "\uC774\uBBF8\uC9C0 \uC0DD\uC131 \uBAA8\uB378",
  "Coder model": "Coder \uBAA8\uB378",
  "Architect model": "Architect \uBAA8\uB378",
  "Orchestrator model": "Orchestrator \uBAA8\uB378",
  "Safeguard model": "Safeguard \uBAA8\uB378",
  "Role system prompt editor": "\uC5ED\uD560 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uD3B8\uC9D1\uAE30",
  "Prefer Ollama /api/chat (with fallback)": "Ollama /api/chat \uC6B0\uC120(\uD3F4\uBC31 \uD3EC\uD568)",
  "Chat transcript folder path": "\uCC44\uD305 \uAE30\uB85D \uD3F4\uB354 \uACBD\uB85C",
  "Auto-sync chat thread": "\uCC44\uD305 \uC2A4\uB808\uB4DC \uC790\uB3D9 \uB3D9\uAE30\uD654",
  "Allow non-local Q&A endpoint (danger)": "\uB85C\uCEEC \uC678 Q&A \uC5D4\uB4DC\uD3EC\uC778\uD2B8 \uD5C8\uC6A9(\uC704\uD5D8)",
  "Remove legacy AI-prefixed keys": "\uB808\uAC70\uC2DC AI \uC811\uB450 \uD0A4 \uC81C\uAC70",
  "Enable cleanup rules during apply": "\uC801\uC6A9 \uC2DC \uC815\uB9AC \uADDC\uCE59 \uC0AC\uC6A9",
  "Cleanup exact keys": "\uC815\uB9AC \uC815\uD655 \uD0A4",
  "Pick cleanup keys from selected notes": "\uC120\uD0DD \uB178\uD2B8\uC5D0\uC11C \uC815\uB9AC \uD0A4 \uC120\uD0DD",
  "Cleanup key prefixes": "\uC815\uB9AC \uD0A4 \uC811\uB450\uC5B4",
  "Never remove these keys": "\uC808\uB300 \uC81C\uAC70\uD558\uC9C0 \uC54A\uC744 \uD0A4",
  "Run cleanup command": "\uC815\uB9AC \uBA85\uB839 \uC2E4\uD589",
  "Cleanup dry-run report folder": "\uC815\uB9AC dry-run \uB9AC\uD3EC\uD2B8 \uD3F4\uB354",
  "Sort tags and linked arrays": "tags/linked \uBC30\uC5F4 \uC815\uB82C",
  "Include subfolders for selected folders": "\uC120\uD0DD \uD3F4\uB354 \uD558\uC704\uD3F4\uB354 \uD3EC\uD568",
  "Selection path width percent": "\uC120\uD0DD \uACBD\uB85C \uB108\uBE44 \uBE44\uC728",
  "Excluded folder patterns": "\uC81C\uC678 \uD3F4\uB354 \uD328\uD134",
  "Backup selected notes before apply": "\uC801\uC6A9 \uC804 \uC120\uD0DD \uB178\uD2B8 \uBC31\uC5C5",
  "Backup root path": "\uBC31\uC5C5 \uB8E8\uD2B8 \uACBD\uB85C",
  "Backup retention count": "\uBC31\uC5C5 \uBCF4\uAD00 \uAC1C\uC218",
  "Generate MOC after apply": "\uC801\uC6A9 \uD6C4 MOC \uC0DD\uC131",
  "MOC file path": "MOC \uD30C\uC77C \uACBD\uB85C"
};
var SETTINGS_DESC_KO_MAP = {
  "Choose AI provider. Local providers are recommended first.": "AI \uC81C\uACF5\uC790\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uB85C\uCEEC \uC81C\uACF5\uC790\uB97C \uC6B0\uC120 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.",
  "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for analysis.": "\uAC10\uC9C0\uB41C \uBAA8\uB378 \uC911\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. (\uCD94\uCC9C)=\uAD8C\uC7A5, (\uBD88\uAC00)=\uBD84\uC11D \uBD80\uC801\uD569",
  "Manual override if you want a custom model name.": "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uBAA8\uB378\uBA85\uC744 \uC9C1\uC811 \uC785\uB825\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Detect local models and auto-choose recommended when current is missing.": "\uB85C\uCEEC \uBAA8\uB378\uC744 \uAC10\uC9C0\uD574 \uD604\uC7AC \uBAA8\uB378\uC774 \uC5C6\uC73C\uBA74 \uAD8C\uC7A5 \uBAA8\uB378\uC744 \uC790\uB3D9 \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "Analyze first, preview changes, and apply only when approved.": "\uBA3C\uC800 \uBD84\uC11D\uD558\uACE0 \uBCC0\uACBD \uBBF8\uB9AC\uBCF4\uAE30\uB97C \uD655\uC778\uD55C \uB4A4 \uC2B9\uC778 \uC2DC\uC5D0\uB9CC \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "In addition to persistent progress modal, show short notices.": "\uACE0\uC815 \uC9C4\uD589 \uBAA8\uB2EC \uC678\uC5D0\uB3C4 \uC9E7\uC740 \uC54C\uB9BC\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  "Use local Ollama embeddings to rank likely related notes before AI linked suggestion.": "AI linked \uC81C\uC548 \uC804\uC5D0 \uB85C\uCEEC Ollama \uC784\uBCA0\uB529\uC73C\uB85C \uAD00\uB828 \uAC00\uB2A5 \uB178\uD2B8\uB97C \uC6B0\uC120 \uC815\uB82C\uD569\uB2C8\uB2E4.",
  "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for embeddings.": "\uAC10\uC9C0\uB41C \uBAA8\uB378 \uC911\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. (\uCD94\uCC9C)=\uAD8C\uC7A5, (\uBD88\uAC00)=\uC784\uBCA0\uB529 \uBD80\uC801\uD569",
  "Manual override if you want a custom embedding model name.": "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uC784\uBCA0\uB529 \uBAA8\uB378\uBA85\uC744 \uC9C1\uC811 \uC785\uB825\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Range: 0.0 to 1.0": "\uBC94\uC704: 0.0 ~ 1.0",
  "Trim note text before embedding to keep local runs fast.": "\uB85C\uCEEC \uC2E4\uD589 \uC131\uB2A5\uC744 \uC704\uD574 \uC784\uBCA0\uB529 \uC804 \uB178\uD2B8 \uD14D\uC2A4\uD2B8 \uAE38\uC774\uB97C \uC81C\uD55C\uD569\uB2C8\uB2E4.",
  "Leave empty to use main Ollama base URL.": "\uBE44\uC6CC\uB450\uBA74 \uBA54\uC778 Ollama \uAE30\uBCF8 URL\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Leave empty to use main analysis model.": "\uBE44\uC6CC\uB450\uBA74 \uBA54\uC778 \uBD84\uC11D \uBAA8\uB378\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Select execution pipeline for post-generation passes.": "\uC0DD\uC131 \uD6C4 \uD6C4\uCC98\uB9AC \uD328\uC2A4\uC758 \uC2E4\uD589 \uD30C\uC774\uD504\uB77C\uC778\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "Refresh local model detection manually, then choose role-specific models below.": "\uB85C\uCEEC \uBAA8\uB378 \uAC10\uC9C0\uB97C \uC218\uB3D9\uC73C\uB85C \uAC31\uC2E0\uD55C \uB4A4, \uC544\uB798\uC5D0\uC11C \uC5ED\uD560\uBCC4 \uBAA8\uB378\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "Auto-fill role model fields from detected models when values are missing or legacy-uniform.": "\uAC12\uC774 \uBE44\uC5B4 \uC788\uAC70\uB098 \uAE30\uC874\uCC98\uB7FC \uB3D9\uC77C \uBAA8\uB378\uB85C\uB9CC \uCC44\uC6CC\uC9C4 \uACBD\uC6B0, \uAC10\uC9C0 \uBAA8\uB378 \uAE30\uBC18 \uAD8C\uC7A5\uAC12\uC73C\uB85C \uC5ED\uD560\uBCC4 \uD544\uB4DC\uB97C \uC790\uB3D9 \uCC44\uC6C1\uB2C8\uB2E4.",
  "Calculate role-specific recommended models from detected list and apply.": "\uAC10\uC9C0\uB41C \uBAA8\uB378 \uBAA9\uB85D\uC5D0\uC11C \uC5ED\uD560\uBCC4 \uAD8C\uC7A5 \uBAA8\uB378\uC744 \uACC4\uC0B0\uD574 \uC989\uC2DC \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "Optional role-specific model. Empty uses Q&A model as fallback.": "\uC5ED\uD560 \uC804\uC6A9 \uBAA8\uB378(\uC120\uD0DD)\uC785\uB2C8\uB2E4. \uBE44\uC6B0\uBA74 Q&A \uBAA8\uB378\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Prefer vision-capable models for Ask (vision). Chat UI is text-first; image handling depends on host input support.": "Ask(\uBE44\uC804)\uC740 \uBE44\uC804 \uAC00\uB2A5\uD55C \uBAA8\uB378\uC744 \uC6B0\uC120 \uAD8C\uC7A5\uD569\uB2C8\uB2E4. \uCC44\uD305 UI\uB294 \uD14D\uC2A4\uD2B8 \uC911\uC2EC\uC774\uBA70 \uC774\uBBF8\uC9C0 \uCC98\uB9AC\uB294 \uD638\uC2A4\uD2B8 \uC785\uB825 \uC9C0\uC6D0\uC5D0 \uB530\uB77C \uB2EC\uB77C\uC9D1\uB2C8\uB2E4.",
  "Used when role preset is Ask (vision). Text-only for now, image input support is planned.": "Ask(\uBE44\uC804) \uD504\uB9AC\uC14B\uC5D0\uC11C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uD604\uC7AC\uB294 \uD14D\uC2A4\uD2B8 \uC911\uC2EC\uC774\uBA70 \uC774\uBBF8\uC9C0 \uC785\uB825 \uC9C0\uC6D0\uC740 \uCD94\uD6C4 \uD655\uC7A5 \uC608\uC815\uC785\uB2C8\uB2E4.",
  "Reserved for image-generation workflows. Current chat UI is text-first.": "\uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC6CC\uD06C\uD50C\uB85C\uC6A9 \uC608\uC57D \uBAA8\uB378\uC785\uB2C8\uB2E4. \uD604\uC7AC \uCC44\uD305 UI\uB294 \uD14D\uC2A4\uD2B8 \uC911\uC2EC\uC785\uB2C8\uB2E4.",
  "Add extra system instructions per role agent. Empty keeps built-in role prompt only.": "\uC5ED\uD560\uBCC4 \uC5D0\uC774\uC804\uD2B8\uC5D0 \uCD94\uAC00 \uC2DC\uC2A4\uD15C \uC9C0\uC2DC\uB97C \uB123\uC2B5\uB2C8\uB2E4. \uBE44\uC6B0\uBA74 \uAE30\uBCF8 \uC5ED\uD560 \uD504\uB86C\uD504\uD2B8\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Use role-based chat first, then fallback to /api/generate when unavailable.": "\uC5ED\uD560 \uAE30\uBC18 /api/chat\uC744 \uC6B0\uC120 \uC0AC\uC6A9\uD558\uACE0, \uBD88\uAC00\uD558\uBA74 /api/generate\uB85C \uD3F4\uBC31\uD569\uB2C8\uB2E4.",
  "Vault-relative path for saving chat transcripts.": "\uCC44\uD305 \uAE30\uB85D \uC800\uC7A5\uC6A9 vault-relative \uACBD\uB85C\uC785\uB2C8\uB2E4.",
  "When enabled, the current chat thread is continuously saved and updated as messages change.": "\uD65C\uC131\uD654\uD558\uBA74 \uD604\uC7AC \uCC44\uD305 \uC2A4\uB808\uB4DC\uB97C \uBA54\uC2DC\uC9C0 \uBCC0\uACBD\uC5D0 \uB9DE\uCDB0 \uACC4\uC18D \uC800\uC7A5/\uB3D9\uAE30\uD654\uD569\uB2C8\uB2E4.",
  "Off by default. Keep disabled to prevent note data leaving localhost.": "\uAE30\uBCF8\uAC12\uC740 \uAEBC\uC9D0\uC785\uB2C8\uB2E4. \uB178\uD2B8 \uB370\uC774\uD130\uAC00 localhost \uBC16\uC73C\uB85C \uB098\uAC00\uC9C0 \uC54A\uB3C4\uB85D \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB97C \uAD8C\uC7A5\uD569\uB2C8\uB2E4.",
  "If enabled, removes only legacy keys like ai_*/autolinker_* while preserving other existing keys (including linter date fields).": "\uD65C\uC131\uD654\uD558\uBA74 ai_*/autolinker_* \uAC19\uC740 \uB808\uAC70\uC2DC \uD0A4\uB9CC \uC81C\uAC70\uD558\uACE0, \uB2E4\uB978 \uAE30\uC874 \uD0A4(\uB9B0\uD130 \uB0A0\uC9DC \uD544\uB4DC \uD3EC\uD568)\uB294 \uC720\uC9C0\uD569\uB2C8\uB2E4.",
  "When applying AI suggestions, also remove frontmatter keys by rules below.": "AI \uC81C\uC548 \uC801\uC6A9 \uC2DC \uC544\uB798 \uADDC\uCE59\uC5D0 \uB530\uB77C frontmatter \uD0A4\uB3C4 \uD568\uAED8 \uC815\uB9AC\uD569\uB2C8\uB2E4.",
  "Comma/newline separated keys. Example: related, linked_context": "\uC27C\uD45C/\uC904\uBC14\uAFC8\uC73C\uB85C \uAD6C\uBD84\uD55C \uD0A4 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uC608: related, linked_context",
  "Scan selected notes and choose keys by checkbox.": "\uC120\uD0DD\uD55C \uB178\uD2B8\uB97C \uC2A4\uCE94\uD574 \uCCB4\uD06C\uBC15\uC2A4\uB85C \uC815\uB9AC \uD0A4\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "Comma/newline separated prefixes. Example: temp_, draft_": "\uC27C\uD45C/\uC904\uBC14\uAFC8\uC73C\uB85C \uAD6C\uBD84\uD55C \uC811\uB450\uC5B4 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uC608: temp_, draft_",
  "Comma/newline separated keys that override cleanup rules.": "\uC815\uB9AC \uADDC\uCE59\uBCF4\uB2E4 \uC6B0\uC120\uD558\uB294 \uD0A4 \uBAA9\uB85D(\uC27C\uD45C/\uC904\uBC14\uAFC8 \uAD6C\uBD84)\uC785\uB2C8\uB2E4.",
  "Use command palette: apply='Cleanup frontmatter properties for selected notes', preview='Dry-run cleanup frontmatter properties for selected notes'.": "\uBA85\uB839 \uD314\uB808\uD2B8 \uC0AC\uC6A9: apply='Cleanup frontmatter properties for selected notes', preview='Dry-run cleanup frontmatter properties for selected notes'.",
  "Vault-relative folder for cleanup dry-run report files.": "\uC815\uB9AC dry-run \uB9AC\uD3EC\uD2B8 \uC800\uC7A5\uC6A9 vault-relative \uD3F4\uB354\uC785\uB2C8\uB2E4.",
  "Helps keep stable output and reduce linter churn.": "\uCD9C\uB825 \uC548\uC815\uC131\uC744 \uB192\uC774\uACE0 \uB9B0\uD130 \uBCC0\uACBD \uC7A1\uC74C\uC744 \uC904\uC5EC\uC90D\uB2C8\uB2E4.",
  "Controls path width in Select target notes/folders modal (45-100).": "Select target notes/folders \uBAA8\uB2EC\uC758 \uACBD\uB85C \uB108\uBE44\uB97C \uC870\uC808\uD569\uB2C8\uB2E4(45-100).",
  "Comma-separated substrings. Matched folders are ignored during selection/analysis.": "\uC27C\uD45C\uB85C \uAD6C\uBD84\uD55C \uBB38\uC790\uC5F4 \uD328\uD134\uC785\uB2C8\uB2E4. \uC77C\uCE58\uD558\uB294 \uD3F4\uB354\uB294 \uC120\uD0DD/\uBD84\uC11D\uC5D0\uC11C \uC81C\uC678\uB429\uB2C8\uB2E4.",
  "You can also override this every run from the backup confirmation dialog.": "\uBC31\uC5C5 \uD655\uC778 \uB300\uD654\uC0C1\uC790\uC5D0\uC11C \uC2E4\uD589\uB9C8\uB2E4 \uC774 \uC124\uC815\uC744 \uB36E\uC5B4\uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  "Vault-relative folder path used for versioned backups.": "\uBC84\uC804\uD615 \uBC31\uC5C5\uC5D0 \uC0AC\uC6A9\uD558\uB294 vault-relative \uD3F4\uB354 \uACBD\uB85C\uC785\uB2C8\uB2E4.",
  "Keep only latest N backups (old backups are deleted automatically).": "\uCD5C\uC2E0 N\uAC1C \uBC31\uC5C5\uB9CC \uC720\uC9C0\uD569\uB2C8\uB2E4(\uC624\uB798\uB41C \uBC31\uC5C5\uC740 \uC790\uB3D9 \uC0AD\uC81C).",
  "Vault-relative markdown path.": "vault-relative \uB9C8\uD06C\uB2E4\uC6B4 \uACBD\uB85C\uC785\uB2C8\uB2E4."
};
function toKoreanBilingualLabel(originalText, translationMap) {
  var _a;
  const normalized = (_a = originalText == null ? void 0 : originalText.trim()) != null ? _a : "";
  if (!normalized || normalized.includes(" / ")) {
    return null;
  }
  const translated = translationMap[normalized];
  if (!translated) {
    return null;
  }
  return `${normalized} / ${translated}`;
}
function toKoreanBilingualParts(originalText, translationMap) {
  var _a;
  const normalized = (_a = originalText == null ? void 0 : originalText.trim()) != null ? _a : "";
  if (!normalized || normalized.includes(" / ")) {
    return null;
  }
  const translated = translationMap[normalized];
  if (!translated) {
    return null;
  }
  return { en: normalized, ko: translated };
}
var ROLE_MODEL_FALLBACK_VALUE = "__fallback__";
var ROLE_MODEL_SETTING_CONFIGS = [
  {
    key: "qaAskModel",
    role: "ask",
    name: "Ask model (text)",
    description: "Optional role-specific model. Empty uses Q&A model as fallback."
  },
  {
    key: "qaAskVisionModel",
    role: "ask_vision",
    name: "Ask model (vision)",
    description: "Prefer vision-capable models for Ask (vision). Chat UI is text-first; image handling depends on host input support."
  },
  {
    key: "qaImageGeneratorModel",
    role: "image_generator",
    name: "Image generator model",
    description: "Reserved for image-generation workflows. Current chat UI is text-first."
  },
  {
    key: "qaCoderModel",
    role: "coder",
    name: "Coder model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback."
  },
  {
    key: "qaArchitectModel",
    role: "architect",
    name: "Architect model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback."
  },
  {
    key: "qaOrchestratorModel",
    role: "orchestrator",
    name: "Orchestrator model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback."
  },
  {
    key: "qaSafeguardModel",
    role: "safeguard",
    name: "Safeguard model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback."
  }
];
var CODER_MODEL_REGEX = /(coder|code|codellama|codestral|starcoder|deepseek-coder)/i;
var SAFEGUARD_MODEL_REGEX = /(guard|safeguard|safety|llama-guard)/i;
var VISION_MODEL_REGEX = /(vision|llava|bakllava|moondream|qwen.*vl|pixtral|internvl)/i;
var IMAGE_GENERATOR_MODEL_REGEX = /(flux|sdxl|stable[-_ ]?diffusion|diffusion|imagegen|image-gen)/i;
var GENERAL_TEXT_MODEL_REGEX = /(qwen|llama|gpt-oss|gemma|mistral|devstral|phi|deepseek|yi)/i;
var LARGE_MODEL_SIZE_REGEX = /:(12|14|20|24|27|30|32|34|70)b\b/i;
var MID_MODEL_SIZE_REGEX = /:(7|8|9|10|11)b\b/i;
var SMALL_MODEL_SIZE_REGEX = /:(0\.[0-9]+|1|2|3|4|5|6)b\b/i;
function extractModelSizeBillions(modelName) {
  const matched = modelName.toLowerCase().match(/:(\d+(?:\.\d+)?)b\b/);
  if (!matched) {
    return null;
  }
  const parsed = Number.parseFloat(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
function isOllamaModelAllowedForQaRole(role, modelName) {
  const trimmed = modelName.trim();
  if (!trimmed) {
    return false;
  }
  if (role === "ask_vision") {
    return isOllamaModelAnalyzable(trimmed) || VISION_MODEL_REGEX.test(trimmed.toLowerCase());
  }
  return isOllamaModelAnalyzable(trimmed);
}
function scoreRoleModel(role, modelName) {
  if (!isOllamaModelAllowedForQaRole(role, modelName)) {
    return -100;
  }
  const lower = modelName.toLowerCase();
  const isCoder = CODER_MODEL_REGEX.test(lower);
  const isSafeguard = SAFEGUARD_MODEL_REGEX.test(lower);
  const isVision = VISION_MODEL_REGEX.test(lower);
  const isImageGenerator = IMAGE_GENERATOR_MODEL_REGEX.test(lower);
  const isGeneral = GENERAL_TEXT_MODEL_REGEX.test(lower) && !isVision && !isImageGenerator;
  const isLarge = LARGE_MODEL_SIZE_REGEX.test(lower);
  const isMid = MID_MODEL_SIZE_REGEX.test(lower);
  const isSmall = SMALL_MODEL_SIZE_REGEX.test(lower);
  const sizeB = extractModelSizeBillions(lower);
  let score = 0;
  switch (role) {
    case "ask":
      score += isGeneral ? 40 : 20;
      if (isCoder) {
        score -= 16;
      }
      if (isSafeguard) {
        score -= 18;
      }
      if (isVision || isImageGenerator) {
        score -= 12;
      }
      if (isLarge) {
        score += 6;
      } else if (isMid) {
        score += 4;
      } else if (isSmall) {
        score -= 2;
      }
      if (sizeB !== null) {
        if (sizeB >= 12 && sizeB <= 20) {
          score += 6;
        } else if (sizeB > 20) {
          score += 2;
        }
      }
      break;
    case "ask_vision":
      score += isGeneral ? 34 : 18;
      if (isVision) {
        score += 34;
      } else {
        score -= 10;
      }
      if (isCoder) {
        score -= 8;
      }
      if (isSafeguard) {
        score -= 12;
      }
      if (isLarge) {
        score += 6;
      } else if (isMid) {
        score += 4;
      }
      if (sizeB !== null && sizeB >= 12 && sizeB <= 20) {
        score += 6;
      } else if (sizeB !== null && sizeB > 24) {
        score += 1;
      }
      break;
    case "image_generator":
      score += isGeneral ? 28 : 15;
      if (isImageGenerator) {
        score += 8;
      }
      if (isCoder || isSafeguard) {
        score -= 10;
      }
      if (isMid) {
        score += 4;
      }
      if (isLarge) {
        score += 4;
      }
      if (sizeB !== null && sizeB >= 12 && sizeB <= 24) {
        score += 5;
      }
      break;
    case "coder":
    case "debugger":
      score += isCoder ? 60 : 18;
      if (isSafeguard) {
        score -= 20;
      }
      if (isGeneral) {
        score += 8;
      }
      if (isLarge) {
        score += 8;
      } else if (isMid) {
        score += 5;
      } else if (isSmall) {
        score -= 4;
      }
      if (sizeB !== null) {
        if (sizeB >= 20) {
          score += 8;
        } else if (sizeB >= 12) {
          score += 4;
        }
      }
      break;
    case "safeguard":
      score += isSafeguard ? 65 : 18;
      if (isCoder) {
        score -= 18;
      }
      if (isGeneral) {
        score += 8;
      }
      if (isLarge) {
        score += 6;
      }
      if (sizeB !== null && sizeB >= 14) {
        score += 4;
      }
      break;
    case "architect":
    case "orchestrator":
      score += isGeneral ? 38 : 18;
      score += isLarge ? 22 : isMid ? 8 : -2;
      if (isCoder) {
        score -= 8;
      }
      if (isSafeguard) {
        score -= 12;
      }
      if (sizeB !== null) {
        if (sizeB >= 30) {
          score += 14;
        } else if (sizeB >= 20) {
          score += 10;
        } else if (sizeB >= 12) {
          score += 6;
        }
      }
      break;
    default:
      score += 22;
      break;
  }
  if (!isGeneral && !isCoder && !isSafeguard && !(role === "ask_vision" && isVision)) {
    score -= 4;
  }
  if (/qwen3/.test(lower)) {
    score += 4;
  } else if (/gpt-oss/.test(lower)) {
    score += 3;
  } else if (/devstral|mistral/.test(lower)) {
    score += 2;
  } else if (/gemma/.test(lower)) {
    score += 1;
  }
  return score;
}
function buildRoleSpecificOllamaModelOptions(role, models) {
  var _a;
  const scored = models.map((model) => ({ model, score: scoreRoleModel(role, model) })).sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));
  const recommended = (_a = scored.find((item) => item.score > -100)) == null ? void 0 : _a.model;
  const options = models.map((model) => {
    const isRoleCompatible = isOllamaModelAllowedForQaRole(role, model);
    if (!isRoleCompatible) {
      return {
        model,
        status: "unavailable",
        reason: role === "ask_vision" ? "Not suitable for Ask (vision) role." : "Not suitable for current text-based role pipeline."
      };
    }
    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: `Recommended for ${role} role based on detected local model profile.`
      };
    }
    return {
      model,
      status: "available",
      reason: role === "ask_vision" && VISION_MODEL_REGEX.test(model.toLowerCase()) ? "Available vision-capable model for Ask (vision)." : "Available text-capable model."
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
var QA_ROLE_PRESET_OPTIONS = [
  { value: "ask", label: "Ask (default / \uAE30\uBCF8)" },
  { value: "ask_vision", label: "Ask (vision / \uBE44\uC804)" },
  { value: "image_generator", label: "Image generator / \uC774\uBBF8\uC9C0 \uC0DD\uC131" },
  { value: "orchestrator", label: "Orchestrator / \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130" },
  { value: "coder", label: "Coder / \uCF54\uB354" },
  { value: "debugger", label: "Debugger / \uB514\uBC84\uAC70" },
  { value: "architect", label: "Architect / \uC544\uD0A4\uD14D\uD2B8" },
  { value: "safeguard", label: "Safeguard (security / \uBCF4\uC548)" }
];
var QA_PIPELINE_PRESET_OPTIONS = [
  {
    value: "orchestrator_safeguard",
    label: "Orchestrator -> Safeguard (default / \uAE30\uBCF8)"
  },
  {
    value: "orchestrator_auto_route",
    label: "Orchestrator -> Auto route sub agents -> Safeguard (\uC790\uB3D9 \uB77C\uC6B0\uD305)"
  },
  {
    value: "orchestrator_coder_safeguard",
    label: "Orchestrator -> Coder -> Safeguard"
  },
  {
    value: "orchestrator_architect_safeguard",
    label: "Orchestrator -> Architect -> Safeguard"
  },
  {
    value: "orchestrator_architect_coder_safeguard",
    label: "Orchestrator -> Architect -> Coder -> Safeguard"
  },
  {
    value: "legacy_auto",
    label: "Legacy auto (\uAE30\uC874 \uC790\uB3D9 \uADDC\uCE59)"
  }
];
function getQaRolePresetLabel(value) {
  var _a;
  const found = QA_ROLE_PRESET_OPTIONS.find((option) => option.value === value);
  return (_a = found == null ? void 0 : found.label) != null ? _a : value;
}
function getQaPipelinePresetLabel(value) {
  var _a;
  const found = QA_PIPELINE_PRESET_OPTIONS.find((option) => option.value === value);
  return (_a = found == null ? void 0 : found.label) != null ? _a : value;
}
var KnowledgeWeaverSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.rolePromptEditorTarget = "ask";
    this.plugin = plugin;
  }
  formatDetectedModelLabel(option) {
    const suffix = option.status === "recommended" ? " (\uCD94\uCC9C)" : option.status === "unavailable" ? " (\uBD88\uAC00)" : "";
    return `${option.model}${suffix}`;
  }
  addRoleModelPickerSetting(containerEl, config, roleOptions) {
    const currentValue = this.plugin.settings[config.key].trim();
    new import_obsidian4.Setting(containerEl).setName(config.name).setDesc(config.description).addDropdown((dropdown) => {
      dropdown.addOption(
        ROLE_MODEL_FALLBACK_VALUE,
        "Use Q&A model fallback / Q&A \uBAA8\uB378 \uD3F4\uBC31"
      );
      for (const option of roleOptions) {
        dropdown.addOption(option.model, this.formatDetectedModelLabel(option));
      }
      const selected = currentValue && roleOptions.some((option) => option.model === currentValue) ? currentValue : ROLE_MODEL_FALLBACK_VALUE;
      dropdown.setValue(selected);
      dropdown.onChange(async (value) => {
        const chosen = roleOptions.find((option) => option.model === value);
        if ((chosen == null ? void 0 : chosen.status) === "unavailable") {
          new import_obsidian4.Notice(`Selected model is marked as (\uBD88\uAC00): ${value}`, 4500);
          this.display();
          return;
        }
        this.plugin.settings[config.key] = value === ROLE_MODEL_FALLBACK_VALUE ? "" : value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-linker-settings-tab");
    containerEl.createEl("h2", { text: "Auto Link Settings / Auto Link \uC124\uC815" });
    containerEl.createEl("p", {
      text: "Language docs / \uC5B8\uC5B4 \uBB38\uC11C: README.md (EN) | README_KO.md (KO)"
    });
    new import_obsidian4.Setting(containerEl).setName("Provider").setDesc("Choose AI provider. Local providers are recommended first.").addDropdown(
      (dropdown) => dropdown.addOption("ollama", "Ollama (local / \uB85C\uCEEC)").addOption("lmstudio", "LM Studio (local / \uB85C\uCEEC)").addOption("openai", "OpenAI / Codex").addOption("anthropic", "Claude / \uD074\uB85C\uB4DC").addOption("gemini", "Gemini / \uC81C\uBBF8\uB098\uC774").setValue(this.plugin.settings.provider).onChange(async (value) => {
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
          dropdown.addOption(option.model, this.formatDetectedModelLabel(option));
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
        if (!isOllamaModelAnalyzable(value)) {
          new import_obsidian4.Notice(`Selected model is marked as (\uBD88\uAC00): ${value}`, 4500);
          this.display();
          return;
        }
        this.plugin.settings.ollamaModel = value;
        await this.plugin.saveSettings();
        this.display();
      });
    }).addButton(
      (button) => button.setButtonText("Refresh / \uC0C8\uB85C\uACE0\uCE68").onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText("Use recommended / \uAD8C\uC7A5\uAC12 \uC0AC\uC6A9").onClick(async () => {
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
    new import_obsidian4.Setting(containerEl).setName("Force all-to-all linked (deterministic)").setDesc(
      "When enabled, linked field includes all selected notes for each note (except self). maxLinked is ignored in this mode."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.forceAllToAllLinkedEnabled).onChange(async (value) => {
        this.plugin.settings.forceAllToAllLinkedEnabled = value;
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
    new import_obsidian4.Setting(containerEl).setName("Analyze changed notes only / \uBCC0\uACBD\uB41C \uB178\uD2B8\uB9CC \uBD84\uC11D").setDesc(
      "Skip unchanged notes when cache metadata matches. Turn off to include cached notes in every run. / \uCE90\uC2DC\uC640 \uB3D9\uC77C\uD558\uBA74 \uC2A4\uD0B5\uD569\uB2C8\uB2E4."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analysisOnlyChangedNotes).onChange(async (value) => {
        this.plugin.settings.analysisOnlyChangedNotes = value;
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
      (button) => button.setButtonText("Refresh / \uC0C8\uB85C\uACE0\uCE68").onClick(async () => {
        await this.plugin.refreshEmbeddingModelDetection({
          notify: true,
          autoApply: true
        });
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText("Use recommended / \uAD8C\uC7A5\uAC12 \uC0AC\uC6A9").onClick(async () => {
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
    containerEl.createEl("h3", { text: "Local Q&A (security-first) / \uB85C\uCEEC Q&A (\uBCF4\uC548 \uC6B0\uC120)" });
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
    new import_obsidian4.Setting(containerEl).setName("Prefer Ollama /api/chat (with fallback)").setDesc("Use role-based chat first, then fallback to /api/generate when unavailable.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaPreferChatApi).onChange(async (value) => {
        this.plugin.settings.qaPreferChatApi = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A retrieval top-k / \uAC80\uC0C9 \uC18C\uC2A4 \uC218").addText(
      (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings.qaTopK)).onChange(async (value) => {
        this.plugin.settings.qaTopK = parsePositiveInt(
          value,
          this.plugin.settings.qaTopK
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A max context chars / \uCD5C\uB300 \uCEE8\uD14D\uC2A4\uD2B8 \uAE38\uC774").setDesc("Maximum total note characters to send to local LLM. / \uB85C\uCEEC LLM\uC5D0 \uC804\uB2EC\uD560 \uCD5C\uB300 \uBB38\uC790 \uC218").addText(
      (text) => text.setPlaceholder("12000").setValue(String(this.plugin.settings.qaMaxContextChars)).onChange(async (value) => {
        this.plugin.settings.qaMaxContextChars = parsePositiveInt(
          value,
          this.plugin.settings.qaMaxContextChars
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Structured answer guard / \uAD6C\uC870\uD654 \uCD9C\uB825 \uAC00\uB4DC").setDesc("Enforce table/checklist/link structure for comparison/plan/source questions. / \uD45C\xB7\uCCB4\uD06C\uB9AC\uC2A4\uD2B8\xB7\uB9C1\uD06C \uD615\uC2DD\uC744 \uAC15\uC81C\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaStructureGuardEnabled).onChange(async (value) => {
        this.plugin.settings.qaStructureGuardEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Always detailed answers / \uD56D\uC0C1 \uC790\uC138\uD55C \uB2F5\uBCC0").setDesc("Prefer long, structured answers unless user explicitly asks for brief output. / \uC0AC\uC6A9\uC790\uAC00 \uC9E7\uAC8C \uC694\uCCAD\uD558\uC9C0 \uC54A\uC73C\uBA74 \uC0C1\uC138 \uB2F5\uBCC0\uC744 \uC6B0\uC120\uD569\uB2C8\uB2E4.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAlwaysDetailedAnswer).onChange(async (value) => {
        this.plugin.settings.qaAlwaysDetailedAnswer = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Minimum answer chars / \uCD5C\uC18C \uB2F5\uBCC0 \uAE38\uC774").setDesc("Used by structured guard depth repair. / \uAD6C\uC870\uD654 \uAC00\uB4DC\uC758 \uAE38\uC774 \uBCF4\uC815 \uAE30\uC900").addText(
      (text) => text.setPlaceholder("320").setValue(String(this.plugin.settings.qaMinAnswerChars)).onChange(async (value) => {
        this.plugin.settings.qaMinAnswerChars = parsePositiveInt(
          value,
          this.plugin.settings.qaMinAnswerChars
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Preferred response language / \uB2F5\uBCC0 \uC5B8\uC5B4 \uC6B0\uC120").setDesc("Applies to local Q&A prompt. / \uB85C\uCEEC Q&A \uD504\uB86C\uD504\uD2B8\uC5D0 \uC801\uC6A9").addDropdown(
      (dropdown) => dropdown.addOption("auto", "Auto / \uC790\uB3D9").addOption("korean", "Korean / \uD55C\uAD6D\uC5B4").addOption("english", "English / \uC601\uC5B4").setValue(this.plugin.settings.qaPreferredResponseLanguage).onChange(async (value) => {
        this.plugin.settings.qaPreferredResponseLanguage = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Role preset / \uC5ED\uD560 \uD504\uB9AC\uC14B").setDesc("Prompt style preset for local Q&A. / \uB85C\uCEEC Q&A \uB2F5\uBCC0 \uC131\uD5A5 \uD504\uB9AC\uC14B").addDropdown((dropdown) => {
      for (const option of QA_ROLE_PRESET_OPTIONS) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.plugin.settings.qaRolePreset).onChange(async (value) => {
        this.plugin.settings.qaRolePreset = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian4.Setting(containerEl).setName("Q&A pipeline preset").setDesc("Select execution pipeline for post-generation passes.").addDropdown((dropdown) => {
      for (const option of QA_PIPELINE_PRESET_OPTIONS) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.plugin.settings.qaPipelinePreset).onChange(async (value) => {
        this.plugin.settings.qaPipelinePreset = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    new import_obsidian4.Setting(containerEl).setName("Role model detection controls").setDesc(
      "Refresh local model detection manually, then choose role-specific models below."
    ).addButton(
      (button) => button.setButtonText("Refresh / \uC0C8\uB85C\uACE0\uCE68").onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText("Use recommended / \uAD8C\uC7A5\uAC12 \uC0AC\uC6A9").onClick(async () => {
        await this.plugin.applyRecommendedOllamaModel(true);
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Role model detection summary").setDesc(this.plugin.getOllamaDetectionSummary());
    new import_obsidian4.Setting(containerEl).setName("Auto-pick recommended role models").setDesc(
      "Auto-fill role model fields from detected models when values are missing or legacy-uniform."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaRoleModelAutoPickEnabled).onChange(async (value) => {
        this.plugin.settings.qaRoleModelAutoPickEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Apply role recommendations now").setDesc("Calculate role-specific recommended models from detected list and apply.").addButton(
      (button) => button.setButtonText("Auto-fill now / \uC9C0\uAE08 \uC790\uB3D9 \uCC44\uC6B0\uAE30").onClick(async () => {
        await this.plugin.applyRecommendedRoleModelsForQa(true, true);
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Role recommendation summary").setDesc(this.plugin.getRoleModelRecommendationSummaryForQa());
    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const roleOptions = this.plugin.getRoleModelOptionsForQa(config.role);
      this.addRoleModelPickerSetting(containerEl, config, roleOptions);
    }
    if (this.plugin.settings.qaPipelinePreset === "legacy_auto") {
      new import_obsidian4.Setting(containerEl).setName("Enable orchestrator pipeline / \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130 \uD30C\uC774\uD504\uB77C\uC778").setDesc("Use an orchestration rewrite pass for planning/report/PPT/game-style tasks. / \uACC4\uD68D\uC11C\xB7\uBCF4\uACE0\uC11C\xB7PPT\xB7\uAC8C\uC784 \uACFC\uC81C\uC5D0 \uCD94\uAC00 \uC815\uB9AC \uD328\uC2A4\uB97C \uC801\uC6A9").addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.qaOrchestratorEnabled).onChange(async (value) => {
          this.plugin.settings.qaOrchestratorEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(containerEl).setName("Enable safeguard verification / \uC138\uC774\uD504\uAC00\uB4DC \uAC80\uC99D").setDesc("Run a final factual/safety consistency pass against sources before returning answer. / \uCD9C\uCC98 \uAE30\uC900 \uC0AC\uC2E4\xB7\uBCF4\uC548 \uC77C\uAD00\uC131 \uCD5C\uC885 \uC810\uAC80").addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.qaSafeguardPassEnabled).onChange(async (value) => {
          this.plugin.settings.qaSafeguardPassEnabled = value;
          await this.plugin.saveSettings();
        })
      );
    }
    new import_obsidian4.Setting(containerEl).setName("Custom system prompt / \uC0AC\uC6A9\uC790 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8").setDesc("Optional policy/style instructions (e.g., 'Explain with Feynman method in Korean'). / \uC608: \uD55C\uAD6D\uC5B4, \uD30C\uC778\uB9CC\uC2DD \uC124\uBA85").addTextArea(
      (text) => text.setPlaceholder("Optional. Applied after built-in safety/policy prompt.").setValue(this.plugin.settings.qaCustomSystemPrompt).onChange(async (value) => {
        this.plugin.settings.qaCustomSystemPrompt = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Role system prompt editor").setDesc(
      "Add extra system instructions per role agent. Empty keeps built-in role prompt only."
    ).addDropdown((dropdown) => {
      for (const option of QA_ROLE_PRESET_OPTIONS) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.rolePromptEditorTarget).onChange((value) => {
        this.rolePromptEditorTarget = value;
        this.display();
      });
    }).addTextArea(
      (text) => text.setPlaceholder("Optional role-specific system prompt").setValue(this.plugin.getQaRoleSystemPromptForQa(this.rolePromptEditorTarget)).onChange(async (value) => {
        await this.plugin.setQaRoleSystemPromptForQa(
          this.rolePromptEditorTarget,
          value
        );
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Include selection inventory / \uC120\uD0DD \uD30C\uC77C \uC778\uBCA4\uD1A0\uB9AC \uD3EC\uD568").setDesc("For large scopes, include selected-file metadata list to reduce 'insufficient evidence' answers. / \uB300\uADDC\uBAA8 \uC120\uD0DD \uC2DC \uC804\uCCB4 \uD30C\uC77C \uBA54\uD0C0 \uBAA9\uB85D\uC744 \uCEE8\uD14D\uC2A4\uD2B8\uC5D0 \uCD94\uAC00").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaIncludeSelectionInventory).onChange(async (value) => {
        this.plugin.settings.qaIncludeSelectionInventory = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Inventory max files / \uC778\uBCA4\uD1A0\uB9AC \uCD5C\uB300 \uD30C\uC77C \uC218").setDesc("Upper bound for selected-file metadata snapshot in Q&A context. / Q&A \uCEE8\uD14D\uC2A4\uD2B8\uC5D0 \uB123\uC744 \uCD5C\uB300 \uD30C\uC77C \uC218").addText(
      (text) => text.setPlaceholder("200").setValue(String(this.plugin.settings.qaSelectionInventoryMaxFiles)).onChange(async (value) => {
        this.plugin.settings.qaSelectionInventoryMaxFiles = parsePositiveInt(
          value,
          this.plugin.settings.qaSelectionInventoryMaxFiles
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Chat transcript folder path").setDesc("Vault-relative path for saving chat transcripts.").addText(
      (text) => text.setPlaceholder("Auto Link Chats").setValue(this.plugin.settings.chatTranscriptRootPath).onChange(async (value) => {
        this.plugin.settings.chatTranscriptRootPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Auto-sync chat thread").setDesc(
      "When enabled, the current chat thread is continuously saved and updated as messages change."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaThreadAutoSyncEnabled).onChange(async (value) => {
        this.plugin.settings.qaThreadAutoSyncEnabled = value;
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
      (button) => button.setButtonText("Open picker / \uC120\uD0DD\uAE30 \uC5F4\uAE30").onClick(async () => {
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
      "Use command palette: apply='Cleanup frontmatter properties for selected notes', preview='Dry-run cleanup frontmatter properties for selected notes'."
    );
    new import_obsidian4.Setting(containerEl).setName("Cleanup dry-run report folder").setDesc("Vault-relative folder for cleanup dry-run report files.").addText(
      (text) => text.setPlaceholder("Auto Link Reports").setValue(this.plugin.settings.cleanupReportRootPath).onChange(async (value) => {
        this.plugin.settings.cleanupReportRootPath = value.trim();
        await this.plugin.saveSettings();
      })
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
    new import_obsidian4.Setting(containerEl).setName("Watch folders for new notes / \uC2E0\uADDC \uB178\uD2B8 \uD3F4\uB354 \uAC10\uC2DC").setDesc(
      "When a new markdown file appears in watched folders, prompt to add/analyze it. / \uC2E0\uADDC \uBB38\uC11C \uC0DD\uC131 \uC2DC \uC120\uD0DD/\uBD84\uC11D \uC5EC\uBD80\uB97C \uBB3B\uC2B5\uB2C8\uB2E4."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.watchNewNotesEnabled).onChange(async (value) => {
        this.plugin.settings.watchNewNotesEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Watched folders / \uAC10\uC2DC \uD3F4\uB354").setDesc("Comma/newline separated vault-relative folder paths. Example: Inbox,Clippings / \uC608: Inbox,Clippings").addTextArea(
      (text) => text.setPlaceholder("Inbox,Clippings").setValue(this.plugin.settings.watchNewNotesFolders).onChange(async (value) => {
        this.plugin.settings.watchNewNotesFolders = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Auto-tag active note / \uD604\uC7AC \uBB38\uC11C \uC790\uB3D9 \uD0DC\uAE45").setDesc("On file-open, auto-analyze and merge tags for the active markdown note. / \uBB38\uC11C \uC5F4\uAE30 \uC2DC \uD0DC\uADF8\uB9CC \uC790\uB3D9 \uBD84\uC11D\xB7\uBCD1\uD569").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoTagActiveNoteEnabled).onChange(async (value) => {
        this.plugin.settings.autoTagActiveNoteEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Auto-tag cooldown seconds / \uC790\uB3D9 \uD0DC\uAE45 \uCFE8\uB2E4\uC6B4(\uCD08)").setDesc("Minimum interval before re-tagging the same note. / \uAC19\uC740 \uB178\uD2B8 \uC7AC\uD0DC\uAE45 \uCD5C\uC18C \uAC04\uACA9").addText(
      (text) => text.setPlaceholder("90").setValue(String(this.plugin.settings.autoTagActiveNoteCooldownSec)).onChange(async (value) => {
        this.plugin.settings.autoTagActiveNoteCooldownSec = parsePositiveInt(
          value,
          this.plugin.settings.autoTagActiveNoteCooldownSec
        );
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
      (text) => text.setPlaceholder(".obsidian,Auto Link Backups").setValue(this.plugin.settings.excludedFolderPatterns).onChange(async (value) => {
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
      (text) => text.setPlaceholder("Auto Link Backups").setValue(this.plugin.settings.backupRootPath).onChange(async (value) => {
        try {
          await this.plugin.setBackupRootPathForQa(value);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid backup root path.";
          new import_obsidian4.Notice(message, 6e3);
          text.setValue(this.plugin.settings.backupRootPath);
        }
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
        try {
          await this.plugin.setMocPathForQa(value);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid MOC path.";
          new import_obsidian4.Notice(message, 6e3);
          text.setValue(this.plugin.settings.mocPath);
        }
      })
    );
    this.applyBilingualSettingsLabels(containerEl);
  }
  applyBilingualSettingsLabels(containerEl) {
    const headerEls = containerEl.querySelectorAll("h2, h3");
    for (const headerEl of Array.from(headerEls)) {
      const localized = toKoreanBilingualLabel(headerEl.textContent, SETTINGS_HEADER_KO_MAP);
      if (localized) {
        headerEl.textContent = localized;
      }
    }
    const nameEls = containerEl.querySelectorAll(".setting-item-name");
    for (const nameEl of Array.from(nameEls)) {
      const localized = toKoreanBilingualParts(nameEl.textContent, SETTINGS_NAME_KO_MAP);
      if (localized) {
        nameEl.empty();
        nameEl.addClass("auto-linker-bilingual-field");
        nameEl.createSpan({
          text: localized.en,
          cls: "auto-linker-bilingual-en"
        });
        nameEl.createSpan({
          text: localized.ko,
          cls: "auto-linker-bilingual-ko"
        });
      }
    }
    const descEls = containerEl.querySelectorAll(".setting-item-description");
    for (const descEl of Array.from(descEls)) {
      const localized = toKoreanBilingualParts(descEl.textContent, SETTINGS_DESC_KO_MAP);
      if (localized) {
        descEl.empty();
        descEl.addClass("auto-linker-bilingual-field");
        descEl.createSpan({
          text: localized.en,
          cls: "auto-linker-bilingual-en"
        });
        descEl.createSpan({
          text: localized.ko,
          cls: "auto-linker-bilingual-ko"
        });
      }
    }
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
    this.analysisCache = null;
    this.analysisCacheDirty = false;
    this.pendingNewNoteWatchPrompts = /* @__PURE__ */ new Set();
    this.autoTagInFlightPaths = /* @__PURE__ */ new Set();
    this.autoTagLastRunByPath = /* @__PURE__ */ new Map();
  }
  async onload() {
    await this.loadSettings();
    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("idle");
    this.registerView(
      LOCAL_QA_VIEW_TYPE,
      (leaf) => new LocalQAWorkspaceView(leaf, this)
    );
    await this.cleanupLegacyCacheArtifacts();
    this.addRibbonIcon("message-square", "Open Auto Link Local Chat", () => {
      void this.openLocalQaWorkspaceView();
    });
    this.registerEvent(
      this.app.vault.on("create", (entry) => {
        if (!(entry instanceof import_obsidian4.TFile) || entry.extension !== "md") {
          return;
        }
        void this.handleWatchedNewFile(entry);
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
          return;
        }
        void this.handleAutoTagOnFileOpen(file);
      })
    );
    this.addCommand({
      id: "select-target-notes",
      name: "Select target notes/folders",
      callback: async () => this.openSelectionModal()
    });
    this.addCommand({
      id: "analyze-target-notes",
      name: "Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis()
    });
    this.addCommand({
      id: "auto-tag-active-note",
      name: "Auto-tag active note (tags only)",
      callback: async () => {
        const active = this.app.workspace.getActiveFile();
        if (!(active instanceof import_obsidian4.TFile) || active.extension !== "md") {
          this.notice("No active markdown note.");
          return;
        }
        await this.runAutoTagForFile(active, "manual");
      }
    });
    this.addCommand({
      id: "clear-target-notes",
      name: "Clear selected target notes/folders",
      callback: async () => {
        this.settings.targetFilePaths = [];
        this.settings.targetFolderPaths = [];
        await this.saveSettings();
        this.notice("Target file/folder selection cleared.");
      }
    });
    this.addCommand({
      id: "backup-selected-notes",
      name: "Backup selected notes",
      callback: async () => this.backupSelectedNotesNow()
    });
    this.addCommand({
      id: "restore-latest-backup",
      name: "Restore from latest backup",
      callback: async () => this.restoreFromLatestBackup()
    });
    this.addCommand({
      id: "cleanup-selected-frontmatter",
      name: "Cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(false)
    });
    this.addCommand({
      id: "cleanup-selected-frontmatter-dry-run",
      name: "Dry-run cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(true)
    });
    this.addCommand({
      id: "select-cleanup-keys-from-selected-notes",
      name: "Select cleanup keys from selected notes",
      callback: async () => this.openCleanupKeyPicker()
    });
    this.addCommand({
      id: "refresh-ollama-models",
      name: "Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      }
    });
    this.addCommand({
      id: "refresh-embedding-models",
      name: "Refresh embedding model detection",
      callback: async () => {
        await this.refreshEmbeddingModelDetection({ notify: true, autoApply: true });
      }
    });
    this.addCommand({
      id: "generate-moc-now",
      name: "Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection()
    });
    this.addCommand({
      id: "ask-local-ai-from-selected-notes",
      name: "Ask local AI from selected notes",
      callback: async () => this.openLocalQaWorkspaceView()
    });
    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
  }
  onunload() {
    this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE).forEach((leaf) => leaf.detach());
    this.setStatus("idle");
  }
  getOllamaDetectionSummary() {
    return this.ollamaDetectionSummary;
  }
  getOllamaModelOptions() {
    return this.ollamaDetectionOptions;
  }
  getDetectedOllamaModelNames() {
    var _a;
    if (((_a = this.ollamaDetectionCache) == null ? void 0 : _a.models) && this.ollamaDetectionCache.models.length > 0) {
      return [...this.ollamaDetectionCache.models];
    }
    return this.ollamaDetectionOptions.map((option) => option.model);
  }
  readRoleModelSetting(key) {
    return this.settings[key].trim();
  }
  writeRoleModelSetting(key, value) {
    this.settings[key] = value.trim();
  }
  isLegacyUniformRoleModelConfig() {
    const values = ROLE_MODEL_SETTING_CONFIGS.map((config) => this.readRoleModelSetting(config.key)).filter((value) => value.length > 0);
    if (values.length < 2) {
      return false;
    }
    const unique = [...new Set(values)];
    if (unique.length !== 1) {
      return false;
    }
    const uniform = unique[0];
    return uniform === this.settings.ollamaModel.trim() || uniform === this.settings.qaOllamaModel.trim();
  }
  getRoleModelOptionsForQa(role) {
    const models = this.getDetectedOllamaModelNames();
    if (models.length === 0) {
      return [];
    }
    return buildRoleSpecificOllamaModelOptions(role, models);
  }
  getRoleModelRecommendationSummaryForQa() {
    const parts = ROLE_MODEL_SETTING_CONFIGS.map((config) => {
      var _a, _b;
      const options = this.getRoleModelOptionsForQa(config.role);
      const recommended = (_b = (_a = options.find((option) => option.status === "recommended")) == null ? void 0 : _a.model) != null ? _b : "(none)";
      return `${config.name}: ${recommended}`;
    });
    return parts.join(" | ");
  }
  async applyRecommendedRoleModelsForQa(notify, forceApply) {
    var _a;
    const legacyUniform = this.isLegacyUniformRoleModelConfig();
    let changed = 0;
    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const options = this.getRoleModelOptionsForQa(config.role);
      const recommended = (_a = options.find((option) => option.status === "recommended")) == null ? void 0 : _a.model;
      if (!recommended) {
        continue;
      }
      const current = this.readRoleModelSetting(config.key);
      const currentFound = current.length > 0 && options.some((option) => option.model === current);
      const currentUnavailable = current.length > 0 && !isOllamaModelAllowedForQaRole(config.role, current);
      const shouldApply = forceApply || legacyUniform || current.length === 0 || !currentFound || currentUnavailable;
      if (!shouldApply || current === recommended) {
        continue;
      }
      this.writeRoleModelSetting(config.key, recommended);
      changed += 1;
    }
    if (changed > 0) {
      await this.saveSettings();
    }
    if (notify) {
      if (changed > 0) {
        this.notice(`Applied role model recommendations to ${changed} field(s).`);
      } else {
        this.notice("No role model changes were needed.");
      }
    }
  }
  getEmbeddingDetectionSummary() {
    return this.embeddingDetectionSummary;
  }
  getEmbeddingModelOptions() {
    return this.embeddingDetectionOptions;
  }
  async openLocalQaWorkspaceView() {
    let leaf = this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) {
        this.notice("Could not open right-side chat pane.");
        return;
      }
      leaf = rightLeaf;
      await leaf.setViewState({
        type: LOCAL_QA_VIEW_TYPE,
        active: true
      });
    }
    this.app.workspace.revealLeaf(leaf);
  }
  getSelectedFilesForQa() {
    return this.getSelectedFiles();
  }
  getSelectedFolderPathsForQa() {
    return [...this.settings.targetFolderPaths];
  }
  getQaModelOverrideForQa() {
    return this.settings.qaOllamaModel.trim();
  }
  getQaRolePresetForQa() {
    return this.settings.qaRolePreset;
  }
  getQaPipelinePresetForQa() {
    return this.settings.qaPipelinePreset;
  }
  getQaRolePresetOptionsForQa() {
    return QA_ROLE_PRESET_OPTIONS;
  }
  getQaPipelinePresetOptionsForQa() {
    return QA_PIPELINE_PRESET_OPTIONS;
  }
  getQaModelLabelForQa(role) {
    const resolvedRole = role != null ? role : this.resolveQaPrimaryRole();
    return this.resolveQaModelForRole(resolvedRole) || "(not set)";
  }
  getQaEmbeddingModelForQa() {
    return this.settings.semanticOllamaModel.trim();
  }
  getQaRoleModelSummaryForQa() {
    const entries = [
      { role: "ask", short: "ask" },
      { role: "ask_vision", short: "vision" },
      { role: "orchestrator", short: "orch" },
      { role: "architect", short: "arch" },
      { role: "coder", short: "coder" },
      { role: "debugger", short: "debug" },
      { role: "safeguard", short: "safe" }
    ];
    return entries.map((entry) => {
      const model = this.getQaModelLabelForQa(entry.role);
      const status = isOllamaModelAllowedForQaRole(entry.role, model) ? "" : "(\uBD88\uAC00)";
      return `${entry.short}=${model}${status}`;
    }).join(", ");
  }
  getQaRoleSystemPromptForQa(role) {
    switch (role) {
      case "ask":
        return this.settings.qaAskSystemPrompt;
      case "ask_vision":
        return this.settings.qaAskVisionSystemPrompt;
      case "image_generator":
        return this.settings.qaImageGeneratorSystemPrompt;
      case "coder":
        return this.settings.qaCoderSystemPrompt;
      case "debugger":
        return this.settings.qaDebuggerSystemPrompt;
      case "architect":
        return this.settings.qaArchitectSystemPrompt;
      case "orchestrator":
        return this.settings.qaOrchestratorSystemPrompt;
      case "safeguard":
        return this.settings.qaSafeguardSystemPrompt;
      default:
        return "";
    }
  }
  async setQaRoleSystemPromptForQa(role, prompt) {
    const value = prompt.trim();
    switch (role) {
      case "ask":
        this.settings.qaAskSystemPrompt = value;
        break;
      case "ask_vision":
        this.settings.qaAskVisionSystemPrompt = value;
        break;
      case "image_generator":
        this.settings.qaImageGeneratorSystemPrompt = value;
        break;
      case "coder":
        this.settings.qaCoderSystemPrompt = value;
        break;
      case "debugger":
        this.settings.qaDebuggerSystemPrompt = value;
        break;
      case "architect":
        this.settings.qaArchitectSystemPrompt = value;
        break;
      case "orchestrator":
        this.settings.qaOrchestratorSystemPrompt = value;
        break;
      case "safeguard":
        this.settings.qaSafeguardSystemPrompt = value;
        break;
      default:
        break;
    }
    await this.saveSettings();
  }
  getQaModelOptionsForQa() {
    const models = this.ollamaDetectionOptions.map((option) => option.model).filter((model) => isOllamaModelAnalyzable(model));
    const deduped = [...new Set(models)];
    const current = this.settings.qaOllamaModel.trim();
    if (current && !deduped.includes(current)) {
      deduped.unshift(current);
    }
    return deduped;
  }
  async setQaModelOverrideForQa(modelOverride) {
    this.settings.qaOllamaModel = modelOverride.trim();
    await this.saveSettings();
  }
  async setQaRolePresetForQa(rolePreset) {
    this.settings.qaRolePreset = rolePreset;
    await this.saveSettings();
  }
  async setQaPipelinePresetForQa(pipelinePreset) {
    this.settings.qaPipelinePreset = pipelinePreset;
    await this.saveSettings();
  }
  async openSelectionForQa() {
    await this.openSelectionModal();
  }
  async openCleanupKeyPickerForQa() {
    await this.openCleanupKeyPicker();
  }
  async runCleanupForQa(dryRun) {
    await this.runPropertyCleanup(dryRun);
  }
  getChatTranscriptRootPathForQa() {
    return this.settings.chatTranscriptRootPath.trim();
  }
  isQaThreadAutoSyncEnabledForQa() {
    return this.settings.qaThreadAutoSyncEnabled;
  }
  isSafeVaultRelativePath(path) {
    const normalized = (0, import_obsidian4.normalizePath)(path.trim());
    if (!normalized) {
      return false;
    }
    if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
      return false;
    }
    const segments = normalized.split("/");
    if (segments.some((segment) => segment === "..")) {
      return false;
    }
    return true;
  }
  resolveSafeFolderPath(rawPath, fallback, label) {
    const normalized = (0, import_obsidian4.normalizePath)(rawPath.trim() || fallback);
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} path must be a safe vault-relative folder path.`);
    }
    return normalized;
  }
  async setChatTranscriptRootPathForQa(path) {
    const next = this.resolveSafeFolderPath(path, "Auto Link Chats", "Chat transcript");
    this.settings.chatTranscriptRootPath = next;
    await this.saveSettings();
  }
  async setBackupRootPathForQa(path) {
    const next = this.resolveSafeFolderPath(path, "Auto Link Backups", "Backup root");
    this.settings.backupRootPath = next;
    await this.saveSettings();
  }
  async setMocPathForQa(path) {
    const raw = path.trim() || "MOC/Selected Knowledge MOC.md";
    const next = this.resolveSafeMarkdownPath(raw, "MOC");
    this.settings.mocPath = next;
    await this.saveSettings();
  }
  escapeYamlValue(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  collectTopSourcePaths(messages, maxItems) {
    const bestByPath = /* @__PURE__ */ new Map();
    for (const message of messages) {
      if (message.role !== "assistant" || !message.sources) {
        continue;
      }
      for (const source of message.sources) {
        const prev = bestByPath.get(source.path);
        if (prev === void 0 || source.similarity > prev) {
          bestByPath.set(source.path, source.similarity);
        }
      }
    }
    return [...bestByPath.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, Math.max(1, maxItems)).map(([path]) => path);
  }
  normalizeThreadId(rawThreadId, fallbackDate) {
    const fallback = `chat-${formatBackupStamp(fallbackDate)}`;
    const trimmed = (rawThreadId != null ? rawThreadId : "").trim();
    if (!trimmed) {
      return fallback;
    }
    const normalized = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
    return normalized || fallback;
  }
  resolveSafeMarkdownPath(rawPath, label) {
    const normalized = (0, import_obsidian4.normalizePath)(rawPath.trim());
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} path must be a safe vault-relative markdown path.`);
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      throw new Error(`${label} path must end with .md`);
    }
    return normalized;
  }
  async allocateLocalQaThreadPath(threadId) {
    const folder = this.resolveSafeFolderPath(
      this.settings.chatTranscriptRootPath,
      "Auto Link Chats",
      "Chat transcript"
    );
    let outputPath = (0, import_obsidian4.normalizePath)(`${folder}/${threadId}.md`);
    let suffix = 1;
    while (await this.app.vault.adapter.exists(outputPath)) {
      outputPath = (0, import_obsidian4.normalizePath)(`${folder}/${threadId}-${suffix}.md`);
      suffix += 1;
    }
    return outputPath;
  }
  buildLocalQaTranscriptMarkdown(params) {
    const { messages, threadId, createdAt, updatedAt } = params;
    const qaModel = this.getQaModelLabelForQa();
    const embeddingModel = this.getQaEmbeddingModelForQa();
    const selectedFiles = this.getSelectedFilesForQa().map((file) => file.path);
    const selectedFolders = this.getSelectedFolderPathsForQa().sort(
      (a, b) => a.localeCompare(b)
    );
    const topSourcePaths = this.collectTopSourcePaths(
      messages,
      Math.max(1, this.settings.qaTopK)
    );
    const turns = messages.filter(
      (item) => item.role === "user" || item.role === "assistant"
    );
    const lines = [];
    lines.push("---");
    lines.push('type: "auto-linker-chat"');
    lines.push(`thread_id: "${this.escapeYamlValue(threadId)}"`);
    lines.push(`created: "${createdAt}"`);
    lines.push(`updated: "${updatedAt}"`);
    lines.push(`provider: "${this.escapeYamlValue(this.settings.provider)}"`);
    lines.push(`qa_model: "${this.escapeYamlValue(qaModel)}"`);
    lines.push(`embedding_model: "${this.escapeYamlValue(embeddingModel || "(not set)")}"`);
    lines.push(`turn_count: ${turns.length}`);
    lines.push(`scope_total_files: ${selectedFiles.length}`);
    lines.push(`scope_total_folders: ${selectedFolders.length}`);
    lines.push("scope_files:");
    if (topSourcePaths.length === 0) {
      lines.push('  - "(none)"');
    } else {
      for (const path of topSourcePaths) {
        lines.push(`  - "${this.escapeYamlValue(path)}"`);
      }
    }
    lines.push("---");
    lines.push("");
    lines.push("# Local AI Chat Transcript");
    lines.push("");
    for (const message of messages) {
      if (message.role === "system") {
        lines.push(`> [System ${message.timestamp}] ${message.text}`);
        lines.push("");
        continue;
      }
      const label = message.role === "assistant" ? "Assistant" : message.role === "thinking" ? "Thinking" : "User";
      lines.push(`## ${label} (${message.timestamp})`);
      lines.push(message.text);
      if (message.role === "assistant" && message.sources && message.sources.length > 0) {
        lines.push("");
        lines.push("Sources:");
        for (const source of message.sources) {
          lines.push(`- [[${source.path}]] (${formatSimilarity(source.similarity)})`);
        }
      }
      lines.push("");
    }
    return `${lines.join("\n").trim()}
`;
  }
  async syncLocalQaTranscript(input) {
    const now = /* @__PURE__ */ new Date();
    const updatedAt = now.toISOString();
    const createdDate = input.createdAt ? new Date(input.createdAt) : now;
    const createdAt = Number.isNaN(createdDate.getTime()) ? updatedAt : createdDate.toISOString();
    const threadId = this.normalizeThreadId(input.threadId, new Date(createdAt));
    const outputPath = input.threadPath ? this.resolveSafeMarkdownPath(input.threadPath, "Chat thread") : await this.allocateLocalQaThreadPath(threadId);
    const markdown = this.buildLocalQaTranscriptMarkdown({
      messages: input.messages,
      threadId,
      createdAt,
      updatedAt
    });
    await this.ensureParentFolder(outputPath);
    await this.app.vault.adapter.write(outputPath, markdown);
    return {
      path: outputPath,
      threadId,
      createdAt,
      updatedAt
    };
  }
  async saveLocalQaTranscript(messages) {
    const now = /* @__PURE__ */ new Date();
    const synced = await this.syncLocalQaTranscript({
      messages,
      threadId: `chat-${formatBackupStamp(now)}`,
      createdAt: now.toISOString()
    });
    return synced.path;
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
      if (options.autoApply && this.settings.qaRoleModelAutoPickEnabled) {
        await this.applyRecommendedRoleModelsForQa(false, false);
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
    try {
      this.settings.backupRootPath = this.resolveSafeFolderPath(
        this.settings.backupRootPath,
        DEFAULT_SETTINGS.backupRootPath,
        "Backup root"
      );
    } catch (e) {
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
    if (typeof this.settings.analysisOnlyChangedNotes !== "boolean") {
      this.settings.analysisOnlyChangedNotes = DEFAULT_SETTINGS.analysisOnlyChangedNotes;
    }
    if (typeof this.settings.forceAllToAllLinkedEnabled !== "boolean") {
      this.settings.forceAllToAllLinkedEnabled = DEFAULT_SETTINGS.forceAllToAllLinkedEnabled;
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
    if (typeof this.settings.qaPreferChatApi !== "boolean") {
      this.settings.qaPreferChatApi = DEFAULT_SETTINGS.qaPreferChatApi;
    }
    if (typeof this.settings.qaStructureGuardEnabled !== "boolean") {
      this.settings.qaStructureGuardEnabled = DEFAULT_SETTINGS.qaStructureGuardEnabled;
    }
    if (typeof this.settings.qaAlwaysDetailedAnswer !== "boolean") {
      this.settings.qaAlwaysDetailedAnswer = DEFAULT_SETTINGS.qaAlwaysDetailedAnswer;
    }
    if (!Number.isFinite(this.settings.qaMinAnswerChars)) {
      this.settings.qaMinAnswerChars = DEFAULT_SETTINGS.qaMinAnswerChars;
    }
    if (this.settings.qaPreferredResponseLanguage !== "auto" && this.settings.qaPreferredResponseLanguage !== "korean" && this.settings.qaPreferredResponseLanguage !== "english") {
      this.settings.qaPreferredResponseLanguage = DEFAULT_SETTINGS.qaPreferredResponseLanguage;
    }
    if (typeof this.settings.qaCustomSystemPrompt !== "string") {
      this.settings.qaCustomSystemPrompt = DEFAULT_SETTINGS.qaCustomSystemPrompt;
    }
    const rolePresetValid = QA_ROLE_PRESET_OPTIONS.some(
      (option) => option.value === this.settings.qaRolePreset
    );
    if (!rolePresetValid) {
      this.settings.qaRolePreset = DEFAULT_SETTINGS.qaRolePreset;
    }
    const pipelinePresetValid = QA_PIPELINE_PRESET_OPTIONS.some(
      (option) => option.value === this.settings.qaPipelinePreset
    );
    if (!pipelinePresetValid) {
      this.settings.qaPipelinePreset = DEFAULT_SETTINGS.qaPipelinePreset;
    }
    if (typeof this.settings.qaAskModel !== "string") {
      this.settings.qaAskModel = DEFAULT_SETTINGS.qaAskModel;
    }
    if (typeof this.settings.qaAskVisionModel !== "string") {
      this.settings.qaAskVisionModel = DEFAULT_SETTINGS.qaAskVisionModel;
    }
    if (typeof this.settings.qaImageGeneratorModel !== "string") {
      this.settings.qaImageGeneratorModel = DEFAULT_SETTINGS.qaImageGeneratorModel;
    }
    if (typeof this.settings.qaCoderModel !== "string") {
      this.settings.qaCoderModel = DEFAULT_SETTINGS.qaCoderModel;
    }
    if (typeof this.settings.qaArchitectModel !== "string") {
      this.settings.qaArchitectModel = DEFAULT_SETTINGS.qaArchitectModel;
    }
    if (typeof this.settings.qaOrchestratorModel !== "string") {
      this.settings.qaOrchestratorModel = DEFAULT_SETTINGS.qaOrchestratorModel;
    }
    if (typeof this.settings.qaSafeguardModel !== "string") {
      this.settings.qaSafeguardModel = DEFAULT_SETTINGS.qaSafeguardModel;
    }
    if (typeof this.settings.qaAskSystemPrompt !== "string") {
      this.settings.qaAskSystemPrompt = DEFAULT_SETTINGS.qaAskSystemPrompt;
    }
    if (typeof this.settings.qaAskVisionSystemPrompt !== "string") {
      this.settings.qaAskVisionSystemPrompt = DEFAULT_SETTINGS.qaAskVisionSystemPrompt;
    }
    if (typeof this.settings.qaImageGeneratorSystemPrompt !== "string") {
      this.settings.qaImageGeneratorSystemPrompt = DEFAULT_SETTINGS.qaImageGeneratorSystemPrompt;
    }
    if (typeof this.settings.qaCoderSystemPrompt !== "string") {
      this.settings.qaCoderSystemPrompt = DEFAULT_SETTINGS.qaCoderSystemPrompt;
    }
    if (typeof this.settings.qaDebuggerSystemPrompt !== "string") {
      this.settings.qaDebuggerSystemPrompt = DEFAULT_SETTINGS.qaDebuggerSystemPrompt;
    }
    if (typeof this.settings.qaArchitectSystemPrompt !== "string") {
      this.settings.qaArchitectSystemPrompt = DEFAULT_SETTINGS.qaArchitectSystemPrompt;
    }
    if (typeof this.settings.qaOrchestratorSystemPrompt !== "string") {
      this.settings.qaOrchestratorSystemPrompt = DEFAULT_SETTINGS.qaOrchestratorSystemPrompt;
    }
    if (typeof this.settings.qaSafeguardSystemPrompt !== "string") {
      this.settings.qaSafeguardSystemPrompt = DEFAULT_SETTINGS.qaSafeguardSystemPrompt;
    }
    if (typeof this.settings.qaRoleModelAutoPickEnabled !== "boolean") {
      this.settings.qaRoleModelAutoPickEnabled = DEFAULT_SETTINGS.qaRoleModelAutoPickEnabled;
    }
    if (typeof this.settings.qaOrchestratorEnabled !== "boolean") {
      this.settings.qaOrchestratorEnabled = DEFAULT_SETTINGS.qaOrchestratorEnabled;
    }
    if (typeof this.settings.qaSafeguardPassEnabled !== "boolean") {
      this.settings.qaSafeguardPassEnabled = DEFAULT_SETTINGS.qaSafeguardPassEnabled;
    }
    if (typeof this.settings.qaIncludeSelectionInventory !== "boolean") {
      this.settings.qaIncludeSelectionInventory = DEFAULT_SETTINGS.qaIncludeSelectionInventory;
    }
    if (!Number.isFinite(this.settings.qaSelectionInventoryMaxFiles)) {
      this.settings.qaSelectionInventoryMaxFiles = DEFAULT_SETTINGS.qaSelectionInventoryMaxFiles;
    }
    if (typeof this.settings.qaThreadAutoSyncEnabled !== "boolean") {
      this.settings.qaThreadAutoSyncEnabled = DEFAULT_SETTINGS.qaThreadAutoSyncEnabled;
    }
    if (typeof this.settings.autoTagActiveNoteEnabled !== "boolean") {
      this.settings.autoTagActiveNoteEnabled = DEFAULT_SETTINGS.autoTagActiveNoteEnabled;
    }
    if (!Number.isFinite(this.settings.autoTagActiveNoteCooldownSec)) {
      this.settings.autoTagActiveNoteCooldownSec = DEFAULT_SETTINGS.autoTagActiveNoteCooldownSec;
    }
    if (typeof this.settings.watchNewNotesEnabled !== "boolean") {
      this.settings.watchNewNotesEnabled = DEFAULT_SETTINGS.watchNewNotesEnabled;
    }
    if (typeof this.settings.watchNewNotesFolders !== "string") {
      this.settings.watchNewNotesFolders = DEFAULT_SETTINGS.watchNewNotesFolders;
    }
    if (typeof this.settings.chatTranscriptRootPath !== "string") {
      this.settings.chatTranscriptRootPath = DEFAULT_SETTINGS.chatTranscriptRootPath;
    }
    if (!this.settings.chatTranscriptRootPath.trim()) {
      this.settings.chatTranscriptRootPath = DEFAULT_SETTINGS.chatTranscriptRootPath;
    }
    if (typeof this.settings.cleanupReportRootPath !== "string") {
      this.settings.cleanupReportRootPath = DEFAULT_SETTINGS.cleanupReportRootPath;
    }
    if (!this.settings.cleanupReportRootPath.trim()) {
      this.settings.cleanupReportRootPath = DEFAULT_SETTINGS.cleanupReportRootPath;
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
    if (typeof this.settings.mocPath !== "string" || !this.settings.mocPath.trim()) {
      this.settings.mocPath = DEFAULT_SETTINGS.mocPath;
    }
    try {
      this.settings.mocPath = this.resolveSafeMarkdownPath(this.settings.mocPath, "MOC");
    } catch (e) {
      this.settings.mocPath = DEFAULT_SETTINGS.mocPath;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  setStatus(text) {
    var _a;
    (_a = this.statusBarEl) == null ? void 0 : _a.setText(`Auto Link: ${text}`);
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
  readRawFrontmatterTags(frontmatter) {
    const value = frontmatter.tags;
    if (Array.isArray(value)) {
      return value.map((item) => typeof item === "string" ? item.trim() : "").filter((item) => item.length > 0);
    }
    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
    }
    return [];
  }
  parseModelSizeB(modelName) {
    const lower = modelName.toLowerCase();
    const explicit = lower.match(/(\d+(?:\.\d+)?)\s*b\b/);
    if (explicit) {
      const size = Number.parseFloat(explicit[1]);
      if (Number.isFinite(size) && size > 0) {
        return size;
      }
    }
    const tag = lower.match(/:(\d+(?:\.\d+)?)(?:b|g)?$/);
    if (tag) {
      const size = Number.parseFloat(tag[1]);
      if (Number.isFinite(size) && size > 0) {
        return size;
      }
    }
    return null;
  }
  estimateRecommendedSelectionMax(modelName) {
    const sizeB = this.parseModelSizeB(modelName);
    let maxByModel = 120;
    if (sizeB !== null) {
      if (sizeB < 2) {
        maxByModel = 40;
      } else if (sizeB < 5) {
        maxByModel = 70;
      } else if (sizeB < 9) {
        maxByModel = 120;
      } else if (sizeB < 15) {
        maxByModel = 180;
      } else if (sizeB < 30) {
        maxByModel = 260;
      } else {
        maxByModel = 360;
      }
    }
    if (!this.settings.semanticLinkingEnabled || !this.settings.analyzeLinked) {
      maxByModel = Math.max(30, Math.floor(maxByModel * 0.7));
    }
    return maxByModel;
  }
  getAnalysisCachePath() {
    return (0, import_obsidian4.normalizePath)(
      `${this.app.vault.configDir}/plugins/auto-linker/${ANALYSIS_CACHE_FILE}`
    );
  }
  async cleanupLegacyCacheArtifacts() {
    const legacyFiles = [
      (0, import_obsidian4.normalizePath)("Auto-Linker Cache/analysis-proposal-cache.json"),
      (0, import_obsidian4.normalizePath)("Auto-Linker Cache/semantic-embedding-cache.json")
    ];
    for (const path of legacyFiles) {
      try {
        if (await this.app.vault.adapter.exists(path)) {
          await this.app.vault.adapter.remove(path);
        }
      } catch (e) {
      }
    }
    const legacyFolder = (0, import_obsidian4.normalizePath)("Auto-Linker Cache");
    try {
      if (!await this.app.vault.adapter.exists(legacyFolder)) {
        return;
      }
      const listing = await this.app.vault.adapter.list(legacyFolder);
      if (listing.files.length === 0 && listing.folders.length === 0) {
        await this.app.vault.adapter.rmdir(legacyFolder, false);
      }
    } catch (e) {
    }
  }
  getProviderCacheSignature() {
    const modelLabel = getProviderModelLabel(this.settings);
    switch (this.settings.provider) {
      case "ollama":
        return `ollama::${this.settings.ollamaBaseUrl.trim()}::${modelLabel}`;
      case "lmstudio":
        return `lmstudio::${this.settings.lmStudioBaseUrl.trim()}::${modelLabel}`;
      case "openai":
        return `openai::${this.settings.openAIBaseUrl.trim()}::${modelLabel}`;
      case "anthropic":
        return `anthropic::${modelLabel}`;
      case "gemini":
        return `gemini::${modelLabel}`;
      default:
        return `${this.settings.provider}::${modelLabel}`;
    }
  }
  hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  buildAnalysisCacheKey(providerSignature, filePath) {
    return `${providerSignature}::${filePath}`;
  }
  buildAnalysisRequestSignature(providerSignature, request) {
    const payload = JSON.stringify({
      providerSignature,
      sourcePath: request.sourcePath,
      candidateLinkPaths: request.candidateLinkPaths,
      maxTags: request.maxTags,
      maxLinked: request.maxLinked,
      analyzeTags: request.analyzeTags,
      analyzeTopic: request.analyzeTopic,
      analyzeLinked: request.analyzeLinked,
      analyzeIndex: request.analyzeIndex,
      includeReasons: request.includeReasons
    });
    return this.hashString(payload);
  }
  buildAnalysisSettingsSignature(providerSignature) {
    const payload = JSON.stringify({
      providerSignature,
      maxTags: this.settings.maxTags,
      maxLinked: this.settings.maxLinked,
      analyzeTags: this.settings.analyzeTags,
      analyzeTopic: this.settings.analyzeTopic,
      analyzeLinked: this.settings.analyzeLinked,
      analyzeIndex: this.settings.analyzeIndex,
      includeReasons: this.settings.includeReasons,
      semanticLinkingEnabled: this.settings.semanticLinkingEnabled,
      semanticTopK: this.settings.semanticTopK,
      semanticMinSimilarity: this.settings.semanticMinSimilarity,
      semanticMaxChars: this.settings.semanticMaxChars
    });
    return this.hashString(payload);
  }
  buildSelectionSignature(selectedFiles) {
    const payload = JSON.stringify(selectedFiles.map((file) => file.path));
    return this.hashString(payload);
  }
  canSkipByChangedOnlyMode(cache, cacheKey, file, settingsSignature, selectionSignature) {
    const entry = cache.entries[cacheKey];
    if (!entry) {
      return false;
    }
    if (entry.mtime !== file.stat.mtime || entry.size !== file.stat.size) {
      return false;
    }
    if (entry.settingsSignature !== settingsSignature) {
      return false;
    }
    if (entry.selectionSignature !== selectionSignature) {
      return false;
    }
    return true;
  }
  async loadAnalysisCache() {
    if (this.analysisCache) {
      return this.analysisCache;
    }
    const path = this.getAnalysisCachePath();
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      this.analysisCache = {
        version: ANALYSIS_CACHE_VERSION,
        entries: {}
      };
      this.analysisCacheDirty = false;
      return this.analysisCache;
    }
    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw);
      const version = typeof parsed.version === "number" ? parsed.version : ANALYSIS_CACHE_VERSION;
      const entries = parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {};
      if (version !== ANALYSIS_CACHE_VERSION) {
        this.analysisCache = {
          version: ANALYSIS_CACHE_VERSION,
          entries: {}
        };
      } else {
        this.analysisCache = {
          version,
          entries
        };
      }
      this.analysisCacheDirty = false;
      return this.analysisCache;
    } catch (e) {
      this.analysisCache = {
        version: ANALYSIS_CACHE_VERSION,
        entries: {}
      };
      this.analysisCacheDirty = false;
      return this.analysisCache;
    }
  }
  pruneAnalysisCache(cache) {
    const entries = Object.entries(cache.entries);
    if (entries.length <= ANALYSIS_CACHE_MAX_ENTRIES) {
      return;
    }
    entries.sort((a, b) => {
      var _a, _b, _c, _d;
      const aTime = Date.parse((_b = (_a = a[1]) == null ? void 0 : _a.updatedAt) != null ? _b : "") || 0;
      const bTime = Date.parse((_d = (_c = b[1]) == null ? void 0 : _c.updatedAt) != null ? _d : "") || 0;
      return aTime - bTime || a[0].localeCompare(b[0]);
    });
    const overflow = entries.length - ANALYSIS_CACHE_MAX_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
      delete cache.entries[entries[i][0]];
    }
  }
  async flushAnalysisCache() {
    if (!this.analysisCache || !this.analysisCacheDirty) {
      return;
    }
    this.pruneAnalysisCache(this.analysisCache);
    const path = this.getAnalysisCachePath();
    await this.ensureParentFolder(path);
    await this.app.vault.adapter.write(path, JSON.stringify(this.analysisCache));
    this.analysisCacheDirty = false;
  }
  getCachedAnalysisOutcome(cache, cacheKey, requestSignature, file, settingsSignature, selectionSignature) {
    const entry = cache.entries[cacheKey];
    if (!entry || entry.requestSignature !== requestSignature || entry.mtime !== file.stat.mtime || entry.size !== file.stat.size) {
      return null;
    }
    if (entry.settingsSignature !== settingsSignature || entry.selectionSignature !== selectionSignature) {
      entry.settingsSignature = settingsSignature;
      entry.selectionSignature = selectionSignature;
      entry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.analysisCacheDirty = true;
    }
    return {
      proposal: cloneMetadataProposal(entry.proposal),
      meta: {
        ...cloneSuggestionMeta(entry.meta),
        elapsedMs: 0
      }
    };
  }
  storeAnalysisOutcome(cache, cacheKey, requestSignature, settingsSignature, selectionSignature, file, outcome) {
    cache.entries[cacheKey] = {
      requestSignature,
      settingsSignature,
      selectionSignature,
      mtime: file.stat.mtime,
      size: file.stat.size,
      proposal: cloneMetadataProposal(outcome.proposal),
      meta: cloneSuggestionMeta(outcome.meta),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.analysisCacheDirty = true;
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
    return this.resolveQaModelForRole(this.resolveQaPrimaryRole());
  }
  trimTextForContext(source, maxChars) {
    const collapsed = source.replace(/\s+/g, " ").trim();
    return collapsed.slice(0, Math.max(400, maxChars));
  }
  isAbortError(error) {
    if (!error) {
      return false;
    }
    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
      return error.name === "AbortError";
    }
    if (error instanceof Error) {
      return error.name === "AbortError" || /aborted|abort/i.test(error.message);
    }
    return false;
  }
  emitQaEvent(onEvent, stage, message, options = {}) {
    if (!onEvent) {
      return;
    }
    onEvent({
      stage,
      message,
      detail: options.detail,
      thinkingChunk: options.thinkingChunk,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  tokenizeQuery(text) {
    return [...new Set(
      text.toLowerCase().split(/[\s,.;:!?()[\]{}"'<>\\/|`~!@#$%^&*+=_-]+/).map((token) => token.trim()).filter((token) => token.length >= 2)
    )];
  }
  countTermMatches(text, terms) {
    if (terms.length === 0) {
      return 0;
    }
    let matched = 0;
    for (const term of terms) {
      if (text.includes(term)) {
        matched += 1;
      }
    }
    return matched;
  }
  detectLocalQaIntent(question) {
    const normalized = question.toLowerCase();
    if (/(출처|근거|source|sources|reference|references|링크만|links?\s+only|only\s+links|cite)/i.test(normalized)) {
      return "sources_only";
    }
    if (/(비교|차이|장단점|vs\b|versus|compare|comparison|trade[- ]?off|선택지)/i.test(normalized)) {
      return "comparison";
    }
    if (/(계획|플랜|로드맵|체크리스트|준비|실행|우선순위|plan|roadmap|checklist|todo|action\s+plan)/i.test(normalized)) {
      return "plan";
    }
    return "default";
  }
  resolveQaRetrievalCandidateK(intent, topK) {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(topK * 8, 28);
    }
    if (intent === "sources_only") {
      return Math.max(topK * 5, 24);
    }
    return Math.max(topK * 6, 24);
  }
  resolveQaRerankTopK(intent, topK) {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(topK * 3, topK + 4);
    }
    if (intent === "sources_only") {
      return Math.max(topK * 2, 6);
    }
    return Math.max(topK * 2, topK);
  }
  resolveQaContextCharLimit(intent) {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(3200, this.settings.qaMaxContextChars);
    }
    if (intent === "sources_only") {
      return Math.max(2200, this.settings.qaMaxContextChars);
    }
    return Math.max(2e3, this.settings.qaMaxContextChars);
  }
  rerankQaHits(hits, question, topK) {
    const terms = this.tokenizeQuery(question);
    const scored = hits.map((hit) => {
      if (terms.length === 0) {
        return { ...hit, boosted: hit.similarity };
      }
      const lowerPath = hit.path.toLowerCase();
      const matched = this.countTermMatches(lowerPath, terms);
      const boost = Math.min(0.09, matched * 0.03);
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
  splitSourceIntoContextBlocks(source) {
    const normalized = source.replace(/\r\n/g, "\n");
    const rawBlocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter((block) => block.length > 0);
    const mergedBlocks = [];
    for (let i = 0; i < rawBlocks.length; i += 1) {
      let segment = rawBlocks[i];
      if (/^#{1,6}\s/.test(segment) && i + 1 < rawBlocks.length && !/^#{1,6}\s/.test(rawBlocks[i + 1])) {
        segment = `${segment}
${rawBlocks[i + 1]}`;
        i += 1;
      }
      if (segment.length <= 1700) {
        mergedBlocks.push(segment);
        continue;
      }
      const lines = segment.split("\n");
      let chunk = "";
      for (const line of lines) {
        const candidate = chunk ? `${chunk}
${line}` : line;
        if (candidate.length > 1200 && chunk.length > 0) {
          mergedBlocks.push(chunk.trim());
          chunk = line;
        } else {
          chunk = candidate;
        }
      }
      if (chunk.trim().length > 0) {
        mergedBlocks.push(chunk.trim());
      }
    }
    return mergedBlocks.map((text, index) => ({
      index,
      text,
      lower: text.toLowerCase(),
      heading: /^#{1,6}\s/.test(text)
    }));
  }
  extractRelevantSnippet(source, query, maxChars) {
    const terms = this.tokenizeQuery(query);
    const blocks = this.splitSourceIntoContextBlocks(source);
    if (terms.length === 0 || blocks.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }
    const queryLower = query.trim().toLowerCase();
    const scored = blocks.map((block) => {
      let score = this.countTermMatches(block.lower, terms);
      if (block.heading) {
        score += 0.35;
      }
      if (queryLower.length >= 8 && block.lower.includes(queryLower.slice(0, 64))) {
        score += 0.6;
      }
      return { idx: block.index, score };
    }).filter((item) => item.score > 0);
    if (scored.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    const pickedIndexes = /* @__PURE__ */ new Set();
    for (const item of scored.slice(0, 10)) {
      pickedIndexes.add(item.idx);
      if (item.score >= 2.2 && item.idx > 0) {
        pickedIndexes.add(item.idx - 1);
      }
      if (item.score >= 2.2 && item.idx + 1 < blocks.length) {
        pickedIndexes.add(item.idx + 1);
      }
    }
    const ordered = [...pickedIndexes].sort((a, b) => a - b);
    let output = "";
    for (const idx of ordered) {
      const block = blocks[idx];
      if (!block || !block.text.trim()) {
        continue;
      }
      const segment = block.text.trimEnd();
      const candidate = output.length > 0 ? `${output}

---

${segment}` : segment;
      if (candidate.length > maxChars) {
        break;
      }
      output = candidate;
    }
    if (!output) {
      return this.trimTextForContext(source, maxChars);
    }
    return output;
  }
  hasMarkdownTable(answer) {
    const lines = answer.split("\n");
    for (let i = 0; i < lines.length - 1; i += 1) {
      const head = lines[i];
      const divider = lines[i + 1];
      if (!head.includes("|")) {
        continue;
      }
      if (/^\s*\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?\s*$/.test(divider.trim())) {
        return true;
      }
    }
    return false;
  }
  hasChecklist(answer) {
    return /^\s*[-*]\s+\[[ xX]\]\s+/m.test(answer);
  }
  hasSourceLinkList(answer) {
    var _a;
    const matches = answer.match(
      /^\s*[-*]\s+.*(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/gm
    );
    return ((_a = matches == null ? void 0 : matches.length) != null ? _a : 0) > 0;
  }
  needsQaStructureRepair(intent, answer) {
    if (intent === "comparison") {
      return !this.hasMarkdownTable(answer);
    }
    if (intent === "plan") {
      return !this.hasChecklist(answer);
    }
    if (intent === "sources_only") {
      return !this.hasSourceLinkList(answer);
    }
    return false;
  }
  shouldPreferDetailedAnswer(question, intent) {
    const normalized = question.toLowerCase();
    if (/(짧게|간단히|한줄|brief|short|tl;dr|요약만)/i.test(normalized)) {
      return false;
    }
    if (intent === "sources_only") {
      return false;
    }
    if (this.settings.qaAlwaysDetailedAnswer) {
      return true;
    }
    if (intent === "comparison" || intent === "plan") {
      return true;
    }
    return normalized.length >= 18;
  }
  needsQaDepthRepair(intent, answer, preferDetailed) {
    var _a;
    if (!preferDetailed || intent === "sources_only") {
      return false;
    }
    const compact = answer.replace(/\s+/g, " ").trim();
    if (!compact) {
      return true;
    }
    const paragraphCount = answer.split(/\n{2,}/).map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0).length;
    const bulletCount = ((_a = answer.match(/^\s*[-*]\s+/gm)) != null ? _a : []).length;
    const minChars = Math.max(140, this.settings.qaMinAnswerChars);
    if (compact.length < minChars) {
      return true;
    }
    if (paragraphCount < 2 && bulletCount < 4) {
      return true;
    }
    return false;
  }
  getQaContractLines(intent, preferDetailed) {
    if (intent === "comparison") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence conclusion.",
        "- Include at least one markdown table for comparison.",
        "- After the table, add key trade-offs and recommendation.",
        "- If information is missing, fill with '\uC815\uBCF4 \uBD80\uC871' and explain briefly."
      ];
    }
    if (intent === "plan") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence overview.",
        "- Include a checklist using '- [ ]' format.",
        "- Add priority or order hints for each checklist item.",
        "- Add short rationale for critical steps and risks."
      ];
    }
    if (intent === "sources_only") {
      return [
        "Output contract:",
        "- Return source links only (bullet list).",
        "- No extra narrative unless required for missing evidence."
      ];
    }
    if (preferDetailed) {
      return [
        "Output contract:",
        "- Start with a direct answer in 2-4 sentences.",
        "- Then provide detailed explanation with either:",
        "  a) 2+ short paragraphs, or",
        "  b) 1 short paragraph + 4+ bullet points.",
        "- Use short section headings when it improves readability.",
        "- Include practical implications or next actions when relevant.",
        "- Avoid one-line answers unless user explicitly asks for brevity."
      ];
    }
    return [
      "Output contract:",
      "- Start with a direct answer in 1-3 sentences.",
      "- Add concise synthesis only when useful."
    ];
  }
  buildLocalQaSourceContext(sourceBlocks) {
    return sourceBlocks.map(
      (item, index) => `Source ${index + 1}
Path: ${item.path}
Similarity: ${formatSimilarity(item.similarity)}
Content:
${item.content}`
    ).join("\n\n---\n\n");
  }
  shouldIncludeSelectionInventory(question, selectedCount, intent) {
    if (!this.settings.qaIncludeSelectionInventory) {
      return false;
    }
    if (selectedCount >= 80) {
      return true;
    }
    if (intent === "comparison" || intent === "plan") {
      return true;
    }
    const normalized = question.toLowerCase();
    if (/(전체|모든|파일\s*목록|목록|리스트|요약표|테이블|표로|all\s+files?|file\s+list|inventory|table)/i.test(
      normalized
    )) {
      return true;
    }
    return false;
  }
  buildSelectionInventoryContext(files) {
    var _a, _b;
    const maxFiles = Math.max(20, Math.min(600, this.settings.qaSelectionInventoryMaxFiles));
    const charBudget = Math.max(1800, Math.min(12e3, Math.floor(this.settings.qaMaxContextChars * 0.6)));
    const lines = [];
    lines.push(`Total selected files: ${files.length}`);
    lines.push("Listed files: 0");
    lines.push("");
    let listed = 0;
    for (const file of files.slice(0, maxFiles)) {
      const frontmatter = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
      const tags = this.readRawFrontmatterTags(frontmatter).slice(0, 6).join(", ");
      const topic = typeof frontmatter.topic === "string" ? frontmatter.topic.trim() : "";
      const index = typeof frontmatter.index === "string" ? frontmatter.index.trim() : "";
      const row = `- path=${file.path} | size=${file.stat.size} | mtime=${new Date(file.stat.mtime).toISOString()} | tags=${tags || "(none)"} | topic=${topic || "(none)"} | index=${index || "(none)"}`;
      const nextText = [...lines, row].join("\n");
      if (nextText.length > charBudget) {
        break;
      }
      lines.push(row);
      listed += 1;
    }
    if (files.length > listed) {
      lines.push("");
      lines.push(`...and ${files.length - listed} more selected files not listed.`);
    }
    lines[1] = `Listed files: ${listed}`;
    return lines.join("\n");
  }
  isOrchestrationTask(question, intent) {
    if (intent === "plan" || intent === "comparison") {
      return true;
    }
    const normalized = question.toLowerCase();
    return /(계획서|보고서|ppt|슬라이드|발표|수업|교안|학습\s*게임|게임\s*개발|roadmap|plan|report|presentation|slides|lesson|game\s*design|project\s*plan)/i.test(normalized);
  }
  resolveQaPrimaryRole() {
    return this.settings.qaRolePreset;
  }
  getQaRoleModelOverride(role) {
    switch (role) {
      case "ask":
        return this.settings.qaAskModel;
      case "ask_vision":
        return this.settings.qaAskVisionModel;
      case "image_generator":
        return this.settings.qaImageGeneratorModel;
      case "coder":
      case "debugger":
        return this.settings.qaCoderModel;
      case "architect":
        return this.settings.qaArchitectModel;
      case "orchestrator":
        return this.settings.qaOrchestratorModel;
      case "safeguard":
        return this.settings.qaSafeguardModel;
      default:
        return "";
    }
  }
  resolveQaModelForRole(role) {
    const roleModel = this.getQaRoleModelOverride(role).trim();
    const qa = this.settings.qaOllamaModel.trim();
    const fallback = this.settings.ollamaModel.trim();
    return roleModel || qa || fallback;
  }
  shouldRunOrchestratorPassLegacy(question, intent) {
    if (this.settings.qaRolePreset === "orchestrator") {
      return true;
    }
    if (!this.settings.qaOrchestratorEnabled) {
      return false;
    }
    return this.isOrchestrationTask(question, intent);
  }
  shouldRunSafeguardPassLegacy(question, intent) {
    if (this.settings.qaRolePreset === "safeguard") {
      return true;
    }
    if (this.settings.qaSafeguardPassEnabled) {
      return true;
    }
    const normalized = question.toLowerCase();
    if (intent === "comparison" || intent === "plan") {
      return true;
    }
    return /(보안|security|개인정보|privacy|위험|risk|규정|compliance|정책|safety)/i.test(normalized);
  }
  shouldRunRolePresetRefinementForRole(role) {
    return role === "coder" || role === "architect" || role === "debugger";
  }
  resolveLegacyAutoPipelineStages(question, intent) {
    const stages = [];
    if (this.shouldRunRolePresetRefinementForRole(this.settings.qaRolePreset)) {
      if (this.settings.qaRolePreset === "architect") {
        stages.push("architect");
      } else if (this.settings.qaRolePreset === "debugger") {
        stages.push("debugger");
      } else {
        stages.push("coder");
      }
    }
    if (this.shouldRunOrchestratorPassLegacy(question, intent)) {
      stages.push("orchestrator");
    }
    if (this.shouldRunSafeguardPassLegacy(question, intent)) {
      stages.push("safeguard");
    }
    return [...new Set(stages)];
  }
  resolveOrchestratorAutoRouteStages(question, intent) {
    const stages = ["orchestrator"];
    const normalized = question.toLowerCase();
    const debugSignals = /(버그|오류|에러|예외|실패|고장|재현|원인|로그|debug|bug|error|exception|trace|crash|failure)/i;
    const codingSignals = /(코드|구현|함수|클래스|리팩터|테스트|스크립트|쿼리|api|endpoint|typescript|javascript|python|sql|regex|algorithm|implement|code|refactor|test)/i;
    const architectureSignals = /(아키텍처|설계|구조|시스템|모듈|컴포넌트|인터페이스|확장성|trade[- ]?off|architecture|design|scalability|boundary|topology|pattern)/i;
    const safeguardSignals = /(보안|개인정보|규정|정책|위험|컴플라이언스|security|privacy|compliance|policy|risk|safety)/i;
    const wantsDebug = debugSignals.test(normalized);
    const wantsCoding = codingSignals.test(normalized);
    const wantsArchitecture = architectureSignals.test(normalized) || intent === "plan" || intent === "comparison";
    const wantsSafeguard = safeguardSignals.test(normalized);
    if (wantsArchitecture) {
      stages.push("architect");
    }
    if (wantsDebug) {
      stages.push("debugger");
    } else if (wantsCoding) {
      stages.push("coder");
    }
    if (wantsSafeguard || intent === "plan" || intent === "comparison" || this.settings.qaSafeguardPassEnabled || stages.length === 1) {
      stages.push("safeguard");
    }
    return [...new Set(stages)];
  }
  resolveQaPipelineStages(question, intent) {
    switch (this.settings.qaPipelinePreset) {
      case "orchestrator_safeguard":
        return ["orchestrator", "safeguard"];
      case "orchestrator_auto_route":
        return this.resolveOrchestratorAutoRouteStages(question, intent);
      case "orchestrator_coder_safeguard":
        return ["orchestrator", "coder", "safeguard"];
      case "orchestrator_architect_safeguard":
        return ["orchestrator", "architect", "safeguard"];
      case "orchestrator_architect_coder_safeguard":
        return ["orchestrator", "architect", "coder", "safeguard"];
      case "legacy_auto":
      default:
        return this.resolveLegacyAutoPipelineStages(question, intent);
    }
  }
  buildRolePresetRefinementInstruction(role) {
    switch (role) {
      case "coder":
        return "Refine draft as a Coder: produce implementation-ready steps, concrete code/data structure guidance, and verification checklist.";
      case "architect":
        return "Refine draft as an Architect: emphasize design options, trade-offs, interface boundaries, phased rollout, and maintainability.";
      case "debugger":
        return "Refine draft as a Debugger: prioritize reproducible diagnosis path, likely root causes, test matrix, and rollback-safe fixes.";
      default:
        return "Refine draft while preserving factual grounding.";
    }
  }
  getQaRolePresetInstruction(role) {
    switch (role) {
      case "orchestrator":
        return "Role preset: Orchestrator. Break work into phases, dependencies, risks, and clear execution order.";
      case "coder":
        return "Role preset: Coder. Prefer implementation-level guidance, code-path reasoning, and practical next steps.";
      case "debugger":
        return "Role preset: Debugger. Prioritize root-cause analysis, reproducible checks, and verification steps.";
      case "architect":
        return "Role preset: Architect. Emphasize system design trade-offs, interfaces, scalability, and maintainability.";
      case "safeguard":
        return "Role preset: Safeguard. Prioritize security, privacy, and failure-mode analysis before recommendations.";
      case "ask_vision":
        return "Role preset: Ask (Vision). Prefer descriptions suitable for image-aware models while staying source-grounded.";
      case "image_generator":
        return "Role preset: Image generator. Describe prompts/specs for image generation, but keep claims grounded in sources.";
      case "ask":
      default:
        return "Role preset: Ask. Balanced assistant mode with concise, useful structure.";
    }
  }
  getQaRoleSystemPrompt(role) {
    return this.getQaRoleSystemPromptForQa(role).trim();
  }
  getQaPreferredLanguageInstruction() {
    switch (this.settings.qaPreferredResponseLanguage) {
      case "korean":
        return "Always answer in Korean unless user explicitly requests another language.";
      case "english":
        return "Always answer in English unless user explicitly requests another language.";
      case "auto":
      default:
        return "Use the same language as the user's question.";
    }
  }
  buildLocalQaSystemPrompt(intent, preferDetailed) {
    const role = this.resolveQaPrimaryRole();
    const toneLine = preferDetailed ? "Keep tone natural, direct, and sufficiently detailed." : "Keep tone natural, direct, and concise.";
    return [
      "You are a local-note assistant for Obsidian.",
      "Answer only from the provided sources.",
      this.getQaPreferredLanguageInstruction(),
      this.getQaRolePresetInstruction(role),
      toneLine,
      "Output in markdown.",
      "When making claims, cite source paths inline in parentheses.",
      "If evidence is insufficient, state it clearly and do not invent facts.",
      ...this.getQaContractLines(intent, preferDetailed),
      this.getQaRoleSystemPrompt(role) ? `Role system prompt (${role}):
${this.getQaRoleSystemPrompt(role)}` : "",
      this.settings.qaCustomSystemPrompt.trim() ? `Custom system prompt:
${this.settings.qaCustomSystemPrompt.trim()}` : ""
    ].filter((line) => line.length > 0).join("\n");
  }
  buildLocalQaUserPrompt(question, sourceContext, selectionInventoryContext) {
    const inventoryBlock = (selectionInventoryContext == null ? void 0 : selectionInventoryContext.trim()) ? ["", "Selection inventory metadata:", selectionInventoryContext.trim()] : [];
    return [
      `Question: ${question}`,
      "",
      "Sources:",
      sourceContext,
      ...inventoryBlock
    ].join("\n");
  }
  buildLocalQaGeneratePrompt(systemPrompt, userPrompt, history) {
    const historyText = history.length > 0 ? history.slice(-6).map(
      (turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.text}`
    ).join("\n") : "(none)";
    return [
      "System instructions:",
      systemPrompt,
      "",
      "Conversation so far:",
      historyText,
      "",
      userPrompt
    ].join("\n");
  }
  buildLocalQaChatMessages(systemPrompt, userPrompt, history) {
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    for (const turn of history.slice(-6)) {
      messages.push({
        role: turn.role,
        content: turn.text
      });
    }
    messages.push({ role: "user", content: userPrompt });
    return messages;
  }
  extractOllamaTokenChunk(payload) {
    let token = "";
    let thinking = "";
    const message = payload.message;
    if (message && typeof message === "object") {
      const parsed = message;
      if (typeof parsed.content === "string") {
        token = parsed.content;
      }
      if (typeof parsed.thinking === "string") {
        thinking = parsed.thinking;
      }
    }
    if (!token && typeof payload.response === "string") {
      token = payload.response;
    }
    if (!thinking && typeof payload.thinking === "string") {
      thinking = payload.thinking;
    }
    return { token, thinking };
  }
  async consumeOllamaJsonLineStream(body, onToken, onEvent) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let thinking = "";
    const consumeLine = (line) => {
      if (!line) {
        return;
      }
      try {
        const parsed = JSON.parse(line);
        const chunk = this.extractOllamaTokenChunk(parsed);
        if (chunk.thinking) {
          thinking += chunk.thinking;
          this.emitQaEvent(onEvent, "thinking", "Model thinking chunk", {
            thinkingChunk: chunk.thinking
          });
        }
        if (chunk.token) {
          answer += chunk.token;
          onToken == null ? void 0 : onToken(chunk.token);
        }
      } catch (e) {
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let lineBreakIndex = buffer.indexOf("\n");
      while (lineBreakIndex >= 0) {
        const line = buffer.slice(0, lineBreakIndex).trim();
        buffer = buffer.slice(lineBreakIndex + 1);
        consumeLine(line);
        lineBreakIndex = buffer.indexOf("\n");
      }
    }
    const tail = buffer.trim();
    if (tail) {
      consumeLine(tail);
    }
    return { answer, thinking };
  }
  async requestLocalQaGenerate(params) {
    const { qaBaseUrl, qaModel, prompt, onToken, onEvent, abortSignal } = params;
    const base = qaBaseUrl.replace(/\/$/, "");
    if (onToken) {
      const streamResponse = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          prompt,
          stream: true
        })
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Local Q&A request failed: ${streamResponse.status}`);
      }
      return this.consumeOllamaJsonLineStream(streamResponse.body, onToken, onEvent);
    }
    const response = await (0, import_obsidian4.requestUrl)({
      url: `${base}/api/generate`,
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
      throw new Error(`Local Q&A request failed: ${response.status}`);
    }
    const parsed = response.json && typeof response.json === "object" ? response.json : {};
    const chunk = this.extractOllamaTokenChunk(parsed);
    const answer = chunk.token.trim() || response.text.trim();
    return {
      answer,
      thinking: chunk.thinking.trim()
    };
  }
  async requestLocalQaChat(params) {
    const {
      qaBaseUrl,
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      onToken,
      onEvent,
      abortSignal
    } = params;
    const messages = this.buildLocalQaChatMessages(systemPrompt, userPrompt, history);
    const base = qaBaseUrl.replace(/\/$/, "");
    if (onToken) {
      const streamResponse = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          messages,
          stream: true
        })
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Local Q&A chat request failed: ${streamResponse.status}`);
      }
      return this.consumeOllamaJsonLineStream(streamResponse.body, onToken, onEvent);
    }
    const response = await (0, import_obsidian4.requestUrl)({
      url: `${base}/api/chat`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        messages,
        stream: false
      }),
      throw: false
    });
    if (response.status >= 300) {
      throw new Error(`Local Q&A chat request failed: ${response.status}`);
    }
    const parsed = response.json && typeof response.json === "object" ? response.json : {};
    const chunk = this.extractOllamaTokenChunk(parsed);
    const answer = chunk.token.trim() || response.text.trim();
    return {
      answer,
      thinking: chunk.thinking.trim()
    };
  }
  async requestLocalQaCompletion(params) {
    const {
      qaBaseUrl,
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      onToken,
      onEvent,
      abortSignal
    } = params;
    if (this.settings.qaPreferChatApi) {
      try {
        this.emitQaEvent(onEvent, "generation", "Using /api/chat endpoint");
        const chatResult = await this.requestLocalQaChat({
          qaBaseUrl,
          qaModel,
          systemPrompt,
          userPrompt,
          history,
          onToken,
          onEvent,
          abortSignal
        });
        if (chatResult.answer.trim()) {
          return {
            ...chatResult,
            endpoint: "chat"
          };
        }
        this.emitQaEvent(onEvent, "warning", "/api/chat returned an empty answer", {
          detail: "Fallback to /api/generate"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown /api/chat error";
        this.emitQaEvent(onEvent, "warning", "Falling back to /api/generate", {
          detail: message
        });
      }
    }
    this.emitQaEvent(onEvent, "generation", "Using /api/generate endpoint");
    const prompt = this.buildLocalQaGeneratePrompt(systemPrompt, userPrompt, history);
    const generateResult = await this.requestLocalQaGenerate({
      qaBaseUrl,
      qaModel,
      prompt,
      onToken,
      onEvent,
      abortSignal
    });
    return {
      ...generateResult,
      endpoint: "generate"
    };
  }
  buildSourceOnlyFallback(sourceBlocks) {
    const lines = sourceBlocks.slice(0, 8).map((item) => `- [[${item.path}]] (${formatSimilarity(item.similarity)})`);
    return lines.length > 0 ? lines.join("\n") : "- (no sources)";
  }
  async repairQaStructureIfNeeded(params) {
    const {
      intent,
      answer,
      question,
      preferDetailed,
      sourceBlocks,
      qaBaseUrl,
      qaModel,
      onEvent
    } = params;
    if (!this.settings.qaStructureGuardEnabled) {
      return answer;
    }
    const needsStructure = this.needsQaStructureRepair(intent, answer);
    const needsDepth = this.needsQaDepthRepair(intent, answer, preferDetailed);
    if (!needsStructure && !needsDepth) {
      return answer;
    }
    this.emitQaEvent(onEvent, "generation", "Applying structured output guard");
    const sourceContext = this.buildLocalQaSourceContext(sourceBlocks);
    const systemPrompt = [
      "You are a markdown structure normalizer for local-note answers.",
      "Keep language identical to the draft answer.",
      "Do not add facts not present in draft answer or provided source excerpts.",
      "Preserve source path citations whenever possible.",
      "Return markdown only.",
      ...this.getQaContractLines(intent, preferDetailed)
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      sourceContext
    ].join("\n");
    try {
      const repaired = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history: []
      });
      const split = splitThinkingBlocks(repaired.answer);
      const normalized = split.answer.trim() || repaired.answer.trim();
      const stillNeedsStructure = this.needsQaStructureRepair(intent, normalized);
      const stillNeedsDepth = this.needsQaDepthRepair(intent, normalized, preferDetailed);
      if (normalized && !stillNeedsStructure && !stillNeedsDepth) {
        this.emitQaEvent(onEvent, "generation", "Structured output guard applied");
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", "Structured output guard could not enforce format");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown structure guard error";
      this.emitQaEvent(onEvent, "warning", "Structured output guard failed", {
        detail: message
      });
    }
    if (intent === "sources_only") {
      return this.buildSourceOnlyFallback(sourceBlocks);
    }
    return answer;
  }
  resolvePassModelOrWarn(role, onEvent) {
    const model = this.resolveQaModelForRole(role).trim();
    if (!model) {
      this.emitQaEvent(onEvent, "warning", `Skipping ${role} pass: model is empty`);
      return null;
    }
    if (!isOllamaModelAllowedForQaRole(role, model)) {
      this.emitQaEvent(
        onEvent,
        "warning",
        `Skipping ${role} pass: model is not suitable (${model})`
      );
      return null;
    }
    return model;
  }
  async applyOrchestratorPass(params) {
    const { question, answer, sourceBlocks, qaBaseUrl, onEvent, abortSignal } = params;
    const passModel = this.resolvePassModelOrWarn("orchestrator", onEvent);
    if (!passModel) {
      return answer;
    }
    const roleSystemPrompt = this.getQaRoleSystemPrompt("orchestrator");
    this.emitQaEvent(onEvent, "generation", `Running orchestrator pass (${passModel})`);
    const systemPrompt = [
      "You are an orchestration editor for local-note answers.",
      "Task: convert draft into execution-ready output without inventing facts.",
      "Keep language aligned with user's preference.",
      "Return markdown only.",
      "When evidence is missing, explicitly mark as '\uC815\uBCF4 \uBD80\uC871'.",
      "Use this structure when suitable:",
      "- Objective and scope",
      "- Core findings",
      "- Execution plan/checklist",
      "- Deliverables (report/PPT/materials/code)",
      "- Risks and safeguards",
      "- Next actions",
      roleSystemPrompt ? `Role system prompt (orchestrator):
${roleSystemPrompt}` : ""
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks)
    ].join("\n");
    try {
      const improved = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal
      });
      const split = splitThinkingBlocks(improved.answer);
      const normalized = split.answer.trim() || improved.answer.trim();
      if (normalized.length > 0) {
        this.emitQaEvent(onEvent, "generation", "Orchestrator pass applied");
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", "Orchestrator pass returned empty output");
      return answer;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown orchestrator error";
      this.emitQaEvent(onEvent, "warning", "Orchestrator pass failed", { detail: message });
      return answer;
    }
  }
  async applyRolePresetRefinementPass(params) {
    const { role, question, answer, sourceBlocks, qaBaseUrl, onEvent, abortSignal } = params;
    const passModel = this.resolvePassModelOrWarn(role, onEvent);
    if (!passModel) {
      return answer;
    }
    const roleSystemPrompt = this.getQaRoleSystemPrompt(role);
    this.emitQaEvent(onEvent, "generation", `Running ${role} refinement (${passModel})`);
    const systemPrompt = [
      "You are a role-specialized editor for local-note answers.",
      "Keep output factual and grounded in provided sources.",
      "Do not invent facts. Mark uncertain points as '\uC815\uBCF4 \uBD80\uC871'.",
      this.buildRolePresetRefinementInstruction(role),
      "Return markdown only.",
      roleSystemPrompt ? `Role system prompt (${role}):
${roleSystemPrompt}` : ""
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks)
    ].join("\n");
    try {
      const rewritten = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal
      });
      const split = splitThinkingBlocks(rewritten.answer);
      const normalized = split.answer.trim() || rewritten.answer.trim();
      if (normalized.length > 0) {
        this.emitQaEvent(onEvent, "generation", `${role} refinement applied`);
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", `${role} refinement returned empty output`);
      return answer;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown role refinement error";
      this.emitQaEvent(onEvent, "warning", `${role} refinement failed`, {
        detail: message
      });
      return answer;
    }
  }
  async applySafeguardPass(params) {
    const { question, answer, sourceBlocks, qaBaseUrl, onEvent, abortSignal } = params;
    const passModel = this.resolvePassModelOrWarn("safeguard", onEvent);
    if (!passModel) {
      return answer;
    }
    const roleSystemPrompt = this.getQaRoleSystemPrompt("safeguard");
    this.emitQaEvent(onEvent, "generation", `Running safeguard verification (${passModel})`);
    const systemPrompt = [
      "You are a safeguard verifier for local-note answers.",
      "Validate draft strictly against provided source excerpts.",
      "Remove unsupported claims and overconfident wording.",
      "Keep useful structure but prefer factual correctness and safety.",
      "If evidence is missing, keep statement conservative and explicit.",
      "Preserve source-path citations whenever possible.",
      "Return final markdown answer only.",
      roleSystemPrompt ? `Role system prompt (safeguard):
${roleSystemPrompt}` : ""
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks)
    ].join("\n");
    try {
      const verified = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal
      });
      const split = splitThinkingBlocks(verified.answer);
      const normalized = split.answer.trim() || verified.answer.trim();
      if (normalized.length > 0) {
        this.emitQaEvent(onEvent, "generation", "Safeguard verification applied");
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", "Safeguard pass returned empty output");
      return answer;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown safeguard error";
      this.emitQaEvent(onEvent, "warning", "Safeguard pass failed", { detail: message });
      return answer;
    }
  }
  async openLocalQaChatModal() {
    await this.openLocalQaWorkspaceView();
  }
  async askLocalQa(question, topK, history = [], onToken, onEvent, abortSignal) {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      throw new Error("No target notes selected. Open selector first.");
    }
    const safeQuestion = question.trim();
    if (!safeQuestion) {
      throw new Error("Question is empty.");
    }
    const intent = this.detectLocalQaIntent(safeQuestion);
    const preferDetailed = this.shouldPreferDetailedAnswer(safeQuestion, intent);
    const safeTopK = Math.max(1, Math.min(15, topK));
    const qaBaseUrl = this.resolveQaBaseUrl();
    if (!qaBaseUrl) {
      throw new Error("Q&A base URL is empty.");
    }
    if (!this.settings.qaAllowNonLocalEndpoint && !this.isLocalEndpoint(qaBaseUrl)) {
      throw new Error(
        "Blocked by security policy: Q&A endpoint must be localhost unless explicitly allowed."
      );
    }
    const primaryRole = this.resolveQaPrimaryRole();
    const qaModel = this.resolveQaModelForRole(primaryRole);
    if (!qaModel) {
      throw new Error("Q&A model is empty.");
    }
    if (!isOllamaModelAllowedForQaRole(primaryRole, qaModel)) {
      throw new Error(`Q&A model is not suitable: ${qaModel}`);
    }
    try {
      const embeddingModel = this.settings.semanticOllamaModel.trim();
      if (!embeddingModel) {
        throw new Error("Embedding model is empty. Refresh embedding detection first.");
      }
      this.setStatus("semantic retrieval for local qa...");
      this.emitQaEvent(onEvent, "retrieval", "Embedding retrieval started");
      const retrievalCandidateK = this.resolveQaRetrievalCandidateK(intent, safeTopK);
      const retrieval = await searchSemanticNotesByQuery(
        this.app,
        selectedFiles,
        this.settings,
        safeQuestion,
        retrievalCandidateK
      );
      this.emitQaEvent(
        onEvent,
        "retrieval",
        `Retrieved ${retrieval.hits.length} candidates (cache hits=${retrieval.cacheHits}, writes=${retrieval.cacheWrites})`
      );
      if (retrieval.errors.length > 0) {
        this.notice(`Semantic retrieval had ${retrieval.errors.length} issue(s).`, 6e3);
        this.emitQaEvent(onEvent, "warning", `Retrieval warnings: ${retrieval.errors.length}`);
      }
      if (retrieval.hits.length === 0) {
        throw new Error("No relevant notes were found for this question.");
      }
      const rankedHits = this.rerankQaHits(
        retrieval.hits,
        safeQuestion,
        this.resolveQaRerankTopK(intent, safeTopK)
      );
      if (rankedHits.length === 0) {
        throw new Error("No relevant notes were found for this question.");
      }
      this.emitQaEvent(onEvent, "retrieval", `Reranked to ${rankedHits.length} notes`);
      const maxContextChars = this.resolveQaContextCharLimit(intent);
      const queryTerms = this.tokenizeQuery(safeQuestion);
      const sourceCandidates = [];
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
        const snippet = this.extractRelevantSnippet(raw, safeQuestion, remaining);
        if (!snippet) {
          continue;
        }
        const snippetMatch = this.countTermMatches(snippet.toLowerCase(), queryTerms);
        const relevance = hit.similarity + Math.min(0.22, snippetMatch * 0.03);
        sourceCandidates.push({
          path: hit.path,
          similarity: hit.similarity,
          content: snippet,
          relevance
        });
        usedChars += snippet.length;
      }
      sourceCandidates.sort(
        (a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path)
      );
      const sourceLimit = intent === "comparison" || intent === "plan" ? Math.max(safeTopK + 2, safeTopK) : intent === "sources_only" ? Math.max(safeTopK, 5) : safeTopK;
      const sourceBlocks = sourceCandidates.slice(0, sourceLimit).map((item) => ({
        path: item.path,
        similarity: item.similarity,
        content: item.content
      }));
      this.emitQaEvent(
        onEvent,
        "retrieval",
        `Context built from ${sourceBlocks.length} notes (${usedChars} chars)`
      );
      if (sourceBlocks.length === 0) {
        throw new Error("Relevant notes found but no readable content extracted.");
      }
      const sourceContext = this.buildLocalQaSourceContext(sourceBlocks);
      const selectionInventoryContext = this.shouldIncludeSelectionInventory(
        safeQuestion,
        selectedFiles.length,
        intent
      ) ? this.buildSelectionInventoryContext(selectedFiles) : void 0;
      const systemPrompt = this.buildLocalQaSystemPrompt(intent, preferDetailed);
      const userPrompt = this.buildLocalQaUserPrompt(
        safeQuestion,
        sourceContext,
        selectionInventoryContext
      );
      this.emitQaEvent(onEvent, "generation", "Generation started");
      this.setStatus("asking local qa model...");
      const completion = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history,
        onToken,
        onEvent,
        abortSignal
      });
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      const split = splitThinkingBlocks(completion.answer);
      const initialAnswer = split.answer.trim() || completion.answer.trim();
      if (!initialAnswer) {
        throw new Error("Local Q&A returned an empty answer.");
      }
      let finalAnswer = await this.repairQaStructureIfNeeded({
        intent,
        answer: initialAnswer,
        question: safeQuestion,
        preferDetailed,
        sourceBlocks,
        qaBaseUrl,
        qaModel,
        onEvent
      });
      const pipelineStages = this.resolveQaPipelineStages(safeQuestion, intent);
      if (pipelineStages.length > 0) {
        this.emitQaEvent(
          onEvent,
          "generation",
          `Pipeline: ${pipelineStages.join(" -> ")}`
        );
      }
      for (const stage of pipelineStages) {
        if (stage === "orchestrator") {
          finalAnswer = await this.applyOrchestratorPass({
            question: safeQuestion,
            answer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            onEvent,
            abortSignal
          });
          continue;
        }
        if (stage === "safeguard") {
          finalAnswer = await this.applySafeguardPass({
            question: safeQuestion,
            answer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            onEvent,
            abortSignal
          });
          continue;
        }
        finalAnswer = await this.applyRolePresetRefinementPass({
          role: stage,
          question: safeQuestion,
          answer: finalAnswer,
          sourceBlocks,
          qaBaseUrl,
          onEvent,
          abortSignal
        });
      }
      const mergedThinking = [completion.thinking.trim(), split.thinking.trim()].filter((item) => item.length > 0).join("\n\n").trim();
      this.emitQaEvent(onEvent, "generation", `Generation completed (${completion.endpoint})`);
      const sourceList = sourceBlocks.map((item) => ({
        path: item.path,
        similarity: item.similarity
      }));
      return {
        question: safeQuestion,
        answer: finalAnswer,
        thinking: mergedThinking,
        model: qaModel,
        embeddingModel,
        sources: sourceList,
        retrievalCacheHits: retrieval.cacheHits,
        retrievalCacheWrites: retrieval.cacheWrites
      };
    } finally {
      this.setStatus("idle");
    }
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
  extractPathTerms(path) {
    return path.toLowerCase().replace(/\.md$/i, "").split(/[^a-z0-9가-힣]+/).map((token) => token.trim()).filter((token) => token.length >= 2);
  }
  scoreCandidatePath(sourcePath, candidatePath) {
    const sourceParts = sourcePath.toLowerCase().split("/");
    const targetParts = candidatePath.toLowerCase().split("/");
    let sharedPrefix = 0;
    for (let i = 0; i < Math.min(sourceParts.length, targetParts.length); i += 1) {
      if (sourceParts[i] !== targetParts[i]) {
        break;
      }
      sharedPrefix += 1;
    }
    const sourceTerms = new Set(this.extractPathTerms(sourcePath));
    const targetTerms = this.extractPathTerms(candidatePath);
    let overlap = 0;
    for (const token of targetTerms) {
      if (sourceTerms.has(token)) {
        overlap += 1;
      }
    }
    return sharedPrefix * 2 + overlap;
  }
  getCandidateLinkPathsForFile(filePath, selectedFiles, semanticNeighbors) {
    var _a;
    const fallback = selectedFiles.filter((candidate) => candidate.path !== filePath).map((candidate) => candidate.path);
    const candidateLimit = Math.max(
      this.settings.maxLinked * 6,
      this.settings.semanticTopK,
      ANALYSIS_HARD_MAX_CANDIDATES
    );
    const rankedFallback = [...fallback].sort((a, b) => {
      const scoreDiff = this.scoreCandidatePath(filePath, b) - this.scoreCandidatePath(filePath, a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.localeCompare(b);
    });
    if (!semanticNeighbors || !this.settings.semanticLinkingEnabled) {
      return rankedFallback.slice(0, candidateLimit);
    }
    const semantic = ((_a = semanticNeighbors.get(filePath)) != null ? _a : []).map((item) => item.path);
    if (semantic.length === 0) {
      return rankedFallback.slice(0, candidateLimit);
    }
    return mergeUniqueStrings(semantic, rankedFallback).slice(0, candidateLimit);
  }
  normalizeFolderPrefix(path) {
    const normalized = (0, import_obsidian4.normalizePath)(path.trim());
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }
  isPathInsideFolder(filePath, folderPath) {
    const fileNormalized = (0, import_obsidian4.normalizePath)(filePath);
    const folderNormalized = (0, import_obsidian4.normalizePath)(folderPath);
    if (!fileNormalized || !folderNormalized) {
      return false;
    }
    if (fileNormalized === folderNormalized) {
      return true;
    }
    return fileNormalized.startsWith(this.normalizeFolderPrefix(folderNormalized));
  }
  parseWatchedFolders() {
    return this.settings.watchNewNotesFolders.split(/[\n,;]+/).map((item) => (0, import_obsidian4.normalizePath)(item.trim())).filter((item) => item.length > 0).filter((item) => this.isSafeVaultRelativePath(item)).sort((a, b) => a.localeCompare(b));
  }
  resolveMatchedWatchedFolder(filePath) {
    const watchedFolders = this.parseWatchedFolders();
    for (const folder of watchedFolders) {
      if (this.isPathInsideFolder(filePath, folder)) {
        return folder;
      }
    }
    return null;
  }
  isManagedOutputPath(path) {
    try {
      const chatRoot = this.resolveSafeFolderPath(
        this.settings.chatTranscriptRootPath,
        "Auto Link Chats",
        "Chat transcript"
      );
      if (this.isPathInsideFolder(path, chatRoot)) {
        return true;
      }
    } catch (e) {
    }
    try {
      const reportRoot = this.resolveSafeFolderPath(
        this.settings.cleanupReportRootPath,
        "Auto Link Reports",
        "Cleanup dry-run report"
      );
      if (this.isPathInsideFolder(path, reportRoot)) {
        return true;
      }
    } catch (e) {
    }
    try {
      const backupRoot = this.resolveSafeFolderPath(
        this.settings.backupRootPath,
        "Auto Link Backups",
        "Backup root"
      );
      if (this.isPathInsideFolder(path, backupRoot)) {
        return true;
      }
    } catch (e) {
    }
    return false;
  }
  async addFileToSelection(filePath) {
    const normalized = (0, import_obsidian4.normalizePath)(filePath);
    if (!normalized || this.isPathExcluded(normalized)) {
      return "already";
    }
    const alreadySelected = this.getSelectedFiles().some((file) => file.path === normalized);
    if (alreadySelected || this.settings.targetFilePaths.includes(normalized)) {
      return "already";
    }
    this.settings.targetFilePaths = [...this.settings.targetFilePaths, normalized].sort(
      (a, b) => a.localeCompare(b)
    );
    await this.saveSettings();
    return "added";
  }
  async handleWatchedNewFile(file) {
    if (!this.settings.watchNewNotesEnabled) {
      return;
    }
    if (this.isPathExcluded(file.path) || this.isManagedOutputPath(file.path)) {
      return;
    }
    const matchedFolder = this.resolveMatchedWatchedFolder(file.path);
    if (!matchedFolder) {
      return;
    }
    if (this.pendingNewNoteWatchPrompts.has(file.path)) {
      return;
    }
    this.pendingNewNoteWatchPrompts.add(file.path);
    try {
      const decision = await NewNoteWatchModal.ask(this.app, file.path, matchedFolder);
      if (decision.action === "ignore") {
        return;
      }
      const addResult = await this.addFileToSelection(file.path);
      if (decision.action === "add_only") {
        if (addResult === "added") {
          this.notice(`Added to selection: ${file.path}`, 5e3);
        } else {
          this.notice(`Already included in selection: ${file.path}`, 4e3);
        }
        return;
      }
      if (addResult === "added") {
        this.notice(`Added and analyzing: ${file.path}`, 5e3);
      } else {
        this.notice(`Analyzing with current selection: ${file.path}`, 5e3);
      }
      await this.runAnalysis();
    } finally {
      this.pendingNewNoteWatchPrompts.delete(file.path);
    }
  }
  buildAutoTagCandidatePaths(file) {
    const selected = this.getSelectedFiles().filter((candidate) => candidate.path !== file.path).map((candidate) => candidate.path);
    if (selected.length > 0) {
      return selected.slice(0, ANALYSIS_HARD_MAX_CANDIDATES);
    }
    return this.getAllMarkdownFiles().filter((candidate) => candidate.path !== file.path).sort((a, b) => {
      const scoreDiff = this.scoreCandidatePath(file.path, b.path) - this.scoreCandidatePath(file.path, a.path);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.path.localeCompare(b.path);
    }).slice(0, ANALYSIS_HARD_MAX_CANDIDATES).map((candidate) => candidate.path);
  }
  async runAutoTagForFile(file, source) {
    var _a, _b, _c, _d;
    if (this.isPathExcluded(file.path)) {
      return;
    }
    if (this.autoTagInFlightPaths.has(file.path)) {
      return;
    }
    const cooldownSec = Math.max(10, this.settings.autoTagActiveNoteCooldownSec);
    const cooldownMs = cooldownSec * 1e3;
    const now = Date.now();
    const lastRun = (_a = this.autoTagLastRunByPath.get(file.path)) != null ? _a : 0;
    if (source === "auto" && now - lastRun < cooldownMs) {
      return;
    }
    if (this.settings.provider === "ollama") {
      const selectedModel = this.settings.ollamaModel.trim();
      if (!selectedModel || !isOllamaModelAnalyzable(selectedModel)) {
        if (source === "manual") {
          this.notice("Auto-tag skipped: select an analyzable Ollama model first.", 5e3);
        }
        return;
      }
    }
    this.autoTagInFlightPaths.add(file.path);
    this.autoTagLastRunByPath.set(file.path, now);
    try {
      const analysisCache = await this.loadAnalysisCache();
      const providerCacheSignature = this.getProviderCacheSignature();
      const settingsSignature = this.buildAnalysisSettingsSignature(providerCacheSignature);
      const candidateLinkPaths = this.buildAutoTagCandidatePaths(file);
      const selectionSignature = this.hashString(
        JSON.stringify([file.path, ...candidateLinkPaths])
      );
      const signatureInput = {
        sourcePath: file.path,
        candidateLinkPaths,
        maxTags: this.settings.maxTags,
        maxLinked: this.settings.maxLinked,
        analyzeTags: true,
        analyzeTopic: false,
        analyzeLinked: false,
        forceAllToAllLinkedEnabled: false,
        analyzeIndex: false,
        includeReasons: this.settings.includeReasons
      };
      const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
      const requestSignature = this.buildAnalysisRequestSignature(
        providerCacheSignature,
        signatureInput
      );
      const cachedOutcome = this.getCachedAnalysisOutcome(
        analysisCache,
        cacheKey,
        requestSignature,
        file,
        settingsSignature,
        selectionSignature
      );
      let outcome;
      if (cachedOutcome) {
        outcome = cachedOutcome;
      } else {
        outcome = await analyzeWithFallback(this.settings, {
          ...signatureInput,
          sourceText: await this.app.vault.cachedRead(file)
        });
        this.storeAnalysisOutcome(
          analysisCache,
          cacheKey,
          requestSignature,
          settingsSignature,
          selectionSignature,
          file,
          outcome
        );
      }
      const existingFrontmatter = (_c = (_b = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _b.frontmatter) != null ? _c : {};
      const existingTags = normalizeTags(this.readRawFrontmatterTags(existingFrontmatter));
      const proposedTags = normalizeTags(
        ((_d = outcome.proposal.tags) != null ? _d : []).slice(0, this.settings.maxTags)
      );
      const mergedTags = normalizeTags(mergeUniqueStrings(existingTags, proposedTags));
      const unchanged = mergedTags.length === existingTags.length && mergedTags.every((item, idx) => item === existingTags[idx]);
      if (unchanged || mergedTags.length === 0) {
        if (source === "manual") {
          this.notice("Auto-tag: no tag changes for active note.", 4e3);
        }
      } else {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const current = frontmatter;
          current.tags = mergedTags;
        });
        if (source === "manual") {
          this.notice(`Auto-tag applied: ${file.path} (${mergedTags.length} tags)`, 5e3);
        }
      }
      if (this.analysisCacheDirty) {
        await this.flushAnalysisCache();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auto-tag error";
      if (source === "manual") {
        this.notice(`Auto-tag failed: ${message}`, 6e3);
      }
    } finally {
      this.autoTagInFlightPaths.delete(file.path);
    }
  }
  async handleAutoTagOnFileOpen(file) {
    if (!this.settings.autoTagActiveNoteEnabled) {
      return;
    }
    await this.runAutoTagForFile(file, "auto");
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
      lines.push("# Auto Link Cleanup Dry-Run Report");
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
        const reportFolder = this.resolveSafeFolderPath(
          this.settings.cleanupReportRootPath,
          "Auto Link Reports",
          "Cleanup dry-run report"
        );
        reportPath = (0, import_obsidian4.normalizePath)(
          `${reportFolder}/cleanup-dry-run-${formatBackupStamp(/* @__PURE__ */ new Date())}.md`
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
    const analysisCache = await this.loadAnalysisCache();
    const providerCacheSignature = this.getProviderCacheSignature();
    const settingsSignature = this.buildAnalysisSettingsSignature(providerCacheSignature);
    const selectionSignature = this.buildSelectionSignature(selectedFiles);
    let skippedUnchanged = 0;
    let filesToAnalyze = selectedFiles;
    if (this.settings.analysisOnlyChangedNotes) {
      const pending = [];
      for (const file of selectedFiles) {
        const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
        if (this.canSkipByChangedOnlyMode(
          analysisCache,
          cacheKey,
          file,
          settingsSignature,
          selectionSignature
        )) {
          skippedUnchanged += 1;
          continue;
        }
        pending.push(file);
      }
      filesToAnalyze = pending;
      if (filesToAnalyze.length === 0) {
        this.setStatus("analysis done (unchanged cache hit)");
        this.notice(
          `No changed notes to analyze. Selected=${selectedFiles.length}, SkippedUnchanged=${skippedUnchanged}.`,
          5e3
        );
        return;
      }
      this.notice(
        `Changed-only mode: ${skippedUnchanged} skipped, ${filesToAnalyze.length} queued.`,
        4e3
      );
    }
    const capacityModelLabel = getProviderModelLabel(this.settings);
    const recommendedMax = this.estimateRecommendedSelectionMax(capacityModelLabel);
    if (filesToAnalyze.length >= Math.floor(recommendedMax * 0.85)) {
      this.notice(
        `Selected ${filesToAnalyze.length}. Recommended max for current model is about ${recommendedMax}.`,
        5e3
      );
    }
    if (filesToAnalyze.length > recommendedMax) {
      const capacityDecision = await CapacityGuardModal.ask(
        this.app,
        filesToAnalyze.length,
        recommendedMax,
        capacityModelLabel,
        this.settings.semanticLinkingEnabled && this.settings.analyzeLinked
      );
      if (!capacityDecision.proceed) {
        this.notice("Analysis cancelled due to large selection size.");
        return;
      }
    }
    const forceAllToAllLinked = this.settings.analyzeLinked && this.settings.forceAllToAllLinkedEnabled;
    if (forceAllToAllLinked) {
      this.notice(
        "All-to-all linked mode is ON. Each note will include all selected notes (except itself).",
        6e3
      );
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
      backupFolder = await this.createBackupForFiles(filesToAnalyze);
      if (backupFolder) {
        this.notice(`Backup completed before analysis: ${backupFolder}`, 5e3);
      }
    }
    let semanticNeighbors = /* @__PURE__ */ new Map();
    const shouldBuildSemanticNeighbors = this.settings.semanticLinkingEnabled && this.settings.analyzeLinked && !forceAllToAllLinked;
    if (shouldBuildSemanticNeighbors) {
      this.setStatus("building semantic candidates...");
      try {
        const semanticScopeFiles = this.settings.analysisOnlyChangedNotes ? filesToAnalyze : selectedFiles;
        const semanticResult = await buildSemanticNeighborMap(
          this.app,
          semanticScopeFiles,
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
    } else if (forceAllToAllLinked && this.settings.semanticLinkingEnabled) {
      this.notice(
        "Semantic candidate build skipped because all-to-all linked mode is ON.",
        5e3
      );
    }
    const progressModal = new RunProgressModal(this.app, "Analyzing selected notes");
    progressModal.open();
    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions = [];
    const errors = [];
    const events = [];
    const runStartedAt = Date.now();
    let usedFallbackCount = 0;
    let analysisCacheHits = 0;
    let analysisCacheWrites = 0;
    let cancelled = false;
    for (let index = 0; index < filesToAnalyze.length; index += 1) {
      if (progressModal.isCancelled()) {
        cancelled = true;
        break;
      }
      const file = filesToAnalyze[index];
      progressModal.update({
        stage: "Analyzing",
        current: index + 1,
        total: filesToAnalyze.length,
        startedAt: runStartedAt,
        currentFile: file.path,
        errors,
        events
      });
      this.setStatus(`analyzing ${index + 1}/${filesToAnalyze.length}`);
      try {
        const candidateLinkPaths = this.getCandidateLinkPathsForFile(
          file.path,
          selectedFiles,
          semanticNeighbors
        );
        const analyzeLinkedByModel = this.settings.analyzeLinked && !forceAllToAllLinked;
        const candidateLinkPathsForRequest = analyzeLinkedByModel ? candidateLinkPaths : [];
        const signatureInput = {
          sourcePath: file.path,
          candidateLinkPaths: candidateLinkPathsForRequest,
          maxTags: this.settings.maxTags,
          maxLinked: this.settings.maxLinked,
          analyzeTags: this.settings.analyzeTags,
          analyzeTopic: this.settings.analyzeTopic,
          analyzeLinked: analyzeLinkedByModel,
          forceAllToAllLinkedEnabled: forceAllToAllLinked,
          analyzeIndex: this.settings.analyzeIndex,
          includeReasons: this.settings.includeReasons
        };
        const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
        const requestSignature = this.buildAnalysisRequestSignature(
          providerCacheSignature,
          signatureInput
        );
        const cachedOutcome = this.getCachedAnalysisOutcome(
          analysisCache,
          cacheKey,
          requestSignature,
          file,
          settingsSignature,
          selectionSignature
        );
        let outcome;
        if (cachedOutcome) {
          outcome = cachedOutcome;
          analysisCacheHits += 1;
        } else {
          const request = {
            ...signatureInput,
            sourceText: await this.app.vault.cachedRead(file)
          };
          outcome = await analyzeWithFallback(this.settings, request);
          this.storeAnalysisOutcome(
            analysisCache,
            cacheKey,
            requestSignature,
            settingsSignature,
            selectionSignature,
            file,
            outcome
          );
          analysisCacheWrites += 1;
        }
        if (outcome.meta.usedFallback) {
          usedFallbackCount += 1;
        }
        const currentFrontmatter = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
        const rawExistingTags = this.readRawFrontmatterTags(currentFrontmatter);
        const existingBase = normalizeManagedFrontmatter(
          extractManagedFrontmatter(currentFrontmatter)
        );
        const existingValidated = {
          tags: existingBase.tags,
          topic: existingBase.topic,
          linked: normalizeLinked(this.app, file.path, existingBase.linked),
          index: existingBase.index
        };
        const existingForComparison = {
          tags: rawExistingTags,
          topic: existingValidated.topic,
          linked: existingValidated.linked,
          index: existingValidated.index
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
          const linkedSource = forceAllToAllLinked ? selectedFiles.filter((candidate) => candidate.path !== file.path).map((candidate) => candidate.path) : ((_e = outcome.proposal.linked) != null ? _e : []).slice(0, this.settings.maxLinked);
          const proposedLinked = normalizeLinked(
            this.app,
            file.path,
            linkedSource,
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
        if (!managedFrontmatterChanged(existingForComparison, normalizedProposed)) {
          continue;
        }
        const semanticCandidates = ((_g = semanticNeighbors.get(file.path)) != null ? _g : []).map((item) => ({
          path: item.path,
          similarity: item.similarity
        }));
        suggestions.push({
          file,
          existing: existingForComparison,
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
    if (analysisCacheWrites > 0 || this.analysisCacheDirty) {
      try {
        await this.flushAnalysisCache();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown analysis cache write error";
        this.notice(`Analysis cache write failed: ${message}`, 6e3);
      }
    }
    progressModal.setFinished(
      cancelled ? "Analysis stopped by user." : `Analysis complete: ${suggestions.length} changed of ${filesToAnalyze.length}`
    );
    progressModal.close();
    const summary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: filesToAnalyze.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt,
      cancelled,
      errorCount: errors.length
    };
    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);
    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes. Provider=${summary.provider}, Model=${summary.model}, Errors=${summary.errorCount}, Elapsed=${formatDurationMs(summary.elapsedMs)}, CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}.`,
        5e3
      );
      return;
    }
    if (cancelled) {
      this.notice(
        `Analysis stopped. Showing partial suggestions (${suggestions.length} file(s)). CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}.`,
        5e3
      );
    }
    this.notice(
      `Analysis complete: ${summary.changedFiles}/${summary.totalFiles} changed. CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
      5e3
    );
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
    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root"
    );
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
    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root"
    );
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
    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root"
    );
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
    const outputPath = this.resolveSafeMarkdownPath(this.settings.mocPath, "MOC");
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
