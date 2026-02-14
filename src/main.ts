import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import {
  buildNextFrontmatter,
  extractManagedFrontmatter,
  managedFrontmatterChanged,
  normalizeLinked,
  normalizeManagedFrontmatter,
  normalizeTags,
} from "./frontmatter";
import { analyzeWithFallback } from "./providers";
import type {
  FieldReasons,
  KnowledgeWeaverSettings,
  ManagedFrontmatter,
  NoteSuggestion,
  ProviderId,
} from "./types";

const DEFAULT_SETTINGS: KnowledgeWeaverSettings = {
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
  mocPath: "MOC/Selected Knowledge MOC.md",
};

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) {
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

function readManagedValueByKey(
  managed: ManagedFrontmatter,
  key: keyof ManagedFrontmatter,
): string | string[] | undefined {
  return managed[key];
}

class FileSelectionModal extends Modal {
  private readonly allFiles: TFile[];
  private readonly onSubmit: (selectedPaths: string[]) => Promise<void>;
  private readonly selectedPaths: Set<string>;
  private searchValue: string = "";
  private listContainer!: HTMLElement;

  constructor(
    app: App,
    allFiles: TFile[],
    initialSelection: string[],
    onSubmit: (selectedPaths: string[]) => Promise<void>,
  ) {
    super(app);
    this.allFiles = allFiles;
    this.onSubmit = onSubmit;
    this.selectedPaths = new Set(initialSelection);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes" });

    const searchWrapper = contentEl.createDiv();
    searchWrapper.createEl("label", { text: "Filter files" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      placeholder: "Type part of path or file name",
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
      text: "Select filtered",
    });
    selectFilteredButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedPaths.add(file.path);
      }
      this.renderList();
    };

    const clearFilteredButton = controlRow.createEl("button", {
      text: "Clear filtered",
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
      cls: "mod-cta",
    });
    saveButton.onclick = async () => {
      const selected = [...this.selectedPaths].sort((a, b) =>
        a.localeCompare(b),
      );
      await this.onSubmit(selected);
      this.close();
    };
  }

  private filteredFiles(): TFile[] {
    if (!this.searchValue) {
      return this.allFiles;
    }
    return this.allFiles.filter((file) =>
      file.path.toLowerCase().includes(this.searchValue),
    );
  }

  private renderList(): void {
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
}

class SuggestionPreviewModal extends Modal {
  private readonly suggestions: NoteSuggestion[];
  private readonly includeReasons: boolean;
  private readonly onApply: () => Promise<void>;

  constructor(
    app: App,
    suggestions: NoteSuggestion[],
    includeReasons: boolean,
    onApply: () => Promise<void>,
  ) {
    super(app);
    this.suggestions = suggestions;
    this.includeReasons = includeReasons;
    this.onApply = onApply;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "AI suggestions (preview mode)" });
    contentEl.createEl("p", {
      text: `${this.suggestions.length} note(s) have proposed changes.`,
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
      cls: "mod-cta",
    });
    applyButton.onclick = async () => {
      await this.onApply();
      this.close();
    };
  }

  private renderFieldChange(
    parent: HTMLElement,
    key: keyof ManagedFrontmatter,
    suggestion: NoteSuggestion,
  ): void {
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

    const reason = suggestion.reasons[key as keyof FieldReasons];
    if (reason) {
      row.createEl("div", { text: `Reason: ${reason}` });
    }
  }
}

class KnowledgeWeaverSettingTab extends PluginSettingTab {
  private readonly plugin: KnowledgeWeaverPlugin;

  constructor(app: App, plugin: KnowledgeWeaverPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Auto-Linker Settings" });

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Choose AI provider. Local providers are recommended first.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ollama", "Ollama (local)")
          .addOption("lmstudio", "LM Studio (local)")
          .addOption("openai", "OpenAI / Codex")
          .addOption("anthropic", "Claude")
          .addOption("gemini", "Gemini")
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value as ProviderId;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    containerEl.createEl("h3", { text: "Local provider config" });

    new Setting(containerEl)
      .setName("Ollama base URL")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:11434")
          .setValue(this.plugin.settings.ollamaBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Ollama model")
      .addText((text) =>
        text
          .setPlaceholder("qwen2.5:7b")
          .setValue(this.plugin.settings.ollamaModel)
          .onChange(async (value) => {
            this.plugin.settings.ollamaModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("LM Studio base URL")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:1234")
          .setValue(this.plugin.settings.lmStudioBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.lmStudioBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("LM Studio model")
      .addText((text) =>
        text
          .setPlaceholder("local-model")
          .setValue(this.plugin.settings.lmStudioModel)
          .onChange(async (value) => {
            this.plugin.settings.lmStudioModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("LM Studio API key (optional)")
      .addText((text) =>
        text
          .setPlaceholder("Leave empty if not required")
          .setValue(this.plugin.settings.lmStudioApiKey)
          .onChange(async (value) => {
            this.plugin.settings.lmStudioApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Cloud provider config" });

    new Setting(containerEl)
      .setName("OpenAI base URL")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.openAIBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openAIBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("OpenAI model")
      .addText((text) =>
        text
          .setPlaceholder("gpt-5-mini")
          .setValue(this.plugin.settings.openAIModel)
          .onChange(async (value) => {
            this.plugin.settings.openAIModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("OpenAI API key")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openAIApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openAIApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Anthropic model")
      .addText((text) =>
        text
          .setPlaceholder("claude-3-7-sonnet-latest")
          .setValue(this.plugin.settings.anthropicModel)
          .onChange(async (value) => {
            this.plugin.settings.anthropicModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Anthropic API key")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Gemini model")
      .addText((text) =>
        text
          .setPlaceholder("gemini-2.5-pro")
          .setValue(this.plugin.settings.geminiModel)
          .onChange(async (value) => {
            this.plugin.settings.geminiModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Gemini API key")
      .addText((text) =>
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Behavior" });

    new Setting(containerEl)
      .setName("Suggestion mode (recommended)")
      .setDesc("Analyze first, preview changes, and apply only when approved.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.suggestionMode)
          .onChange(async (value) => {
            this.plugin.settings.suggestionMode = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show reasons for each field")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeReasons)
          .onChange(async (value) => {
            this.plugin.settings.includeReasons = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Clean unknown frontmatter keys")
      .setDesc(
        "When enabled, keep only tags/topic/linked/index and remove other keys.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.cleanUnknownFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.cleanUnknownFrontmatter = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Sort tags and linked arrays")
      .setDesc("Helps keep stable output and reduce linter churn.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.sortArrays)
          .onChange(async (value) => {
            this.plugin.settings.sortArrays = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Analyze tags")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.analyzeTags)
          .onChange(async (value) => {
            this.plugin.settings.analyzeTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Analyze topic")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.analyzeTopic)
          .onChange(async (value) => {
            this.plugin.settings.analyzeTopic = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Analyze linked")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.analyzeLinked)
          .onChange(async (value) => {
            this.plugin.settings.analyzeLinked = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Analyze index")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.analyzeIndex)
          .onChange(async (value) => {
            this.plugin.settings.analyzeIndex = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max tags")
      .addText((text) =>
        text
          .setPlaceholder("8")
          .setValue(String(this.plugin.settings.maxTags))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.maxTags = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Max linked")
      .addText((text) =>
        text
          .setPlaceholder("8")
          .setValue(String(this.plugin.settings.maxLinked))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.maxLinked = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Generate MOC after apply")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.generateMoc)
          .onChange(async (value) => {
            this.plugin.settings.generateMoc = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("MOC file path")
      .setDesc("Vault-relative markdown path.")
      .addText((text) =>
        text
          .setPlaceholder("MOC/Selected Knowledge MOC.md")
          .setValue(this.plugin.settings.mocPath)
          .onChange(async (value) => {
            this.plugin.settings.mocPath = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}

export default class KnowledgeWeaverPlugin extends Plugin {
  settings!: KnowledgeWeaverSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "select-target-notes",
      name: "Auto-Linker: Select target notes",
      callback: async () => this.openSelectionModal(),
    });

    this.addCommand({
      id: "analyze-target-notes",
      name: "Auto-Linker: Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis(),
    });

    this.addCommand({
      id: "clear-target-notes",
      name: "Auto-Linker: Clear selected target notes",
      callback: async () => {
        this.settings.targetFilePaths = [];
        await this.saveSettings();
        new Notice("Target selection cleared.");
      },
    });

    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection(),
    });

    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getAllMarkdownFiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private getSelectedFiles(): TFile[] {
    const files: TFile[] = [];
    for (const path of this.settings.targetFilePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof TFile && entry.extension === "md") {
        files.push(entry);
      }
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async openSelectionModal(): Promise<void> {
    const allFiles = this.getAllMarkdownFiles();
    new FileSelectionModal(
      this.app,
      allFiles,
      this.settings.targetFilePaths,
      async (selectedPaths) => {
        this.settings.targetFilePaths = selectedPaths;
        await this.saveSettings();
        new Notice(`Saved ${selectedPaths.length} target note(s).`);
      },
    ).open();
  }

  private async runAnalysis(): Promise<void> {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      new Notice("No target notes selected. Open selector first.");
      await this.openSelectionModal();
      return;
    }

    new Notice(`Analyzing ${selectedFiles.length} note(s)...`);
    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions: NoteSuggestion[] = [];

    for (const file of selectedFiles) {
      const request = {
        sourcePath: file.path,
        sourceText: await this.app.vault.cachedRead(file),
        candidateLinkPaths: selectedFiles
          .filter((candidate) => candidate.path !== file.path)
          .map((candidate) => candidate.path),
        maxTags: this.settings.maxTags,
        maxLinked: this.settings.maxLinked,
        analyzeTags: this.settings.analyzeTags,
        analyzeTopic: this.settings.analyzeTopic,
        analyzeLinked: this.settings.analyzeLinked,
        analyzeIndex: this.settings.analyzeIndex,
        includeReasons: this.settings.includeReasons,
      };

      const proposal = await analyzeWithFallback(this.settings, request);
      const currentFrontmatter =
        (this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
      const existing = normalizeManagedFrontmatter(
        extractManagedFrontmatter(currentFrontmatter),
      );
      const proposed: ManagedFrontmatter = {
        tags: existing.tags,
        topic: existing.topic,
        linked: existing.linked,
        index: existing.index,
      };

      if (this.settings.analyzeTags) {
        proposed.tags = normalizeTags((proposal.tags ?? []).slice(0, this.settings.maxTags));
      }
      if (this.settings.analyzeTopic) {
        proposed.topic = proposal.topic?.trim() || undefined;
      }
      if (this.settings.analyzeLinked) {
        const normalizedLinked = normalizeLinked(
          this.app,
          file.path,
          (proposal.linked ?? []).slice(0, this.settings.maxLinked),
          selectedPathSet,
        );
        proposed.linked = normalizedLinked.slice(0, this.settings.maxLinked);
      }
      if (this.settings.analyzeIndex) {
        proposed.index = proposal.index?.trim() || undefined;
      }

      const normalizedProposed = normalizeManagedFrontmatter(proposed);
      if (!managedFrontmatterChanged(existing, normalizedProposed)) {
        continue;
      }

      suggestions.push({
        file,
        existing,
        proposed: normalizedProposed,
        reasons: proposal.reasons ?? {},
      });
    }

    if (suggestions.length === 0) {
      new Notice(
        "No metadata changes found. Linked validation already filtered non-file targets.",
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
        },
      ).open();
      return;
    }

    await this.applySuggestions(suggestions);
    if (this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }

  private async applySuggestions(suggestions: NoteSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      await this.app.fileManager.processFrontMatter(suggestion.file, (frontmatter) => {
        const current = frontmatter as Record<string, unknown>;
        const next = buildNextFrontmatter(current, suggestion.proposed, {
          cleanUnknown: this.settings.cleanUnknownFrontmatter,
          sortArrays: this.settings.sortArrays,
        });

        for (const key of Object.keys(current)) {
          delete current[key];
        }
        for (const [key, value] of Object.entries(next)) {
          current[key] = value;
        }
      });
    }

    new Notice(`Applied changes to ${suggestions.length} note(s).`);
  }

  private async generateMocFromSelection(
    suggestions?: NoteSuggestion[],
  ): Promise<void> {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      new Notice("No selected notes available for MOC.");
      return;
    }

    const suggestionMap = new Map<string, NoteSuggestion>();
    for (const item of suggestions ?? []) {
      suggestionMap.set(item.file.path, item);
    }

    const records = selectedFiles.map((file) => {
      const suggested = suggestionMap.get(file.path);
      if (suggested) {
        return { file, metadata: suggested.proposed };
      }
      const frontmatter =
        (this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
      return {
        file,
        metadata: normalizeManagedFrontmatter(extractManagedFrontmatter(frontmatter)),
      };
    });

    const groups = new Map<string, Array<{ file: TFile; metadata: ManagedFrontmatter }>>();
    for (const record of records) {
      const group = record.metadata.index?.trim() || "uncategorized";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)?.push(record);
    }

    const lines: string[] = [];
    lines.push("# Selected Knowledge MOC");
    lines.push("");
    lines.push(`Updated: ${new Date().toISOString()}`);
    lines.push(`Source notes: ${selectedFiles.length}`);
    lines.push("");

    const sortedGroups = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    for (const group of sortedGroups) {
      lines.push(`## ${group}`);
      const items = groups.get(group) ?? [];
      items.sort((a, b) => a.file.path.localeCompare(b.file.path));
      for (const item of items) {
        const linkText = this.app.metadataCache.fileToLinktext(
          item.file,
          "",
          true,
        );
        const topicSuffix = item.metadata.topic ? ` - ${item.metadata.topic}` : "";
        lines.push(`- [[${linkText}]]${topicSuffix}`);
      }
      lines.push("");
    }

    const outputPath = normalizePath(this.settings.mocPath);
    await this.ensureParentFolder(outputPath);
    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    const content = `${lines.join("\n").trim()}\n`;

    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }

    new Notice(`MOC updated: ${outputPath}`);
  }

  private async ensureParentFolder(path: string): Promise<void> {
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
}
