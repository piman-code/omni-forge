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
var import_obsidian3 = require("obsidian");

// src/frontmatter.ts
var import_obsidian = require("obsidian");
var MANAGED_KEYS = ["tags", "topic", "linked", "index"];
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
function buildNextFrontmatter(current, proposed, options) {
  const next = {};
  for (const [key, value] of Object.entries(current)) {
    const normalizedKey = key.trim().toLowerCase();
    const isManaged = MANAGED_KEYS.includes(key);
    const isProtected = PROTECTED_FRONTMATTER_KEYS.has(normalizedKey);
    if (isManaged) {
      continue;
    }
    if (!options.cleanUnknown || isProtected) {
      next[key] = value;
    }
  }
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
function recommendOllamaModel(models) {
  var _a;
  if (models.length === 0) {
    return {
      reason: "No local Ollama models were detected. Install at least one chat/instruct model first."
    };
  }
  const scored = models.map((name) => ({ name, score: scoreOllamaModel(name) })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
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
  targetFilePaths: [],
  targetFolderPaths: [],
  includeSubfoldersInFolderSelection: true,
  backupBeforeApply: true,
  backupRootPath: "Auto-Linker Backups",
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
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  return `${(ms / 1e3).toFixed(1)}s`;
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
function formatBackupStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${sec}`;
}
var SelectionModal = class extends import_obsidian3.Modal {
  constructor(app, allFiles, allFolders, initialFiles, initialFolders, includeSubfolders, onSubmit) {
    super(app);
    this.searchValue = "";
    this.allFiles = allFiles;
    this.allFolders = allFolders;
    this.onSubmit = onSubmit;
    this.selectedFilePaths = new Set(initialFiles);
    this.selectedFolderPaths = new Set(initialFolders);
    this.includeSubfolders = includeSubfolders;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes and folders" });
    const info = contentEl.createEl("p", {
      text: "You can combine file and folder selection. Folder selection can include subfolders."
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
      this.renderLists();
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
    const actionRow = contentEl.createDiv();
    actionRow.style.display = "flex";
    actionRow.style.gap = "8px";
    actionRow.style.marginTop = "10px";
    const selectFilteredFilesButton = actionRow.createEl("button", {
      text: "Select filtered files"
    });
    selectFilteredFilesButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedFilePaths.add(file.path);
      }
      this.renderLists();
    };
    const clearFilteredFilesButton = actionRow.createEl("button", {
      text: "Clear filtered files"
    });
    clearFilteredFilesButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedFilePaths.delete(file.path);
      }
      this.renderLists();
    };
    const selectFilteredFoldersButton = actionRow.createEl("button", {
      text: "Select filtered folders"
    });
    selectFilteredFoldersButton.onclick = () => {
      for (const folder of this.filteredFolders()) {
        this.selectedFolderPaths.add(folder.path);
      }
      this.renderLists();
    };
    const clearFilteredFoldersButton = actionRow.createEl("button", {
      text: "Clear filtered folders"
    });
    clearFilteredFoldersButton.onclick = () => {
      for (const folder of this.filteredFolders()) {
        this.selectedFolderPaths.delete(folder.path);
      }
      this.renderLists();
    };
    const grid = contentEl.createDiv();
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    grid.style.marginTop = "12px";
    const fileSection = grid.createDiv();
    fileSection.createEl("h3", { text: "Files" });
    this.fileListContainer = fileSection.createDiv();
    this.fileListContainer.style.maxHeight = "45vh";
    this.fileListContainer.style.overflow = "auto";
    this.fileListContainer.style.border = "1px solid var(--background-modifier-border)";
    this.fileListContainer.style.borderRadius = "8px";
    const folderSection = grid.createDiv();
    folderSection.createEl("h3", { text: "Folders" });
    this.folderListContainer = folderSection.createDiv();
    this.folderListContainer.style.maxHeight = "45vh";
    this.folderListContainer.style.overflow = "auto";
    this.folderListContainer.style.border = "1px solid var(--background-modifier-border)";
    this.folderListContainer.style.borderRadius = "8px";
    this.footerCounterEl = contentEl.createEl("p");
    this.footerCounterEl.style.marginTop = "8px";
    this.renderLists();
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
        includeSubfolders: this.includeSubfolders
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
  renderLists() {
    this.fileListContainer.empty();
    this.folderListContainer.empty();
    for (const file of this.filteredFiles()) {
      const row = this.fileListContainer.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 8px";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedFilePaths.has(file.path);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedFilePaths.add(file.path);
        } else {
          this.selectedFilePaths.delete(file.path);
        }
        this.updateFooterCounter();
      };
      row.createEl("span", { text: file.path });
    }
    for (const folder of this.filteredFolders()) {
      const row = this.folderListContainer.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 8px";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedFolderPaths.has(folder.path);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedFolderPaths.add(folder.path);
        } else {
          this.selectedFolderPaths.delete(folder.path);
        }
        this.updateFooterCounter();
      };
      row.createEl("span", { text: folder.path });
    }
    this.updateFooterCounter();
  }
  updateFooterCounter() {
    this.footerCounterEl.setText(
      `Selected files: ${this.selectedFilePaths.size}, selected folders: ${this.selectedFolderPaths.size}, include subfolders: ${this.includeSubfolders ? "yes" : "no"}`
    );
  }
};
var SuggestionPreviewModal = class extends import_obsidian3.Modal {
  constructor(app, summary, suggestions, includeReasons, onApply) {
    super(app);
    this.summary = summary;
    this.suggestions = suggestions;
    this.includeReasons = includeReasons;
    this.onApply = onApply;
  }
  onOpen() {
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
      text: `Fallback used: ${this.summary.usedFallbackCount} | Elapsed: ${formatDurationMs(this.summary.elapsedMs)}`
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
};
var KnowledgeWeaverSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Auto-Linker Settings" });
    containerEl.createEl("p", {
      text: "Docs: README.md (English) | README_KO.md (Korean)"
    });
    new import_obsidian3.Setting(containerEl).setName("Provider").setDesc("Choose AI provider. Local providers are recommended first.").addDropdown(
      (dropdown) => dropdown.addOption("ollama", "Ollama (local)").addOption("lmstudio", "LM Studio (local)").addOption("openai", "OpenAI / Codex").addOption("anthropic", "Claude").addOption("gemini", "Gemini").setValue(this.plugin.settings.provider).onChange(async (value) => {
        this.plugin.settings.provider = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    containerEl.createEl("h3", { text: "Local provider config" });
    new import_obsidian3.Setting(containerEl).setName("Ollama base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.ollamaBaseUrl).onChange(async (value) => {
        this.plugin.settings.ollamaBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Ollama model").setDesc("If auto-pick is enabled, this can be auto-adjusted when missing or invalid.").addText(
      (text) => text.setPlaceholder("qwen2.5:7b").setValue(this.plugin.settings.ollamaModel).onChange(async (value) => {
        this.plugin.settings.ollamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Auto-pick recommended Ollama model").setDesc("Detect local models and choose a suitable chat/instruct model automatically.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.ollamaAutoPickEnabled).onChange(async (value) => {
        this.plugin.settings.ollamaAutoPickEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    const ollamaSummaryText = this.plugin.getOllamaDetectionSummary();
    new import_obsidian3.Setting(containerEl).setName("Detected Ollama models").setDesc(ollamaSummaryText).addButton(
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
    new import_obsidian3.Setting(containerEl).setName("LM Studio base URL").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:1234").setValue(this.plugin.settings.lmStudioBaseUrl).onChange(async (value) => {
        this.plugin.settings.lmStudioBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("LM Studio model").addText(
      (text) => text.setPlaceholder("local-model").setValue(this.plugin.settings.lmStudioModel).onChange(async (value) => {
        this.plugin.settings.lmStudioModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("LM Studio API key (optional)").addText(
      (text) => text.setPlaceholder("Leave empty if not required").setValue(this.plugin.settings.lmStudioApiKey).onChange(async (value) => {
        this.plugin.settings.lmStudioApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Cloud provider config" });
    new import_obsidian3.Setting(containerEl).setName("OpenAI base URL").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.openAIBaseUrl).onChange(async (value) => {
        this.plugin.settings.openAIBaseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("OpenAI model").addText(
      (text) => text.setPlaceholder("gpt-5-mini").setValue(this.plugin.settings.openAIModel).onChange(async (value) => {
        this.plugin.settings.openAIModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("OpenAI API key").addText(
      (text) => text.setPlaceholder("sk-...").setValue(this.plugin.settings.openAIApiKey).onChange(async (value) => {
        this.plugin.settings.openAIApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Anthropic model").addText(
      (text) => text.setPlaceholder("claude-3-7-sonnet-latest").setValue(this.plugin.settings.anthropicModel).onChange(async (value) => {
        this.plugin.settings.anthropicModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Anthropic API key").addText(
      (text) => text.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).onChange(async (value) => {
        this.plugin.settings.anthropicApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Gemini model").addText(
      (text) => text.setPlaceholder("gemini-2.5-pro").setValue(this.plugin.settings.geminiModel).onChange(async (value) => {
        this.plugin.settings.geminiModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Gemini API key").addText(
      (text) => text.setPlaceholder("AIza...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Behavior" });
    new import_obsidian3.Setting(containerEl).setName("Suggestion mode (recommended)").setDesc("Analyze first, preview changes, and apply only when approved.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.suggestionMode).onChange(async (value) => {
        this.plugin.settings.suggestionMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Show reasons for each field").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReasons).onChange(async (value) => {
        this.plugin.settings.includeReasons = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Show progress notices").setDesc("Displays progress updates like analyzed count while running.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showProgressNotices).onChange(async (value) => {
        this.plugin.settings.showProgressNotices = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Analyze tags").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeTags).onChange(async (value) => {
        this.plugin.settings.analyzeTags = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Analyze topic").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeTopic).onChange(async (value) => {
        this.plugin.settings.analyzeTopic = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Analyze linked").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeLinked).onChange(async (value) => {
        this.plugin.settings.analyzeLinked = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Analyze index").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.analyzeIndex).onChange(async (value) => {
        this.plugin.settings.analyzeIndex = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Max tags").addText(
      (text) => text.setPlaceholder("8").setValue(String(this.plugin.settings.maxTags)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.maxTags = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Max linked").addText(
      (text) => text.setPlaceholder("8").setValue(String(this.plugin.settings.maxLinked)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.maxLinked = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Clean unknown frontmatter keys").setDesc(
      "If enabled, non-managed keys are removed except protected linter-like date keys."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.cleanUnknownFrontmatter).onChange(async (value) => {
        this.plugin.settings.cleanUnknownFrontmatter = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Sort tags and linked arrays").setDesc("Helps keep stable output and reduce linter churn.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.sortArrays).onChange(async (value) => {
        this.plugin.settings.sortArrays = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Selection and backup" });
    new import_obsidian3.Setting(containerEl).setName("Include subfolders for selected folders").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeSubfoldersInFolderSelection).onChange(async (value) => {
        this.plugin.settings.includeSubfoldersInFolderSelection = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Backup selected notes before apply").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.backupBeforeApply).onChange(async (value) => {
        this.plugin.settings.backupBeforeApply = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Backup root path").setDesc("Vault-relative folder path used for versioned backups.").addText(
      (text) => text.setPlaceholder("Auto-Linker Backups").setValue(this.plugin.settings.backupRootPath).onChange(async (value) => {
        this.plugin.settings.backupRootPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "MOC" });
    new import_obsidian3.Setting(containerEl).setName("Generate MOC after apply").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.generateMoc).onChange(async (value) => {
        this.plugin.settings.generateMoc = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("MOC file path").setDesc("Vault-relative markdown path.").addText(
      (text) => text.setPlaceholder("MOC/Selected Knowledge MOC.md").setValue(this.plugin.settings.mocPath).onChange(async (value) => {
        this.plugin.settings.mocPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
  }
};
var KnowledgeWeaverPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.statusBarEl = null;
    this.ollamaDetectionCache = null;
    this.ollamaDetectionSummary = "Model detection has not run yet. Click refresh to detect installed Ollama models.";
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
      id: "refresh-ollama-models",
      name: "Auto-Linker: Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      }
    });
    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection()
    });
    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
    await this.refreshOllamaDetection({ notify: false, autoApply: true });
  }
  onunload() {
    this.setStatus("idle");
  }
  getOllamaDetectionSummary() {
    return this.ollamaDetectionSummary;
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
  async refreshOllamaDetection(options) {
    try {
      const detected = await detectOllamaModels(this.settings.ollamaBaseUrl);
      this.ollamaDetectionCache = detected;
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
      this.ollamaDetectionSummary = `Detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Ollama model detection failed: ${message}`);
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
    if (!this.settings.backupRootPath) {
      this.settings.backupRootPath = DEFAULT_SETTINGS.backupRootPath;
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
    new import_obsidian3.Notice(text, timeout);
  }
  progressNotice(stage, current, total) {
    this.setStatus(`${stage} ${current}/${total}`);
    if (this.settings.showProgressNotices) {
      if (current === 1 || current === total || current % 5 === 0) {
        new import_obsidian3.Notice(`Auto-Linker ${stage}: ${current}/${total}`, 1500);
      }
    }
  }
  getAllMarkdownFiles() {
    return this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
  }
  getAllFolders() {
    const folders = this.app.vault.getAllLoadedFiles().filter(
      (entry) => entry instanceof import_obsidian3.TFolder && entry.path.trim().length > 0
    );
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
  collectFilesFromFolder(folder, includeSubfolders, out) {
    for (const child of folder.children) {
      if (child instanceof import_obsidian3.TFile && child.extension === "md") {
        out.add(child.path);
        continue;
      }
      if (child instanceof import_obsidian3.TFolder && includeSubfolders) {
        this.collectFilesFromFolder(child, includeSubfolders, out);
      }
    }
  }
  getSelectedFiles() {
    const selectedPaths = /* @__PURE__ */ new Set();
    for (const path of this.settings.targetFilePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof import_obsidian3.TFile && entry.extension === "md") {
        selectedPaths.add(entry.path);
      }
    }
    for (const folderPath of this.settings.targetFolderPaths) {
      const entry = this.app.vault.getAbstractFileByPath(folderPath);
      if (entry instanceof import_obsidian3.TFolder) {
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
      if (entry instanceof import_obsidian3.TFile && entry.extension === "md") {
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
      async (payload) => {
        this.settings.targetFilePaths = payload.selectedFilePaths;
        this.settings.targetFolderPaths = payload.selectedFolderPaths;
        this.settings.includeSubfoldersInFolderSelection = payload.includeSubfolders;
        await this.saveSettings();
        const filesExpanded = this.getSelectedFiles().length;
        this.notice(
          `Selection saved. Files: ${payload.selectedFilePaths.length}, folders: ${payload.selectedFolderPaths.length}, expanded markdown files: ${filesExpanded}`,
          5e3
        );
      }
    ).open();
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
  async runAnalysis() {
    var _a, _b, _c, _d, _e, _f, _g;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    if (this.settings.provider === "ollama") {
      await this.refreshOllamaDetection({ notify: false, autoApply: true });
    }
    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions = [];
    const runStartedAt = Date.now();
    let usedFallbackCount = 0;
    this.notice(`Analyzing ${selectedFiles.length} note(s)...`);
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      this.progressNotice("analyzing", index + 1, selectedFiles.length);
      const request = {
        sourcePath: file.path,
        sourceText: await this.app.vault.cachedRead(file),
        candidateLinkPaths: selectedFiles.filter((candidate) => candidate.path !== file.path).map((candidate) => candidate.path),
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
      suggestions.push({
        file,
        existing: existingValidated,
        proposed: normalizedProposed,
        reasons: (_g = outcome.proposal.reasons) != null ? _g : {},
        analysis: outcome.meta
      });
    }
    const summary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: selectedFiles.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt
    };
    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);
    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes found. Provider=${summary.provider}, Model=${summary.model}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
        4500
      );
      return;
    }
    if (this.settings.suggestionMode) {
      new SuggestionPreviewModal(
        this.app,
        summary,
        suggestions,
        this.settings.includeReasons,
        async () => {
          await this.applySuggestions(suggestions, selectedFiles);
          if (this.settings.generateMoc) {
            await this.generateMocFromSelection(suggestions);
          }
        }
      ).open();
      return;
    }
    await this.applySuggestions(suggestions, selectedFiles);
    if (this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }
  async applySuggestions(suggestions, selectedFilesForBackup) {
    let backupFolder = null;
    if (this.settings.backupBeforeApply) {
      backupFolder = await this.createBackupForFiles(selectedFilesForBackup);
    }
    for (let index = 0; index < suggestions.length; index += 1) {
      const suggestion = suggestions[index];
      this.progressNotice("applying", index + 1, suggestions.length);
      await this.app.fileManager.processFrontMatter(
        suggestion.file,
        (frontmatter) => {
          const current = frontmatter;
          const next = buildNextFrontmatter(current, suggestion.proposed, {
            cleanUnknown: this.settings.cleanUnknownFrontmatter,
            sortArrays: this.settings.sortArrays
          });
          for (const key of Object.keys(current)) {
            delete current[key];
          }
          for (const [key, value] of Object.entries(next)) {
            current[key] = value;
          }
        }
      );
    }
    this.setStatus(`apply done (${suggestions.length} note(s))`);
    if (backupFolder) {
      this.notice(
        `Applied changes to ${suggestions.length} note(s). Backup: ${backupFolder}`,
        5e3
      );
    } else {
      this.notice(`Applied changes to ${suggestions.length} note(s).`);
    }
  }
  async createBackupForFiles(files) {
    const uniquePaths = [...new Set(files.map((file) => file.path))].sort(
      (a, b) => a.localeCompare(b)
    );
    if (uniquePaths.length === 0) {
      return null;
    }
    const backupRoot = (0, import_obsidian3.normalizePath)(this.settings.backupRootPath);
    const backupFolder = (0, import_obsidian3.normalizePath)(
      `${backupRoot}/${formatBackupStamp(/* @__PURE__ */ new Date())}`
    );
    await this.ensureFolderPath(backupFolder);
    for (const path of uniquePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (!(entry instanceof import_obsidian3.TFile)) {
        continue;
      }
      const content = await this.app.vault.cachedRead(entry);
      const outputPath = (0, import_obsidian3.normalizePath)(`${backupFolder}/${path}`);
      await this.ensureParentFolder(outputPath);
      await this.app.vault.adapter.write(outputPath, content);
    }
    const manifest = {
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      backupFolder,
      fileCount: uniquePaths.length,
      files: uniquePaths
    };
    const manifestPath = (0, import_obsidian3.normalizePath)(`${backupFolder}/manifest.json`);
    await this.app.vault.adapter.write(manifestPath, JSON.stringify(manifest, null, 2));
    return backupFolder;
  }
  async getLatestBackupFolder() {
    var _a;
    const backupRoot = (0, import_obsidian3.normalizePath)(this.settings.backupRootPath);
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
    const manifestPath = (0, import_obsidian3.normalizePath)(`${latestBackupFolder}/manifest.json`);
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
      const backupFilePath = (0, import_obsidian3.normalizePath)(`${latestBackupFolder}/${originalPath}`);
      const exists = await this.app.vault.adapter.exists(backupFilePath);
      if (!exists) {
        continue;
      }
      const content = await this.app.vault.adapter.read(backupFilePath);
      await this.ensureParentFolder(originalPath);
      const current = this.app.vault.getAbstractFileByPath(originalPath);
      if (current instanceof import_obsidian3.TFile) {
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
    const outputPath = (0, import_obsidian3.normalizePath)(this.settings.mocPath);
    await this.ensureParentFolder(outputPath);
    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    const content = `${lines.join("\n").trim()}
`;
    if (existing instanceof import_obsidian3.TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
    this.notice(`MOC updated: ${outputPath}`);
  }
  async ensureFolderPath(folderPath) {
    const normalized = (0, import_obsidian3.normalizePath)(folderPath);
    if (normalized.length === 0) {
      return;
    }
    const parts = normalized.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing instanceof import_obsidian3.TFolder) {
        continue;
      }
      if (existing instanceof import_obsidian3.TFile) {
        continue;
      }
      await this.app.vault.createFolder(currentPath);
    }
  }
  async ensureParentFolder(path) {
    const normalized = (0, import_obsidian3.normalizePath)(path);
    const chunks = normalized.split("/");
    chunks.pop();
    if (chunks.length === 0) {
      return;
    }
    await this.ensureFolderPath(chunks.join("/"));
  }
};
