import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
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
import {
  analyzeWithFallback,
  detectOllamaModels,
  getProviderModelLabel,
} from "./providers";
import type {
  AnalysisRunSummary,
  FieldReasons,
  KnowledgeWeaverSettings,
  ManagedFrontmatter,
  NoteSuggestion,
  OllamaDetectionResult,
  ProviderId,
} from "./types";

const DEFAULT_SETTINGS: KnowledgeWeaverSettings = {
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

function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function mergeUniqueStrings(base: string[], additions: string[]): string[] {
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

function formatBackupStamp(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${sec}`;
}

interface SelectionSubmitPayload {
  selectedFilePaths: string[];
  selectedFolderPaths: string[];
  includeSubfolders: boolean;
}

class SelectionModal extends Modal {
  private readonly allFiles: TFile[];
  private readonly allFolders: TFolder[];
  private readonly onSubmit: (payload: SelectionSubmitPayload) => Promise<void>;
  private readonly selectedFilePaths: Set<string>;
  private readonly selectedFolderPaths: Set<string>;
  private includeSubfolders: boolean;

  private searchValue: string = "";
  private fileListContainer!: HTMLElement;
  private folderListContainer!: HTMLElement;
  private footerCounterEl!: HTMLElement;

  constructor(
    app: App,
    allFiles: TFile[],
    allFolders: TFolder[],
    initialFiles: string[],
    initialFolders: string[],
    includeSubfolders: boolean,
    onSubmit: (payload: SelectionSubmitPayload) => Promise<void>,
  ) {
    super(app);
    this.allFiles = allFiles;
    this.allFolders = allFolders;
    this.onSubmit = onSubmit;
    this.selectedFilePaths = new Set(initialFiles);
    this.selectedFolderPaths = new Set(initialFolders);
    this.includeSubfolders = includeSubfolders;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes and folders" });

    const info = contentEl.createEl("p", {
      text: "You can combine file and folder selection. Folder selection can include subfolders.",
    });
    info.style.marginTop = "0";

    const searchWrapper = contentEl.createDiv();
    searchWrapper.createEl("label", { text: "Filter files/folders" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      placeholder: "Type part of file or folder path",
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
      text: "Select filtered files",
    });
    selectFilteredFilesButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedFilePaths.add(file.path);
      }
      this.renderLists();
    };

    const clearFilteredFilesButton = actionRow.createEl("button", {
      text: "Clear filtered files",
    });
    clearFilteredFilesButton.onclick = () => {
      for (const file of this.filteredFiles()) {
        this.selectedFilePaths.delete(file.path);
      }
      this.renderLists();
    };

    const selectFilteredFoldersButton = actionRow.createEl("button", {
      text: "Select filtered folders",
    });
    selectFilteredFoldersButton.onclick = () => {
      for (const folder of this.filteredFolders()) {
        this.selectedFolderPaths.add(folder.path);
      }
      this.renderLists();
    };

    const clearFilteredFoldersButton = actionRow.createEl("button", {
      text: "Clear filtered folders",
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
      cls: "mod-cta",
    });
    saveButton.onclick = async () => {
      await this.onSubmit({
        selectedFilePaths: [...this.selectedFilePaths].sort((a, b) =>
          a.localeCompare(b),
        ),
        selectedFolderPaths: [...this.selectedFolderPaths].sort((a, b) =>
          a.localeCompare(b),
        ),
        includeSubfolders: this.includeSubfolders,
      });
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

  private filteredFolders(): TFolder[] {
    if (!this.searchValue) {
      return this.allFolders;
    }
    return this.allFolders.filter((folder) =>
      folder.path.toLowerCase().includes(this.searchValue),
    );
  }

  private renderLists(): void {
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

  private updateFooterCounter(): void {
    this.footerCounterEl.setText(
      `Selected files: ${this.selectedFilePaths.size}, selected folders: ${this.selectedFolderPaths.size}, include subfolders: ${this.includeSubfolders ? "yes" : "no"}`,
    );
  }
}

class SuggestionPreviewModal extends Modal {
  private readonly summary: AnalysisRunSummary;
  private readonly suggestions: NoteSuggestion[];
  private readonly includeReasons: boolean;
  private readonly onApply: () => Promise<void>;

  constructor(
    app: App,
    summary: AnalysisRunSummary,
    suggestions: NoteSuggestion[],
    includeReasons: boolean,
    onApply: () => Promise<void>,
  ) {
    super(app);
    this.summary = summary;
    this.suggestions = suggestions;
    this.includeReasons = includeReasons;
    this.onApply = onApply;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "AI suggestions (preview mode)" });

    const summaryEl = contentEl.createDiv();
    summaryEl.style.border = "1px solid var(--background-modifier-border)";
    summaryEl.style.borderRadius = "8px";
    summaryEl.style.padding = "8px";
    summaryEl.style.marginBottom = "10px";

    summaryEl.createEl("div", {
      text: `Provider: ${this.summary.provider} | Model: ${this.summary.model}`,
    });
    summaryEl.createEl("div", {
      text: `Analyzed: ${this.summary.totalFiles} | Changed: ${this.summary.changedFiles}`,
    });
    summaryEl.createEl("div", {
      text: `Fallback used: ${this.summary.usedFallbackCount} | Elapsed: ${formatDurationMs(this.summary.elapsedMs)}`,
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
        text: `Suggest source: ${suggestion.analysis.provider}/${suggestion.analysis.model} | ${formatDurationMs(suggestion.analysis.elapsedMs)}${suggestion.analysis.usedFallback ? " | fallback" : ""}`,
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

    containerEl.createEl("p", {
      text: "Docs: README.md (English) | README_KO.md (Korean)",
    });

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
      .setDesc("If auto-pick is enabled, this can be auto-adjusted when missing or invalid.")
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
      .setName("Auto-pick recommended Ollama model")
      .setDesc("Detect local models and choose a suitable chat/instruct model automatically.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ollamaAutoPickEnabled)
          .onChange(async (value) => {
            this.plugin.settings.ollamaAutoPickEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    const ollamaSummaryText = this.plugin.getOllamaDetectionSummary();
    new Setting(containerEl)
      .setName("Detected Ollama models")
      .setDesc(ollamaSummaryText)
      .addButton((button) =>
        button.setButtonText("Refresh").onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Use recommended").onClick(async () => {
          await this.plugin.applyRecommendedOllamaModel(true);
          this.display();
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
      .setName("Show progress notices")
      .setDesc("Displays progress updates like analyzed count while running.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showProgressNotices)
          .onChange(async (value) => {
            this.plugin.settings.showProgressNotices = value;
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
      .setName("Clean unknown frontmatter keys")
      .setDesc(
        "If enabled, non-managed keys are removed except protected linter-like date keys.",
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

    containerEl.createEl("h3", { text: "Selection and backup" });

    new Setting(containerEl)
      .setName("Include subfolders for selected folders")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeSubfoldersInFolderSelection)
          .onChange(async (value) => {
            this.plugin.settings.includeSubfoldersInFolderSelection = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Backup selected notes before apply")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.backupBeforeApply)
          .onChange(async (value) => {
            this.plugin.settings.backupBeforeApply = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Backup root path")
      .setDesc("Vault-relative folder path used for versioned backups.")
      .addText((text) =>
        text
          .setPlaceholder("Auto-Linker Backups")
          .setValue(this.plugin.settings.backupRootPath)
          .onChange(async (value) => {
            this.plugin.settings.backupRootPath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "MOC" });

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

interface BackupManifest {
  createdAt: string;
  backupFolder: string;
  fileCount: number;
  files: string[];
}

export default class KnowledgeWeaverPlugin extends Plugin {
  settings!: KnowledgeWeaverSettings;
  private statusBarEl: HTMLElement | null = null;
  private ollamaDetectionCache: OllamaDetectionResult | null = null;
  private ollamaDetectionSummary =
    "Model detection has not run yet. Click refresh to detect installed Ollama models.";

  async onload(): Promise<void> {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("idle");

    this.addCommand({
      id: "select-target-notes",
      name: "Auto-Linker: Select target notes/folders",
      callback: async () => this.openSelectionModal(),
    });

    this.addCommand({
      id: "analyze-target-notes",
      name: "Auto-Linker: Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis(),
    });

    this.addCommand({
      id: "clear-target-notes",
      name: "Auto-Linker: Clear selected target notes/folders",
      callback: async () => {
        this.settings.targetFilePaths = [];
        this.settings.targetFolderPaths = [];
        await this.saveSettings();
        this.notice("Target file/folder selection cleared.");
      },
    });

    this.addCommand({
      id: "backup-selected-notes",
      name: "Auto-Linker: Backup selected notes",
      callback: async () => this.backupSelectedNotesNow(),
    });

    this.addCommand({
      id: "restore-latest-backup",
      name: "Auto-Linker: Restore from latest backup",
      callback: async () => this.restoreFromLatestBackup(),
    });

    this.addCommand({
      id: "refresh-ollama-models",
      name: "Auto-Linker: Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      },
    });

    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection(),
    });

    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));

    await this.refreshOllamaDetection({ notify: false, autoApply: true });
  }

  onunload(): void {
    this.setStatus("idle");
  }

  getOllamaDetectionSummary(): string {
    return this.ollamaDetectionSummary;
  }

  async applyRecommendedOllamaModel(notify: boolean): Promise<void> {
    if (!this.ollamaDetectionCache?.recommended) {
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

  async refreshOllamaDetection(options: {
    notify: boolean;
    autoApply: boolean;
  }): Promise<OllamaDetectionResult | null> {
    try {
      const detected = await detectOllamaModels(this.settings.ollamaBaseUrl);
      this.ollamaDetectionCache = detected;

      const modelListPreview =
        detected.models.length > 0
          ? detected.models.slice(0, 5).join(", ")
          : "(none)";
      this.ollamaDetectionSummary = [
        `Detected: ${detected.models.length} model(s).`,
        `Current: ${this.settings.ollamaModel || "(not set)"}.`,
        `Recommended: ${detected.recommended || "(none)"}.`,
        `Reason: ${detected.reason}`,
        `Preview: ${modelListPreview}`,
      ].join(" ");

      if (options.autoApply && this.settings.ollamaAutoPickEnabled) {
        const current = this.settings.ollamaModel.trim();
        const currentExists = current.length > 0 && detected.models.includes(current);
        if ((!current || !currentExists) && detected.recommended) {
          this.settings.ollamaModel = detected.recommended;
          await this.saveSettings();
          if (options.notify) {
            this.notice(
              `Auto-selected Ollama model: ${detected.recommended} (${detected.reason})`,
            );
          }
        }
      }

      if (options.notify) {
        this.notice(this.ollamaDetectionSummary, 5000);
      }

      return detected;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Ollama detection error";
      this.ollamaDetectionSummary = `Detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Ollama model detection failed: ${message}`);
      }
      return null;
    }
  }

  async loadSettings(): Promise<void> {
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

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private setStatus(text: string): void {
    this.statusBarEl?.setText(`Auto-Linker: ${text}`);
  }

  private notice(text: string, timeout = 3500): void {
    if (!this.settings.showProgressNotices) {
      return;
    }
    new Notice(text, timeout);
  }

  private progressNotice(stage: string, current: number, total: number): void {
    this.setStatus(`${stage} ${current}/${total}`);
    if (this.settings.showProgressNotices) {
      if (current === 1 || current === total || current % 5 === 0) {
        new Notice(`Auto-Linker ${stage}: ${current}/${total}`, 1500);
      }
    }
  }

  private getAllMarkdownFiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private getAllFolders(): TFolder[] {
    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter(
        (entry): entry is TFolder =>
          entry instanceof TFolder && entry.path.trim().length > 0,
      );

    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  private collectFilesFromFolder(
    folder: TFolder,
    includeSubfolders: boolean,
    out: Set<string>,
  ): void {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        out.add(child.path);
        continue;
      }

      if (child instanceof TFolder && includeSubfolders) {
        this.collectFilesFromFolder(child, includeSubfolders, out);
      }
    }
  }

  private getSelectedFiles(): TFile[] {
    const selectedPaths = new Set<string>();

    for (const path of this.settings.targetFilePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof TFile && entry.extension === "md") {
        selectedPaths.add(entry.path);
      }
    }

    for (const folderPath of this.settings.targetFolderPaths) {
      const entry = this.app.vault.getAbstractFileByPath(folderPath);
      if (entry instanceof TFolder) {
        this.collectFilesFromFolder(
          entry,
          this.settings.includeSubfoldersInFolderSelection,
          selectedPaths,
        );
      }
    }

    const out: TFile[] = [];
    for (const path of selectedPaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof TFile && entry.extension === "md") {
        out.push(entry);
      }
    }

    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async openSelectionModal(): Promise<void> {
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
          5000,
        );
      },
    ).open();
  }

  private async backupSelectedNotesNow(): Promise<void> {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No selected notes to back up. Select targets first.");
      return;
    }

    const backupFolder = await this.createBackupForFiles(selectedFiles);
    this.notice(
      backupFolder
        ? `Backup created: ${backupFolder}`
        : "Backup skipped (no files).",
      5000,
    );
  }

  private async runAnalysis(): Promise<void> {
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
    const suggestions: NoteSuggestion[] = [];
    const runStartedAt = Date.now();
    let usedFallbackCount = 0;

    this.notice(`Analyzing ${selectedFiles.length} note(s)...`);

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      this.progressNotice("analyzing", index + 1, selectedFiles.length);

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

      const outcome = await analyzeWithFallback(this.settings, request);
      if (outcome.meta.usedFallback) {
        usedFallbackCount += 1;
      }

      const currentFrontmatter =
        (this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};

      const existingBase = normalizeManagedFrontmatter(
        extractManagedFrontmatter(currentFrontmatter),
      );
      const existingValidated: ManagedFrontmatter = {
        tags: existingBase.tags,
        topic: existingBase.topic,
        linked: normalizeLinked(this.app, file.path, existingBase.linked),
        index: existingBase.index,
      };

      const proposed: ManagedFrontmatter = {
        tags: existingValidated.tags,
        topic: existingValidated.topic,
        linked: existingValidated.linked,
        index: existingValidated.index,
      };

      if (this.settings.analyzeTags) {
        const proposedTags = normalizeTags(
          (outcome.proposal.tags ?? []).slice(0, this.settings.maxTags),
        );
        proposed.tags = mergeUniqueStrings(existingValidated.tags, proposedTags);
      }

      if (this.settings.analyzeTopic) {
        const maybeTopic = outcome.proposal.topic?.trim();
        if (maybeTopic) {
          proposed.topic = maybeTopic;
        }
      }

      if (this.settings.analyzeLinked) {
        const proposedLinked = normalizeLinked(
          this.app,
          file.path,
          (outcome.proposal.linked ?? []).slice(0, this.settings.maxLinked),
          selectedPathSet,
        );
        proposed.linked = mergeUniqueStrings(existingValidated.linked, proposedLinked);
      }

      if (this.settings.analyzeIndex) {
        const maybeIndex = outcome.proposal.index?.trim();
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
        reasons: outcome.proposal.reasons ?? {},
        analysis: outcome.meta,
      });
    }

    const summary: AnalysisRunSummary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: selectedFiles.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt,
    };

    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);

    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes found. Provider=${summary.provider}, Model=${summary.model}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
        4500,
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
        },
      ).open();
      return;
    }

    await this.applySuggestions(suggestions, selectedFiles);
    if (this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }

  private async applySuggestions(
    suggestions: NoteSuggestion[],
    selectedFilesForBackup: TFile[],
  ): Promise<void> {
    let backupFolder: string | null = null;
    if (this.settings.backupBeforeApply) {
      backupFolder = await this.createBackupForFiles(selectedFilesForBackup);
    }

    for (let index = 0; index < suggestions.length; index += 1) {
      const suggestion = suggestions[index];
      this.progressNotice("applying", index + 1, suggestions.length);

      await this.app.fileManager.processFrontMatter(
        suggestion.file,
        (frontmatter) => {
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
        },
      );
    }

    this.setStatus(`apply done (${suggestions.length} note(s))`);
    if (backupFolder) {
      this.notice(
        `Applied changes to ${suggestions.length} note(s). Backup: ${backupFolder}`,
        5000,
      );
    } else {
      this.notice(`Applied changes to ${suggestions.length} note(s).`);
    }
  }

  private async createBackupForFiles(files: TFile[]): Promise<string | null> {
    const uniquePaths = [...new Set(files.map((file) => file.path))].sort((a, b) =>
      a.localeCompare(b),
    );
    if (uniquePaths.length === 0) {
      return null;
    }

    const backupRoot = normalizePath(this.settings.backupRootPath);
    const backupFolder = normalizePath(
      `${backupRoot}/${formatBackupStamp(new Date())}`,
    );

    await this.ensureFolderPath(backupFolder);

    for (const path of uniquePaths) {
      const entry = this.app.vault.getAbstractFileByPath(path);
      if (!(entry instanceof TFile)) {
        continue;
      }

      const content = await this.app.vault.cachedRead(entry);
      const outputPath = normalizePath(`${backupFolder}/${path}`);
      await this.ensureParentFolder(outputPath);
      await this.app.vault.adapter.write(outputPath, content);
    }

    const manifest: BackupManifest = {
      createdAt: new Date().toISOString(),
      backupFolder,
      fileCount: uniquePaths.length,
      files: uniquePaths,
    };

    const manifestPath = normalizePath(`${backupFolder}/manifest.json`);
    await this.app.vault.adapter.write(manifestPath, JSON.stringify(manifest, null, 2));

    return backupFolder;
  }

  private async getLatestBackupFolder(): Promise<string | null> {
    const backupRoot = normalizePath(this.settings.backupRootPath);
    const exists = await this.app.vault.adapter.exists(backupRoot);
    if (!exists) {
      return null;
    }

    const list = await this.app.vault.adapter.list(backupRoot);
    if (list.folders.length === 0) {
      return null;
    }

    const sorted = [...list.folders].sort((a, b) => a.localeCompare(b));
    return sorted[sorted.length - 1] ?? null;
  }

  private async restoreFromLatestBackup(): Promise<void> {
    const latestBackupFolder = await this.getLatestBackupFolder();
    if (!latestBackupFolder) {
      this.notice("No backup folder found.");
      return;
    }

    const manifestPath = normalizePath(`${latestBackupFolder}/manifest.json`);
    const manifestExists = await this.app.vault.adapter.exists(manifestPath);
    if (!manifestExists) {
      this.notice(`Backup manifest is missing: ${manifestPath}`);
      return;
    }

    const manifestRaw = await this.app.vault.adapter.read(manifestPath);
    const manifest = JSON.parse(manifestRaw) as BackupManifest;

    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      this.notice("Backup manifest does not contain files.");
      return;
    }

    let restoredCount = 0;

    for (const originalPath of manifest.files) {
      const backupFilePath = normalizePath(`${latestBackupFolder}/${originalPath}`);
      const exists = await this.app.vault.adapter.exists(backupFilePath);
      if (!exists) {
        continue;
      }

      const content = await this.app.vault.adapter.read(backupFilePath);
      await this.ensureParentFolder(originalPath);

      const current = this.app.vault.getAbstractFileByPath(originalPath);
      if (current instanceof TFile) {
        await this.app.vault.modify(current, content);
      } else {
        await this.app.vault.create(originalPath, content);
      }

      restoredCount += 1;
    }

    this.notice(
      `Restore completed from ${latestBackupFolder}. Restored ${restoredCount} file(s).`,
      6000,
    );
  }

  private async generateMocFromSelection(
    suggestions?: NoteSuggestion[],
  ): Promise<void> {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length === 0) {
      this.notice("No selected notes available for MOC.");
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
        metadata: normalizeManagedFrontmatter(
          extractManagedFrontmatter(frontmatter),
        ),
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
        const linkText = this.app.metadataCache.fileToLinktext(item.file, "", true);
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

    this.notice(`MOC updated: ${outputPath}`);
  }

  private async ensureFolderPath(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    if (normalized.length === 0) {
      return;
    }

    const parts = normalized.split("/");
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing instanceof TFolder) {
        continue;
      }
      if (existing instanceof TFile) {
        continue;
      }
      await this.app.vault.createFolder(currentPath);
    }
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const chunks = normalized.split("/");
    chunks.pop();
    if (chunks.length === 0) {
      return;
    }
    await this.ensureFolderPath(chunks.join("/"));
  }
}
