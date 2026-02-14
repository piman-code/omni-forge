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
  if (!options.cleanUnknown) {
    for (const [key, value] of Object.entries(current)) {
      if (!MANAGED_KEYS.includes(key)) {
        next[key] = value;
      }
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
function createProvider(settings) {
  const providerMap = {
    ollama: () => new OllamaProvider(settings),
    lmstudio: () => new OpenAICompatibleProvider(settings, {
      baseUrl: toOpenAICompatibleBase(settings.lmStudioBaseUrl),
      model: settings.lmStudioModel,
      apiKey: settings.lmStudioApiKey.trim() || void 0
    }),
    openai: () => new OpenAICompatibleProvider(settings, {
      baseUrl: settings.openAIBaseUrl,
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
  try {
    return await provider.analyze(request);
  } catch (e) {
    const fallback = new HeuristicFallbackProvider(settings);
    return fallback.analyze(request);
  }
}

// src/main.ts
var DEFAULT_SETTINGS = {
  provider: "ollama",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5:7b",
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
  cleanUnknownFrontmatter: true,
  sortArrays: true,
  analyzeTags: true,
  analyzeTopic: true,
  analyzeLinked: true,
  analyzeIndex: true,
  maxTags: 8,
  maxLinked: 8,
  targetFilePaths: [],
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
var FileSelectionModal = class extends import_obsidian3.Modal {
  constructor(app, allFiles, initialSelection, onSubmit) {
    super(app);
    this.searchValue = "";
    this.allFiles = allFiles;
    this.onSubmit = onSubmit;
    this.selectedPaths = new Set(initialSelection);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes" });
    const searchWrapper = contentEl.createDiv();
    searchWrapper.createEl("label", { text: "Filter files" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      placeholder: "Type part of path or file name"
    });
    searchInput.style.width = "100%";
    searchInput.oninput = () => {
      this.searchValue = searchInput.value.trim().toLowerCase();
      this.renderList();
    };
    const controlRow = contentEl.createDiv();
    controlRow.style.display = "flex";
    controlRow.style.gap = "8px";
    controlRow.style.marginTop = "8px";
    const selectFilteredButton = controlRow.createEl("button", {
      text: "Select filtered"
    });
    selectFilteredButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedPaths.add(file.path);
      }
      this.renderList();
    };
    const clearFilteredButton = controlRow.createEl("button", {
      text: "Clear filtered"
    });
    clearFilteredButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedPaths.delete(file.path);
      }
      this.renderList();
    };
    this.listContainer = contentEl.createDiv();
    this.listContainer.style.maxHeight = "50vh";
    this.listContainer.style.overflow = "auto";
    this.listContainer.style.border = "1px solid var(--background-modifier-border)";
    this.listContainer.style.borderRadius = "8px";
    this.listContainer.style.marginTop = "10px";
    this.renderList();
    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.justifyContent = "flex-end";
    footer.style.marginTop = "12px";
    const cancelButton = footer.createEl("button", { text: "Cancel" });
    cancelButton.onclick = () => this.close();
    const saveButton = footer.createEl("button", {
      text: `Save (${this.selectedPaths.size})`,
      cls: "mod-cta"
    });
    saveButton.onclick = async () => {
      const selected = [...this.selectedPaths].sort(
        (a, b) => a.localeCompare(b)
      );
      await this.onSubmit(selected);
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
  renderList() {
    this.listContainer.empty();
    const files = this.filteredFiles();
    for (const file of files) {
      const row = this.listContainer.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 8px";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedPaths.has(file.path);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedPaths.add(file.path);
        } else {
          this.selectedPaths.delete(file.path);
        }
      };
      row.createEl("span", { text: file.path });
    }
  }
};
var SuggestionPreviewModal = class extends import_obsidian3.Modal {
  constructor(app, suggestions, includeReasons, onApply) {
    super(app);
    this.suggestions = suggestions;
    this.includeReasons = includeReasons;
    this.onApply = onApply;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "AI suggestions (preview mode)" });
    contentEl.createEl("p", {
      text: `${this.suggestions.length} note(s) have proposed changes.`
    });
    const list = contentEl.createDiv();
    list.style.maxHeight = "55vh";
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
    new import_obsidian3.Setting(containerEl).setName("Ollama model").addText(
      (text) => text.setPlaceholder("qwen2.5:7b").setValue(this.plugin.settings.ollamaModel).onChange(async (value) => {
        this.plugin.settings.ollamaModel = value.trim();
        await this.plugin.saveSettings();
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
    new import_obsidian3.Setting(containerEl).setName("Clean unknown frontmatter keys").setDesc(
      "When enabled, keep only tags/topic/linked/index and remove other keys."
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
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "select-target-notes",
      name: "Auto-Linker: Select target notes",
      callback: async () => this.openSelectionModal()
    });
    this.addCommand({
      id: "analyze-target-notes",
      name: "Auto-Linker: Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis()
    });
    this.addCommand({
      id: "clear-target-notes",
      name: "Auto-Linker: Clear selected target notes",
      callback: async () => {
        this.settings.targetFilePaths = [];
        await this.saveSettings();
        new import_obsidian3.Notice("Target selection cleared.");
      }
    });
    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection()
    });
    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getAllMarkdownFiles() {
    return this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
  }
  getSelectedFiles() {
    const files = [];
    for (const path of this.settings.targetFilePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof import_obsidian3.TFile && entry.extension === "md") {
        files.push(entry);
      }
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }
  async openSelectionModal() {
    const allFiles = this.getAllMarkdownFiles();
    new FileSelectionModal(
      this.app,
      allFiles,
      this.settings.targetFilePaths,
      async (selectedPaths) => {
        this.settings.targetFilePaths = selectedPaths;
        await this.saveSettings();
        new import_obsidian3.Notice(`Saved ${selectedPaths.length} target note(s).`);
      }
    ).open();
  }
  async runAnalysis() {
    var _a, _b, _c, _d, _e, _f, _g;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      new import_obsidian3.Notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }
    new import_obsidian3.Notice(`Analyzing ${selectedFiles.length} note(s)...`);
    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions = [];
    for (const file of selectedFiles) {
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
      const proposal = await analyzeWithFallback(this.settings, request);
      const currentFrontmatter = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
      const existing = normalizeManagedFrontmatter(
        extractManagedFrontmatter(currentFrontmatter)
      );
      const proposed = {
        tags: existing.tags,
        topic: existing.topic,
        linked: existing.linked,
        index: existing.index
      };
      if (this.settings.analyzeTags) {
        proposed.tags = normalizeTags(((_c = proposal.tags) != null ? _c : []).slice(0, this.settings.maxTags));
      }
      if (this.settings.analyzeTopic) {
        proposed.topic = ((_d = proposal.topic) == null ? void 0 : _d.trim()) || void 0;
      }
      if (this.settings.analyzeLinked) {
        const normalizedLinked = normalizeLinked(
          this.app,
          file.path,
          ((_e = proposal.linked) != null ? _e : []).slice(0, this.settings.maxLinked),
          selectedPathSet
        );
        proposed.linked = normalizedLinked.slice(0, this.settings.maxLinked);
      }
      if (this.settings.analyzeIndex) {
        proposed.index = ((_f = proposal.index) == null ? void 0 : _f.trim()) || void 0;
      }
      const normalizedProposed = normalizeManagedFrontmatter(proposed);
      if (!managedFrontmatterChanged(existing, normalizedProposed)) {
        continue;
      }
      suggestions.push({
        file,
        existing,
        proposed: normalizedProposed,
        reasons: (_g = proposal.reasons) != null ? _g : {}
      });
    }
    if (suggestions.length === 0) {
      new import_obsidian3.Notice(
        "No metadata changes found. Linked validation already filtered non-file targets."
      );
      return;
    }
    if (this.settings.suggestionMode) {
      new SuggestionPreviewModal(
        this.app,
        suggestions,
        this.settings.includeReasons,
        async () => {
          await this.applySuggestions(suggestions);
          if (this.settings.generateMoc) {
            await this.generateMocFromSelection(suggestions);
          }
        }
      ).open();
      return;
    }
    await this.applySuggestions(suggestions);
    if (this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }
  async applySuggestions(suggestions) {
    for (const suggestion of suggestions) {
      await this.app.fileManager.processFrontMatter(suggestion.file, (frontmatter) => {
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
      });
    }
    new import_obsidian3.Notice(`Applied changes to ${suggestions.length} note(s).`);
  }
  async generateMocFromSelection(suggestions) {
    var _a, _b, _c;
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      new import_obsidian3.Notice("No selected notes available for MOC.");
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
        metadata: normalizeManagedFrontmatter(extractManagedFrontmatter(frontmatter))
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
        const linkText = this.app.metadataCache.fileToLinktext(
          item.file,
          "",
          true
        );
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
    new import_obsidian3.Notice(`MOC updated: ${outputPath}`);
  }
  async ensureParentFolder(path) {
    const parts = path.split("/");
    parts.pop();
    if (parts.length === 0) {
      return;
    }
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (this.app.vault.getAbstractFileByPath(currentPath)) {
        continue;
      }
      await this.app.vault.createFolder(currentPath);
    }
  }
};
