/* eslint-disable */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KnowledgeWeaverPlugin
});
module.exports = __toCommonJS(main_exports);
var import_child_process = require("child_process");
var nodeFs = __toESM(require("fs"));
var nodeOs = __toESM(require("os"));
var nodePath = __toESM(require("path"));
var import_util = require("util");
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
    `${app.vault.configDir}/plugins/omni-forge/semantic-embedding-cache.json`
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
function throwAbortIfNeeded(abortSignal) {
  if (abortSignal == null ? void 0 : abortSignal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}
async function buildFileVectorIndex(app, files, config, maxChars, abortSignal) {
  const vectorsByPath = /* @__PURE__ */ new Map();
  const errors = [];
  const cache = await readEmbeddingCache(app);
  let cacheHits = 0;
  let cacheWrites = 0;
  let cacheDirty = false;
  const missing = [];
  for (const file of files) {
    throwAbortIfNeeded(abortSignal);
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
    throwAbortIfNeeded(abortSignal);
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
    throwAbortIfNeeded(abortSignal);
    const batch = missing.slice(i, i + EMBEDDING_BATCH_SIZE);
    try {
      const embeddings = await requestOllamaEmbeddings(
        config.baseUrl,
        config.model,
        batch.map((item) => item.text)
      );
      throwAbortIfNeeded(abortSignal);
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
async function buildSemanticNeighborMap(app, files, settings, abortSignal) {
  const neighborMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    throwAbortIfNeeded(abortSignal);
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
    maxChars,
    abortSignal
  );
  const vectorsByPath = vectorBuild.vectorsByPath;
  const errors = [...vectorBuild.errors];
  const cacheHits = vectorBuild.cacheHits;
  const cacheWrites = vectorBuild.cacheWrites;
  for (const sourceFile of files) {
    throwAbortIfNeeded(abortSignal);
    const sourceVector = vectorsByPath.get(sourceFile.path);
    if (!sourceVector) {
      continue;
    }
    const scored = [];
    for (const targetFile of files) {
      throwAbortIfNeeded(abortSignal);
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
async function searchSemanticNotesByQuery(app, files, settings, query, topK, abortSignal) {
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
  const vectorBuild = await buildFileVectorIndex(
    app,
    files,
    config,
    maxChars,
    abortSignal
  );
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
    throwAbortIfNeeded(abortSignal);
    if (!queryVector) {
      const queryEmbeddings = await requestOllamaEmbeddings(config.baseUrl, config.model, [
        queryText
      ]);
      throwAbortIfNeeded(abortSignal);
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
      throwAbortIfNeeded(abortSignal);
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
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var DEFAULT_SETTINGS = {
  settingsViewMode: "full",
  settingsUiLanguage: "ko",
  settingsActiveTab: "quick",
  provider: "ollama",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "",
  ollamaAutoPickEnabled: true,
  lmStudioBaseUrl: "http://127.0.0.1:1234",
  lmStudioModel: "local-model",
  lmStudioApiKey: "",
  openAIBaseUrl: "https://api.openai.com/v1",
  openAIModel: "gpt-5.3-codex",
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
  qaChatModelFamily: "local",
  qaChatModelProfile: "local-flash",
  qaChatFontSize: 14,
  qaShowSystemMessages: false,
  qaTopK: 5,
  qaMaxContextChars: 12e3,
  qaAllowNonLocalEndpoint: false,
  qaAllowedOutboundHosts: "",
  qaPreferChatApi: true,
  qaStructureGuardEnabled: true,
  qaAlwaysDetailedAnswer: true,
  qaMinAnswerChars: 320,
  qaPreferredResponseLanguage: "korean",
  qaLocalPresetProfile: "balanced_local",
  qaConversationMode: "ask",
  qaQuickCustomProfileSlot1: "",
  qaQuickCustomProfileSlot2: "",
  qaQuickCustomProfileSlot3: "",
  qaCustomSystemPrompt: '\uB108\uB294 \uB85C\uCEEC Obsidian \uB178\uD2B8 \uAE30\uBC18 \uC2E4\uD589 \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uC81C\uACF5\uB41C \uC18C\uC2A4 \uBC94\uC704 \uC548\uC5D0\uC11C\uB9CC \uB2F5\uD558\uACE0, \uADFC\uAC70\uAC00 \uBD80\uC871\uD558\uBA74 \uBC18\uB4DC\uC2DC "\uC815\uBCF4 \uBD80\uC871"\uC774\uB77C\uACE0 \uBA85\uC2DC\uD55C\uB2E4. \uCD94\uCE21/\uD658\uAC01/\uACFC\uC7A5 \uD45C\uD604\uC744 \uAE08\uC9C0\uD55C\uB2E4. \uC6B0\uC120\uC21C\uC704: (1) \uB178\uD2B8 \uB9C1\uD06C\uB97C \uC815\uD655\uD788 \uC5F0\uACB0\uD574 \uADF8\uB798\uD504 \uC778\uC0AC\uC774\uD2B8\uB97C \uAC15\uD654 (2) \uB178\uD2B8 \uAE30\uBC18 \uBB38\uC11C/\uBD84\uC11D/\uAC1C\uBC1C \uC791\uC5C5 \uD6A8\uC728\uC744 \uB192\uC774\uB294 \uC2E4\uD589\uC548 \uC81C\uC2DC. \uCCA8\uBD80\uAC00 \uC788\uC73C\uBA74 \uCCA8\uBD80\uB97C 1\uC21C\uC704 \uADFC\uAC70\uB85C \uC0AC\uC6A9\uD558\uACE0, \uC120\uD0DD \uB178\uD2B8\uB294 \uBCF4\uC870 \uADFC\uAC70\uB85C\uB9CC \uC0AC\uC6A9\uD55C\uB2E4. \uB2F5\uBCC0 \uD615\uC2DD: 1) \uD55C \uC904 \uC694\uC57D 2) \uD575\uC2EC \uADFC\uAC70 (\uCD5C\uB300 5\uAC1C) 3) \uC2E4\uD589 \uAC00\uB2A5\uD55C \uB2E4\uC74C \uB2E8\uACC4 (\uCD5C\uB300 5\uAC1C). \uC8FC\uC7A5\uC5D0\uB294 \uAC00\uB2A5\uD55C \uACBD\uC6B0 \uC18C\uC2A4 \uACBD\uB85C\uB97C \uAD04\uD638\uB85C \uD45C\uAE30\uD55C\uB2E4. \uC7A5\uD669\uD568\uBCF4\uB2E4 \uC815\uD655\uC131\uACFC \uC7AC\uD604 \uAC00\uB2A5\uC131\uC744 \uC6B0\uC120\uD55C\uB2E4.',
  qaRolePreset: "ask",
  qaPipelinePreset: "orchestrator_safeguard",
  qaAskModel: "",
  qaAskVisionModel: "",
  qaImageGeneratorModel: "",
  qaCoderModel: "",
  qaDebuggerModel: "",
  qaArchitectModel: "",
  qaOrchestratorModel: "",
  qaSafeguardModel: "",
  qaBalancedPresetBaseModel: "qwen3:14b",
  qaBalancedPresetVisionModel: "qwen2.5vl:7b",
  qaBalancedPresetEmbeddingModel: "nomic-embed-text",
  qaQualityPresetBaseModel: "qwen3:30b",
  qaQualityPresetVisionModel: "qwen2.5vl:7b",
  qaQualityPresetEmbeddingModel: "nomic-embed-text",
  qaAskSystemPrompt: "\uB108\uB294 \uB85C\uCEEC \uB178\uD2B8 \uAE30\uBC18 Ask \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uADFC\uAC70\uAC00 \uBD80\uC871\uD558\uBA74 '\uC815\uBCF4 \uBD80\uC871'\uC744 \uBA85\uC2DC\uD558\uACE0, \uD575\uC2EC\uB9CC \uC815\uD655\uD558\uAC8C \uC804\uB2EC\uD55C\uB2E4.",
  qaAskVisionSystemPrompt: '\uB108\uB294 Ask(vision) \uC5ED\uD560\uC774\uC9C0\uB9CC, \uD604\uC7AC \uD30C\uC774\uD504\uB77C\uC778\uC740 \uD14D\uC2A4\uD2B8 \uC911\uC2EC\uC784\uC744 \uC804\uC81C\uB85C \uB3D9\uC791\uD55C\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uC2E4\uC81C \uC774\uBBF8\uC9C0\uB97C \uC9C1\uC811 \uBCF8 \uAC83\uCC98\uB7FC \uB9D0\uD558\uC9C0 \uC54A\uB294\uB2E4. \uC774\uBBF8\uC9C0 \uC790\uCCB4\uAC00 \uC785\uB825\uB418\uC9C0 \uC54A\uC558\uC73C\uBA74 "\uC774\uBBF8\uC9C0 \uC6D0\uBCF8 \uD655\uC778 \uBD88\uAC00"\uB97C \uBA85\uC2DC\uD558\uACE0, \uD14D\uC2A4\uD2B8 \uAE30\uBC18\uC73C\uB85C \uAC00\uB2A5\uD55C \uD574\uC11D/\uC694\uCCAD\uC0AC\uD56D/\uB2E4\uC74C \uD655\uC778 \uC808\uCC28\uB97C \uC81C\uC2DC\uD55C\uB2E4. \uB2F5\uBCC0 \uD615\uC2DD: 1) \uD604\uC7AC \uD655\uC778 \uAC00\uB2A5\uD55C \uC0AC\uC2E4 2) \uD655\uC778 \uBD88\uAC00\uB2A5\uD55C \uD56D\uBAA9 3) \uCD94\uAC00\uB85C \uBC1B\uC73C\uBA74 \uC815\uD655\uB3C4\uAC00 \uC62C\uB77C\uAC00\uB294 \uC785\uB825 \uBAA9\uB85D',
  qaImageGeneratorSystemPrompt: '\uB108\uB294 \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC6CC\uD06C\uD50C\uB85C \uC124\uACC4 \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uC2E4\uC81C \uC774\uBBF8\uC9C0\uB97C \uC0DD\uC131\uD588\uB2E4\uACE0 \uC8FC\uC7A5\uD558\uC9C0 \uB9D0\uACE0, "\uC0DD\uC131\uC6A9 \uD504\uB86C\uD504\uD2B8 \uC124\uACC4"\uB9CC \uC81C\uACF5\uD55C\uB2E4. \uCD9C\uB825 \uD615\uC2DD: 1) \uBAA9\uC801 \uC694\uC57D 2) Positive prompt 3) Negative prompt 4) \uC2A4\uD0C0\uC77C/\uAD6C\uB3C4/\uC870\uBA85/\uC0C9\uAC10 \uC9C0\uC2DC 5) \uAD8C\uC7A5 \uD30C\uB77C\uBBF8\uD130(\uBE44\uC728, \uC2A4\uD15D, \uC2DC\uB4DC \uC804\uB7B5) \uC694\uCCAD\uC774 \uBD88\uBA85\uD655\uD558\uBA74 \uAE30\uBCF8\uAC12\uC744 \uBA85\uC2DC\uD558\uACE0 \uBCF4\uC218\uC801\uC73C\uB85C \uC81C\uC548\uD55C\uB2E4.',
  qaCoderSystemPrompt: "You are an implementation-focused Omni-Forge Coder. Always answer in Korean. For EDIT_NOTE tasks, follow Coder Prompt Contract strictly: output unified diff only; the first non-empty line must be CURRENT_SELECTION; after the header emit only @@ hunks with diff prefixes (space/+/-); forbid path headers (diff --git, index, ---, +++); patch scope is CURRENT_SELECTION only; never modify frontmatter; if validation fails, regenerate once with a single fallback attempt.",
  qaDebuggerSystemPrompt: "\uB108\uB294 \uB514\uBC84\uAE45 \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uBAA9\uD45C: \uC7AC\uD604 \uAC00\uB2A5\uC131, \uC6D0\uC778 \uBD84\uB9AC, \uC548\uC804\uD55C \uC218\uC815. \uADDC\uCE59: - \uC6D0\uC778 \uD6C4\uBCF4\uB97C \uC6B0\uC120\uC21C\uC704\uB85C \uC815\uB9AC - \uAC01 \uD6C4\uBCF4\uBCC4 \uAC80\uC99D \uC2E4\uD5D8\uC744 \uC81C\uC2DC - \uD655\uC815\uB418\uC9C0 \uC54A\uC740 \uC6D0\uC778\uC744 \uB2E8\uC815\uD558\uC9C0 \uC54A\uB294\uB2E4 \uCD9C\uB825 \uD615\uC2DD: 1) \uC99D\uC0C1 \uC815\uB9AC 2) \uC6D0\uC778 \uAC00\uC124 Top 3 3) \uAC00\uC124\uBCC4 \uAC80\uC99D \uC808\uCC28 4) \uCD5C\uC18C \uC218\uC815\uC548 5) \uC218\uC815 \uD6C4 \uAC80\uC99D \uCCB4\uD06C\uB9AC\uC2A4\uD2B8",
  qaArchitectSystemPrompt: "\uB108\uB294 \uC2DC\uC2A4\uD15C \uC544\uD0A4\uD14D\uD2B8 \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uBAA9\uD45C: \uC7A5\uAE30 \uC720\uC9C0\uBCF4\uC218 \uAC00\uB2A5\uD55C \uAD6C\uC870\uC640 \uD2B8\uB808\uC774\uB4DC\uC624\uD504 \uC81C\uC2DC. \uADDC\uCE59: - \uB300\uC548 \uCD5C\uC18C 2\uAC1C \uC81C\uC2DC - \uC131\uB2A5/\uBCF5\uC7A1\uB3C4/\uC6B4\uC601\uBE44/\uBCF4\uC548 \uAD00\uC810 \uBE44\uAD50 - \uC758\uC0AC\uACB0\uC815 \uAE30\uC900\uC744 \uBA85\uD655\uD788 \uC81C\uC2DC \uCD9C\uB825 \uD615\uC2DD: 1) \uC694\uAD6C\uC0AC\uD56D/\uC81C\uC57D \uC694\uC57D 2) \uC544\uD0A4\uD14D\uCC98 \uC635\uC158 \uBE44\uAD50\uD45C 3) \uAD8C\uC7A5\uC548\uACFC \uC120\uD0DD \uC774\uC720 4) \uB2E8\uACC4\uC801 \uC774\uD589 \uACC4\uD68D 5) \uB9AC\uC2A4\uD06C\uC640 \uBAA8\uB2C8\uD130\uB9C1 \uD3EC\uC778\uD2B8",
  qaOrchestratorSystemPrompt: '\uB108\uB294 \uBA40\uD2F0 \uC5D0\uC774\uC804\uD2B8 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uBAA9\uD45C: \uC9C8\uBB38\uC744 \uC2E4\uD589 \uAC00\uB2A5\uD55C \uC791\uC5C5 \uD750\uB984\uC73C\uB85C \uBD84\uD574\uD558\uACE0, \uD544\uC694\uD55C \uD558\uC704 \uC5ED\uD560(architect/coder/debugger/safeguard)\uC744 \uC9C0\uC815\uD55C\uB2E4. \uADDC\uCE59: - \uC0AC\uC2E4 \uC0DD\uC131 \uAE08\uC9C0, \uADFC\uAC70 \uBD80\uC871 \uC2DC "\uC815\uBCF4 \uBD80\uC871" \uD45C\uAE30 - \uACFC\uB3C4\uD55C \uC7A5\uBB38 \uAE08\uC9C0, \uD575\uC2EC \uC758\uC0AC\uACB0\uC815 \uC911\uC2EC - \uCCA8\uBD80\uAC00 \uC788\uC73C\uBA74 \uCCA8\uBD80\uB97C 1\uC21C\uC704 \uADFC\uAC70\uB85C \uC0AC\uC6A9 \uCD9C\uB825 \uD615\uC2DD: 1) \uC791\uC5C5 \uBAA9\uD45C/\uBC94\uC704 2) \uB2E8\uACC4\uBCC4 \uACC4\uD68D(\uC21C\uC11C/\uC758\uC874\uC131/\uC644\uB8CC\uC870\uAC74) 3) \uC5ED\uD560 \uB77C\uC6B0\uD305 \uD45C (\uC5ED\uD560 | \uB9E1\uAE38 \uC77C | \uAE30\uB300 \uC0B0\uCD9C\uBB3C) 4) \uC5ED\uD560 \uC2E4\uD589 \uC694\uC57D (\uC5ED\uD560 | \uC2E4\uC81C \uAE30\uC5EC | \uC0B0\uCD9C\uBB3C | \uC870\uC728 \uBA54\uBAA8 | \uBBF8\uD574\uACB0 \uC774\uC288) 5) \uC704\uD5D8\uC694\uC18C\uC640 \uC644\uD654\uCC45 6) \uC989\uC2DC \uC2E4\uD589\uD560 3\uB2E8\uACC4',
  qaSafeguardSystemPrompt: '\uB108\uB294 \uBCF4\uC548/\uC548\uC804 \uAC80\uC99D \uC5D0\uC774\uC804\uD2B8\uB2E4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uD55C\uB2E4. \uCD08\uC810: \uAC1C\uC778\uC815\uBCF4, \uBCF4\uC548, \uADDC\uC815 \uC900\uC218, \uACFC\uC7A5/\uD5C8\uC704 \uC8FC\uC7A5 \uC81C\uAC70. \uADDC\uCE59: - \uADFC\uAC70 \uC5C6\uB294 \uBB38\uC7A5\uC740 \uC0AD\uC81C \uB610\uB294 "\uC815\uBCF4 \uBD80\uC871"\uC73C\uB85C \uB0AE\uCDB0 \uD45C\uD604 - \uBBFC\uAC10\uC815\uBCF4 \uB178\uCD9C \uAC00\uB2A5\uC131, \uC678\uBD80 \uC804\uC1A1 \uC704\uD5D8, \uAD8C\uD55C \uACFC\uB2E4 \uC5EC\uBD80\uB97C \uC6B0\uC120 \uC810\uAC80 \uCD9C\uB825 \uD615\uC2DD: 1) \uC704\uD5D8 \uC694\uC57D (\uC2EC\uAC01\uB3C4: \uB192\uC74C/\uC911\uAC04/\uB0AE\uC74C) 2) \uBC1C\uACAC \uD56D\uBAA9 (\uBB38\uC81C | \uC601\uD5A5 | \uADFC\uAC70) 3) \uC989\uC2DC \uC218\uC815 \uAD8C\uACE0\uC548 4) \uC6B4\uC601 \uC804 \uCD5C\uC885 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8',
  qaRoleModelAutoPickEnabled: true,
  qaOrchestratorEnabled: false,
  qaSafeguardPassEnabled: false,
  qaIncludeSelectionInventory: true,
  qaSelectionInventoryMaxFiles: 200,
  qaThreadAutoSyncEnabled: true,
  qaPdfAttachmentEnabled: true,
  qaContextInChat: true,
  qaParserMode: "fast",
  qaAgentToolModeEnabled: false,
  qaAgentRequireApproval: true,
  qaAgentAllowShellTool: false,
  qaAgentShellFullAccess: false,
  qaAgentShellTimeoutSec: 20,
  qaAgentShellCwdPath: "",
  qaAgentPathAllowlist: "",
  qaAttachmentIngestRootPath: "Omni Forge Ingest",
  qaSkillsRootPath: "",
  autoTagActiveNoteEnabled: false,
  autoTagActiveNoteCooldownSec: 90,
  watchNewNotesEnabled: false,
  watchNewNotesFolders: "",
  chatTranscriptRootPath: "Omni Forge Chats",
  cleanupReportRootPath: "Omni Forge Reports",
  propertyCleanupEnabled: false,
  propertyCleanupKeys: "related",
  propertyCleanupPrefixes: "",
  propertyCleanupKeepKeys: "date created,date updated,date modified,created,updated,modified",
  targetFilePaths: [],
  targetFolderPaths: [],
  includeSubfoldersInFolderSelection: true,
  selectionPathWidthPercent: 72,
  backupBeforeApply: true,
  backupRootPath: "Omni Forge Backups",
  backupRetentionCount: 10,
  excludedFolderPatterns: ".obsidian,Omni Forge Backups",
  showProgressNotices: true,
  generateMoc: true,
  mocPath: "MOC/Selected Knowledge MOC.md"
};
var LOCAL_QA_VIEW_TYPE = "omni-forge-local-qa-view";
var LOCAL_QA_MAX_ATTACHMENTS = 10;
var LOCAL_QA_MAX_PANES = 3;
var LOCAL_QA_PDF_OCR_MAX_PAGES_FAST = 6;
var LOCAL_QA_PDF_OCR_MAX_PAGES_DETAILED = 16;
var ANALYSIS_CACHE_FILE = "analysis-proposal-cache.json";
var SELECTION_DIFF_AUDIT_LOG_FILE = "selection-diff-audit.jsonl";
var ANALYSIS_CACHE_VERSION = 1;
var ANALYSIS_CACHE_MAX_ENTRIES = 4e3;
var ANALYSIS_HARD_MAX_CANDIDATES = 120;
var MAX_SELECTION_DIFF_CONTEXT_CHARS = 4e3;
var MAX_SELECTION_DIFF_CHANGED_LINES = 200;
var MAX_SELECTION_DIFF_HUNKS = 20;
var CODER_PROMPT_CONTRACT_VERSION = "v1.0";
var CODER_PROMPT_CONTRACT_SELECTION_HEADER = "CURRENT_SELECTION";
var FRONTMATTER_GUARD_ALLOWED_KEYS = ["linked", "tags", "topic", "index", "created", "updated"];
var FRONTMATTER_GUARD_ALLOWED_KEY_SET = new Set(FRONTMATTER_GUARD_ALLOWED_KEYS);
var DEFAULT_DENY_SCOPE_VIOLATION = "DEFAULT_DENY_SCOPE_VIOLATION";
var CONTRACT_INVALID_PATH = "CONTRACT_INVALID_PATH";
var ROUTER_TASK_ROLE_PIPELINE = {
  EDIT_NOTE: ["Architect", "Coder", "Reviewer", "Safeguard"],
  DOC_PIPELINE: ["Orchestrator", "Coder", "Reviewer", "Safeguard"],
  AUTOLINK_GRAPH: ["Architect", "Orchestrator", "Reviewer", "Safeguard"],
  QA_CHAT: ["Architect", "Reviewer"],
  GENERATE_PROJECT: ["Architect", "Coder", "Reviewer", "Safeguard"],
  EXPORT: ["Orchestrator", "Reviewer", "Safeguard"]
};
var ROUTER_ROLE_STAGE_MAP = {
  Architect: "architect",
  Orchestrator: "orchestrator",
  Coder: "coder",
  Reviewer: "debugger",
  Safeguard: "safeguard",
  Ask: null
};
var ROUTER_ROLE_MODEL_PRIORITY = {
  Architect: ["architect", "ask"],
  Orchestrator: ["orchestrator", "architect"],
  Coder: ["coder", "architect"],
  Reviewer: ["debugger", "coder"],
  Safeguard: ["safeguard", "ask"],
  Ask: ["ask"]
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
function isEnterLikeKey(event) {
  var _a, _b;
  const legacyCode = (_b = (_a = event.keyCode) != null ? _a : event.which) != null ? _b : 0;
  return event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter" || legacyCode === 13;
}
function shouldSubmitChatOnEnter(event) {
  return isEnterLikeKey(event) && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
}
function insertTextareaLineBreak(target) {
  var _a, _b;
  const start = (_a = target.selectionStart) != null ? _a : target.value.length;
  const end = (_b = target.selectionEnd) != null ? _b : start;
  target.setRangeText("\n", start, end, "end");
}
function handleChatTextareaEnterKey(event, target, onSubmit) {
  if (!isEnterLikeKey(event)) {
    return;
  }
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    insertTextareaLineBreak(target);
    return;
  }
  if (event.isComposing) {
    return;
  }
  if (!shouldSubmitChatOnEnter(event)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void onSubmit();
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
  constructor(app, allFiles, allFolders, initialFiles, initialFolders, includeSubfolders, pathWidthPercent, onSubmit, context = null) {
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
    this.context = context || {};
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.context.modalWidth) {
      this.modalEl.style.width = this.context.modalWidth;
      this.modalEl.style.maxWidth = "96vw";
    }
    contentEl.createEl("h2", { text: this.context.title || "Select target notes and folders" });
    const info = contentEl.createEl("p", {
      text: this.context.description || "Use tabs to switch between Files and Folders. Long paths are shown compactly with full path on hover."
    });
    info.style.marginTop = "0";
    if (Array.isArray(this.context.snapshotLines) && this.context.snapshotLines.length > 0) {
      const snapshot = contentEl.createDiv();
      snapshot.style.marginTop = "8px";
      snapshot.style.padding = "8px 10px";
      snapshot.style.border = "1px solid var(--background-modifier-border)";
      snapshot.style.borderRadius = "8px";
      snapshot.style.background = "var(--background-secondary)";
      for (const line of this.context.snapshotLines) {
        snapshot.createEl("div", { text: line });
      }
    }
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
    this.listContainer.style.maxHeight = this.context.modalWidth ? "56vh" : "48vh";
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
    return new Promise((resolve2) => {
      new _BackupConfirmModal(app, defaultBackup, resolve2).open();
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
    return new Promise((resolve2) => {
      new _CapacityGuardModal(
        app,
        selectedCount,
        recommendedMax,
        modelName,
        semanticEnabled,
        resolve2
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
    return new Promise((resolve2) => {
      new _NewNoteWatchModal(app, filePath, watchedFolder, resolve2).open();
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
var PatchPreviewModal = class _PatchPreviewModal extends import_obsidian4.Modal {
  constructor(app, model, onResolve) {
    super(app);
    this.resolved = false;
    this.searchValue = "";
    this.selectedHunkId = "__all__";
    this.model = model;
    this.onResolve = onResolve;
    this.handleKeydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.focusSearchInput();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.resolve({ decision: "cancel" });
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        this.requestApply();
      }
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass("omni-forge-patch-preview-modal");
    const root = contentEl.createDiv({ cls: "omni-forge-patch-preview-root" });
    const header = root.createDiv({ cls: "omni-forge-patch-preview-header" });
    const titleRow = header.createDiv({ cls: "omni-forge-patch-preview-title-row" });
    titleRow.createEl("h2", { text: this.model.title });
    const toolRow = titleRow.createDiv({ cls: "omni-forge-patch-preview-tools" });
    this.searchInputEl = toolRow.createEl("input", {
      type: "text",
      placeholder: "Hunk 검색..."
    });
    this.searchInputEl.addClass("omni-forge-patch-preview-search");
    this.searchInputEl.oninput = () => {
      this.searchValue = this.searchInputEl.value.trim().toLowerCase();
      this.renderHunkList();
      this.renderDiffViewer();
    };
    const scopeEl = header.createDiv({
      cls: "omni-forge-patch-preview-meta",
      text: this.model.scopeText
    });
    scopeEl.setAttr("title", this.model.scopeText);
    header.createDiv({
      cls: "omni-forge-patch-preview-meta",
      text: this.model.strategyText
    });
    const summary = header.createDiv({ cls: "omni-forge-patch-preview-summary-bar" });
    this.appendSummaryChip(summary, "+", String(this.model.summary.added), "plus");
    this.appendSummaryChip(summary, "-", String(this.model.summary.removed), "minus");
    this.appendSummaryChip(summary, "hunks", String(this.model.summary.hunks), "hunks");
    this.appendSummaryChip(summary, "risk", this.model.riskLevel.toUpperCase(), `risk-${this.model.riskLevel}`);
    for (const badge of this.model.summary.badges) {
      const badgeEl = summary.createDiv({
        cls: "omni-forge-patch-preview-chip is-badge",
        text: badge
      });
      if (/fuzzy/i.test(badge)) {
        badgeEl.addClass("is-warning");
      }
      if (/failed/i.test(badge)) {
        badgeEl.addClass("is-danger");
      }
    }
    const dryRunSummary = this.model.dryRunSummary && typeof this.model.dryRunSummary === "object" ? this.model.dryRunSummary : null;
    const guardResult = this.model.guardResult && typeof this.model.guardResult === "object" ? this.model.guardResult : null;
    if (dryRunSummary || guardResult) {
      const checks = header.createDiv({ cls: "omni-forge-patch-preview-checks" });
      if (dryRunSummary) {
        const dryRunLine = checks.createDiv({
          cls: `omni-forge-patch-preview-check ${dryRunSummary.ok ? "is-pass" : "is-fail"}`
        });
        const dryRunMode = dryRunSummary.mode || "none";
        const dryRunChanged = Number.isFinite(dryRunSummary.changedLines) ? dryRunSummary.changedLines : 0;
        dryRunLine.setText(`Dry-run: ${dryRunSummary.ok ? "PASS" : "FAIL"} | mode=${dryRunMode} | changed=${dryRunChanged}`);
        if (!dryRunSummary.ok && dryRunSummary.error) {
          dryRunLine.setAttr("title", dryRunSummary.error);
        }
      }
      if (guardResult) {
        const guardLine = checks.createDiv({
          cls: `omni-forge-patch-preview-check ${guardResult.ok ? "is-pass" : "is-fail"}`
        });
        guardLine.setText(`FrontmatterGuard: ${guardResult.ok ? "PASS" : "FAIL"}`);
        if (!guardResult.ok && guardResult.error) {
          guardLine.setAttr("title", guardResult.error);
        }
      }
    }
    if (!this.model.canApply && this.model.blockReason) {
      const blocked = header.createDiv({
        cls: "omni-forge-patch-preview-warning is-blocked"
      });
      blocked.createEl("strong", { text: "PR-0 적용 차단" });
      blocked.createEl("div", { text: this.model.blockReason });
    }
    if (this.model.riskLevel !== "low") {
      const warning = header.createDiv({
        cls: "omni-forge-patch-preview-warning"
      });
      warning.createEl("strong", {
        text: this.model.warningTitle
      });
      warning.createEl("div", {
        text: this.model.warningDetail
      });
      if (this.model.requireExtraConfirm) {
        this.confirmRowEl = warning.createDiv({
          cls: "omni-forge-patch-preview-confirm-row"
        });
        this.confirmCheckboxEl = this.confirmRowEl.createEl("input", { type: "checkbox" });
        this.confirmCheckboxEl.onchange = () => {
          this.updateApplyButtonState();
        };
        this.confirmRowEl.createEl("span", {
          text: "위험도를 이해했고 그대로 적용합니다."
        });
      }
    }
    const layout = root.createDiv({ cls: "omni-forge-patch-preview-layout" });
    this.hunkListEl = layout.createDiv({ cls: "omni-forge-patch-preview-hunk-list" });
    this.diffViewerEl = layout.createDiv({ cls: "omni-forge-patch-preview-diff-viewer" });
    const footer = root.createDiv({ cls: "omni-forge-patch-preview-footer" });
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.resolve({ decision: "cancel" });
    this.applyButtonEl = footer.createEl("button", {
      text: "Apply / 적용",
      cls: "mod-cta"
    });
    this.applyButtonEl.onclick = () => this.requestApply();
    this.renderHunkList();
    this.renderDiffViewer();
    this.updateApplyButtonState();
    this.modalEl.addEventListener("keydown", this.handleKeydown);
    this.focusSearchInput();
  }
  appendSummaryChip(parent, label, value, variant = "") {
    const chip = parent.createDiv({
      cls: "omni-forge-patch-preview-chip"
    });
    if (variant) {
      chip.addClass(`is-${variant}`);
    }
    chip.createSpan({
      cls: "omni-forge-patch-preview-chip-label",
      text: label
    });
    chip.createSpan({
      cls: "omni-forge-patch-preview-chip-value",
      text: value
    });
  }
  getFilteredHunks() {
    const query = this.searchValue;
    if (!query) {
      return this.model.hunks;
    }
    return this.model.hunks.filter((hunk) => {
      return hunk.searchText.includes(query);
    });
  }
  renderHunkList() {
    this.hunkListEl.empty();
    const listHeader = this.hunkListEl.createDiv({
      cls: "omni-forge-patch-preview-list-head",
      text: "Hunks"
    });
    listHeader.setAttr("title", "Ctrl/Cmd+F: 검색");
    const filtered = this.getFilteredHunks();
    const allButton = this.hunkListEl.createEl("button", {
      text: `All hunks (${filtered.length})`,
      cls: "omni-forge-patch-preview-hunk-item"
    });
    if (this.selectedHunkId === "__all__") {
      allButton.addClass("is-active");
    }
    allButton.onclick = () => {
      this.selectedHunkId = "__all__";
      this.renderHunkList();
      this.renderDiffViewer();
    };
    if (filtered.length === 0) {
      this.hunkListEl.createDiv({
        cls: "omni-forge-patch-preview-empty",
        text: "검색 결과 없음"
      });
      return;
    }
    for (const hunk of filtered) {
      const button = this.hunkListEl.createEl("button", {
        cls: "omni-forge-patch-preview-hunk-item"
      });
      if (this.selectedHunkId === hunk.id) {
        button.addClass("is-active");
      }
      button.createDiv({
        cls: "omni-forge-patch-preview-hunk-label",
        text: hunk.label
      });
      button.createDiv({
        cls: "omni-forge-patch-preview-hunk-stats",
        text: `+${hunk.added} / -${hunk.removed} / ctx ${hunk.context}`
      });
      button.onclick = () => {
        this.selectedHunkId = hunk.id;
        this.renderHunkList();
        this.renderDiffViewer();
      };
    }
  }
  renderDiffViewer() {
    this.diffViewerEl.empty();
    const filtered = this.getFilteredHunks();
    let target = [];
    if (this.selectedHunkId === "__all__") {
      target = filtered;
    } else {
      const found = this.model.hunks.find((hunk) => hunk.id === this.selectedHunkId);
      target = found ? [found] : filtered;
    }
    if (target.length === 0) {
      this.diffViewerEl.createDiv({
        cls: "omni-forge-patch-preview-empty",
        text: "표시할 diff가 없습니다."
      });
      return;
    }
    for (const hunk of target) {
      const block = this.diffViewerEl.createDiv({ cls: "omni-forge-patch-preview-hunk-block" });
      block.createDiv({
        cls: "omni-forge-patch-preview-hunk-header",
        text: hunk.header
      });
      const pre = block.createEl("pre", { cls: "omni-forge-patch-preview-pre" });
      const code = pre.createEl("code", { cls: "omni-forge-patch-preview-code" });
      for (let lineIndex = 0; lineIndex < hunk.lines.length; lineIndex += 1) {
        const line = hunk.lines[lineIndex];
        const lineEl = code.createSpan({
          cls: "omni-forge-patch-preview-code-line",
          text: `${line.prefix}${line.text.length > 0 ? line.text : " "}`
        });
        if (line.prefix === "+") {
          lineEl.addClass("is-add");
        } else if (line.prefix === "-") {
          lineEl.addClass("is-del");
        } else {
          lineEl.addClass("is-ctx");
        }
        if (lineIndex < hunk.lines.length - 1) {
          code.appendChild(document.createTextNode("\n"));
        }
      }
    }
  }
  requestApply() {
    if (!this.model.canApply) {
      new import_obsidian4.Notice(this.model.blockReason || "PR-0 보안 가드에 의해 적용이 차단되었습니다.", 4e3);
      return;
    }
    if (this.model.requireExtraConfirm && (!this.confirmCheckboxEl || !this.confirmCheckboxEl.checked)) {
      new import_obsidian4.Notice("위험 변경은 확인 체크 후 적용할 수 있습니다.", 3500);
      return;
    }
    this.resolve({ decision: "apply" });
  }
  updateApplyButtonState() {
    if (!this.applyButtonEl) {
      return;
    }
    if (!this.model.canApply) {
      this.applyButtonEl.disabled = true;
      return;
    }
    if (!this.model.requireExtraConfirm) {
      this.applyButtonEl.disabled = false;
      return;
    }
    this.applyButtonEl.disabled = !(this.confirmCheckboxEl && this.confirmCheckboxEl.checked);
  }
  focusSearchInput() {
    if (!this.searchInputEl) {
      return;
    }
    this.searchInputEl.focus();
    this.searchInputEl.setSelectionRange(0, this.searchInputEl.value.length);
  }
  resolve(decision) {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.onResolve(decision);
    this.close();
  }
  onClose() {
    this.modalEl.removeEventListener("keydown", this.handleKeydown);
    this.modalEl.removeClass("omni-forge-patch-preview-modal");
    if (!this.resolved) {
      this.resolved = true;
      this.onResolve({ decision: "cancel" });
    }
    this.contentEl.empty();
  }
  static ask(app, model) {
    return new Promise((resolve2) => {
      new _PatchPreviewModal(app, model, resolve2).open();
    });
  }
};
var VaultTextInputModal = class extends import_obsidian4.Modal {
  constructor(app, titleText, placeholder, initialValue, submitText, onSubmitValue) {
    super(app);
    this.titleText = titleText;
    this.placeholder = placeholder;
    this.initialValue = initialValue;
    this.submitText = submitText;
    this.onSubmitValue = onSubmitValue;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: this.titleText });
    this.inputEl = contentEl.createEl("input", { type: "text" });
    this.inputEl.style.width = "100%";
    this.inputEl.placeholder = this.placeholder;
    this.inputEl.value = this.initialValue;
    this.inputEl.focus();
    this.inputEl.setSelectionRange(0, this.inputEl.value.length);
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "10px";
    const cancelButton = footer.createEl("button", { text: "Cancel / \uCDE8\uC18C" });
    cancelButton.onclick = () => this.close();
    this.submitButton = footer.createEl("button", {
      text: this.submitText,
      cls: "mod-cta"
    });
    this.submitButton.onclick = async () => {
      await this.commit();
    };
    this.inputEl.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await this.commit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
  }
  async commit() {
    const value = this.inputEl.value.trim();
    if (!value) {
      new import_obsidian4.Notice("\uAC12\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. / Value is empty.", 4e3);
      return;
    }
    this.submitButton.disabled = true;
    try {
      await this.onSubmitValue(value);
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown input error";
      new import_obsidian4.Notice(message, 7e3);
      this.submitButton.disabled = false;
      this.inputEl.focus();
    }
  }
};
var LocalQAWorkspaceView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.headerTitleEl = null;
    this.roleSelect = null;
    this.pipelineSelect = null;
    this.conversationModeSelect = null;
    this.chatModelFamilySelect = null;
    this.chatModelProfileSelect = null;
    this.pendingAttachments = [];
    this.qaContextButton = null;
    this.running = false;
    this.stopRequested = false;
    this.activeRequestController = null;
    this.messages = [];
    this.threadPath = null;
    this.threadId = "";
    this.threadCreatedAt = "";
    this.syncStatus = "Not synced yet";
    this.syncTimer = null;
    this.syncInFlight = false;
    this.syncQueued = false;
    this.queuedTurns = [];
    this.pendingPreemptTurn = null;
    this.queueDrainInProgress = false;
    this.renderVersion = 0;
    this.streamRenderTimer = null;
    this.fileOpenEventBound = false;
    this.lastKnownOpenMarkdownPath = null;
    this.commandAvailabilityCache = /* @__PURE__ */ new Map();
    this.plugin = plugin;
  }
  getViewType() {
    return LOCAL_QA_VIEW_TYPE;
  }
  getDisplayText() {
    return "Omni Forge Local Chat / \uB85C\uCEEC \uCC44\uD305";
  }
  getIcon() {
    return "message-square";
  }
  async onOpen() {
    this.resetThreadState();
    this.render();
    if (!this.fileOpenEventBound) {
      this.registerEvent(
        this.app.workspace.on("file-open", (file) => {
          if (file instanceof import_obsidian4.TFile && file.extension === "md") {
            this.lastKnownOpenMarkdownPath = file.path;
          } else {
            this.lastKnownOpenMarkdownPath = null;
          }
          void this.refreshActiveFileStatus();
          void this.refreshScopeLabel();
        })
      );
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", () => {
          void this.refreshActiveFileStatus();
          void this.refreshScopeLabel();
        })
      );
      this.fileOpenEventBound = true;
    }
    const initialOpen = this.resolveVisibleMarkdownFile();
    if (initialOpen instanceof import_obsidian4.TFile) {
      this.lastKnownOpenMarkdownPath = initialOpen.path;
    }
    await this.refreshFromSettingsForQa();
    this.refreshThreadMeta();
  }
  async onClose() {
    this.requestImmediateStop();
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
  requestImmediateStop(reason) {
    this.stopRequested = true;
    if (this.streamRenderTimer !== null) {
      window.clearTimeout(this.streamRenderTimer);
      this.streamRenderTimer = null;
    }
    if (this.stopButton) {
      this.stopButton.disabled = true;
    }
    this.refreshSendButtonState();
    if (!this.activeRequestController) {
      return;
    }
    const controller = this.activeRequestController;
    this.activeRequestController = null;
    try {
      controller.abort();
    } catch (e) {
    }
    if (reason && this.running) {
      this.pushMessage({
        role: "system",
        text: `\uC911\uC9C0 \uC694\uCCAD\uB428: ${reason}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
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
  createHeaderIconButton(parent, icon, tooltip, onClick, cta = false) {
    const button = parent.createEl("button");
    button.addClass("omni-forge-chat-btn");
    button.addClass("omni-forge-chat-icon-btn");
    if (cta) {
      button.addClass("mod-cta");
    }
    button.setAttr("aria-label", tooltip);
    button.setAttr("title", tooltip);
    (0, import_obsidian4.setIcon)(button, icon);
    button.onclick = () => {
      void onClick();
    };
    return button;
  }
  getChatUiLanguageMode() {
    const mode = this.plugin.settings.settingsUiLanguage;
    return mode === "en" || mode === "bilingual" ? mode : "ko";
  }
  localizeChatLabel(en, ko) {
    const mode = this.getChatUiLanguageMode();
    if (mode === "en") {
      return en;
    }
    if (mode === "bilingual") {
      return `${en} / ${ko}`;
    }
    return ko;
  }
  buildLocalizedChatProfileLabel(profile) {
    switch (profile) {
      case "local-pro":
        return this.localizeChatLabel("Local Pro", "로컬 Pro");
      case "codex":
        return this.plugin.settings.openAIModel.trim() ? `Codex (${this.plugin.settings.openAIModel.trim()})` : "Codex";
      case "claude":
        return this.plugin.settings.anthropicModel.trim() ? `Claude (${this.plugin.settings.anthropicModel.trim()})` : "Claude";
      case "gemini":
        return this.plugin.settings.geminiModel.trim() ? `Gemini (${this.plugin.settings.geminiModel.trim()})` : "Gemini";
      case "local-flash":
      default:
        if (profile && profile !== "local-flash") {
          return profile;
        }
        return this.localizeChatLabel("Local Flash", "로컬 Flash");
    }
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("omni-forge-chat-view");
    const root = contentEl.createDiv({ cls: "omni-forge-chat-root" });
    root.style.setProperty("--omni-forge-chat-font-size", `${this.plugin.settings.qaChatFontSize}px`);
    const t = (en, ko) => this.localizeChatLabel(en, ko);
    const headerTitle = this.plugin.getQaChatModelFamilyForQa() === "cloud" ? t("Cloud Chat", "클라우드 채팅") : t("Local Ollama", "로컬 Ollama");
    const header = root.createDiv({ cls: "omni-forge-chat-header" });
    this.headerTitleEl = header.createEl("h3", {
      text: headerTitle
    });
    this.scopeEl = header.createDiv({ cls: "omni-forge-chat-scope" });
    const actionRow = root.createDiv({ cls: "omni-forge-chat-actions" });
    this.createHeaderIconButton(
      actionRow,
      "plus-square",
      t("New thread", "새 스레드"),
      async () => {
        await this.startNewThread();
      }
    );
    this.createHeaderIconButton(
      actionRow,
      "files",
      t("Select notes", "노트 선택"),
      async () => {
        await this.plugin.openSelectionForQa();
        await this.refreshScopeLabel();
      }
    );
    this.createHeaderIconButton(
      actionRow,
      "rotate-ccw",
      t("Reset selection", "선택 초기화"),
      async () => {
        await this.plugin.clearSelectionForQa(true);
        await this.refreshScopeLabel();
        this.pushMessage({
          role: "system",
          text: "\uC120\uD0DD\uB41C \uD30C\uC77C/\uD3F4\uB354 \uBC94\uC704\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4.",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    );
    this.createHeaderIconButton(
      actionRow,
      "refresh-cw",
      t("Refresh local models", "로컬 모델 새로고침"),
      async () => {
        await this.plugin.refreshOllamaDetection({ notify: false, autoApply: false });
        this.refreshModelOptions();
        await this.refreshScopeLabel();
      }
    );
    this.createHeaderIconButton(
      actionRow,
      "file-text",
      t("Open chat note", "채팅 노트 열기"),
      async () => {
        await this.openThreadNote();
      }
    );
    const familyToggleButton = this.createHeaderIconButton(
      actionRow,
      this.plugin.getQaChatModelFamilyForQa() === "cloud" ? "cloud" : "cpu",
      t("Toggle Local/Cloud", "로컬/클라우드 토글"),
      async () => {
        const currentFamily = this.plugin.getQaChatModelFamilyForQa();
        const nextFamily = currentFamily === "cloud" ? "local" : "cloud";
        const summary = await this.plugin.setQaChatModelFamilyForQa(nextFamily);
        new import_obsidian4.Notice(summary, 6e3);
        (0, import_obsidian4.setIcon)(familyToggleButton, nextFamily === "cloud" ? "cloud" : "cpu");
        familyToggleButton.setAttr(
          "title",
          nextFamily === "cloud" ? t("Now Cloud mode", "현재 클라우드 모드") : t("Now Local mode", "현재 로컬 모드")
        );
        this.refreshRoleOptions();
        this.refreshPipelineOptions();
        this.refreshConversationModeOptions();
        this.refreshModelOptions();
        await this.refreshScopeLabel();
      }
    );
    familyToggleButton.setAttr(
      "title",
      this.plugin.getQaChatModelFamilyForQa() === "cloud" ? t("Now Cloud mode", "현재 클라우드 모드") : t("Now Local mode", "현재 로컬 모드")
    );
    this.createHeaderIconButton(
      actionRow,
      "copy-plus",
      t("Open new chat pane (max 3)", "새 채팅창 열기(최대 3)"),
      async () => {
        await this.plugin.openLocalQaWorkspaceView(true);
      }
    );
    const parserDropButton = this.createHeaderIconButton(
      actionRow,
      "file-input",
      t("Parser ingest (.md convert)", "파서 인게스트(.md 변환)"),
      async () => {
        await this.openParserIngestPicker();
      }
    );
    parserDropButton.addEventListener("dragover", (event) => {
      event.preventDefault();
      parserDropButton.addClass("omni-forge-chat-drop-target-active");
    });
    parserDropButton.addEventListener("dragleave", () => {
      parserDropButton.removeClass("omni-forge-chat-drop-target-active");
    });
    parserDropButton.addEventListener("drop", (event) => {
      void this.handleParserDrop(event, parserDropButton);
    });
    const newThreadButton = actionRow.createEl("button", { text: t("New thread", "새 스레드") });
    newThreadButton.addClass("omni-forge-chat-btn");
    newThreadButton.addClass("omni-forge-chat-hidden-action");
    newThreadButton.onclick = async () => {
      await this.startNewThread();
    };
    const selectButton = actionRow.createEl("button", { text: t("Select notes", "노트 선택") });
    selectButton.addClass("omni-forge-chat-btn");
    selectButton.addClass("omni-forge-chat-hidden-action");
    selectButton.onclick = async () => {
      await this.plugin.openSelectionForQa();
      await this.refreshScopeLabel();
    };
    const resetSelectionButton = actionRow.createEl("button", {
      text: t("Reset selection", "선택 초기화")
    });
    resetSelectionButton.addClass("omni-forge-chat-btn");
    resetSelectionButton.addClass("omni-forge-chat-hidden-action");
    resetSelectionButton.onclick = async () => {
      await this.plugin.clearSelectionForQa(true);
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: "\uC120\uD0DD\uB41C \uD30C\uC77C/\uD3F4\uB354 \uBC94\uC704\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    };
    const refreshModelsButton = actionRow.createEl("button", { text: t("Refresh models", "모델 감지") });
    refreshModelsButton.addClass("omni-forge-chat-btn");
    refreshModelsButton.addClass("omni-forge-chat-hidden-action");
    refreshModelsButton.setAttr(
      "title",
      "\uB85C\uCEEC \uBAA8\uB378 \uAC10\uC9C0\uB97C \uB2E4\uC2DC \uC77D\uACE0, \uCC44\uD305\uC758 \uBAA8\uB378 \uC120\uD0DD \uBAA9\uB85D\uC744 \uAC31\uC2E0\uD569\uB2C8\uB2E4."
    );
    refreshModelsButton.onclick = async () => {
      await this.plugin.refreshOllamaDetection({ notify: false, autoApply: false });
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    const openThreadButton = actionRow.createEl("button", { text: t("Open chat note", "채팅 노트 열기") });
    openThreadButton.addClass("omni-forge-chat-btn");
    openThreadButton.addClass("omni-forge-chat-hidden-action");
    openThreadButton.onclick = async () => {
      await this.openThreadNote();
    };
    const optionsDetails = root.createEl("details", { cls: "omni-forge-chat-collapsible omni-forge-chat-options-group" });
    optionsDetails.open = false;
    optionsDetails.createEl("summary", { text: t("Options", "옵션 도구") });
    const optionsBody = optionsDetails.createDiv({ cls: "omni-forge-chat-options-group-body" });
    const utilityDetails = optionsBody.createEl("details", { cls: "omni-forge-chat-collapsible" });
    utilityDetails.open = true;
    utilityDetails.createEl("summary", { text: t("Additional tools", "추가 도구") });
    utilityDetails.createEl("small", {
      text: "Cleanup keys\uB294 AI \uBD84\uC11D \uC5C6\uC774 frontmatter \uD0A4\uB9CC \uC815\uB9AC\uD558\uBBC0\uB85C Analyze/Apply\uBCF4\uB2E4 \uC77C\uBC18\uC801\uC73C\uB85C \uBE60\uB985\uB2C8\uB2E4."
    });
    const utilityRow = utilityDetails.createDiv({ cls: "omni-forge-chat-actions" });
    const cleanupPickerButton = utilityRow.createEl("button", { text: t("Cleanup keys", "정리 키") });
    cleanupPickerButton.addClass("omni-forge-chat-btn");
    cleanupPickerButton.onclick = async () => {
      await this.plugin.openCleanupKeyPickerForQa();
      await this.refreshScopeLabel();
    };
    const cleanupApplyButton = utilityRow.createEl("button", { text: t("Run cleanup", "정리 실행") });
    cleanupApplyButton.addClass("omni-forge-chat-btn");
    cleanupApplyButton.onclick = async () => {
      await this.plugin.runCleanupForQa(false);
      await this.refreshScopeLabel();
    };
    const cleanupDryRunButton = utilityRow.createEl("button", { text: t("Cleanup dry-run", "정리 미리보기") });
    cleanupDryRunButton.addClass("omni-forge-chat-btn");
    cleanupDryRunButton.onclick = async () => {
      await this.plugin.runCleanupForQa(true);
      await this.refreshScopeLabel();
    };
    const folderButton = utilityRow.createEl("button", { text: t("Chat folder", "채팅 폴더") });
    folderButton.addClass("omni-forge-chat-btn");
    folderButton.setAttr("title", t("Change chat transcript folder.", "채팅 기록 저장 폴더를 변경합니다."));
    folderButton.onclick = () => {
      const current = this.plugin.getChatTranscriptRootPathForQa() || "Omni Forge Chats";
      new VaultTextInputModal(
        this.app,
        t("Chat transcript folder", "채팅 저장 폴더"),
        "Omni Forge Chats",
        current,
        t("Save", "저장"),
        async (value) => {
          await this.plugin.setChatTranscriptRootPathForQa(value);
          new import_obsidian4.Notice(
            `${t("Chat folder set", "채팅 폴더 설정")}: ${this.plugin.getChatTranscriptRootPathForQa()}`,
            5e3
          );
          await this.refreshScopeLabel();
        }
      ).open();
    };
    const modelDetails = optionsBody.createEl("details", { cls: "omni-forge-chat-collapsible" });
    modelDetails.open = true;
    modelDetails.createEl("summary", { text: t("Model options", "모델 옵션") });
    this.modelPresetHintEl = modelDetails.createEl("small", {
      cls: "omni-forge-chat-model-hint"
    });
    this.modelLayoutSummaryEl = modelDetails.createDiv({
      cls: "omni-forge-chat-model-layout-summary"
    });
    const profileControlRow = modelDetails.createDiv({ cls: "omni-forge-chat-controls" });
    const familyWrap = profileControlRow.createDiv({ cls: "omni-forge-chat-control" });
    familyWrap.createEl("label", { text: t("Model source", "모델 소스") });
    this.chatModelFamilySelect = familyWrap.createEl("select", {
      cls: "omni-forge-chat-model-select"
    });
    const profileWrap = profileControlRow.createDiv({ cls: "omni-forge-chat-control" });
    profileWrap.createEl("label", { text: t("Chat model", "채팅 모델") });
    this.chatModelProfileSelect = profileWrap.createEl("select", {
      cls: "omni-forge-chat-model-select"
    });
    const refreshChatFamilyOptions = () => {
      if (!this.chatModelFamilySelect) {
        return;
      }
      const options = this.plugin.getQaChatModelFamilyOptionsForQa();
      const current = this.plugin.getQaChatModelFamilyForQa();
      this.chatModelFamilySelect.empty();
      for (const option of options) {
        const label = option.value === "local" ? t("Local", "로컬") : option.value === "cloud" ? t("Cloud", "클라우드") : option.label;
        this.chatModelFamilySelect.createEl("option", {
          value: option.value,
          text: label
        });
      }
      this.chatModelFamilySelect.value = options.some((option) => option.value === current) ? current : "local";
    };
    const refreshChatProfileOptions = () => {
      if (!this.chatModelProfileSelect) {
        return;
      }
      const family = this.chatModelFamilySelect && this.chatModelFamilySelect.value === "cloud" ? "cloud" : "local";
      const options = this.plugin.getQaChatModelProfileOptionsForQa(family);
      this.chatModelProfileSelect.empty();
      for (const option of options) {
        this.chatModelProfileSelect.createEl("option", {
          value: option.value,
          text: option.label || this.buildLocalizedChatProfileLabel(option.value)
        });
      }
      const current = this.plugin.getQaChatModelProfileForQa();
      const fallback = options.length > 0 ? options[0].value : "";
      this.chatModelProfileSelect.value = options.some((option) => option.value === current) ? current : fallback;
    };
    refreshChatFamilyOptions();
    refreshChatProfileOptions();
    this.chatModelFamilySelect.onchange = async () => {
      const family = this.chatModelFamilySelect && this.chatModelFamilySelect.value === "cloud" ? "cloud" : "local";
      const summary = await this.plugin.setQaChatModelFamilyForQa(family);
      new import_obsidian4.Notice(summary, 6500);
      refreshChatFamilyOptions();
      refreshChatProfileOptions();
      this.refreshRoleOptions();
      this.refreshPipelineOptions();
      this.refreshConversationModeOptions();
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    this.chatModelProfileSelect.onchange = async () => {
      const family = this.chatModelFamilySelect && this.chatModelFamilySelect.value === "cloud" ? "cloud" : "local";
      const summary = await this.plugin.applyQaChatModelProfileForQa(this.chatModelProfileSelect.value, family);
      new import_obsidian4.Notice(summary, 6500);
      this.refreshRoleOptions();
      this.refreshPipelineOptions();
      this.refreshConversationModeOptions();
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    const controlRow = modelDetails.createDiv({ cls: "omni-forge-chat-controls" });
    const topKWrap = controlRow.createDiv({ cls: "omni-forge-chat-control" });
    topKWrap.createEl("label", { text: t("Top sources", "상위 소스 수") });
    this.topKInput = topKWrap.createEl("input", {
      type: "number",
      cls: "omni-forge-chat-topk-input"
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
    const runtimePanel = optionsBody.createEl("details", { cls: "omni-forge-chat-runtime-panel" });
    runtimePanel.open = true;
    runtimePanel.createEl("summary", {
      cls: "omni-forge-chat-runtime-head",
      text: t("Current status", "현재 상태")
    });
    const runtimeBody = runtimePanel.createDiv({ cls: "omni-forge-chat-runtime-body" });
    const runtimeMetaRow = runtimeBody.createDiv({ cls: "omni-forge-chat-meta" });
    this.threadInfoEl = runtimeMetaRow.createDiv({ cls: "omni-forge-chat-thread-info" });
    this.syncInfoEl = runtimeMetaRow.createDiv({ cls: "omni-forge-chat-sync-info" });
    this.runtimeSummaryEl = runtimeBody.createDiv({ cls: "omni-forge-chat-runtime-summary" });
    this.threadEl = root.createDiv({ cls: "omni-forge-chat-thread" });
    this.threadEl.createDiv({
      cls: "omni-forge-chat-empty",
      text: t("Ask a question to start.", "질문을 입력해 대화를 시작하세요.")
    });
    const composer = root.createDiv({ cls: "omni-forge-chat-composer" });
    composer.addEventListener("dragover", (event) => {
      event.preventDefault();
      composer.addClass("omni-forge-chat-drop-active");
    });
    composer.addEventListener("dragleave", () => {
      composer.removeClass("omni-forge-chat-drop-active");
    });
    composer.addEventListener("drop", (event) => {
      void this.handleChatDrop(event, composer);
    });
    this.activeFileStatusEl = composer.createDiv({ cls: "omni-forge-chat-active-file-status" });
    void this.refreshActiveFileStatus();
    this.attachmentStatusEl = composer.createDiv({
      cls: "omni-forge-chat-attachment-status"
    });
    this.refreshAttachmentStatus();
    this.inputEl = composer.createEl("textarea", { cls: "omni-forge-chat-input" });
    this.inputEl.placeholder = t(
      "You can chat without selected notes. Attachments and selected-note questions are both supported.",
      "선택 문서가 없어도 대화할 수 있습니다. 첨부/선택 문서 기반 질문도 가능합니다."
    );
    const footer = composer.createDiv({ cls: "omni-forge-chat-footer" });
    const footerLeft = footer.createDiv({ cls: "omni-forge-chat-footer-left" });
    const attachButton = footerLeft.createEl("button", { text: `+ ${t("Add", "첨부")}` });
    attachButton.addClass("omni-forge-chat-btn");
    attachButton.onclick = async () => {
      await this.openAttachmentPicker();
    };
    const conversationModeSelect = footerLeft.createEl("select", {
      cls: "omni-forge-chat-mode-select"
    });
    this.conversationModeSelect = conversationModeSelect;
    conversationModeSelect.setAttr("aria-label", t("Conversation mode", "대화 모드"));
    conversationModeSelect.setAttr("title", t("Conversation mode", "대화 모드"));
    conversationModeSelect.onchange = async () => {
      const mode = conversationModeSelect.value;
      await this.plugin.setQaConversationModeForQa(mode);
      this.refreshConversationModeOptions();
      this.refreshRoleOptions();
      this.refreshPipelineOptions();
      this.refreshModelOptions();
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: `\uB300\uD654 \uBAA8\uB4DC\uB97C ${this.plugin.getQaConversationModeLabelForQa()}\uB85C \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    };
    this.qaContextButton = footerLeft.createEl("button", { text: "QA ON" });
    this.qaContextButton.addClass("omni-forge-chat-btn");
    this.qaContextButton.onclick = async () => {
      const next = !this.plugin.isQaContextEnabledForQa();
      await this.plugin.setQaContextEnabledForQa(next);
      this.refreshQaContextButton();
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: next ? "QA \uCEE8\uD14D\uC2A4\uD2B8 ON: \uC120\uD0DD \uB178\uD2B8/\uC5F4\uB9B0 \uBB38\uC11C \uAE30\uBC18 \uB9AC\uD2B8\uB9AC\uBC8C\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4." : "QA \uCEE8\uD14D\uC2A4\uD2B8 OFF: \uC77C\uBC18 \uCC44\uD305 \uBAA8\uB4DC(\uC120\uD0DD \uB178\uD2B8 \uB9AC\uD2B8\uB9AC\uBC8C \uC5C6\uC74C)\uB85C \uC804\uD658\uD588\uC2B5\uB2C8\uB2E4.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    };
    this.refreshQaContextButton();
    this.sendButton = footer.createEl("button", { text: t("Send", "전송"), cls: "mod-cta" });
    this.sendButton.addClass("omni-forge-chat-send");
    this.sendButton.onclick = async () => {
      await this.submitQuestion();
    };
    this.stopButton = footer.createEl("button", { text: t("Stop", "중지") });
    this.stopButton.addClass("omni-forge-chat-stop");
    this.stopButton.disabled = true;
    this.stopButton.onclick = () => {
      if (!this.running) {
        return;
      }
      this.stopButton.disabled = true;
      this.requestImmediateStop("\uC0AC\uC6A9\uC790\uAC00 \uC911\uC9C0 \uBC84\uD2BC\uC744 \uB20C\uB800\uC2B5\uB2C8\uB2E4.");
    };
    this.inputEl.addEventListener(
      "keydown",
      (event) => {
        handleChatTextareaEnterKey(event, this.inputEl, async () => this.submitQuestion());
      },
      { capture: true }
    );
    this.inputEl.addEventListener(
      "keyup",
      (event) => {
        if (!isEnterLikeKey(event)) {
          return;
        }
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      },
      { capture: true }
    );
    this.registerDomEvent(
      window,
      "keydown",
      (event) => {
        if (document.activeElement !== this.inputEl) {
          return;
        }
        handleChatTextareaEnterKey(event, this.inputEl, async () => this.submitQuestion());
      },
      { capture: true }
    );
    this.inputEl.addEventListener("paste", (event) => {
      void this.handleChatPaste(event);
    });
    this.refreshSendButtonState();
    this.refreshConversationModeOptions();
    this.refreshRoleOptions();
    this.refreshPipelineOptions();
    this.refreshThreadMeta();
  }
  async refreshFromSettingsForQa() {
    if (!this.contentEl.isConnected) {
      return;
    }
    const root = this.contentEl.querySelector(".omni-forge-chat-root");
    if (root instanceof HTMLElement) {
      root.style.setProperty("--omni-forge-chat-font-size", `${this.plugin.settings.qaChatFontSize}px`);
    }
    this.refreshRoleOptions();
    this.refreshPipelineOptions();
    this.refreshModelOptions();
    this.refreshConversationModeOptions();
    this.refreshQaContextButton();
    if (this.threadEl) {
      this.renderMessages();
    }
    if (this.topKInput) {
      this.topKInput.value = String(this.plugin.settings.qaTopK);
    }
    await this.refreshScopeLabel();
    await this.refreshActiveFileStatus();
    this.refreshThreadMeta();
  }
  refreshRoleOptions() {
    if (!this.roleSelect) {
      return;
    }
    const options = this.plugin.getQaRolePresetOptionsForQa();
    const current = this.plugin.getQaRolePresetForQa();
    this.roleSelect.empty();
    for (const option of options) {
      this.roleSelect.createEl("option", { text: option.label, value: option.value });
    }
    this.roleSelect.value = current;
  }
  refreshPipelineOptions() {
    if (!this.pipelineSelect) {
      return;
    }
    const options = this.plugin.getQaPipelinePresetOptionsForQa();
    const current = this.plugin.getQaPipelinePresetForQa();
    this.pipelineSelect.empty();
    for (const option of options) {
      this.pipelineSelect.createEl("option", {
        text: option.label,
        value: option.value
      });
    }
    const fallback = options.length > 0 ? options[0].value : current;
    this.pipelineSelect.value = options.some((option) => option.value === current) ? current : fallback;
  }
  refreshConversationModeOptions() {
    if (!this.conversationModeSelect) {
      return;
    }
    const modeLabelMap = {
      ask: ["Ask", "질문"],
      plan: ["Plan", "계획"],
      agent: ["Agent", "에이전트"],
      orchestration: ["Orchestration", "오케스트레이션"]
    };
    const options = this.plugin.getQaConversationModeOptionsForQa();
    const current = this.plugin.getQaConversationModeForQa();
    this.conversationModeSelect.empty();
    for (const option of options) {
      const labelPair = modeLabelMap[option.value];
      this.conversationModeSelect.createEl("option", {
        text: labelPair ? this.localizeChatLabel(labelPair[0], labelPair[1]) : option.label,
        value: option.value
      });
    }
    this.conversationModeSelect.value = current;
    this.conversationModeSelect.setAttr(
      "title",
      `${this.localizeChatLabel("Mode", "모드")}=${this.plugin.getQaConversationModeLabelForQa()}`
    );
  }
  refreshQaContextButton() {
    if (!this.qaContextButton) {
      return;
    }
    const enabled = this.plugin.isQaContextEnabledForQa();
    this.qaContextButton.setText(enabled ? "QA ON" : "QA OFF");
    this.qaContextButton.setAttr(
      "title",
      enabled ? "\uC120\uD0DD \uB178\uD2B8/\uC5F4\uB9B0 \uBB38\uC11C \uAE30\uBC18 QA \uCEE8\uD14D\uC2A4\uD2B8\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4." : "\uC120\uD0DD \uB178\uD2B8 \uB9AC\uD2B8\uB9AC\uBC8C \uC5C6\uC774 \uC77C\uBC18 \uCC44\uD305\uC73C\uB85C \uB3D9\uC791\uD569\uB2C8\uB2E4."
    );
    this.qaContextButton.toggleClass("mod-cta", enabled);
  }
  refreshModelOptions() {
    const presetLabel = this.plugin.getQaPresetProfileLabelForQa();
    const modelFamily = this.plugin.getQaChatModelFamilyForQa();
    const profile = this.plugin.getQaChatModelProfileForQa();
    if (this.headerTitleEl) {
      this.headerTitleEl.setText(
        modelFamily === "cloud" ? this.localizeChatLabel("Cloud Chat", "클라우드 채팅") : this.localizeChatLabel("Local Ollama", "로컬 Ollama")
      );
    }
    if (this.chatModelFamilySelect) {
      this.chatModelFamilySelect.value = modelFamily;
    }
    if (this.chatModelProfileSelect) {
      const options = this.plugin.getQaChatModelProfileOptionsForQa(modelFamily);
      const fallback = options.length > 0 ? options[0].value : modelFamily === "cloud" ? "codex" : "local-flash";
      const target = options.some((option) => option.value === profile) ? profile : fallback;
      this.chatModelProfileSelect.value = target;
    }
    if (this.modelPresetHintEl) {
      this.modelPresetHintEl.setText(
        `${this.localizeChatLabel("Source", "소스")}=${modelFamily === "cloud" ? this.localizeChatLabel("Cloud", "클라우드") : this.localizeChatLabel("Local", "로컬")} | ${this.localizeChatLabel("Profile", "프로필")}=${this.buildLocalizedChatProfileLabel(profile)} | Preset=${presetLabel} | convo=${this.plugin.getQaConversationModeLabelForQa()} | pipeline=${getQaPipelinePresetLabel(this.plugin.getQaPipelinePresetForQa())}`
      );
    }
    if (this.modelLayoutSummaryEl) {
      const lines = [
        `ask(text): ${this.plugin.getQaModelLabelForQa("ask")}`,
        `ask(vision): ${this.plugin.getQaModelLabelForQa("ask_vision")}`,
        `image: ${this.plugin.getQaModelLabelForQa("image_generator")}`,
        `code: ${this.plugin.getQaModelLabelForQa("coder")}`,
        `debug: ${this.plugin.getQaModelLabelForQa("debugger")}`,
        `architect: ${this.plugin.getQaModelLabelForQa("architect")}`,
        `orchestrator: ${this.plugin.getQaModelLabelForQa("orchestrator")}`,
        `safeguard: ${this.plugin.getQaModelLabelForQa("safeguard")}`
      ];
      this.modelLayoutSummaryEl.setText(lines.join(" | "));
      this.modelLayoutSummaryEl.setAttr("title", lines.join("\n"));
    }
  }
  refreshSendButtonState() {
    if (!this.sendButton) {
      return;
    }
    if (this.running) {
      const queueCount = this.queuedTurns.length;
      const preemptPending = this.pendingPreemptTurn !== null;
      this.sendButton.setText(
        preemptPending ? queueCount > 0 ? `Steer \uB300\uAE30\uC911 +${queueCount}` : "Steer \uC804\uD658 \uB300\uAE30\uC911" : queueCount > 0 ? `Steer +1 (\uB300\uAE30 ${queueCount + 1})` : "Steer / \uC911\uAC04 \uC9C0\uC2DC"
      );
      this.sendButton.setAttr(
        "title",
        preemptPending ? "\uD604\uC7AC \uD134 \uC911\uC9C0 \uD6C4 steer \uC9C8\uBB38\uC744 \uC6B0\uC120 \uC2E4\uD589\uD569\uB2C8\uB2E4." : "\uC2E4\uD589 \uC911\uC5D0\uB294 \uC804\uC1A1 \uB300\uC2E0 steer \uAE30\uB2A5\uC73C\uB85C \uC989\uC2DC \uC804\uD658/\uB300\uAE30\uC5F4 \uCD94\uAC00\uAC00 \uB3D9\uC791\uD569\uB2C8\uB2E4."
      );
      this.sendButton.disabled = false;
      this.sendButton.removeClass("mod-cta");
      return;
    }
    this.sendButton.setText(this.localizeChatLabel("Send", "전송"));
    this.sendButton.setAttr("title", this.localizeChatLabel("Send current input now.", "현재 입력한 질문을 즉시 전송합니다."));
    this.sendButton.disabled = false;
    this.sendButton.addClass("mod-cta");
  }
  captureCurrentInputTurn() {
    const question = this.inputEl.value.trim();
    if (!question) {
      return null;
    }
    const attachments = this.consumePendingAttachments();
    const openFile = this.resolveVisibleMarkdownFile();
    const openFilePath = openFile instanceof import_obsidian4.TFile && openFile.extension === "md" ? openFile.path : void 0;
    const openSelection = this.captureOpenSelectionSnapshot(openFilePath);
    this.inputEl.value = "";
    return {
      question,
      attachments,
      openFilePath,
      openSelection
    };
  }
  queueCurrentInputTurn() {
    const captured = this.captureCurrentInputTurn();
    if (!captured) {
      return false;
    }
    this.queuedTurns.push({
      question: captured.question,
      attachments: captured.attachments,
      openFilePath: captured.openFilePath,
      openSelection: captured.openSelection
    });
    this.pushMessage({
      role: "system",
      text: `\uC2E4\uD589 \uC911\uC774\uB77C steer \uAE30\uB2A5\uC73C\uB85C \uB300\uAE30\uC5F4\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4. (\uD604\uC7AC \uB300\uAE30 ${this.queuedTurns.length}\uAC1C)`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.refreshSendButtonState();
    void this.refreshScopeLabel();
    return true;
  }
  preemptRunningTurnWithCurrentInput() {
    const captured = this.captureCurrentInputTurn();
    if (!captured) {
      return false;
    }
    if (this.pendingPreemptTurn) {
      this.queuedTurns.push(captured);
      this.pushMessage({
        role: "system",
        text: `\uC911\uC9C0 \uC804\uD658 \uCC98\uB9AC \uC911\uC774\uB77C steer \uC9C8\uBB38\uC744 \uB300\uAE30\uC5F4\uB85C \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4. (\uD604\uC7AC \uB300\uAE30 ${this.queuedTurns.length}\uAC1C)`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      this.refreshSendButtonState();
      void this.refreshScopeLabel();
      return true;
    }
    this.pendingPreemptTurn = captured;
    this.pushMessage({
      role: "system",
      text: "steer \uC989\uC2DC \uC804\uD658: \uD604\uC7AC \uC751\uB2F5\uC744 \uC911\uB2E8\uD558\uACE0 \uC0C8 \uC9C8\uBB38\uC744 \uC6B0\uC120 \uC2E4\uD589\uD569\uB2C8\uB2E4.",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.requestImmediateStop("steer \uC989\uC2DC \uC804\uD658");
    this.refreshSendButtonState();
    void this.refreshScopeLabel();
    return true;
  }
  async drainQueuedTurns() {
    if (this.queueDrainInProgress || this.running) {
      return;
    }
    if (this.queuedTurns.length === 0) {
      this.refreshSendButtonState();
      return;
    }
    this.queueDrainInProgress = true;
    try {
      while (!this.running && this.queuedTurns.length > 0) {
        const next = this.queuedTurns.shift();
        if (!next) {
          break;
        }
        await this.submitQuestion(next);
      }
    } finally {
      this.queueDrainInProgress = false;
      this.refreshSendButtonState();
      await this.refreshScopeLabel();
    }
  }
  normalizeAttachmentLabel(raw, fallback) {
    const trimmed = raw.trim();
    const value = trimmed || fallback;
    return value.length > 96 ? `${value.slice(0, 93)}...` : value;
  }
  clampAttachmentText(text, maxChars = 12e3) {
    if (text.length <= maxChars) {
      return text;
    }
    return `${text.slice(0, maxChars)}
...(truncated ${text.length - maxChars} chars)`;
  }
  attachmentMimeFromExt(ext) {
    switch (ext.toLowerCase()) {
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "bmp":
        return "image/bmp";
      case "svg":
      case "svgz":
        return "image/svg+xml";
      default:
        return "application/octet-stream";
    }
  }
  isImageExt(ext) {
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "svgz"].includes(
      ext.toLowerCase()
    );
  }
  isPdfExt(ext) {
    return ext.toLowerCase() === "pdf";
  }
  isLikelyTextFile(file) {
    if (file.type.startsWith("text/")) {
      return true;
    }
    const lowerType = file.type.toLowerCase();
    if (lowerType.includes("json") || lowerType.includes("xml") || lowerType.includes("yaml") || lowerType.includes("csv")) {
      return true;
    }
    const name = file.name.toLowerCase();
    return /\.(md|txt|json|ya?ml|csv|ts|js|jsx|tsx|py|java|go|rs|c|cpp|h|hpp|html|css|sql)$/i.test(name);
  }
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
  attachmentKey(item) {
    var _a;
    const source = ((_a = item.path) == null ? void 0 : _a.trim()) || item.label.trim();
    return `${item.kind}:${source}`;
  }
  sanitizeIngestFileName(rawName, fallbackBase, extHint = "") {
    const base = rawName.trim() || fallbackBase;
    const normalized = base.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
    const collapsed = normalized.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
    const trimmed = collapsed.replace(/^-+|-+$/g, "") || fallbackBase;
    const ext = extHint.trim().replace(/^\.+/, "").toLowerCase();
    if (!ext) {
      return trimmed;
    }
    return trimmed.toLowerCase().endsWith(`.${ext}`) ? trimmed : `${trimmed}.${ext}`;
  }
  async ensureVaultFolderPathForIngest(folderPath) {
    const normalized = (0, import_obsidian4.normalizePath)(folderPath);
    if (!normalized) {
      return;
    }
    const parts = normalized.split("/");
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(cursor);
      if (existing instanceof import_obsidian4.TFolder || existing instanceof import_obsidian4.TFile) {
        continue;
      }
      await this.app.vault.createFolder(cursor);
    }
  }
  buildIngestVaultPath(fileName, extHint, kind) {
    const stamp = formatBackupStamp(/* @__PURE__ */ new Date());
    const day = stamp.slice(0, 10);
    const root = (0, import_obsidian4.normalizePath)(
      (this.plugin.settings.qaAttachmentIngestRootPath || "").trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath
    );
    const safeName = this.sanitizeIngestFileName(fileName, `${kind}-attachment`, extHint);
    const suffix = Math.random().toString(36).slice(2, 8);
    return (0, import_obsidian4.normalizePath)(
      `${root}/${kind}/${day}/${stamp}-${suffix}-${safeName}`
    );
  }
  async persistBinaryAttachmentToIngest(fileName, extHint, kind, binary) {
    try {
      const targetPath = this.buildIngestVaultPath(fileName, extHint, kind);
      const folder = (0, import_obsidian4.normalizePath)(targetPath.split("/").slice(0, -1).join("/"));
      await this.ensureVaultFolderPathForIngest(folder);
      const adapter = this.app.vault.adapter;
      const vaultWithBinary = this.app.vault;
      if (typeof adapter.writeBinary === "function") {
        await adapter.writeBinary(targetPath, binary);
      } else if (typeof vaultWithBinary.createBinary === "function") {
        await vaultWithBinary.createBinary(targetPath, binary);
      } else {
        return void 0;
      }
      return targetPath;
    } catch (e) {
      return void 0;
    }
  }
  async persistTextAttachmentToIngest(fileName, extHint, kind, content) {
    try {
      const targetPath = this.buildIngestVaultPath(fileName, extHint, kind);
      const folder = (0, import_obsidian4.normalizePath)(targetPath.split("/").slice(0, -1).join("/"));
      await this.ensureVaultFolderPathForIngest(folder);
      await this.app.vault.adapter.write(targetPath, content);
      return targetPath;
    } catch (e) {
      return void 0;
    }
  }
  decodePdfLiteralString(raw) {
    let value = raw.replace(/\\\r?\n/g, "");
    value = value.replace(/\\([nrtbf()\\])/g, (_match, token) => {
      switch (token) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "	";
        case "b":
          return "\b";
        case "f":
          return "\f";
        default:
          return token;
      }
    });
    value = value.replace(/\\([0-7]{1,3})/g, (_match, octal) => {
      const parsed = Number.parseInt(octal, 8);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
    return value;
  }
  extractPdfFallbackText(binary) {
    const buffer = Buffer.from(binary);
    const latin = buffer.toString("latin1");
    const fragments = [];
    const literalRegex = /\(([^()]{2,})\)\s*T[Jj]/g;
    let match = literalRegex.exec(latin);
    while (match) {
      const decoded = this.decodePdfLiteralString(match[1]);
      if (decoded.trim().length >= 2) {
        fragments.push(decoded.trim());
      }
      match = literalRegex.exec(latin);
      if (fragments.length >= 500) {
        break;
      }
    }
    if (fragments.length > 0) {
      return fragments.join("\n");
    }
    const utf8 = buffer.toString("utf8");
    return utf8.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").replace(/\s+/g, " ").trim();
  }
  shellQuoteArg(value) {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }
  async canUseShellCommand(command) {
    var _a;
    const safe = command.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(safe)) {
      return false;
    }
    if (this.commandAvailabilityCache.has(safe)) {
      return (_a = this.commandAvailabilityCache.get(safe)) != null ? _a : false;
    }
    try {
      await execAsync(`command -v ${safe}`);
      this.commandAvailabilityCache.set(safe, true);
      return true;
    } catch (e) {
      this.commandAvailabilityCache.set(safe, false);
      return false;
    }
  }
  async resolvePdf2TxtExecutable() {
    if (await this.canUseShellCommand("pdf2txt.py")) {
      return "pdf2txt.py";
    }
    if (await this.canUseShellCommand("pdf2txt")) {
      return "pdf2txt";
    }
    const absoluteCandidates = [
      "/opt/homebrew/bin/pdf2txt.py",
      "/usr/local/bin/pdf2txt.py",
      "/Library/Frameworks/Python.framework/Versions/3.14/bin/pdf2txt.py"
    ];
    const home = ((process.env.HOME || "") + "").trim();
    if (home) {
      const userPythonRoot = nodePath.join(home, "Library", "Python");
      try {
        const versionEntries = await nodeFs.promises.readdir(userPythonRoot, {
          withFileTypes: true
        });
        const versionDirs = versionEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a, b) => b.localeCompare(a));
        for (const version of versionDirs) {
          absoluteCandidates.push(nodePath.join(userPythonRoot, version, "bin", "pdf2txt.py"));
        }
      } catch (e) {
      }
    }
    for (const candidate of absoluteCandidates) {
      try {
        await nodeFs.promises.access(candidate, nodeFs.constants.X_OK);
        return candidate;
      } catch (e) {
      }
    }
    return null;
  }
  async extractPdfTextViaPdftotext(pdfAbsolutePath) {
    var _a;
    const command = [
      "pdftotext",
      "-enc",
      "UTF-8",
      "-layout",
      "-nopgbrk",
      this.shellQuoteArg(pdfAbsolutePath),
      "-"
    ].join(" ");
    const result = await execAsync(command, { timeout: 25e3, maxBuffer: 12 * 1024 * 1024 });
    return ((_a = result.stdout) != null ? _a : "").trim();
  }
  async extractPdfTextViaPdfMiner(pdfAbsolutePath) {
    var _a;
    const pdf2txt = await this.resolvePdf2TxtExecutable();
    if (!pdf2txt) {
      return "";
    }
    const command = [
      this.shellQuoteArg(pdf2txt),
      "--output_type",
      "text",
      "--codec",
      "utf-8",
      this.shellQuoteArg(pdfAbsolutePath)
    ].join(" ");
    const result = await execAsync(command, { timeout: 45e3, maxBuffer: 16 * 1024 * 1024 });
    return ((_a = result.stdout) != null ? _a : "").trim();
  }
  async extractPdfTextViaOcr(pdfAbsolutePath, maxPages) {
    var _a;
    const tmpRoot = await nodeFs.promises.mkdtemp(
      nodePath.join(nodeOs.tmpdir(), "omni-forge-ocr-")
    );
    try {
      const prefix = nodePath.join(tmpRoot, "page");
      const renderCommand = [
        "pdftoppm",
        "-f",
        "1",
        "-l",
        String(Math.max(1, maxPages)),
        "-png",
        this.shellQuoteArg(pdfAbsolutePath),
        this.shellQuoteArg(prefix)
      ].join(" ");
      await execAsync(renderCommand, { timeout: 45e3, maxBuffer: 8 * 1024 * 1024 });
      const pageImages = (await nodeFs.promises.readdir(tmpRoot)).filter((name) => /^page-\d+\.png$/i.test(name)).map((name) => nodePath.join(tmpRoot, name)).sort((a, b) => a.localeCompare(b));
      const chunks = [];
      for (const imagePath of pageImages) {
        const ocrCommand = [
          "tesseract",
          this.shellQuoteArg(imagePath),
          "stdout",
          "-l",
          "kor+eng",
          "--psm",
          "6"
        ].join(" ");
        try {
          const output = await execAsync(ocrCommand, {
            timeout: 45e3,
            maxBuffer: 12 * 1024 * 1024
          });
          const text = ((_a = output.stdout) != null ? _a : "").trim();
          if (text) {
            chunks.push(text);
          }
        } catch (e) {
        }
      }
      return chunks.join("\n").trim();
    } finally {
      await nodeFs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {
      });
    }
  }
  scoreAttachmentTextReadability(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      return 0;
    }
    const compact = trimmed.replace(/\s+/g, "");
    if (!compact) {
      return 0;
    }
    const readableCount = ((compact.match(/[A-Za-z0-9가-힣]/g) || []).length);
    const replacementCount = ((compact.match(/�/g) || []).length);
    const controlCount = ((compact.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length);
    const score = (readableCount - replacementCount * 4 - controlCount * 2) / compact.length;
    return Math.max(0, Math.min(1, score));
  }
  resolveVaultAbsolutePath(vaultPath) {
    const base = this.getVaultBasePathForChatView();
    if (!base) {
      return void 0;
    }
    return nodePath.resolve(base, vaultPath);
  }
  async extractPdfTextWithParserChain(binary, sourceAbsolutePath) {
    const notes = [];
    let parser = "metadata-only";
    let extracted = "";
    let readabilityScore = 0;
    let workingPath = sourceAbsolutePath;
    let tempDir;
    const parserMode = this.plugin.settings.qaParserMode === "detailed" ? "detailed" : "fast";
    const preferDetailed = parserMode === "detailed";
    const pdftotextEnoughLength = preferDetailed ? 220 : 120;
    const pdfminerEnoughLength = preferDetailed ? 180 : 100;
    const ocrMaxPages = preferDetailed ? LOCAL_QA_PDF_OCR_MAX_PAGES_DETAILED : LOCAL_QA_PDF_OCR_MAX_PAGES_FAST;
    notes.push(`parser mode=${parserMode}`);
    try {
      if (!workingPath) {
        tempDir = await nodeFs.promises.mkdtemp(
          nodePath.join(nodeOs.tmpdir(), "omni-forge-pdf-")
        );
        workingPath = nodePath.join(tempDir, "input.pdf");
        await nodeFs.promises.writeFile(workingPath, Buffer.from(binary));
      }
      if (await this.canUseShellCommand("pdftotext")) {
        try {
          extracted = await this.extractPdfTextViaPdftotext(workingPath);
          readabilityScore = this.scoreAttachmentTextReadability(extracted);
          if (extracted.length > pdftotextEnoughLength && readabilityScore >= 0.42) {
            parser = "pdftotext";
          } else {
            notes.push(`pdftotext quality low/short (score=${readabilityScore.toFixed(2)}). Trying OCR/fallback.`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "pdftotext failed";
          notes.push(`pdftotext failed: ${message}`);
        }
      } else {
        notes.push("pdftotext unavailable: trying pdfminer/OCR/fallback.");
      }
      const shouldTryPdfminer = extracted.length < pdftotextEnoughLength || readabilityScore < 0.45 || parser !== "pdftotext";
      if (shouldTryPdfminer) {
        try {
          const pdfminerText = await this.extractPdfTextViaPdfMiner(workingPath);
          if (pdfminerText.trim()) {
            const pdfminerReadability = this.scoreAttachmentTextReadability(pdfminerText);
            const shouldPreferPdfminer = parser !== "pdftotext" || pdfminerReadability > readabilityScore + 0.03 || pdfminerText.length > extracted.length + 80 || pdfminerText.length >= pdfminerEnoughLength && readabilityScore < 0.4;
            if (shouldPreferPdfminer) {
              extracted = pdfminerText;
              parser = "pdfminer";
              readabilityScore = pdfminerReadability;
            } else {
              notes.push(`pdfminer candidate kept secondary (score=${pdfminerReadability.toFixed(2)}).`);
            }
          } else {
            notes.push("pdfminer unavailable or produced empty text.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "pdfminer failed";
          notes.push(`pdfminer failed: ${message}`);
        }
      }
      const shouldTryOcr = preferDetailed || extracted.length < pdftotextEnoughLength || readabilityScore < 0.42;
      if (shouldTryOcr && await this.canUseShellCommand("pdftoppm") && await this.canUseShellCommand("tesseract")) {
        try {
          const ocrText = await this.extractPdfTextViaOcr(workingPath, ocrMaxPages);
          const ocrReadability = this.scoreAttachmentTextReadability(ocrText);
          const shouldPreferOcr = ocrReadability > readabilityScore + 0.08 || ocrText.length > extracted.length + 120;
          if (shouldPreferOcr) {
            extracted = ocrText;
            parser = "ocr";
            readabilityScore = ocrReadability;
          } else if (ocrText.trim()) {
            notes.push(`OCR kept as secondary candidate (score=${ocrReadability.toFixed(2)}).`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "OCR failed";
          notes.push(`OCR failed: ${message}`);
        }
      }
    } finally {
      if (tempDir) {
        await nodeFs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {
        });
      }
    }
    if (!extracted.trim()) {
      extracted = this.extractPdfFallbackText(binary);
      parser = "fallback";
    }
    const clipped = this.clampAttachmentText(
      extracted.trim(),
      preferDetailed ? 32e3 : 2e4
    );
    if (!clipped) {
      return {
        parser,
        notes,
        content: [
          "PDF attachment received.",
          "\uBCF8\uBB38\uC744 \uC548\uC815\uC801\uC73C\uB85C \uCD94\uCD9C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD575\uC2EC \uD398\uC774\uC9C0\uB97C \uC774\uBBF8\uC9C0/\uD14D\uC2A4\uD2B8\uB85C \uCD94\uAC00 \uCCA8\uBD80\uD574 \uC8FC\uC138\uC694."
        ].join("\n")
      };
    }
    return {
      parser,
      notes,
      content: clipped
    };
  }
  async extractImageTextViaOcr(imageAbsolutePath) {
    var _a;
    const command = [
      "tesseract",
      this.shellQuoteArg(imageAbsolutePath),
      "stdout",
      "-l",
      "kor+eng",
      "--psm",
      "6"
    ].join(" ");
    const result = await execAsync(command, { timeout: 45e3, maxBuffer: 10 * 1024 * 1024 });
    return ((_a = result.stdout) != null ? _a : "").trim();
  }
  async extractImageTextWithParserChain(binary, sourceAbsolutePath, fallbackExt = "png") {
    const notes = [];
    let parser = "metadata-only";
    let extracted = "";
    let workingPath = sourceAbsolutePath;
    let tempDir;
    const parserMode = this.plugin.settings.qaParserMode === "detailed" ? "detailed" : "fast";
    const preferDetailed = parserMode === "detailed";
    notes.push(`parser mode=${parserMode}`);
    try {
      if (!workingPath) {
        tempDir = await nodeFs.promises.mkdtemp(
          nodePath.join(nodeOs.tmpdir(), "omni-forge-image-")
        );
        const ext = fallbackExt.replace(/[^A-Za-z0-9]/g, "").toLowerCase() || "png";
        workingPath = nodePath.join(tempDir, `input.${ext}`);
        await nodeFs.promises.writeFile(workingPath, Buffer.from(binary));
      }
      if (await this.canUseShellCommand("tesseract")) {
        try {
          extracted = await this.extractImageTextViaOcr(workingPath);
          if (extracted.length > 30) {
            parser = "ocr";
          } else {
            notes.push("OCR \uACB0\uACFC\uAC00 \uC9E7\uC544 \uC774\uBBF8\uC9C0 \uC124\uBA85\uB9CC \uC720\uC9C0\uD569\uB2C8\uB2E4.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "image OCR failed";
          notes.push(`OCR \uC2E4\uD328: ${message}`);
        }
      } else {
        notes.push("tesseract \uBBF8\uC124\uCE58: OCR \uC5C6\uC774 \uC774\uBBF8\uC9C0 \uC790\uCCB4 \uCEE8\uD14D\uC2A4\uD2B8\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4.");
      }
    } finally {
      if (tempDir) {
        await nodeFs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {
        });
      }
    }
    const clipped = this.clampAttachmentText(
      extracted.trim(),
      preferDetailed ? 18e3 : 1e4
    );
    return {
      parser,
      notes,
      content: clipped
    };
  }
  async readVaultFileAsAttachment(file) {
    const ext = file.extension.toLowerCase();
    if (this.isImageExt(ext)) {
      const adapter = this.app.vault.adapter;
      if (typeof adapter.readBinary !== "function") {
        return null;
      }
      const binary = await adapter.readBinary(file.path);
      if (binary.byteLength > 4 * 1024 * 1024) {
        return null;
      }
      const absolutePath = this.resolveVaultAbsolutePath(file.path);
      const parsed = await this.extractImageTextWithParserChain(binary, absolutePath, ext);
      return {
        kind: "image",
        label: this.normalizeAttachmentLabel(file.name, file.path),
        path: file.path,
        imageBase64: this.arrayBufferToBase64(binary),
        mimeType: this.attachmentMimeFromExt(ext),
        content: parsed.content ? [
          `Image attachment: ${file.name}`,
          `Parser: ${parsed.parser}`,
          ...parsed.notes.map((note) => `- ${note}`),
          "---",
          parsed.content
        ].join("\n") : void 0
      };
    }
    if (this.isPdfExt(ext)) {
      if (!this.plugin.settings.qaPdfAttachmentEnabled) {
        return null;
      }
      const adapter = this.app.vault.adapter;
      if (typeof adapter.readBinary !== "function") {
        return {
          kind: "pdf",
          label: this.normalizeAttachmentLabel(file.name, file.path),
          path: file.path,
          content: [
            `PDF attachment: ${file.name}`,
            "PDF \uBCF8\uBB38 \uCD94\uCD9C \uC2E4\uD328: readBinary API unavailable."
          ].join("\n")
        };
      }
      const binary = await adapter.readBinary(file.path);
      const absolutePath = this.resolveVaultAbsolutePath(file.path);
      const parsed = await this.extractPdfTextWithParserChain(binary, absolutePath);
      return {
        kind: "pdf",
        label: this.normalizeAttachmentLabel(file.name, file.path),
        path: file.path,
        content: [
          `PDF attachment: ${file.name}`,
          `Parser: ${parsed.parser}`,
          ...parsed.notes.map((note) => `- ${note}`),
          "---",
          parsed.content
        ].join("\n")
      };
    }
    const text = await this.app.vault.cachedRead(file);
    const trimmed = this.clampAttachmentText(text.trim());
    if (!trimmed) {
      return null;
    }
    return {
      kind: "text",
      label: this.normalizeAttachmentLabel(file.name, file.path),
      path: file.path,
      content: trimmed
    };
  }
  extractDropTextCandidates(text) {
    const candidates = /* @__PURE__ */ new Set();
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    let match = wikiRegex.exec(text);
    while (match) {
      candidates.add(match[1]);
      match = wikiRegex.exec(text);
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 240) {
        continue;
      }
      candidates.add(trimmed);
    }
    return [...candidates];
  }
  resolveDroppedVaultFile(candidate) {
    var _a, _b, _c, _d;
    let token = candidate.trim();
    if (!token) {
      return null;
    }
    if (token.startsWith("[[") && token.endsWith("]]")) {
      token = token.slice(2, -2);
    }
    token = (_c = (_b = (_a = token.split("|")[0]) == null ? void 0 : _a.split("#")[0]) == null ? void 0 : _b.trim()) != null ? _c : "";
    if (!token) {
      return null;
    }
    const linked = this.app.metadataCache.getFirstLinkpathDest(
      token,
      (_d = this.threadPath) != null ? _d : ""
    );
    if (linked instanceof import_obsidian4.TFile) {
      return linked;
    }
    const normalized = (0, import_obsidian4.normalizePath)(token);
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof import_obsidian4.TFile) {
      return direct;
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      const withMd = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withMd instanceof import_obsidian4.TFile) {
        return withMd;
      }
    }
    return null;
  }
  async readExternalFileAsAttachment(file) {
    var _a;
    const absolutePath = this.extractDesktopAbsolutePathFromFile(file);
    const ext = (_a = file.name.toLowerCase().split(".").pop()) != null ? _a : "";
    if (file.type.startsWith("image/") || this.isImageExt(ext)) {
      if (file.size > 4 * 1024 * 1024) {
        return null;
      }
      const binary = await file.arrayBuffer();
      const mirroredPath2 = await this.persistBinaryAttachmentToIngest(
        file.name,
        ext || "png",
        "image",
        binary
      );
      const mirroredAbsolutePath = mirroredPath2 ? this.resolveVaultAbsolutePath(mirroredPath2) : void 0;
      const parsed = await this.extractImageTextWithParserChain(
        binary,
        absolutePath || mirroredAbsolutePath,
        ext || "png"
      );
      return {
        kind: "image",
        label: this.normalizeAttachmentLabel(file.name, `image-${Date.now()}`),
        imageBase64: this.arrayBufferToBase64(binary),
        mimeType: file.type || this.attachmentMimeFromExt(ext),
        path: mirroredPath2 || absolutePath,
        content: parsed.content ? [
          `Image attachment: ${file.name}`,
          `Parser: ${parsed.parser}`,
          ...parsed.notes.map((note) => `- ${note}`),
          "---",
          parsed.content
        ].join("\n") : void 0
      };
    }
    if (file.type === "application/pdf" || this.isPdfExt(ext)) {
      if (!this.plugin.settings.qaPdfAttachmentEnabled) {
        return null;
      }
      if (file.size > 20 * 1024 * 1024) {
        return null;
      }
      const binary = await file.arrayBuffer();
      const mirroredPath2 = await this.persistBinaryAttachmentToIngest(
        file.name,
        ext || "pdf",
        "pdf",
        binary
      );
      const mirroredAbsolutePath = mirroredPath2 ? this.resolveVaultAbsolutePath(mirroredPath2) : void 0;
      const parsed = await this.extractPdfTextWithParserChain(
        binary,
        absolutePath || mirroredAbsolutePath
      );
      return {
        kind: "pdf",
        label: this.normalizeAttachmentLabel(file.name, `pdf-${Date.now()}`),
        path: mirroredPath2 || absolutePath,
        content: [
          `PDF attachment: ${file.name}`,
          `Parser: ${parsed.parser}`,
          ...parsed.notes.map((note) => `- ${note}`),
          "---",
          parsed.content
        ].join("\n")
      };
    }
    if (!this.isLikelyTextFile(file)) {
      return null;
    }
    if (file.size > 2 * 1024 * 1024) {
      return null;
    }
    const text = await file.text();
    const content = this.clampAttachmentText(text.trim());
    if (!content) {
      return null;
    }
    const mirroredPath = await this.persistTextAttachmentToIngest(
      file.name,
      ext || "txt",
      "text",
      content
    );
    return {
      kind: "text",
      label: this.normalizeAttachmentLabel(file.name, `document-${Date.now()}`),
      path: mirroredPath || absolutePath,
      content
    };
  }
  extractDesktopAbsolutePathFromFile(file) {
    var _a;
    const raw = ((_a = file.path) != null ? _a : "").trim();
    if (!raw) {
      return void 0;
    }
    if (nodePath.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
      return nodePath.resolve(raw);
    }
    return void 0;
  }
  async collectAttachmentsFromDrop(dataTransfer) {
    var _a;
    const collected = [];
    const seen = /* @__PURE__ */ new Set();
    const pushItem = (item) => {
      if (!item) {
        return;
      }
      const key = this.attachmentKey(item);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      collected.push(item);
    };
    const files = Array.from((_a = dataTransfer.files) != null ? _a : []);
    for (const file of files) {
      if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
      try {
        pushItem(await this.readExternalFileAsAttachment(file));
      } catch (e) {
      }
    }
    const textPayloads = [
      dataTransfer.getData("text/plain"),
      dataTransfer.getData("text/uri-list")
    ].map((value) => value.trim()).filter((value) => value.length > 0);
    for (const payload of textPayloads) {
      if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
      for (const candidate of this.extractDropTextCandidates(payload)) {
        if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
          break;
        }
        const file = this.resolveDroppedVaultFile(candidate);
        if (!(file instanceof import_obsidian4.TFile)) {
          continue;
        }
        try {
          pushItem(await this.readVaultFileAsAttachment(file));
        } catch (e) {
        }
      }
    }
    return collected.slice(0, LOCAL_QA_MAX_ATTACHMENTS);
  }
  async collectAttachmentsFromClipboard(dataTransfer) {
    var _a, _b;
    const collected = [];
    const items = Array.from((_a = dataTransfer.items) != null ? _a : []);
    for (const item of items) {
      if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      try {
        const parsed = await this.readExternalFileAsAttachment(file);
        if (parsed) {
          collected.push(parsed);
        }
      } catch (e) {
      }
    }
    if (collected.length === 0) {
      for (const file of Array.from((_b = dataTransfer.files) != null ? _b : [])) {
        if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
          break;
        }
        try {
          const parsed = await this.readExternalFileAsAttachment(file);
          if (parsed) {
            collected.push(parsed);
          }
        } catch (e) {
        }
      }
    }
    return collected.slice(0, LOCAL_QA_MAX_ATTACHMENTS);
  }
  mergePendingAttachments(incoming) {
    if (incoming.length === 0) {
      return;
    }
    const merged = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of [...this.pendingAttachments, ...incoming]) {
      const key = this.attachmentKey(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
      if (merged.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
    }
    this.pendingAttachments = merged;
    this.refreshAttachmentStatus();
    void this.refreshScopeLabel();
  }
  consumePendingAttachments() {
    const out = [...this.pendingAttachments];
    this.pendingAttachments = [];
    this.refreshAttachmentStatus();
    void this.refreshScopeLabel();
    return out;
  }
  removePendingAttachmentAt(index) {
    if (index < 0 || index >= this.pendingAttachments.length) {
      return;
    }
    this.pendingAttachments = this.pendingAttachments.filter((_, itemIndex) => itemIndex !== index);
    this.refreshAttachmentStatus();
    void this.refreshScopeLabel();
  }
  refreshAttachmentStatus() {
    if (!this.attachmentStatusEl) {
      return;
    }
    this.attachmentStatusEl.empty();
    if (this.pendingAttachments.length === 0) {
      this.attachmentStatusEl.addClass("is-empty");
      this.attachmentStatusEl.createSpan({
        text: `\uCCA8\uBD80 \uC5C6\uC74C (\uCD5C\uB300 ${LOCAL_QA_MAX_ATTACHMENTS}\uAC1C): \uB4DC\uB798\uADF8/\uC5C5\uB85C\uB4DC/\uBD99\uC5EC\uB123\uAE30(Ctrl/Cmd+V) \uC0AC\uC6A9 \uAC00\uB2A5`
      });
      return;
    }
    this.attachmentStatusEl.removeClass("is-empty");
    const head = this.attachmentStatusEl.createDiv({
      cls: "omni-forge-chat-attachment-head"
    });
    head.createSpan({
      text: `\uCCA8\uBD80 ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS} (\uB2E4\uC74C \uC804\uC1A1\uC5D0 \uD3EC\uD568)`
    });
    const clearButton = head.createEl("button", {
      text: "\uCCA8\uBD80 \uBE44\uC6B0\uAE30"
    });
    clearButton.addClass("omni-forge-chat-drop-clear");
    clearButton.onclick = () => {
      this.pendingAttachments = [];
      this.refreshAttachmentStatus();
      void this.refreshScopeLabel();
    };
    const list = this.attachmentStatusEl.createDiv({
      cls: "omni-forge-chat-attachment-list"
    });
    this.pendingAttachments.forEach((item, index) => {
      var _a;
      const card = list.createDiv({ cls: "omni-forge-chat-attachment-item" });
      if (item.kind === "image" && item.imageBase64) {
        const image = card.createEl("img", { cls: "omni-forge-chat-attachment-thumb" });
        image.src = `data:${item.mimeType || "image/png"};base64,${item.imageBase64}`;
        image.alt = item.label || `image-${index + 1}`;
      } else {
        card.createDiv({
          cls: "omni-forge-chat-attachment-file-badge",
          text: "FILE"
        });
      }
      const meta = card.createDiv({ cls: "omni-forge-chat-attachment-meta" });
      meta.createDiv({
        cls: "omni-forge-chat-attachment-title",
        text: item.label || item.path || `attachment-${index + 1}`
      });
      meta.createDiv({
        cls: "omni-forge-chat-attachment-sub",
        text: ((_a = item.path) == null ? void 0 : _a.trim()) || (item.kind === "image" ? "image attachment" : item.kind === "pdf" ? "pdf attachment" : "document attachment")
      });
      const removeButton = card.createEl("button", {
        text: "\uC81C\uAC70"
      });
      removeButton.addClass("omni-forge-chat-attachment-remove");
      removeButton.onclick = () => {
        this.removePendingAttachmentAt(index);
      };
    });
  }
  buildParserMarkdownFromAttachment(item) {
    const sourceLabel = (item.label || item.path || "attachment").trim();
    const safeLabel = sourceLabel.replace(/"/g, '\\"');
    const safePath = (item.path || "").trim().replace(/"/g, '\\"');
    const body = item.content && item.content.trim() ? item.content.trim() : item.kind === "image" ? "이미지 파일은 OCR/파서 결과가 없으면 텍스트 본문이 비어 있을 수 있습니다." : "텍스트 추출 결과가 비어 있습니다.";
    return [
      "---",
      "parser_ingest: true",
      `source_kind: ${item.kind}`,
      `source_label: "${safeLabel}"`,
      safePath ? `source_path: "${safePath}"` : 'source_path: "(none)"',
      `created_at: ${new Date().toISOString()}`,
      "---",
      "",
      `# Parsed: ${sourceLabel}`,
      "",
      body
    ].join("\n");
  }
  async convertAttachmentsToParserMarkdown(attachments, sourceLabel) {
    const created = [];
    const createdPaths = [];
    for (const item of attachments.slice(0, LOCAL_QA_MAX_ATTACHMENTS)) {
      const markdown = this.buildParserMarkdownFromAttachment(item);
      const rawName = item.label || item.path || `parser-${Date.now()}`;
      const safeName = this.sanitizeIngestFileName(rawName, "parser-document", "md");
      const targetPath = await this.persistTextAttachmentToIngest(
        safeName,
        "md",
        "parser",
        markdown
      );
      if (!targetPath) {
        continue;
      }
      createdPaths.push(targetPath);
      created.push({
        kind: "text",
        label: `${item.label || safeName} (parser.md)`,
        path: targetPath,
        content: this.clampAttachmentText(markdown)
      });
    }
    if (created.length === 0) {
      new import_obsidian4.Notice("파서 변환(.md) 결과를 만들지 못했습니다.");
      return [];
    }
    this.mergePendingAttachments(created);
    this.pushMessage({
      role: "system",
      text: `파서 인게스트(${sourceLabel}) 완료: ${created.length}개 .md 생성`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    new import_obsidian4.Notice(`Parser ingest: ${created.length}개 .md 생성됨`);
    if (createdPaths.length > 0) {
      this.pushMessage({
        role: "system",
        text: `생성 경로 예시: ${createdPaths.slice(0, 3).join(", ")}${createdPaths.length > 3 ? " ..." : ""}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return created;
  }
  async openParserIngestPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".md,.txt,.json,.yml,.yaml,.csv,.ts,.js,.py,.java,.go,.rs,.c,.cpp,.html,.css,.pdf,image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      var _a;
      try {
        const files = Array.from((_a = input.files) != null ? _a : []);
        const attachments = [];
        for (const file of files) {
          if (attachments.length >= LOCAL_QA_MAX_ATTACHMENTS) {
            break;
          }
          try {
            const parsed = await this.readExternalFileAsAttachment(file);
            if (parsed) {
              attachments.push(parsed);
            }
          } catch (e) {
          }
        }
        if (attachments.length === 0) {
          new import_obsidian4.Notice("파서 인게스트 가능한 파일을 찾지 못했습니다.");
          return;
        }
        await this.convertAttachmentsToParserMarkdown(attachments, "picker");
      } finally {
        input.remove();
      }
    };
    input.click();
  }
  async handleParserDrop(event, dropZone) {
    event.preventDefault();
    dropZone.removeClass("omni-forge-chat-drop-target-active");
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    const attachments = await this.collectAttachmentsFromDrop(dataTransfer);
    if (attachments.length === 0) {
      new import_obsidian4.Notice("드롭한 항목에서 파서 인게스트 가능한 파일을 찾지 못했습니다.");
      return;
    }
    await this.convertAttachmentsToParserMarkdown(attachments, "drop");
  }
  async openAttachmentPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".md,.txt,.json,.yml,.yaml,.csv,.ts,.js,.py,.java,.go,.rs,.c,.cpp,.html,.css,.pdf,image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      var _a;
      try {
        const files = Array.from((_a = input.files) != null ? _a : []);
        const attachments = [];
        for (const file of files) {
          if (attachments.length + this.pendingAttachments.length >= LOCAL_QA_MAX_ATTACHMENTS) {
            break;
          }
          try {
            const parsed = await this.readExternalFileAsAttachment(file);
            if (parsed) {
              attachments.push(parsed);
            }
          } catch (e) {
          }
        }
        if (attachments.length === 0) {
          new import_obsidian4.Notice("\uCCA8\uBD80\uD560 \uC218 \uC788\uB294 \uD30C\uC77C(\uD14D\uC2A4\uD2B8/\uC774\uBBF8\uC9C0/PDF)\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        } else {
          this.mergePendingAttachments(attachments);
          this.pushMessage({
            role: "system",
            text: `\uCCA8\uBD80 \uCD94\uAC00\uB428: ${attachments.length}\uAC1C (\uD604\uC7AC ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      } finally {
        input.remove();
      }
    };
    input.click();
  }
  async handleChatDrop(event, dropZone) {
    event.preventDefault();
    dropZone.removeClass("omni-forge-chat-drop-active");
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    const attachments = await this.collectAttachmentsFromDrop(dataTransfer);
    if (attachments.length === 0) {
      new import_obsidian4.Notice("\uB4DC\uB798\uADF8\uD55C \uD56D\uBAA9\uC5D0\uC11C \uC77D\uC744 \uC218 \uC788\uB294 \uD14D\uC2A4\uD2B8/\uC774\uBBF8\uC9C0/PDF\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      return;
    }
    this.mergePendingAttachments(attachments);
    this.pushMessage({
      role: "system",
      text: `\uB4DC\uB798\uADF8 \uCCA8\uBD80 \uCD94\uAC00\uB428: ${attachments.length}\uAC1C (\uD604\uC7AC ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async handleChatPaste(event) {
    var _a, _b, _c;
    const dataTransfer = event.clipboardData;
    if (!dataTransfer) {
      return;
    }
    const hasFilePayload = Array.from((_a = dataTransfer.items) != null ? _a : []).some((item) => item.kind === "file") || ((_c = (_b = dataTransfer.files) == null ? void 0 : _b.length) != null ? _c : 0) > 0;
    if (!hasFilePayload) {
      return;
    }
    event.preventDefault();
    const attachments = await this.collectAttachmentsFromClipboard(dataTransfer);
    if (attachments.length === 0) {
      new import_obsidian4.Notice("\uBD99\uC5EC\uB123\uC740 \uB370\uC774\uD130\uC5D0\uC11C \uCCA8\uBD80 \uAC00\uB2A5\uD55C \uD30C\uC77C/\uC774\uBBF8\uC9C0\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      return;
    }
    this.mergePendingAttachments(attachments);
    this.pushMessage({
      role: "system",
      text: `\uBD99\uC5EC\uB123\uAE30 \uCCA8\uBD80 \uCD94\uAC00\uB428: ${attachments.length}\uAC1C (\uD604\uC7AC ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
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
  getVaultBasePathForChatView() {
    const adapter = this.app.vault.adapter;
    if (typeof adapter.getBasePath !== "function") {
      return null;
    }
    const base = adapter.getBasePath();
    if (!base || typeof base !== "string") {
      return null;
    }
    return nodePath.resolve(base);
  }
  resolveVisibleMarkdownFile() {
    const active = this.app.workspace.getActiveFile();
    if (active instanceof import_obsidian4.TFile && active.extension === "md") {
      return active;
    }
    const activeLeaf = this.app.workspace.activeLeaf;
    if ((activeLeaf == null ? void 0 : activeLeaf.view) instanceof import_obsidian4.MarkdownView) {
      const file = activeLeaf.view.file;
      if (file instanceof import_obsidian4.TFile && file.extension === "md") {
        return file;
      }
    }
    if (this.lastKnownOpenMarkdownPath) {
      const cached = this.app.vault.getAbstractFileByPath(this.lastKnownOpenMarkdownPath);
      if (cached instanceof import_obsidian4.TFile && cached.extension === "md") {
        return cached;
      }
    }
    return null;
  }
  resolveOpenMarkdownViewByPath(filePath) {
    const normalized = (0, import_obsidian4.normalizePath)((filePath != null ? filePath : "").trim());
    if (!normalized) {
      return null;
    }
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian4.MarkdownView)) {
        continue;
      }
      const file = view.file;
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
        continue;
      }
      if (file.path !== normalized) {
        continue;
      }
      return view;
    }
    return null;
  }
  captureOpenSelectionSnapshot(openFilePath) {
    const normalized = (0, import_obsidian4.normalizePath)((openFilePath != null ? openFilePath : "").trim());
    if (!normalized) {
      return null;
    }
    const view = this.resolveOpenMarkdownViewByPath(normalized);
    if (!(view instanceof import_obsidian4.MarkdownView) || !view.editor) {
      return null;
    }
    const editor = view.editor;
    if (!editor.somethingSelected()) {
      return null;
    }
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const fromOffset = editor.posToOffset(from);
    const toOffset = editor.posToOffset(to);
    if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
      return null;
    }
    if (toOffset <= fromOffset) {
      return null;
    }
    const selectedText = editor.getRange(from, to);
    if (!selectedText) {
      return null;
    }
    return {
      filePath: normalized,
      fromOffset: Math.floor(fromOffset),
      toOffset: Math.floor(toOffset),
      selectedText,
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  decodeChatLinkValue(raw) {
    const trimmed = (raw != null ? raw : "").trim();
    if (!trimmed) {
      return "";
    }
    try {
      return decodeURIComponent(trimmed);
    } catch (e) {
      return trimmed;
    }
  }
  resolveVaultFileFromChatLink(raw) {
    const decoded = this.decodeChatLinkValue(raw);
    if (!decoded || /^https?:\/\//i.test(decoded) || /^obsidian:\/\//i.test(decoded)) {
      return null;
    }
    let candidate = decoded;
    if (/^file:\/\//i.test(candidate)) {
      candidate = candidate.replace(/^file:\/\//i, "");
    }
    candidate = candidate.trim();
    if (!candidate) {
      return null;
    }
    const normalized = (0, import_obsidian4.normalizePath)(candidate);
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof import_obsidian4.TFile) {
      return direct;
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      const withMd = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withMd instanceof import_obsidian4.TFile) {
        return withMd;
      }
    }
    const vaultBase = this.getVaultBasePathForChatView();
    if (vaultBase && (nodePath.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate))) {
      const absolute = nodePath.resolve(candidate);
      const relative2 = nodePath.relative(vaultBase, absolute);
      if (relative2 && !relative2.startsWith("..") && !nodePath.isAbsolute(relative2)) {
        const vaultPath = (0, import_obsidian4.normalizePath)(relative2);
        const fromAbsolute = this.app.vault.getAbstractFileByPath(vaultPath);
        if (fromAbsolute instanceof import_obsidian4.TFile) {
          return fromAbsolute;
        }
      }
    }
    return null;
  }
  buildFileUrlFromAbsolutePath(rawPath) {
    const absolute = nodePath.resolve(rawPath);
    if (!absolute) {
      return null;
    }
    const segments = absolute.split(nodePath.sep).map((segment) => encodeURIComponent(segment));
    if (/^[A-Za-z]:[\\/]/.test(absolute)) {
      return `file:///${segments.join("/")}`;
    }
    return `file://${segments.join("/")}`;
  }
  async openLinkWithDesktopShell(url) {
    var _a, _b;
    try {
      const win = window;
      const electron = typeof win.require === "function" ? win.require("electron") : null;
      if ((_a = electron == null ? void 0 : electron.shell) == null ? void 0 : _a.openExternal) {
        await electron.shell.openExternal(url);
        return true;
      }
      if (((_b = electron == null ? void 0 : electron.shell) == null ? void 0 : _b.openPath) && /^file:\/\//i.test(url)) {
        const path = decodeURIComponent(url.replace(/^file:\/\//i, ""));
        const result = await electron.shell.openPath(path);
        return !result;
      }
      window.open(url, "_blank");
      return true;
    } catch (e) {
      try {
        window.open(url, "_blank");
        return true;
      } catch (e2) {
        return false;
      }
    }
  }
  async tryOpenExternalFromChatLink(raw) {
    const decoded = this.decodeChatLinkValue(raw);
    if (!decoded) {
      return false;
    }
    try {
      if (/^obsidian:\/\//i.test(decoded)) {
        return await this.openLinkWithDesktopShell(decoded);
      }
      if (/^https?:\/\//i.test(decoded)) {
        return await this.openLinkWithDesktopShell(decoded);
      }
      let pathLike = decoded;
      if (/^file:\/\//i.test(pathLike)) {
        pathLike = pathLike.replace(/^file:\/\//i, "");
      }
      pathLike = pathLike.trim();
      if (!pathLike) {
        return false;
      }
      if (!(nodePath.isAbsolute(pathLike) || /^[A-Za-z]:[\\/]/.test(pathLike))) {
        return false;
      }
      const fileUrl = this.buildFileUrlFromAbsolutePath(pathLike);
      if (!fileUrl) {
        return false;
      }
      return await this.openLinkWithDesktopShell(fileUrl);
    } catch (e) {
      return false;
    }
  }
  bindChatMarkdownLinkHandlers(container) {
    container.addEventListener("click", (event) => {
      var _a, _b, _c;
      const target = event.target;
      const anchor = target == null ? void 0 : target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        const image = target == null ? void 0 : target.closest("img");
        if (!(image instanceof HTMLImageElement)) {
          return;
        }
        const src = ((_a = image.getAttribute("src")) != null ? _a : "").trim();
        if (!src) {
          return;
        }
        const internalImageFile = this.resolveVaultFileFromChatLink(src);
        const shouldInterceptImage = internalImageFile instanceof import_obsidian4.TFile || /^https?:\/\//i.test(src) || /^obsidian:\/\//i.test(src) || /^file:\/\//i.test(src) || nodePath.isAbsolute(src) || /^[A-Za-z]:[\\/]/.test(src);
        if (!shouldInterceptImage) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          if (internalImageFile instanceof import_obsidian4.TFile) {
            await this.app.workspace.getLeaf(true).openFile(internalImageFile);
            return;
          }
          await this.tryOpenExternalFromChatLink(src);
        })();
        return;
      }
      const candidates = [
        (_b = anchor.getAttribute("href")) != null ? _b : "",
        (_c = anchor.textContent) != null ? _c : ""
      ].map((item) => item.trim()).filter((item) => item.length > 0);
      if (candidates.length === 0) {
        return;
      }
      const shouldIntercept = candidates.some((candidate) => {
        const decoded = this.decodeChatLinkValue(candidate);
        if (!decoded || decoded === "#") {
          return false;
        }
        if (/^https?:\/\//i.test(decoded) || /^obsidian:\/\//i.test(decoded) || /^file:\/\//i.test(decoded) || nodePath.isAbsolute(decoded) || /^[A-Za-z]:[\\/]/.test(decoded)) {
          return true;
        }
        return this.resolveVaultFileFromChatLink(decoded) instanceof import_obsidian4.TFile;
      });
      if (!shouldIntercept) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const openInternal = async () => {
        for (const candidate of candidates) {
          const file = this.resolveVaultFileFromChatLink(candidate);
          if (!(file instanceof import_obsidian4.TFile)) {
            continue;
          }
          await this.app.workspace.getLeaf(true).openFile(file);
          return true;
        }
        return false;
      };
      const openExternalPath = async () => {
        for (const candidate of candidates) {
          if (await this.tryOpenExternalFromChatLink(candidate)) {
            return true;
          }
        }
        return false;
      };
      void (async () => {
        if (await openInternal()) {
          return;
        }
        if (await openExternalPath()) {
          return;
        }
      })();
    });
  }
  renderMarkdownBody(container, markdown, sourcePath, version) {
    container.empty();
    void import_obsidian4.MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, this).catch(() => {
      container.setText(markdown);
    }).finally(() => {
      this.bindChatMarkdownLinkHandlers(container);
      if (version === this.renderVersion) {
        this.threadEl.scrollTop = this.threadEl.scrollHeight;
      }
    });
  }
  renderThinkingCard(parent, message) {
    var _a, _b;
    const timeline = (_a = message.timeline) != null ? _a : [];
    const latest = timeline.length > 0 ? timeline[timeline.length - 1] : void 0;
    const panel = parent.createEl("details", { cls: "omni-forge-chat-thinking-panel" });
    panel.open = false;
    const head = panel.createEl("summary", { cls: "omni-forge-chat-thinking-head" });
    const summaryText = latest ? `Thinking timeline \xB7 ${timeline.length} events \xB7 ${this.formatThinkingStage(latest.stage)}` : "Thinking timeline";
    head.createDiv({
      text: summaryText,
      cls: "omni-forge-chat-thinking-summary"
    });
    if (message.isDraft) {
      head.createDiv({
        cls: "omni-forge-chat-thinking-live",
        text: "LIVE"
      });
    }
    const body = panel.createDiv({ cls: "omni-forge-chat-thinking-body" });
    if (timeline.length > 0) {
      const timelineEl = body.createDiv({ cls: "omni-forge-chat-thinking-timeline" });
      for (const event of timeline.slice(-24)) {
        const card = timelineEl.createDiv({
          cls: `omni-forge-chat-thinking-event omni-forge-chat-thinking-event-${event.stage}`
        });
        card.createEl("span", {
          cls: "omni-forge-chat-thinking-event-stage",
          text: this.formatThinkingStage(event.stage)
        });
        const content = card.createDiv({ cls: "omni-forge-chat-thinking-event-content" });
        content.createDiv({
          cls: "omni-forge-chat-thinking-event-message",
          text: event.message
        });
        if (event.detail) {
          content.createDiv({
            cls: "omni-forge-chat-thinking-event-detail",
            text: event.detail
          });
        }
        card.createEl("span", {
          cls: "omni-forge-chat-thinking-event-time",
          text: this.formatTime(event.timestamp)
        });
      }
    }
    if ((_b = message.thinkingDetails) == null ? void 0 : _b.trim()) {
      const raw = body.createDiv({ cls: "omni-forge-chat-thinking-raw" });
      raw.createEl("div", {
        cls: "omni-forge-chat-thinking-raw-title",
        text: "Model thinking (raw)"
      });
      raw.createEl("pre", {
        cls: "omni-forge-chat-thinking-raw-body",
        text: message.thinkingDetails.trim()
      });
    } else if (!timeline.length) {
      body.setText(message.text || "(empty)");
    }
  }
  async startNewThread() {
    if (this.running) {
      const opened = await this.plugin.openLocalQaWorkspaceView(true);
      if (!opened) {
        new import_obsidian4.Notice(`실행 중에는 새 채팅창을 여세요. (최대 ${LOCAL_QA_MAX_PANES}개)`);
      }
      return;
    }
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
    const row = parent.createDiv({ cls: "omni-forge-chat-source-row" });
    const sourcePath = source.path.trim();
    const isAttachmentVirtual = sourcePath.startsWith("[ATTACHMENT-");
    const virtualLabel = isAttachmentVirtual ? sourcePath.replace(/^\[ATTACHMENT-[^\]]+\]\s*/, "").trim() : "";
    const fallbackTarget = isAttachmentVirtual ? this.resolveVaultFileFromChatLink(virtualLabel) : null;
    const target = !isAttachmentVirtual ? this.app.vault.getAbstractFileByPath(sourcePath) : fallbackTarget;
    const canOpenExternal = /^https?:\/\//i.test(sourcePath) || /^obsidian:\/\//i.test(sourcePath) || /^file:\/\//i.test(sourcePath) || nodePath.isAbsolute(sourcePath) || /^[A-Za-z]:[\\/]/.test(sourcePath) || isAttachmentVirtual && (/^https?:\/\//i.test(virtualLabel) || /^obsidian:\/\//i.test(virtualLabel) || /^file:\/\//i.test(virtualLabel) || nodePath.isAbsolute(virtualLabel) || /^[A-Za-z]:[\\/]/.test(virtualLabel));
    const externalPath = isAttachmentVirtual ? virtualLabel : sourcePath;
    if (target instanceof import_obsidian4.TFile) {
      const link = row.createEl("a", {
        text: sourcePath,
        href: "#",
        cls: "omni-forge-chat-source-link"
      });
      link.setAttr("title", sourcePath);
      link.onclick = async (event) => {
        event.preventDefault();
        await this.app.workspace.getLeaf(true).openFile(target);
      };
    } else if (canOpenExternal) {
      const link = row.createEl("a", {
        text: sourcePath,
        href: "#",
        cls: "omni-forge-chat-source-link"
      });
      link.setAttr("title", sourcePath);
      link.onclick = async (event) => {
        event.preventDefault();
        const opened = await this.tryOpenExternalFromChatLink(externalPath);
        if (!opened) {
          new import_obsidian4.Notice(`Source not found: ${externalPath}`, 5e3);
        }
      };
    } else {
      const text = row.createEl("span", {
        text: sourcePath,
        cls: "omni-forge-chat-source-link"
      });
      text.setAttr(
        "title",
        isAttachmentVirtual ? "\uAC00\uC0C1 \uCCA8\uBD80 \uCD9C\uCC98\uC785\uB2C8\uB2E4. \uC808\uB300\uACBD\uB85C/\uBCFC\uD2B8 \uACBD\uB85C\uAC00 \uD3EC\uD568\uB418\uBA74 \uD074\uB9AD \uC5F4\uAE30\uAC00 \uAC00\uB2A5\uD569\uB2C8\uB2E4." : `Source not found: ${sourcePath}`
      );
      text.style.opacity = "0.82";
      text.style.cursor = "default";
    }
    row.createEl("span", {
      text: formatSimilarity(source.similarity),
      cls: "omni-forge-chat-source-similarity"
    });
  }
  renderMessages() {
    var _a;
    this.renderVersion += 1;
    const version = this.renderVersion;
    this.threadEl.empty();
    const visibleMessages = this.plugin.settings.qaShowSystemMessages ? this.messages : this.messages.filter((message) => message.role !== "system");
    if (visibleMessages.length === 0) {
      this.threadEl.createDiv({
        cls: "omni-forge-chat-empty",
        text: "\uC9C8\uBB38\uC744 \uC785\uB825\uD574 \uB300\uD654\uB97C \uC2DC\uC791\uD558\uC138\uC694. / Ask a question to start."
      });
      return;
    }
    for (const message of visibleMessages) {
      const box = this.threadEl.createDiv({
        cls: `omni-forge-chat-message omni-forge-chat-message-${message.role}`
      });
      if (message.role === "thinking") {
        this.renderThinkingCard(box, message);
        continue;
      }
      if (message.role === "system") {
        const panel = box.createEl("details", { cls: "omni-forge-chat-system-panel" });
        panel.open = false;
        const summary = panel.createEl("summary", { cls: "omni-forge-chat-system-head" });
        summary.createEl("strong", { text: "System / \uC2DC\uC2A4\uD15C" });
        summary.createEl("small", {
          text: this.formatTime(message.timestamp),
          cls: "omni-forge-chat-message-time"
        });
        const body2 = panel.createDiv({ cls: "omni-forge-chat-message-body" });
        body2.setText(message.text);
        continue;
      }
      const head = box.createDiv({ cls: "omni-forge-chat-message-head" });
      head.createEl("strong", {
        text: message.role === "assistant" ? "Assistant / \uC5B4\uC2DC\uC2A4\uD134\uD2B8" : message.role === "user" ? "You / \uC0AC\uC6A9\uC790" : "System / \uC2DC\uC2A4\uD15C"
      });
      head.createEl("small", {
        text: this.formatTime(message.timestamp),
        cls: "omni-forge-chat-message-time"
      });
      const body = box.createDiv({ cls: "omni-forge-chat-message-body" });
      if (message.role === "assistant" && !message.isDraft) {
        body.addClass("omni-forge-chat-markdown");
        this.renderMarkdownBody(body, message.text, (_a = this.threadPath) != null ? _a : "", version);
      } else {
        body.setText(message.text);
      }
      if (message.role === "assistant" && message.sources && message.sources.length > 0) {
        const src = box.createDiv({ cls: "omni-forge-chat-sources" });
        src.createDiv({
          cls: "omni-forge-chat-sources-title",
          text: `Sources / \uCD9C\uCC98 (${message.sources.length})`
        });
        for (const source of message.sources) {
          this.renderSourceLink(src, source);
        }
      }
      if (message.role === "assistant" && message.model && message.embeddingModel) {
        box.createDiv({
          cls: "omni-forge-chat-message-meta",
          text: `model=${message.model} | embedding=${message.embeddingModel}`
        });
      }
    }
    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }
  pushMessage(message) {
    if (message.role === "system" && !this.plugin.settings.qaShowSystemMessages) {
      this.scheduleThreadSync();
      return;
    }
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
    const attachmentCount = this.pendingAttachments.length;
    const role = this.plugin.getQaRolePresetForQa();
    const presetLabel = this.plugin.getQaPresetProfileLabelForQa();
    const conversationMode = this.plugin.getQaConversationModeLabelForQa();
    const model = this.plugin.getQaModelLabelForQa(role);
    const syncMode = this.plugin.isQaThreadAutoSyncEnabledForQa() ? "auto / \uC790\uB3D9" : "manual / \uC218\uB3D9";
    const fullSummary = `Scope / \uBC94\uC704: files=${fileCount}, folders=${folderCount}, attachments=${attachmentCount}`;
    const runtimeSummary = `convo=${conversationMode} | preset=${presetLabel} | QA=${model} | sync=${syncMode}`;
    this.scopeEl.empty();
    this.scopeEl.setAttr("title", fullSummary);
    this.scopeEl.createDiv({
      cls: "omni-forge-chat-scope-counts",
      text: `\uD30C\uC77C(Files): ${fileCount} / \uD3F4\uB354(Folders): ${folderCount} / \uCCA8\uBD80 \uD30C\uC77C(Attach): ${attachmentCount}`
    });
    if (this.runtimeSummaryEl) {
      this.runtimeSummaryEl.setText(runtimeSummary);
      this.runtimeSummaryEl.setAttr("title", runtimeSummary);
    }
  }
  async refreshActiveFileStatus() {
    if (!this.activeFileStatusEl || !this.contentEl.isConnected) {
      return;
    }
    this.activeFileStatusEl.empty();
    const active = this.resolveVisibleMarkdownFile();
    if (!(active instanceof import_obsidian4.TFile) || active.extension !== "md") {
      this.activeFileStatusEl.addClass("is-empty");
      return;
    }
    this.lastKnownOpenMarkdownPath = active.path;
    this.activeFileStatusEl.removeClass("is-empty");
    const chip = this.activeFileStatusEl.createDiv({
      cls: "omni-forge-chat-active-file-chip"
    });
    chip.addClass("is-current");
    chip.createSpan({
      cls: "omni-forge-chat-active-file-label",
      text: "Open file"
    });
    chip.createSpan({
      cls: "omni-forge-chat-active-file-name",
      text: `@${active.basename}`
    });
    chip.setAttr("title", active.path);
  }
  async submitQuestion(preloadedTurn) {
    var _a, _b, _c, _d, _e, _f;
    if (this.running) {
      if (!preloadedTurn) {
        this.preemptRunningTurnWithCurrentInput();
      }
      return;
    }
    this.stopRequested = false;
    const question = ((_a = preloadedTurn == null ? void 0 : preloadedTurn.question) != null ? _a : this.inputEl.value).trim();
    if (!question) {
      new import_obsidian4.Notice("Question is empty. / \uC9C8\uBB38\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const selectedFiles = this.plugin.getSelectedFilesForQa();
    const qaContextEnabled = this.plugin.isQaContextEnabledForQa();
    const attachmentsForTurn = (_b = preloadedTurn == null ? void 0 : preloadedTurn.attachments) != null ? _b : this.consumePendingAttachments();
    const hasPendingAttachments = attachmentsForTurn.length > 0;
    const openFileForTurn = this.resolveVisibleMarkdownFile();
    const openFilePathForTurn = (_c = preloadedTurn == null ? void 0 : preloadedTurn.openFilePath) != null ? _c : openFileForTurn instanceof import_obsidian4.TFile && openFileForTurn.extension === "md" ? openFileForTurn.path : void 0;
    const openSelectionForTurn = (_d = preloadedTurn == null ? void 0 : preloadedTurn.openSelection) != null ? _d : this.captureOpenSelectionSnapshot(openFilePathForTurn);
    if (!qaContextEnabled && !hasPendingAttachments) {
      this.pushMessage({
        role: "system",
        text: openFilePathForTurn ? `QA 컨텍스트 OFF 상태입니다. 선택 노트 리트리벌 대신 현재 열린 문서를 보조 컨텍스트로 사용합니다: ${openFilePathForTurn}` : "QA 컨텍스트 OFF 상태입니다. 선택 노트 리트리벌 없이 일반 채팅으로 진행합니다.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else if (selectedFiles.length === 0 && !hasPendingAttachments) {
      this.pushMessage({
        role: "system",
        text: openFilePathForTurn ? `\uC120\uD0DD \uB178\uD2B8/\uCCA8\uBD80\uAC00 \uC5C6\uC5B4 \uD604\uC7AC \uC5F4\uB9B0 \uBB38\uC11C\uB97C \uC6B0\uC120 \uCEE8\uD14D\uC2A4\uD2B8\uB85C \uC0AC\uC6A9\uD569\uB2C8\uB2E4: ${openFilePathForTurn}` : "\uC120\uD0DD \uB178\uD2B8/\uCCA8\uBD80 \uC5C6\uC774 \uC77C\uBC18 \uB300\uD654\uB97C \uC9C4\uD589\uD569\uB2C8\uB2E4. \uD544\uC694\uD558\uBA74 \uB178\uD2B8\uB97C \uC120\uD0DD\uD558\uAC70\uB098 \uCCA8\uBD80\uB97C \uCD94\uAC00\uD558\uC138\uC694.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (attachmentsForTurn.length > 0) {
      this.pushMessage({
        role: "system",
        text: `\uC774\uBC88 \uC9C8\uBB38\uC5D0 \uCCA8\uBD80 ${attachmentsForTurn.length}\uAC1C\uB97C \uD3EC\uD568\uD569\uB2C8\uB2E4.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const parsedTopK = Number.parseInt(this.topKInput.value, 10);
    const topK = Number.isFinite(parsedTopK) && parsedTopK >= 1 ? Math.min(15, parsedTopK) : this.plugin.settings.qaTopK;
    if (!preloadedTurn) {
      this.inputEl.value = "";
    }
    this.pushMessage({
      role: "user",
      text: question,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.running = true;
    this.refreshSendButtonState();
    this.stopButton.disabled = false;
    this.stopRequested = false;
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
          if (abortController.signal.aborted || this.stopRequested) {
            return;
          }
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
          if (abortController.signal.aborted || this.stopRequested) {
            return;
          }
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
        abortController.signal,
        attachmentsForTurn,
        {
          openFilePath: openFilePathForTurn,
          openSelection: openSelectionForTurn
        }
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
        const hasTimeline = ((_e = (_d = thinking.timeline) == null ? void 0 : _d.length) != null ? _e : 0) > 0;
        const hasThinkingText = Boolean((_f = thinking.thinkingDetails) == null ? void 0 : _f.trim());
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
      const preemptPending = this.pendingPreemptTurn !== null;
      if (attachmentsForTurn.length > 0 && (!this.plugin.isAbortError(error) || !preemptPending)) {
        this.mergePendingAttachments(attachmentsForTurn);
      }
      const cancelled = this.plugin.isAbortError(error);
      const message = cancelled ? "\uC694\uCCAD\uC774 \uC911\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : error instanceof Error ? error.message : "Unknown local QA error";
      const draft = this.messages[draftIndex];
      if (cancelled) {
        if (draft && draft.role === "assistant") {
          this.messages.splice(draftIndex, 1);
        }
      } else if (draft && draft.role === "assistant" && !draft.text.trim()) {
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
        text: cancelled ? preemptPending ? "steer \uC804\uD658\uC744 \uC704\uD574 \uC774\uC804 \uC751\uB2F5\uC744 \uC911\uC9C0\uD588\uC2B5\uB2C8\uB2E4." : `\uC911\uC9C0: ${message}` : `\uC624\uB958: ${message}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (!cancelled) {
        new import_obsidian4.Notice(`Local Q&A failed: ${message}`, 7e3);
      }
    } finally {
      this.running = false;
      this.stopRequested = false;
      this.refreshSendButtonState();
      this.stopButton.disabled = true;
      this.activeRequestController = null;
      if (this.streamRenderTimer !== null) {
        window.clearTimeout(this.streamRenderTimer);
        this.streamRenderTimer = null;
      }
      await this.refreshScopeLabel();
      this.inputEl.focus();
      const preemptTurn = this.pendingPreemptTurn;
      this.pendingPreemptTurn = null;
      if (preemptTurn) {
        await this.submitQuestion(preemptTurn);
      } else {
        void this.drainQueuedTurns();
      }
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
  "Settings view mode": "\uC124\uC815 \uBCF4\uAE30 \uBAA8\uB4DC",
  "Settings UI language": "\uC124\uC815 UI \uC5B8\uC5B4",
  "Plugin mission": "\uD50C\uB7EC\uADF8\uC778 \uBAA9\uC801",
  "Quick one-click setup": "\uBE60\uB978 \uC6D0\uD074\uB9AD \uC124\uC815",
  "Conversation mode (chat runtime)": "\uB300\uD654 \uBAA8\uB4DC(\uCC44\uD305 \uB7F0\uD0C0\uC784)",
  "Mode behavior summary": "\uBAA8\uB4DC \uB3D9\uC791 \uC694\uC57D",
  "Quick custom profile slots": "\uBE60\uB978 \uCEE4\uC2A4\uD140 \uD504\uB85C\uD544 \uC2AC\uB86F",
  "Quick model pickers": "\uBE60\uB978 \uBAA8\uB378 \uC120\uD0DD\uAE30",
  "Quick provider": "\uBE60\uB978 \uC81C\uACF5\uC790",
  "Chat model source": "\uCC44\uD305 \uBAA8\uB378 \uC18C\uC2A4",
  "Chat model profile": "\uCC44\uD305 \uBAA8\uB378 \uD504\uB85C\uD544",
  "Model inventory refresh": "\uBAA8\uB378 \uC778\uBCA4\uD1A0\uB9AC \uC0C8\uB85C\uACE0\uCE68",
  "One-click local presets": "\uC6D0\uD074\uB9AD \uB85C\uCEEC \uD504\uB9AC\uC14B",
  "Flash profile": "Flash \uD504\uB85C\uD544",
  "Pro profile": "Pro \uD504\uB85C\uD544",
  "Local AI readiness": "\uB85C\uCEEC AI \uC900\uBE44 \uC0C1\uD0DC",
  "Open preset guide": "\uD504\uB9AC\uC14B \uAC00\uC774\uB4DC \uC5F4\uAE30",
  "Guide actions": "\uAC00\uC774\uB4DC \uB3D9\uC791",
  "Need advanced options?": "\uACE0\uAE09 \uC124\uC815\uC774 \uD544\uC694\uD55C\uAC00\uC694?",
  Provider: "\uC81C\uACF5\uC790",
  "Codex bridge note": "Codex \uBE0C\uB9AC\uC9C0 \uC548\uB0B4",
  "Ollama base URL": "Ollama \uAE30\uBCF8 URL",
  "Ollama detected model picker": "Ollama \uAC10\uC9C0 \uBAA8\uB378 \uC120\uD0DD\uAE30",
  "Ollama auto-match policy": "Ollama \uC790\uB3D9 \uB9E4\uCE6D \uC815\uCC45",
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
  "Analyzed depth mode": "\uBD84\uC11D \uAE4A\uC774 \uBAA8\uB4DC",
  "Analyzed runtime estimate": "\uBD84\uC11D \uC608\uC0C1 \uC2DC\uAC04",
  "Analyzed scope snapshot": "\uBD84\uC11D \uBC94\uC704 \uC2A4\uB0C5\uC0F7",
  "Suggestion mode (recommended)": "\uC81C\uC548 \uBAA8\uB4DC(\uAD8C\uC7A5)",
  "Show reasons for each field": "\uAC01 \uD544\uB4DC \uADFC\uAC70 \uD45C\uC2DC",
  "Show progress notices": "\uC9C4\uD589 \uC54C\uB9BC \uD45C\uC2DC",
  "Analyze tags": "\uD0DC\uADF8 \uBD84\uC11D",
  "Analyze topic": "\uC8FC\uC81C \uBD84\uC11D",
  "Analyze linked": "\uC5F0\uACB0 \uB178\uD2B8 \uBD84\uC11D",
  "Force all-to-all linked (deterministic)": "\uC120\uD0DD \uB178\uD2B8 \uC804\uCCB4 \uC0C1\uD638 linked \uAC15\uC81C(\uACB0\uC815\uC801)",
  "Analyze index": "\uC778\uB371\uC2A4 \uBD84\uC11D",
  "Max tags": "\uCD5C\uB300 \uD0DC\uADF8 \uC218",
  "Max linked": "\uCD5C\uB300 linked \uC218",
  "Enable semantic candidate ranking": "\uC2DC\uB9E8\uD2F1 \uD6C4\uBCF4 \uB7AD\uD0B9 \uC0AC\uC6A9",
  "Embedding Ollama base URL": "\uC784\uBCA0\uB529 Ollama \uAE30\uBCF8 URL",
  "Embedding detected model picker": "\uC784\uBCA0\uB529 \uAC10\uC9C0 \uBAA8\uB378 \uC120\uD0DD\uAE30",
  "Embedding auto-match policy": "\uC784\uBCA0\uB529 \uC790\uB3D9 \uB9E4\uCE6D \uC815\uCC45",
  "Cloud embedding behavior": "\uD074\uB77C\uC6B0\uB4DC \uC784\uBCA0\uB529 \uB3D9\uC791",
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
  "Debugger model": "Debugger \uBAA8\uB378",
  "Debugger agent": "Debugger \uC5D0\uC774\uC804\uD2B8",
  "Architect model": "Architect \uBAA8\uB378",
  "Orchestrator model": "Orchestrator \uBAA8\uB378",
  "Safeguard model": "Safeguard \uBAA8\uB378",
  "Role system prompt editor": "\uC5ED\uD560 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uD3B8\uC9D1\uAE30",
  "Prefer Ollama /api/chat (with fallback)": "Ollama /api/chat \uC6B0\uC120(\uD3F4\uBC31 \uD3EC\uD568)",
  "Show system messages in chat": "\uCC44\uD305 \uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uD45C\uC2DC",
  "Chat transcript folder path": "\uCC44\uD305 \uAE30\uB85D \uD3F4\uB354 \uACBD\uB85C",
  "Attachment ingest folder path": "\uCCA8\uBD80 \uBBF8\uB7EC\uB9C1 \uD3F4\uB354 \uACBD\uB85C",
  "Use QA context in chat": "\uCC44\uD305\uC5D0\uC11C QA \uCEE8\uD14D\uC2A4\uD2B8 \uC0AC\uC6A9",
  "Parser mode": "\uD30C\uC11C \uBAA8\uB4DC",
  "Parser tool readiness": "\uD30C\uC11C \uB3C4\uAD6C \uC900\uBE44 \uC0C1\uD0DC",
  "Auto-sync chat thread": "\uCC44\uD305 \uC2A4\uB808\uB4DC \uC790\uB3D9 \uB3D9\uAE30\uD654",
  "PDF attachments in chat": "\uCC44\uD305 PDF \uCCA8\uBD80",
  "Allow PDF attachments in chat (experimental)": "\uCC44\uD305 PDF \uCCA8\uBD80 \uD5C8\uC6A9(\uC2E4\uD5D8)",
  "Enable agent tool mode (experimental)": "\uC5D0\uC774\uC804\uD2B8 \uB3C4\uAD6C \uBAA8\uB4DC \uC0AC\uC6A9(\uC2E4\uD5D8)",
  "Require approval before tool execution": "\uB3C4\uAD6C \uC2E4\uD589 \uC804 \uC2B9\uC778 \uD544\uC694",
  "Allow shell tool (danger)": "\uC178 \uB3C4\uAD6C \uD5C8\uC6A9(\uC704\uD5D8)",
  "Agent shell full access (danger)": "\uC5D0\uC774\uC804\uD2B8 \uC178 \uC804\uCCB4 \uC811\uADFC(\uC704\uD5D8)",
  "Shell tool timeout (seconds)": "\uC178 \uB3C4\uAD6C \uD0C0\uC784\uC544\uC6C3(\uCD08)",
  "Shell tool default cwd (vault-relative, optional)": "\uC178 \uB3C4\uAD6C \uAE30\uBCF8 \uC791\uC5C5 \uD3F4\uB354(vault-relative, \uC120\uD0DD)",
  "Agent path allowlist (absolute, comma/newline)": "\uC5D0\uC774\uC804\uD2B8 \uACBD\uB85C \uD5C8\uC6A9\uBAA9\uB85D(\uC808\uB300\uACBD\uB85C, \uC27C\uD45C/\uC904\uBC14\uAFC8)",
  "Balanced preset base model": "Balanced \uD504\uB9AC\uC14B \uAE30\uBCF8 \uBAA8\uB378",
  "Balanced preset vision model": "Balanced \uD504\uB9AC\uC14B \uBE44\uC804 \uBAA8\uB378",
  "Balanced preset embedding model": "Balanced \uD504\uB9AC\uC14B \uC784\uBCA0\uB529 \uBAA8\uB378",
  "Pro preset base model": "Pro \uD504\uB9AC\uC14B \uAE30\uBCF8 \uBAA8\uB378",
  "Pro preset vision model": "Pro \uD504\uB9AC\uC14B \uBE44\uC804 \uBAA8\uB378",
  "Pro preset embedding model": "Pro \uD504\uB9AC\uC14B \uC784\uBCA0\uB529 \uBAA8\uB378",
  "Quality+ preset base model": "Quality+ \uD504\uB9AC\uC14B \uAE30\uBCF8 \uBAA8\uB378",
  "Quality+ preset vision model": "Quality+ \uD504\uB9AC\uC14B \uBE44\uC804 \uBAA8\uB378",
  "Quality+ preset embedding model": "Quality+ \uD504\uB9AC\uC14B \uC784\uBCA0\uB529 \uBAA8\uB378",
  "Preset override warning summary": "\uD504\uB9AC\uC14B \uC624\uBC84\uB77C\uC774\uB4DC \uACBD\uACE0 \uC694\uC57D",
  "Agent role model health check": "\uC5D0\uC774\uC804\uD2B8 \uC5ED\uD560 \uBAA8\uB378 \uC0C1\uD0DC \uC810\uAC80",
  "Allow non-local Q&A endpoint (danger)": "\uB85C\uCEEC \uC678 Q&A \uC5D4\uB4DC\uD3EC\uC778\uD2B8 \uD5C8\uC6A9(\uC704\uD5D8)",
  "Allowed outbound hosts (non-local Q&A)": "\uD5C8\uC6A9 \uC678\uBD80 \uD638\uC2A4\uD2B8(\uBE44\uB85C\uCEEC Q&A)",
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
  "Simple shows essentials only. Full shows all advanced controls without removing features.": "Simple\uC740 \uD575\uC2EC \uC635\uC158\uB9CC \uBCF4\uC774\uACE0, Full\uC740 \uBAA8\uB4E0 \uACE0\uAE09 \uC635\uC158\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4(\uAE30\uB2A5\uC740 \uC81C\uAC70\uB418\uC9C0 \uC54A\uC74C).",
  "Choose language style used in setting labels/descriptions across all tabs.": "\uBAA8\uB4E0 \uD0ED\uC758 \uC124\uC815 \uB77C\uBCA8/\uC124\uBA85\uC5D0 \uC0AC\uC6A9\uD560 \uC5B8\uC5B4 \uD45C\uC2DC \uBC29\uC2DD\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "1) Auto-link notes for graph-based second-brain insight. 2) Secure local AI chat/generation grounded in your notes and attachments.": "1) \uB178\uD2B8 linked \uC790\uB3D9\uD654\uB85C \uADF8\uB798\uD504 \uAE30\uBC18 \uC81C2\uC758 \uB1CC/\uC778\uC0AC\uC774\uD2B8\uB97C \uC9C0\uC6D0\uD569\uB2C8\uB2E4. 2) \uB178\uD2B8\xB7\uCCA8\uBD80 \uAE30\uBC18 \uB85C\uCEEC AI \uCC44\uD305/\uC0DD\uC131\uC744 \uBCF4\uC548 \uC6B0\uC120\uC73C\uB85C \uC81C\uACF5\uD569\uB2C8\uB2E4.",
  "Fast, balanced, and quality presets for local usage.": "\uB85C\uCEEC \uC0AC\uC6A9 \uAE30\uC900\uC73C\uB85C \uC18D\uB3C4/\uADE0\uD615/\uD488\uC9C8 \uD504\uB9AC\uC14B\uC744 \uC6D0\uD074\uB9AD \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "Ask/Plan/Agent/Orchestration \uBAA8\uB4DC\uB97C \uC120\uD0DD\uD558\uBA74 \uC5ED\uD560/\uD30C\uC774\uD504\uB77C\uC778/\uC5D0\uC774\uC804\uD2B8 \uB3C4\uAD6C \uAE30\uBCF8\uAC12\uC744 \uC989\uC2DC \uC7AC\uBC30\uCE58\uD569\uB2C8\uB2E4.": "Ask/Plan/Agent/Orchestration \uBAA8\uB4DC\uB97C \uC120\uD0DD\uD558\uBA74 \uC5ED\uD560/\uD30C\uC774\uD504\uB77C\uC778/\uC5D0\uC774\uC804\uD2B8 \uB3C4\uAD6C \uAE30\uBCF8\uAC12\uC744 \uC989\uC2DC \uC7AC\uBC30\uCE58\uD569\uB2C8\uB2E4.",
  "Fast/Balanced/Quality+ presets with automatic local model detection and role assignment.": "Fast/Balanced/Quality+\uB97C \uB204\uB974\uBA74 \uB85C\uCEEC \uBAA8\uB378\uC744 \uC790\uB3D9 \uAC10\uC9C0\uD558\uACE0 \uAE30\uBCF8/\uC5ED\uD560 \uBAA8\uB378 \uBC30\uCE58\uB97C \uC790\uB3D9 \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "Flash/Pro presets with automatic local model detection and role assignment.": "Flash/Pro\uB97C \uB204\uB974\uBA74 \uB85C\uCEEC \uBAA8\uB378\uC744 \uC790\uB3D9 \uAC10\uC9C0\uD558\uACE0 \uAE30\uBCF8/\uC5ED\uD560 \uBAA8\uB378 \uBC30\uCE58\uB97C \uC790\uB3D9 \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "See what each preset changes and which local models are recommended.": "\uAC01 \uD504\uB9AC\uC14B\uC5D0\uC11C \uBC14\uB00C\uB294 \uC124\uC815\uACFC \uAD8C\uC7A5 \uB85C\uCEEC \uBAA8\uB378 \uAD6C\uC131\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.",
  "Refresh local detection or return to Quick tab.": "\uB85C\uCEEC \uAC10\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD558\uAC70\uB098 Quick \uD0ED\uC73C\uB85C \uB3CC\uC544\uAC11\uB2C8\uB2E4.",
  "Switch to Full once to access all expert controls. Features are unchanged.": "\uC804\uBB38\uAC00\uC6A9 \uC804\uCCB4 \uC81C\uC5B4\uAC00 \uD544\uC694\uD558\uBA74 Full\uB85C \uC804\uD658\uD558\uC138\uC694. \uAE30\uB2A5\uC740 \uB3D9\uC77C\uD558\uAC8C \uC720\uC9C0\uB429\uB2C8\uB2E4.",
  "Return to Simple to focus on essentials.": "\uD575\uC2EC \uD56D\uBAA9 \uC911\uC2EC\uC73C\uB85C \uBCF4\uB824\uBA74 Simple\uB85C \uB3CC\uC544\uAC11\uB2C8\uB2E4.",
  "Choose AI provider. Local providers are recommended first.": "AI \uC81C\uACF5\uC790\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uB85C\uCEEC \uC81C\uACF5\uC790\uB97C \uC6B0\uC120 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.",
  "Choose provider in order: local > local QA bridge > cloud. Local defaults to Flash profile.": "\uC81C\uACF5\uC790 \uC21C\uC11C\uB294 \uB85C\uCEEC > \uB85C\uCEEC QA \uBE0C\uB9AC\uC9C0 > \uD074\uB77C\uC6B0\uB4DC\uC785\uB2C8\uB2E4. \uB85C\uCEEC \uC120\uD0DD \uC2DC Flash \uD504\uB85C\uD544\uC744 \uAE30\uBCF8 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Meaning: Q&A calls Codex through an OpenAI-compatible bridge endpoint (for example Agent Client) instead of a direct plugin API integration.": "\uC758\uBBF8: \uD50C\uB7EC\uADF8\uC778\uC774 Codex\uB97C \uC9C1\uC811 API \uC5F0\uB3D9\uD558\uB294 \uB300\uC2E0 OpenAI \uD638\uD658 \uBE0C\uB9AC\uC9C0 \uC5D4\uB4DC\uD3EC\uC778\uD2B8(\uC608: Agent Client)\uB97C \uD1B5\uD574 Q&A\uB97C \uD638\uCD9C\uD55C\uB2E4\uB294 \uB73B\uC785\uB2C8\uB2E4.",
  "Refresh local model detection and embedding inventory now.": "\uB85C\uCEEC \uBAA8\uB378 \uAC10\uC9C0\uC640 \uC784\uBCA0\uB529 \uC778\uBCA4\uD1A0\uB9AC\uB97C \uC989\uC2DC \uC0C8\uB85C\uACE0\uCE68\uD569\uB2C8\uB2E4.",
  "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for analysis.": "\uAC10\uC9C0\uB41C \uBAA8\uB378 \uC911\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. (\uCD94\uCC9C)=\uAD8C\uC7A5, (\uBD88\uAC00)=\uBD84\uC11D \uBD80\uC801\uD569",
  "On refresh/detect, recommended model is applied automatically.": "\uC0C8\uB85C\uACE0\uCE68/\uAC10\uC9C0 \uC2DC \uAD8C\uC7A5 \uBAA8\uB378\uC744 \uC790\uB3D9 \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "Manual override if you want a custom model name.": "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uBAA8\uB378\uBA85\uC744 \uC9C1\uC811 \uC785\uB825\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Detect local models and auto-choose recommended when current is missing.": "\uB85C\uCEEC \uBAA8\uB378\uC744 \uAC10\uC9C0\uD574 \uD604\uC7AC \uBAA8\uB378\uC774 \uC5C6\uC73C\uBA74 \uAD8C\uC7A5 \uBAA8\uB378\uC744 \uC790\uB3D9 \uC120\uD0DD\uD569\uB2C8\uB2E4.",
  "Analyze first, preview changes, and apply only when approved.": "\uBA3C\uC800 \uBD84\uC11D\uD558\uACE0 \uBCC0\uACBD \uBBF8\uB9AC\uBCF4\uAE30\uB97C \uD655\uC778\uD55C \uB4A4 \uC2B9\uC778 \uC2DC\uC5D0\uB9CC \uC801\uC6A9\uD569\uB2C8\uB2E4.",
  "When enabled, linked field includes all selected notes for each note (except self). maxLinked is ignored in this mode.": "\uCF1C\uBA74 \uAC01 \uB178\uD2B8\uC758 linked\uC5D0 \uC120\uD0DD\uB41C \uBAA8\uB4E0 \uB178\uD2B8(\uC790\uAE30 \uC790\uC2E0 \uC81C\uC678)\uB97C \uB123\uC2B5\uB2C8\uB2E4. \uC774 \uBAA8\uB4DC\uC5D0\uC11C\uB294 maxLinked\uB97C \uBB34\uC2DC\uD569\uB2C8\uB2E4.",
  "In addition to persistent progress modal, show short notices.": "\uACE0\uC815 \uC9C4\uD589 \uBAA8\uB2EC \uC678\uC5D0\uB3C4 \uC9E7\uC740 \uC54C\uB9BC\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  "Quick: changed-notes \uC911\uC2EC + semantic off. Detailed: semantic on + \uC804\uCCB4 \uBC94\uC704 \uAE30\uBC18 \uBD84\uC11D.": "Quick\uC740 \uBCC0\uACBD \uB178\uD2B8 \uC911\uC2EC+semantic off, Detailed\uB294 semantic on+\uC804\uCCB4 \uBC94\uC704 \uAE30\uBC18 \uBD84\uC11D\uC785\uB2C8\uB2E4.",
  "Quick: changed-notes centric + semantic off. Detailed: semantic on + full-scope analysis. Embedding model is auto-matched by profile when depth changes.": "Quick\uC740 \uBCC0\uACBD \uB178\uD2B8 \uC911\uC2EC+semantic off, Detailed\uB294 semantic on+\uC804\uCCB4 \uBC94\uC704 \uAE30\uBC18 \uBD84\uC11D\uC785\uB2C8\uB2E4. \uAE4A\uC774 \uBCC0\uACBD \uC2DC \uC784\uBCA0\uB529 \uBAA8\uB378\uB3C4 \uD504\uB85C\uD544 \uAE30\uC900\uC73C\uB85C \uC790\uB3D9 \uB9E4\uCE6D\uB429\uB2C8\uB2E4.",
  "Use local Ollama embeddings to rank likely related notes before AI linked suggestion.": "AI linked \uC81C\uC548 \uC804\uC5D0 \uB85C\uCEEC Ollama \uC784\uBCA0\uB529\uC73C\uB85C \uAD00\uB828 \uAC00\uB2A5 \uB178\uD2B8\uB97C \uC6B0\uC120 \uC815\uB82C\uD569\uB2C8\uB2E4.",
  "Choose among detected models. (\uCD94\uCC9C)=recommended, (\uBD88\uAC00)=not suitable for embeddings.": "\uAC10\uC9C0\uB41C \uBAA8\uB378 \uC911\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. (\uCD94\uCC9C)=\uAD8C\uC7A5, (\uBD88\uAC00)=\uC784\uBCA0\uB529 \uBD80\uC801\uD569",
  "Choose among embedding-capable detected models. (\uCD94\uCC9C)=recommended.": "\uC784\uBCA0\uB529 \uAC00\uB2A5\uD55C \uAC10\uC9C0 \uBAA8\uB378 \uC911\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. (\uCD94\uCC9C)=\uAD8C\uC7A5",
  "Embedding detected picker is shown only for Ollama provider. In cloud mode, this picker is hidden and semantic linking uses the last saved local embedding model when enabled.": "Embedding \uAC10\uC9C0 \uC120\uD0DD\uAE30\uB294 Ollama \uC81C\uACF5\uC790\uC77C \uB54C\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4. \uD074\uB77C\uC6B0\uB4DC \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uC120\uD0DD\uAE30\uAC00 \uC228\uACA8\uC9C0\uBA70, semantic linking\uC774 \uCF1C\uC838 \uC788\uC73C\uBA74 \uB9C8\uC9C0\uB9C9 \uC800\uC7A5\uB41C \uB85C\uCEEC \uC784\uBCA0\uB529 \uBAA8\uB378\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "On refresh/detect, recommended embedding model is applied automatically.": "\uC0C8\uB85C\uACE0\uCE68/\uAC10\uC9C0 \uC2DC \uAD8C\uC7A5 \uC784\uBCA0\uB529 \uBAA8\uB378\uC744 \uC790\uB3D9 \uC801\uC6A9\uD569\uB2C8\uB2E4.",
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
  "Prefer vision-capable models for Ask (vision). Chat supports image attachments (drop/upload/paste).": "Ask(\uBE44\uC804)\uC740 \uBE44\uC804 \uAC00\uB2A5\uD55C \uBAA8\uB378\uC744 \uC6B0\uC120 \uAD8C\uC7A5\uD569\uB2C8\uB2E4. \uCC44\uD305\uC740 \uC774\uBBF8\uC9C0 \uCCA8\uBD80(\uB4DC\uB798\uADF8/\uC5C5\uB85C\uB4DC/\uBD99\uC5EC\uB123\uAE30)\uB97C \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",
  "Reserved for image-generation workflows. Current chat UI is text-first.": "\uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC6CC\uD06C\uD50C\uB85C\uC6A9 \uC608\uC57D \uBAA8\uB378\uC785\uB2C8\uB2E4. \uD604\uC7AC \uCC44\uD305 UI\uB294 \uD14D\uC2A4\uD2B8 \uC911\uC2EC\uC785\uB2C8\uB2E4.",
  "Add extra system instructions per role agent. Empty keeps built-in role prompt only.": "\uC5ED\uD560\uBCC4 \uC5D0\uC774\uC804\uD2B8\uC5D0 \uCD94\uAC00 \uC2DC\uC2A4\uD15C \uC9C0\uC2DC\uB97C \uB123\uC2B5\uB2C8\uB2E4. \uBE44\uC6B0\uBA74 \uAE30\uBCF8 \uC5ED\uD560 \uD504\uB86C\uD504\uD2B8\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Use role-based chat first, then fallback to /api/generate when unavailable.": "\uC5ED\uD560 \uAE30\uBC18 /api/chat\uC744 \uC6B0\uC120 \uC0AC\uC6A9\uD558\uACE0, \uBD88\uAC00\uD558\uBA74 /api/generate\uB85C \uD3F4\uBC31\uD569\uB2C8\uB2E4.",
  "Off by default. When OFF, system logs are hidden and omitted from saved chat transcript.": "\uAE30\uBCF8\uAC12\uC740 OFF\uC785\uB2C8\uB2E4. OFF\uC77C \uB54C \uC2DC\uC2A4\uD15C \uB85C\uADF8\uB294 \uCC44\uD305 \uD654\uBA74\uC5D0\uC11C \uC228\uACA8\uC9C0\uACE0 \uC800\uC7A5\uB41C \uCC44\uD305 \uAE30\uB85D\uC5D0\uC11C\uB3C4 \uC81C\uC678\uB429\uB2C8\uB2E4.",
  "Vault-relative path for saving chat transcripts.": "\uCC44\uD305 \uAE30\uB85D \uC800\uC7A5\uC6A9 vault-relative \uACBD\uB85C\uC785\uB2C8\uB2E4.",
  "Vault-relative folder where external attachments are mirrored for stable source links.": "\uC678\uBD80 \uCCA8\uBD80\uB97C \uC548\uC815\uC801\uC778 \uCD9C\uCC98 \uB9C1\uD06C\uB85C \uC5F4\uAE30 \uC704\uD574 vault \uB0B4\uBD80\uB85C \uBBF8\uB7EC\uB9C1\uD558\uB294 \uD3F4\uB354 \uACBD\uB85C\uC785\uB2C8\uB2E4.",
  "When disabled, chat runs in general mode without selected-note retrieval context.": "\uBE44\uD65C\uC131\uD654\uD558\uBA74 \uC120\uD0DD \uB178\uD2B8 \uB9AC\uD2B8\uB9AC\uBC8C \uC5C6\uC774 \uC77C\uBC18 \uCC44\uD305 \uBAA8\uB4DC\uB85C \uB3D9\uC791\uD569\uB2C8\uB2E4.",
  "Fast: lightweight parsing. Detailed: OCR and deeper parser chain for difficult files.": "Fast\uB294 \uACBD\uB7C9 \uD30C\uC11C, Detailed\uB294 OCR/\uC2EC\uD654 \uCCB4\uC778\uC744 \uC801\uADF9 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "When enabled, the current chat thread is continuously saved and updated as messages change.": "\uD65C\uC131\uD654\uD558\uBA74 \uD604\uC7AC \uCC44\uD305 \uC2A4\uB808\uB4DC\uB97C \uBA54\uC2DC\uC9C0 \uBCC0\uACBD\uC5D0 \uB9DE\uCDB0 \uACC4\uC18D \uC800\uC7A5/\uB3D9\uAE30\uD654\uD569\uB2C8\uB2E4.",
  "When enabled, PDF files can be attached in chat. Current mode keeps metadata/label context and routes to vision role for safer handling.": "\uD65C\uC131\uD654\uD558\uBA74 \uCC44\uD305\uC5D0\uC11C PDF \uCCA8\uBD80\uB97C \uD5C8\uC6A9\uD569\uB2C8\uB2E4. \uD604\uC7AC\uB294 \uBA54\uD0C0\uB370\uC774\uD130/\uB77C\uBCA8 \uC911\uC2EC \uCEE8\uD14D\uC2A4\uD2B8\uB85C \uCC98\uB9AC\uD558\uBA70 \uBE44\uC804 \uC5ED\uD560\uB85C \uC6B0\uC120 \uB77C\uC6B0\uD305\uD569\uB2C8\uB2E4.",
  "Shows all preset override fields currently marked with warning (\u26A0) in one place.": "\u26A0 \uACBD\uACE0\uAC00 \uBD99\uC740 \uD504\uB9AC\uC14B \uC624\uBC84\uB77C\uC774\uB4DC \uD544\uB4DC\uB97C \uD55C \uACF3\uC5D0\uC11C \uBAA8\uC544 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
  "Quick diagnostic for role-model auto assignment and unavailable role mappings.": "\uC5ED\uD560 \uBAA8\uB378 \uC790\uB3D9 \uBC30\uCE58\uC640 \uBD88\uAC00 \uB9E4\uD551\uC744 \uBE60\uB974\uAC8C \uC810\uAC80\uD569\uB2C8\uB2E4.",
  "Allow model-proposed actions (read/write/list/shell) from chat responses via omni-forge-actions JSON block.": "\uCC44\uD305 \uC751\uB2F5\uC758 omni-forge-actions JSON \uBE14\uB85D\uC744 \uD1B5\uD574 \uBAA8\uB378 \uC81C\uC548 \uC561\uC158(\uC77D\uAE30/\uC4F0\uAE30/\uBAA9\uB85D/\uC178)\uC744 \uD5C8\uC6A9\uD569\uB2C8\uB2E4.",
  "Recommended. If enabled, proposed actions are queued and run only after user sends '\uC2B9\uC778' or '/approve'.": "\uAD8C\uC7A5 \uC124\uC815\uC785\uB2C8\uB2E4. \uCF1C\uBA74 \uC81C\uC548\uB41C \uC561\uC158\uC744 \uB300\uAE30\uC5F4\uC5D0 \uB450\uACE0 \uC0AC\uC6A9\uC790\uAC00 '\uC2B9\uC778' \uB610\uB294 '/approve' \uC785\uB825 \uC2DC\uC5D0\uB9CC \uC2E4\uD589\uD569\uB2C8\uB2E4.",
  "Allows run_shell actions via local terminal command execution. Keep off unless absolutely needed.": "\uB85C\uCEEC \uD130\uBBF8\uB110 \uBA85\uB839 \uC2E4\uD589 \uAE30\uBC18 run_shell \uC561\uC158\uC744 \uD5C8\uC6A9\uD569\uB2C8\uB2E4. \uAF2D \uD544\uC694\uD560 \uB54C\uB9CC \uCF1C\uC138\uC694.",
  "If enabled, run_shell and agent file actions(read/write/list) can use any absolute path (allowlist bypass).": "\uD65C\uC131\uD654\uD558\uBA74 run_shell\uACFC \uC5D0\uC774\uC804\uD2B8 \uD30C\uC77C \uC561\uC158(read/write/list)\uC774 \uC784\uC758\uC758 \uC808\uB300\uACBD\uB85C\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4(allowlist \uC6B0\uD68C).",
  "Per command timeout for run_shell actions.": "run_shell \uC561\uC158\uC758 \uBA85\uB839\uBCC4 \uC81C\uD55C \uC2DC\uAC04\uC785\uB2C8\uB2E4.",
  "Example: '.' for vault root, 'Projects' for a subfolder. Empty means vault root.": "\uC608: vault \uB8E8\uD2B8\uB294 '.', \uD558\uC704 \uD3F4\uB354\uB294 'Projects'. \uBE44\uC6CC\uB450\uBA74 vault \uB8E8\uD2B8\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  "Shell tool absolute cwd allowlist. Default: (empty, set explicitly if needed)": "Shell \uB3C4\uAD6C\uC758 \uC808\uB300\uACBD\uB85C \uC791\uC5C5 \uD3F4\uB354 \uD5C8\uC6A9 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uAE30\uBCF8\uAC12: (\uBE44\uC5B4 \uC788\uC74C, \uD544\uC694 \uC2DC \uC9C1\uC811 \uC124\uC815)",
  "Absolute path allowlist for run_shell cwd and agent file actions(read/write/list) when full access is OFF. Default: (empty, vault-only)": "full access OFF\uC77C \uB54C run_shell cwd\uC640 \uC5D0\uC774\uC804\uD2B8 \uD30C\uC77C \uC561\uC158(read/write/list)\uC5D0 \uC0AC\uC6A9\uD560 \uC808\uB300\uACBD\uB85C \uD5C8\uC6A9 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uAE30\uBCF8\uAC12: (\uBE44\uC5B4 \uC788\uC74C, vault \uC804\uC6A9)",
  "Optional manual base-model override for Balanced preset.": "Balanced \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uAE30\uBCF8 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual vision-model override for Balanced preset.": "Balanced \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uBE44\uC804 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual embedding-model override for Balanced preset.": "Balanced \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uC784\uBCA0\uB529 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual base-model override for Pro preset.": "Pro \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uAE30\uBCF8 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual vision-model override for Pro preset.": "Pro \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uBE44\uC804 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual embedding-model override for Pro preset.": "Pro \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uC784\uBCA0\uB529 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual base-model override for Quality+ preset.": "Quality+ \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uAE30\uBCF8 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual vision-model override for Quality+ preset.": "Quality+ \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uBE44\uC804 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Optional manual embedding-model override for Quality+ preset.": "Quality+ \uD504\uB9AC\uC14B \uC801\uC6A9 \uC2DC \uC784\uBCA0\uB529 \uBAA8\uB378\uC744 \uC218\uB3D9\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4(\uC120\uD0DD).",
  "Off by default. Keep disabled to prevent note data leaving localhost.": "\uAE30\uBCF8\uAC12\uC740 \uAEBC\uC9D0\uC785\uB2C8\uB2E4. \uB178\uD2B8 \uB370\uC774\uD130\uAC00 localhost \uBC16\uC73C\uB85C \uB098\uAC00\uC9C0 \uC54A\uB3C4\uB85D \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB97C \uAD8C\uC7A5\uD569\uB2C8\uB2E4.",
  "Comma/newline-separated host allowlist used when non-local endpoint is enabled. Example: api.openai.com, api.anthropic.com": "\uBE44\uB85C\uCEEC \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB97C \uC0AC\uC6A9\uD560 \uB54C \uC801\uC6A9\uD560 \uD638\uC2A4\uD2B8 \uD5C8\uC6A9 \uBAA9\uB85D\uC785\uB2C8\uB2E4(\uC27C\uD45C/\uC904\uBC14\uAFC8 \uAD6C\uBD84). \uC608: api.openai.com, api.anthropic.com",
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
function splitInlineBilingualText(originalText) {
  var _a, _b;
  const normalized = (_a = originalText == null ? void 0 : originalText.trim()) != null ? _a : "";
  if (!normalized || !normalized.includes(" / ")) {
    return null;
  }
  const parts = normalized.split(" / ");
  if (parts.length < 2) {
    return null;
  }
  const en = ((_b = parts[0]) != null ? _b : "").trim();
  const ko = parts.slice(1).join(" / ").trim();
  if (!en || !ko) {
    return null;
  }
  return { en, ko };
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
    description: "Prefer vision-capable models for Ask (vision). Chat supports image attachments (drop/upload/paste)."
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
    key: "qaDebuggerModel",
    role: "debugger",
    name: "Debugger model",
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
var VISION_MODEL_REGEX = /(vision|llava|bakllava|moondream|qwen.*vl|pixtral|internvl|minicpm[-_]?v|florence|gemma3)/i;
var IMAGE_GENERATOR_MODEL_REGEX = /(flux|sdxl|stable[-_ ]?diffusion|diffusion|imagegen|image-gen)/i;
var GENERAL_TEXT_MODEL_REGEX = /(qwen|llama|gpt-(?!oss)|gpt-oss|gemma|mistral|devstral|phi|deepseek|yi|claude|gemini|codex|o1|o3|o4)/i;
var CLOUD_OPENAI_MODEL_REGEX = /\b(gpt-(?!oss)|o1|o3|o4|codex)\b/i;
var CLOUD_ANTHROPIC_MODEL_REGEX = /\bclaude\b/i;
var CLOUD_GEMINI_MODEL_REGEX = /\bgemini\b/i;
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
  if (role === "ask_vision" || role === "image_generator") {
    return VISION_MODEL_REGEX.test(trimmed.toLowerCase());
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
      if (/llama3\.2-vision/.test(lower)) {
        score += 14;
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
      if (/llama3\.2-vision/.test(lower)) {
        score += 10;
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
        reason: role === "ask_vision" || role === "image_generator" ? "Not suitable for vision/image role." : "Not suitable for current text-based role pipeline."
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
      reason: (role === "ask_vision" || role === "image_generator") && VISION_MODEL_REGEX.test(model.toLowerCase()) ? "Available vision-capable model for multimodal role." : "Available text-capable model."
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
function getQaPipelinePresetLabel(value) {
  var _a;
  const found = QA_PIPELINE_PRESET_OPTIONS.find((option) => option.value === value);
  return (_a = found == null ? void 0 : found.label) != null ? _a : value;
}
var QA_QUICK_CUSTOM_SLOT_CONFIGS = [
  { key: "qaQuickCustomProfileSlot1", label: "\uCEE4\uC2A4\uD140 1" },
  { key: "qaQuickCustomProfileSlot2", label: "\uCEE4\uC2A4\uD140 2" },
  { key: "qaQuickCustomProfileSlot3", label: "\uCEE4\uC2A4\uD140 3" }
];
var QA_CONVERSATION_MODE_OPTIONS = [
  { value: "ask", label: "Ask" },
  { value: "plan", label: "Plan" },
  { value: "agent", label: "Agent" },
  { value: "orchestration", label: "Orchestration" }
];
function getQaLocalPresetProfileLabel(value) {
  switch (value) {
    case "fast_local":
      return "Flash";
    case "balanced_local":
      return "Pro";
    case "quality_local":
      return "Pro";
    case "custom":
    default:
      return "Custom";
  }
}
function getQaConversationModeLabel(value) {
  var _a;
  const found = QA_CONVERSATION_MODE_OPTIONS.find((option) => option.value === value);
  return (_a = found == null ? void 0 : found.label) != null ? _a : "Ask";
}
var _KnowledgeWeaverSettingTab = class _KnowledgeWeaverSettingTab extends import_obsidian4.PluginSettingTab {
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
    const compatibleOptions = roleOptions.filter((option) => option.status !== "unavailable");
    const hasCompatible = compatibleOptions.length > 0;
    const currentUnavailable = currentValue.length > 0 && !roleOptions.some((option) => option.model === currentValue && option.status !== "unavailable");
    const setting = new import_obsidian4.Setting(containerEl).setName(config.name).setDesc(
      hasCompatible ? currentUnavailable ? `${config.description}
\u26A0 \uD604\uC7AC \uC120\uD0DD \uBAA8\uB378 '${currentValue}'\uC740(\uB294) \uC774 \uC5ED\uD560\uC5D0\uC11C \uBD88\uAC00\uC785\uB2C8\uB2E4. \uD3F4\uBC31 \uB610\uB294 \uAD8C\uC7A5 \uBAA8\uB378\uB85C \uBCC0\uACBD\uD558\uC138\uC694.` : config.description : `${config.description}
\u26A0 \uD604\uC7AC \uAC10\uC9C0\uB41C \uD638\uD658 \uBAA8\uB378\uC774 \uC5C6\uC5B4 \uC774 \uC5ED\uD560\uC740 \uC2E4\uD589 \uBD88\uAC00 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.`
    ).addDropdown((dropdown) => {
      dropdown.addOption(
        ROLE_MODEL_FALLBACK_VALUE,
        "Use Q&A model fallback / Q&A \uBAA8\uB378 \uD3F4\uBC31"
      );
      for (const option of compatibleOptions) {
        dropdown.addOption(option.model, this.formatDetectedModelLabel(option));
      }
      const selected = currentValue && compatibleOptions.some((option) => option.model === currentValue) ? currentValue : ROLE_MODEL_FALLBACK_VALUE;
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
      if (!hasCompatible) {
        dropdown.setDisabled(true);
      }
    });
    if (!hasCompatible) {
      setting.settingEl.addClass("omni-forge-setting-unavailable-model");
      const link = config.role === "ask_vision" || config.role === "image_generator" ? "https://ollama.com/library/qwen2.5vl" : "https://ollama.com/library/qwen3";
      setting.addButton(
        (button) => button.setButtonText("\uCD94\uCC9C \uBAA8\uB378 \uB9C1\uD06C").onClick(() => {
          window.open(link);
        })
      ).addExtraButton(
        (button) => button.setIcon("alert-triangle").setTooltip("\uAC10\uC9C0\uB41C \uD638\uD658 \uBAA8\uB378\uC774 \uC5C6\uC5B4 \uD574\uB2F9 \uC5ED\uD560\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")
      );
    }
  }
  getPresetModelAvailabilityInfo(kind, modelName, presetHint) {
    var _a, _b, _c, _d, _e, _f;
    const current = modelName.trim();
    if (kind === "embedding") {
      const options2 = this.plugin.getEmbeddingModelOptions();
      const detected2 = options2.map((option) => option.model);
      const recommended2 = (_b = (_a = options2.find((option) => option.status === "recommended")) == null ? void 0 : _a.model) != null ? _b : "";
      const available2 = !current || detected2.includes(current);
      if (!current) {
        return {
          available: true,
          note: `\uD604\uC7AC \uBE44\uC5B4 \uC788\uC74C. \uAD8C\uC7A5 \uC784\uBCA0\uB529 \uBAA8\uB378: ${recommended2 || "(none / \uC5C6\uC74C)"}`,
          recommended: recommended2,
          link: "https://ollama.com/library/nomic-embed-text",
          detectedCount: detected2.length
        };
      }
      return {
        available: available2,
        note: available2 ? `\uD604\uC7AC \uBAA8\uB378 \uAC10\uC9C0\uB428: ${current}` : `\u26A0 \uD604\uC7AC \uBAA8\uB378 '${current}'\uC774(\uAC00) \uAC10\uC9C0 \uBAA9\uB85D\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uD589 \uC2DC \uD3F4\uBC31/\uC131\uB2A5 \uC800\uD558\uAC00 \uBC1C\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
        recommended: recommended2,
        link: "https://ollama.com/library/nomic-embed-text",
        detectedCount: detected2.length
      };
    }
    const options = this.plugin.getOllamaModelOptions();
    const filtered = kind === "vision" ? options.filter((option) => VISION_MODEL_REGEX.test(option.model.toLowerCase())) : options;
    const detected = filtered.map((option) => option.model);
    const recommendedFromPreset = presetHint ? this.plugin.getRecommendedPresetOverrideModelForQa(presetHint, kind) : "";
    const recommended = recommendedFromPreset || (kind === "vision" ? ((_c = filtered.find((option) => option.status === "recommended")) == null ? void 0 : _c.model) || ((_d = filtered.find((option) => option.status === "available")) == null ? void 0 : _d.model) || "" : ((_e = filtered.find((option) => option.status === "recommended")) == null ? void 0 : _e.model) || ((_f = options.find((option) => option.status === "recommended")) == null ? void 0 : _f.model) || "");
    const available = !current || detected.includes(current);
    const link = kind === "vision" ? "https://ollama.com/library/qwen2.5vl" : "https://ollama.com/library/qwen3";
    if (kind === "vision" && detected.length === 0) {
      return {
        available: false,
        note: "\u26A0 \uAC10\uC9C0\uB41C \uBE44\uC804 \uBAA8\uB378\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. Ask(vision) \uC5ED\uD560 \uBC0F \uC774\uBBF8\uC9C0/PDF \uAE30\uBC18 \uCC98\uB9AC\uB294 \uD604\uC7AC \uD65C\uC6A9 \uBD88\uAC00\uC785\uB2C8\uB2E4.",
        recommended: "",
        link,
        detectedCount: 0
      };
    }
    if (!current) {
      return {
        available: true,
        note: `\uD604\uC7AC \uBE44\uC5B4 \uC788\uC74C. \uAD8C\uC7A5 \uBAA8\uB378: ${recommended || "(none / \uC5C6\uC74C)"}`,
        recommended,
        link,
        detectedCount: detected.length
      };
    }
    return {
      available,
      note: available ? `\uD604\uC7AC \uBAA8\uB378 \uAC10\uC9C0\uB428: ${current}` : `\u26A0 \uD604\uC7AC \uBAA8\uB378 '${current}'\uC774(\uAC00) \uAC10\uC9C0 \uBAA9\uB85D\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uD589 \uC2DC \uD3F4\uBC31/\uC131\uB2A5 \uC800\uD558\uAC00 \uBC1C\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
      recommended,
      link,
      detectedCount: detected.length
    };
  }
  addPresetProfileModelSetting(containerEl, config) {
    const current = this.plugin.settings[config.key].trim();
    const availability = this.getPresetModelAvailabilityInfo(config.kind, current, config.preset);
    const showModelGuideLink = !availability.available || !availability.recommended || availability.detectedCount === 0;
    const setting = new import_obsidian4.Setting(containerEl).setName(config.name).setDesc(`${config.description}
${availability.note}`).addText(
      (text) => text.setPlaceholder(config.placeholder).setValue(current).onChange(async (value) => {
        this.plugin.settings[config.key] = value.trim();
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (showModelGuideLink) {
      setting.addButton(
        (button) => button.setButtonText("\uCD94\uCC9C \uBAA8\uB378 \uB9C1\uD06C").onClick(async () => {
          window.open(availability.link);
        })
      );
    }
    if (availability.recommended) {
      setting.addButton(
        (button) => button.setButtonText("\uAD8C\uC7A5\uAC12").onClick(async () => {
          this.plugin.settings[config.key] = availability.recommended;
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }
    if (!availability.available || config.kind === "vision" && availability.detectedCount === 0) {
      setting.settingEl.addClass("omni-forge-setting-unavailable-model");
      setting.addExtraButton(
        (button) => button.setIcon("alert-triangle").setTooltip(
          config.kind === "vision" && availability.detectedCount === 0 ? "\uBE44\uC804 \uBAA8\uB378\uC774 \uAC10\uC9C0\uB418\uC9C0 \uC54A\uC544 \uD574\uB2F9 \uD504\uB9AC\uC14B \uBE44\uC804 \uACBD\uB85C\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uAC10\uC9C0\uB418\uC9C0 \uC54A\uC740 \uBAA8\uB378\uC785\uB2C8\uB2E4. \uC124\uCE58/\uC774\uB984 \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4."
        )
      );
    }
  }
  collectPresetOverrideWarnings() {
    const checks = [
      { name: "Pro base", key: "qaBalancedPresetBaseModel", kind: "text" },
      { name: "Pro vision", key: "qaBalancedPresetVisionModel", kind: "vision" },
      { name: "Pro embedding", key: "qaBalancedPresetEmbeddingModel", kind: "embedding" }
    ];
    const warnings = [];
    for (const check of checks) {
      const value = this.plugin.settings[check.key].trim();
      if (!value) {
        continue;
      }
      const availability = this.getPresetModelAvailabilityInfo(
        check.kind,
        value,
        "balanced_local"
      );
      if (!availability.available) {
        warnings.push({
          name: check.name,
          note: availability.note,
          link: availability.link
        });
      }
    }
    return warnings;
  }
  getRoleModelHealthSummary() {
    const unavailable = [];
    const blockedRoles = [];
    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const options = this.plugin.getRoleModelOptionsForQa(config.role);
      const hasCompatible = options.some((option) => option.status !== "unavailable");
      if (!hasCompatible) {
        blockedRoles.push(config.name);
      }
      const selected = this.plugin.settings[config.key].trim();
      if (!selected) {
        continue;
      }
      if (!isOllamaModelAllowedForQaRole(config.role, selected)) {
        unavailable.push(`${config.name}=${selected}`);
      }
    }
    const parts = [];
    if (blockedRoles.length > 0) {
      parts.push(`\uD65C\uC6A9 \uBD88\uAC00 \uC5ED\uD560 ${blockedRoles.length}\uAC1C: ${blockedRoles.join(", ")}`);
    }
    if (unavailable.length > 0) {
      parts.push(`\uBD88\uAC00 \uB9E4\uD551 ${unavailable.length}\uAC1C: ${unavailable.join(", ")}`);
    }
    if (parts.length === 0) {
      parts.push("\uC5ED\uD560 \uBAA8\uB378 \uB9E4\uD551 \uC0C1\uD0DC \uC815\uC0C1(\uBD88\uAC00 \uD56D\uBAA9 \uC5C6\uC74C).");
    }
    return { unavailable, blockedRoles, summary: parts.join(" | ") };
  }
  getVaultFolderOptionsForShellCwd() {
    const seen = /* @__PURE__ */ new Set();
    const folders = this.app.vault.getAllLoadedFiles().filter((entry) => entry instanceof import_obsidian4.TFolder).map((folder) => (0, import_obsidian4.normalizePath)(folder.path)).filter((path) => path.length > 0 && path !== "/").sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
    const unique = [];
    for (const folderPath of folders) {
      if (seen.has(folderPath)) {
        continue;
      }
      seen.add(folderPath);
      unique.push(folderPath);
    }
    return unique;
  }
  splitGuideLines(rawText) {
    return (rawText != null ? rawText : "").split(/\n|\|/g).map((line) => line.trim()).filter((line) => line.length > 0);
  }
  addViewModeAndPresetControls(containerEl) {
    const provider = this.plugin.settings.provider;
    const family = provider === "ollama" || provider === "lmstudio" ? "local" : "cloud";
    new import_obsidian4.Setting(containerEl).setName("Chat model profile / \uCC44\uD305 \uBAA8\uB378 \uD504\uB85C\uD544").setDesc("Local: local-flash/local-pro. Cloud: codex/claude/gemini (bridge endpoint required).").addDropdown((dropdown) => {
      const options = this.plugin.getQaChatModelProfileOptionsForQa(family);
      for (const option of options) {
        dropdown.addOption(option.value, option.label);
      }
      const current = this.plugin.getQaChatModelProfileForQa();
      const fallback = options.length > 0 ? options[0].value : "";
      dropdown.setValue(options.some((option) => option.value === current) ? current : fallback);
      dropdown.onChange(async (value) => {
        if (provider === "lmstudio") {
          const normalized = value === "local-pro" ? "local-pro" : "local-flash";
          this.plugin.settings.qaChatModelFamily = "local";
          this.plugin.settings.qaChatModelProfile = normalized;
          this.plugin.settings.qaLocalPresetProfile = normalized === "local-pro" ? "balanced_local" : "fast_local";
          await this.plugin.saveSettings();
          await this.plugin.refreshOpenQaWorkspaceViews();
        } else {
          const summary = await this.plugin.applyQaChatModelProfileForQa(value, family);
          new import_obsidian4.Notice(summary, 6e3);
        }
        this.display();
      });
    });
    new import_obsidian4.Setting(containerEl).setName("Model inventory refresh / \uBAA8\uB378 \uC778\uBCA4\uD1A0\uB9AC \uC0C8\uB85C\uACE0\uCE68").setDesc("Refresh local model detection and embedding inventory now.").addButton(
      (button) => button.setButtonText("Refresh / \uC0C8\uB85C\uACE0\uCE68").onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
        this.display();
      })
    );
  }
  addChatPresetControls(containerEl) {
    const uiMode = this.plugin.settings.settingsUiLanguage;
    const localize = (en, ko) => uiMode === "en" ? en : uiMode === "ko" ? ko : `${en} / ${ko}`;
    const textOptions = this.plugin.getOllamaModelOptions().filter((option) => option.status !== "unavailable");
    const embeddingOptions = this.plugin.getEmbeddingModelOptions().filter((option) => option.status !== "unavailable");
    const summarizeDetected = (options, limit = 4) => {
      if (options.length === 0) {
        return "(none)";
      }
      const names = options.slice(0, limit).map((option) => option.model);
      return options.length > limit ? `${names.join(", ")} ... (+${options.length - limit})` : names.join(", ");
    };
    const flashText = this.plugin.getRecommendedPresetOverrideModelForQa("fast_local", "text") || "(none)";
    const flashVision = this.plugin.getRecommendedPresetOverrideModelForQa("fast_local", "vision") || "(none)";
    const flashEmbedding = this.plugin.getRecommendedPresetOverrideModelForQa("fast_local", "embedding") || "(none)";
    new import_obsidian4.Setting(containerEl).setName("Flash profile / Flash \uD504\uB85C\uD544").setDesc(
      [
        localize(`Detected text models: ${summarizeDetected(textOptions)}`, `감지 텍스트 모델: ${summarizeDetected(textOptions)}`),
        localize(`Detected embedding models: ${summarizeDetected(embeddingOptions)}`, `감지 임베딩 모델: ${summarizeDetected(embeddingOptions)}`),
        localize(`Recommended: text=${flashText}, vision=${flashVision}, embedding=${flashEmbedding}`, `추천값: text=${flashText}, vision=${flashVision}, embedding=${flashEmbedding}`)
      ].join("\n")
    ).addButton(
      (button) => button.setButtonText(localize("Apply Flash", "Flash 적용")).onClick(async () => {
        const summary = await this.plugin.applyQaChatModelProfileForQa("local-flash", "local");
        new import_obsidian4.Notice(summary, 6500);
        this.display();
      })
    );
    const proText = this.plugin.getRecommendedPresetOverrideModelForQa("balanced_local", "text") || "(none)";
    const proVision = this.plugin.getRecommendedPresetOverrideModelForQa("balanced_local", "vision") || "(none)";
    const proEmbedding = this.plugin.getRecommendedPresetOverrideModelForQa("balanced_local", "embedding") || "(none)";
    new import_obsidian4.Setting(containerEl).setName("Pro profile / Pro \uD504\uB85C\uD544").setDesc(
      [
        localize(`Detected text models: ${summarizeDetected(textOptions)}`, `감지 텍스트 모델: ${summarizeDetected(textOptions)}`),
        localize(`Detected embedding models: ${summarizeDetected(embeddingOptions)}`, `감지 임베딩 모델: ${summarizeDetected(embeddingOptions)}`),
        localize(`Recommended: text=${proText}, vision=${proVision}, embedding=${proEmbedding}`, `추천값: text=${proText}, vision=${proVision}, embedding=${proEmbedding}`)
      ].join("\n")
    ).addButton(
      (button) => button.setButtonText(localize("Apply Pro", "Pro 적용")).onClick(async () => {
        const summary = await this.plugin.applyQaChatModelProfileForQa("local-pro", "local");
        new import_obsidian4.Notice(summary, 6500);
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText(localize("Refresh detect", "감지 새로고침")).onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
        this.display();
      })
    );
  }
  addSettingsTabSwitcher(containerEl) {
    const row = containerEl.createDiv({ cls: "omni-forge-settings-tab-row" });
    const mode = this.plugin.settings.settingsUiLanguage;
    for (const tab of _KnowledgeWeaverSettingTab.TAB_OPTIONS) {
      const label = mode === "en" ? tab.en : mode === "ko" ? tab.ko : `${tab.en} / ${tab.ko}`;
      const button = row.createEl("button", { text: label });
      button.addClass("omni-forge-settings-tab-btn");
      if (this.plugin.settings.settingsActiveTab === tab.key) {
        button.addClass("is-active");
      }
      button.onclick = async () => {
        if (this.plugin.settings.settingsActiveTab === tab.key) {
          return;
        }
        this.plugin.settings.settingsActiveTab = tab.key;
        await this.plugin.saveSettings();
        this.display();
      };
    }
  }
  addSettingsLanguageControl(containerEl) {
    const languageSetting = new import_obsidian4.Setting(containerEl).setName("Settings UI language").setDesc("Choose language style used in setting labels/descriptions across all tabs.").addDropdown(
      (dropdown) => dropdown.addOption("ko", "[KO] \uD55C\uAD6D\uC5B4").addOption("en", "[EN] English").addOption("bilingual", "[KO/EN] Bilingual").setValue(this.plugin.settings.settingsUiLanguage).onChange(async (value) => {
        const next = value === "en" || value === "bilingual" ? value : "ko";
        this.plugin.settings.settingsUiLanguage = next;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    languageSetting.settingEl.addClass("omni-forge-settings-quick");
  }
  isSectionVisibleForTab(sectionTitle, tab) {
    if (tab === "advanced") {
      return true;
    }
    if (tab === "guide") {
      return false;
    }
    switch (tab) {
      case "quick":
        return sectionTitle === "__prelude" || sectionTitle === "Local provider config" || sectionTitle === "Cloud provider config" || sectionTitle === "Local Q&A (security-first) / \uB85C\uCEEC Q&A (\uBCF4\uC548 \uC6B0\uC120)";
      case "analyzed":
        return sectionTitle === "Behavior" || sectionTitle === "Semantic linking (Ollama embeddings)" || sectionTitle === "Property cleanup" || sectionTitle === "Selection and backup" || sectionTitle === "MOC";
      case "chat":
        return sectionTitle === "__prelude" || sectionTitle === "Behavior" || sectionTitle === "Local Q&A (security-first) / \uB85C\uCEEC Q&A (\uBCF4\uC548 \uC6B0\uC120)";
      case "orchestration":
        return sectionTitle === "__prelude" || sectionTitle === "Local Q&A (security-first) / \uB85C\uCEEC Q&A (\uBCF4\uC548 \uC6B0\uC120)" || sectionTitle === "Pipeline prompt tips / \uD30C\uC774\uD504\uB77C\uC778 \uD504\uB86C\uD504\uD2B8 \uD301";
      default:
        return true;
    }
  }
  settingNameStartsWithPrefixes(name, prefixes) {
    return prefixes.some(
      (prefix) => name.startsWith(prefix)
    );
  }
  isSettingVisibleForTab(name, tab) {
    if (name.startsWith("Settings UI language")) {
      return true;
    }
    switch (tab) {
      case "quick":
        return this.settingNameStartsWithPrefixes(
          name,
          _KnowledgeWeaverSettingTab.QUICK_TAB_VISIBLE_NAME_PREFIXES
        );
      case "analyzed":
        {
          const visible = this.settingNameStartsWithPrefixes(
            name,
            _KnowledgeWeaverSettingTab.ANALYZED_TAB_VISIBLE_NAME_PREFIXES
          );
          if (!visible) {
            return false;
          }
          if (this.plugin.settings.provider !== "ollama" && this.settingNameStartsWithPrefixes(name, _KnowledgeWeaverSettingTab.ANALYZED_OLLAMA_ONLY_PREFIXES)) {
            return false;
          }
          return true;
        }
      case "chat":
        {
          const visible = this.settingNameStartsWithPrefixes(
            name,
            _KnowledgeWeaverSettingTab.CHAT_TAB_VISIBLE_NAME_PREFIXES
          );
          if (!visible) {
            return false;
          }
          if (this.plugin.settings.provider !== "ollama" && this.settingNameStartsWithPrefixes(name, _KnowledgeWeaverSettingTab.CHAT_OLLAMA_ONLY_PREFIXES)) {
            return false;
          }
          if (this.plugin.settings.provider !== "ollama" && this.plugin.settings.provider !== "lmstudio" && this.settingNameStartsWithPrefixes(name, _KnowledgeWeaverSettingTab.CHAT_LOCAL_PROFILE_PREFIXES)) {
            return false;
          }
          return true;
        }
      case "orchestration":
        return this.settingNameStartsWithPrefixes(
          name,
          _KnowledgeWeaverSettingTab.ORCHESTRATION_TAB_VISIBLE_NAME_PREFIXES
        );
      case "advanced":
        return this.settingNameStartsWithPrefixes(
          name,
          _KnowledgeWeaverSettingTab.ADVANCED_TAB_VISIBLE_NAME_PREFIXES
        );
      case "skills":
      case "parser":
      case "guide":
        return false;
      default:
        return true;
    }
  }
  moveSectionBlockToTop(containerEl, title) {
    const children = Array.from(containerEl.children);
    const targetHeader = children.find(
      (child) => child instanceof HTMLElement && child.tagName === "H3" && ((child.textContent || "").trim() === title)
    );
    if (!(targetHeader instanceof HTMLElement)) {
      return;
    }
    const firstSectionHeader = children.find(
      (child) => child instanceof HTMLElement && child.tagName === "H3"
    );
    if (!(firstSectionHeader instanceof HTMLElement) || firstSectionHeader === targetHeader) {
      return;
    }
    const blockNodes = [];
    let cursor = targetHeader;
    while (cursor instanceof HTMLElement) {
      blockNodes.push(cursor);
      const next = cursor.nextElementSibling;
      if (!(next instanceof HTMLElement) || next.tagName === "H3") {
        break;
      }
      cursor = next;
    }
    const fragment = document.createDocumentFragment();
    for (const node of blockNodes) {
      fragment.appendChild(node);
    }
    containerEl.insertBefore(fragment, firstSectionHeader);
  }
  prioritizeAnalyzedEmbeddingSection(containerEl) {
    this.moveSectionBlockToTop(containerEl, "Behavior");
  }
  applySettingsTabVisibility(containerEl) {
    var _a, _b, _c, _d, _e, _f, _g;
    const activeTab = this.plugin.settings.settingsActiveTab;
    if (activeTab === "guide") {
      return;
    }
    let currentSection = "__prelude";
    for (const child of Array.from(containerEl.children)) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      if (child.tagName === "H2" || child.classList.contains("omni-forge-settings-tab-row") || child.classList.contains("omni-forge-settings-mode-note")) {
        continue;
      }
      if (child.tagName === "P" && !child.classList.contains("setting-item")) {
        continue;
      }
      if (child.tagName === "H3") {
        currentSection = ((_a = child.textContent) != null ? _a : "").trim();
        const visible = this.isSectionVisibleForTab(currentSection, activeTab);
        child.classList.toggle("omni-forge-hidden-tab", !visible);
        continue;
      }
      let shouldHide = !this.isSectionVisibleForTab(currentSection, activeTab);
      if (!shouldHide && child.classList.contains("setting-item")) {
        const name = (_d = (_c = (_b = child.querySelector(".setting-item-name")) == null ? void 0 : _b.textContent) == null ? void 0 : _c.trim()) != null ? _d : "";
        if (name && !this.isSettingVisibleForTab(name, activeTab)) {
          shouldHide = true;
        }
      } else if (shouldHide && child.classList.contains("setting-item")) {
        const name = (_g = (_f = (_e = child.querySelector(".setting-item-name")) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) != null ? _g : "";
        if (name.startsWith("Settings UI language")) {
          shouldHide = false;
        }
      }
      if (shouldHide) {
        child.classList.add("omni-forge-hidden-tab");
      }
    }
  }
  hideEmptySettingSections(containerEl) {
    const children = Array.from(containerEl.children).filter(
      (child) => child instanceof HTMLElement
    );
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.tagName !== "H3") {
        continue;
      }
      let hasVisibleSetting = false;
      for (let j = i + 1; j < children.length; j += 1) {
        const candidate = children[j];
        if (candidate.tagName === "H3") {
          break;
        }
        if (!candidate.classList.contains("setting-item")) {
          continue;
        }
        if (!candidate.classList.contains("omni-forge-hidden-tab") && !candidate.classList.contains("omni-forge-hidden-simple")) {
          hasVisibleSetting = true;
          break;
        }
      }
      child.classList.toggle("omni-forge-hidden-tab", !hasVisibleSetting);
    }
  }
  isSimpleEssentialSettingName(name) {
    return _KnowledgeWeaverSettingTab.SIMPLE_VISIBLE_NAME_PREFIXES.some(
      (prefix) => name.startsWith(prefix)
    );
  }
  applyCompactSettingsVisibility(containerEl) {
    var _a, _b, _c, _d;
    if (this.plugin.settings.settingsViewMode !== "simple") {
      return;
    }
    if (this.plugin.settings.settingsActiveTab !== "quick") {
      return;
    }
    let hideSection = false;
    for (const child of Array.from(containerEl.children)) {
      if (child.tagName === "H3") {
        const title = ((_a = child.textContent) != null ? _a : "").trim();
        hideSection = _KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_SECTION_TITLES.has(title);
        child.toggleClass("omni-forge-hidden-simple", hideSection);
        continue;
      }
      if (hideSection) {
        child.classList.add("omni-forge-hidden-simple");
      }
    }
    const items = containerEl.querySelectorAll(".setting-item");
    for (const item of Array.from(items)) {
      const name = (_d = (_c = (_b = item.querySelector(".setting-item-name")) == null ? void 0 : _b.textContent) == null ? void 0 : _c.trim()) != null ? _d : "";
      if (!name) {
        continue;
      }
      const hiddenByKeyword = _KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_NAME_KEYWORDS.some(
        (keyword) => name.includes(keyword)
      );
      const hiddenByNonEssential = !this.isSimpleEssentialSettingName(name);
      const shouldHide = hiddenByKeyword || hiddenByNonEssential;
      if (shouldHide) {
        item.classList.add("omni-forge-hidden-simple");
      }
    }
  }
  renderGuideTab(containerEl) {
    containerEl.createEl("h3", { text: "Quick preset guide / \uBE60\uB978 \uC124\uC815 \uAC00\uC774\uB4DC" });
    containerEl.createEl("p", {
      text: [
        "One-click presets detect local models first.",
        "Then they auto-assign base/role/embedding models by preset + hardware capability."
      ].join("\n"),
      cls: "omni-forge-settings-guide-note omni-forge-settings-guide-preline"
    });
    containerEl.createEl("h3", { text: "Preset warning snapshot / \uD504\uB9AC\uC14B \uACBD\uACE0 \uC2A4\uB0C5\uC0F7" });
    const warningList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    const warnings = this.collectPresetOverrideWarnings();
    if (warnings.length === 0) {
      warningList.createEl("li", { text: "\uD604\uC7AC \uD504\uB9AC\uC14B \uC624\uBC84\uB77C\uC774\uB4DC \uACBD\uACE0(\u26A0) \uC5C6\uC74C" });
    } else {
      for (const warning of warnings) {
        warningList.createEl("li", {
          text: `${warning.name}: ${warning.note}`
        });
      }
    }
    warningList.createEl("li", {
      text: "\uB9B4\uB9AC\uC988 \uC804\uC5D0\uB294 \uACBD\uACE0(\u26A0)\uAC00 \uBD99\uC740 \uD504\uB9AC\uC14B \uC624\uBC84\uB77C\uC774\uB4DC \uD544\uB4DC\uB97C \uC6B0\uC120 \uD655\uC778\uD558\uC138\uC694."
    });
    new import_obsidian4.Setting(containerEl).setName("Hardware snapshot / \uCEF4\uD4E8\uD130 \uC0AC\uC591 \uBCF4\uAE30").setDesc(this.plugin.getHardwareCapabilitySummaryForQa()).addButton(
      (button) => button.setButtonText("Open summary").onClick(async () => {
        new import_obsidian4.Notice(this.plugin.getHardwareCapabilitySummaryForQa(), 7e3);
      })
    );
    const detectedModels = this.plugin.getOllamaModelOptions();
    const hardwareSummary = this.plugin.getHardwareCapabilitySummaryForQa();
    const readiness = containerEl.createDiv({ cls: "omni-forge-settings-guide-card" });
    readiness.createEl("strong", {
      text: detectedModels.length > 0 ? `Local AI ready: ${detectedModels.length} model(s) detected` : "Local AI not ready: no Ollama model detected"
    });
    const readinessLines = detectedModels.length > 0 ? this.splitGuideLines(this.plugin.getOllamaDetectionSummary()) : [
      "Install/start Ollama.",
      "Pull at least one text model + one vision model + one embedding model."
    ];
    const hardwareLines = this.splitGuideLines(hardwareSummary);
    const readinessList = readiness.createEl("ul", {
      cls: "omni-forge-settings-guide-list omni-forge-settings-guide-card-list"
    });
    for (const line of [...readinessLines, ...hardwareLines]) {
      readinessList.createEl("li", { text: line });
    }
    containerEl.createEl("h3", { text: "When to use each preset / \uD504\uB9AC\uC14B \uC120\uD0DD \uAE30\uC900" });
    const presetList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    presetList.createEl("li", {
      text: "Flash: \uBB38\uC11C 1~20\uAC1C \uAE30\uBC18 \uBE60\uB978 \uC870\uD68C/\uC694\uC57D. Role/Pipeline\uC744 \uACBD\uB7C9 \uACE0\uC815\uD574 \uC9C0\uC5F0\uC744 \uCD5C\uC18C\uD654\uD569\uB2C8\uB2E4."
    });
    presetList.createEl("li", {
      text: "Pro: \uC218\uC2ED~\uC218\uBC31\uAC1C \uBB38\uC11C \uBD84\uC11D/\uC778\uC0AC\uC774\uD2B8/\uCD08\uC548 \uC791\uC131. Orchestrator/Safeguard \uC911\uC2EC\uC73C\uB85C \uD488\uC9C8\uACFC \uC18D\uB3C4\uB97C \uADE0\uD615\uD654\uD569\uB2C8\uB2E4."
    });
    presetList.createEl("li", {
      text: "\uB85C\uCEEC \uBAA8\uB378\uC774 \uAC10\uC9C0\uB418\uC9C0 \uC54A\uC73C\uBA74 \uD504\uB9AC\uC14B\uC740 \uBCF4\uC548/\uB3D9\uC791 \uAE30\uBCF8\uAC12\uB9CC \uC801\uC6A9\uD558\uACE0 \uAE30\uC874 Provider\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4."
    });
    containerEl.createEl("h3", { text: "Chat shortcut reference / \uCC44\uD305 \uB2E8\uCD95\uD0A4 \uC548\uB0B4" });
    const shortcutList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    shortcutList.createEl("li", {
      text: "Enter: \uC804\uC1A1"
    });
    shortcutList.createEl("li", {
      text: "Shift+Enter: \uC904\uBC14\uAFC8"
    });
    shortcutList.createEl("li", {
      text: "Ctrl/Cmd+V: \uC774\uBBF8\uC9C0/\uD14D\uC2A4\uD2B8/PDF \uCCA8\uBD80 \uBD99\uC5EC\uB123\uAE30"
    });
    shortcutList.createEl("li", {
      text: "\uC911\uC9C0 \uBC84\uD2BC(Stop): \uC2A4\uD2B8\uB9AC\uBC0D/\uB9AC\uD2B8\uB9AC\uBC8C/\uD6C4\uCC98\uB9AC \uC989\uC2DC \uC911\uB2E8"
    });
    containerEl.createEl("h3", { text: "Agent external-path policy / \uC5D0\uC774\uC804\uD2B8 \uC678\uBD80 \uACBD\uB85C \uC815\uCC45" });
    const securityGuideList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    securityGuideList.createEl("li", {
      text: "\uAE30\uBCF8\uAC12\uC740 \uBCF4\uC218\uC801(vault \uBC94\uC704)\uC785\uB2C8\uB2E4. \uC678\uBD80 \uC808\uB300\uACBD\uB85C \uC811\uADFC\uC740 allowlist \uB610\uB294 full access \uC870\uAC74\uC5D0\uC11C\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4."
    });
    securityGuideList.createEl("li", {
      text: "full access\uB97C \uCF1C\uAE30 \uC804\uC5D0\uB294 allowlist \uACBD\uB85C\uB97C \uBA3C\uC800 \uC9C0\uC815\uD558\uACE0, \uD544\uC694\uD55C \uCD5C\uC18C \uBC94\uC704\uB9CC \uB4F1\uB85D\uD558\uC138\uC694."
    });
    securityGuideList.createEl("li", {
      text: "\uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8\uC5D0 '\uC678\uBD80 \uACBD\uB85C \uC811\uADFC \uC2DC \uBC18\uB4DC\uC2DC \uD5C8\uC6A9 \uACBD\uB85C/\uC2B9\uC778 \uC870\uAC74/\uB85C\uADF8 \uAE30\uB85D' \uADDC\uCE59\uC744 \uBA85\uC2DC\uD558\uBA74 \uC815\uCC45 \uCDA9\uB3CC\uC744 \uC904\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4."
    });
    securityGuideList.createEl("li", {
      text: "\uC0C1\uC138 \uC815\uCC45\uC740 README\uC758 \uBCF4\uC548 \uC8FC\uC758\uC0AC\uD56D \uC139\uC158\uC744 \uCC38\uACE0\uD558\uC138\uC694."
    });
    containerEl.createEl("h3", { text: "PDF parsing notes / PDF \uD30C\uC2F1 \uACE0\uB824\uC0AC\uD56D" });
    const pdfGuideList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    pdfGuideList.createEl("li", {
      text: "PDF\uB294 pdftotext -> OCR(tesseract/pdftoppm) -> fallback \uCCB4\uC778\uC73C\uB85C \uBCF8\uBB38 \uCD94\uCD9C\uC744 \uC2DC\uB3C4\uD569\uB2C8\uB2E4."
    });
    pdfGuideList.createEl("li", {
      text: "\uC774\uBBF8\uC9C0 \uCCA8\uBD80\uB3C4 OCR \uD30C\uC11C\uB97C \uD1B5\uD574 \uD14D\uC2A4\uD2B8\uB97C \uBCF4\uAC15\uD569\uB2C8\uB2E4. \uB2E8, \uD45C/\uC218\uC2DD/\uC2A4\uCE94\uC740 \uC624\uC778\uC2DD \uAC00\uB2A5\uC131\uC774 \uC788\uC5B4 \uD575\uC2EC \uAD6C\uAC04 \uD14D\uC2A4\uD2B8 \uBC1C\uCDCC\uB97C \uD568\uAED8 \uCCA8\uBD80\uD558\uC138\uC694."
    });
    pdfGuideList.createEl("li", {
      text: "\uCD9C\uCC98 \uC815\uD655\uC131\uC774 \uC911\uC694\uD55C \uC791\uC5C5(\uD3C9\uAC00\uACC4\uD68D/\uBC95\uC801 \uBB38\uC11C)\uC740 PDF \uC6D0\uBB38 \uD398\uC774\uC9C0 \uBC88\uD638\uB97C \uD568\uAED8 \uC694\uAD6C\uD558\uB3C4\uB85D \uD504\uB86C\uD504\uD2B8\uB97C \uACE0\uC815\uD558\uC138\uC694."
    });
    pdfGuideList.createEl("li", {
      text: "\uC0C1\uC138 \uC6B4\uC601 \uD301\uC740 README\uC758 \uBB38\uC81C \uD574\uACB0 \uC139\uC158\uC744 \uCC38\uACE0\uD558\uC138\uC694."
    });
    containerEl.createEl("h3", { text: "Reference models by tier / \uD2F0\uC5B4\uBCC4 \uCC38\uACE0 \uBAA8\uB378" });
    const modelList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    modelList.createEl("li", {
      text: "Flash tier text: qwen3:8b / llama3.1:8b / gemma3:4b"
    });
    modelList.createEl("li", {
      text: "Pro tier text: qwen3:14b / gpt-oss:20b / qwen3:30b (\uD658\uACBD \uC758\uC874)"
    });
    modelList.createEl("li", {
      text: "Vision: qwen2.5vl \uACC4\uC5F4, llava \uACC4\uC5F4"
    });
    modelList.createEl("li", {
      text: "Embedding: nomic-embed-text, bge-m3, mxbai-embed-large, e5/gte \uACC4\uC5F4"
    });
    containerEl.createEl("pre", {
      cls: "omni-forge-settings-guide-code",
      text: [
        "ollama pull qwen3:8b",
        "ollama pull qwen3:14b",
        "ollama pull qwen2.5vl:7b",
        "ollama pull nomic-embed-text"
      ].join("\n")
    });
    containerEl.createEl("h3", { text: "Official references / \uACF5\uC2DD \uCC38\uACE0" });
    const refList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    const references = [
      "https://ollama.com/library/qwen3",
      "https://ollama.com/library/qwen2.5vl",
      "https://ollama.com/library/nomic-embed-text",
      "https://docs.ollama.com/api/chat",
      "https://docs.ollama.com/api/generate"
    ];
    for (const url of references) {
      const item = refList.createEl("li");
      item.createEl("a", { text: url, href: url });
    }
  }
  renderOrchestrationTab(containerEl) {
    const mode = this.plugin.settings.settingsUiLanguage;
    const t = (en, ko) => mode === "en" ? en : mode === "ko" ? ko : `${en} / ${ko}`;
    containerEl.createEl("h3", { text: "Orchestration controls / \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 \uC81C\uC5B4" });
    containerEl.createEl("p", {
      cls: "omni-forge-settings-guide-note",
      text: "\uB0B4\uBD80 \uBB38\uC11C \uBCF4\uD638\uB97C \uC6B0\uC120\uD558\uBA70, \uC678\uBD80 \uC5F0\uACB0\uC740 allowlist \uAE30\uBC18\uC73C\uB85C \uC81C\uD55C\uB41C \uC0C1\uD0DC\uC5D0\uC11C\uB9CC \uC2E4\uD589\uD558\uC138\uC694."
    });
    new import_obsidian4.Setting(containerEl).setName("Conversation mode (chat runtime)").setDesc("\uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 \uC911\uC2EC\uC73C\uB85C \uBAA8\uB4DC\uB97C \uACE0\uC815\uD558\uACE0 \uD30C\uC774\uD504\uB77C\uC778 \uAE30\uBCF8\uAC12\uC744 \uB9DE\uCDA5\uB2C8\uB2E4.").addButton(
      (button) => button.setButtonText(t("Apply orchestration mode", "\uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 \uBAA8\uB4DC \uC801\uC6A9")).setCta().onClick(async () => {
        await this.plugin.setQaConversationModeForQa("orchestration");
        await this.plugin.applyRecommendedRoleModelsForQa(false, true);
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Debugger agent / \uB514\uBC84\uAC70 \uC5D0\uC774\uC804\uD2B8").setDesc(
      t(`Current debugger model: ${this.plugin.getQaModelLabelForQa("debugger")}`, `\uD604\uC7AC \uB514\uBC84\uAC70 \uBAA8\uB378: ${this.plugin.getQaModelLabelForQa("debugger")}`)
    ).addButton(
      (button) => button.setButtonText(t("Apply debugger recommendation", "\uB514\uBC84\uAC70 \uCD94\uCC9C \uC801\uC6A9")).onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: false, autoApply: true });
        await this.plugin.applyRecommendedRoleModelsForQa(true, true);
        this.display();
      })
    );
    const health = this.getRoleModelHealthSummary();
    const hasIssue = health.blockedRoles.length > 0 || health.unavailable.length > 0;
    const readinessSetting = new import_obsidian4.Setting(containerEl).setName("Orchestration agent readiness / \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 \uC5D0\uC774\uC804\uD2B8 \uC900\uBE44 \uC0C1\uD0DC").setDesc(
      hasIssue ? `${health.summary}
\uD544\uC218 \uC5ED\uD560 \uBAA8\uB378\uC774 \uC5C6\uC73C\uBA74 \uD30C\uC774\uD504\uB77C\uC778 \uC5D0\uC774\uC804\uD2B8\uAC00 \uC77C\uBD80 \uC0DD\uB7B5\uB429\uB2C8\uB2E4.` : "\uBAA8\uB4E0 \uC5ED\uD560 \uBAA8\uB378 \uC0C1\uD0DC\uAC00 \uC815\uC0C1\uC785\uB2C8\uB2E4."
    );
    if (hasIssue) {
      readinessSetting.addButton(
        (button) => button.setButtonText(t("Text model link", "\uD14D\uC2A4\uD2B8 \uBAA8\uB378 \uB9C1\uD06C")).onClick(() => {
          window.open("https://ollama.com/library/qwen3");
        })
      ).addButton(
        (button) => button.setButtonText(t("Vision model link", "\uBE44\uC804 \uBAA8\uB378 \uB9C1\uD06C")).onClick(() => {
          window.open("https://ollama.com/library/qwen2.5vl");
        })
      ).addButton(
        (button) => button.setButtonText(t("Embedding model link", "\uC784\uBCA0\uB529 \uBAA8\uB378 \uB9C1\uD06C")).onClick(() => {
          window.open("https://ollama.com/library/nomic-embed-text");
        })
      );
    }
  }
  renderSkillsTab(containerEl) {
    containerEl.createEl("h3", { text: "Skills manager / \uC2A4\uD0AC \uAD00\uB9AC" });
    containerEl.createEl("p", {
      cls: "omni-forge-settings-guide-note",
      text: "SKILL.md \uAC00 \uC788\uB294 \uD3F4\uB354\uB97C \uC9C0\uC815\uD558\uBA74 \uC2A4\uD0AC \uBB38\uC11C\uB97C \uC790\uB3D9 \uD0D0\uC9C0\uD574 \uC81C\uBAA9/\uC694\uC57D\uC744 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4."
    });
    const resultEl = containerEl.createDiv({ cls: "omni-forge-settings-guide-card" });
    const renderScanResult = async () => {
      const root = this.plugin.settings.qaSkillsRootPath.trim();
      if (!root) {
        resultEl.setText("Skills folder path is empty. / \uC2A4\uD0AC \uD3F4\uB354 \uACBD\uB85C\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const scanned = await this.plugin.scanSkillsFolderForQa(root);
      resultEl.empty();
      if (scanned.error) {
        resultEl.createEl("strong", { text: `Scan failed / \uD0D0\uC9C0 \uC2E4\uD328: ${scanned.error}` });
        return;
      }
      resultEl.createEl("strong", { text: `Detected ${scanned.skills.length} skill(s) / \uD0D0\uC9C0 ${scanned.skills.length}\uAC1C` });
      const list = resultEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
      if (scanned.skills.length === 0) {
        list.createEl("li", { text: "No SKILL.md found under the selected root. / \uC120\uD0DD \uACBD\uB85C\uC5D0\uC11C SKILL.md\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
        return;
      }
      for (const skill of scanned.skills) {
        const item = list.createEl("li");
        item.createEl("div", { text: `${skill.id}: ${skill.title}` });
        item.createEl("small", {
          text: skill.summary || skill.docPath
        });
      }
    };
    new import_obsidian4.Setting(containerEl).setName("Skills folder path / \uC2A4\uD0AC \uD3F4\uB354 \uACBD\uB85C").setDesc("Absolute path where skill subfolders contain SKILL.md.").addText(
      (text) => text.setPlaceholder("/Users/.../skills").setValue(this.plugin.settings.qaSkillsRootPath).onChange(async (value) => {
        this.plugin.settings.qaSkillsRootPath = value.trim();
        await this.plugin.saveSettings();
      })
    ).addButton(
      (button) => button.setButtonText("Scan / \uD0D0\uC9C0").onClick(async () => {
        await renderScanResult();
      })
    ).addButton(
      (button) => button.setButtonText("Sample template / \uC0D8\uD50C \uC591\uC2DD").onClick(async () => {
        const root = this.plugin.settings.qaSkillsRootPath.trim();
        if (!root) {
          new import_obsidian4.Notice("Set skills folder path first. / \uBA3C\uC800 \uC2A4\uD0AC \uD3F4\uB354 \uACBD\uB85C\uB97C \uC785\uB825\uD558\uC138\uC694.", 4500);
          return;
        }
        try {
          const sampleDir = nodePath.join(nodePath.resolve(root), "sample-skill");
          await nodeFs.promises.mkdir(sampleDir, { recursive: true });
          const samplePath = nodePath.join(sampleDir, "SKILL.md");
          const sampleBody = [
            "# Sample Skill",
            "",
            "A short one-line description of what this skill does.",
            "",
            "## When to use",
            "- Use when this workflow is requested.",
            "",
            "## Inputs",
            "- Input A",
            "- Input B",
            "",
            "## Steps",
            "1. Step one",
            "2. Step two",
            "",
            "## Output",
            "- Expected result format"
          ].join("\n");
          await nodeFs.promises.writeFile(samplePath, sampleBody, "utf8");
          new import_obsidian4.Notice(`Sample created: ${samplePath}`, 5e3);
          await renderScanResult();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown sample template error";
          new import_obsidian4.Notice(`Sample create failed: ${message}`, 6e3);
        }
      })
    );
    void renderScanResult();
  }
  renderParserTab(containerEl) {
    const mode = this.plugin.settings.settingsUiLanguage;
    const t = (en, ko) => mode === "en" ? en : mode === "ko" ? ko : `${en} / ${ko}`;
    containerEl.createEl("h3", { text: "Parser pipeline / \uD30C\uC11C \uD30C\uC774\uD504\uB77C\uC778" });
    containerEl.createEl("p", {
      cls: "omni-forge-settings-guide-note",
      text: "PDF/\uC774\uBBF8\uC9C0 \uD30C\uC11C\uB97C \uC911\uC2EC\uC73C\uB85C \uCCA8\uBD80 \uCEE8\uD14D\uC2A4\uD2B8 \uD488\uC9C8\uC744 \uB192\uC785\uB2C8\uB2E4. excel/hwp\uB294 \uD604\uC7AC \uBBF8\uB9AC\uBCF4\uAE30 \uC218\uC900\uC774\uBA70 \uCD94\uD6C4 \uD655\uC7A5\uB429\uB2C8\uB2E4."
    });
    new import_obsidian4.Setting(containerEl).setName("Parser mode").setDesc("Fast\uB294 \uACBD\uB7C9 \uD30C\uC11C, Detailed\uB294 OCR \uD398\uC774\uC9C0 \uD655\uC7A5\uACFC \uAE34 \uD14D\uC2A4\uD2B8 \uCD94\uCD9C\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.").addDropdown(
      (dropdown) => dropdown.addOption("fast", "Fast / \uBE60\uB978 \uD30C\uC11C").addOption("detailed", "Detailed / \uC0C1\uC138 \uD30C\uC11C").setValue(this.plugin.settings.qaParserMode).onChange(async (value) => {
        this.plugin.settings.qaParserMode = value === "detailed" ? "detailed" : "fast";
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("PDF attachments in chat").setDesc("\uAE30\uBCF8 ON\uC785\uB2C8\uB2E4. PDF\uB294 pdftotext -> OCR -> fallback \uCCB4\uC778\uC73C\uB85C \uC790\uB3D9 \uCC98\uB9AC\uB429\uB2C8\uB2E4.");
    new import_obsidian4.Setting(containerEl).setName("Parser tool readiness").setDesc(this.plugin.getParserToolReadinessSummaryForQa()).addButton(
      (button) => button.setButtonText("Refresh / \uC810\uAC80").onClick(async () => {
        await this.plugin.refreshParserToolReadinessForQa(true);
        this.display();
      })
    );
    const parserList = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    parserList.createEl("li", {
      text: t("PDF: pdftotext(text extraction) + pdftoppm/tesseract(OCR) + fallback", "PDF: pdftotext(\uD14D\uC2A4\uD2B8 \uCD94\uCD9C) + pdftoppm/tesseract(OCR) + fallback")
    });
    parserList.createEl("li", {
      text: t("Image: tesseract OCR + original image context", "Image: tesseract OCR + \uC6D0\uBCF8 \uC774\uBBF8\uC9C0 \uCEE8\uD14D\uC2A4\uD2B8")
    });
    parserList.createEl("li", {
      text: t("Excel/HWP: currently preview-level support (attach text-exported copy recommended)", "Excel/HWP: \uD604\uC7AC \uBBF8\uB9AC\uBCF4\uAE30 \uC218\uC900(\uD14D\uC2A4\uD2B8 \uBCC0\uD658\uBCF8 \uCCA8\uBD80 \uAD8C\uC7A5)")
    });
    const tips = containerEl.createEl("details", { cls: "omni-forge-chat-collapsible omni-forge-settings-parser-tips" });
    tips.open = false;
    tips.createEl("summary", { text: t("Parser command tips", "\uD30C\uC11C \uBA85\uB839 \uD301") });
    tips.createEl("small", {
      text: t(
        "Collapsed by default. Open when parser readiness shows missing.",
        "\uAE30\uBCF8 \uC228\uAE40. parser readiness\uAC00 missing\uC77C \uB54C \uD3BC\uCCD0 \uD655\uC778\uD558\uC138\uC694."
      )
    });
    const tipsList = tips.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    tipsList.createEl("li", { text: "macOS(Homebrew): brew install poppler tesseract" });
    tipsList.createEl("li", { text: "Ubuntu/Debian: sudo apt-get install poppler-utils tesseract-ocr tesseract-ocr-kor" });
    tipsList.createEl("li", { text: "Windows(Chocolatey): choco install poppler tesseract" });
    tipsList.createEl("li", {
      text: t("Terminal check: `pdftotext -v`, `pdftoppm -v`, `tesseract --version`.", "\uD130\uBBF8\uB110 \uD655\uC778: `pdftotext -v`, `pdftoppm -v`, `tesseract --version`.")
    });
    tipsList.createEl("li", {
      text: t(
        "If any command fails, parser quality drops to fallback mode (possible omission/OCR errors).",
        "\uBA85\uB839 \uD558\uB098\uB77C\uB3C4 \uC2E4\uD328\uD558\uBA74 parser \uD488\uC9C8\uC740 fallback \uBAA8\uB4DC\uB85C \uD558\uB77D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4(\uB204\uB77D/OCR \uC624\uC778\uC2DD \uAC00\uB2A5)."
      )
    });
    tipsList.createEl("li", {
      text: t(
        "After installation, restart Obsidian and press `Refresh / 점검` in this tab.",
        "\uC124\uCE58 \uD6C4 Obsidian \uC7AC\uC2DC\uC791 -> \uC774 \uD0ED\uC5D0\uC11C `Refresh / \uC810\uAC80` \uD074\uB9AD"
      )
    });
    for (const line of this.plugin.getParserToolReadinessLinesForQa()) {
      tipsList.createEl("li", { text: line });
    }
    new import_obsidian4.Setting(containerEl).setName("Attachment ingest folder path").setDesc("\uC678\uBD80 \uCCA8\uBD80\uB97C vault \uB0B4\uBD80\uB85C \uBBF8\uB7EC\uB9C1\uD560 \uACBD\uB85C\uC785\uB2C8\uB2E4.").addText(
      (text) => text.setPlaceholder("Omni Forge Ingest").setValue(this.plugin.settings.qaAttachmentIngestRootPath).onChange(async (value) => {
        this.plugin.settings.qaAttachmentIngestRootPath = (0, import_obsidian4.normalizePath)(
          value.trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath
        );
        await this.plugin.saveSettings();
      })
    );
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("omni-forge-settings-tab");
    this.addSettingsLanguageControl(containerEl);
    const uiMode = this.plugin.settings.settingsUiLanguage;
    containerEl.createEl("h2", {
      text: uiMode === "en" ? "Omni Forge Settings" : uiMode === "ko" ? "Omni Forge \uC124\uC815" : "Omni Forge Settings / Omni Forge \uC124\uC815"
    });
    containerEl.createEl("p", {
      text: uiMode === "en" ? "Language docs: README.md (EN) | README_KO.md (KO)" : uiMode === "ko" ? "\uC5B8\uC5B4 \uBB38\uC11C: README.md (EN) | README_KO.md (KO)" : "Language docs / \uC5B8\uC5B4 \uBB38\uC11C: README.md (EN) | README_KO.md (KO)"
    });
    this.addSettingsTabSwitcher(containerEl);
    const activeTab = this.plugin.settings.settingsActiveTab === "advanced" ? "guide" : this.plugin.settings.settingsActiveTab;
    if (activeTab === "chat") {
      this.addViewModeAndPresetControls(containerEl);
      this.addChatPresetControls(containerEl);
    }
    if (activeTab === "orchestration") {
      this.renderOrchestrationTab(containerEl);
    }
    if (activeTab === "skills") {
      this.renderSkillsTab(containerEl);
      this.applyBilingualSettingsLabels(containerEl);
      return;
    }
    if (activeTab === "parser") {
      this.renderParserTab(containerEl);
      this.applyBilingualSettingsLabels(containerEl);
      return;
    }
    if (activeTab === "guide") {
      this.renderGuideTab(containerEl);
      this.applyBilingualSettingsLabels(containerEl);
      return;
    }
    new import_obsidian4.Setting(containerEl).setName("Quick provider / \uBE60\uB978 \uC81C\uACF5\uC790").setDesc("Choose provider in order: local > local QA bridge > cloud. Local defaults to Flash profile.").addDropdown(
      (dropdown) => dropdown.addOption("ollama", "Ollama (local / \uB85C\uCEEC)").addOption("lmstudio", "LM Studio (local QA / \uB85C\uCEEC QA)").addOption("openai", "Codex/OpenAI (cloud bridge)").addOption("anthropic", "Claude / \uD074\uB85C\uB4DC").addOption("gemini", "Gemini / \uC81C\uBBF8\uB098\uC774").setValue(this.plugin.settings.provider).onChange(async (value) => {
        this.plugin.settings.provider = value;
        if (value === "ollama") {
          this.plugin.settings.qaChatModelFamily = "local";
          this.plugin.settings.qaChatModelProfile = "local-flash";
          this.plugin.settings.qaLocalPresetProfile = "fast_local";
          this.plugin.settings.qaAllowNonLocalEndpoint = false;
          await this.plugin.saveSettings();
          await this.plugin.refreshOllamaDetection({ notify: false, autoApply: true });
          await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
          this.plugin.settings.qaOllamaModel = this.plugin.settings.ollamaModel.trim() || this.plugin.settings.qaOllamaModel;
        } else if (value === "lmstudio") {
          this.plugin.settings.qaChatModelFamily = "local";
          this.plugin.settings.qaChatModelProfile = "local-flash";
          this.plugin.settings.qaLocalPresetProfile = "custom";
          this.plugin.settings.qaAllowNonLocalEndpoint = false;
          this.plugin.settings.qaOllamaModel = this.plugin.settings.lmStudioModel.trim() || this.plugin.settings.qaOllamaModel;
        } else if (value === "openai") {
          this.plugin.settings.qaChatModelFamily = "cloud";
          this.plugin.settings.qaChatModelProfile = "codex";
          this.plugin.settings.qaAllowNonLocalEndpoint = true;
          this.plugin.settings.qaOllamaBaseUrl = toOpenAICompatibleBase(this.plugin.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
          this.plugin.appendQaAllowedOutboundHostFromUrl(this.plugin.settings.qaOllamaBaseUrl);
          this.plugin.settings.qaOllamaModel = this.plugin.settings.openAIModel.trim() || DEFAULT_SETTINGS.openAIModel;
        } else if (value === "anthropic") {
          this.plugin.settings.qaChatModelFamily = "cloud";
          this.plugin.settings.qaChatModelProfile = "claude";
          this.plugin.settings.qaAllowNonLocalEndpoint = true;
          this.plugin.settings.qaOllamaBaseUrl = toOpenAICompatibleBase(this.plugin.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
          this.plugin.appendQaAllowedOutboundHostFromUrl(this.plugin.settings.qaOllamaBaseUrl);
          this.plugin.settings.qaOllamaModel = this.plugin.settings.anthropicModel.trim() || DEFAULT_SETTINGS.anthropicModel;
        } else if (value === "gemini") {
          this.plugin.settings.qaChatModelFamily = "cloud";
          this.plugin.settings.qaChatModelProfile = "gemini";
          this.plugin.settings.qaAllowNonLocalEndpoint = true;
          this.plugin.settings.qaOllamaBaseUrl = toOpenAICompatibleBase(this.plugin.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
          this.plugin.appendQaAllowedOutboundHostFromUrl(this.plugin.settings.qaOllamaBaseUrl);
          this.plugin.settings.qaOllamaModel = this.plugin.settings.geminiModel.trim() || DEFAULT_SETTINGS.geminiModel;
        }
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText(uiMode === "en" ? "Local detect + Flash" : uiMode === "ko" ? "\uB85C\uCEEC \uAC10\uC9C0 + Flash" : "Local detect + Flash / \uB85C\uCEEC \uAC10\uC9C0 + Flash").onClick(async () => {
        const summary = await this.plugin.applyQaChatModelProfileForQa("local-flash", "local");
        new import_obsidian4.Notice(summary, 6500);
        this.display();
      })
    );
    const showCodexBridgeNote = this.plugin.getQaChatModelProfileForQa() === "codex";
    if (showCodexBridgeNote) {
      new import_obsidian4.Setting(containerEl).setName("Codex bridge note / Codex \uBE0C\uB9AC\uC9C0 \uC548\uB0B4").setDesc(
        "Meaning: Q&A calls Codex through an OpenAI-compatible bridge endpoint (for example Agent Client) instead of a direct plugin API integration."
      );
    }
    containerEl.createEl("h3", { text: "Local provider config" });
    new import_obsidian4.Setting(containerEl).setName("Ollama base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.ollamaBaseUrl).onChange(async (value) => {
        this.plugin.settings.ollamaBaseUrl = value.trim();
        if (this.plugin.getQaChatModelFamilyForQa() === "local" || !this.plugin.settings.qaOllamaBaseUrl.trim()) {
          this.plugin.settings.qaOllamaBaseUrl = this.plugin.settings.ollamaBaseUrl;
        }
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
        this.plugin.settings.qaOllamaModel = value;
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
        this.display();
      });
    }).addButton(
      (button) => button.setButtonText("Refresh / \uC0C8\uB85C\uACE0\uCE68").onClick(async () => {
        await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Ollama auto-match policy").setDesc("On refresh/detect, recommended model is applied automatically.");
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
        if (this.plugin.getQaChatModelFamilyForQa() === "cloud") {
          this.plugin.settings.qaOllamaBaseUrl = toOpenAICompatibleBase(this.plugin.settings.openAIBaseUrl || DEFAULT_SETTINGS.openAIBaseUrl);
          this.plugin.appendQaAllowedOutboundHostFromUrl(this.plugin.settings.qaOllamaBaseUrl);
        }
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("OpenAI model").addText(
      (text) => text.setPlaceholder("gpt-5.3-codex").setValue(this.plugin.settings.openAIModel).onChange(async (value) => {
        const nextModel = value.trim();
        this.plugin.settings.openAIModel = nextModel;
        if (this.plugin.getQaChatModelFamilyForQa() === "cloud" && this.plugin.getQaChatModelProfileForQa() === "codex") {
          this.plugin.settings.qaOllamaModel = nextModel || DEFAULT_SETTINGS.openAIModel;
        }
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
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
        const nextModel = value.trim();
        this.plugin.settings.anthropicModel = nextModel;
        if (this.plugin.getQaChatModelFamilyForQa() === "cloud" && this.plugin.getQaChatModelProfileForQa() === "claude") {
          this.plugin.settings.qaOllamaModel = nextModel || DEFAULT_SETTINGS.anthropicModel;
        }
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
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
        const nextModel = value.trim();
        this.plugin.settings.geminiModel = nextModel;
        if (this.plugin.getQaChatModelFamilyForQa() === "cloud" && this.plugin.getQaChatModelProfileForQa() === "gemini") {
          this.plugin.settings.qaOllamaModel = nextModel || DEFAULT_SETTINGS.geminiModel;
        }
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Gemini API key").addText(
      (text) => text.setPlaceholder("AIza...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Behavior" });
    const analyzedDepthMode = this.plugin.settings.semanticLinkingEnabled || !this.plugin.settings.analysisOnlyChangedNotes ? "detailed" : "quick";
    new import_obsidian4.Setting(containerEl).setName("Analyzed depth mode").setDesc(
      "Quick: changed-notes centric + semantic off. Detailed: semantic on + full-scope analysis. Embedding model is auto-matched by profile when depth changes."
    ).addDropdown(
      (dropdown) => dropdown.addOption("quick", "Quick / \uBE60\uB978 \uBD84\uC11D").addOption("detailed", "Detailed / \uC0C1\uC138 \uBD84\uC11D").setValue(analyzedDepthMode).onChange(async (value) => {
        const quickMode = value === "quick";
        this.plugin.settings.analysisOnlyChangedNotes = quickMode;
        this.plugin.settings.semanticLinkingEnabled = !quickMode;
        this.plugin.settings.includeReasons = !quickMode;
        this.plugin.settings.qaTopK = quickMode ? Math.min(this.plugin.settings.qaTopK, 4) : Math.max(this.plugin.settings.qaTopK, 6);
        this.plugin.settings.semanticTopK = quickMode ? Math.min(this.plugin.settings.semanticTopK, 16) : Math.max(this.plugin.settings.semanticTopK, 28);
        const embeddingPreset = quickMode ? "fast_local" : "balanced_local";
        const embeddingModel = this.plugin.getRecommendedPresetOverrideModelForQa(embeddingPreset, "embedding");
        if (embeddingModel) {
          this.plugin.settings.semanticOllamaModel = embeddingModel;
        }
        this.plugin.settings.qaAlwaysDetailedAnswer = !quickMode;
        this.plugin.settings.qaMaxContextChars = quickMode ? Math.min(this.plugin.settings.qaMaxContextChars, 12e3) : Math.max(this.plugin.settings.qaMaxContextChars, 18e3);
        await this.plugin.saveSettings();
        await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
        this.display();
      })
    );
    const analyzedSelectedFiles = this.plugin.getSelectedFilesForQa().length;
    const analyzedEmbeddingModel = this.plugin.settings.semanticOllamaModel.trim() || "(none)";
    const analyzedQuickSec = Math.max(1, analyzedSelectedFiles) * 0.45;
    const analyzedDetailedSec = Math.max(1, analyzedSelectedFiles) * 1.15;
    const settingsUiMode = this.plugin.settings.settingsUiLanguage;
    const quickDepthRuntimeNote = settingsUiMode === "en" ? "Quick mode: semantic retrieval is disabled, so embedding retrieval does not run." : settingsUiMode === "ko" ? "Quick 모드: semantic 비활성화로 임베딩 리트리벌은 실행되지 않음" : "Quick mode: semantic retrieval is disabled, so embedding retrieval does not run. / Quick 모드: semantic 비활성화로 임베딩 리트리벌은 실행되지 않음";
    const detailedDepthRuntimeNote = settingsUiMode === "en" ? "Detailed mode: semantic embedding candidates are expanded." : settingsUiMode === "ko" ? "Detailed 모드: semantic 임베딩 기반 후보 확장 사용" : "Detailed mode: semantic embedding candidates are expanded. / Detailed 모드: semantic 임베딩 기반 후보 확장 사용";
    new import_obsidian4.Setting(containerEl).setName("Analyzed runtime estimate").setDesc(
      [
        `\uC120\uD0DD \uD30C\uC77C: ${analyzedSelectedFiles}\uAC1C`,
        `\uC784\uBCA0\uB529 \uBAA8\uB378: ${analyzedEmbeddingModel}`,
        analyzedDepthMode === "quick" ? quickDepthRuntimeNote : detailedDepthRuntimeNote,
        `Quick \uC608\uC0C1: \uC57D ${analyzedQuickSec.toFixed(1)}\uCD08 + \uBAA8\uB378 \uC751\uB2F5 \uC2DC\uAC04`,
        `Detailed \uC608\uC0C1: \uC57D ${analyzedDetailedSec.toFixed(1)}\uCD08 + \uBAA8\uB378 \uC751\uB2F5 \uC2DC\uAC04`
      ].join(" | ")
    );
    new import_obsidian4.Setting(containerEl).setName("Analyzed scope snapshot").setDesc(this.plugin.getAnalyzedScopeSnapshotSummaryForQa());
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
    if (this.plugin.settings.provider !== "ollama") {
      new import_obsidian4.Setting(containerEl).setName("Cloud embedding behavior / \uD074\uB77C\uC6B0\uB4DC \uC784\uBCA0\uB529 \uB3D9\uC791").setDesc("Embedding detected picker is shown only for Ollama provider. In cloud mode, this picker is hidden and semantic linking uses the last saved local embedding model when enabled.");
    }
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
    const embeddingOptions = this.plugin.getEmbeddingModelOptions().filter((option) => option.status !== "unavailable");
    new import_obsidian4.Setting(containerEl).setName("Embedding detected model picker").setDesc(
      "Choose among embedding-capable detected models. (\uCD94\uCC9C)=recommended."
    ).addDropdown((dropdown) => {
      var _a, _b;
      if (embeddingOptions.length === 0) {
        dropdown.addOption("", "(No embedding models detected)");
        dropdown.setValue("");
      } else {
        for (const option of embeddingOptions) {
          const suffix = option.status === "recommended" ? " (\uCD94\uCC9C)" : "";
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
    );
    new import_obsidian4.Setting(containerEl).setName("Embedding model (manual)").setDesc("Manual override if you want a custom embedding model name.").addText(
      (text) => text.setPlaceholder("nomic-embed-text").setValue(this.plugin.settings.semanticOllamaModel).onChange(async (value) => {
        this.plugin.settings.semanticOllamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Embedding auto-match policy").setDesc("On refresh/detect, recommended embedding model is applied automatically.");
    new import_obsidian4.Setting(containerEl).setName("Embedding detection summary").setDesc(this.plugin.getEmbeddingDetectionSummary());
    new import_obsidian4.Setting(containerEl).setName("Semantic top-k candidates").setDesc(
      "\uC9C8\uBB38\uACFC \uAD00\uB828 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uB192\uC740 \uD6C4\uBCF4 \uBB38\uC11C\uB97C \uBA87 \uAC1C\uAE4C\uC9C0 \uBCFC\uC9C0 \uC815\uD569\uB2C8\uB2E4. \uAC12\uC744 \uC62C\uB9AC\uBA74 \uADFC\uAC70 \uD6C4\uBCF4\uAC00 \uB298\uACE0, \uC18D\uB3C4\uB294 \uB290\uB824\uC9C8 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
    ).addText(
      (text) => text.setPlaceholder("24").setValue(String(this.plugin.settings.semanticTopK)).onChange(async (value) => {
        this.plugin.settings.semanticTopK = parsePositiveInt(
          value,
          this.plugin.settings.semanticTopK
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Semantic min similarity").setDesc(
      "\uAD00\uB828\uB3C4 \uCD5C\uC18C \uAE30\uC900\uC785\uB2C8\uB2E4(0.0~1.0). \uB0AE\uCD94\uBA74 \uB354 \uB9CE\uC740 \uBB38\uC11C\uAC00 \uD3EC\uD568\uB418\uACE0, \uB192\uC774\uBA74 \uB354 \uC5C4\uACA9\uD558\uAC8C \uAC78\uB7EC\uC9D1\uB2C8\uB2E4."
    ).addText(
      (text) => text.setPlaceholder("0.25").setValue(String(this.plugin.settings.semanticMinSimilarity)).onChange(async (value) => {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          this.plugin.settings.semanticMinSimilarity = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Semantic source max chars").setDesc(
      "\uC784\uBCA0\uB529 \uC804\uC5D0 \uAC01 \uBB38\uC11C\uC5D0\uC11C \uC0AC\uC6A9\uD560 \uCD5C\uB300 \uAE00\uC790 \uC218\uC785\uB2C8\uB2E4. \uC904\uC774\uBA74 \uBE60\uB974\uACE0, \uB298\uB9AC\uBA74 \uBB38\uB9E5 \uC815\uBCF4\uAC00 \uB9CE\uC544\uC9D1\uB2C8\uB2E4."
    ).addText(
      (text) => text.setPlaceholder("5000").setValue(String(this.plugin.settings.semanticMaxChars)).onChange(async (value) => {
        this.plugin.settings.semanticMaxChars = parsePositiveInt(
          value,
          this.plugin.settings.semanticMaxChars
        );
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Local Q&A (security-first) / \uB85C\uCEEC Q&A (\uBCF4\uC548 \uC6B0\uC120)" });
    new import_obsidian4.Setting(containerEl).setName("Q&A model").setDesc("Leave empty to use main analysis model.").addText(
      (text) => text.setPlaceholder("qwen2.5:7b").setValue(this.plugin.settings.qaOllamaModel).onChange(async (value) => {
        await this.plugin.setQaModelOverrideForQa(value.trim());
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
    new import_obsidian4.Setting(containerEl).setName("Chat font size / \uCC44\uD305 \uAE00\uC790 \uD06C\uAE30").setDesc("Chat workspace font size in px (11-22).").addText(
      (text) => text.setPlaceholder("14").setValue(String(this.plugin.settings.qaChatFontSize)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
          return;
        }
        this.plugin.settings.qaChatFontSize = Math.max(11, Math.min(22, parsed));
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Show system messages in chat / \uCC44\uD305 \uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uD45C\uC2DC").setDesc("Off by default. When OFF, system logs are hidden and omitted from saved chat transcript.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaShowSystemMessages).onChange(async (value) => {
        this.plugin.settings.qaShowSystemMessages = value;
        await this.plugin.saveSettings();
        await this.plugin.refreshOpenQaWorkspaceViews();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Preferred response language / \uB2F5\uBCC0 \uC5B8\uC5B4 \uC6B0\uC120").setDesc("Applies to local Q&A prompt. / \uB85C\uCEEC Q&A \uD504\uB86C\uD504\uD2B8\uC5D0 \uC801\uC6A9").addDropdown(
      (dropdown) => dropdown.addOption("auto", "Auto / \uC790\uB3D9").addOption("korean", "Korean / \uD55C\uAD6D\uC5B4").addOption("english", "English / \uC601\uC5B4").setValue(this.plugin.settings.qaPreferredResponseLanguage).onChange(async (value) => {
        this.plugin.settings.qaPreferredResponseLanguage = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Q&A pipeline preset").setDesc("In Orchestration mode, default pipeline is auto-route and applied automatically. / 오케스트레이션 모드에서는 기본 파이프라인(auto-route)이 자동 적용됩니다.").addDropdown((dropdown) => {
      const pipelineOptions = this.plugin.getQaPipelinePresetOptionsForQa();
      for (const option of pipelineOptions) {
        dropdown.addOption(option.value, option.label);
      }
      const fallback = pipelineOptions.length > 0 ? pipelineOptions[0].value : this.plugin.settings.qaPipelinePreset;
      dropdown.setValue(pipelineOptions.some((option) => option.value === this.plugin.settings.qaPipelinePreset) ? this.plugin.settings.qaPipelinePreset : fallback).onChange(async (value) => {
        await this.plugin.setQaPipelinePresetForQa(value);
        this.display();
      });
      if (pipelineOptions.length <= 1) {
        dropdown.setDisabled(true);
      }
    });
    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset base model",
      description: "Optional manual base-model override for Pro preset.",
      key: "qaBalancedPresetBaseModel",
      kind: "text",
      placeholder: "qwen3:14b",
      preset: "balanced_local"
    });
    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset vision model",
      description: "Optional manual vision-model override for Pro preset.",
      key: "qaBalancedPresetVisionModel",
      kind: "vision",
      placeholder: "qwen2.5vl:7b",
      preset: "balanced_local"
    });
    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset embedding model",
      description: "Optional manual embedding-model override for Pro preset.",
      key: "qaBalancedPresetEmbeddingModel",
      kind: "embedding",
      placeholder: "nomic-embed-text",
      preset: "balanced_local"
    });
    const presetWarnings = this.collectPresetOverrideWarnings();
    new import_obsidian4.Setting(containerEl).setName("Preset override warning summary").setDesc(
      presetWarnings.length > 0 ? presetWarnings.map((item) => `- ${item.name}: ${item.note}`).join("\n") : "\uD604\uC7AC \uAC10\uC9C0\uB41C \uD504\uB9AC\uC14B \uC624\uBC84\uB77C\uC774\uB4DC \uACBD\uACE0(\u26A0)\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
    ).addButton(
      (button) => button.setButtonText("Guide\uC5D0\uC11C \uBCF4\uAE30").onClick(async () => {
        this.plugin.settings.settingsActiveTab = "guide";
        await this.plugin.saveSettings();
        this.display();
      })
    );
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
    const customPromptSetting = new import_obsidian4.Setting(containerEl).setName("Custom system prompt / \uC0AC\uC6A9\uC790 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8").setDesc(
      "Optional global policy/style instructions. Beginner default is prefilled and can be restored anytime. / \uC804\uCCB4 \uC5ED\uD560\uC5D0 \uACF5\uD1B5 \uC801\uC6A9\uB418\uB294 \uC9C0\uC2DC\uC785\uB2C8\uB2E4."
    ).addTextArea((text) => {
      text.inputEl.addClass("omni-forge-setting-prompt-textarea");
      text.inputEl.rows = 10;
      return text.setPlaceholder(DEFAULT_SETTINGS.qaCustomSystemPrompt).setValue(this.plugin.settings.qaCustomSystemPrompt).onChange(async (value) => {
        this.plugin.settings.qaCustomSystemPrompt = value;
        await this.plugin.saveSettings();
      });
    }).addButton(
      (button) => button.setButtonText("Use default / \uAE30\uBCF8\uAC12").onClick(async () => {
        this.plugin.settings.qaCustomSystemPrompt = DEFAULT_SETTINGS.qaCustomSystemPrompt;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    customPromptSetting.settingEl.addClass("omni-forge-setting-prompt-editor");
    const rolePromptSetting = new import_obsidian4.Setting(containerEl).setName("Role system prompt editor").setDesc(
      "Add extra system instructions per role agent. Empty keeps built-in role prompt only."
    ).addDropdown((dropdown) => {
      for (const option of QA_ROLE_PRESET_OPTIONS) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.rolePromptEditorTarget).onChange((value) => {
        this.rolePromptEditorTarget = value;
        this.display();
      });
    }).addTextArea((text) => {
      text.inputEl.addClass("omni-forge-setting-prompt-textarea");
      text.inputEl.rows = 12;
      const roleDefault = this.plugin.getDefaultQaRoleSystemPromptForQa(this.rolePromptEditorTarget);
      const roleCurrent = this.plugin.getQaRoleSystemPromptForQa(this.rolePromptEditorTarget);
      const roleEditorValue = roleCurrent.trim() === roleDefault.trim() ? "" : roleCurrent;
      return text.setPlaceholder(
        roleDefault
      ).setValue(roleEditorValue).onChange(async (value) => {
        await this.plugin.setQaRoleSystemPromptForQa(
          this.rolePromptEditorTarget,
          value
        );
      });
    }).addButton(
      (button) => button.setButtonText("Use role default / \uC5ED\uD560 \uAE30\uBCF8\uAC12").onClick(async () => {
        await this.plugin.setQaRoleSystemPromptForQa(
          this.rolePromptEditorTarget,
          this.plugin.getDefaultQaRoleSystemPromptForQa(this.rolePromptEditorTarget)
        );
        this.display();
      })
    );
    rolePromptSetting.settingEl.addClass("omni-forge-setting-prompt-editor");
    containerEl.createEl("h3", { text: "Pipeline prompt tips / \uD30C\uC774\uD504\uB77C\uC778 \uD504\uB86C\uD504\uD2B8 \uD301" });
    const pipelineTips = containerEl.createEl("ul", { cls: "omni-forge-settings-guide-list" });
    const tipPlanning = pipelineTips.createEl("li");
    tipPlanning.createDiv({ text: "Planning / \uACC4\uD68D" });
    tipPlanning.createEl("small", {
      text: "\uD504\uB86C\uD504\uD2B8 \uC608\uC2DC: \uBAA9\uD45C, \uBC94\uC704, \uC81C\uC57D, \uC644\uB8CC \uC870\uAC74\uC744 \uBA3C\uC800 \uC8FC\uACE0 '\uB2E8\uACC4\uBCC4 \uC2E4\uD589 \uACC4\uD68D + \uD575\uC2EC \uB9AC\uC2A4\uD06C + \uAC80\uC99D \uCCB4\uD06C\uB9AC\uC2A4\uD2B8' \uD615\uC2DD\uC73C\uB85C \uC694\uCCAD"
    });
    const tipCoding = pipelineTips.createEl("li");
    tipCoding.createDiv({ text: "Implementation / \uAD6C\uD604" });
    tipCoding.createEl("small", {
      text: "\uD504\uB86C\uD504\uD2B8 \uC608\uC2DC: \uB300\uC0C1 \uD30C\uC77C, \uAE30\uB300 \uD589\uB3D9, \uAE08\uC9C0 \uD589\uB3D9(\uD30C\uAD34/\uC678\uBD80\uC804\uC1A1)\uC744 \uBA85\uC2DC\uD558\uACE0 '\uBCF4\uC218\uC801 \uBCC0\uACBD + \uC790\uB3D9 \uAC80\uC99D \uBA85\uB839 + \uB864\uBC31 \uD3EC\uC778\uD2B8' \uD3EC\uD568 \uC694\uCCAD"
    });
    const tipReview = pipelineTips.createEl("li");
    tipReview.createDiv({ text: "Review / \uAC80\uD1A0" });
    tipReview.createEl("small", {
      text: "\uD504\uB86C\uD504\uD2B8 \uC608\uC2DC: 'P1->P2->P3 \uC21C\uC11C\uB85C \uBC84\uADF8/\uD68C\uADC0/\uAC80\uC99D\uB204\uB77D\uB9CC \uC9DA\uACE0, \uAC01 \uD56D\uBAA9\uC5D0 \uC99D\uAC70 \uD30C\uC77C/\uC904\uBC88\uD638\uB97C \uD45C\uAE30' \uC694\uCCAD"
    });
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
      (text) => text.setPlaceholder("Omni Forge Chats").setValue(this.plugin.settings.chatTranscriptRootPath).onChange(async (value) => {
        this.plugin.settings.chatTranscriptRootPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Attachment ingest folder path").setDesc("Vault-relative folder where external attachments are mirrored for stable source links.").addText(
      (text) => text.setPlaceholder("Omni Forge Ingest").setValue(this.plugin.settings.qaAttachmentIngestRootPath).onChange(async (value) => {
        this.plugin.settings.qaAttachmentIngestRootPath = (0, import_obsidian4.normalizePath)(
          value.trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath
        );
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
    new import_obsidian4.Setting(containerEl).setName("PDF attachments in chat").setDesc("\uAE30\uBCF8 ON\uC785\uB2C8\uB2E4. \uC0C1\uC138 \uD30C\uC11C \uC124\uC815\uC740 Parser \uD0ED\uC5D0\uC11C \uAD00\uB9AC\uD569\uB2C8\uB2E4.");
    new import_obsidian4.Setting(containerEl).setName("Parser mode").setDesc("Fast\uB294 \uC18D\uB3C4 \uC6B0\uC120, Detailed\uB294 OCR/\uCD94\uCD9C \uD488\uC9C8 \uC6B0\uC120\uC785\uB2C8\uB2E4.").addDropdown(
      (dropdown) => dropdown.addOption("fast", "Fast").addOption("detailed", "Detailed").setValue(this.plugin.settings.qaParserMode).onChange(async (value) => {
        this.plugin.settings.qaParserMode = value === "detailed" ? "detailed" : "fast";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Enable agent tool mode (experimental)").setDesc(
      "Allow model-proposed actions (read/write/list/shell) from chat responses via omni-forge-actions JSON block."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAgentToolModeEnabled).onChange(async (value) => {
        this.plugin.settings.qaAgentToolModeEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Require approval before tool execution").setDesc(
      "Recommended. If enabled, proposed actions are queued and run only after user sends '\uC2B9\uC778' or '/approve'."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAgentRequireApproval).onChange(async (value) => {
        this.plugin.settings.qaAgentRequireApproval = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Allow shell tool (danger)").setDesc(
      "Allows run_shell actions via local terminal command execution. Keep off unless absolutely needed."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAgentAllowShellTool).onChange(async (value) => {
        this.plugin.settings.qaAgentAllowShellTool = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Agent shell full access (danger)").setDesc(
      "If enabled, run_shell and agent file actions(read/write/list) can use any absolute path (allowlist bypass)."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAgentShellFullAccess).onChange(async (value) => {
        this.plugin.settings.qaAgentShellFullAccess = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Shell tool timeout (seconds)").setDesc("run_shell \uBA85\uB839 1\uD68C\uB2F9 \uCD5C\uB300 \uC2E4\uD589 \uC2DC\uAC04(\uCD08)\uC785\uB2C8\uB2E4. \uBB34\uD55C \uB300\uAE30 \uBC29\uC9C0\uC6A9 \uC548\uC804\uC7A5\uCE58\uC785\uB2C8\uB2E4.").addText(
      (text) => text.setPlaceholder("20").setValue(String(this.plugin.settings.qaAgentShellTimeoutSec)).onChange(async (value) => {
        this.plugin.settings.qaAgentShellTimeoutSec = Math.max(
          3,
          Math.min(
            300,
            parsePositiveInt(value, this.plugin.settings.qaAgentShellTimeoutSec)
          )
        );
        await this.plugin.saveSettings();
        text.setValue(String(this.plugin.settings.qaAgentShellTimeoutSec));
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Shell tool default cwd (vault-relative, optional)").setDesc(
      "Pick a vault folder from dropdown for run_shell default start location. This is separate from absolute allowlist rules. / run_shell \uAE30\uBCF8 \uC2DC\uC791 \uD3F4\uB354\uB97C vault \uB4DC\uB86D\uB2E4\uC6B4\uC5D0\uC11C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uC808\uB300\uACBD\uB85C allowlist\uC640\uB294 \uBCC4\uAC1C\uC785\uB2C8\uB2E4."
    ).addDropdown((dropdown) => {
      const folderOptions = this.getVaultFolderOptionsForShellCwd();
      const optionValues = /* @__PURE__ */ new Set();
      dropdown.addOption("", ". (Vault root / vault \uB8E8\uD2B8)");
      optionValues.add("");
      for (const folder of folderOptions) {
        dropdown.addOption(folder, folder);
        optionValues.add(folder);
      }
      const current = this.plugin.settings.qaAgentShellCwdPath.trim();
      const isAbsoluteCurrent = current.startsWith("/") || /^[A-Za-z]:/.test(current);
      if (current && !optionValues.has(current)) {
        const customLabel = isAbsoluteCurrent ? `${current} (absolute custom / \uC808\uB300\uACBD\uB85C \uC0AC\uC6A9\uC790\uAC12)` : `${current} (custom / \uC0AC\uC6A9\uC790\uAC12)`;
        dropdown.addOption(current, customLabel);
      }
      dropdown.setValue(current);
      dropdown.onChange(async (value) => {
        const trimmed = value.trim();
        try {
          if (!trimmed) {
            this.plugin.settings.qaAgentShellCwdPath = "";
          } else {
            this.plugin.settings.qaAgentShellCwdPath = this.plugin.sanitizeQaShellCwdPath(trimmed);
          }
          await this.plugin.saveSettings();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid shell cwd path";
          new import_obsidian4.Notice(message, 7e3);
          this.display();
        }
      });
    }).addButton(
      (button) => button.setButtonText("Refresh folders / \uD3F4\uB354 \uC0C8\uB85C\uACE0\uCE68").onClick(() => {
        this.display();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Agent path allowlist (absolute, comma/newline)").setDesc("Absolute path allowlist for run_shell cwd and agent file actions(read/write/list) when full access is OFF. Default: (empty, vault-only)").addTextArea(
      (text) => text.setPlaceholder("/absolute/path/project,/absolute/path/vault").setValue(this.plugin.settings.qaAgentPathAllowlist).onChange(async (value) => {
        this.plugin.settings.qaAgentPathAllowlist = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Allow non-local Q&A endpoint (danger)").setDesc("Off by default. Keep disabled to prevent note data leaving localhost.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.qaAllowNonLocalEndpoint).onChange(async (value) => {
        this.plugin.settings.qaAllowNonLocalEndpoint = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Allowed outbound hosts (non-local Q&A)").setDesc(
      "Comma/newline-separated host allowlist used when non-local endpoint is enabled. Example: api.openai.com, api.anthropic.com"
    ).addTextArea(
      (text) => text.setPlaceholder("api.openai.com,api.anthropic.com,generativelanguage.googleapis.com").setValue(this.plugin.settings.qaAllowedOutboundHosts).onChange(async (value) => {
        this.plugin.settings.qaAllowedOutboundHosts = value;
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
    new import_obsidian4.Setting(containerEl).setName("Enable cleanup rules during apply").setDesc(
      "AI \uC81C\uC548\uC744 \uC801\uC6A9\uD560 \uB54C, \uC544\uB798 \uADDC\uCE59\uC73C\uB85C frontmatter \uD0A4\uB97C \uC790\uB3D9 \uC815\uB9AC\uD569\uB2C8\uB2E4. \uCD08\uBCF4\uC790\uB294 \uBA3C\uC800 dry-run\uC73C\uB85C \uD655\uC778\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4."
    ).addToggle(
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
      "\uC2E4\uC81C \uC801\uC6A9 \uC804 `Dry-run cleanup...`\uC73C\uB85C \uACB0\uACFC\uB97C \uBA3C\uC800 \uD655\uC778\uD558\uACE0, \uBB38\uC81C \uC5C6\uC744 \uB54C `Cleanup...`\uC744 \uC2E4\uD589\uD558\uC138\uC694."
    );
    new import_obsidian4.Setting(containerEl).setName("Cleanup dry-run report folder").setDesc(
      "dry-run \uACB0\uACFC \uB9AC\uD3EC\uD2B8\uB97C \uC800\uC7A5\uD560 \uD3F4\uB354\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uD30C\uC77C \uC218\uC815 \uC5C6\uC774 \uBCC0\uACBD \uC608\uC815 \uD56D\uBAA9\uB9CC \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
    ).addText(
      (text) => text.setPlaceholder("Omni Forge Reports").setValue(this.plugin.settings.cleanupReportRootPath).onChange(async (value) => {
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
      (text) => text.setPlaceholder(".obsidian,Omni Forge Backups").setValue(this.plugin.settings.excludedFolderPatterns).onChange(async (value) => {
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
      (text) => text.setPlaceholder("Omni Forge Backups").setValue(this.plugin.settings.backupRootPath).onChange(async (value) => {
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
    if (activeTab === "analyzed") {
      this.prioritizeAnalyzedEmbeddingSection(containerEl);
    }
    this.applySettingsTabVisibility(containerEl);
    this.applyCompactSettingsVisibility(containerEl);
    this.hideEmptySettingSections(containerEl);
    this.applyBilingualSettingsLabels(containerEl);
  }
  applyBilingualSettingsLabels(containerEl) {
    const mode = this.plugin.settings.settingsUiLanguage;
    if (mode === "en") {
      const nameEls2 = containerEl.querySelectorAll(".setting-item-name");
      for (const nameEl of Array.from(nameEls2)) {
        const inline = splitInlineBilingualText(nameEl.textContent);
        if (!inline) {
          continue;
        }
        nameEl.removeClass("omni-forge-bilingual-field");
        nameEl.textContent = inline.en;
      }
      const descEls2 = containerEl.querySelectorAll(".setting-item-description");
      for (const descEl of Array.from(descEls2)) {
        const inline = splitInlineBilingualText(descEl.textContent);
        if (!inline) {
          continue;
        }
        descEl.removeClass("omni-forge-bilingual-field");
        descEl.textContent = inline.en;
      }
      const headerEls2 = containerEl.querySelectorAll("h2, h3");
      for (const headerEl of Array.from(headerEls2)) {
        const inline = splitInlineBilingualText(headerEl.textContent);
        if (!inline) {
          continue;
        }
        headerEl.textContent = inline.en;
      }
      return;
    }
    const headerEls = containerEl.querySelectorAll("h2, h3");
    for (const headerEl of Array.from(headerEls)) {
      const inline = splitInlineBilingualText(headerEl.textContent);
      if (inline) {
        headerEl.textContent = mode === "ko" ? inline.ko : `${inline.en} / ${inline.ko}`;
        continue;
      }
      const localized = toKoreanBilingualParts(headerEl.textContent, SETTINGS_HEADER_KO_MAP);
      if (localized && mode === "ko") {
        headerEl.textContent = localized.ko;
      } else if (localized && mode === "bilingual") {
        headerEl.textContent = `${localized.en} / ${localized.ko}`;
      }
    }
    const nameEls = containerEl.querySelectorAll(".setting-item-name");
    for (const nameEl of Array.from(nameEls)) {
      const inline = splitInlineBilingualText(nameEl.textContent);
      if (inline) {
        nameEl.removeClass("omni-forge-bilingual-field");
        nameEl.textContent = mode === "ko" ? inline.ko : `${inline.en} / ${inline.ko}`;
        continue;
      }
      const localized = toKoreanBilingualParts(nameEl.textContent, SETTINGS_NAME_KO_MAP);
      if (localized && mode === "ko") {
        nameEl.removeClass("omni-forge-bilingual-field");
        nameEl.textContent = localized.ko;
      } else if (localized && mode === "bilingual") {
        nameEl.empty();
        nameEl.addClass("omni-forge-bilingual-field");
        nameEl.createSpan({
          text: localized.en,
          cls: "omni-forge-bilingual-en"
        });
        nameEl.createSpan({
          text: localized.ko,
          cls: "omni-forge-bilingual-ko"
        });
      }
    }
    const descEls = containerEl.querySelectorAll(".setting-item-description");
    for (const descEl of Array.from(descEls)) {
      const inline = splitInlineBilingualText(descEl.textContent);
      if (inline) {
        descEl.removeClass("omni-forge-bilingual-field");
        descEl.textContent = mode === "ko" ? inline.ko : `${inline.en} / ${inline.ko}`;
        continue;
      }
      const localized = toKoreanBilingualParts(descEl.textContent, SETTINGS_DESC_KO_MAP);
      if (localized && mode === "ko") {
        descEl.removeClass("omni-forge-bilingual-field");
        descEl.textContent = localized.ko;
      } else if (localized && mode === "bilingual") {
        descEl.empty();
        descEl.addClass("omni-forge-bilingual-field");
        descEl.createSpan({
          text: localized.en,
          cls: "omni-forge-bilingual-en"
        });
        descEl.createSpan({
          text: localized.ko,
          cls: "omni-forge-bilingual-ko"
        });
      }
    }
  }
};
_KnowledgeWeaverSettingTab.TAB_OPTIONS = [
  { key: "quick", en: "General", ko: "\uC77C\uBC18" },
  { key: "analyzed", en: "Analyzed", ko: "\uBD84\uC11D" },
  { key: "chat", en: "Chat", ko: "\uCC44\uD305" },
  { key: "orchestration", en: "Orchestration", ko: "\uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158" },
  { key: "skills", en: "Skills", ko: "\uC2A4\uD0AC\uC2A4" },
  { key: "parser", en: "Parser", ko: "\uD30C\uC11C" },
  { key: "guide", en: "Description", ko: "\uC124\uBA85" }
];
_KnowledgeWeaverSettingTab.QUICK_TAB_VISIBLE_NAME_PREFIXES = [
  "Settings UI language",
  "Quick provider",
  "Codex bridge note",
  "Ollama base URL",
  "LM Studio base URL",
  "LM Studio model",
  "LM Studio API key (optional)",
  "Ollama auto-match policy",
  "OpenAI base URL",
  "OpenAI model",
  "OpenAI API key",
  "Anthropic model",
  "Anthropic API key",
  "Gemini model",
  "Gemini API key",
  "Custom system prompt"
];
_KnowledgeWeaverSettingTab.ANALYZED_TAB_VISIBLE_NAME_PREFIXES = [
  "Analyzed depth mode",
  "Analyzed runtime estimate",
  "Analyzed scope snapshot",
  "Suggestion mode (recommended)",
  "Show reasons for each field",
  "Show progress notices",
  "Analyze tags",
  "Analyze topic",
  "Analyze linked",
  "Force all-to-all linked (deterministic)",
  "Analyze index",
  "Max tags",
  "Max linked",
  "Analyze changed notes only",
  "Enable semantic candidate ranking",
  "Embedding Ollama base URL",
  "Embedding detected model picker",
  "Embedding model (manual)",
  "Embedding auto-match policy",
  "Cloud embedding behavior",
  "Embedding detection summary",
  "Semantic top-k candidates",
  "Semantic min similarity",
  "Semantic source max chars",
  "Remove legacy AI-prefixed keys",
  "Enable cleanup rules during apply",
  "Cleanup exact keys",
  "Pick cleanup keys from selected notes",
  "Cleanup key prefixes",
  "Never remove these keys",
  "Run cleanup command",
  "Cleanup dry-run report folder",
  "Sort tags and linked arrays",
  "Include subfolders for selected folders",
  "Selection path width percent",
  "Excluded folder patterns",
  "Watch folders for new notes",
  "Watched folders",
  "Auto-tag active note",
  "Auto-tag cooldown seconds",
  "Backup selected notes before apply",
  "Backup root path",
  "Backup retention count",
  "Generate MOC after apply",
  "MOC file path"
];
_KnowledgeWeaverSettingTab.CHAT_TAB_VISIBLE_NAME_PREFIXES = [
  "Chat model profile",
  "Model inventory refresh",
  "Ollama detected model picker",
  "Ollama detection summary",
  "Flash profile",
  "Pro profile",
  "Prefer Ollama /api/chat (with fallback)",
  "Q&A retrieval top-k",
  "Q&A max context chars",
  "Structured answer guard",
  "Always detailed answers",
  "Minimum answer chars",
  "Preferred response language",
  "Chat font size",
  "Show system messages in chat",
  "Include selection inventory",
  "Inventory max files",
  "Allow non-local Q&A endpoint (danger)",
  "Allowed outbound hosts (non-local Q&A)",
  "Chat transcript folder path",
  "Attachment ingest folder path",
  "Auto-sync chat thread",
  "PDF attachments in chat",
  "Parser mode",
  "Enable agent tool mode (experimental)",
  "Require approval before tool execution",
  "Allow shell tool (danger)",
  "Agent shell full access (danger)",
  "Shell tool timeout (seconds)",
  "Shell tool default cwd (vault-relative, optional)",
  "Agent path allowlist (absolute, comma/newline)"
];
_KnowledgeWeaverSettingTab.ANALYZED_OLLAMA_ONLY_PREFIXES = [
  "Enable semantic candidate ranking",
  "Embedding Ollama base URL",
  "Embedding detected model picker",
  "Embedding model (manual)",
  "Embedding auto-match policy",
  "Embedding detection summary",
  "Semantic top-k candidates",
  "Semantic min similarity",
  "Semantic source max chars"
];
_KnowledgeWeaverSettingTab.CHAT_OLLAMA_ONLY_PREFIXES = [
  "Model inventory refresh",
  "Ollama detected model picker",
  "Ollama detection summary"
];
_KnowledgeWeaverSettingTab.CHAT_LOCAL_PROFILE_PREFIXES = [
  "Flash profile",
  "Pro profile"
];
_KnowledgeWeaverSettingTab.ORCHESTRATION_TAB_VISIBLE_NAME_PREFIXES = [
  "Conversation mode (chat runtime)",
  "Q&A pipeline preset",
  "Orchestration agent readiness",
  "Ask model (text)",
  "Ask model (vision)",
  "Image generator model",
  "Coder model",
  "Debugger model",
  "Architect model",
  "Orchestrator model",
  "Safeguard model",
  "Debugger agent",
  "Role system prompt editor"
];
_KnowledgeWeaverSettingTab.ADVANCED_TAB_VISIBLE_NAME_PREFIXES = [];
_KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_SECTION_TITLES = /* @__PURE__ */ new Set([
  "Cloud provider config",
  "Semantic linking (Ollama embeddings)",
  "Property cleanup",
  "Selection and backup",
  "MOC"
]);
_KnowledgeWeaverSettingTab.SIMPLE_VISIBLE_NAME_PREFIXES = [
  "Settings UI language",
  "Plugin mission",
  "Quick one-click setup",
  "Conversation mode (chat runtime)",
  "Flash profile",
  "Open preset guide"
];
_KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_NAME_KEYWORDS = [
  "Role model detection",
  "Role recommendation",
  "Ask model",
  "Image generator model",
  "Coder model",
  "Architect model",
  "Orchestrator model",
  "Safeguard model",
  "Role system prompt editor",
  "Custom system prompt",
  "Inventory max files"
];
var KnowledgeWeaverSettingTab = _KnowledgeWeaverSettingTab;
var PatchParser = class {
  normalizeUnifiedDiffText(rawDiff) {
    const trimmed = (rawDiff != null ? rawDiff : "").trim();
    if (!trimmed) {
      return "";
    }
    const fenced = /^```(?:diff)?\s*([\s\S]*?)```$/i.exec(trimmed);
    const body = fenced ? fenced[1] : trimmed;
    return body.replace(/\r\n/g, "\n").trim();
  }
  parse(diffText) {
    const normalized = this.normalizeUnifiedDiffText(diffText);
    if (!normalized) {
      return {
        hunks: [],
        error: "Unified diff is empty."
      };
    }
    const lines = normalized.split("\n");
    const pathHeaderPattern = /^(diff --git\s|index\s+[0-9a-f]+\.\.[0-9a-f]+|---\s+\S|\+\+\+\s+\S)/i;
    const hunks = [];
    let index = 0;
    while (index < lines.length && !lines[index].startsWith("@@")) {
      if (pathHeaderPattern.test(lines[index].trim())) {
        return {
          hunks: [],
          error: "Path-based diff headers are not allowed for selection patch."
        };
      }
      index += 1;
    }
    while (index < lines.length) {
      const header = lines[index];
      if (!header.startsWith("@@")) {
        if (pathHeaderPattern.test(header.trim())) {
          return {
            hunks: [],
            error: "Path-based multi-file diff is not allowed."
          };
        }
        index += 1;
        continue;
      }
      const match = /^@@\s*-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s*@@/.exec(header);
      if (!match) {
        return {
          hunks: [],
          error: `Invalid hunk header: ${header}`
        };
      }
      const oldStart = Number.parseInt(match[1], 10);
      const oldCount = Number.parseInt(match[2] != null ? match[2] : "1", 10);
      const newStart = Number.parseInt(match[3], 10);
      const newCount = Number.parseInt(match[4] != null ? match[4] : "1", 10);
      if (!Number.isFinite(oldStart) || !Number.isFinite(oldCount) || !Number.isFinite(newStart) || !Number.isFinite(newCount) || oldStart < 1 || newStart < 1 || oldCount < 0 || newCount < 0) {
        return {
          hunks: [],
          error: `Invalid hunk range: ${header}`
        };
      }
      const hunkLines = [];
      let actualOldCount = 0;
      let actualNewCount = 0;
      index += 1;
      while (index < lines.length && !lines[index].startsWith("@@")) {
        const line = lines[index];
        if (line.startsWith("\\ No newline at end of file")) {
          index += 1;
          continue;
        }
        const prefix = line.slice(0, 1);
        if (prefix !== " " && prefix !== "+" && prefix !== "-") {
          return {
            hunks: [],
            error: `Invalid diff line prefix: ${line}`
          };
        }
        hunkLines.push({
          prefix,
          text: line.slice(1)
        });
        if (prefix === " " || prefix === "-") {
          actualOldCount += 1;
        }
        if (prefix === " " || prefix === "+") {
          actualNewCount += 1;
        }
        index += 1;
      }
      if (actualOldCount !== oldCount || actualNewCount !== newCount) {
        return {
          hunks: [],
          error: `Hunk line count mismatch: ${header}`
        };
      }
      hunks.push({
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: hunkLines
      });
    }
    if (hunks.length === 0) {
      return {
        hunks: [],
        error: "No @@ hunk found in unified diff."
      };
    }
    return {
      hunks,
      error: null
    };
  }
  countChangedLines(parsedDiff) {
    if (!parsedDiff || parsedDiff.error) {
      return 0;
    }
    let changed = 0;
    for (const hunk of parsedDiff.hunks) {
      for (const line of hunk.lines) {
        if (line.prefix === "+" || line.prefix === "-") {
          changed += 1;
        }
      }
    }
    return changed;
  }
  validateSelectionRange(parsedDiff, selectionText) {
    if (!parsedDiff || parsedDiff.error) {
      return {
        ok: false,
        error: "Unified diff parse failed."
      };
    }
    const normalizedSelection = (selectionText != null ? selectionText : "").replace(/\r\n/g, "\n");
    const selectionLineCount = normalizedSelection.length > 0 ? normalizedSelection.split("\n").length : 0;
    for (const hunk of parsedDiff.hunks) {
      const start = hunk.oldStart;
      const count = hunk.oldCount;
      if (start > selectionLineCount + 1) {
        return {
          ok: false,
          error: `Diff hunk starts outside selection range (line ${start} > ${selectionLineCount + 1}).`,
          selectionLineCount
        };
      }
      const end = count === 0 ? start - 1 : start + count - 1;
      if (end > selectionLineCount) {
        return {
          ok: false,
          error: `Diff hunk exceeds selection range (line ${end} > ${selectionLineCount}).`,
          selectionLineCount
        };
      }
    }
    return {
      ok: true,
      selectionLineCount
    };
  }
  validateLimits(parsedDiff, limits) {
    if (!parsedDiff || parsedDiff.error) {
      return {
        ok: false,
        error: (parsedDiff == null ? void 0 : parsedDiff.error) || "Unified diff parse failed.",
        changedLines: 0,
        hunks: 0,
        maxChangedLines: limits.maxChangedLines,
        maxHunks: limits.maxHunks
      };
    }
    const changedLines = this.countChangedLines(parsedDiff);
    const hunks = parsedDiff.hunks.length;
    if (changedLines === 0) {
      return {
        ok: false,
        error: "diff is not a valid unified diff.",
        changedLines,
        hunks,
        maxChangedLines: limits.maxChangedLines,
        maxHunks: limits.maxHunks
      };
    }
    if (hunks > limits.maxHunks) {
      return {
        ok: false,
        error: `Hunk count ${hunks} exceeds allowed limit ${limits.maxHunks}.`,
        changedLines,
        hunks,
        maxChangedLines: limits.maxChangedLines,
        maxHunks: limits.maxHunks
      };
    }
    if (changedLines > limits.maxChangedLines) {
      return {
        ok: false,
        error: `Changed lines ${changedLines} exceed allowed limit ${limits.maxChangedLines}.`,
        changedLines,
        hunks,
        maxChangedLines: limits.maxChangedLines,
        maxHunks: limits.maxHunks
      };
    }
    return {
      ok: true,
      changedLines,
      hunks,
      maxChangedLines: limits.maxChangedLines,
      maxHunks: limits.maxHunks
    };
  }
};
var PatchApplier = class {
  constructor(parser) {
    this.parser = parser;
  }
  linesEqual(left, right, trimRightWhitespace) {
    if (!trimRightWhitespace) {
      return left === right;
    }
    return left.replace(/\s+$/g, "") === right.replace(/\s+$/g, "");
  }
  blockEquals(lines, start, block, trimRightWhitespace) {
    if (start < 0 || start + block.length > lines.length) {
      return false;
    }
    for (let index = 0; index < block.length; index += 1) {
      if (!this.linesEqual(lines[start + index], block[index], trimRightWhitespace)) {
        return false;
      }
    }
    return true;
  }
  buildFuzzyAnchor(oldLines, contextEntries) {
    if (oldLines.length === 0 || contextEntries.length === 0) {
      return null;
    }
    let bestStartIndex = 0;
    let bestLength = 1;
    let currentStartIndex = 0;
    let currentLength = 1;
    for (let index = 1; index < contextEntries.length; index += 1) {
      if (contextEntries[index].oldIndex === contextEntries[index - 1].oldIndex + 1) {
        currentLength += 1;
      } else {
        if (currentLength > bestLength) {
          bestLength = currentLength;
          bestStartIndex = currentStartIndex;
        }
        currentStartIndex = index;
        currentLength = 1;
      }
    }
    if (currentLength > bestLength) {
      bestLength = currentLength;
      bestStartIndex = currentStartIndex;
    }
    const anchorStart = contextEntries[bestStartIndex].oldIndex;
    const anchorLength = Math.max(1, Math.min(3, bestLength));
    return {
      anchorStart,
      anchorLines: oldLines.slice(anchorStart, anchorStart + anchorLength)
    };
  }
  collectFuzzyCandidates(working, oldLines, anchor, trimRightWhitespace) {
    const candidateStarts = [];
    if (!anchor || anchor.anchorLines.length === 0) {
      return candidateStarts;
    }
    const maxAnchorStart = working.length - anchor.anchorLines.length;
    for (let anchorStart = 0; anchorStart <= maxAnchorStart; anchorStart += 1) {
      if (!this.blockEquals(working, anchorStart, anchor.anchorLines, trimRightWhitespace)) {
        continue;
      }
      const matchStart = anchorStart - anchor.anchorStart;
      if (matchStart < 0 || matchStart + oldLines.length > working.length) {
        continue;
      }
      if (!this.blockEquals(working, matchStart, oldLines, trimRightWhitespace)) {
        continue;
      }
      candidateStarts.push(matchStart);
    }
    return [...new Set(candidateStarts)];
  }
  applyStrict(sourceText, parsedDiff) {
    if (!parsedDiff || parsedDiff.error) {
      return {
        ok: false,
        error: (parsedDiff == null ? void 0 : parsedDiff.error) || "Unified diff parse failed.",
        text: sourceText,
        changedLines: 0
      };
    }
    const base = sourceText.replace(/\r\n/g, "\n");
    const working = base.split("\n");
    let delta = 0;
    for (const hunk of parsedDiff.hunks) {
      let cursor = hunk.oldStart - 1 + delta;
      if (cursor < 0 || cursor > working.length) {
        return {
          ok: false,
          error: `Hunk start is out of range (line ${hunk.oldStart}).`,
          text: sourceText,
          changedLines: 0
        };
      }
      for (const line of hunk.lines) {
        if (line.prefix === " ") {
          if (working[cursor] !== line.text) {
            return {
              ok: false,
              error: `Context mismatch at line ${cursor + 1}.`,
              text: sourceText,
              changedLines: 0
            };
          }
          cursor += 1;
          continue;
        }
        if (line.prefix === "-") {
          if (working[cursor] !== line.text) {
            return {
              ok: false,
              error: `Delete mismatch at line ${cursor + 1}.`,
              text: sourceText,
              changedLines: 0
            };
          }
          working.splice(cursor, 1);
          delta -= 1;
          continue;
        }
        if (line.prefix === "+") {
          working.splice(cursor, 0, line.text);
          cursor += 1;
          delta += 1;
        }
      }
    }
    return {
      ok: true,
      text: working.join("\n"),
      changedLines: this.parser.countChangedLines(parsedDiff)
    };
  }
  applyFuzzy(sourceText, parsedDiff) {
    if (!parsedDiff || parsedDiff.error) {
      return {
        ok: false,
        error: (parsedDiff == null ? void 0 : parsedDiff.error) || "Unified diff parse failed.",
        text: sourceText,
        changedLines: 0,
        usedTrimmedMatch: false
      };
    }
    const base = sourceText.replace(/\r\n/g, "\n");
    const working = base.split("\n");
    let usedTrimmedMatch = false;
    for (const hunk of parsedDiff.hunks) {
      const oldLines = [];
      const newLines = [];
      const contextEntries = [];
      let oldCursor = 0;
      for (const line of hunk.lines) {
        if (line.prefix !== "+") {
          if (line.prefix === " ") {
            contextEntries.push({ oldIndex: oldCursor, text: line.text });
          }
          oldLines.push(line.text);
          oldCursor += 1;
        }
        if (line.prefix !== "-") {
          newLines.push(line.text);
        }
      }
      const anchor = this.buildFuzzyAnchor(oldLines, contextEntries);
      if (!anchor) {
        return {
          ok: false,
          error: `Fuzzy match needs stable context anchor near hunk start line ${hunk.oldStart}. Regenerate unified diff with more context lines.`,
          text: sourceText,
          changedLines: 0,
          usedTrimmedMatch
        };
      }
      let candidates = this.collectFuzzyCandidates(working, oldLines, anchor, false);
      if (candidates.length === 0) {
        candidates = this.collectFuzzyCandidates(working, oldLines, anchor, true);
        if (candidates.length > 0) {
          usedTrimmedMatch = true;
        }
      }
      if (candidates.length !== 1) {
        const detail = candidates.length === 0 ? "no candidate" : `${candidates.length} candidates`;
        return {
          ok: false,
          error: `Fuzzy match is uncertain (${detail}) near hunk start line ${hunk.oldStart}. Regenerate unified diff.`,
          text: sourceText,
          changedLines: 0,
          usedTrimmedMatch
        };
      }
      const matchStart = candidates[0];
      working.splice(matchStart, oldLines.length, ...newLines);
    }
    return {
      ok: true,
      text: working.join("\n"),
      changedLines: this.parser.countChangedLines(parsedDiff),
      usedTrimmedMatch
    };
  }
  apply(sourceText, diffText, parsedDiff = null) {
    const parsed = parsedDiff || this.parser.parse(diffText);
    if (parsed.error) {
      return {
        ok: false,
        mode: "none",
        error: parsed.error,
        changedLines: 0,
        strictError: parsed.error,
        fuzzyError: ""
      };
    }
    const strictResult = this.applyStrict(sourceText, parsed);
    if (strictResult.ok) {
      return {
        ...strictResult,
        mode: "strict",
        strictError: "",
        fuzzyError: ""
      };
    }
    const fuzzyResult = this.applyFuzzy(sourceText, parsed);
    if (fuzzyResult.ok) {
      return {
        ...fuzzyResult,
        mode: "fuzzy",
        strictError: strictResult.error || "",
        fuzzyError: ""
      };
    }
    return {
      ok: false,
      mode: "none",
      error: `Strict apply failed: ${strictResult.error || "unknown"} | Fuzzy apply failed: ${fuzzyResult.error || "unknown"}`,
      changedLines: this.parser.countChangedLines(parsed),
      strictError: strictResult.error || "",
      fuzzyError: fuzzyResult.error || ""
    };
  }
};
var ScopedVault = class {
  constructor(allowRoots) {
    const roots = Array.isArray(allowRoots) ? allowRoots : [];
    this.allowRoots = roots.map((root) => this.normalizeVaultRelativePath(root, "scopeRoot")).filter((root, index, arr) => root.length > 0 && arr.indexOf(root) === index);
  }
  buildScopeError(code, message, pathValue) {
    const detail = pathValue ? `${message} (${pathValue})` : message;
    const error = new Error(`${code}: ${detail}`);
    error.code = code;
    error.path = pathValue || "";
    return error;
  }
  normalizeVaultRelativePath(rawPath, label = "path") {
    const source = (rawPath != null ? String(rawPath) : "").replace(/\\/g, "/").trim();
    if (label === "scopeRoot" && (source === "." || source === "./")) {
      return ".";
    }
    if (!source) {
      throw this.buildScopeError(CONTRACT_INVALID_PATH, `${label} is empty.`, source);
    }
    if (source.includes("\0")) {
      throw this.buildScopeError(CONTRACT_INVALID_PATH, `${label} contains null byte.`, source);
    }
    if (source.startsWith("/") || /^[A-Za-z]:/.test(source)) {
      throw this.buildScopeError(CONTRACT_INVALID_PATH, `${label} must be vault-relative.`, source);
    }
    const normalized = (0, import_obsidian4.normalizePath)(source);
    if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
      throw this.buildScopeError(CONTRACT_INVALID_PATH, `${label} contains invalid traversal.`, source);
    }
    return normalized;
  }
  isInsideAllowedRoots(pathValue) {
    if (this.allowRoots.length === 0) {
      return false;
    }
    return this.allowRoots.some((root) => {
      if (root === ".") {
        return true;
      }
      return pathValue === root || pathValue.startsWith(`${root}/`);
    });
  }
  assertPathInScope(rawPath, label = "path") {
    const normalized = this.normalizeVaultRelativePath(rawPath, label);
    if (!this.isInsideAllowedRoots(normalized)) {
      throw this.buildScopeError(
        DEFAULT_DENY_SCOPE_VIOLATION,
        `${label} is outside scoped roots: ${this.allowRoots.join(", ") || "(none)"}.`,
        normalized
      );
    }
    return normalized;
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
    this.pendingQaActionPlan = null;
    this.lastQaRoutingLog = null;
    this.pendingNewNoteWatchPrompts = /* @__PURE__ */ new Set();
    this.autoTagInFlightPaths = /* @__PURE__ */ new Set();
    this.autoTagLastRunByPath = /* @__PURE__ */ new Map();
    this.parserToolStatus = {
      pdftotext: false,
      pdftoppm: false,
      tesseract: false
    };
    this.parserToolSummary = "Parser tool check has not run yet.";
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
    void this.refreshParserToolReadinessForQa(false);
    this.addRibbonIcon("message-square", "Open Omni Forge Local Chat", () => {
      void this.openLocalQaWorkspaceView();
    });
    this.addRibbonIcon("list-checks", "Open Omni Forge Analyzed Track", () => {
      void this.openAnalyzedTrack();
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
      id: "open-analyzed-track",
      name: "Open analyzed track snapshot (selection focus)",
      callback: async () => this.openAnalyzedTrack()
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
        await this.clearSelectionForQa(true);
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
  hasDetectedOllamaModel(modelName) {
    const target = modelName.trim();
    if (!target) {
      return false;
    }
    return this.getDetectedOllamaModelNames().includes(target);
  }
  resolveDetectedRoleFallbackModel(role) {
    var _a, _b, _c, _d;
    const options = this.getRoleModelOptionsForQa(role);
    const recommended = (_b = (_a = options.find((option) => option.status === "recommended")) == null ? void 0 : _a.model) == null ? void 0 : _b.trim();
    if (recommended) {
      return recommended;
    }
    const available = (_d = (_c = options.find((option) => option.status !== "unavailable")) == null ? void 0 : _c.model) == null ? void 0 : _d.trim();
    return available || null;
  }
  getRoleModelSettingKey(role) {
    var _a;
    const found = ROLE_MODEL_SETTING_CONFIGS.find((config) => config.role === role);
    return (_a = found == null ? void 0 : found.key) != null ? _a : null;
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
      const current = this.readRoleModelSetting(config.key);
      if (!recommended) {
        if (current.length > 0 && !isOllamaModelAllowedForQaRole(config.role, current)) {
          this.writeRoleModelSetting(config.key, "");
          changed += 1;
        }
        continue;
      }
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
  async openLocalQaWorkspaceView(openNewPane = false) {
    const existingLeaves = this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE);
    if (openNewPane) {
      if (existingLeaves.length >= LOCAL_QA_MAX_PANES) {
        this.notice(`최대 ${LOCAL_QA_MAX_PANES}개 채팅창까지 열 수 있습니다.`);
        if (existingLeaves[0]) {
          this.app.workspace.revealLeaf(existingLeaves[0]);
        }
        return false;
      }
      const splitLeaf = this.app.workspace.getRightLeaf(true);
      if (!splitLeaf) {
        this.notice("Could not open additional chat pane.");
        return false;
      }
      await splitLeaf.setViewState({
        type: LOCAL_QA_VIEW_TYPE,
        active: true
      });
      this.app.workspace.revealLeaf(splitLeaf);
      return true;
    }
    let leaf = existingLeaves[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) {
        this.notice("Could not open right-side chat pane.");
        return false;
      }
      leaf = rightLeaf;
      await leaf.setViewState({
        type: LOCAL_QA_VIEW_TYPE,
        active: true
      });
    }
    this.app.workspace.revealLeaf(leaf);
    return true;
  }
  async openAnalyzedTrack() {
    var _a;
    const selectedFiles = this.getSelectedFiles();
    const folderCounter = /* @__PURE__ */ new Map();
    for (const file of selectedFiles) {
      const folder = (0, import_obsidian4.normalizePath)(file.path.split("/").slice(0, -1).join("/")) || "(root)";
      folderCounter.set(folder, ((_a = folderCounter.get(folder)) != null ? _a : 0) + 1);
    }
    const topFolders = [...folderCounter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([folder, count]) => `${folder}(${count})`);
    const sampleFiles = selectedFiles.slice(0, 4).map((file) => file.path);
    const cache = await this.loadAnalysisCache();
    const cacheEntries = Object.keys(cache.entries).length;
    await this.openSelectionModal({
      title: "Analyzed Track snapshot / \uBD84\uC11D \uBC94\uC704 \uC2A4\uB0C5\uC0F7",
      description: "Review analyzed scope first, then adjust file/folder selection.",
      modalWidth: "min(1180px, 95vw)",
      snapshotLines: [
        `Analyzed snapshot: files=${selectedFiles.length}, selectedFolders=${this.settings.targetFolderPaths.length}, cacheEntries=${cacheEntries}`,
        topFolders.length > 0 ? `Top folders: ${topFolders.join(", ")}` : "Top folders: (none)",
        sampleFiles.length > 0 ? `Sample files: ${sampleFiles.join(", ")}` : "Sample files: (none)"
      ]
    });
  }
  async refreshOpenQaWorkspaceViews() {
    const leaves = this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof LocalQAWorkspaceView) {
        await view.refreshFromSettingsForQa();
      }
    }
  }
  getSelectedFilesForQa() {
    return this.getSelectedFiles();
  }
  getSelectedFolderPathsForQa() {
    return [...this.settings.targetFolderPaths];
  }
  getAnalyzedScopeSnapshotSummaryForQa() {
    const files = this.getSelectedFiles();
    const folderSet = /* @__PURE__ */ new Set();
    for (const file of files) {
      const folder = (0, import_obsidian4.normalizePath)(file.path.split("/").slice(0, -1).join("/")) || "(root)";
      folderSet.add(folder);
    }
    const folderCount = folderSet.size;
    const cacheCount = this.analysisCache ? Object.keys(this.analysisCache.entries).length : 0;
    return [
      `\uC120\uD0DD \uD30C\uC77C ${files.length}\uAC1C`,
      `\uC120\uD0DD \uD3F4\uB354 ${this.settings.targetFolderPaths.length}\uAC1C`,
      `\uD3EC\uD568 \uD3F4\uB354(\uD655\uC7A5) ${folderCount}\uAC1C`,
      `\uBD84\uC11D \uCE90\uC2DC \uC5D4\uD2B8\uB9AC ${cacheCount}\uAC1C`
    ].join(" | ");
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
  getQaPresetProfileForQa() {
    return this.settings.qaLocalPresetProfile;
  }
  getQaPresetProfileLabelForQa() {
    return getQaLocalPresetProfileLabel(this.settings.qaLocalPresetProfile);
  }
  getQaConversationModeForQa() {
    return this.settings.qaConversationMode;
  }
  getQaConversationModeLabelForQa() {
    return getQaConversationModeLabel(this.settings.qaConversationMode);
  }
  getQaConversationModeOptionsForQa() {
    return QA_CONVERSATION_MODE_OPTIONS;
  }
  getQaChatModelFamilyForQa() {
    return this.settings.qaChatModelFamily === "cloud" ? "cloud" : "local";
  }
  getQaChatModelProfileForQa() {
    return (this.settings.qaChatModelProfile || "").trim();
  }
  getQaChatModelFamilyOptionsForQa() {
    return [
      { value: "local", label: "Local" },
      { value: "cloud", label: "Cloud" }
    ];
  }
  getQaChatModelProfileOptionsForQa(family) {
    if (family === "cloud") {
      const codexModel = this.settings.openAIModel.trim() || DEFAULT_SETTINGS.openAIModel;
      const claudeModel = this.settings.anthropicModel.trim() || DEFAULT_SETTINGS.anthropicModel;
      const geminiModel = this.settings.geminiModel.trim() || DEFAULT_SETTINGS.geminiModel;
      return [
        { value: "codex", label: codexModel ? `Codex (${codexModel})` : "Codex" },
        { value: "claude", label: claudeModel ? `Claude (${claudeModel})` : "Claude" },
        { value: "gemini", label: geminiModel ? `Gemini (${geminiModel})` : "Gemini" }
      ];
    }
    return [
      { value: "local-flash", label: "Local Flash" },
      { value: "local-pro", label: "Local Pro" }
    ];
  }
  async setQaChatModelFamilyForQa(family) {
    const nextFamily = family === "cloud" ? "cloud" : "local";
    this.settings.qaChatModelFamily = nextFamily;
    const allowedProfiles = nextFamily === "cloud" ? /* @__PURE__ */ new Set(["codex", "claude", "gemini"]) : /* @__PURE__ */ new Set(["local-flash", "local-pro"]);
    const normalizedProfile = allowedProfiles.has(this.settings.qaChatModelProfile) ? this.settings.qaChatModelProfile : nextFamily === "cloud" ? "codex" : "local-flash";
    this.settings.qaChatModelProfile = normalizedProfile;
    return await this.applyQaChatModelProfileForQa(normalizedProfile, nextFamily);
  }
  appendQaAllowedOutboundHostFromUrl(rawUrl) {
    const value = (rawUrl || "").trim();
    if (!value) {
      return;
    }
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.trim().toLowerCase();
      if (!host) {
        return;
      }
      const merged = new Set(this.parseQaAllowedOutboundHosts());
      merged.add(host);
      this.settings.qaAllowedOutboundHosts = [...merged].sort((a, b) => a.localeCompare(b)).join(", ");
    } catch (e) {
    }
  }
  async applyQaChatModelProfileForQa(profile, familyHint) {
    const family = familyHint === "cloud" ? "cloud" : this.getQaChatModelFamilyForQa();
    if (family === "local") {
      const normalized = profile === "local-pro" ? "local-pro" : "local-flash";
      const preset = normalized === "local-pro" ? "balanced_local" : "fast_local";
      const summary = await this.applyOneClickLocalPresetForQa(preset);
      this.settings.qaChatModelFamily = "local";
      this.settings.qaChatModelProfile = normalized;
      await this.saveSettings();
      await this.refreshOpenQaWorkspaceViews();
      return summary;
    }
    const normalized = profile === "claude" || profile === "gemini" ? profile : "codex";
    const bridgeBase = toOpenAICompatibleBase(this.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
    this.settings.qaChatModelFamily = "cloud";
    this.settings.qaChatModelProfile = normalized;
    this.settings.qaLocalPresetProfile = "custom";
    this.settings.qaAllowNonLocalEndpoint = true;
    this.settings.qaOllamaBaseUrl = bridgeBase;
    this.appendQaAllowedOutboundHostFromUrl(bridgeBase);
    if (normalized === "claude") {
      this.settings.provider = "anthropic";
      this.settings.qaOllamaModel = this.settings.anthropicModel.trim() || DEFAULT_SETTINGS.anthropicModel;
    } else if (normalized === "gemini") {
      this.settings.provider = "gemini";
      this.settings.qaOllamaModel = this.settings.geminiModel.trim() || DEFAULT_SETTINGS.geminiModel;
    } else {
      this.settings.provider = "openai";
      this.settings.qaOllamaModel = this.settings.openAIModel.trim() || DEFAULT_SETTINGS.openAIModel;
    }
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    return `Cloud profile applied: ${normalized}. Q&A base URL uses OpenAI-compatible bridge endpoint (${this.settings.qaOllamaBaseUrl}).`;
  }
  applyQaConversationModePreset(mode) {
    this.settings.qaConversationMode = mode;
    switch (mode) {
      case "ask":
        this.settings.qaRolePreset = "ask";
        this.settings.qaPipelinePreset = "legacy_auto";
        this.settings.qaAgentToolModeEnabled = false;
        this.settings.qaOrchestratorEnabled = false;
        this.settings.qaSafeguardPassEnabled = false;
        break;
      case "plan":
        this.settings.qaRolePreset = "orchestrator";
        this.settings.qaPipelinePreset = "orchestrator_safeguard";
        this.settings.qaAgentToolModeEnabled = false;
        this.settings.qaOrchestratorEnabled = true;
        this.settings.qaSafeguardPassEnabled = true;
        this.settings.qaAlwaysDetailedAnswer = true;
        this.settings.qaMinAnswerChars = Math.max(260, this.settings.qaMinAnswerChars);
        break;
      case "agent":
        this.settings.qaRolePreset = "coder";
        this.settings.qaPipelinePreset = "legacy_auto";
        this.settings.qaAgentToolModeEnabled = true;
        this.settings.qaAgentRequireApproval = false;
        this.settings.qaOrchestratorEnabled = false;
        this.settings.qaSafeguardPassEnabled = false;
        break;
      case "orchestration":
        this.settings.qaRolePreset = "orchestrator";
        this.settings.qaPipelinePreset = "orchestrator_auto_route";
        this.settings.qaAgentToolModeEnabled = false;
        this.settings.qaOrchestratorEnabled = true;
        this.settings.qaSafeguardPassEnabled = true;
        this.settings.qaAlwaysDetailedAnswer = true;
        this.settings.qaMinAnswerChars = Math.max(320, this.settings.qaMinAnswerChars);
        break;
      default:
        break;
    }
  }
  async setQaConversationModeForQa(mode) {
    this.applyQaConversationModePreset(mode);
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    if (mode === "orchestration") {
      await this.refreshOllamaDetection({ notify: false, autoApply: true });
      await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
      await this.applyRecommendedRoleModelsForQa(false, true);
      const defaultPipeline = this.getQaPipelinePresetOptionsForQa()[0];
      if (defaultPipeline && this.settings.qaPipelinePreset !== defaultPipeline.value) {
        this.settings.qaPipelinePreset = defaultPipeline.value;
        await this.saveSettings();
      }
    }
    await this.refreshOpenQaWorkspaceViews();
  }
  getQaRolePresetOptionsForQa() {
    return QA_ROLE_PRESET_OPTIONS;
  }
  getQaPipelinePresetOptionsForQa() {
    if (this.settings.qaConversationMode === "orchestration") {
      const defaultOption = QA_PIPELINE_PRESET_OPTIONS.find((option) => option.value === "orchestrator_auto_route");
      return defaultOption ? [defaultOption] : QA_PIPELINE_PRESET_OPTIONS;
    }
    return QA_PIPELINE_PRESET_OPTIONS;
  }
  getQaModelLabelForQa(role) {
    const resolvedRole = role != null ? role : this.resolveQaPrimaryRole();
    return this.resolveQaModelForRole(resolvedRole) || "(not set)";
  }
  getQaEmbeddingModelForQa() {
    return this.settings.semanticOllamaModel.trim();
  }
  getQaParserModeForQa() {
    return this.settings.qaParserMode === "detailed" ? "detailed" : "fast";
  }
  getParserToolReadinessSummaryForQa() {
    return this.parserToolSummary;
  }
  getParserToolReadinessLinesForQa() {
    const tools = ["pdftotext", "pdftoppm", "tesseract"];
    return tools.map((tool) => `${tool}: ${this.parserToolStatus[tool] ? "ready" : "missing"}`);
  }
  async isShellCommandAvailable(command) {
    const safe = command.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(safe)) {
      return false;
    }
    try {
      await execAsync(`command -v ${safe}`);
      return true;
    } catch (e) {
      return false;
    }
  }
  async refreshParserToolReadinessForQa(notify) {
    const pdftotext = await this.isShellCommandAvailable("pdftotext");
    const pdftoppm = await this.isShellCommandAvailable("pdftoppm");
    const tesseract = await this.isShellCommandAvailable("tesseract");
    this.parserToolStatus = { pdftotext, pdftoppm, tesseract };
    const coreReady = pdftotext && pdftoppm && tesseract;
    this.parserToolSummary = [
      `PDF text: ${pdftotext ? "ready" : "missing"}`,
      `PDF OCR render: ${pdftoppm ? "ready" : "missing"}`,
      `OCR engine: ${tesseract ? "ready" : "missing"}`,
      coreReady ? "Detailed parser chain available." : "Fallback parser mode will be used for missing tools."
    ].join(" | ");
    if (notify) {
      this.notice(this.parserToolSummary, 7e3);
    }
    return this.parserToolSummary;
  }
  getQaRoleModelSummaryForQa() {
    const entries = [
      { role: "ask", short: "ask" },
      { role: "ask_vision", short: "vision" },
      { role: "image_generator", short: "image" },
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
  getQaAgentModeSummaryForQa() {
    if (!this.settings.qaAgentToolModeEnabled) {
      return "off";
    }
    const parts = [
      this.settings.qaAgentRequireApproval ? "approval" : "auto",
      this.settings.qaAgentAllowShellTool ? "shell:on" : "shell:off",
      this.settings.qaAgentShellFullAccess ? "access:full" : "access:scoped"
    ];
    if (this.pendingQaActionPlan) {
      parts.push(`pending:${this.pendingQaActionPlan.actions.length}`);
    }
    return parts.join(",");
  }
  isQaContextEnabledForQa() {
    return this.settings.qaContextInChat;
  }
  async setQaContextEnabledForQa(enabled) {
    this.settings.qaContextInChat = enabled;
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  isQaAgentToolModeEnabledForQa() {
    return this.settings.qaAgentToolModeEnabled;
  }
  async setQaAgentToolModeEnabledForQa(enabled) {
    this.settings.qaAgentToolModeEnabled = enabled;
    await this.saveSettings();
  }
  inferQaCloudProfileFromModelName(modelName) {
    const normalized = modelName.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (CLOUD_ANTHROPIC_MODEL_REGEX.test(normalized)) {
      return "claude";
    }
    if (CLOUD_GEMINI_MODEL_REGEX.test(normalized)) {
      return "gemini";
    }
    if (CLOUD_OPENAI_MODEL_REGEX.test(normalized)) {
      return "codex";
    }
    return null;
  }
  syncQaCloudFamilyFromModelHint(modelName) {
    const inferredProfile = this.inferQaCloudProfileFromModelName(modelName);
    if (!inferredProfile) {
      return false;
    }
    this.settings.qaChatModelFamily = "cloud";
    this.settings.qaChatModelProfile = inferredProfile;
    this.settings.qaAllowNonLocalEndpoint = true;
    this.settings.qaOllamaBaseUrl = toOpenAICompatibleBase(this.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
    this.appendQaAllowedOutboundHostFromUrl(this.settings.qaOllamaBaseUrl);
    if (inferredProfile === "claude") {
      this.settings.provider = "anthropic";
    } else if (inferredProfile === "gemini") {
      this.settings.provider = "gemini";
    } else {
      this.settings.provider = "openai";
    }
    return true;
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
  getDefaultQaRoleSystemPromptForQa(role) {
    switch (role) {
      case "ask":
        return DEFAULT_SETTINGS.qaAskSystemPrompt;
      case "ask_vision":
        return DEFAULT_SETTINGS.qaAskVisionSystemPrompt;
      case "image_generator":
        return DEFAULT_SETTINGS.qaImageGeneratorSystemPrompt;
      case "coder":
        return DEFAULT_SETTINGS.qaCoderSystemPrompt;
      case "debugger":
        return DEFAULT_SETTINGS.qaDebuggerSystemPrompt;
      case "architect":
        return DEFAULT_SETTINGS.qaArchitectSystemPrompt;
      case "orchestrator":
        return DEFAULT_SETTINGS.qaOrchestratorSystemPrompt;
      case "safeguard":
        return DEFAULT_SETTINGS.qaSafeguardSystemPrompt;
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
    const normalized = modelOverride.trim();
    this.settings.qaOllamaModel = normalized;
    if (normalized) {
      this.syncQaCloudFamilyFromModelHint(normalized);
    }
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  async applyQaChatModelSelectionForQa(role, modelName) {
    const next = modelName.trim();
    this.settings.qaOllamaModel = next;
    if (next) {
      this.syncQaCloudFamilyFromModelHint(next);
    }
    this.settings.qaLocalPresetProfile = "custom";
    const roleKey = this.getRoleModelSettingKey(role);
    if (roleKey) {
      this.settings[roleKey] = next;
    }
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  async setQaRolePresetForQa(rolePreset) {
    this.settings.qaRolePreset = rolePreset;
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  async setQaPipelinePresetForQa(pipelinePreset) {
    this.settings.qaPipelinePreset = pipelinePreset;
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  getPresetRank(preset) {
    switch (preset) {
      case "quality_local":
        return 3;
      case "balanced_local":
        return 2;
      case "fast_local":
      default:
        return 1;
    }
  }
  resolveHardwarePresetCeiling() {
    var _a, _b;
    const ramGiB = Number((nodeOs.totalmem() / 1024 ** 3).toFixed(1));
    const cpuThreads = (_b = (_a = nodeOs.cpus()) == null ? void 0 : _a.length) != null ? _b : 0;
    if (!Number.isFinite(ramGiB) || ramGiB <= 0) {
      return {
        ceiling: "balanced_local",
        ramGiB: 0,
        cpuThreads,
        reason: "RAM \uC815\uBCF4\uB97C \uC815\uD655\uD788 \uC77D\uC9C0 \uBABB\uD574 Pro\uAE4C\uC9C0 \uD5C8\uC6A9\uD569\uB2C8\uB2E4."
      };
    }
    if (ramGiB < 16 || cpuThreads < 6) {
      return {
        ceiling: "fast_local",
        ramGiB,
        cpuThreads,
        reason: "RAM<16GB \uB610\uB294 CPU \uC2A4\uB808\uB4DC<6 \uC774\uBBC0\uB85C Flash \uAD8C\uC7A5/\uC81C\uD55C\uC785\uB2C8\uB2E4."
      };
    }
    if (ramGiB < 32 || cpuThreads < 10) {
      return {
        ceiling: "balanced_local",
        ramGiB,
        cpuThreads,
        reason: "\uC911\uAC04\uAE09 \uC0AC\uC591\uC73C\uB85C Pro\uAE4C\uC9C0 \uC548\uC815\uC801\uC785\uB2C8\uB2E4."
      };
    }
    return {
      ceiling: "quality_local",
      ramGiB,
      cpuThreads,
      reason: "\uACE0\uC0AC\uC591\uC73C\uB85C Pro(\uD655\uC7A5) \uAD6C\uC131\uC774 \uAD8C\uC7A5\uB429\uB2C8\uB2E4."
    };
  }
  getHardwareCapabilitySummaryForQa() {
    const profile = this.resolveHardwarePresetCeiling();
    const ceilingLabel = profile.ceiling === "fast_local" ? "Flash" : "Pro";
    const ramText = profile.ramGiB > 0 ? `${profile.ramGiB}GB` : "unknown";
    return `Hardware: RAM=${ramText}, CPU threads=${profile.cpuThreads || "unknown"} | Max preset=${ceilingLabel}. ${profile.reason}`;
  }
  clampPresetByHardware(requested) {
    const profile = this.resolveHardwarePresetCeiling();
    if (this.getPresetRank(requested) <= this.getPresetRank(profile.ceiling)) {
      return {
        effective: requested,
        note: ""
      };
    }
    const requestedLabel = requested === "fast_local" ? "Flash" : "Pro";
    const effectiveLabel = profile.ceiling === "fast_local" ? "Flash" : "Pro";
    return {
      effective: profile.ceiling,
      note: `Requested ${requestedLabel}, but hardware limit applied: ${effectiveLabel}. ${profile.reason}`
    };
  }
  scoreModelForPreset(modelName, preset, requireVision) {
    const lower = modelName.toLowerCase();
    if (requireVision && !VISION_MODEL_REGEX.test(lower)) {
      return -1e3;
    }
    const sizeB = extractModelSizeBillions(lower);
    if (sizeB === null) {
      return requireVision ? 2 : 4;
    }
    if (preset === "fast_local") {
      if (sizeB <= 9) {
        return 120 - Math.abs(sizeB - 7) * 6;
      }
      return 40 - (sizeB - 9) * 8;
    }
    if (preset === "balanced_local") {
      if (sizeB >= 7 && sizeB <= 20) {
        return 130 - Math.abs(sizeB - 13) * 4;
      }
      if (sizeB < 7) {
        return 70 - (7 - sizeB) * 6;
      }
      return 65 - (sizeB - 20) * 5;
    }
    if (sizeB >= 20) {
      return 150 - Math.abs(sizeB - 32) * 2;
    }
    return 75 - (20 - sizeB) * 4;
  }
  pickPresetModelFromOptions(options, preset, requireVision = false) {
    var _a, _b;
    const candidates = options.filter((option) => option.status !== "unavailable").map((option) => ({
      model: option.model,
      score: this.scoreModelForPreset(option.model, preset, requireVision) + (option.status === "recommended" ? 8 : 0)
    })).filter((item) => item.score > -900).sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));
    return (_b = (_a = candidates[0]) == null ? void 0 : _a.model) != null ? _b : null;
  }
  pickEmbeddingModelForPreset(preset) {
    var _a, _b;
    const options = this.getEmbeddingModelOptions().filter((option) => option.status !== "unavailable");
    const ranked = options.map((option) => {
      const lower = option.model.toLowerCase();
      const sizeB = extractModelSizeBillions(lower);
      const isSmallHint = /(small|mini|tiny|lite|all-minilm|e5-small|nomic-embed-text)/i.test(lower);
      const isLargeHint = /(large|xl|xxl|mxbai-embed-large|e5-large|bge-large)/i.test(lower);
      let score = option.status === "recommended" ? 10 : 0;
      if (preset === "fast_local") {
        score += isSmallHint ? 18 : 0;
        score -= isLargeHint ? 8 : 0;
        if (sizeB !== null) {
          score += Math.max(-12, 10 - sizeB * 2);
        }
      } else if (preset === "balanced_local") {
        score += isSmallHint ? 6 : 0;
        score += isLargeHint ? 5 : 0;
        score += /(nomic|bge|e5|mxbai|gte)/i.test(lower) ? 4 : 0;
        if (sizeB !== null) {
          score += Math.max(-8, 8 - Math.abs(sizeB - 7) * 1.2);
        }
      } else {
        score += isLargeHint ? 18 : 0;
        score -= isSmallHint ? 3 : 0;
        if (sizeB !== null) {
          score += sizeB * 1.8;
        }
      }
      return { model: option.model, score };
    }).sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));
    return (_b = (_a = ranked[0]) == null ? void 0 : _a.model) != null ? _b : "";
  }
  getRecommendedPresetOverrideModelForQa(preset, kind) {
    var _a, _b, _c;
    if (kind === "embedding") {
      return this.pickEmbeddingModelForPreset(preset);
    }
    if (kind === "vision") {
      const askVisionOptions = this.getRoleModelOptionsForQa("ask_vision");
      return (_a = this.pickPresetModelFromOptions(askVisionOptions, preset, true)) != null ? _a : "";
    }
    const textOptions = this.getOllamaModelOptions();
    return (_b = this.pickPresetModelFromOptions(textOptions, preset, false)) != null ? _b : "";
  }
  applyPresetAwareRoleModels(preset) {
    const baseModel = this.pickPresetModelFromOptions(this.getOllamaModelOptions(), preset, false) || this.settings.ollamaModel.trim();
    if (baseModel) {
      this.settings.ollamaModel = baseModel;
      this.settings.qaOllamaModel = baseModel;
    }
    let roleAssignedCount = 0;
    let visionModel = "";
    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const options = this.getRoleModelOptionsForQa(config.role);
      const selected = this.pickPresetModelFromOptions(
        options,
        preset,
        config.role === "ask_vision"
      );
      if (!selected) {
        continue;
      }
      this.writeRoleModelSetting(config.key, selected);
      roleAssignedCount += 1;
      if (config.role === "ask_vision") {
        visionModel = selected;
      }
    }
    if (!visionModel) {
      this.settings.qaAskVisionModel = "";
    }
    return {
      baseModel: this.settings.ollamaModel.trim(),
      visionModel,
      roleAssignedCount
    };
  }
  async applyOneClickLocalPresetForQa(preset) {
    var _a;
    const presetClamp = this.clampPresetByHardware(preset);
    const effectivePreset = presetClamp.effective;
    const previousProvider = this.settings.provider;
    this.settings.ollamaBaseUrl = this.settings.ollamaBaseUrl.trim() || DEFAULT_SETTINGS.ollamaBaseUrl;
    this.settings.qaOllamaBaseUrl = this.settings.ollamaBaseUrl;
    this.settings.semanticOllamaBaseUrl = this.settings.semanticOllamaBaseUrl.trim() || this.settings.ollamaBaseUrl;
    this.settings.qaAllowNonLocalEndpoint = false;
    this.settings.qaAgentRequireApproval = true;
    this.settings.qaAgentAllowShellTool = false;
    this.settings.qaAgentShellFullAccess = false;
    this.settings.qaPreferChatApi = true;
    this.settings.qaThreadAutoSyncEnabled = true;
    this.settings.qaRoleModelAutoPickEnabled = true;
    this.settings.semanticAutoPickEnabled = true;
    this.settings.qaLocalPresetProfile = effectivePreset;
    let summary = "";
    if (effectivePreset === "fast_local") {
      this.settings.suggestionMode = true;
      this.settings.includeReasons = false;
      this.settings.analysisOnlyChangedNotes = true;
      this.settings.semanticLinkingEnabled = false;
      this.settings.qaTopK = 3;
      this.settings.qaMaxContextChars = 8e3;
      this.settings.qaStructureGuardEnabled = false;
      this.settings.qaAlwaysDetailedAnswer = false;
      this.settings.qaMinAnswerChars = 180;
      this.settings.qaRolePreset = "ask";
      this.settings.qaPipelinePreset = "legacy_auto";
      this.settings.qaConversationMode = "ask";
      this.settings.qaOrchestratorEnabled = false;
      this.settings.qaSafeguardPassEnabled = false;
      this.settings.qaIncludeSelectionInventory = false;
      this.settings.qaSelectionInventoryMaxFiles = 100;
      summary = "Flash preset applied: speed-first local mode (lightweight pipeline, short context, concise responses).";
    } else if (effectivePreset === "quality_local") {
      this.settings.suggestionMode = true;
      this.settings.includeReasons = true;
      this.settings.analysisOnlyChangedNotes = false;
      this.settings.semanticLinkingEnabled = true;
      this.settings.semanticTopK = Math.max(this.settings.semanticTopK, 36);
      this.settings.semanticMinSimilarity = Math.min(this.settings.semanticMinSimilarity, 0.2);
      this.settings.qaTopK = 8;
      this.settings.qaMaxContextChars = Math.max(this.settings.qaMaxContextChars, 22e3);
      this.settings.qaStructureGuardEnabled = true;
      this.settings.qaAlwaysDetailedAnswer = true;
      this.settings.qaMinAnswerChars = Math.max(this.settings.qaMinAnswerChars, 650);
      this.settings.qaRolePreset = "orchestrator";
      this.settings.qaPipelinePreset = "orchestrator_architect_coder_safeguard";
      this.settings.qaConversationMode = "orchestration";
      this.settings.qaOrchestratorEnabled = true;
      this.settings.qaSafeguardPassEnabled = true;
      this.settings.qaIncludeSelectionInventory = true;
      this.settings.qaSelectionInventoryMaxFiles = Math.max(
        this.settings.qaSelectionInventoryMaxFiles,
        400
      );
      summary = "Legacy Quality+ preset applied: quality-first local mode (semantic on, deep pipeline, extended context).";
    } else {
      this.settings.suggestionMode = true;
      this.settings.includeReasons = true;
      this.settings.analysisOnlyChangedNotes = false;
      this.settings.semanticLinkingEnabled = true;
      this.settings.qaTopK = 5;
      this.settings.qaMaxContextChars = 12e3;
      this.settings.qaStructureGuardEnabled = true;
      this.settings.qaAlwaysDetailedAnswer = true;
      this.settings.qaMinAnswerChars = 320;
      this.settings.qaRolePreset = "ask";
      this.settings.qaPipelinePreset = "orchestrator_safeguard";
      this.settings.qaConversationMode = "plan";
      this.settings.qaOrchestratorEnabled = false;
      this.settings.qaSafeguardPassEnabled = true;
      this.settings.qaIncludeSelectionInventory = true;
      this.settings.qaSelectionInventoryMaxFiles = Math.max(
        this.settings.qaSelectionInventoryMaxFiles,
        200
      );
      summary = "Pro preset applied: balanced local mode (semantic on, moderate context, safe defaults).";
    }
    const detected = await this.refreshOllamaDetection({
      notify: false,
      autoApply: true
    });
    const detectedModels = (_a = detected == null ? void 0 : detected.models) != null ? _a : [];
    const hasDetectedLocalModels = detectedModels.length > 0;
    let detectionSummary = "";
    if (hasDetectedLocalModels) {
      this.settings.provider = "ollama";
      const embeddingDetected = await this.refreshEmbeddingModelDetection({
        notify: false,
        autoApply: true
      });
      const modelLayout = this.applyPresetAwareRoleModels(effectivePreset);
      const presetEmbeddingModel = this.getRecommendedPresetOverrideModelForQa(effectivePreset, "embedding");
      if (presetEmbeddingModel) {
        this.settings.semanticOllamaModel = presetEmbeddingModel;
      } else if (embeddingDetected == null ? void 0 : embeddingDetected.recommended) {
        this.settings.semanticOllamaModel = embeddingDetected.recommended;
      }
      const manualOverrides = [];
      if (effectivePreset === "balanced_local") {
        const baseOverride = this.settings.qaBalancedPresetBaseModel.trim();
        const visionOverride = this.settings.qaBalancedPresetVisionModel.trim();
        const embeddingOverride = this.settings.qaBalancedPresetEmbeddingModel.trim();
        if (baseOverride) {
          this.settings.ollamaModel = baseOverride;
          this.settings.qaOllamaModel = baseOverride;
          manualOverrides.push(`base=${baseOverride}`);
        }
        if (visionOverride) {
          this.settings.qaAskVisionModel = visionOverride;
          manualOverrides.push(`vision=${visionOverride}`);
        }
        if (embeddingOverride) {
          this.settings.semanticOllamaModel = embeddingOverride;
          manualOverrides.push(`embedding=${embeddingOverride}`);
        }
      } else if (effectivePreset === "quality_local") {
        const baseOverride = this.settings.qaQualityPresetBaseModel.trim();
        const visionOverride = this.settings.qaQualityPresetVisionModel.trim();
        const embeddingOverride = this.settings.qaQualityPresetEmbeddingModel.trim();
        if (baseOverride) {
          this.settings.ollamaModel = baseOverride;
          this.settings.qaOllamaModel = baseOverride;
          manualOverrides.push(`base=${baseOverride}`);
        }
        if (visionOverride) {
          this.settings.qaAskVisionModel = visionOverride;
          manualOverrides.push(`vision=${visionOverride}`);
        }
        if (embeddingOverride) {
          this.settings.semanticOllamaModel = embeddingOverride;
          manualOverrides.push(`embedding=${embeddingOverride}`);
        }
      }
      const visionModel = modelLayout.visionModel || this.resolveVisionModelForImageAttachments();
      detectionSummary = `Detected ${detectedModels.length} local model(s). Auto-assigned base model=${this.settings.ollamaModel || "(none)"}, embedding=${this.settings.semanticOllamaModel || "(none)"}, vision=${visionModel || "(not detected)"}, role fields=${modelLayout.roleAssignedCount}.` + (manualOverrides.length > 0 ? ` Manual preset overrides: ${manualOverrides.join(", ")}.` : "");
    } else {
      this.settings.provider = previousProvider;
      detectionSummary = "No local model was detected. Provider was kept as-is. Start Ollama and install text/vision/embedding models, then re-run preset.";
    }
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    const clampNote = presetClamp.note ? ` ${presetClamp.note}` : "";
    return `${summary} ${detectionSummary}${clampNote}`.trim();
  }
  buildQaQuickCustomProfileSnapshot(label) {
    return {
      version: 1,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      label: label.trim() || "Quick custom profile",
      settings: {
        qaLocalPresetProfile: this.settings.qaLocalPresetProfile,
        ollamaModel: this.settings.ollamaModel,
        qaOllamaModel: this.settings.qaOllamaModel,
        semanticOllamaModel: this.settings.semanticOllamaModel,
        qaAskModel: this.settings.qaAskModel,
        qaAskVisionModel: this.settings.qaAskVisionModel,
        qaImageGeneratorModel: this.settings.qaImageGeneratorModel,
        qaCoderModel: this.settings.qaCoderModel,
        qaDebuggerModel: this.settings.qaDebuggerModel,
        qaArchitectModel: this.settings.qaArchitectModel,
        qaOrchestratorModel: this.settings.qaOrchestratorModel,
        qaSafeguardModel: this.settings.qaSafeguardModel,
        qaTopK: this.settings.qaTopK,
        qaMaxContextChars: this.settings.qaMaxContextChars,
        qaRolePreset: this.settings.qaRolePreset,
        qaPipelinePreset: this.settings.qaPipelinePreset,
        qaStructureGuardEnabled: this.settings.qaStructureGuardEnabled,
        qaAlwaysDetailedAnswer: this.settings.qaAlwaysDetailedAnswer,
        qaMinAnswerChars: this.settings.qaMinAnswerChars,
        qaRoleModelAutoPickEnabled: this.settings.qaRoleModelAutoPickEnabled,
        semanticAutoPickEnabled: this.settings.semanticAutoPickEnabled,
        qaBalancedPresetBaseModel: this.settings.qaBalancedPresetBaseModel,
        qaBalancedPresetVisionModel: this.settings.qaBalancedPresetVisionModel,
        qaBalancedPresetEmbeddingModel: this.settings.qaBalancedPresetEmbeddingModel,
        qaQualityPresetBaseModel: this.settings.qaQualityPresetBaseModel,
        qaQualityPresetVisionModel: this.settings.qaQualityPresetVisionModel,
        qaQualityPresetEmbeddingModel: this.settings.qaQualityPresetEmbeddingModel,
        qaAttachmentIngestRootPath: this.settings.qaAttachmentIngestRootPath
      }
    };
  }
  parseQaQuickCustomProfileSlot(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || !parsed.settings) {
        return null;
      }
      if (typeof parsed.savedAt !== "string") {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }
  getQaQuickCustomProfileSlotSummary(slotKey) {
    const parsed = this.parseQaQuickCustomProfileSlot(this.settings[slotKey]);
    if (!parsed) {
      return "\uC800\uC7A5\uB41C \uD504\uB85C\uD544 \uC5C6\uC74C";
    }
    const stamp = parsed.savedAt.replace("T", " ").replace("Z", " UTC");
    return `${parsed.label || "Custom"} \xB7 ${stamp}`;
  }
  async saveQaQuickCustomProfileSlot(slotKey, label) {
    const snapshot = this.buildQaQuickCustomProfileSnapshot(label);
    this.settings[slotKey] = JSON.stringify(snapshot);
    await this.saveSettings();
    return `${snapshot.label} \uC800\uC7A5 \uC644\uB8CC (${snapshot.savedAt})`;
  }
  async applyQaQuickCustomProfileSlot(slotKey) {
    var _a, _b, _c, _d, _e, _f, _g;
    const parsed = this.parseQaQuickCustomProfileSlot(this.settings[slotKey]);
    if (!parsed) {
      throw new Error("\uC800\uC7A5\uB41C \uCEE4\uC2A4\uD140 \uD504\uB85C\uD544\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    const next = parsed.settings;
    const roleValid = QA_ROLE_PRESET_OPTIONS.some((option) => option.value === next.qaRolePreset);
    const pipelineValid = QA_PIPELINE_PRESET_OPTIONS.some(
      (option) => option.value === next.qaPipelinePreset
    );
    this.settings.qaLocalPresetProfile = next.qaLocalPresetProfile;
    this.settings.ollamaModel = next.ollamaModel;
    this.settings.qaOllamaModel = next.qaOllamaModel;
    this.settings.semanticOllamaModel = next.semanticOllamaModel;
    this.settings.qaAskModel = next.qaAskModel;
    this.settings.qaAskVisionModel = next.qaAskVisionModel;
    this.settings.qaImageGeneratorModel = next.qaImageGeneratorModel;
    this.settings.qaCoderModel = next.qaCoderModel;
    this.settings.qaDebuggerModel = next.qaDebuggerModel || "";
    this.settings.qaArchitectModel = next.qaArchitectModel;
    this.settings.qaOrchestratorModel = next.qaOrchestratorModel;
    this.settings.qaSafeguardModel = next.qaSafeguardModel;
    this.settings.qaTopK = Math.max(1, Math.min(15, Math.floor(next.qaTopK || this.settings.qaTopK)));
    this.settings.qaMaxContextChars = Math.max(
      1200,
      Math.min(5e4, Math.floor(next.qaMaxContextChars || this.settings.qaMaxContextChars))
    );
    if (roleValid) {
      this.settings.qaRolePreset = next.qaRolePreset;
    }
    if (pipelineValid) {
      this.settings.qaPipelinePreset = next.qaPipelinePreset;
    }
    this.settings.qaStructureGuardEnabled = Boolean(next.qaStructureGuardEnabled);
    this.settings.qaAlwaysDetailedAnswer = Boolean(next.qaAlwaysDetailedAnswer);
    this.settings.qaMinAnswerChars = Math.max(
      60,
      Math.min(3e3, Math.floor(next.qaMinAnswerChars || this.settings.qaMinAnswerChars))
    );
    this.settings.qaRoleModelAutoPickEnabled = Boolean(next.qaRoleModelAutoPickEnabled);
    this.settings.semanticAutoPickEnabled = Boolean(next.semanticAutoPickEnabled);
    this.settings.qaBalancedPresetBaseModel = (_a = next.qaBalancedPresetBaseModel) != null ? _a : "";
    this.settings.qaBalancedPresetVisionModel = (_b = next.qaBalancedPresetVisionModel) != null ? _b : "";
    this.settings.qaBalancedPresetEmbeddingModel = (_c = next.qaBalancedPresetEmbeddingModel) != null ? _c : "";
    this.settings.qaQualityPresetBaseModel = (_d = next.qaQualityPresetBaseModel) != null ? _d : "";
    this.settings.qaQualityPresetVisionModel = (_e = next.qaQualityPresetVisionModel) != null ? _e : "";
    this.settings.qaQualityPresetEmbeddingModel = (_f = next.qaQualityPresetEmbeddingModel) != null ? _f : "";
    this.settings.qaAttachmentIngestRootPath = (0, import_obsidian4.normalizePath)(
      ((_g = next.qaAttachmentIngestRootPath) != null ? _g : "").trim() || this.settings.qaAttachmentIngestRootPath || DEFAULT_SETTINGS.qaAttachmentIngestRootPath
    );
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    return `${parsed.label || "Custom"} \uD504\uB85C\uD544\uC744 \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4.`;
  }
  async applyRecommendedQuickSetupForQa() {
    const presetSummary = await this.applyOneClickLocalPresetForQa("balanced_local");
    await this.refreshOllamaDetection({ notify: false, autoApply: true });
    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
    await this.applyRecommendedRoleModelsForQa(false, true);
    this.settings.qaLocalPresetProfile = "balanced_local";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    return `\uCD94\uCC9C \uC138\uD305 \uC801\uC6A9 \uC644\uB8CC: ${presetSummary}`;
  }
  async openSelectionForQa() {
    await this.openSelectionModal();
    await this.refreshOpenQaWorkspaceViews();
  }
  async clearSelectionForQa(notify) {
    this.settings.targetFilePaths = [];
    this.settings.targetFolderPaths = [];
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    if (notify) {
      this.notice("Target file/folder selection cleared.");
    }
  }
  async openCleanupKeyPickerForQa() {
    await this.openCleanupKeyPicker();
  }
  async runCleanupForQa(dryRun) {
    await this.runPropertyCleanup(dryRun);
  }
  getAgentShellFolderOptionsForQa() {
    const out = /* @__PURE__ */ new Set(["."]);
    const all = this.app.vault.getAllLoadedFiles();
    for (const entry of all) {
      if (!(entry instanceof import_obsidian4.TFolder)) {
        continue;
      }
      const normalized = (0, import_obsidian4.normalizePath)(entry.path.trim());
      if (!normalized || normalized === ".") {
        continue;
      }
      out.add(normalized);
    }
    return [...out].sort((a, b) => {
      const depthDiff = a.split("/").length - b.split("/").length;
      if (depthDiff !== 0) {
        return depthDiff;
      }
      return a.localeCompare(b);
    });
  }
  async scanSkillsFolderForQa(rootPath) {
    const target = (rootPath || "").trim();
    if (!target) {
      return { rootPath: "", skills: [], error: "Skills folder path is empty." };
    }
    try {
      const normalizedRoot = nodePath.resolve(target);
      const entries = await nodeFs.promises.readdir(normalizedRoot, { withFileTypes: true });
      const skills = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const skillDir = nodePath.join(normalizedRoot, entry.name);
        const skillDocPath = nodePath.join(skillDir, "SKILL.md");
        try {
          const stat = await nodeFs.promises.stat(skillDocPath);
          if (!stat.isFile()) {
            continue;
          }
          const raw = await nodeFs.promises.readFile(skillDocPath, "utf8");
          const firstHeading = raw.split(/\r?\n/).find((line) => /^#\s+/.test(line.trim()));
          const summaryLine = raw.split(/\r?\n/).find(
            (line) => line.trim().length > 0 && !line.trim().startsWith("#")
          );
          skills.push({
            id: entry.name,
            folder: skillDir,
            docPath: skillDocPath,
            title: firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : entry.name,
            summary: (summaryLine || "").trim()
          });
        } catch (e) {
        }
      }
      skills.sort((a, b) => a.id.localeCompare(b.id));
      return { rootPath: normalizedRoot, skills };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown skills scan error";
      return { rootPath: target, skills: [], error: message };
    }
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
  sanitizeVaultFolderPathForQa(rawPath, fallback, label) {
    return this.resolveSafeFolderPath(rawPath, fallback, label);
  }
  async setChatTranscriptRootPathForQa(path) {
    const next = this.resolveSafeFolderPath(path, "Omni Forge Chats", "Chat transcript");
    this.settings.chatTranscriptRootPath = next;
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }
  async setBackupRootPathForQa(path) {
    const next = this.resolveSafeFolderPath(path, "Omni Forge Backups", "Backup root");
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
  async allocateTimestampedMocPath(basePath) {
    const safeBasePath = this.resolveSafeMarkdownPath(basePath, "MOC");
    const baseWithoutExt = safeBasePath.replace(/\.md$/i, "");
    const stamp = formatBackupStamp(/* @__PURE__ */ new Date());
    let outputPath = (0, import_obsidian4.normalizePath)(`${baseWithoutExt}-${stamp}.md`);
    let suffix = 1;
    while (await this.app.vault.adapter.exists(outputPath)) {
      outputPath = (0, import_obsidian4.normalizePath)(`${baseWithoutExt}-${stamp}-${suffix}.md`);
      suffix += 1;
    }
    return outputPath;
  }
  async allocateLocalQaThreadPath(threadId) {
    const folder = this.resolveSafeFolderPath(
      this.settings.chatTranscriptRootPath,
      "Omni Forge Chats",
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
    const exportMessages = this.settings.qaShowSystemMessages ? messages : messages.filter((message) => message.role !== "system");
    const qaModel = this.getQaModelLabelForQa();
    const embeddingModel = this.getQaEmbeddingModelForQa();
    const selectedFiles = this.getSelectedFilesForQa().map((file) => file.path);
    const selectedFolders = this.getSelectedFolderPathsForQa().sort(
      (a, b) => a.localeCompare(b)
    );
    const topSourcePaths = this.collectTopSourcePaths(
      exportMessages,
      Math.max(1, this.settings.qaTopK)
    );
    const turns = exportMessages.filter(
      (item) => item.role === "user" || item.role === "assistant"
    );
    const lines = [];
    lines.push("---");
    lines.push('type: "omni-forge-chat"');
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
    for (const message of exportMessages) {
      if (message.role === "system") {
        lines.push(`> [!note]- System (${message.timestamp})`);
        for (const line of message.text.split(/\r?\n/)) {
          lines.push(`> ${line}`);
        }
        lines.push("");
        continue;
      }
      if (message.role === "thinking") {
        lines.push(`> [!abstract]- Thinking (${message.timestamp})`);
        for (const line of message.text.split(/\r?\n/)) {
          lines.push(`> ${line}`);
        }
        lines.push("");
        continue;
      }
      const label = message.role === "assistant" ? "Assistant" : "User";
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
      if (options.autoApply && detected.recommended) {
        const current = this.settings.ollamaModel.trim();
        if (current !== detected.recommended) {
          this.settings.ollamaModel = detected.recommended;
          this.settings.qaOllamaModel = detected.recommended;
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
      if (options.autoApply && detected.recommended) {
        const current = this.settings.semanticOllamaModel.trim();
        if (current !== detected.recommended) {
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
    if (this.settings.settingsViewMode !== "simple" && this.settings.settingsViewMode !== "full") {
      this.settings.settingsViewMode = DEFAULT_SETTINGS.settingsViewMode;
    }
    this.settings.settingsViewMode = "full";
    if (this.settings.settingsUiLanguage !== "ko" && this.settings.settingsUiLanguage !== "en" && this.settings.settingsUiLanguage !== "bilingual") {
      this.settings.settingsUiLanguage = DEFAULT_SETTINGS.settingsUiLanguage;
    }
    if (this.settings.settingsActiveTab !== "quick" && this.settings.settingsActiveTab !== "analyzed" && this.settings.settingsActiveTab !== "chat" && this.settings.settingsActiveTab !== "orchestration" && this.settings.settingsActiveTab !== "skills" && this.settings.settingsActiveTab !== "parser" && this.settings.settingsActiveTab !== "guide") {
      this.settings.settingsActiveTab = DEFAULT_SETTINGS.settingsActiveTab;
    }
    if (this.settings.settingsActiveTab === "models") {
      this.settings.settingsActiveTab = "chat";
    }
    if (this.settings.settingsActiveTab === "workflow") {
      this.settings.settingsActiveTab = "analyzed";
    }
    if (this.settings.settingsActiveTab === "advanced") {
      this.settings.settingsActiveTab = "guide";
    }
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
    if (this.settings.qaChatModelFamily !== "local" && this.settings.qaChatModelFamily !== "cloud") {
      this.settings.qaChatModelFamily = DEFAULT_SETTINGS.qaChatModelFamily;
    }
    if (typeof this.settings.qaChatModelProfile !== "string") {
      this.settings.qaChatModelProfile = DEFAULT_SETTINGS.qaChatModelProfile;
    }
    const localProfiles = /* @__PURE__ */ new Set(["local-flash", "local-pro"]);
    const cloudProfiles = /* @__PURE__ */ new Set(["codex", "claude", "gemini"]);
    const allowedProfiles = this.settings.qaChatModelFamily === "cloud" ? cloudProfiles : localProfiles;
    if (!allowedProfiles.has(this.settings.qaChatModelProfile)) {
      this.settings.qaChatModelProfile = this.settings.qaChatModelFamily === "cloud" ? "codex" : "local-flash";
    }
    if (!Number.isFinite(this.settings.qaChatFontSize)) {
      this.settings.qaChatFontSize = DEFAULT_SETTINGS.qaChatFontSize;
    }
    this.settings.qaChatFontSize = Math.max(
      11,
      Math.min(22, Math.floor(this.settings.qaChatFontSize))
    );
    if (typeof this.settings.qaShowSystemMessages !== "boolean") {
      this.settings.qaShowSystemMessages = DEFAULT_SETTINGS.qaShowSystemMessages;
    }
    if (typeof this.settings.semanticAutoPickEnabled !== "boolean") {
      this.settings.semanticAutoPickEnabled = DEFAULT_SETTINGS.semanticAutoPickEnabled;
    }
    if (typeof this.settings.qaAllowNonLocalEndpoint !== "boolean") {
      this.settings.qaAllowNonLocalEndpoint = DEFAULT_SETTINGS.qaAllowNonLocalEndpoint;
    }
    if (this.settings.qaChatModelFamily === "cloud" && !this.settings.qaAllowNonLocalEndpoint) {
      this.settings.qaAllowNonLocalEndpoint = true;
    }
    if (typeof this.settings.qaAllowedOutboundHosts !== "string") {
      this.settings.qaAllowedOutboundHosts = DEFAULT_SETTINGS.qaAllowedOutboundHosts;
    }
    if (this.settings.qaChatModelFamily === "cloud") {
      const cloudBase = toOpenAICompatibleBase(this.settings.openAIBaseUrl.trim() || DEFAULT_SETTINGS.openAIBaseUrl);
      if (!this.settings.qaOllamaBaseUrl.trim()) {
        this.settings.qaOllamaBaseUrl = cloudBase;
      }
      this.appendQaAllowedOutboundHostFromUrl(this.settings.qaOllamaBaseUrl || cloudBase);
    } else if (this.settings.qaOllamaModel.trim()) {
      this.syncQaCloudFamilyFromModelHint(this.settings.qaOllamaModel.trim());
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
    const presetProfile = this.settings.qaLocalPresetProfile;
    if (presetProfile !== "fast_local" && presetProfile !== "balanced_local" && presetProfile !== "quality_local" && presetProfile !== "custom") {
      this.settings.qaLocalPresetProfile = DEFAULT_SETTINGS.qaLocalPresetProfile;
    }
    if (this.settings.qaConversationMode !== "ask" && this.settings.qaConversationMode !== "plan" && this.settings.qaConversationMode !== "agent" && this.settings.qaConversationMode !== "orchestration") {
      this.settings.qaConversationMode = DEFAULT_SETTINGS.qaConversationMode;
    }
    if (typeof this.settings.qaQuickCustomProfileSlot1 !== "string") {
      this.settings.qaQuickCustomProfileSlot1 = DEFAULT_SETTINGS.qaQuickCustomProfileSlot1;
    }
    if (typeof this.settings.qaQuickCustomProfileSlot2 !== "string") {
      this.settings.qaQuickCustomProfileSlot2 = DEFAULT_SETTINGS.qaQuickCustomProfileSlot2;
    }
    if (typeof this.settings.qaQuickCustomProfileSlot3 !== "string") {
      this.settings.qaQuickCustomProfileSlot3 = DEFAULT_SETTINGS.qaQuickCustomProfileSlot3;
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
    if (typeof this.settings.qaDebuggerModel !== "string") {
      this.settings.qaDebuggerModel = DEFAULT_SETTINGS.qaDebuggerModel;
    }
    if (!this.settings.qaDebuggerModel.trim() && this.settings.qaCoderModel.trim()) {
      this.settings.qaDebuggerModel = this.settings.qaCoderModel.trim();
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
    if (typeof this.settings.qaBalancedPresetBaseModel !== "string") {
      this.settings.qaBalancedPresetBaseModel = DEFAULT_SETTINGS.qaBalancedPresetBaseModel;
    }
    if (typeof this.settings.qaBalancedPresetVisionModel !== "string") {
      this.settings.qaBalancedPresetVisionModel = DEFAULT_SETTINGS.qaBalancedPresetVisionModel;
    }
    if (typeof this.settings.qaBalancedPresetEmbeddingModel !== "string") {
      this.settings.qaBalancedPresetEmbeddingModel = DEFAULT_SETTINGS.qaBalancedPresetEmbeddingModel;
    }
    if (typeof this.settings.qaQualityPresetBaseModel !== "string") {
      this.settings.qaQualityPresetBaseModel = DEFAULT_SETTINGS.qaQualityPresetBaseModel;
    }
    if (typeof this.settings.qaQualityPresetVisionModel !== "string") {
      this.settings.qaQualityPresetVisionModel = DEFAULT_SETTINGS.qaQualityPresetVisionModel;
    }
    if (typeof this.settings.qaQualityPresetEmbeddingModel !== "string") {
      this.settings.qaQualityPresetEmbeddingModel = DEFAULT_SETTINGS.qaQualityPresetEmbeddingModel;
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
    const promptFields = [
      "qaCustomSystemPrompt",
      "qaAskSystemPrompt",
      "qaAskVisionSystemPrompt",
      "qaImageGeneratorSystemPrompt",
      "qaCoderSystemPrompt",
      "qaDebuggerSystemPrompt",
      "qaArchitectSystemPrompt",
      "qaOrchestratorSystemPrompt",
      "qaSafeguardSystemPrompt"
    ];
    const hasAnyPromptValue = promptFields.some((field) => {
      const value = this.settings[field];
      return typeof value === "string" && value.trim().length > 0;
    });
    if (!hasAnyPromptValue) {
      this.settings.qaCustomSystemPrompt = DEFAULT_SETTINGS.qaCustomSystemPrompt;
      this.settings.qaAskSystemPrompt = DEFAULT_SETTINGS.qaAskSystemPrompt;
      this.settings.qaAskVisionSystemPrompt = DEFAULT_SETTINGS.qaAskVisionSystemPrompt;
      this.settings.qaImageGeneratorSystemPrompt = DEFAULT_SETTINGS.qaImageGeneratorSystemPrompt;
      this.settings.qaCoderSystemPrompt = DEFAULT_SETTINGS.qaCoderSystemPrompt;
      this.settings.qaDebuggerSystemPrompt = DEFAULT_SETTINGS.qaDebuggerSystemPrompt;
      this.settings.qaArchitectSystemPrompt = DEFAULT_SETTINGS.qaArchitectSystemPrompt;
      this.settings.qaOrchestratorSystemPrompt = DEFAULT_SETTINGS.qaOrchestratorSystemPrompt;
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
    if (typeof this.settings.qaPdfAttachmentEnabled !== "boolean") {
      this.settings.qaPdfAttachmentEnabled = DEFAULT_SETTINGS.qaPdfAttachmentEnabled;
    }
    if (typeof this.settings.qaAgentToolModeEnabled !== "boolean") {
      this.settings.qaAgentToolModeEnabled = DEFAULT_SETTINGS.qaAgentToolModeEnabled;
    }
    if (typeof this.settings.qaAgentRequireApproval !== "boolean") {
      this.settings.qaAgentRequireApproval = DEFAULT_SETTINGS.qaAgentRequireApproval;
    }
    if (typeof this.settings.qaAgentAllowShellTool !== "boolean") {
      this.settings.qaAgentAllowShellTool = DEFAULT_SETTINGS.qaAgentAllowShellTool;
    }
    if (typeof this.settings.qaAgentShellFullAccess !== "boolean") {
      this.settings.qaAgentShellFullAccess = DEFAULT_SETTINGS.qaAgentShellFullAccess;
    }
    if (!Number.isFinite(this.settings.qaAgentShellTimeoutSec)) {
      this.settings.qaAgentShellTimeoutSec = DEFAULT_SETTINGS.qaAgentShellTimeoutSec;
    }
    this.settings.qaAgentShellTimeoutSec = Math.max(
      3,
      Math.min(300, Math.floor(this.settings.qaAgentShellTimeoutSec))
    );
    if (typeof this.settings.qaAgentShellCwdPath !== "string") {
      this.settings.qaAgentShellCwdPath = DEFAULT_SETTINGS.qaAgentShellCwdPath;
    }
    if (typeof this.settings.qaAgentPathAllowlist !== "string") {
      this.settings.qaAgentPathAllowlist = DEFAULT_SETTINGS.qaAgentPathAllowlist;
    }
    if (typeof this.settings.qaContextInChat !== "boolean") {
      this.settings.qaContextInChat = DEFAULT_SETTINGS.qaContextInChat;
    }
    if (this.settings.qaParserMode !== "fast" && this.settings.qaParserMode !== "detailed") {
      this.settings.qaParserMode = DEFAULT_SETTINGS.qaParserMode;
    }
    this.settings.qaPdfAttachmentEnabled = true;
    if (typeof this.settings.qaAttachmentIngestRootPath !== "string") {
      this.settings.qaAttachmentIngestRootPath = DEFAULT_SETTINGS.qaAttachmentIngestRootPath;
    }
    this.settings.qaAttachmentIngestRootPath = (0, import_obsidian4.normalizePath)(
      this.settings.qaAttachmentIngestRootPath.trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath
    );
    if (typeof this.settings.qaSkillsRootPath !== "string") {
      this.settings.qaSkillsRootPath = DEFAULT_SETTINGS.qaSkillsRootPath;
    }
    if (this.settings.qaAgentShellCwdPath.trim()) {
      try {
        this.settings.qaAgentShellCwdPath = this.sanitizeQaShellCwdPath(
          this.settings.qaAgentShellCwdPath
        );
      } catch (e) {
        this.settings.qaAgentShellCwdPath = DEFAULT_SETTINGS.qaAgentShellCwdPath;
      }
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
    (_a = this.statusBarEl) == null ? void 0 : _a.setText(`Omni Forge: ${text}`);
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
      `${this.app.vault.configDir}/plugins/omni-forge/${ANALYSIS_CACHE_FILE}`
    );
  }
  getSelectionDiffAuditLogPath() {
    return (0, import_obsidian4.normalizePath)(
      `${this.app.vault.configDir}/plugins/omni-forge/logs/${SELECTION_DIFF_AUDIT_LOG_FILE}`
    );
  }
  async appendSelectionDiffAuditLog(entry) {
    const payload = entry && typeof entry === "object" ? entry : {};
    const line = `${JSON.stringify(payload)}
`;
    const path = this.getSelectionDiffAuditLogPath();
    try {
      await this.ensureParentFolder(path);
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) {
        await this.app.vault.adapter.write(path, line);
        return;
      }
      const previous = await this.app.vault.adapter.read(path);
      await this.app.vault.adapter.write(path, `${previous}${line}`);
    } catch (error) {
    }
  }
  async cleanupLegacyCacheArtifacts() {
    const legacyFiles = [
      (0, import_obsidian4.normalizePath)("Omni Forge Cache/analysis-proposal-cache.json"),
      (0, import_obsidian4.normalizePath)("Omni Forge Cache/semantic-embedding-cache.json")
    ];
    for (const path of legacyFiles) {
      try {
        if (await this.app.vault.adapter.exists(path)) {
          await this.app.vault.adapter.remove(path);
        }
      } catch (e) {
      }
    }
    const legacyFolder = (0, import_obsidian4.normalizePath)("Omni Forge Cache");
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
  parseFrontmatterBlockFromContent(content) {
    const normalized = (content != null ? content : "").replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    if (lines.length === 0 || lines[0].trim() !== "---") {
      return {
        normalizedText: normalized,
        exists: false,
        valid: true,
        error: "",
        frontmatter: {},
        blockText: "",
        bodyStartOffset: 0,
        bodyText: normalized
      };
    }
    let end = -1;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === "---") {
        end = i;
        break;
      }
    }
    if (end < 1) {
      return {
        normalizedText: normalized,
        exists: true,
        valid: false,
        error: "Unclosed frontmatter block.",
        frontmatter: {},
        blockText: normalized,
        bodyStartOffset: normalized.length,
        bodyText: ""
      };
    }
    let bodyStartOffset = 0;
    for (let i = 0; i <= end; i += 1) {
      bodyStartOffset += lines[i].length;
      if (i < lines.length - 1) {
        bodyStartOffset += 1;
      }
    }
    const blockText = normalized.slice(0, bodyStartOffset);
    const bodyText = normalized.slice(bodyStartOffset);
    const yamlRaw = lines.slice(1, end).join("\n").trim();
    if (!yamlRaw) {
      return {
        normalizedText: normalized,
        exists: true,
        valid: true,
        error: "",
        frontmatter: {},
        blockText,
        bodyStartOffset,
        bodyText
      };
    }
    try {
      const parsed = (0, import_obsidian4.parseYaml)(yamlRaw);
      const frontmatter = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      return {
        normalizedText: normalized,
        exists: true,
        valid: true,
        error: "",
        frontmatter,
        blockText,
        bodyStartOffset,
        bodyText
      };
    } catch (error) {
      return {
        normalizedText: normalized,
        exists: true,
        valid: false,
        error: "Frontmatter YAML parse failed.",
        frontmatter: {},
        blockText,
        bodyStartOffset,
        bodyText
      };
    }
  }
  dedupeFrontmatterStringArray(values) {
    const seen = /* @__PURE__ */ new Set();
    const output = [];
    for (const value of values) {
      const normalized = value.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      output.push(normalized);
    }
    return output;
  }
  pickFrontmatterSingleString(value) {
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : void 0;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== "string") {
          continue;
        }
        const normalized = item.trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }
    return void 0;
  }
  pickFrontmatterSingleIndex(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return this.pickFrontmatterSingleString(value);
  }
  normalizeFrontmatterGuardRecord(rawFrontmatter, createdValue, updatedIso) {
    const source = rawFrontmatter && typeof rawFrontmatter === "object" && !Array.isArray(rawFrontmatter) ? rawFrontmatter : {};
    const next = {};
    const linked = this.dedupeFrontmatterStringArray(toStringArray(source.linked));
    if (linked.length > 0) {
      next.linked = linked;
    }
    const tags = this.dedupeFrontmatterStringArray(toStringArray(source.tags));
    if (tags.length > 0) {
      next.tags = tags;
    }
    const topic = this.pickFrontmatterSingleString(source.topic);
    if (topic) {
      next.topic = topic;
    }
    const index = this.pickFrontmatterSingleIndex(source.index);
    if (index !== void 0) {
      next.index = index;
    }
    if (createdValue !== void 0 && createdValue !== null) {
      if (typeof createdValue === "string") {
        const created = createdValue.trim();
        if (created.length > 0) {
          next.created = created;
        }
      } else if (typeof createdValue === "number" && Number.isFinite(createdValue)) {
        next.created = createdValue;
      } else if (typeof createdValue === "boolean") {
        next.created = createdValue;
      }
    }
    next.updated = updatedIso;
    return next;
  }
  formatFrontmatterGuardScalar(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (value === null) {
      return "null";
    }
    return JSON.stringify(String(value));
  }
  renderFrontmatterGuardBlock(frontmatter) {
    const lines = [];
    for (const key of FRONTMATTER_GUARD_ALLOWED_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) {
        continue;
      }
      const value = frontmatter[key];
      if (Array.isArray(value)) {
        const normalized = this.dedupeFrontmatterStringArray(
          value.map((item) => typeof item === "string" ? item : String(item))
        );
        if (normalized.length === 0) {
          continue;
        }
        lines.push(`${key}:`);
        for (const item of normalized) {
          lines.push(`  - ${this.formatFrontmatterGuardScalar(item)}`);
        }
        continue;
      }
      if (value === void 0) {
        continue;
      }
      lines.push(`${key}: ${this.formatFrontmatterGuardScalar(value)}`);
    }
    if (lines.length === 0) {
      return `---\n---`;
    }
    return `---\n${lines.join("\n")}\n---`;
  }
  runFrontmatterLintGuardAfterPatch(params) {
    const mode = params.mode === "selection" ? "selection" : "default";
    const beforeInfo = this.parseFrontmatterBlockFromContent(params.beforeText);
    const patchedInfo = this.parseFrontmatterBlockFromContent(params.patchedText);
    if (!beforeInfo.valid) {
      return {
        ok: false,
        error: "FrontmatterGuard blocked: current frontmatter YAML is invalid. Fix frontmatter and retry."
      };
    }
    if (!patchedInfo.valid) {
      return {
        ok: false,
        error: "FrontmatterGuard blocked: patched frontmatter YAML is invalid. Regenerate patch."
      };
    }
    const frontmatterChangedByPatch = beforeInfo.blockText !== patchedInfo.blockText;
    if (mode === "selection" && frontmatterChangedByPatch) {
      return {
        ok: false,
        error: "Selection mode blocks frontmatter edits. Regenerate patch without frontmatter changes."
      };
    }
    const beforeRecord = beforeInfo.frontmatter && typeof beforeInfo.frontmatter === "object" && !Array.isArray(beforeInfo.frontmatter) ? beforeInfo.frontmatter : {};
    const createdValue = Object.prototype.hasOwnProperty.call(beforeRecord, "created") ? beforeRecord.created : void 0;
    const normalizedRecord = this.normalizeFrontmatterGuardRecord(
      beforeRecord,
      createdValue,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    for (const key of Object.keys(normalizedRecord)) {
      if (!FRONTMATTER_GUARD_ALLOWED_KEY_SET.has(key)) {
        delete normalizedRecord[key];
      }
    }
    const frontmatterBlock = this.renderFrontmatterGuardBlock(normalizedRecord);
    const bodyWithoutLeadingBreak = patchedInfo.bodyText.replace(/^\n/, "");
    const guardedText = `${frontmatterBlock}\n${bodyWithoutLeadingBreak}`;
    const guardedInfo = this.parseFrontmatterBlockFromContent(guardedText);
    if (!guardedInfo.valid) {
      return {
        ok: false,
        error: "FrontmatterGuard failed to produce valid frontmatter YAML."
      };
    }
    return {
      ok: true,
      text: guardedInfo.normalizedText,
      beforeBodyStartOffset: patchedInfo.bodyStartOffset,
      finalBodyStartOffset: guardedInfo.bodyStartOffset,
      bodyOffsetDelta: guardedInfo.bodyStartOffset - patchedInfo.bodyStartOffset,
      frontmatterChangedByPatch,
      guardApplied: guardedInfo.normalizedText !== patchedInfo.normalizedText
    };
  }
  mapOffsetAfterFrontmatterGuard(offset, beforeBodyStartOffset, bodyOffsetDelta) {
    const baseOffset = Number.isFinite(offset) ? Math.floor(offset) : 0;
    if (baseOffset >= beforeBodyStartOffset) {
      return baseOffset + bodyOffsetDelta;
    }
    return baseOffset;
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
  parseQaAllowedOutboundHosts() {
    return this.settings.qaAllowedOutboundHosts.split(/[\n,]/g).map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
  }
  isHostAllowedByPolicy(hostname, allowlist) {
    const host = hostname.trim().toLowerCase();
    if (!host) {
      return false;
    }
    return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }
  validateQaEndpointPolicy(qaBaseUrl) {
    if (this.isLocalEndpoint(qaBaseUrl)) {
      return null;
    }
    if (!this.settings.qaAllowNonLocalEndpoint) {
      return "Blocked by security policy: Q&A endpoint must be localhost unless explicitly allowed.";
    }
    let parsed;
    try {
      parsed = new URL(qaBaseUrl);
    } catch (e) {
      return `Blocked by security policy: invalid Q&A endpoint URL (${qaBaseUrl}).`;
    }
    const hostAllowlist = this.parseQaAllowedOutboundHosts();
    if (hostAllowlist.length === 0) {
      return "Blocked by security policy: non-local endpoint is enabled but outbound host allowlist is empty.";
    }
    if (!this.isHostAllowedByPolicy(parsed.hostname, hostAllowlist)) {
      return `Blocked by security policy: host '${parsed.hostname}' is not in outbound allowlist.`;
    }
    return null;
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
  normalizeQaOpenSelectionContext(rawSelection, openFilePath = "") {
    if (!rawSelection || typeof rawSelection !== "object") {
      return null;
    }
    const openPath = (0, import_obsidian4.normalizePath)((openFilePath != null ? openFilePath : "").trim());
    const filePath = (0, import_obsidian4.normalizePath)(
      (typeof rawSelection.filePath === "string" ? rawSelection.filePath : openPath).trim()
    );
    if (!filePath || !this.isSafeVaultRelativePath(filePath)) {
      return null;
    }
    if (openPath && filePath !== openPath) {
      return null;
    }
    const fromOffset = Math.floor(Number(rawSelection.fromOffset));
    const toOffset = Math.floor(Number(rawSelection.toOffset));
    if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
      return null;
    }
    if (fromOffset < 0 || toOffset <= fromOffset) {
      return null;
    }
    const selectedText = typeof rawSelection.selectedText === "string" ? rawSelection.selectedText : "";
    if (!selectedText) {
      return null;
    }
    const capturedAt = typeof rawSelection.capturedAt === "string" ? rawSelection.capturedAt : (/* @__PURE__ */ new Date()).toISOString();
    const selectionHash = this.hashString(`${filePath}
${selectedText}`);
    return {
      filePath,
      fromOffset,
      toOffset,
      selectedText,
      selectionHash,
      capturedAt
    };
  }
  classifyTaskForQa(question, context) {
    const normalized = question.toLowerCase();
    if (context.hasSelection) {
      return "EDIT_NOTE";
    }
    if (/(pdf|xlsx|excel|엑셀|변환|convert|parser|파서|ingest)/i.test(normalized)) {
      return "DOC_PIPELINE";
    }
    if (/(링크|연결|graph|autolink|linking)/i.test(normalized)) {
      return "AUTOLINK_GRAPH";
    }
    if (/(요약|정리|summary|summarize)/i.test(normalized)) {
      return "QA_CHAT";
    }
    if (/(만들어|게임|프로젝트|build|create|project|prototype)/i.test(normalized)) {
      return "GENERATE_PROJECT";
    }
    if (/(export|내보내기|출력|ppt|pdf\s*출력)/i.test(normalized)) {
      return "EXPORT";
    }
    return "QA_CHAT";
  }
  resolveTaskRolePipelineForQa(taskType) {
    const configured = ROUTER_TASK_ROLE_PIPELINE[taskType];
    if (Array.isArray(configured) && configured.length > 0) {
      return [...configured];
    }
    return [...ROUTER_TASK_ROLE_PIPELINE.QA_CHAT];
  }
  mapTaskRolesToStagesForQa(roles) {
    const stages = [];
    for (const role of roles) {
      const stage = ROUTER_ROLE_STAGE_MAP[role];
      if (!stage) {
        continue;
      }
      if (!stages.includes(stage)) {
        stages.push(stage);
      }
    }
    return stages;
  }
  resolveRouterRoleModelForQa(role, qaModel) {
    const priorities = ROUTER_ROLE_MODEL_PRIORITY[role] || ["ask"];
    for (let index = 0; index < priorities.length; index += 1) {
      const roleKey = priorities[index];
      const model = this.resolveQaModelForRole(roleKey).trim();
      if (!model) {
        continue;
      }
      return {
        model,
        roleKey,
        usedFallback: index > 0
      };
    }
    return {
      model: qaModel,
      roleKey: "ask",
      usedFallback: true
    };
  }
  buildTaskRoutingForQa(question, context, qaModel) {
    const taskType = this.classifyTaskForQa(question, context);
    const roles = this.resolveTaskRolePipelineForQa(taskType);
    const modelUsed = [];
    let fallbackUsed = false;
    for (const role of roles) {
      const resolved = this.resolveRouterRoleModelForQa(role, qaModel);
      if (resolved.model) {
        modelUsed.push(resolved.model);
      }
      if (resolved.usedFallback) {
        fallbackUsed = true;
      }
    }
    return {
      taskType,
      roles,
      stages: this.mapTaskRolesToStagesForQa(roles),
      modelUsed: [...new Set(modelUsed)],
      fallbackUsed,
      safeguardPassed: false
    };
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
  getQaConversationModeInstruction() {
    switch (this.settings.qaConversationMode) {
      case "plan":
        return "Conversation mode: Plan. Prioritize execution checklist, sequencing, and risk-aware planning.";
      case "agent":
        return "Conversation mode: Agent. When user asks to create/edit files or run commands, propose executable omni-forge-actions JSON.";
      case "orchestration":
        return "Conversation mode: Orchestration. Coordinate sub-roles and produce build-ready artifacts; include runnable code for software/game tasks.";
      case "ask":
      default:
        return "Conversation mode: Ask. Provide direct, source-grounded answers with practical clarity.";
    }
  }
  getQaContractLines(intent, preferDetailed, mode = this.settings.qaConversationMode, question = "") {
    const normalizedMode = mode === "plan" || mode === "agent" || mode === "orchestration" ? mode : "ask";
    const gameBuildRequested = this.matchesGameBuildIntent(question);
    if (intent === "sources_only") {
      return [
        "Output contract:",
        "- Return source links only (bullet list).",
        "- No extra narrative unless required for missing evidence."
      ];
    }
    if (normalizedMode === "agent") {
      return [
        "Output contract (Agent mode):",
        "- If user requests file/system actions, include exactly ONE `omni-forge-actions` code block with strict JSON.",
        "- Prefer concrete actions (`write_note`, `append_note`, `delete_note`, `read_note`, `list_folder`, `run_shell`) over long prose.",
        "- Keep non-action explanation short and operational.",
        "- If no action is needed, respond concisely without action block."
      ];
    }
    if (normalizedMode === "orchestration") {
      const gameLine = gameBuildRequested ? "- For game requests, include a minimal playable loop, file structure, and run/test commands." : "- Include implementation artifacts (file layout + runnable code) whenever coding is requested.";
      return [
        "Output contract (Orchestration mode):",
        "- Start with objective/scope in 2-3 sentences.",
        "- Provide phased execution plan with dependencies and completion criteria.",
        "- Include role routing summary (architect/coder/debugger/safeguard).",
        gameLine,
        "- End with immediate next 3 actions."
      ];
    }
    if (normalizedMode === "plan" || intent === "plan") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence overview.",
        "- Include a checklist using '- [ ]' format.",
        "- Add priority or order hints for each checklist item.",
        "- Add short rationale for critical steps and risks."
      ];
    }
    if (intent === "comparison") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence conclusion.",
        "- Include at least one markdown table for comparison.",
        "- After the table, add key trade-offs and recommendation.",
        "- If information is missing, fill with '\uC815\uBCF4 \uBD80\uC871' and explain briefly."
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
    return sourceBlocks.map((item, index) => {
      const sourceType = item.path.startsWith("[ATTACHMENT-") || item.content.startsWith("Attachment document (PRIMARY EVIDENCE)") ? "attachment" : "selected-note";
      return `Source ${index + 1}
Type: ${sourceType}
Path: ${item.path}
Similarity: ${formatSimilarity(item.similarity)}
Content:
${item.content}`;
    }).join("\n\n---\n\n");
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
  matchesGameBuildIntent(question) {
    const normalized = question.toLowerCase();
    return /(학습\s*게임|게임\s*개발|게임\s*만들|게임\s*구현|게임용\s*앱|게임\s*앱|앱\s*만들|앱\s*개발|game\s*(design|dev|development|prototype|build|loop|app)|build\s*(a\s*)?game|create\s*(a\s*)?game|simple\s*game|pygame|phaser|unity|godot)/i.test(
      normalized
    );
  }
  isGameBuildTask(question) {
    return this.matchesGameBuildIntent(question);
  }
  isLikelyAgentMutationTask(question) {
    const normalized = question.toLowerCase();
    if (/(frontmatter|yaml|메타데이터|속성값)/i.test(normalized)) {
      return true;
    }
    return /(삭제|지워|제거|수정|편집|바꿔|변경|추가|생성|작성|만들|저장|이동|복사|rename|remove|delete|edit|modify|update|write|append|create|implement|build|generate)/i.test(
      normalized
    );
  }
  hasMutatingQaActionInAnswer(answer, question, qaModel) {
    const parsed = this.parseQaAgentActionPlanFromAnswer({
      answer,
      question,
      model: qaModel
    });
    if (!parsed.plan) {
      return false;
    }
    return parsed.plan.actions.some(
      (action) => action.type === "write_note" || action.type === "append_note" || action.type === "delete_note" || action.type === "apply_selection_diff" || action.type === "run_shell"
    );
  }
  parseSelectionDiffContractDiff(rawDiffText) {
    const raw = (rawDiffText != null ? rawDiffText : "").replace(/\r\n/g, "\n");
    const rawTrimmed = raw.trim();
    if (!rawTrimmed) {
      return {
        ok: false,
        error: "diff is empty."
      };
    }
    if (/^```/m.test(rawTrimmed)) {
      return {
        ok: false,
        error: "Diff-only contract violation: markdown code fences are not allowed."
      };
    }
    const normalized = this.normalizeUnifiedDiffText(rawDiffText);
    if (!normalized) {
      return {
        ok: false,
        error: "diff is empty."
      };
    }
    const lines = normalized.split("\n");
    const headerCount = lines.reduce(
      (count, line) => count + (line.trim() === CODER_PROMPT_CONTRACT_SELECTION_HEADER ? 1 : 0),
      0
    );
    if (headerCount !== 1) {
      return {
        ok: false,
        error: `Diff header must appear exactly once: ${CODER_PROMPT_CONTRACT_SELECTION_HEADER}.`
      };
    }
    let firstNonEmptyIndex = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].trim().length > 0) {
        firstNonEmptyIndex = index;
        break;
      }
    }
    if (firstNonEmptyIndex < 0 || lines[firstNonEmptyIndex].trim() !== CODER_PROMPT_CONTRACT_SELECTION_HEADER) {
      return {
        ok: false,
        error: `Diff header must be ${CODER_PROMPT_CONTRACT_SELECTION_HEADER}.`
      };
    }
    const bodyLines = lines.slice(firstNonEmptyIndex + 1);
    while (bodyLines.length > 0 && bodyLines[0].trim().length === 0) {
      bodyLines.shift();
    }
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim().length === 0) {
      bodyLines.pop();
    }
    if (bodyLines.length === 0) {
      return {
        ok: false,
        error: "No @@ hunk found in unified diff."
      };
    }
    if (!bodyLines[0].startsWith("@@")) {
      return {
        ok: false,
        error: "Unified diff must start with @@ hunk after CURRENT_SELECTION header."
      };
    }
    const pathHeaderPattern = /^(diff --git\s|index\s+[0-9a-f]+\.\.[0-9a-f]+|---\s+\S|\+\+\+\s+\S)/i;
    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (pathHeaderPattern.test(trimmed)) {
        return {
          ok: false,
          error: "Path-based multi-file diff is not allowed."
        };
      }
      if (line.startsWith("@@")) {
        continue;
      }
      if (line.startsWith("\\ No newline at end of file")) {
        continue;
      }
      const prefix = line.slice(0, 1);
      if (prefix === " " || prefix === "+" || prefix === "-") {
        continue;
      }
      return {
        ok: false,
        error: "Diff-only contract violation: non-diff text detected."
      };
    }
    const diffBody = bodyLines.join("\n");
    const parsedDiff = this.parseUnifiedDiffHunks(diffBody);
    if (parsedDiff.error) {
      return {
        ok: false,
        error: parsedDiff.error
      };
    }
    return {
      ok: true,
      diffBody,
      diffWithHeader: `${CODER_PROMPT_CONTRACT_SELECTION_HEADER}
${diffBody}`,
      parsedDiff
    };
  }
  detectFrontmatterMutationInSelectionDiff(selectionText, diffBody, parsedDiff = null) {
    const applied = this.applySelectionPatchWithPatchApplier(
      selectionText != null ? selectionText : "",
      diffBody,
      parsedDiff
    );
    if (!applied.ok) {
      return {
        ok: false,
        error: applied.error || "Failed to apply unified diff to selection."
      };
    }
    const guardResult = this.runFrontmatterLintGuardAfterPatch({
      beforeText: selectionText != null ? selectionText : "",
      patchedText: applied.text,
      mode: "selection"
    });
    if (!guardResult.ok) {
      return {
        ok: false,
        error: guardResult.error || "Frontmatter changes are blocked in selection mode."
      };
    }
    return {
      ok: true,
      applyMode: applied.mode || "strict",
      changedLines: applied.changedLines
    };
  }
  validateSelectionDiffActionAgainstOpenSelection(action, openSelection) {
    if (!openSelection) {
      return {
        ok: false,
        error: "apply_selection_diff requires active open selection context."
      };
    }
    if (!action || action.type !== "apply_selection_diff") {
      return {
        ok: false,
        error: "Action type must be apply_selection_diff."
      };
    }
    const scopeRoot = (0, import_obsidian4.normalizePath)(nodePath.posix.dirname(openSelection.filePath || "") || ".");
    const scopedVault = new ScopedVault([scopeRoot]);
    let normalizedPath = openSelection.filePath;
    try {
      normalizedPath = scopedVault.assertPathInScope(
        (action.path != null ? action.path : openSelection.filePath) || openSelection.filePath,
        "apply_selection_diff.path"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message
      };
    }
    if (normalizedPath !== openSelection.filePath) {
      return {
        ok: false,
        error: `apply_selection_diff path mismatch (${normalizedPath} != ${openSelection.filePath}).`
      };
    }
    const expectedHash = typeof action.expectedSelectionHash === "string" ? action.expectedSelectionHash.trim() : "";
    if (!expectedHash) {
      return {
        ok: false,
        error: "expectedSelectionHash is required."
      };
    }
    const currentHash = typeof openSelection.selectionHash === "string" ? openSelection.selectionHash.trim() : "";
    if (currentHash && expectedHash !== currentHash) {
      return {
        ok: false,
        error: "Selection hash mismatch. Re-open and reselect target range."
      };
    }
    const contractDiff = this.parseSelectionDiffContractDiff(action.diff || "");
    if (!contractDiff.ok) {
      return {
        ok: false,
        error: contractDiff.error || "Invalid unified diff."
      };
    }
    const rangeCheck = this.validateSelectionDiffRange(contractDiff.parsedDiff, openSelection.selectedText || "");
    if (!rangeCheck.ok) {
      return {
        ok: false,
        error: rangeCheck.error || "Diff exceeds selection range."
      };
    }
    const limits = this.resolveSelectionDiffLimits(action);
    const limitCheck = this.validateSelectionDiffLimits(contractDiff.parsedDiff, limits);
    if (!limitCheck.ok) {
      return {
        ok: false,
        error: limitCheck.error || "Diff exceeds patch limits.",
        limits,
        limitCheck
      };
    }
    const frontmatterCheck = this.detectFrontmatterMutationInSelectionDiff(
      openSelection.selectedText || "",
      contractDiff.diffBody,
      contractDiff.parsedDiff,
      { allowFuzzy: Boolean(action.allowFuzzy) }
    );
    if (!frontmatterCheck.ok) {
      return {
        ok: false,
        error: frontmatterCheck.error || "Frontmatter changes are blocked."
      };
    }
    return {
      ok: true,
      diffBody: contractDiff.diffBody,
      diffWithHeader: contractDiff.diffWithHeader,
      parsedDiff: contractDiff.parsedDiff,
      limits,
      limitCheck
    };
  }
  buildSelectionDiffActionAnswerFromContractDiff(openSelection, diffWithHeader) {
    const payload = {
      actions: [
        {
          type: "apply_selection_diff",
          path: openSelection.filePath,
          expectedSelectionHash: openSelection.selectionHash,
          diff: diffWithHeader,
          allowFuzzy: false,
          maxChangedLines: MAX_SELECTION_DIFF_CHANGED_LINES,
          maxHunks: MAX_SELECTION_DIFF_HUNKS
        }
      ]
    };
    return `\`\`\`omni-forge-actions
${JSON.stringify(payload, null, 2)}
\`\`\``;
  }
  hasValidSelectionDiffActionInAnswer(answer, question, qaModel, openSelection) {
    const parsed = this.parseQaAgentActionPlanFromAnswer({
      answer,
      question,
      model: qaModel
    });
    if (!parsed.plan || !openSelection) {
      return false;
    }
    if (parsed.answerWithoutPlan.trim().length > 0) {
      return false;
    }
    if (parsed.plan.actions.length !== 1) {
      return false;
    }
    const action = parsed.plan.actions[0];
    const validation = this.validateSelectionDiffActionAgainstOpenSelection(action, openSelection);
    return validation.ok;
  }
  hasRunnableGameScaffold(answer) {
    const hasCodeFence = /```[a-zA-Z0-9_-]*\n[\s\S]*?```/.test(answer);
    if (!hasCodeFence) {
      return false;
    }
    return /(파일\s*구조|file\s*structure|index\.html|main\.js|game\.js|app\.js|package\.json|실행\s*방법|run\s*command|npm\s+run|python\s+\w+\.py)/i.test(
      answer
    );
  }
  describeOrchestrationModelTrace(stages, baseModel) {
    const orderedRoles = ["orchestrator", "architect", "coder", "debugger", "safeguard"];
    const included = orderedRoles.filter((role) => stages.includes(role));
    const parts = [`base=${baseModel || "(empty)"}`];
    for (const role of included) {
      parts.push(`${role}=${this.resolveQaModelForRole(role) || baseModel || "(empty)"}`);
    }
    return parts.join(" | ");
  }
  async ensureAgentMutatingActionPlan(params) {
    const {
      question,
      draftAnswer,
      sourceBlocks,
      qaBaseUrl,
      qaModel,
      openFilePath,
      onEvent,
      abortSignal
    } = params;
    this.emitQaEvent(
      onEvent,
      "warning",
      "Agent mode: mutating intent detected but no executable mutation action found. Retrying action planner."
    );
    const activeLine = openFilePath ? `Active open markdown file: ${openFilePath}` : "Active open markdown file: (none)";
    const systemPrompt = [
      "You are an action planner for Obsidian file operations.",
      "Return markdown only.",
      "First include 1 short sentence in Korean.",
      "Then include exactly ONE `omni-forge-actions` fenced block with strict JSON.",
      "For mutating requests, include at least one of: write_note, append_note, delete_note, run_shell.",
      "Do NOT return read-only plans for edit/delete/create requests.",
      "If user says this note/current note/이 노트, use the active open markdown file path provided.",
      "Never emit multiple action blocks."
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      activeLine,
      "",
      "Current draft answer:",
      draftAnswer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks)
    ].join("\n");
    try {
      const completion = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history: [],
        onEvent,
        abortSignal
      });
      const split = splitThinkingBlocks(completion.answer);
      const candidate = split.answer.trim() || completion.answer.trim();
      if (!candidate) {
        this.emitQaEvent(onEvent, "warning", "Agent action retry returned empty output.");
        return draftAnswer;
      }
      if (!this.hasMutatingQaActionInAnswer(candidate, question, qaModel)) {
        this.emitQaEvent(
          onEvent,
          "warning",
          "Agent action retry still has no mutating action; keeping original answer."
        );
        return draftAnswer;
      }
      this.emitQaEvent(onEvent, "generation", "Agent action planner retry applied");
      return candidate;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown agent action retry error";
      this.emitQaEvent(onEvent, "warning", "Agent action retry failed", { detail: message });
      return draftAnswer;
    }
  }
  async ensureSelectionDiffActionPlan(params) {
    const {
      question,
      draftAnswer,
      sourceBlocks,
      qaBaseUrl,
      qaModel,
      openFilePath,
      openSelection,
      routingLog,
      onEvent,
      abortSignal
    } = params;
    if (!openSelection) {
      return draftAnswer;
    }
    if (this.hasValidSelectionDiffActionInAnswer(draftAnswer, question, qaModel, openSelection)) {
      return draftAnswer;
    }
    this.emitQaEvent(
      onEvent,
      "warning",
      "EDIT_NOTE task requires apply_selection_diff with unified diff. Retrying coder planner."
    );
    const coderPrimary = this.resolveRouterRoleModelForQa("Coder", qaModel).model || qaModel;
    const coderFallback = this.resolveRouterRoleModelForQa("Architect", qaModel).model;
    const attemptModels = [coderPrimary].filter((model) => typeof model === "string" && model.trim().length > 0);
    if (coderFallback && !attemptModels.includes(coderFallback)) {
      attemptModels.push(coderFallback);
    }
    if (attemptModels.length < 2 && qaModel && !attemptModels.includes(qaModel)) {
      attemptModels.push(qaModel);
    }
    if (attemptModels.length < 2 && attemptModels[0]) {
      attemptModels.push(attemptModels[0]);
    }
    const maxAttempts = Math.min(2, attemptModels.length);
    const selectionPreview = this.trimQaToolText(openSelection.selectedText, MAX_SELECTION_DIFF_CONTEXT_CHARS);
    const systemPrompt = [
      `You are Omni-Forge Coder running Coder Prompt Contract ${CODER_PROMPT_CONTRACT_VERSION} for EDIT_NOTE.`,
      "Output unified diff only.",
      "Do not output prose, JSON, explanation, or any non-diff text.",
      "Do not wrap output in markdown code fences.",
      "Use exactly one selection header line, then unified diff hunks.",
      `The first non-empty line MUST be ${CODER_PROMPT_CONTRACT_SELECTION_HEADER}.`,
      "After the header, output only @@ hunks with standard diff line prefixes (space/+/-).",
      "Path headers are forbidden: diff --git, index, ---, +++.",
      "Patch scope is CURRENT_SELECTION only.",
      "Frontmatter edits are forbidden. Regenerate patch without frontmatter changes.",
      "Do not emit multiple alternatives."
    ].join("\n");
    const userPrompt = [
      `[CODER_PROMPT_CONTRACT_${CODER_PROMPT_CONTRACT_VERSION}]`,
      "TASK=EDIT_NOTE",
      `ACTIVE_FILE=${openFilePath || openSelection.filePath}`,
      `SELECTION_FILE=${openSelection.filePath}`,
      `SELECTION_RANGE=${openSelection.fromOffset}-${openSelection.toOffset}`,
      `SELECTION_HASH=${openSelection.selectionHash}`,
      `HEADER=${CODER_PROMPT_CONTRACT_SELECTION_HEADER}`,
      `MAX_CHANGED_LINES=${MAX_SELECTION_DIFF_CHANGED_LINES}`,
      `MAX_HUNKS=${MAX_SELECTION_DIFF_HUNKS}`,
      "",
      "[REQUEST]",
      question,
      "",
      "[CURRENT_SELECTION]",
      "```text",
      selectionPreview,
      "```",
      "",
      "[SOURCE_EXCERPTS]",
      this.buildLocalQaSourceContext(sourceBlocks),
      "",
      "[OUTPUT_TEMPLATE]",
      `${CODER_PROMPT_CONTRACT_SELECTION_HEADER}`,
      "@@ -oldStart,oldCount +newStart,newCount @@",
      " <space/context>",
      "-old line",
      "+new line"
    ].join("\n");
    let lastCandidate = draftAnswer;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const model = attemptModels[attempt];
      if (!model) {
        continue;
      }
      if (attempt > 0 && routingLog && typeof routingLog === "object") {
        routingLog.fallbackUsed = true;
      }
      try {
        this.emitQaEvent(
          onEvent,
          "generation",
          `Selection-diff planner attempt ${attempt + 1}/${maxAttempts} (${model})`
        );
        const completion = await this.requestLocalQaCompletion({
          qaBaseUrl,
          qaModel: model,
          systemPrompt,
          userPrompt,
          history: [],
          onEvent,
          abortSignal
        });
        const split = splitThinkingBlocks(completion.answer);
        const candidate = split.answer.trim() || completion.answer.trim();
        if (!candidate) {
          continue;
        }
        lastCandidate = candidate;
        if (routingLog && typeof routingLog === "object" && !routingLog.modelUsed.includes(model)) {
          routingLog.modelUsed.push(model);
        }
        const contractDiff = this.parseSelectionDiffContractDiff(candidate);
        if (!contractDiff.ok) {
          this.emitQaEvent(onEvent, "warning", "Selection-diff contract violation", {
            detail: contractDiff.error || "Output must be unified diff only."
          });
          continue;
        }
        const validation = this.validateSelectionDiffActionAgainstOpenSelection(
          {
            type: "apply_selection_diff",
            path: openSelection.filePath,
            expectedSelectionHash: openSelection.selectionHash,
            diff: contractDiff.diffWithHeader,
            maxChangedLines: MAX_SELECTION_DIFF_CHANGED_LINES,
            maxHunks: MAX_SELECTION_DIFF_HUNKS
          },
          openSelection
        );
        if (!validation.ok) {
          this.emitQaEvent(onEvent, "warning", "Selection-diff contract validation failed", {
            detail: validation.error || "Failed contract validation."
          });
          continue;
        }
        const wrappedAnswer = this.buildSelectionDiffActionAnswerFromContractDiff(
          openSelection,
          contractDiff.diffWithHeader
        );
        lastCandidate = wrappedAnswer;
        if (this.hasValidSelectionDiffActionInAnswer(wrappedAnswer, question, qaModel, openSelection)) {
          if (attempt > 0) {
            this.emitQaEvent(onEvent, "warning", "Selection-diff planner used fallback model.");
          }
          this.emitQaEvent(onEvent, "generation", "Selection-diff planner retry applied");
          return wrappedAnswer;
        }
      } catch (error) {
        if (this.isAbortError(error)) {
          throw error;
        }
        const message = error instanceof Error ? error.message : "Unknown selection-diff planner error";
        this.emitQaEvent(onEvent, "warning", "Selection-diff planner attempt failed", {
          detail: message
        });
      }
    }
    this.emitQaEvent(
      onEvent,
      "warning",
      "Selection-diff planner failed to produce valid unified diff action."
    );
    return lastCandidate || draftAnswer;
  }
  async applyGameBuildScaffoldPass(params) {
    const { question, answer, sourceBlocks, qaBaseUrl, onEvent, abortSignal } = params;
    let passModel = this.resolvePassModelOrWarn("coder", onEvent);
    if (!passModel) {
      passModel = this.resolvePassModelOrWarn("orchestrator", onEvent);
    }
    if (!passModel) {
      return answer;
    }
    this.emitQaEvent(onEvent, "generation", `Running game scaffold pass (${passModel})`);
    const systemPrompt = [
      "You are a game scaffold builder.",
      "Return markdown only.",
      "Produce runnable starter code with minimal playable loop.",
      "Must include: objective, file structure, full code blocks per file, run/test commands.",
      "Prefer simple web stack (HTML/CSS/JS) unless user requested another engine.",
      "Keep scope to a 20-minute learning game when user requests educational game."
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
      if (normalized.length > 0 && this.hasRunnableGameScaffold(normalized)) {
        this.emitQaEvent(onEvent, "generation", "Game scaffold pass applied");
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", "Game scaffold pass returned non-runnable structure");
      return answer;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown game scaffold error";
      this.emitQaEvent(onEvent, "warning", "Game scaffold pass failed", { detail: message });
      return answer;
    }
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
        return this.settings.qaCoderModel;
      case "debugger":
        return this.settings.qaDebuggerModel;
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
    if (this.getQaChatModelFamilyForQa() === "cloud") {
      return qa || roleModel || fallback;
    }
    return roleModel || qa || fallback;
  }
  isVisionCapableModel(modelName) {
    return VISION_MODEL_REGEX.test(modelName.toLowerCase());
  }
  resolveVisionModelForImageAttachments() {
    var _a;
    const detected = this.getDetectedOllamaModelNames();
    const isDetectedOrUnknown = (model) => detected.length === 0 || detected.includes(model);
    const explicitVision = this.settings.qaAskVisionModel.trim();
    if (explicitVision && this.isVisionCapableModel(explicitVision) && isDetectedOrUnknown(explicitVision)) {
      return explicitVision;
    }
    const roleOptions = this.getRoleModelOptionsForQa("ask_vision");
    const recommendedVision = roleOptions.filter((option) => option.status !== "unavailable").map((option) => option.model).sort((a, b) => {
      const aLlamaVision = /llama3\.2-vision/i.test(a);
      const bLlamaVision = /llama3\.2-vision/i.test(b);
      if (aLlamaVision !== bLlamaVision) {
        return aLlamaVision ? -1 : 1;
      }
      return a.localeCompare(b);
    }).find(
      (model) => this.isVisionCapableModel(model) && isDetectedOrUnknown(model)
    );
    if (recommendedVision) {
      return recommendedVision;
    }
    const qaModel = this.settings.qaOllamaModel.trim();
    if (qaModel && this.isVisionCapableModel(qaModel) && isDetectedOrUnknown(qaModel)) {
      return qaModel;
    }
    const baseModel = this.settings.ollamaModel.trim();
    if (baseModel && this.isVisionCapableModel(baseModel) && isDetectedOrUnknown(baseModel)) {
      return baseModel;
    }
    const detectedVision = detected.filter((name) => this.isVisionCapableModel(name)).sort((a, b) => {
      const aLlamaVision = /llama3\.2-vision/i.test(a);
      const bLlamaVision = /llama3\.2-vision/i.test(b);
      if (aLlamaVision !== bLlamaVision) {
        return aLlamaVision ? -1 : 1;
      }
      return a.localeCompare(b);
    });
    return (_a = detectedVision[0]) != null ? _a : null;
  }
  shouldUseLightweightQaPipeline(question, intent) {
    const mode = this.settings.qaConversationMode;
    if (mode === "orchestration" || mode === "plan") {
      return false;
    }
    if (mode === "agent") {
      return true;
    }
    if (intent === "plan" || intent === "comparison") {
      return false;
    }
    const normalized = question.trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    if (normalized.length > 120 || normalized.includes("\n")) {
      return false;
    }
    const complexitySignals = /(계획서|보고서|로드맵|발표|아키텍처|구조|구현|리팩터|디버그|오류 분석|체크리스트|단계별|pipeline|orchestrator|roadmap|report|architecture|design|debug|refactor|checklist|step[- ]by[- ]step|trade[- ]?off)/i;
    if (complexitySignals.test(normalized)) {
      return false;
    }
    const directQuestionSignals = /(무엇|뭐야|뜻|정의|요약|간단|짧게|한줄|차이|why|what is|meaning|summary|brief|quick answer|difference)/i;
    if (directQuestionSignals.test(normalized)) {
      return true;
    }
    return normalized.split(/\s+/).length <= 14;
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
    const codingSignals = /(코드|구현|함수|클래스|리팩터|테스트|스크립트|쿼리|api|endpoint|typescript|javascript|python|sql|regex|algorithm|implement|code|refactor|test|게임|game|gameplay|unity|godot|pygame|phaser)/i;
    const architectureSignals = /(아키텍처|설계|구조|시스템|모듈|컴포넌트|인터페이스|확장성|trade[- ]?off|architecture|design|scalability|boundary|topology|pattern)/i;
    const safeguardSignals = /(보안|개인정보|규정|정책|위험|컴플라이언스|security|privacy|compliance|policy|risk|safety)/i;
    const wantsDebug = debugSignals.test(normalized);
    const wantsGameBuild = this.matchesGameBuildIntent(question);
    const wantsCoding = codingSignals.test(normalized) || wantsGameBuild;
    const wantsArchitecture = architectureSignals.test(normalized) || wantsGameBuild || intent === "plan" || intent === "comparison";
    const wantsSafeguard = safeguardSignals.test(normalized);
    if (wantsArchitecture) {
      stages.push("architect");
    }
    if (wantsDebug) {
      stages.push("debugger");
    } else if (wantsCoding) {
      stages.push("coder");
    }
    if (wantsGameBuild) {
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
        return "Role preset: Coder. For EDIT_NOTE tasks, output unified diff only with CURRENT_SELECTION header, no path headers, and no frontmatter edits.";
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
  isLikelyKoreanResponse(text) {
    var _a, _b;
    const value = text.trim();
    if (!value) {
      return false;
    }
    const hangulMatches = (_a = value.match(/[가-힣]/g)) != null ? _a : [];
    const latinMatches = (_b = value.match(/[A-Za-z]/g)) != null ? _b : [];
    if (hangulMatches.length >= 18) {
      return true;
    }
    if (hangulMatches.length === 0) {
      return false;
    }
    return hangulMatches.length >= Math.max(8, Math.floor(latinMatches.length * 0.35));
  }
  async enforcePreferredLanguageIfNeeded(params) {
    const { answer, question, qaBaseUrl, qaModel, onEvent, abortSignal } = params;
    const trimmed = answer.trim();
    if (!trimmed || this.settings.qaPreferredResponseLanguage !== "korean") {
      return answer;
    }
    if (this.isLikelyKoreanResponse(trimmed)) {
      return answer;
    }
    this.emitQaEvent(
      onEvent,
      "warning",
      "Answer language drift detected; retrying final output in Korean."
    );
    const systemPrompt = [
      "You are a strict Korean localization editor.",
      "Return Korean only.",
      "Preserve markdown structure, bullet order, checkboxes, tables, and source citations.",
      "Do not add new facts; if uncertain keep original uncertainty wording.",
      "Keep code blocks and inline code as-is unless plain-language comments require translation.",
      "Output only the localized final answer."
    ].join("\n");
    const userPrompt = [
      `Original user question: ${question}`,
      "",
      "Rewrite the following answer in Korean:",
      trimmed
    ].join("\n");
    try {
      const localized = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history: [],
        onEvent,
        abortSignal
      });
      const split = splitThinkingBlocks(localized.answer);
      const normalized = split.answer.trim() || localized.answer.trim();
      if (normalized && this.isLikelyKoreanResponse(normalized)) {
        this.emitQaEvent(onEvent, "generation", "Korean language guard applied");
        return normalized;
      }
      this.emitQaEvent(onEvent, "warning", "Korean language guard did not improve output");
      return answer;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown language guard error";
      this.emitQaEvent(onEvent, "warning", "Korean language guard failed", {
        detail: message
      });
      return answer;
    }
  }
  getQaAgentToolInstructionLines() {
    if (!this.settings.qaAgentToolModeEnabled) {
      return [];
    }
    const allowlist = this.parseQaAgentAbsoluteAllowlist();
    const fullAccess = this.settings.qaAgentShellFullAccess;
    const allowlistText = allowlist.length > 0 ? allowlist.join(", ") : "(vault only)";
    const shellLine = this.settings.qaAgentAllowShellTool ? "- run_shell: execute a local shell command (`command` required, `cwd` optional)." : "- run_shell: unavailable (disabled by settings).";
    const shellScopeLine = fullAccess ? "Shell access scope: FULL ACCESS enabled (danger). Any absolute cwd is allowed." : `Shell allowlist roots: ${allowlistText}`;
    return [
      "Agent tool mode is enabled.",
      shellScopeLine,
      "If an action is required, append ONE fenced code block using language `omni-forge-actions` and strict JSON:",
      '{ "actions": [ ... ] }',
      "Supported actions:",
      "- read_note: read file content (`path` required; vault-relative or allowed absolute path).",
      "- write_note: overwrite/create file (`path`, `content` required; vault-relative or allowed absolute path).",
      "- append_note: append to file (`path`, `content` required; vault-relative or allowed absolute path).",
      "- delete_note: delete file (`path` required; vault-relative or allowed absolute path).",
      '- list_folder: list folder (`path` required; use "." for vault root, or allowed absolute path).',
      "- apply_selection_diff: apply unified diff to CURRENT open selection only (`diff` required, `path` optional).",
      `- apply_selection_diff diff must start with header line: ${CODER_PROMPT_CONTRACT_SELECTION_HEADER}.`,
      "- apply_selection_diff must be selection-only patch: no `diff --git`, `---`, `+++` path headers.",
      "- apply_selection_diff default is strict dry-run; fuzzy apply is blocked unless `allowFuzzy: true` is explicitly set.",
      shellLine,
      "Action schema examples:",
      '{ "type": "read_note", "path": "Projects/TODO.md" }',
      '{ "type": "read_note", "path": "/absolute/path/project/README.md" }',
      '{ "type": "write_note", "path": "Projects/plan.md", "content": "# Plan" }',
      '{ "type": "append_note", "path": "Daily/2026-02-16.md", "content": "\\n- done" }',
      '{ "type": "delete_note", "path": "Daily/old-note.md" }',
      '{ "type": "list_folder", "path": "." }',
      `{ "type": "apply_selection_diff", "path": "Notes/active.md", "expectedSelectionHash": "abcd1234", "diff": "${CODER_PROMPT_CONTRACT_SELECTION_HEADER}\\n@@ -1,2 +1,2 @@\\n-old\\n+new", "allowFuzzy": false }`,
      '{ "type": "run_shell", "command": "npm run check", "cwd": "obsidian-plugin/omni-forge", "timeoutSec": 20 }',
      "If prompt includes an active open markdown file path and user says 'this note/current note/이 노트', use that exact path.",
      `For selection edits, use apply_selection_diff + unified diff with ${CODER_PROMPT_CONTRACT_SELECTION_HEADER} header. Do not rewrite whole file.`,
      "Diff must stay inside given selection range. If out-of-range, or if frontmatter would change, regenerate diff.",
      "For frontmatter delete requests, propose actionable write/delete steps. Avoid read-only plans.",
      "When actions are included, keep non-action answer brief and focused.",
      "Never include multiple action blocks."
    ];
  }
  buildLocalQaSystemPrompt(intent, preferDetailed, hasSourceContext, roleOverride, question = "") {
    const role = roleOverride != null ? roleOverride : this.resolveQaPrimaryRole();
    const toneLine = preferDetailed ? "Keep tone natural, direct, and sufficiently detailed." : "Keep tone natural, direct, and concise.";
    return [
      "You are a local-note assistant for Obsidian.",
      hasSourceContext ? "Answer only from the provided sources." : "No note sources were provided for this turn. You may answer from general knowledge with explicit uncertainty notes.",
      this.getQaPreferredLanguageInstruction(),
      this.getQaConversationModeInstruction(),
      ...this.getQaAgentToolInstructionLines(),
      this.getQaRolePresetInstruction(role),
      toneLine,
      "Output in markdown.",
      hasSourceContext ? "When making claims, cite source paths inline in parentheses." : "Do not fabricate source citations when no source context is provided.",
      "If evidence is insufficient, state it clearly and do not invent facts.",
      ...this.getQaContractLines(intent, preferDetailed, this.settings.qaConversationMode, question),
      this.getQaRoleSystemPrompt(role) ? `Role system prompt (${role}):
${this.getQaRoleSystemPrompt(role)}` : "",
      this.settings.qaCustomSystemPrompt.trim() ? `Custom system prompt:
${this.settings.qaCustomSystemPrompt.trim()}` : ""
    ].filter((line) => line.length > 0).join("\n");
  }
  buildLocalQaUserPrompt(question, sourceContext, selectionInventoryContext, attachmentLabels = [], activeOpenFilePath = "", activeOpenSelection = null) {
    const sourceBlock = sourceContext.trim() || "(no source excerpts provided)";
    const hasVisionAttachment = attachmentLabels.some(
      (label) => label.startsWith("[IMG]") || label.startsWith("[PDF]")
    );
    const attachmentBlock = attachmentLabels.length > 0 ? [
      "",
      "Attachments for this turn (highest priority evidence):",
      ...attachmentLabels.map((label) => `- ${label}`)
    ] : [];
    const attachmentPriorityLine = attachmentLabels.length > 0 ? "Priority rule (strict): treat attachments as PRIMARY evidence. Use selected-note excerpts only as SECONDARY fallback when attachment evidence is missing." : "";
    const imageHandlingLine = hasVisionAttachment ? "Image/PDF attachments are already included in this request. Do not ask user for local file paths." : "";
    const activeFilePath = activeOpenFilePath.trim();
    const activeFileBlock = activeFilePath ? [
      "",
      `Active open markdown file: ${activeFilePath}`,
      "If user says 'this note/current note/이 노트', treat it as the active open markdown file path above."
    ] : [];
    const selectionTextRaw = activeOpenSelection && typeof activeOpenSelection.selectedText === "string" ? activeOpenSelection.selectedText : "";
    const selectionPreview = selectionTextRaw ? this.trimQaToolText(selectionTextRaw, MAX_SELECTION_DIFF_CONTEXT_CHARS) : "";
    const selectionBlock = activeOpenSelection && selectionPreview ? [
      "",
      `Active open selection target: ${activeOpenSelection.filePath}`,
      `Selection range (offset): ${activeOpenSelection.fromOffset}-${activeOpenSelection.toOffset}`,
      `Selection hash: ${activeOpenSelection.selectionHash}`,
      `For EDIT_NOTE tasks, return unified diff with ${CODER_PROMPT_CONTRACT_SELECTION_HEADER} header that applies ONLY to this selected text.`,
      "If any hunk goes outside this selection range, or frontmatter would change, regenerate diff. Never use path-based multi-file diff headers.",
      "Selected text (PRIMARY edit target):",
      "```text",
      selectionPreview,
      "```"
    ] : [];
    const inventoryBlock = (selectionInventoryContext == null ? void 0 : selectionInventoryContext.trim()) ? ["", "Selection inventory metadata:", selectionInventoryContext.trim()] : [];
    return [
      `Question: ${question}`,
      "",
      attachmentPriorityLine,
      imageHandlingLine,
      ...activeFileBlock,
      ...selectionBlock,
      "Sources:",
      sourceBlock,
      ...attachmentBlock,
      ...inventoryBlock
    ].filter((line) => line.length > 0).join("\n");
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
  buildLocalQaChatMessages(systemPrompt, userPrompt, history, userImages = []) {
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    for (const turn of history.slice(-6)) {
      messages.push({
        role: turn.role,
        content: turn.text
      });
    }
    messages.push({
      role: "user",
      content: userPrompt,
      images: userImages.length > 0 ? userImages : void 0
    });
    return messages;
  }
  extractQaTextFromUnknownContent(content) {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => this.extractQaTextFromUnknownContent(item)).filter((item) => item.length > 0).join("\n");
    }
    if (!content || typeof content !== "object") {
      return "";
    }
    const parsed = content;
    if (typeof parsed.text === "string") {
      return parsed.text;
    }
    if (typeof parsed.output_text === "string") {
      return parsed.output_text;
    }
    if (typeof parsed.content === "string") {
      return parsed.content;
    }
    if (Array.isArray(parsed.content)) {
      return this.extractQaTextFromUnknownContent(parsed.content);
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (typeof parsed.input_text === "string") {
      return parsed.input_text;
    }
    return "";
  }
  buildCloudQaMessages(systemPrompt, userPrompt, history) {
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    for (const turn of history.slice(-6)) {
      messages.push({
        role: turn.role,
        content: turn.text
      });
    }
    messages.push({
      role: "user",
      content: userPrompt
    });
    return messages;
  }
  async resolveCodexCliExecutable() {
    if (await this.isShellCommandAvailable("codex")) {
      return "codex";
    }
    const absoluteCandidates = [
      "/Users/piman/.local/bin/codex",
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex"
    ];
    for (const candidate of absoluteCandidates) {
      try {
        await nodeFs.promises.access(candidate);
        return candidate;
      } catch (e) {
      }
    }
    return null;
  }
  async requestCodexCliCompletion(params) {
    const {
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      onToken,
      onEvent,
      abortSignal
    } = params;
    if (abortSignal == null ? void 0 : abortSignal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const codexBin = await this.resolveCodexCliExecutable();
    if (!codexBin) {
      throw new Error("codex CLI is not available on PATH. Install Codex CLI or set OpenAI API key.");
    }
    const historyText = history.length > 0 ? history.slice(-6).map(
      (turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.text}`
    ).join("\n") : "(none)";
    const prompt = [
      "System instructions:",
      systemPrompt,
      "",
      "Conversation so far:",
      historyText,
      "",
      userPrompt
    ].join("\n");
    const tempRoot = await nodeFs.promises.mkdtemp(
      nodePath.join(nodeOs.tmpdir(), "omni-forge-codex-")
    );
    try {
      const promptPath = nodePath.join(tempRoot, "prompt.txt");
      const outputPath = nodePath.join(tempRoot, "answer.txt");
      await nodeFs.promises.writeFile(promptPath, prompt, "utf8");
      const command = [
        this.shellQuoteArg(codexBin),
        "exec",
        "--skip-git-repo-check",
        "--model",
        this.shellQuoteArg(qaModel),
        "--output-last-message",
        this.shellQuoteArg(outputPath),
        "-",
        "<",
        this.shellQuoteArg(promptPath)
      ].join(" ");
      this.emitQaEvent(onEvent, "generation", "Using local codex CLI fallback (codex exec)");
      const result = await execAsync(command, {
        timeout: 24e4,
        maxBuffer: 8 * 1024 * 1024
      });
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      let answer = "";
      try {
        answer = (await nodeFs.promises.readFile(outputPath, "utf8")).trim();
      } catch (e) {
      }
      if (!answer) {
        answer = (result.stdout || "").trim();
      }
      if (!answer) {
        throw new Error("codex exec returned empty output.");
      }
      onToken == null ? void 0 : onToken(answer);
      return {
        answer,
        thinking: "",
        endpoint: "codex-exec"
      };
    } finally {
      await nodeFs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {
      });
    }
  }
  extractCloudChatCompletionAnswer(payload) {
    var _a, _b, _c, _d;
    const firstChoice = Array.isArray(payload == null ? void 0 : payload.choices) ? payload.choices[0] : null;
    const messageText = this.extractQaTextFromUnknownContent((_a = firstChoice == null ? void 0 : firstChoice.message) == null ? void 0 : _a.content).trim();
    if (messageText) {
      return messageText;
    }
    const choiceText = this.extractQaTextFromUnknownContent(firstChoice == null ? void 0 : firstChoice.text).trim();
    if (choiceText) {
      return choiceText;
    }
    const outputText = this.extractQaTextFromUnknownContent(payload == null ? void 0 : payload.output_text).trim();
    if (outputText) {
      return outputText;
    }
    const deltaText = this.extractQaTextFromUnknownContent(
      (_d = (_c = (_b = firstChoice == null ? void 0 : firstChoice.delta) == null ? void 0 : _b.content) != null ? _c : firstChoice == null ? void 0 : firstChoice.delta) != null ? _d : ""
    ).trim();
    return deltaText;
  }
  extractCloudResponsesAnswer(payload) {
    const outputText = this.extractQaTextFromUnknownContent(payload == null ? void 0 : payload.output_text).trim();
    if (outputText) {
      return outputText;
    }
    if (Array.isArray(payload == null ? void 0 : payload.output)) {
      const merged = payload.output.map((item) => this.extractQaTextFromUnknownContent(item == null ? void 0 : item.content)).filter((item) => item.length > 0).join("\n").trim();
      if (merged) {
        return merged;
      }
    }
    if (Array.isArray(payload == null ? void 0 : payload.data)) {
      const merged = payload.data.map((item) => this.extractQaTextFromUnknownContent(item == null ? void 0 : item.output)).filter((item) => item.length > 0).join("\n").trim();
      if (merged) {
        return merged;
      }
    }
    return this.extractCloudChatCompletionAnswer(payload);
  }
  async requestCloudQaCompletion(params) {
    const {
      qaBaseUrl,
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      images,
      onToken,
      onEvent,
      abortSignal
    } = params;
    const base = toOpenAICompatibleBase(qaBaseUrl);
    const headers = {
      "Content-Type": "application/json"
    };
    const profile = this.getQaChatModelProfileForQa();
    const configuredProfileModel = (profile === "claude" ? this.settings.anthropicModel : profile === "gemini" ? this.settings.geminiModel : this.settings.openAIModel).trim();
    const effectiveModel = configuredProfileModel || qaModel;
    if (!effectiveModel) {
      throw new Error("Cloud model is empty.");
    }
    const apiKey = (profile === "claude" ? this.settings.anthropicApiKey : profile === "gemini" ? this.settings.geminiApiKey : this.settings.openAIApiKey).trim() || this.settings.openAIApiKey.trim();
    let baseHost = "";
    try {
      baseHost = new URL(base).hostname.toLowerCase();
    } catch (e) {
      baseHost = "";
    }
    const isOpenAiPublicHost = baseHost === "api.openai.com" || baseHost.endsWith(".openai.com");
    if (!apiKey && isOpenAiPublicHost) {
      if (profile === "codex") {
        this.emitQaEvent(
          onEvent,
          "warning",
          "OpenAI API key is empty for codex profile. Falling back to local codex CLI session."
        );
        return this.requestCodexCliCompletion({
          qaModel: effectiveModel,
          systemPrompt,
          userPrompt,
          history,
          onToken,
          onEvent,
          abortSignal
        });
      }
      throw new Error(
        "Cloud request blocked: API key is empty for OpenAI host. Set API key or use a local OpenAI-compatible bridge URL."
      );
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }
    if (images && images.length > 0) {
      this.emitQaEvent(
        onEvent,
        "warning",
        "Cloud bridge request is using text/OCR context only for attachments."
      );
    }
    this.emitQaEvent(
      onEvent,
      "generation",
      `Cloud profile=${profile || "codex"}, model=${effectiveModel}`
    );
    const messages = this.buildCloudQaMessages(systemPrompt, userPrompt, history);
    try {
      this.emitQaEvent(onEvent, "generation", "Using OpenAI-compatible /chat/completions endpoint");
      const chatResponse = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        signal: abortSignal,
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          stream: false
        })
      });
      if (!chatResponse.ok) {
        throw new Error(`Cloud chat completion failed: ${chatResponse.status}`);
      }
      const chatRaw = await chatResponse.text();
      let chatPayload = {};
      try {
        chatPayload = chatRaw ? JSON.parse(chatRaw) : {};
      } catch (e) {
        chatPayload = {};
      }
      const answer = this.extractCloudChatCompletionAnswer(chatPayload).trim() || chatRaw.trim();
      if (answer) {
        onToken == null ? void 0 : onToken(answer);
        return {
          answer,
          thinking: "",
          endpoint: "chat.completions"
        };
      }
      throw new Error("Cloud chat completion returned an empty answer.");
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown cloud chat completion error";
      this.emitQaEvent(onEvent, "warning", "Falling back to /responses endpoint", {
        detail: message
      });
    }
    const responsesInput = messages.map((message) => ({
      role: message.role,
      content: [
        {
          type: "input_text",
          text: this.extractQaTextFromUnknownContent(message.content)
        }
      ]
    }));
    const responsesResponse = await fetch(`${base}/responses`, {
      method: "POST",
      headers,
      signal: abortSignal,
      body: JSON.stringify({
        model: effectiveModel,
        input: responsesInput
      })
    });
    if (!responsesResponse.ok) {
      throw new Error(`Cloud responses request failed: ${responsesResponse.status}`);
    }
    const responsesRaw = await responsesResponse.text();
    let responsesPayload = {};
    try {
      responsesPayload = responsesRaw ? JSON.parse(responsesRaw) : {};
    } catch (e) {
      responsesPayload = {};
    }
    const answer = this.extractCloudResponsesAnswer(responsesPayload).trim() || responsesRaw.trim();
    if (!answer) {
      throw new Error("Cloud responses endpoint returned an empty answer.");
    }
    onToken == null ? void 0 : onToken(answer);
    return {
      answer,
      thinking: "",
      endpoint: "responses"
    };
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
  async consumeOllamaJsonLineStream(body, onToken, onEvent, abortSignal) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let thinking = "";
    const throwIfAborted = () => {
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
    };
    const cancelReaderOnAbort = () => {
      void reader.cancel("aborted").catch(() => {
      });
    };
    abortSignal == null ? void 0 : abortSignal.addEventListener("abort", cancelReaderOnAbort, { once: true });
    const consumeLine = (line) => {
      throwIfAborted();
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
    try {
      while (true) {
        throwIfAborted();
        const { done, value } = await reader.read();
        throwIfAborted();
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
    } finally {
      abortSignal == null ? void 0 : abortSignal.removeEventListener("abort", cancelReaderOnAbort);
    }
    return { answer, thinking };
  }
  async requestLocalQaGenerate(params) {
    const {
      qaBaseUrl,
      qaModel,
      prompt,
      images,
      onToken,
      onEvent,
      abortSignal
    } = params;
    const base = qaBaseUrl.replace(/\/$/, "");
    if (onToken) {
      const streamResponse = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          prompt,
          images: images && images.length > 0 ? images : void 0,
          stream: true
        })
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Local Q&A request failed: ${streamResponse.status}`);
      }
      return this.consumeOllamaJsonLineStream(
        streamResponse.body,
        onToken,
        onEvent,
        abortSignal
      );
    }
    if (abortSignal) {
      const response2 = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          prompt,
          images: images && images.length > 0 ? images : void 0,
          stream: false
        })
      });
      if (!response2.ok) {
        throw new Error(`Local Q&A request failed: ${response2.status}`);
      }
      const raw = await response2.text();
      let parsed2 = {};
      try {
        parsed2 = raw ? JSON.parse(raw) : {};
      } catch (e) {
        parsed2 = {};
      }
      const chunk2 = this.extractOllamaTokenChunk(parsed2);
      const answer2 = chunk2.token.trim() || raw.trim();
      return {
        answer: answer2,
        thinking: chunk2.thinking.trim()
      };
    }
    const response = await (0, import_obsidian4.requestUrl)({
      url: `${base}/api/generate`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        prompt,
        images: images && images.length > 0 ? images : void 0,
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
      images,
      onToken,
      onEvent,
      abortSignal
    } = params;
    const messages = this.buildLocalQaChatMessages(systemPrompt, userPrompt, history, images);
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
      return this.consumeOllamaJsonLineStream(
        streamResponse.body,
        onToken,
        onEvent,
        abortSignal
      );
    }
    if (abortSignal) {
      const response2 = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          messages,
          stream: false
        })
      });
      if (!response2.ok) {
        throw new Error(`Local Q&A chat request failed: ${response2.status}`);
      }
      const raw = await response2.text();
      let parsed2 = {};
      try {
        parsed2 = raw ? JSON.parse(raw) : {};
      } catch (e) {
        parsed2 = {};
      }
      const chunk2 = this.extractOllamaTokenChunk(parsed2);
      const answer2 = chunk2.token.trim() || raw.trim();
      return {
        answer: answer2,
        thinking: chunk2.thinking.trim()
      };
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
      images,
      onToken,
      onEvent,
      abortSignal
    } = params;
    const hasImages = Boolean(images && images.length > 0);
    if (this.getQaChatModelFamilyForQa() === "cloud") {
      return this.requestCloudQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history,
        images,
        onToken,
        onEvent,
        abortSignal
      });
    }
    if (hasImages) {
      this.emitQaEvent(
        onEvent,
        "generation",
        "Image attachments detected; using /api/generate endpoint"
      );
    } else if (this.settings.qaPreferChatApi) {
      try {
        this.emitQaEvent(onEvent, "generation", "Using /api/chat endpoint");
        const chatResult = await this.requestLocalQaChat({
          qaBaseUrl,
          qaModel,
          systemPrompt,
          userPrompt,
          history,
          images,
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
        if (this.isAbortError(error)) {
          throw error;
        }
        const message = error instanceof Error ? error.message : "Unknown /api/chat error";
        this.emitQaEvent(onEvent, "warning", "Falling back to /api/generate", {
          detail: message
        });
      }
    }
    this.emitQaEvent(onEvent, "generation", "Using /api/generate endpoint");
    const prompt = this.buildLocalQaGeneratePrompt(systemPrompt, userPrompt, history);
    let generateResult;
    try {
      generateResult = await this.requestLocalQaGenerate({
        qaBaseUrl,
        qaModel,
        prompt,
        images,
        onToken,
        onEvent,
        abortSignal
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (images && images.length > 0) {
        const message = error instanceof Error ? error.message : "Unknown image generate error";
        this.emitQaEvent(onEvent, "warning", "Image input failed; retrying without images", {
          detail: message
        });
        generateResult = await this.requestLocalQaGenerate({
          qaBaseUrl,
          qaModel,
          prompt,
          images: [],
          onToken,
          onEvent,
          abortSignal
        });
      } else {
        throw error;
      }
    }
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
      onEvent,
      abortSignal
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
      ...this.getQaContractLines(intent, preferDetailed, this.settings.qaConversationMode, question)
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
        history: [],
        abortSignal
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
      if (this.isAbortError(error)) {
        throw error;
      }
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
    let model = this.resolveQaModelForRole(role).trim();
    if (!model) {
      this.emitQaEvent(onEvent, "warning", `Skipping ${role} pass: model is empty`);
      return null;
    }
    const isCloudFamily = this.getQaChatModelFamilyForQa() === "cloud";
    if (isCloudFamily) {
      return model;
    }
    const detected = this.getDetectedOllamaModelNames();
    if (detected.length > 0 && !this.hasDetectedOllamaModel(model)) {
      const fallback = this.resolveDetectedRoleFallbackModel(role);
      if (fallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Pass model not detected (${model}); fallback to ${fallback}`
        );
        model = fallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Skipping ${role} pass: model not detected (${model})`
        );
        return null;
      }
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
      "- Role coordination summary (architect/coder/debugger/safeguard: responsibility, output, handoff, unresolved)",
      "- Deliverables (report/PPT/materials/code)",
      "- If task requests software/game creation, include runnable scaffold code and file layout.",
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
  parseQaAgentApprovalCommand(question) {
    const normalized = question.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (/^(\/approve|approve|승인|실행)$/.test(normalized)) {
      return "approve";
    }
    if (/^(\/deny|deny|거부|취소|\/cancel|cancel)$/.test(normalized)) {
      return "deny";
    }
    return null;
  }
  normalizeQaAgentAction(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const parsed = raw;
    if (typeof parsed.type !== "string") {
      return null;
    }
    const type = parsed.type.trim();
    const allowedTypes = [
      "read_note",
      "write_note",
      "append_note",
      "delete_note",
      "list_folder",
      "apply_selection_diff",
      "run_shell"
    ];
    if (!allowedTypes.includes(type)) {
      return null;
    }
    const action = { type };
    if (typeof parsed.path === "string") {
      action.path = parsed.path.trim();
    }
    if (typeof parsed.content === "string") {
      action.content = parsed.content;
    }
    if (typeof parsed.command === "string") {
      action.command = parsed.command.trim();
    }
    if (typeof parsed.diff === "string") {
      action.diff = parsed.diff;
    } else if (typeof parsed.patch === "string") {
      action.diff = parsed.patch;
    }
    if (typeof parsed.expectedSelectionHash === "string") {
      action.expectedSelectionHash = parsed.expectedSelectionHash.trim();
    }
    if (typeof parsed.expectedSelectionText === "string") {
      action.expectedSelectionText = parsed.expectedSelectionText;
    }
    if (typeof parsed.cwd === "string") {
      action.cwd = parsed.cwd.trim();
    }
    if (typeof parsed.timeoutSec === "number" && Number.isFinite(parsed.timeoutSec)) {
      action.timeoutSec = Math.floor(parsed.timeoutSec);
    }
    if (typeof parsed.maxChangedLines === "number" && Number.isFinite(parsed.maxChangedLines)) {
      action.maxChangedLines = Math.max(1, Math.floor(parsed.maxChangedLines));
    }
    if (typeof parsed.maxHunks === "number" && Number.isFinite(parsed.maxHunks)) {
      action.maxHunks = Math.max(1, Math.floor(parsed.maxHunks));
    }
    if (typeof parsed.allowFuzzy === "boolean") {
      action.allowFuzzy = parsed.allowFuzzy;
    }
    return action;
  }
  summarizeQaAgentAction(action) {
    switch (action.type) {
      case "read_note":
        return `read_note path=${action.path || "(missing)"}`;
      case "write_note":
        return `write_note path=${action.path || "(missing)"}`;
      case "append_note":
        return `append_note path=${action.path || "(missing)"}`;
      case "delete_note":
        return `delete_note path=${action.path || "(missing)"}`;
      case "list_folder":
        return `list_folder path=${action.path || "(missing)"}`;
      case "apply_selection_diff":
        return `apply_selection_diff path=${action.path || "(selection-context)"}${action.allowFuzzy ? " allowFuzzy=true" : ""}`;
      case "run_shell":
        return `run_shell command=${action.command || "(missing)"}`;
      default:
        return action.type;
    }
  }
  parseQaAgentActionPlanFromAnswer(params) {
    var _a, _b;
    const { answer, question, model } = params;
    const blockRegex = /```omni-forge-actions\s*([\s\S]*?)```/i;
    const match = blockRegex.exec(answer);
    const answerWithoutPlan = answer.replace(blockRegex, "").trim();
    if (!match) {
      return { answerWithoutPlan: answer.trim(), plan: null };
    }
    const jsonText = (_b = (_a = match[1]) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (!jsonText) {
      return {
        answerWithoutPlan,
        plan: null,
        warning: "Agent action block is empty."
      };
    }
    try {
      const parsed = JSON.parse(jsonText);
      const rawActions = Array.isArray(parsed.actions) ? parsed.actions : null;
      if (!rawActions || rawActions.length === 0) {
        return {
          answerWithoutPlan,
          plan: null,
          warning: "Agent action block has no actions array."
        };
      }
      const normalized = rawActions.map((item) => this.normalizeQaAgentAction(item)).filter((item) => Boolean(item));
      if (normalized.length === 0) {
        return {
          answerWithoutPlan,
          plan: null,
          warning: "Agent action block contains unsupported action types."
        };
      }
      const capped = normalized.slice(0, 8);
      const plan = {
        id: `qa-actions-${formatBackupStamp(/* @__PURE__ */ new Date())}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        model,
        question,
        actions: capped
      };
      const warning = normalized.length > capped.length ? `Action count exceeded limit. Only first ${capped.length} actions were kept.` : void 0;
      return {
        answerWithoutPlan,
        plan,
        warning
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parse error";
      return {
        answerWithoutPlan,
        plan: null,
        warning: `Agent action JSON parse failed: ${message}`
      };
    }
  }
  buildQaActionApprovalText(plan) {
    const lines = [
      "### Agent action plan / \uC5D0\uC774\uC804\uD2B8 \uC561\uC158 \uACC4\uD68D",
      `Plan ID: ${plan.id}`,
      `Proposed by model: ${plan.model}`,
      `Created: ${plan.createdAt}`,
      ""
    ];
    for (let index = 0; index < plan.actions.length; index += 1) {
      lines.push(`${index + 1}. ${this.summarizeQaAgentAction(plan.actions[index])}`);
    }
    lines.push("");
    lines.push("\uC2E4\uD589\uD558\uB824\uBA74 `\uC2B9\uC778` \uB610\uB294 `/approve` \uB97C \uC785\uB825\uD558\uC138\uC694.");
    lines.push("\uCDE8\uC18C\uD558\uB824\uBA74 `\uAC70\uBD80` \uB610\uB294 `/deny` \uB97C \uC785\uB825\uD558\uC138\uC694.");
    return lines.join("\n");
  }
  trimQaToolText(text, maxChars) {
    const normalized = text != null ? text : "";
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, maxChars)}
...(truncated ${normalized.length - maxChars} chars)`;
  }
  normalizeUnifiedDiffText(rawDiff) {
    return this.getPatchParser().normalizeUnifiedDiffText(rawDiff);
  }
  getPatchParser() {
    if (!this.patchParser) {
      this.patchParser = new PatchParser();
    }
    return this.patchParser;
  }
  getPatchApplier() {
    if (!this.patchApplier) {
      this.patchApplier = new PatchApplier(this.getPatchParser());
    }
    return this.patchApplier;
  }
  resolveSelectionDiffLimits(action = {}) {
    const requestedChangedLines = typeof action.maxChangedLines === "number" && Number.isFinite(action.maxChangedLines) ? action.maxChangedLines : MAX_SELECTION_DIFF_CHANGED_LINES;
    const requestedHunks = typeof action.maxHunks === "number" && Number.isFinite(action.maxHunks) ? action.maxHunks : MAX_SELECTION_DIFF_HUNKS;
    return {
      maxChangedLines: Math.max(1, Math.min(MAX_SELECTION_DIFF_CHANGED_LINES, Math.floor(requestedChangedLines))),
      maxHunks: Math.max(1, Math.min(MAX_SELECTION_DIFF_HUNKS, Math.floor(requestedHunks)))
    };
  }
  validateSelectionDiffLimits(parsedDiff, limits) {
    return this.getPatchParser().validateLimits(parsedDiff, limits);
  }
  parseUnifiedDiffHunks(diffText) {
    return this.getPatchParser().parse(diffText);
  }
  countParsedUnifiedDiffChangedLines(parsedDiff) {
    return this.getPatchParser().countChangedLines(parsedDiff);
  }
  countUnifiedDiffChangedLines(diffText) {
    const parsed = this.parseUnifiedDiffHunks(diffText);
    if (parsed.error) {
      return 0;
    }
    return this.countParsedUnifiedDiffChangedLines(parsed);
  }
  isValidUnifiedDiff(diffText) {
    const parsed = this.parseUnifiedDiffHunks(diffText);
    if (parsed.error) {
      return false;
    }
    return this.countParsedUnifiedDiffChangedLines(parsed) > 0;
  }
  validateSelectionDiffRange(parsedDiff, selectionText) {
    return this.getPatchParser().validateSelectionRange(parsedDiff, selectionText);
  }
  buildPatchPreviewSummaryFromParsedDiff(parsedDiff) {
    if (!parsedDiff || parsedDiff.error) {
      return {
        added: 0,
        removed: 0,
        context: 0,
        hunks: 0,
        changed: 0
      };
    }
    let added = 0;
    let removed = 0;
    let context = 0;
    for (const hunk of parsedDiff.hunks) {
      for (const line of hunk.lines) {
        if (line.prefix === "+") {
          added += 1;
        } else if (line.prefix === "-") {
          removed += 1;
        } else {
          context += 1;
        }
      }
    }
    return {
      added,
      removed,
      context,
      hunks: parsedDiff.hunks.length,
      changed: added + removed
    };
  }
  estimatePatchPreviewRisk(params) {
    const reasons = [];
    let score = 0;
    if (params.applyMode === "fuzzy") {
      score += 4;
      reasons.push("Fuzzy 전략은 문맥 오인 가능성이 있어 추가 확인이 필요합니다.");
    }
    if (params.changed >= 120) {
      score += 3;
      reasons.push("변경 줄 수가 큽니다.");
    } else if (params.changed >= 60) {
      score += 2;
      reasons.push("변경 규모가 중간 이상입니다.");
    } else if (params.changed >= 24) {
      score += 1;
    }
    if (params.hunks >= 6) {
      score += 2;
      reasons.push("Hunk 수가 많습니다.");
    } else if (params.hunks >= 3) {
      score += 1;
    }
    if (params.removed >= Math.max(18, params.added * 2)) {
      score += 1;
      reasons.push("삭제 비중이 높습니다.");
    }
    let level = "low";
    if (score >= 6) {
      level = "high";
    } else if (score >= 3) {
      level = "medium";
    }
    if (params.applyMode === "fuzzy" && level !== "high") {
      level = "high";
    }
    const requireExtraConfirm = level === "high" || params.applyMode === "fuzzy";
    let warningTitle = "주의: Patch 검토 필요";
    if (params.applyMode === "fuzzy") {
      warningTitle = "주의: Fuzzy Patch 적용";
    } else if (level === "high") {
      warningTitle = "주의: 고위험 Patch";
    } else if (level === "medium") {
      warningTitle = "주의: 중위험 Patch";
    }
    const warningDetail = reasons.length > 0 ? reasons.join(" ") : "적용 전 변경 내용을 다시 확인하세요.";
    return {
      level,
      reasons,
      requireExtraConfirm,
      warningTitle,
      warningDetail
    };
  }
  buildPatchPreviewModel(params) {
    const {
      filePath,
      fromOffset,
      toOffset,
      parsedDiff,
      applyMode,
      strictError
    } = params;
    const summaryBase = this.buildPatchPreviewSummaryFromParsedDiff(parsedDiff);
    const risk = this.estimatePatchPreviewRisk({
      applyMode,
      changed: summaryBase.changed,
      hunks: summaryBase.hunks,
      added: summaryBase.added,
      removed: summaryBase.removed
    });
    const badges = [
      "selection-only",
      applyMode === "fuzzy" ? "fuzzy" : "strict",
      `risk:${risk.level}`
    ];
    if (risk.requireExtraConfirm) {
      badges.push("confirm-required");
    }
    const hunks = (parsedDiff && !parsedDiff.error ? parsedDiff.hunks : []).map((hunk, index) => {
      let added = 0;
      let removed = 0;
      let context = 0;
      for (const line of hunk.lines) {
        if (line.prefix === "+") {
          added += 1;
        } else if (line.prefix === "-") {
          removed += 1;
        } else {
          context += 1;
        }
      }
      const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
      const label = `#${index + 1} ${hunk.oldStart}:${hunk.oldCount} -> ${hunk.newStart}:${hunk.newCount}`;
      const searchText = `${label}
${header}
${hunk.lines.map((line) => `${line.prefix}${line.text}`).join("\n")}`.toLowerCase();
      return {
        id: `hunk-${index + 1}`,
        index: index + 1,
        header,
        label,
        added,
        removed,
        context,
        lines: hunk.lines.map((line) => ({
          prefix: line.prefix,
          text: line.text
        })),
        searchText
      };
    });
    const strategyParts = [
      applyMode === "fuzzy" ? "PatchApplier: strict -> fuzzy" : "PatchApplier: strict"
    ];
    if (strictError && applyMode === "fuzzy") {
      strategyParts.push(`strict 실패: ${this.trimQaToolText(strictError, 160)}`);
    }
    const dryRunSummary = params.dryRunSummary && typeof params.dryRunSummary === "object" ? params.dryRunSummary : null;
    const guardResult = params.guardResult && typeof params.guardResult === "object" ? params.guardResult : null;
    const canApply = typeof params.canApply === "boolean" ? params.canApply : true;
    if (dryRunSummary && !dryRunSummary.ok) {
      badges.push("dryrun-failed");
    }
    if (guardResult && !guardResult.ok) {
      badges.push("guard-failed");
    }
    const blockReason = canApply ? "" : this.trimQaToolText(
      guardResult && !guardResult.ok ? guardResult.error || "Frontmatter guard failed." : dryRunSummary && !dryRunSummary.ok ? dryRunSummary.error || "Patch dry-run failed." : "Patch apply is blocked by PR-0 guard.",
      240
    );
    return {
      title: "Patch Preview / 선택영역 패치 미리보기",
      scopeText: `Scope: ${filePath} | offset ${fromOffset}-${toOffset}`,
      strategyText: `Strategy: ${strategyParts.join(" | ")}`,
      riskLevel: risk.level,
      warningTitle: risk.warningTitle,
      warningDetail: risk.warningDetail,
      requireExtraConfirm: risk.requireExtraConfirm,
      summary: {
        added: summaryBase.added,
        removed: summaryBase.removed,
        hunks: summaryBase.hunks,
        changed: summaryBase.changed,
        badges
      },
      dryRunSummary,
      guardResult,
      canApply,
      blockReason,
      hunks
    };
  }
  applyParsedUnifiedDiffStrictToText(sourceText, parsedDiff) {
    return this.getPatchApplier().applyStrict(sourceText, parsedDiff);
  }
  applyParsedUnifiedDiffFuzzyToText(sourceText, parsedDiff) {
    return this.getPatchApplier().applyFuzzy(sourceText, parsedDiff);
  }
  applySelectionPatchWithPatchApplier(sourceText, diffText, parsedDiff = null, options = {}) {
    const parsed = parsedDiff || this.parseUnifiedDiffHunks(diffText);
    if (parsed.error) {
      return {
        ok: false,
        mode: "none",
        error: parsed.error,
        changedLines: 0,
        strictError: parsed.error,
        fuzzyError: ""
      };
    }
    const rangeCheck = this.validateSelectionDiffRange(parsed, sourceText);
    if (!rangeCheck.ok) {
      return {
        ok: false,
        mode: "none",
        error: rangeCheck.error || "Diff exceeds selection range.",
        changedLines: this.countParsedUnifiedDiffChangedLines(parsed),
        strictError: rangeCheck.error || "",
        fuzzyError: "",
        outOfRange: true
      };
    }
    const strictResult = this.getPatchApplier().applyStrict(sourceText, parsed);
    if (strictResult.ok) {
      return {
        ...strictResult,
        mode: "strict",
        strictError: "",
        fuzzyError: ""
      };
    }
    const allowFuzzy = Boolean(options && options.allowFuzzy === true);
    if (!allowFuzzy) {
      return {
        ok: false,
        mode: "none",
        error: `Strict apply failed: ${strictResult.error || "unknown"} (fuzzy disabled).`,
        changedLines: this.countParsedUnifiedDiffChangedLines(parsed),
        strictError: strictResult.error || "",
        fuzzyError: "Fuzzy apply disabled. Set allowFuzzy=true to opt-in."
      };
    }
    const fuzzyResult = this.getPatchApplier().applyFuzzy(sourceText, parsed);
    if (fuzzyResult.ok) {
      return {
        ...fuzzyResult,
        mode: "fuzzy",
        strictError: strictResult.error || "",
        fuzzyError: ""
      };
    }
    return {
      ok: false,
      mode: "none",
      error: `Strict apply failed: ${strictResult.error || "unknown"} | Fuzzy apply failed: ${fuzzyResult.error || "unknown"}`,
      changedLines: this.countParsedUnifiedDiffChangedLines(parsed),
      strictError: strictResult.error || "",
      fuzzyError: fuzzyResult.error || ""
    };
  }
  applyUnifiedDiffToText(sourceText, diffText) {
    const parsed = this.parseUnifiedDiffHunks(diffText);
    return this.applyParsedUnifiedDiffStrictToText(sourceText, parsed);
  }
  resolveOpenMarkdownEditorForPath(filePath) {
    const normalized = (0, import_obsidian4.normalizePath)((filePath != null ? filePath : "").trim());
    if (!normalized) {
      return null;
    }
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian4.MarkdownView)) {
        continue;
      }
      const file = view.file;
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
        continue;
      }
      if (file.path !== normalized || !view.editor) {
        continue;
      }
      return {
        view,
        editor: view.editor
      };
    }
    return null;
  }
  buildSelectionScopeRoots(filePath) {
    const normalized = (0, import_obsidian4.normalizePath)((filePath != null ? filePath : "").trim());
    if (!normalized) {
      return ["."];
    }
    const root = (0, import_obsidian4.normalizePath)(nodePath.posix.dirname(normalized) || ".");
    return [root || "."];
  }
  summarizePr0GuardResult(rawGuard) {
    return {
      ok: Boolean(rawGuard && rawGuard.ok),
      error: rawGuard && typeof rawGuard.error === "string" ? rawGuard.error : "",
      guardApplied: Boolean(rawGuard && rawGuard.guardApplied),
      frontmatterChangedByPatch: Boolean(rawGuard && rawGuard.frontmatterChangedByPatch)
    };
  }
  summarizePr0DryRunResult(rawDryRun, allowFuzzy) {
    return {
      ok: Boolean(rawDryRun && rawDryRun.ok),
      mode: rawDryRun && typeof rawDryRun.mode === "string" ? rawDryRun.mode : "none",
      changedLines: rawDryRun && Number.isFinite(rawDryRun.changedLines) ? rawDryRun.changedLines : 0,
      error: rawDryRun && typeof rawDryRun.error === "string" ? rawDryRun.error : "",
      strictError: rawDryRun && typeof rawDryRun.strictError === "string" ? rawDryRun.strictError : "",
      fuzzyError: rawDryRun && typeof rawDryRun.fuzzyError === "string" ? rawDryRun.fuzzyError : "",
      allowFuzzy: Boolean(allowFuzzy)
    };
  }
  async applyPatchFlow(scope, patchPayload) {
    const selection = scope && scope.selection ? scope.selection : null;
    if (!selection) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "No active open selection snapshot is available.",
        audit: { resultCode: "REJECTED" }
      };
    }
    const scopeRoots = Array.isArray(scope == null ? void 0 : scope.scopeRoots) && scope.scopeRoots.length > 0 ? scope.scopeRoots : this.buildSelectionScopeRoots(selection.filePath);
    let scopedVault;
    try {
      scopedVault = new ScopedVault(scopeRoots);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: message,
        audit: {
          scopeRoots,
          resultCode: "REJECTED"
        }
      };
    }
    const allowFuzzy = Boolean(patchPayload && patchPayload.allowFuzzy === true);
    let targetPath = "";
    try {
      targetPath = scopedVault.assertPathInScope(
        (((patchPayload == null ? void 0 : patchPayload.path) != null ? patchPayload.path : selection.filePath) || selection.filePath),
        "apply_selection_diff.path"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: message,
        audit: {
          targetPath,
          scopeRoots,
          resultCode: "REJECTED"
        }
      };
    }
    if (targetPath !== selection.filePath) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: `Target path mismatch. selection=${selection.filePath}, action=${targetPath}`,
        audit: {
          targetPath,
          scopeRoots,
          resultCode: "REJECTED"
        }
      };
    }
    const editorContext = this.resolveOpenMarkdownEditorForPath(targetPath);
    if (!editorContext) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Target markdown note is not open in editor.",
        audit: {
          targetPath,
          scopeRoots,
          resultCode: "REJECTED"
        }
      };
    }
    const editor = editorContext.editor;
    const readSelectionSnapshot = () => {
      const fullText = editor.getValue();
      if (selection.toOffset > fullText.length || selection.fromOffset < 0 || selection.fromOffset >= selection.toOffset) {
        return {
          ok: false,
          error: "Selection offsets are out of current editor range."
        };
      }
      const selectedText = fullText.slice(selection.fromOffset, selection.toOffset);
      const selectionHash = this.hashString(`${selection.filePath}
${selectedText}`);
      return {
        ok: true,
        fullText,
        selectedText,
        selectionHash
      };
    };
    const initialSnapshot = readSelectionSnapshot();
    if (!initialSnapshot.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: initialSnapshot.error,
        audit: {
          targetPath,
          scopeRoots,
          resultCode: "REJECTED"
        }
      };
    }
    const expectedHash = ((patchPayload == null ? void 0 : patchPayload.expectedSelectionHash) || selection.selectionHash || "").trim();
    if (expectedHash && initialSnapshot.selectionHash !== expectedHash) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection hash mismatch. Re-open and reselect target range.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          resultCode: "REJECTED"
        }
      };
    }
    if (typeof (patchPayload == null ? void 0 : patchPayload.expectedSelectionText) === "string" && patchPayload.expectedSelectionText.length > 0 && patchPayload.expectedSelectionText !== initialSnapshot.selectedText) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection text mismatch. Re-open and reselect target range.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          resultCode: "REJECTED"
        }
      };
    }
    const contractValidation = this.validateSelectionDiffActionAgainstOpenSelection(
      patchPayload,
      {
        filePath: selection.filePath,
        selectedText: initialSnapshot.selectedText,
        selectionHash: initialSnapshot.selectionHash
      }
    );
    if (!contractValidation.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: `${contractValidation.error || "Invalid selection diff contract."} Re-generate unified diff.`,
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          resultCode: "REJECTED"
        }
      };
    }
    const diff = contractValidation.diffBody;
    const parsedDiff = contractValidation.parsedDiff;
    const limits = contractValidation.limits;
    const limitCheck = contractValidation.limitCheck;
    const preflightDryRunRaw = this.applySelectionPatchWithPatchApplier(
      initialSnapshot.selectedText,
      diff,
      parsedDiff,
      { allowFuzzy }
    );
    const preflightDryRun = this.summarizePr0DryRunResult(preflightDryRunRaw, allowFuzzy);
    let preflightGuard = {
      ok: false,
      error: preflightDryRun.ok ? "" : "Dry-run failed. Frontmatter guard check skipped.",
      guardApplied: false,
      frontmatterChangedByPatch: false
    };
    if (preflightDryRunRaw.ok) {
      const preflightPatchedFullText = `${initialSnapshot.fullText.slice(0, selection.fromOffset)}${preflightDryRunRaw.text}${initialSnapshot.fullText.slice(selection.toOffset)}`;
      preflightGuard = this.summarizePr0GuardResult(
        this.runFrontmatterLintGuardAfterPatch({
          beforeText: initialSnapshot.fullText,
          patchedText: preflightPatchedFullText,
          mode: "selection"
        })
      );
    }
    const previewModel = this.buildPatchPreviewModel({
      filePath: selection.filePath,
      fromOffset: selection.fromOffset,
      toOffset: selection.toOffset,
      applyMode: preflightDryRunRaw.ok ? preflightDryRunRaw.mode || "strict" : "none",
      strictError: preflightDryRunRaw.strictError || "",
      parsedDiff,
      dryRunSummary: preflightDryRun,
      guardResult: preflightGuard,
      canApply: preflightDryRun.ok && preflightGuard.ok
    });
    const preview = await PatchPreviewModal.ask(this.app, previewModel);
    if (preview.decision !== "apply") {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Patch preview cancelled by user.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          applyMode: preflightDryRun.mode || "none",
          previewDecision: "cancel",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "CANCELED"
        }
      };
    }
    if (!previewModel.canApply) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: previewModel.blockReason || "PR-0 guard blocked patch apply.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          applyMode: preflightDryRun.mode || "none",
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    const latestSnapshot = readSelectionSnapshot();
    if (!latestSnapshot.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection offsets changed while preview was open. Re-open and reselect target range.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: initialSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    if (expectedHash && latestSnapshot.selectionHash !== expectedHash) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection hash mismatch after preview. Re-open and reselect target range.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    if (!expectedHash && latestSnapshot.selectionHash !== initialSnapshot.selectionHash) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection changed while preview was open. Regenerate unified diff.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    if (typeof (patchPayload == null ? void 0 : patchPayload.expectedSelectionText) === "string" && patchPayload.expectedSelectionText.length > 0 && patchPayload.expectedSelectionText !== latestSnapshot.selectedText) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: "Selection text mismatch after preview. Re-open and reselect target range.",
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    const latestRangeCheck = this.validateSelectionDiffRange(parsedDiff, latestSnapshot.selectedText);
    if (!latestRangeCheck.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: `${latestRangeCheck.error} Re-select target range and regenerate unified diff.`,
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: limitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    const liveLimitCheck = this.validateSelectionDiffLimits(parsedDiff, limits);
    if (!liveLimitCheck.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: `${liveLimitCheck.error} Re-generate unified diff.`,
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: liveLimitCheck.changedLines,
          previewDecision: "apply",
          dryRunSummary: preflightDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    const applied = this.applySelectionPatchWithPatchApplier(
      latestSnapshot.selectedText,
      diff,
      parsedDiff,
      { allowFuzzy }
    );
    const liveDryRun = this.summarizePr0DryRunResult(applied, allowFuzzy);
    if (!applied.ok) {
      return {
        status: applied.outOfRange ? "blocked" : "error",
        title: "apply_selection_diff",
        detail: `${applied.error || "Failed to apply unified diff."} Regenerate unified diff.`,
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: liveLimitCheck.changedLines,
          applyMode: applied.mode || "none",
          strictError: applied.strictError || "",
          fuzzyError: applied.fuzzyError || "",
          previewDecision: "apply",
          dryRunSummary: liveDryRun,
          guardResult: preflightGuard,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: applied.outOfRange ? "REJECTED" : "FAILED"
        }
      };
    }
    const patchedFullText = `${latestSnapshot.fullText.slice(0, selection.fromOffset)}${applied.text}${latestSnapshot.fullText.slice(selection.toOffset)}`;
    const guardRaw = this.runFrontmatterLintGuardAfterPatch({
      beforeText: latestSnapshot.fullText,
      patchedText: patchedFullText,
      mode: "selection"
    });
    const guardResult = this.summarizePr0GuardResult(guardRaw);
    if (!guardRaw.ok) {
      return {
        status: "blocked",
        title: "apply_selection_diff",
        detail: `${guardRaw.error} Re-generate unified diff.`,
        audit: {
          targetPath,
          scopeRoots,
          currentSelectionHash: latestSnapshot.selectionHash,
          expectedSelectionHash: expectedHash,
          diffHash: this.hashString(contractValidation.diffWithHeader),
          changedLines: liveLimitCheck.changedLines,
          applyMode: applied.mode || "none",
          strictError: applied.strictError || "",
          fuzzyError: applied.fuzzyError || "",
          previewDecision: "apply",
          dryRunSummary: liveDryRun,
          guardResult,
          maxChangedLines: limits.maxChangedLines,
          maxHunks: limits.maxHunks,
          resultCode: "REJECTED"
        }
      };
    }
    const finalFullText = guardRaw.text;
    const patchedFromOffset = selection.fromOffset;
    const patchedToOffset = selection.fromOffset + applied.text.length;
    let finalFromOffset = this.mapOffsetAfterFrontmatterGuard(
      patchedFromOffset,
      guardRaw.beforeBodyStartOffset,
      guardRaw.bodyOffsetDelta
    );
    let finalToOffset = this.mapOffsetAfterFrontmatterGuard(
      patchedToOffset,
      guardRaw.beforeBodyStartOffset,
      guardRaw.bodyOffsetDelta
    );
    finalFromOffset = Math.max(0, Math.min(finalFullText.length, finalFromOffset));
    finalToOffset = Math.max(finalFromOffset, Math.min(finalFullText.length, finalToOffset));
    editor.setValue(finalFullText);
    editor.setSelection(editor.offsetToPos(finalFromOffset), editor.offsetToPos(finalToOffset));
    const finalSelectedText = finalFullText.slice(finalFromOffset, finalToOffset);
    const nextSelection = {
      ...selection,
      fromOffset: finalFromOffset,
      toOffset: finalToOffset,
      selectedText: finalSelectedText,
      selectionHash: this.hashString(`${selection.filePath}
${finalSelectedText}`),
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return {
      status: "ok",
      title: `apply_selection_diff ${selection.filePath}`,
      detail: `Applied unified diff to selection (${selection.fromOffset}-${selection.toOffset}), changed lines=${applied.changedLines}, hunks=${liveLimitCheck.hunks}, mode=${applied.mode || "strict"}.`,
      nextSelection,
      audit: {
        targetPath,
        scopeRoots,
        currentSelectionHash: nextSelection.selectionHash,
        expectedSelectionHash: expectedHash,
        diffHash: this.hashString(contractValidation.diffWithHeader),
        changedLines: liveLimitCheck.changedLines,
        applyMode: applied.mode || "strict",
        usedTrimmedMatch: Boolean(applied.usedTrimmedMatch),
        strictError: applied.strictError || "",
        previewDecision: "apply",
        dryRunSummary: liveDryRun,
        guardResult,
        frontmatterGuardApplied: Boolean(guardRaw.guardApplied),
        frontmatterUpdated: true,
        maxChangedLines: limits.maxChangedLines,
        maxHunks: limits.maxHunks,
        resultCode: "APPLIED"
      }
    };
  }
  async executeSelectionDiffAction(action, executionContext) {
    const selection = executionContext.openSelection;
    const routingLog = executionContext.routingLog && typeof executionContext.routingLog === "object" ? executionContext.routingLog : null;
    const auditState = {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      planId: executionContext.planId || "",
      taskType: executionContext.taskType || "QA_CHAT",
      roles: routingLog && Array.isArray(routingLog.roles) ? [...routingLog.roles] : [],
      modelUsed: routingLog && Array.isArray(routingLog.modelUsed) ? [...routingLog.modelUsed] : [],
      fallbackUsed: Boolean(routingLog && routingLog.fallbackUsed),
      safeguardPassed: Boolean(routingLog && routingLog.safeguardPassed),
      actionType: "apply_selection_diff",
      filePath: selection ? selection.filePath : "",
      selectionFrom: selection ? selection.fromOffset : null,
      selectionTo: selection ? selection.toOffset : null,
      expectedSelectionHash: "",
      currentSelectionHash: "",
      diffHash: "",
      changedLines: 0,
      applyMode: "none"
    };
    const finalize = async (status, title, detail, extra = {}) => {
      const result = { status, title, detail };
      const resultCode = typeof extra.resultCode === "string" && extra.resultCode.length > 0 ? extra.resultCode : status === "ok" ? "APPLIED" : status === "error" ? "FAILED" : /cancel/i.test(detail) ? "CANCELED" : "REJECTED";
      await this.appendSelectionDiffAuditLog({
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        ...auditState,
        ...extra,
        status,
        title,
        detail,
        scope: Array.isArray(extra.scopeRoots) ? extra.scopeRoots : [],
        paths: {
          target: typeof extra.targetPath === "string" && extra.targetPath.length > 0 ? extra.targetPath : auditState.filePath,
          selection: selection ? selection.filePath : ""
        },
        guard: extra.guardResult && typeof extra.guardResult === "object" ? extra.guardResult : null,
        dryRun: extra.dryRunSummary && typeof extra.dryRunSummary === "object" ? extra.dryRunSummary : null,
        result: resultCode
      });
      return result;
    };
    if (!selection) {
      return finalize("blocked", "apply_selection_diff", "No active open selection snapshot is available.");
    }
    const flowResult = await this.applyPatchFlow(
      {
        selection,
        scopeRoots: Array.isArray(executionContext.scopeRoots) ? executionContext.scopeRoots : this.buildSelectionScopeRoots(selection.filePath)
      },
      action
    );
    const flowAudit = flowResult.audit && typeof flowResult.audit === "object" ? flowResult.audit : {};
    if (typeof flowAudit.currentSelectionHash === "string") {
      auditState.currentSelectionHash = flowAudit.currentSelectionHash;
    }
    if (typeof flowAudit.expectedSelectionHash === "string") {
      auditState.expectedSelectionHash = flowAudit.expectedSelectionHash;
    }
    if (typeof flowAudit.diffHash === "string") {
      auditState.diffHash = flowAudit.diffHash;
    }
    if (Number.isFinite(flowAudit.changedLines)) {
      auditState.changedLines = flowAudit.changedLines;
    }
    if (typeof flowAudit.applyMode === "string") {
      auditState.applyMode = flowAudit.applyMode;
    }
    if (flowResult.nextSelection) {
      executionContext.openSelection = flowResult.nextSelection;
      auditState.selectionFrom = flowResult.nextSelection.fromOffset;
      auditState.selectionTo = flowResult.nextSelection.toOffset;
      auditState.filePath = flowResult.nextSelection.filePath || auditState.filePath;
    }
    return finalize(
      flowResult.status || "error",
      flowResult.title || "apply_selection_diff",
      flowResult.detail || "Unknown apply_patch_flow error.",
      flowAudit
    );
  }
  evaluateQaActionPlanSafeguard(plan, context = {}) {
    const reasons = [];
    let containsExternalAccess = false;
    let modifiesOutsideWorkspace = false;
    let isMassEdit = false;
    const taskType = context.taskType || plan.taskType || "QA_CHAT";
    const openSelection = context.openSelection || plan.openSelection || null;
    let mutatingActions = 0;
    let applySelectionDiffActions = 0;
    for (const action of plan.actions) {
      if (action.type === "run_shell") {
        const command = (action.command || "").toLowerCase();
        if (/(https?:\/\/|curl\s|wget\s|browser|open\s|osascript|xdg-open|start\s+)/i.test(command)) {
          containsExternalAccess = true;
          reasons.push("run_shell contains external/network/browser access signal.");
        }
        if (taskType === "EDIT_NOTE") {
          containsExternalAccess = true;
          reasons.push("EDIT_NOTE task blocks run_shell action.");
        }
      }
      if (action.type === "list_folder") {
        const folderPath = (action.path || "").trim();
        if (folderPath === "." || folderPath === "/" || folderPath === "\\") {
          isMassEdit = true;
          reasons.push("Vault-wide folder scan is blocked by safeguard.");
        }
      }
      if (action.type === "write_note" || action.type === "append_note" || action.type === "delete_note" || action.type === "apply_selection_diff") {
        mutatingActions += 1;
      }
      if (action.type === "apply_selection_diff") {
        applySelectionDiffActions += 1;
        const validation = this.validateSelectionDiffActionAgainstOpenSelection(action, openSelection);
        if (!validation.ok) {
          isMassEdit = true;
          reasons.push(`apply_selection_diff contract violation: ${validation.error}`);
        }
      }
      if (typeof action.path === "string" && this.isAbsoluteQaPath(action.path.trim()) && !this.settings.qaAgentShellFullAccess) {
        try {
          this.resolveQaAgentPathTarget(
            action.path,
            `${action.type}.path`,
            action.type === "list_folder" ? "folder" : "file"
          );
        } catch (error) {
          modifiesOutsideWorkspace = true;
          reasons.push(`Action path outside allowed workspace roots: ${action.path}`);
        }
      }
    }
    if (taskType === "EDIT_NOTE" && plan.actions.some(
      (action) => action.type === "write_note" || action.type === "append_note" || action.type === "delete_note"
    )) {
      isMassEdit = true;
      reasons.push("EDIT_NOTE task only allows selection diff edits.");
    }
    if (taskType === "EDIT_NOTE" && applySelectionDiffActions !== 1) {
      isMassEdit = true;
      reasons.push(`EDIT_NOTE task requires exactly one apply_selection_diff action (found ${applySelectionDiffActions}).`);
    }
    if (mutatingActions > 6) {
      isMassEdit = true;
      reasons.push(`Too many mutating actions (${mutatingActions}).`);
    }
    const passed = !containsExternalAccess && !modifiesOutsideWorkspace && !isMassEdit;
    return {
      passed,
      containsExternalAccess,
      modifiesOutsideWorkspace,
      isMassEdit,
      reasons
    };
  }
  formatQaSafeguardFailureText(safety) {
    const header = "### Safeguard blocked action plan";
    const detailLines = safety.reasons.length > 0 ? safety.reasons.map((reason) => `- ${reason}`) : ["- blocked by safeguard rules"];
    return [header, ...detailLines].join("\n");
  }
  resolveSafeQaAgentPath(rawPath, label) {
    const normalized = (0, import_obsidian4.normalizePath)((rawPath != null ? rawPath : "").trim());
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} must be a safe vault-relative path.`);
    }
    return normalized;
  }
  getVaultBasePathForQaShell() {
    const adapter = this.app.vault.adapter;
    if (typeof adapter.getBasePath !== "function") {
      throw new Error("Shell tool requires desktop filesystem vault adapter.");
    }
    const base = adapter.getBasePath();
    if (!base || typeof base !== "string") {
      throw new Error("Could not resolve vault base path for shell tool.");
    }
    return base;
  }
  parseQaAgentAbsoluteAllowlist() {
    return this.settings.qaAgentPathAllowlist.split(/[\n,;]+/).map((item) => item.trim()).filter((item) => item.length > 0).filter((item) => item.startsWith("/") || /^[A-Za-z]:/.test(item)).map((item) => nodePath.resolve(item)).filter((item, index, arr) => arr.indexOf(item) === index);
  }
  isPathInsideAnyAllowedRoot(resolvedPath, allowedRoots) {
    return allowedRoots.some((root) => {
      const normalizedRoot = nodePath.resolve(root);
      const relative2 = nodePath.relative(normalizedRoot, resolvedPath);
      return relative2 === "" || !relative2.startsWith("..") && !nodePath.isAbsolute(relative2);
    });
  }
  isAbsoluteQaPath(pathValue) {
    return pathValue.startsWith("/") || /^[A-Za-z]:/.test(pathValue);
  }
  resolveQaAgentPathTarget(rawPath, label, kind) {
    const requested = (rawPath != null ? rawPath : "").trim();
    if (!requested) {
      throw new Error(`${label} is required.`);
    }
    if (!this.isAbsoluteQaPath(requested)) {
      if (kind === "folder") {
        return {
          mode: "vault",
          path: this.resolveSafeFolderPath(requested, ".", label)
        };
      }
      return {
        mode: "vault",
        path: this.resolveSafeQaAgentPath(requested, label)
      };
    }
    const resolved = nodePath.resolve(requested);
    if (this.settings.qaAgentShellFullAccess) {
      return {
        mode: "absolute",
        path: resolved
      };
    }
    const allowedRoots = [
      nodePath.resolve(this.getVaultBasePathForQaShell()),
      ...this.parseQaAgentAbsoluteAllowlist()
    ];
    if (!this.isPathInsideAnyAllowedRoot(resolved, allowedRoots)) {
      throw new Error(
        `${label} absolute path is blocked. Allowed roots: ${allowedRoots.join(", ") || "(none)"}`
      );
    }
    return {
      mode: "absolute",
      path: resolved
    };
  }
  sanitizeQaShellCwdPath(rawCwd) {
    const requested = (rawCwd != null ? rawCwd : "").trim();
    if (!requested) {
      return "";
    }
    if (requested.startsWith("/") || /^[A-Za-z]:/.test(requested)) {
      const resolved = nodePath.resolve(requested);
      if (this.settings.qaAgentShellFullAccess) {
        return resolved;
      }
      const allowedRoots = this.parseQaAgentAbsoluteAllowlist();
      if (!this.isPathInsideAnyAllowedRoot(resolved, allowedRoots)) {
        throw new Error(
          `Shell cwd must be inside allowlist roots: ${allowedRoots.join(", ") || "(none)"}`
        );
      }
      return resolved;
    }
    return this.resolveSafeFolderPath(requested, ".", "Shell cwd");
  }
  resolveQaShellCwd(rawCwd) {
    var _a;
    const basePath = this.getVaultBasePathForQaShell();
    const baseResolved = nodePath.resolve(basePath);
    const fullAccess = this.settings.qaAgentShellFullAccess;
    const allowedRoots = [baseResolved, ...this.parseQaAgentAbsoluteAllowlist()];
    const requested = ((_a = rawCwd != null ? rawCwd : this.settings.qaAgentShellCwdPath) != null ? _a : "").trim();
    if (!requested) {
      return baseResolved;
    }
    const sanitized = this.sanitizeQaShellCwdPath(requested);
    const resolved = sanitized.startsWith("/") || /^[A-Za-z]:/.test(sanitized) ? nodePath.resolve(sanitized) : nodePath.resolve(baseResolved, sanitized);
    if (fullAccess) {
      return resolved;
    }
    if (!this.isPathInsideAnyAllowedRoot(resolved, allowedRoots)) {
      throw new Error(
        `Shell cwd must stay inside vault or allowlist roots: ${allowedRoots.join(", ")}`
      );
    }
    return resolved;
  }
  async writeVaultTextFile(path, content) {
    await this.ensureParentFolder(path);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian4.TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    const exists = await this.app.vault.adapter.exists(path);
    if (exists) {
      await this.app.vault.adapter.write(path, content);
      return;
    }
    await this.app.vault.create(path, content);
  }
  async executeQaAgentAction(action, executionContext = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    try {
      if ((executionContext.taskType || "QA_CHAT") === "EDIT_NOTE" && action.type !== "apply_selection_diff") {
        return {
          status: "blocked",
          title: this.summarizeQaAgentAction(action),
          detail: "EDIT_NOTE task only allows apply_selection_diff. Other mutating routes are blocked by PR-0 flow."
        };
      }
      if (action.type === "read_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "read_note.path",
          "file"
        );
        let content = "";
        if (target.mode === "vault") {
          const exists = await this.app.vault.adapter.exists(target.path);
          if (!exists) {
            return {
              status: "error",
              title: `read_note ${target.path}`,
              detail: "File does not exist."
            };
          }
          content = await this.app.vault.adapter.read(target.path);
        } else {
          try {
            content = await nodeFs.promises.readFile(target.path, "utf8");
          } catch (e) {
            return {
              status: "error",
              title: `read_note ${target.path}`,
              detail: "File does not exist or is not readable."
            };
          }
        }
        return {
          status: "ok",
          title: `read_note ${target.path}`,
          detail: this.trimQaToolText(content, 2400)
        };
      }
      if (action.type === "write_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "write_note.path",
          "file"
        );
        const content = (_a = action.content) != null ? _a : "";
        if (target.mode === "vault") {
          await this.writeVaultTextFile(target.path, content);
        } else {
          await nodeFs.promises.mkdir(nodePath.dirname(target.path), { recursive: true });
          await nodeFs.promises.writeFile(target.path, content, "utf8");
        }
        return {
          status: "ok",
          title: `write_note ${target.path}`,
          detail: `Wrote ${content.length} chars.`
        };
      }
      if (action.type === "append_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "append_note.path",
          "file"
        );
        const appendText = (_b = action.content) != null ? _b : "";
        let previous = "";
        if (target.mode === "vault") {
          const exists = await this.app.vault.adapter.exists(target.path);
          previous = exists ? await this.app.vault.adapter.read(target.path) : "";
        } else {
          try {
            previous = await nodeFs.promises.readFile(target.path, "utf8");
          } catch (e) {
            previous = "";
          }
        }
        const separator = previous.length > 0 && !previous.endsWith("\n") && appendText.length > 0 && !appendText.startsWith("\n") ? "\n" : "";
        const merged = `${previous}${separator}${appendText}`;
        if (target.mode === "vault") {
          await this.writeVaultTextFile(target.path, merged);
        } else {
          await nodeFs.promises.mkdir(nodePath.dirname(target.path), { recursive: true });
          await nodeFs.promises.writeFile(target.path, merged, "utf8");
        }
        return {
          status: "ok",
          title: `append_note ${target.path}`,
          detail: `Appended ${appendText.length} chars (total ${merged.length}).`
        };
      }
      if (action.type === "delete_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "delete_note.path",
          "file"
        );
        if (target.mode === "vault") {
          const entry = this.app.vault.getAbstractFileByPath(target.path);
          if (entry instanceof import_obsidian4.TFile) {
            await this.app.vault.delete(entry, true);
          } else {
            const exists = await this.app.vault.adapter.exists(target.path);
            if (!exists) {
              return {
                status: "error",
                title: `delete_note ${target.path}`,
                detail: "File does not exist."
              };
            }
            await this.app.vault.adapter.remove(target.path);
          }
        } else {
          try {
            const stat = await nodeFs.promises.stat(target.path);
            if (stat.isDirectory()) {
              return {
                status: "blocked",
                title: `delete_note ${target.path}`,
                detail: "Path is a directory. delete_note only allows file deletion."
              };
            }
            await nodeFs.promises.unlink(target.path);
          } catch (error) {
            return {
              status: "error",
              title: `delete_note ${target.path}`,
              detail: "File does not exist or cannot be deleted."
            };
          }
        }
        return {
          status: "ok",
          title: `delete_note ${target.path}`,
          detail: "File deleted."
        };
      }
      if (action.type === "list_folder") {
        const target = this.resolveQaAgentPathTarget(
          action.path || ".",
          "list_folder.path",
          "folder"
        );
        const lines = [
          `folder=${target.path}`
        ];
        let folders = [];
        let files = [];
        if (target.mode === "vault") {
          const listing = await this.app.vault.adapter.list(target.path);
          folders = listing.folders;
          files = listing.files;
          lines.push(`folders=${folders.length}, files=${files.length}`);
        } else {
          const entries = await nodeFs.promises.readdir(target.path, { withFileTypes: true });
          for (const entry of entries) {
            const resolved = nodePath.join(target.path, entry.name);
            if (entry.isDirectory()) {
              folders.push(resolved);
            } else {
              files.push(resolved);
            }
          }
          folders.sort((a, b) => a.localeCompare(b));
          files.sort((a, b) => a.localeCompare(b));
          lines.push(`folders=${folders.length}, files=${files.length}`);
        }
        const folderPreview = folders.slice(0, 30);
        const filePreview = files.slice(0, 40);
        if (folders.length > 0) {
          lines.push("subfolders:");
          for (const folder of folderPreview) {
            lines.push(`- ${folder}`);
          }
          if (folders.length > folderPreview.length) {
            lines.push(`- ...and ${folders.length - folderPreview.length} more`);
          }
        }
        if (files.length > 0) {
          lines.push("files:");
          for (const file of filePreview) {
            lines.push(`- ${file}`);
          }
          if (files.length > filePreview.length) {
            lines.push(`- ...and ${files.length - filePreview.length} more`);
          }
        }
        return {
          status: "ok",
          title: `list_folder ${target.path}`,
          detail: lines.join("\n")
        };
      }
      if (action.type === "apply_selection_diff") {
        return await this.executeSelectionDiffAction(action, executionContext);
      }
      if (action.type === "run_shell") {
        if (!this.settings.qaAgentAllowShellTool) {
          return {
            status: "blocked",
            title: "run_shell",
            detail: "Blocked by settings: 'Allow shell tool (danger)' is disabled."
          };
        }
        const command = ((_c = action.command) != null ? _c : "").trim();
        if (!command) {
          return {
            status: "error",
            title: "run_shell",
            detail: "command is empty."
          };
        }
        const timeoutSec = Math.max(
          3,
          Math.min(
            300,
            Math.floor((_d = action.timeoutSec) != null ? _d : this.settings.qaAgentShellTimeoutSec)
          )
        );
        const cwd = this.resolveQaShellCwd(action.cwd);
        const output = await execAsync(command, {
          cwd,
          timeout: timeoutSec * 1e3,
          maxBuffer: 1024 * 1024
        });
        const stdout = this.trimQaToolText(String((_e = output.stdout) != null ? _e : ""), 2e3);
        const stderr = this.trimQaToolText(String((_f = output.stderr) != null ? _f : ""), 1600);
        const lines = [
          `cwd=${cwd}`,
          `timeout=${timeoutSec}s`,
          stdout ? `stdout:
${stdout}` : "stdout: (empty)",
          stderr ? `stderr:
${stderr}` : "stderr: (empty)"
        ];
        return {
          status: "ok",
          title: "run_shell",
          detail: lines.join("\n")
        };
      }
      return {
        status: "error",
        title: `unsupported action: ${String(action.type)}`,
        detail: "Unsupported action type."
      };
    } catch (error) {
      if (action.type === "run_shell") {
        const shellError = error;
        const stdout = this.trimQaToolText(String((_g = shellError.stdout) != null ? _g : ""), 1800);
        const stderr = this.trimQaToolText(String((_h = shellError.stderr) != null ? _h : ""), 1800);
        const details = [
          (_i = shellError.message) != null ? _i : "Shell execution failed.",
          shellError.code !== void 0 ? `code=${String(shellError.code)}` : "",
          shellError.signal ? `signal=${shellError.signal}` : "",
          stdout ? `stdout:
${stdout}` : "",
          stderr ? `stderr:
${stderr}` : ""
        ].filter((line) => line.length > 0).join("\n");
        return {
          status: "error",
          title: "run_shell",
          detail: details
        };
      }
      const message = error instanceof Error ? error.message : "Unknown action error";
      return {
        status: "error",
        title: this.summarizeQaAgentAction(action),
        detail: message
      };
    }
  }
  async executeQaAgentActionPlan(plan, onEvent) {
    const lines = [
      "### Agent action execution report / \uC5D0\uC774\uC804\uD2B8 \uC561\uC158 \uC2E4\uD589 \uB9AC\uD3EC\uD2B8",
      `Plan ID: ${plan.id}`,
      `Actions: ${plan.actions.length}`,
      ""
    ];
    const executionContext = {
      openSelection: plan.openSelection || null,
      taskType: plan.taskType || "QA_CHAT",
      routingLog: plan.routingLog || null,
      planId: plan.id
    };
    for (let index = 0; index < plan.actions.length; index += 1) {
      const action = plan.actions[index];
      const actionLabel = this.summarizeQaAgentAction(action);
      this.emitQaEvent(
        onEvent,
        "info",
        `Executing action ${index + 1}/${plan.actions.length}: ${actionLabel}`
      );
      const result = await this.executeQaAgentAction(action, executionContext);
      if (result.status === "ok") {
        this.emitQaEvent(onEvent, "info", `Action completed: ${actionLabel}`);
      } else if (result.status === "blocked") {
        this.emitQaEvent(onEvent, "warning", `Action blocked: ${actionLabel}`, {
          detail: result.detail
        });
      } else {
        this.emitQaEvent(onEvent, "error", `Action failed: ${actionLabel}`, {
          detail: result.detail
        });
      }
      lines.push(
        `#### ${index + 1}. [${result.status.toUpperCase()}] ${result.title}`
      );
      if (result.detail) {
        lines.push(result.detail);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }
  buildQaAgentControlResult(question, answer) {
    return {
      question: question.trim(),
      answer,
      thinking: "",
      model: "agent-tools",
      embeddingModel: this.settings.semanticOllamaModel.trim() || "(none)",
      sources: [],
      retrievalCacheHits: 0,
      retrievalCacheWrites: 0
    };
  }
  async applyQaAgentActionsFromAnswer(params) {
    const { answer, question, qaModel, onEvent, abortSignal, openSelection, taskType, routingLog } = params;
    if (abortSignal == null ? void 0 : abortSignal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    if (!this.settings.qaAgentToolModeEnabled) {
      return answer;
    }
    const parsed = this.parseQaAgentActionPlanFromAnswer({
      answer,
      question,
      model: qaModel
    });
    if (!parsed.plan) {
      if (taskType === "EDIT_NOTE") {
        const reason = parsed.warning || "Missing omni-forge-actions block for EDIT_NOTE.";
        return [
          parsed.answerWithoutPlan,
          "### Safeguard blocked action plan",
          `- ${reason}`,
          "- EDIT_NOTE는 apply_selection_diff(unified diff) 액션이 필요합니다."
        ].filter((line) => line.trim().length > 0).join("\n\n");
      }
      if (!parsed.warning) {
        return parsed.answerWithoutPlan;
      }
      const warningLine = `> Agent action parse warning: ${parsed.warning}`;
      return [parsed.answerWithoutPlan, warningLine].filter((line) => line.trim()).join("\n\n");
    }
    if (parsed.warning) {
      this.emitQaEvent(onEvent, "warning", parsed.warning);
    }
    if ((taskType || "QA_CHAT") === "EDIT_NOTE" && parsed.answerWithoutPlan.trim().length > 0) {
      this.emitQaEvent(onEvent, "warning", "EDIT_NOTE contract violation: non-diff text detected.");
      return [
        parsed.answerWithoutPlan,
        "### Safeguard blocked action plan",
        `- Coder Prompt Contract ${CODER_PROMPT_CONTRACT_VERSION}: unified diff only output is required.`,
        "- diff 외 텍스트가 포함되어 실행을 차단했습니다. 패치를 재생성하세요."
      ].filter((line) => line.trim().length > 0).join("\n\n");
    }
    parsed.plan.taskType = taskType || "QA_CHAT";
    parsed.plan.openSelection = openSelection || null;
    if (routingLog && typeof routingLog === "object") {
      parsed.plan.routingLog = {
        taskType: routingLog.taskType,
        roles: [...routingLog.roles],
        modelUsed: [...routingLog.modelUsed],
        fallbackUsed: routingLog.fallbackUsed,
        safeguardPassed: routingLog.safeguardPassed
      };
    }
    const safety = this.evaluateQaActionPlanSafeguard(parsed.plan, {
      taskType: parsed.plan.taskType,
      openSelection: parsed.plan.openSelection
    });
    if (!safety.passed) {
      if (routingLog && typeof routingLog === "object") {
        routingLog.safeguardPassed = false;
      }
      this.emitQaEvent(onEvent, "warning", "Safeguard blocked agent action plan.", {
        detail: safety.reasons.join(" | ")
      });
      return [
        parsed.answerWithoutPlan || "(Action-only response)",
        this.formatQaSafeguardFailureText(safety)
      ].filter((line) => line.trim().length > 0).join("\n\n");
    }
    if (routingLog && typeof routingLog === "object") {
      routingLog.safeguardPassed = true;
    }
    if (this.settings.qaAgentRequireApproval) {
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      this.pendingQaActionPlan = parsed.plan;
      this.emitQaEvent(
        onEvent,
        "info",
        `Queued ${parsed.plan.actions.length} action(s) for manual approval.`
      );
      return [
        parsed.answerWithoutPlan || "(Action-only response)",
        this.buildQaActionApprovalText(parsed.plan)
      ].filter((line) => line.trim().length > 0).join("\n\n");
    }
    if (abortSignal == null ? void 0 : abortSignal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const report = await this.executeQaAgentActionPlan(parsed.plan, onEvent);
    return [parsed.answerWithoutPlan, report].filter((line) => line.trim().length > 0).join("\n\n");
  }
  normalizeQaExternalAttachments(attachments) {
    var _a, _b, _c, _d, _e;
    const textDocs = [];
    const images = [];
    const imageLabels = [];
    const pdfLabels = [];
    const imageItems = [];
    const pdfItems = [];
    for (const attachment of attachments.slice(0, LOCAL_QA_MAX_ATTACHMENTS)) {
      if (attachment.kind === "image") {
        const base64 = ((_a = attachment.imageBase64) != null ? _a : "").trim();
        if (base64) {
          images.push(base64);
          const label2 = (attachment.label || attachment.path || `image-${images.length}`).trim();
          const path2 = (_b = attachment.path) == null ? void 0 : _b.trim();
          imageLabels.push(label2);
          imageItems.push({ label: label2, path: path2 });
        }
      }
      if (attachment.kind === "pdf") {
        const label2 = (attachment.label || attachment.path || `pdf-${pdfLabels.length + 1}`).trim();
        const path2 = (_c = attachment.path) == null ? void 0 : _c.trim();
        pdfLabels.push(label2);
        pdfItems.push({ label: label2, path: path2 });
      }
      const content = this.trimQaToolText(((_d = attachment.content) != null ? _d : "").trim(), 12e3);
      if (!content) {
        continue;
      }
      const label = (attachment.label || attachment.path || `document-${textDocs.length + 1}`).trim();
      const path = (_e = attachment.path) == null ? void 0 : _e.trim();
      textDocs.push({
        label,
        path,
        content
      });
    }
    return {
      textDocs: textDocs.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      images: images.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      imageLabels: imageLabels.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      pdfLabels: pdfLabels.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      imageItems: imageItems.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      pdfItems: pdfItems.slice(0, LOCAL_QA_MAX_ATTACHMENTS)
    };
  }
  async askLocalQa(question, topK, history = [], onToken, onEvent, abortSignal, externalAttachments = [], options = {}) {
    var _a;
    const safeQuestion = question.trim();
    if (!safeQuestion) {
      throw new Error("Question is empty.");
    }
    const throwIfAborted = () => {
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
    };
    throwIfAborted();
    if (this.settings.qaAgentToolModeEnabled) {
      const approvalCommand = this.parseQaAgentApprovalCommand(safeQuestion);
      if (approvalCommand) {
        if (!this.pendingQaActionPlan) {
          return this.buildQaAgentControlResult(
            safeQuestion,
            "\uB300\uAE30 \uC911\uC778 \uC561\uC158 \uACC4\uD68D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. / No pending action plan."
          );
        }
        if (approvalCommand === "deny") {
          const cancelled = this.pendingQaActionPlan;
          this.pendingQaActionPlan = null;
          return this.buildQaAgentControlResult(
            safeQuestion,
            `\uACC4\uD68D\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4: ${cancelled.id} (${cancelled.actions.length} actions).`
          );
        }
        const plan = this.pendingQaActionPlan;
        this.pendingQaActionPlan = null;
        const safety = this.evaluateQaActionPlanSafeguard(plan, {
          taskType: plan.taskType || "QA_CHAT",
          openSelection: plan.openSelection || null
        });
        if (!safety.passed) {
          if (plan.routingLog && typeof plan.routingLog === "object") {
            plan.routingLog.safeguardPassed = false;
          }
          return this.buildQaAgentControlResult(
            safeQuestion,
            this.formatQaSafeguardFailureText(safety)
          );
        }
        if (plan.routingLog && typeof plan.routingLog === "object") {
          plan.routingLog.safeguardPassed = true;
        }
        const report = await this.executeQaAgentActionPlan(plan, onEvent);
        return this.buildQaAgentControlResult(safeQuestion, report);
      }
    }
    const qaContextEnabled = this.settings.qaContextInChat;
    const selectedFiles = qaContextEnabled ? this.getSelectedFiles() : [];
    const normalizedExternal = this.normalizeQaExternalAttachments(externalAttachments);
    const openFilePath = (0, import_obsidian4.normalizePath)(((_a = options.openFilePath) != null ? _a : "").trim());
    const openFileEntry = openFilePath ? this.app.vault.getAbstractFileByPath(openFilePath) : null;
    const openFile = openFileEntry instanceof import_obsidian4.TFile && openFileEntry.extension === "md" ? openFileEntry : null;
    const openSelection = this.normalizeQaOpenSelectionContext(options.openSelection, openFilePath);
    const hasImageAttachments = normalizedExternal.images.length > 0;
    const hasPdfAttachments = normalizedExternal.pdfLabels.length > 0;
    const hasVisionAttachments = hasImageAttachments;
    const isCloudFamily = this.getQaChatModelFamilyForQa() === "cloud";
    const hasExternalContext = normalizedExternal.textDocs.length > 0 || normalizedExternal.images.length > 0 || normalizedExternal.pdfLabels.length > 0;
    const routingContext = {
      hasSelection: Boolean(openSelection),
      hasOpenFile: Boolean(openFilePath),
      hasAttachments: hasExternalContext
    };
    const intent = this.detectLocalQaIntent(safeQuestion);
    const preferDetailed = this.shouldPreferDetailedAnswer(safeQuestion, intent);
    const safeTopK = Math.max(1, Math.min(15, topK));
    let qaBaseUrl = this.resolveQaBaseUrl();
    if (!qaBaseUrl) {
      throw new Error("Q&A base URL is empty.");
    }
    if (!isCloudFamily && !this.isLocalEndpoint(qaBaseUrl)) {
      const localBase = this.settings.ollamaBaseUrl.trim();
      if (localBase && this.isLocalEndpoint(localBase)) {
        qaBaseUrl = localBase;
        this.settings.qaOllamaBaseUrl = localBase;
        void this.saveSettings().catch(() => {
        });
        this.emitQaEvent(
          onEvent,
          "info",
          "Local mode: restored Q&A base URL to local Ollama endpoint."
        );
      }
    }
    if (isCloudFamily) {
      let changed = false;
      if (!this.settings.qaAllowNonLocalEndpoint) {
        this.settings.qaAllowNonLocalEndpoint = true;
        changed = true;
        this.emitQaEvent(
          onEvent,
          "info",
          "Cloud mode: auto-enabled non-local endpoint policy for this session."
        );
      }
      const beforeAllowlist = this.settings.qaAllowedOutboundHosts;
      this.appendQaAllowedOutboundHostFromUrl(qaBaseUrl);
      if (beforeAllowlist !== this.settings.qaAllowedOutboundHosts) {
        changed = true;
        this.emitQaEvent(
          onEvent,
          "info",
          "Cloud mode: endpoint host added to outbound allowlist."
        );
      }
      if (changed) {
        void this.saveSettings().catch(() => {
        });
      }
    }
    this.emitQaEvent(
      onEvent,
      "info",
      `Endpoint policy precheck: family=${isCloudFamily ? "cloud" : "local"}, base=${qaBaseUrl}, allowNonLocal=${this.settings.qaAllowNonLocalEndpoint ? "ON" : "OFF"}`
    );
    const endpointPolicyError = this.validateQaEndpointPolicy(qaBaseUrl);
    if (endpointPolicyError) {
      throw new Error(endpointPolicyError);
    }
    if (!qaContextEnabled) {
      this.emitQaEvent(
        onEvent,
        "retrieval",
        "QA context is disabled; running general chat without selected-note retrieval."
      );
    }
    let primaryRole = this.resolveQaPrimaryRole();
    if (hasVisionAttachments && !isCloudFamily && primaryRole !== "ask_vision") {
      primaryRole = "ask_vision";
      this.emitQaEvent(
        onEvent,
        "info",
        "Vision-compatible image attachments detected; switching role to Ask (vision) for this turn."
      );
    }
    let qaModel = this.resolveQaModelForRole(primaryRole);
    const detectedModels = this.getDetectedOllamaModelNames();
    if (!isCloudFamily && qaModel && detectedModels.length > 0 && !this.hasDetectedOllamaModel(qaModel)) {
      const roleFallback = this.resolveDetectedRoleFallbackModel(primaryRole);
      if (roleFallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Selected ${primaryRole} model is not detected (${qaModel}); fallback to ${roleFallback}`
        );
        qaModel = roleFallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Selected ${primaryRole} model is not detected (${qaModel}); continuing with configured value.`
        );
      }
    }
    if (!isCloudFamily && hasVisionAttachments && !this.isVisionCapableModel(qaModel)) {
      const visionFallback = this.resolveVisionModelForImageAttachments();
      if (visionFallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Current model is text-only for image input. Switching to vision model: ${visionFallback}`
        );
        qaModel = visionFallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "error",
          "No vision-capable local model detected. Image understanding is unavailable in current setup."
        );
        throw new Error(
          "\uBE44\uC804 \uBAA8\uB378\uC774 \uAC10\uC9C0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC774\uBBF8\uC9C0/PDF \uCCA8\uBD80\uB97C \uCC98\uB9AC\uD558\uB824\uBA74 Guide\uC758 \uBE44\uC804 \uBAA8\uB378 \uC124\uCE58 \uC548\uB0B4\uB97C \uBA3C\uC800 \uC644\uB8CC\uD558\uC138\uC694."
        );
      }
    }
    if (!qaModel) {
      throw new Error("Q&A model is empty.");
    }
    if (!isCloudFamily && !isOllamaModelAllowedForQaRole(primaryRole, qaModel)) {
      throw new Error(`Q&A model is not suitable: ${qaModel}`);
    }
    const routingLog = this.buildTaskRoutingForQa(safeQuestion, routingContext, qaModel);
    this.lastQaRoutingLog = {
      taskType: routingLog.taskType,
      roles: [...routingLog.roles],
      modelUsed: [...routingLog.modelUsed],
      fallbackUsed: routingLog.fallbackUsed,
      safeguardPassed: routingLog.safeguardPassed
    };
    this.emitQaEvent(
      onEvent,
      "info",
      `RoleRouter: task=${routingLog.taskType} | roles=${routingLog.roles.join(" -> ")}`
    );
    if (routingLog.modelUsed.length > 0) {
      this.emitQaEvent(
        onEvent,
        "info",
        `RoleRouter models: ${routingLog.modelUsed.join(", ")}${routingLog.fallbackUsed ? " (fallback used)" : ""}`
      );
    }
    this.emitQaEvent(onEvent, "generation", `Primary QA model selected: ${qaModel}`);
    try {
      throwIfAborted();
      let embeddingModel = this.settings.semanticOllamaModel.trim();
      let retrievalCacheHits = 0;
      let retrievalCacheWrites = 0;
      const maxContextChars = this.resolveQaContextCharLimit(intent);
      let sourceBlocks = [];
      if (selectedFiles.length > 0 && embeddingModel) {
        this.setStatus("semantic retrieval for local qa...");
        this.emitQaEvent(onEvent, "retrieval", "Embedding retrieval started");
        try {
          throwIfAborted();
          const retrievalCandidateK = this.resolveQaRetrievalCandidateK(intent, safeTopK);
          const retrieval = await searchSemanticNotesByQuery(
            this.app,
            selectedFiles,
            this.settings,
            safeQuestion,
            retrievalCandidateK,
            abortSignal
          );
          retrievalCacheHits = retrieval.cacheHits;
          retrievalCacheWrites = retrieval.cacheWrites;
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `Retrieved ${retrieval.hits.length} candidates (cache hits=${retrieval.cacheHits}, writes=${retrieval.cacheWrites})`
          );
          if (retrieval.errors.length > 0) {
            this.notice(`Semantic retrieval had ${retrieval.errors.length} issue(s).`, 6e3);
            this.emitQaEvent(
              onEvent,
              "warning",
              `Retrieval warnings: ${retrieval.errors.length}`
            );
          }
          if (retrieval.hits.length === 0 && !hasExternalContext) {
            throw new Error("No relevant notes were found for this question.");
          }
          const rankedHits = this.rerankQaHits(
            retrieval.hits,
            safeQuestion,
            this.resolveQaRerankTopK(intent, safeTopK)
          );
          const queryTerms = this.tokenizeQuery(safeQuestion);
          const sourceCandidates = [];
          let usedChars = 0;
          for (const hit of rankedHits) {
            throwIfAborted();
            if (usedChars >= maxContextChars) {
              break;
            }
            const entry = this.app.vault.getAbstractFileByPath(hit.path);
            if (!(entry instanceof import_obsidian4.TFile)) {
              continue;
            }
            const raw = await this.app.vault.cachedRead(entry);
            throwIfAborted();
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
          sourceBlocks = sourceCandidates.slice(0, sourceLimit).map((item) => ({
            path: item.path,
            similarity: item.similarity,
            content: item.content
          }));
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `Context built from ${sourceBlocks.length} notes (${usedChars} chars)`
          );
        } catch (error) {
          if (this.isAbortError(error)) {
            throw error;
          }
          if (!hasExternalContext) {
            throw error;
          }
          const message = error instanceof Error ? error.message : "Unknown semantic retrieval error";
          this.emitQaEvent(
            onEvent,
            "warning",
            `Semantic retrieval failed. Falling back to attachments: ${message}`
          );
          this.notice(`Semantic retrieval fallback: ${message}`, 7e3);
          sourceBlocks = [];
        }
      } else if (selectedFiles.length > 0 && !embeddingModel) {
        if (!hasExternalContext) {
          throw new Error("Embedding model is empty. Refresh embedding detection first.");
        }
        this.emitQaEvent(
          onEvent,
          "warning",
          "Embedding model is empty. Selected-note retrieval skipped; using attachments only."
        );
        embeddingModel = "(attachments-priority)";
      } else if (!hasExternalContext && openFile instanceof import_obsidian4.TFile) {
        const openRaw = await this.app.vault.cachedRead(openFile);
        throwIfAborted();
        const snippet = this.extractRelevantSnippet(openRaw, safeQuestion, maxContextChars);
        if (snippet.trim().length > 0) {
          sourceBlocks = [{
            path: openFile.path,
            similarity: 1,
            content: snippet
          }];
          embeddingModel = "(open-file-fallback)";
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `No selected scope/attachments. Using currently open file: ${openFile.path}`
          );
        } else {
          embeddingModel = "(open-file-empty)";
          this.emitQaEvent(
            onEvent,
            "warning",
            `Open file detected but no readable text: ${openFile.path}`
          );
        }
      } else if (hasExternalContext) {
        this.emitQaEvent(onEvent, "retrieval", "Skipping semantic retrieval (attachments only)");
        embeddingModel = "(attachments-only)";
      } else {
        this.emitQaEvent(onEvent, "retrieval", "No selected notes/attachments: general chat mode");
        embeddingModel = "(general-chat)";
      }
      if (normalizedExternal.textDocs.length > 0) {
        const attachmentBlocks = normalizedExternal.textDocs.map((doc, index) => ({
          path: doc.path || `[ATTACHMENT-DOC] ${doc.label || `document-${index + 1}`}`,
          similarity: 1,
          content: this.trimQaToolText(
            [
              "Attachment document (PRIMARY EVIDENCE)",
              `Label: ${doc.label || `document-${index + 1}`}`,
              doc.path ? `Original path: ${doc.path}` : "Original path: (external attachment)",
              "---",
              doc.content
            ].join("\n"),
            Math.max(900, Math.floor(maxContextChars * 0.6))
          )
        }));
        sourceBlocks = [...attachmentBlocks, ...sourceBlocks];
        this.emitQaEvent(
          onEvent,
          "retrieval",
          `Included ${attachmentBlocks.length} attached text document(s).`
        );
      }
      if (sourceBlocks.length > 0) {
        const trimmedBlocks = [];
        let used = 0;
        for (const block of sourceBlocks) {
          throwIfAborted();
          const remaining = maxContextChars - used;
          if (remaining < 160) {
            break;
          }
          const nextContent = this.trimQaToolText(block.content, remaining);
          if (!nextContent.trim()) {
            continue;
          }
          trimmedBlocks.push({
            path: block.path,
            similarity: block.similarity,
            content: nextContent
          });
          used += nextContent.length;
        }
        sourceBlocks = trimmedBlocks;
      }
      if (sourceBlocks.length === 0 && (normalizedExternal.images.length > 0 || normalizedExternal.pdfLabels.length > 0)) {
        const imageBlocks = normalizedExternal.imageItems.map((item, index) => {
          var _a2;
          return {
            path: ((_a2 = item.path) == null ? void 0 : _a2.trim()) || `[ATTACHMENT-IMAGE] ${item.label || `image-${index + 1}`}`,
            similarity: 1,
            content: "Image attachment (model should inspect attached image input)."
          };
        });
        const pdfBlocks = normalizedExternal.pdfItems.map((item, index) => {
          var _a2;
          return {
            path: ((_a2 = item.path) == null ? void 0 : _a2.trim()) || `[ATTACHMENT-PDF] ${item.label || `pdf-${index + 1}`}`,
            similarity: 1,
            content: "PDF attachment (if direct parsing is limited, request converted image/text excerpts for precise grounding)."
          };
        });
        sourceBlocks = [...pdfBlocks, ...imageBlocks];
      }
      const sourceContext = this.buildLocalQaSourceContext(sourceBlocks);
      const hasSourceContext = sourceBlocks.length > 0 || normalizedExternal.images.length > 0 || normalizedExternal.pdfLabels.length > 0;
      const attachmentLabels = [
        ...normalizedExternal.textDocs.map((doc) => `[DOC] ${doc.label}`),
        ...normalizedExternal.imageLabels.map((label) => `[IMG] ${label}`),
        ...normalizedExternal.pdfLabels.map((label) => `[PDF] ${label}`)
      ];
      const selectionInventoryContext = selectedFiles.length > 0 && this.shouldIncludeSelectionInventory(
        safeQuestion,
        selectedFiles.length,
        intent
      ) ? this.buildSelectionInventoryContext(selectedFiles) : void 0;
      const systemPrompt = this.buildLocalQaSystemPrompt(
        intent,
        preferDetailed,
        hasSourceContext,
        primaryRole,
        safeQuestion
      );
      const userPrompt = this.buildLocalQaUserPrompt(
        safeQuestion,
        sourceContext,
        selectionInventoryContext,
        attachmentLabels,
        openFilePath,
        openSelection
      );
      this.emitQaEvent(onEvent, "generation", "Generation started");
      this.setStatus("asking local qa model...");
      throwIfAborted();
      const completion = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history,
        images: normalizedExternal.images,
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
      const hasAgentActionBlock = this.settings.qaAgentToolModeEnabled && /```omni-forge-actions[\s\S]*?```/i.test(initialAnswer);
      let finalAnswer = initialAnswer;
      const conversationMode = this.getQaConversationModeForQa();
      const wantsGameBuild = this.isGameBuildTask(safeQuestion);
      const canRunPipelineWithoutSources = conversationMode === "orchestration" || conversationMode === "plan" || conversationMode === "agent";
      if (!hasSourceContext && !canRunPipelineWithoutSources) {
        this.emitQaEvent(
          onEvent,
          "info",
          "No source context for this turn; skipping source-based rewrite passes."
        );
      } else if (hasAgentActionBlock) {
        this.emitQaEvent(
          onEvent,
          "info",
          "Agent action block detected; skipping post-generation rewrite passes."
        );
      } else if (hasVisionAttachments) {
        this.emitQaEvent(
          onEvent,
          "info",
          "Vision-compatible attachments detected; limiting rewrite passes to safeguard-only."
        );
        const limitedStages = this.resolveQaPipelineStages(safeQuestion, intent).filter((stage) => stage === "safeguard");
        for (const stage of limitedStages) {
          throwIfAborted();
          finalAnswer = await this.applySafeguardPass({
            question: safeQuestion,
            answer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            onEvent,
            abortSignal
          });
        }
      } else {
        if (!hasSourceContext && canRunPipelineWithoutSources) {
          this.emitQaEvent(
            onEvent,
            "info",
            "No source context, but orchestration/plan mode keeps rewrite pipeline enabled."
          );
        }
        throwIfAborted();
        finalAnswer = await this.repairQaStructureIfNeeded({
          intent,
          answer: initialAnswer,
          question: safeQuestion,
          preferDetailed,
          sourceBlocks,
          qaBaseUrl,
          qaModel,
          onEvent,
          abortSignal
        });
        const useLightweightPipeline = this.shouldUseLightweightQaPipeline(
          safeQuestion,
          intent
        );
        if (useLightweightPipeline) {
          this.emitQaEvent(
            onEvent,
            "info",
            "Simple question detected; skipping heavy pipeline passes for faster response."
          );
        }
        let pipelineStages = useLightweightPipeline ? [] : this.resolveQaPipelineStages(safeQuestion, intent);
        if (conversationMode === "agent") {
          pipelineStages = this.mapTaskRolesToStagesForQa(routingLog.roles);
          this.emitQaEvent(
            onEvent,
            "info",
            `Agent mode RoleRouter pipeline: ${pipelineStages.length > 0 ? pipelineStages.join(" -> ") : "(none)"}`
          );
        } else if (conversationMode === "orchestration" && pipelineStages.length > 0 && !pipelineStages.includes("orchestrator")) {
          pipelineStages = ["orchestrator", ...pipelineStages];
        }
        if (conversationMode === "orchestration" && wantsGameBuild) {
          const ensureStageBeforeSafeguard = (stage) => {
            if (pipelineStages.includes(stage)) {
              return;
            }
            const safeguardIndex = pipelineStages.indexOf("safeguard");
            if (safeguardIndex >= 0) {
              pipelineStages.splice(safeguardIndex, 0, stage);
            } else {
              pipelineStages.push(stage);
            }
          };
          ensureStageBeforeSafeguard("orchestrator");
          ensureStageBeforeSafeguard("architect");
          ensureStageBeforeSafeguard("coder");
          if (!pipelineStages.includes("safeguard")) {
            pipelineStages.push("safeguard");
          }
        }
        if (pipelineStages.length > 0) {
          this.emitQaEvent(
            onEvent,
            "generation",
            `Pipeline: ${pipelineStages.join(" -> ")}`
          );
          if (conversationMode === "orchestration") {
            this.emitQaEvent(
              onEvent,
              "generation",
              `Orchestration model trace: ${this.describeOrchestrationModelTrace(pipelineStages, qaModel)}`
            );
          }
        }
        for (const stage of pipelineStages) {
          throwIfAborted();
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
      }
      if (conversationMode === "orchestration" && wantsGameBuild && !this.hasRunnableGameScaffold(finalAnswer)) {
        this.emitQaEvent(
          onEvent,
          "warning",
          "Game request detected but runnable scaffold is missing; running focused game scaffold pass."
        );
        finalAnswer = await this.applyGameBuildScaffoldPass({
          question: safeQuestion,
          answer: finalAnswer,
          sourceBlocks,
          qaBaseUrl,
          onEvent,
          abortSignal
        });
      }
      if (conversationMode === "agent" && this.settings.qaAgentToolModeEnabled) {
        if (routingLog.taskType === "EDIT_NOTE" && openSelection) {
          finalAnswer = await this.ensureSelectionDiffActionPlan({
            question: safeQuestion,
            draftAnswer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            qaModel,
            openFilePath,
            openSelection,
            routingLog,
            onEvent,
            abortSignal
          });
          if (!this.hasValidSelectionDiffActionInAnswer(finalAnswer, safeQuestion, qaModel, openSelection)) {
            this.emitQaEvent(
              onEvent,
              "warning",
              "EDIT_NOTE diff planner failed after retries. Apply step will remain blocked."
            );
            finalAnswer = [
              finalAnswer,
              "### EDIT_NOTE 실행 차단",
              "- 유효한 unified diff 액션 생성에 실패하여 자동 적용을 중단합니다."
            ].filter((line) => line.trim().length > 0).join("\n\n");
          }
        } else if (this.isLikelyAgentMutationTask(safeQuestion) && !this.hasMutatingQaActionInAnswer(finalAnswer, safeQuestion, qaModel)) {
          finalAnswer = await this.ensureAgentMutatingActionPlan({
            question: safeQuestion,
            draftAnswer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            qaModel,
            openFilePath,
            onEvent,
            abortSignal
          });
        }
      }
      const shouldSkipLanguageGuard = this.settings.qaAgentToolModeEnabled && /```omni-forge-actions[\s\S]*?```/i.test(finalAnswer);
      if (!shouldSkipLanguageGuard) {
        throwIfAborted();
        finalAnswer = await this.enforcePreferredLanguageIfNeeded({
          answer: finalAnswer,
          question: safeQuestion,
          qaBaseUrl,
          qaModel,
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
      throwIfAborted();
      const answerWithActions = await this.applyQaAgentActionsFromAnswer({
        answer: finalAnswer,
        question: safeQuestion,
        qaModel,
        onEvent,
        abortSignal,
        openSelection,
        taskType: routingLog.taskType,
        routingLog
      });
      this.lastQaRoutingLog = {
        taskType: routingLog.taskType,
        roles: [...routingLog.roles],
        modelUsed: [...routingLog.modelUsed],
        fallbackUsed: routingLog.fallbackUsed,
        safeguardPassed: routingLog.safeguardPassed
      };
      return {
        question: safeQuestion,
        answer: answerWithActions,
        thinking: mergedThinking,
        model: qaModel,
        embeddingModel,
        sources: sourceList,
        retrievalCacheHits,
        retrievalCacheWrites
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
        "Omni Forge Chats",
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
        "Omni Forge Reports",
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
        "Omni Forge Backups",
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
  async openSelectionModal(context = null) {
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
      },
      context
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
      lines.push("# Omni Forge Cleanup Dry-Run Report");
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
          "Omni Forge Reports",
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
    const outputPath = await this.allocateTimestampedMocPath(this.settings.mocPath);
    await this.ensureParentFolder(outputPath);
    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    const content = `${lines.join("\n").trim()}
`;
    if (existing instanceof import_obsidian4.TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
    this.notice(`MOC saved: ${outputPath}`);
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
