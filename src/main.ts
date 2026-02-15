import {
  App,
  Modal,
  Notice,
  parseYaml,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import {
  buildNextFrontmatter,
  cleanupFrontmatterRecord,
  extractManagedFrontmatter,
  managedFrontmatterChanged,
  normalizeLinked,
  normalizeManagedFrontmatter,
  normalizeTags,
  type FrontmatterCleanupConfig,
} from "./frontmatter";
import {
  analyzeWithFallback,
  buildOllamaModelOptions,
  detectOllamaModels,
  getProviderModelLabel,
  isOllamaModelAnalyzable,
} from "./providers";
import {
  buildOllamaEmbeddingModelOptions,
  buildSemanticNeighborMap,
  detectOllamaEmbeddingModels,
  isOllamaModelEmbeddingCapable,
  searchSemanticNotesByQuery,
  type OllamaEmbeddingDetectionResult,
  type OllamaEmbeddingModelOption,
  type SemanticNeighbor,
} from "./semantic";
import type {
  AnalysisRunSummary,
  BackupDecision,
  FieldReasons,
  KnowledgeWeaverSettings,
  ManagedFrontmatter,
  NoteSuggestion,
  OllamaDetectionResult,
  OllamaModelOption,
  ProgressErrorItem,
  ProviderId,
  SemanticCandidatePreview,
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
  semanticLinkingEnabled: false,
  semanticOllamaBaseUrl: "http://127.0.0.1:11434",
  semanticOllamaModel: "",
  semanticAutoPickEnabled: true,
  semanticTopK: 24,
  semanticMinSimilarity: 0.25,
  semanticMaxChars: 5000,
  qaOllamaBaseUrl: "http://127.0.0.1:11434",
  qaOllamaModel: "",
  qaTopK: 5,
  qaMaxContextChars: 12000,
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
  if (!Number.isFinite(ms) || ms < 0) {
    return "0ms";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSimilarity(score: number): string {
  const clamped = Math.max(-1, Math.min(1, score));
  return `${(clamped * 100).toFixed(1)}%`;
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

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

interface ProgressEventItem {
  filePath: string;
  status: "ok" | "error";
  message?: string;
}

interface SelectionSubmitPayload {
  selectedFilePaths: string[];
  selectedFolderPaths: string[];
  includeSubfolders: boolean;
  pathWidthPercent: number;
}

interface CleanupKeyStat {
  key: string;
  count: number;
}

class SelectionModal extends Modal {
  private readonly allFiles: TFile[];
  private readonly allFolders: TFolder[];
  private readonly onSubmit: (payload: SelectionSubmitPayload) => Promise<void>;
  private readonly selectedFilePaths: Set<string>;
  private readonly selectedFolderPaths: Set<string>;
  private includeSubfolders: boolean;
  private pathWidthPercent: number;

  private searchValue = "";
  private activeTab: "files" | "folders" = "files";
  private listContainer!: HTMLElement;
  private footerCounterEl!: HTMLElement;

  constructor(
    app: App,
    allFiles: TFile[],
    allFolders: TFolder[],
    initialFiles: string[],
    initialFolders: string[],
    includeSubfolders: boolean,
    pathWidthPercent: number,
    onSubmit: (payload: SelectionSubmitPayload) => Promise<void>,
  ) {
    super(app);
    this.allFiles = allFiles;
    this.allFolders = allFolders;
    this.onSubmit = onSubmit;
    this.selectedFilePaths = new Set(initialFiles);
    this.selectedFolderPaths = new Set(initialFolders);
    this.includeSubfolders = includeSubfolders;
    this.pathWidthPercent = pathWidthPercent;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select target notes and folders" });

    const info = contentEl.createEl("p", {
      text: "Use tabs to switch between Files and Folders. Long paths are shown compactly with full path on hover.",
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
      attr: { min: "45", max: "100", step: "1" },
    });
    widthInput.value = String(this.pathWidthPercent);
    const widthLabel = widthRow.createEl("span", {
      text: `${this.pathWidthPercent}%`,
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

    const switchTab = (tab: "files" | "folders") => {
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
      text: "Select filtered",
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
      text: "Clear filtered",
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
        pathWidthPercent: this.pathWidthPercent,
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

  private renderList(): void {
    this.listContainer.empty();

    if (this.activeTab === "files") {
      for (const file of this.filteredFiles()) {
        const row = this.createRow(file.path, this.selectedFilePaths.has(file.path));
        const checkbox = row.querySelector("input") as HTMLInputElement;
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
        const checkbox = row.querySelector("input") as HTMLInputElement;
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

  private createRow(path: string, checked: boolean): HTMLElement {
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

  private updateFooterCounter(): void {
    this.footerCounterEl.setText(
      `Selected files: ${this.selectedFilePaths.size}, selected folders: ${this.selectedFolderPaths.size}, include subfolders: ${this.includeSubfolders ? "yes" : "no"}, path width: ${this.pathWidthPercent}%`,
    );
  }
}

class CleanupKeyPickerModal extends Modal {
  private readonly keyStats: CleanupKeyStat[];
  private readonly selectedKeys: Set<string>;
  private readonly onSubmit: (selected: string[]) => Promise<void>;
  private searchValue = "";
  private listContainer!: HTMLElement;
  private footerSummaryEl!: HTMLElement;

  constructor(
    app: App,
    keyStats: CleanupKeyStat[],
    initialSelectedKeys: string[],
    onSubmit: (selected: string[]) => Promise<void>,
  ) {
    super(app);
    this.keyStats = keyStats;
    this.onSubmit = onSubmit;
    this.selectedKeys = new Set(initialSelectedKeys);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Select cleanup keys from selected notes" });

    contentEl.createEl("p", {
      text: "Only checked keys will be written to 'Cleanup exact keys'. Counts show in how many selected notes each key appears.",
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

  private filteredStats(): CleanupKeyStat[] {
    if (!this.searchValue) {
      return this.keyStats;
    }
    return this.keyStats.filter((item) => item.key.includes(this.searchValue));
  }

  private renderList(): void {
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
      `Listed: ${rows.length} keys | Selected: ${this.selectedKeys.size}`,
    );
  }
}

class BackupConfirmModal extends Modal {
  private readonly defaultBackup: boolean;
  private readonly onResolve: (decision: BackupDecision) => void;
  private rememberAsDefault = false;

  constructor(
    app: App,
    defaultBackup: boolean,
    onResolve: (decision: BackupDecision) => void,
  ) {
    super(app);
    this.defaultBackup = defaultBackup;
    this.onResolve = onResolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "백업을 진행하시겠습니까?" });
    contentEl.createEl("p", {
      text: "분석 전에 선택된 문서를 백업할 수 있습니다. 복구가 필요할 때 안전합니다.",
    });

    const defaultText = this.defaultBackup
      ? "현재 기본값: 백업 후 진행"
      : "현재 기본값: 백업 없이 진행";
    contentEl.createEl("p", { text: defaultText });

    const rememberRow = contentEl.createDiv();
    rememberRow.style.display = "flex";
    rememberRow.style.alignItems = "center";
    rememberRow.style.gap = "8px";

    const rememberCheckbox = rememberRow.createEl("input", { type: "checkbox" });
    rememberCheckbox.onchange = () => {
      this.rememberAsDefault = rememberCheckbox.checked;
    };
    rememberRow.createEl("span", { text: "이 선택을 기본값으로 저장" });

    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";

    const cancelButton = footer.createEl("button", { text: "취소" });
    cancelButton.onclick = () => {
      this.resolve({
        proceed: false,
        backupBeforeRun: this.defaultBackup,
        rememberAsDefault: false,
      });
    };

    const noBackupButton = footer.createEl("button", { text: "백업 없이 진행" });
    noBackupButton.onclick = () => {
      this.resolve({
        proceed: true,
        backupBeforeRun: false,
        rememberAsDefault: this.rememberAsDefault,
      });
    };

    const backupButton = footer.createEl("button", {
      text: "백업 후 진행(권장)",
      cls: "mod-cta",
    });
    backupButton.onclick = () => {
      this.resolve({
        proceed: true,
        backupBeforeRun: true,
        rememberAsDefault: this.rememberAsDefault,
      });
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private resolve(decision: BackupDecision): void {
    this.onResolve(decision);
    this.close();
  }

  static ask(app: App, defaultBackup: boolean): Promise<BackupDecision> {
    return new Promise((resolve) => {
      new BackupConfirmModal(app, defaultBackup, resolve).open();
    });
  }
}

class RunProgressModal extends Modal {
  private readonly titleText: string;

  private statusEl!: HTMLElement;
  private currentFileEl!: HTMLElement;
  private etaEl!: HTMLElement;
  private errorsSummaryEl!: HTMLElement;
  private errorsListEl!: HTMLElement;
  private showOnlyErrors = true;
  private cancelled = false;

  constructor(app: App, titleText: string) {
    super(app);
    this.titleText = titleText;
  }

  onOpen(): void {
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
      text: "중지",
      cls: "mod-warning",
    });
    cancelButton.onclick = () => {
      this.cancelled = true;
      this.statusEl.setText(`${this.titleText}: stopping after current file...`);
    };
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  update(params: {
    stage: string;
    current: number;
    total: number;
    startedAt: number;
    currentFile?: string;
    errors: ProgressErrorItem[];
    events: ProgressEventItem[];
  }): void {
    const elapsedMs = Date.now() - params.startedAt;
    const avgMs = params.current > 0 ? elapsedMs / params.current : 0;
    const remaining = Math.max(0, params.total - params.current);
    const etaMs = remaining * avgMs;

    this.statusEl.setText(`${params.stage}: ${params.current}/${params.total}`);
    this.currentFileEl.setText(`Current file: ${params.currentFile ?? "-"}`);
    this.etaEl.setText(
      `Elapsed: ${formatDurationMs(elapsedMs)} | ETA: ${
        params.current > 0 ? formatDurationMs(Math.round(etaMs)) : "-"
      }`,
    );

    this.errorsSummaryEl.setText(`Errors: ${params.errors.length}`);
    this.renderEvents(params.errors, params.events);
  }

  setFinished(message: string): void {
    this.statusEl.setText(message);
  }

  private renderEvents(
    errors: ProgressErrorItem[],
    events: ProgressEventItem[],
  ): void {
    this.errorsListEl.empty();

    const showRows = this.showOnlyErrors
      ? events.filter((item) => item.status === "error")
      : events;

    if (showRows.length === 0) {
      this.errorsListEl.createEl("div", {
        text: this.showOnlyErrors ? "No errors." : "No activity yet.",
      });
      return;
    }

    for (const item of showRows.slice(-200)) {
      const row = this.errorsListEl.createDiv();
      row.style.marginBottom = "6px";
      const label = item.status === "error" ? "ERROR" : "OK";
      row.createEl("div", { text: `${label}: ${item.filePath}` });

      if (item.status === "error") {
        const errorMessage =
          errors.find((error) => error.filePath === item.filePath)?.message ??
          item.message ??
          "Unknown error";
        row.createEl("small", { text: errorMessage });
      } else if (item.message) {
        row.createEl("small", { text: item.message });
      }
    }
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
      text: `Fallback used: ${this.summary.usedFallbackCount} | Errors: ${this.summary.errorCount} | Elapsed: ${formatDurationMs(this.summary.elapsedMs)}${this.summary.cancelled ? " | Cancelled" : ""}`,
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

      this.renderSemanticCandidates(section, suggestion.semanticCandidates ?? []);
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

  private renderSemanticCandidates(
    parent: HTMLElement,
    candidates: SemanticCandidatePreview[],
  ): void {
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
        text: `- ${item.path} (${formatSimilarity(item.similarity)})`,
      });
    }

    if (candidates.length > previewCount) {
      list.createEl("small", {
        text: `...and ${candidates.length - previewCount} more`,
      });
    }
  }
}

interface LocalQARequestPayload {
  question: string;
  topK: number;
}

interface LocalQASourceItem {
  path: string;
  similarity: number;
}

interface LocalQAResultPayload {
  question: string;
  answer: string;
  model: string;
  embeddingModel: string;
  sources: LocalQASourceItem[];
}

class LocalQAInputModal extends Modal {
  private readonly defaultTopK: number;
  private readonly onSubmit: (payload: LocalQARequestPayload) => Promise<void>;

  constructor(
    app: App,
    defaultTopK: number,
    onSubmit: (payload: LocalQARequestPayload) => Promise<void>,
  ) {
    super(app);
    this.defaultTopK = defaultTopK;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
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
        new Notice("Question is empty.");
        return;
      }

      const parsedTopK = Number.parseInt(topKInput.value, 10);
      const topK =
        Number.isFinite(parsedTopK) && parsedTopK >= 1
          ? Math.min(15, parsedTopK)
          : this.defaultTopK;

      await this.onSubmit({ question, topK });
      this.close();
    };
  }
}

class LocalQAResultModal extends Modal {
  private readonly payload: LocalQAResultPayload;

  constructor(app: App, payload: LocalQAResultPayload) {
    super(app);
    this.payload = payload;
  }

  onOpen(): void {
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
          text: `- ${source.path} (${formatSimilarity(source.similarity)})`,
        });
      }
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
      text: "Language docs: README.md (index) | README_KO.md (Korean quick access)",
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

    const ollamaOptions = this.plugin.getOllamaModelOptions();
    new Setting(containerEl)
      .setName("Ollama detected model picker")
      .setDesc(
        "Choose among detected models. (추천)=recommended, (불가)=not suitable for analysis.",
      )
      .addDropdown((dropdown) => {
        if (ollamaOptions.length === 0) {
          dropdown.addOption("", "(No models detected)");
          dropdown.setValue("");
        } else {
          for (const option of ollamaOptions) {
            const suffix =
              option.status === "recommended"
                ? " (추천)"
                : option.status === "unavailable"
                  ? " (불가)"
                  : "";
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
            new Notice(`Selected model is marked as (불가): ${value}`, 4500);
          }

          this.display();
        });
      })
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
      .setName("Ollama model (manual)")
      .setDesc("Manual override if you want a custom model name.")
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
      .setDesc("Detect local models and auto-choose recommended when current is missing.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ollamaAutoPickEnabled)
          .onChange(async (value) => {
            this.plugin.settings.ollamaAutoPickEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Ollama detection summary")
      .setDesc(this.plugin.getOllamaDetectionSummary());

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
      .setDesc("In addition to persistent progress modal, show short notices.")
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
            this.plugin.settings.maxTags = parsePositiveInt(
              value,
              this.plugin.settings.maxTags,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max linked")
      .addText((text) =>
        text
          .setPlaceholder("8")
          .setValue(String(this.plugin.settings.maxLinked))
          .onChange(async (value) => {
            this.plugin.settings.maxLinked = parsePositiveInt(
              value,
              this.plugin.settings.maxLinked,
            );
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Semantic linking (Ollama embeddings)" });

    new Setting(containerEl)
      .setName("Enable semantic candidate ranking")
      .setDesc(
        "Use local Ollama embeddings to rank likely related notes before AI linked suggestion.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.semanticLinkingEnabled)
          .onChange(async (value) => {
            this.plugin.settings.semanticLinkingEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Embedding Ollama base URL")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:11434")
          .setValue(this.plugin.settings.semanticOllamaBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.semanticOllamaBaseUrl = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.refreshEmbeddingModelDetection({
              notify: false,
              autoApply: true,
            });
          }),
      );

    const embeddingOptions = this.plugin.getEmbeddingModelOptions();
    new Setting(containerEl)
      .setName("Embedding detected model picker")
      .setDesc(
        "Choose among detected models. (추천)=recommended, (불가)=not suitable for embeddings.",
      )
      .addDropdown((dropdown) => {
        if (embeddingOptions.length === 0) {
          dropdown.addOption("", "(No models detected)");
          dropdown.setValue("");
        } else {
          for (const option of embeddingOptions) {
            const suffix =
              option.status === "recommended"
                ? " (추천)"
                : option.status === "unavailable"
                  ? " (불가)"
                  : "";
            dropdown.addOption(option.model, `${option.model}${suffix}`);
          }

          const current = this.plugin.settings.semanticOllamaModel;
          if (
            current &&
            embeddingOptions.some((option) => option.model === current)
          ) {
            dropdown.setValue(current);
          } else {
            dropdown.setValue(embeddingOptions[0]?.model ?? "");
          }
        }

        dropdown.onChange(async (value) => {
          if (!value) {
            return;
          }
          this.plugin.settings.semanticOllamaModel = value;
          await this.plugin.saveSettings();

          if (!isOllamaModelEmbeddingCapable(value)) {
            new Notice(`Selected model is marked as (불가): ${value}`, 4500);
          }

          this.display();
        });
      })
      .addButton((button) =>
        button.setButtonText("Refresh").onClick(async () => {
          await this.plugin.refreshEmbeddingModelDetection({
            notify: true,
            autoApply: true,
          });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Use recommended").onClick(async () => {
          await this.plugin.applyRecommendedEmbeddingModel(true);
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Embedding model (manual)")
      .setDesc("Manual override if you want a custom embedding model name.")
      .addText((text) =>
        text
          .setPlaceholder("nomic-embed-text")
          .setValue(this.plugin.settings.semanticOllamaModel)
          .onChange(async (value) => {
            this.plugin.settings.semanticOllamaModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-pick recommended embedding model")
      .setDesc(
        "Detect local models and auto-choose recommended when current is missing.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.semanticAutoPickEnabled)
          .onChange(async (value) => {
            this.plugin.settings.semanticAutoPickEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Embedding detection summary")
      .setDesc(this.plugin.getEmbeddingDetectionSummary());

    new Setting(containerEl)
      .setName("Semantic top-k candidates")
      .addText((text) =>
        text
          .setPlaceholder("24")
          .setValue(String(this.plugin.settings.semanticTopK))
          .onChange(async (value) => {
            this.plugin.settings.semanticTopK = parsePositiveInt(
              value,
              this.plugin.settings.semanticTopK,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Semantic min similarity")
      .setDesc("Range: 0.0 to 1.0")
      .addText((text) =>
        text
          .setPlaceholder("0.25")
          .setValue(String(this.plugin.settings.semanticMinSimilarity))
          .onChange(async (value) => {
            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
              this.plugin.settings.semanticMinSimilarity = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Semantic source max chars")
      .setDesc("Trim note text before embedding to keep local runs fast.")
      .addText((text) =>
        text
          .setPlaceholder("5000")
          .setValue(String(this.plugin.settings.semanticMaxChars))
          .onChange(async (value) => {
            this.plugin.settings.semanticMaxChars = parsePositiveInt(
              value,
              this.plugin.settings.semanticMaxChars,
            );
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Local Q&A (security-first)" });

    new Setting(containerEl)
      .setName("Q&A Ollama base URL")
      .setDesc("Leave empty to use main Ollama base URL.")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:11434")
          .setValue(this.plugin.settings.qaOllamaBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.qaOllamaBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Q&A model")
      .setDesc("Leave empty to use main analysis model.")
      .addText((text) =>
        text
          .setPlaceholder("qwen2.5:7b")
          .setValue(this.plugin.settings.qaOllamaModel)
          .onChange(async (value) => {
            this.plugin.settings.qaOllamaModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Q&A retrieval top-k")
      .addText((text) =>
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.qaTopK))
          .onChange(async (value) => {
            this.plugin.settings.qaTopK = parsePositiveInt(
              value,
              this.plugin.settings.qaTopK,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Q&A max context chars")
      .setDesc("Maximum total note characters to send to local LLM.")
      .addText((text) =>
        text
          .setPlaceholder("12000")
          .setValue(String(this.plugin.settings.qaMaxContextChars))
          .onChange(async (value) => {
            this.plugin.settings.qaMaxContextChars = parsePositiveInt(
              value,
              this.plugin.settings.qaMaxContextChars,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Allow non-local Q&A endpoint (danger)")
      .setDesc("Off by default. Keep disabled to prevent note data leaving localhost.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAllowNonLocalEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.qaAllowNonLocalEndpoint = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Remove legacy AI-prefixed keys")
      .setDesc(
        "If enabled, removes only legacy keys like ai_*/autolinker_* while preserving other existing keys (including linter date fields).",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.cleanUnknownFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.cleanUnknownFrontmatter = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Property cleanup" });

    new Setting(containerEl)
      .setName("Enable cleanup rules during apply")
      .setDesc("When applying AI suggestions, also remove frontmatter keys by rules below.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.propertyCleanupEnabled)
          .onChange(async (value) => {
            this.plugin.settings.propertyCleanupEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Cleanup exact keys")
      .setDesc("Comma/newline separated keys. Example: related, linked_context")
      .addTextArea((text) =>
        text
          .setPlaceholder("related")
          .setValue(this.plugin.settings.propertyCleanupKeys)
          .onChange(async (value) => {
            this.plugin.settings.propertyCleanupKeys = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Pick cleanup keys from selected notes")
      .setDesc("Scan selected notes and choose keys by checkbox.")
      .addButton((button) =>
        button.setButtonText("Open picker").onClick(async () => {
          await this.plugin.openCleanupKeyPicker();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Cleanup key prefixes")
      .setDesc("Comma/newline separated prefixes. Example: temp_, draft_")
      .addTextArea((text) =>
        text
          .setPlaceholder("temp_,draft_")
          .setValue(this.plugin.settings.propertyCleanupPrefixes)
          .onChange(async (value) => {
            this.plugin.settings.propertyCleanupPrefixes = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Never remove these keys")
      .setDesc("Comma/newline separated keys that override cleanup rules.")
      .addTextArea((text) =>
        text
          .setPlaceholder("date created,date updated")
          .setValue(this.plugin.settings.propertyCleanupKeepKeys)
          .onChange(async (value) => {
            this.plugin.settings.propertyCleanupKeepKeys = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Run cleanup command")
      .setDesc(
        "Use command palette: apply='Auto-Linker: Cleanup frontmatter properties for selected notes', preview='Auto-Linker: Dry-run cleanup frontmatter properties for selected notes'.",
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
      .setName("Selection path width percent")
      .setDesc("Controls path width in Select target notes/folders modal (45-100).")
      .addText((text) =>
        text
          .setPlaceholder("72")
          .setValue(String(this.plugin.settings.selectionPathWidthPercent))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 45 && parsed <= 100) {
              this.plugin.settings.selectionPathWidthPercent = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Excluded folder patterns")
      .setDesc("Comma-separated substrings. Matched folders are ignored during selection/analysis.")
      .addText((text) =>
        text
          .setPlaceholder(".obsidian,Auto-Linker Backups")
          .setValue(this.plugin.settings.excludedFolderPatterns)
          .onChange(async (value) => {
            this.plugin.settings.excludedFolderPatterns = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Backup selected notes before apply")
      .setDesc("You can also override this every run from the backup confirmation dialog.")
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

    new Setting(containerEl)
      .setName("Backup retention count")
      .setDesc("Keep only latest N backups (old backups are deleted automatically).")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.settings.backupRetentionCount))
          .onChange(async (value) => {
            this.plugin.settings.backupRetentionCount = parsePositiveInt(
              value,
              this.plugin.settings.backupRetentionCount,
            );
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
  private ollamaDetectionOptions: OllamaModelOption[] = [];
  private ollamaDetectionSummary =
    "Model detection has not run yet. Click refresh to detect installed Ollama models.";
  private embeddingDetectionCache: OllamaEmbeddingDetectionResult | null = null;
  private embeddingDetectionOptions: OllamaEmbeddingModelOption[] = [];
  private embeddingDetectionSummary =
    "Embedding model detection has not run yet. Click refresh to detect installed Ollama models.";

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
      id: "cleanup-selected-frontmatter",
      name: "Auto-Linker: Cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(false),
    });

    this.addCommand({
      id: "cleanup-selected-frontmatter-dry-run",
      name: "Auto-Linker: Dry-run cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(true),
    });

    this.addCommand({
      id: "select-cleanup-keys-from-selected-notes",
      name: "Auto-Linker: Select cleanup keys from selected notes",
      callback: async () => this.openCleanupKeyPicker(),
    });

    this.addCommand({
      id: "refresh-ollama-models",
      name: "Auto-Linker: Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      },
    });

    this.addCommand({
      id: "refresh-embedding-models",
      name: "Auto-Linker: Refresh embedding model detection",
      callback: async () => {
        await this.refreshEmbeddingModelDetection({ notify: true, autoApply: true });
      },
    });

    this.addCommand({
      id: "generate-moc-now",
      name: "Auto-Linker: Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection(),
    });

    this.addCommand({
      id: "ask-local-ai-from-selected-notes",
      name: "Auto-Linker: Ask local AI from selected notes",
      callback: async () => this.openLocalQaInputModal(),
    });

    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));

    await this.refreshOllamaDetection({ notify: false, autoApply: true });
    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
  }

  onunload(): void {
    this.setStatus("idle");
  }

  getOllamaDetectionSummary(): string {
    return this.ollamaDetectionSummary;
  }

  getOllamaModelOptions(): OllamaModelOption[] {
    return this.ollamaDetectionOptions;
  }

  getEmbeddingDetectionSummary(): string {
    return this.embeddingDetectionSummary;
  }

  getEmbeddingModelOptions(): OllamaEmbeddingModelOption[] {
    return this.embeddingDetectionOptions;
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

  async applyRecommendedEmbeddingModel(notify: boolean): Promise<void> {
    if (!this.embeddingDetectionCache?.recommended) {
      if (notify) {
        this.notice("No recommended embedding model found. Refresh detection first.");
      }
      return;
    }

    this.settings.semanticOllamaModel = this.embeddingDetectionCache.recommended;
    await this.saveSettings();

    if (notify) {
      this.notice(
        `Embedding model set to recommended: ${this.settings.semanticOllamaModel}`,
      );
    }
  }

  async refreshOllamaDetection(options: {
    notify: boolean;
    autoApply: boolean;
  }): Promise<OllamaDetectionResult | null> {
    try {
      const detected = await detectOllamaModels(this.settings.ollamaBaseUrl);
      this.ollamaDetectionCache = detected;
      this.ollamaDetectionOptions = buildOllamaModelOptions(
        detected.models,
        detected.recommended,
      );

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
      this.ollamaDetectionCache = null;
      this.ollamaDetectionOptions = [];
      this.ollamaDetectionSummary = `Detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Ollama model detection failed: ${message}`);
      }
      return null;
    }
  }

  async refreshEmbeddingModelDetection(options: {
    notify: boolean;
    autoApply: boolean;
  }): Promise<OllamaEmbeddingDetectionResult | null> {
    const baseUrl =
      this.settings.semanticOllamaBaseUrl.trim() || this.settings.ollamaBaseUrl.trim();
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
        detected.recommended,
      );

      const modelListPreview =
        detected.models.length > 0
          ? detected.models.slice(0, 5).join(", ")
          : "(none)";
      this.embeddingDetectionSummary = [
        `Detected: ${detected.models.length} model(s).`,
        `Current: ${this.settings.semanticOllamaModel || "(not set)"}.`,
        `Recommended: ${detected.recommended || "(none)"}.`,
        `Reason: ${detected.reason}`,
        `Preview: ${modelListPreview}`,
      ].join(" ");

      if (options.autoApply && this.settings.semanticAutoPickEnabled) {
        const current = this.settings.semanticOllamaModel.trim();
        const currentExists = current.length > 0 && detected.models.includes(current);
        if ((!current || !currentExists) && detected.recommended) {
          this.settings.semanticOllamaModel = detected.recommended;
          await this.saveSettings();
          if (options.notify) {
            this.notice(
              `Auto-selected embedding model: ${detected.recommended} (${detected.reason})`,
            );
          }
        }
      }

      if (options.notify) {
        this.notice(this.embeddingDetectionSummary, 5000);
      }

      return detected;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown embedding detection error";
      this.embeddingDetectionCache = null;
      this.embeddingDetectionOptions = [];
      this.embeddingDetectionSummary = `Embedding detection failed: ${message}`;
      if (options.notify) {
        this.notice(`Embedding model detection failed: ${message}`);
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
    if (!Number.isFinite(this.settings.selectionPathWidthPercent)) {
      this.settings.selectionPathWidthPercent =
        DEFAULT_SETTINGS.selectionPathWidthPercent;
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
      this.settings.qaAllowNonLocalEndpoint =
        DEFAULT_SETTINGS.qaAllowNonLocalEndpoint;
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

  private parseSimpleList(raw: string): string[] {
    return raw
      .split(/[\n,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  private parseFrontmatterFromContent(
    content: string,
  ): Record<string, unknown> | null {
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
      const parsed = parseYaml(yamlRaw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return null;
    }
  }

  private async readFrontmatterSnapshot(
    file: TFile,
  ): Promise<Record<string, unknown> | null> {
    const raw = await this.app.vault.cachedRead(file);
    return this.parseFrontmatterFromContent(raw);
  }

  private async collectCleanupKeyStats(files: TFile[]): Promise<CleanupKeyStat[]> {
    const counts = new Map<string, number>();

    for (const file of files) {
      const frontmatter = await this.readFrontmatterSnapshot(file);
      if (!frontmatter) {
        continue;
      }

      const keys = Object.keys(frontmatter)
        .map((key) => key.trim().toLowerCase())
        .filter((key) => key.length > 0);

      const unique = new Set(keys);
      for (const key of unique) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  async openCleanupKeyPicker(): Promise<void> {
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
        this.notice(`Cleanup exact keys updated (${selected.length} selected).`, 5000);
      },
    ).open();
  }

  private isLocalEndpoint(urlText: string): boolean {
    try {
      const parsed = new URL(urlText);
      const host = parsed.hostname.toLowerCase();
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0"
      );
    } catch {
      return false;
    }
  }

  private resolveQaBaseUrl(): string {
    const qa = this.settings.qaOllamaBaseUrl.trim();
    const fallback = this.settings.ollamaBaseUrl.trim();
    return qa || fallback;
  }

  private resolveQaModel(): string {
    const qa = this.settings.qaOllamaModel.trim();
    const fallback = this.settings.ollamaModel.trim();
    return qa || fallback;
  }

  private trimTextForContext(source: string, maxChars: number): string {
    const collapsed = source.replace(/\s+/g, " ").trim();
    return collapsed.slice(0, Math.max(400, maxChars));
  }

  private tokenizeQuery(text: string): string[] {
    return [...new Set(
      text
        .toLowerCase()
        .split(/[\s,.;:!?()[\]{}"'<>\\/|`~!@#$%^&*+=_-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    )];
  }

  private rerankQaHits(
    hits: { path: string; similarity: number }[],
    question: string,
    topK: number,
  ): { path: string; similarity: number }[] {
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
        boosted: hit.similarity + boost,
      };
    });

    scored.sort((a, b) => b.boosted - a.boosted || a.path.localeCompare(b.path));
    return scored.slice(0, Math.max(1, topK)).map((item) => ({
      path: item.path,
      similarity: item.similarity,
    }));
  }

  private extractRelevantSnippet(
    source: string,
    query: string,
    maxChars: number,
  ): string {
    const normalized = source.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const terms = this.tokenizeQuery(query);

    if (terms.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }

    const lowerLines = lines.map((line) => line.toLowerCase());
    const scored: Array<{ idx: number; score: number }> = [];
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
    const pickedIndexes = new Set<number>();
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
      const candidate = output.length > 0 ? `${output}\n${line}` : line;
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

  private buildLocalQaPrompt(
    question: string,
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>,
  ): string {
    const contextText = sourceBlocks
      .map(
        (item, index) =>
          `Source ${index + 1}\nPath: ${item.path}\nSimilarity: ${formatSimilarity(item.similarity)}\nContent:\n${item.content}`,
      )
      .join("\n\n---\n\n");

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
      contextText,
    ].join("\n");
  }

  private async openLocalQaInputModal(): Promise<void> {
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
      },
    ).open();
  }

  private async runLocalQa(question: string, topK: number): Promise<void> {
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
    if (
      !this.settings.qaAllowNonLocalEndpoint &&
      !this.isLocalEndpoint(qaBaseUrl)
    ) {
      this.notice(
        "Blocked by security policy: Q&A endpoint must be localhost unless explicitly allowed.",
        7000,
      );
      return;
    }

    const qaModel = this.resolveQaModel();
    if (!qaModel) {
      this.notice("Q&A model is empty.");
      return;
    }
    if (!isOllamaModelAnalyzable(qaModel)) {
      this.notice(`Q&A model is not suitable: ${qaModel}`, 6000);
      return;
    }

    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
    const embeddingModel = this.settings.semanticOllamaModel.trim();
    if (!embeddingModel) {
      this.notice("Embedding model is empty. Refresh embedding detection first.", 6000);
      return;
    }

    this.setStatus("semantic retrieval for local qa...");
    const retrievalCandidateK = Math.max(topK * 3, topK);
    const retrieval = await searchSemanticNotesByQuery(
      this.app,
      selectedFiles,
      this.settings,
      question,
      retrievalCandidateK,
    );

    if (retrieval.errors.length > 0) {
      this.notice(
        `Semantic retrieval had ${retrieval.errors.length} issue(s).`,
        6000,
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

    const maxContextChars = Math.max(2000, this.settings.qaMaxContextChars);
    const sourceBlocks: Array<{ path: string; similarity: number; content: string }> = [];
    let usedChars = 0;

    for (const hit of rankedHits) {
      if (usedChars >= maxContextChars) {
        break;
      }
      const entry = this.app.vault.getAbstractFileByPath(hit.path);
      if (!(entry instanceof TFile)) {
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
        content: snippet,
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
    const response = await requestUrl({
      url: `${qaBaseUrl.replace(/\/$/, "")}/api/generate`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        prompt,
        stream: false,
      }),
      throw: false,
    });

    if (response.status >= 300) {
      this.notice(`Local Q&A request failed: ${response.status}`, 6000);
      this.setStatus("idle");
      return;
    }

    const answer =
      typeof response.json?.response === "string"
        ? response.json.response.trim()
        : response.text.trim();
    if (!answer) {
      this.notice("Local Q&A returned an empty answer.");
      this.setStatus("idle");
      return;
    }

    const sourceList: LocalQASourceItem[] = sourceBlocks.map((item) => ({
      path: item.path,
      similarity: item.similarity,
    }));

    new LocalQAResultModal(this.app, {
      question,
      answer,
      model: qaModel,
      embeddingModel,
      sources: sourceList,
    }).open();

    this.notice(
      `Local Q&A done. Sources=${sourceList.length}, cacheHits=${retrieval.cacheHits}, cacheWrites=${retrieval.cacheWrites}`,
      6000,
    );
    this.setStatus("idle");
  }

  private getPropertyCleanupConfig(): FrontmatterCleanupConfig | undefined {
    const removeKeys = new Set(this.parseSimpleList(this.settings.propertyCleanupKeys));
    const removePrefixes = this.parseSimpleList(this.settings.propertyCleanupPrefixes);
    const keepKeys = new Set(this.parseSimpleList(this.settings.propertyCleanupKeepKeys));

    if (removeKeys.size === 0 && removePrefixes.length === 0) {
      return undefined;
    }

    return {
      removeKeys,
      removePrefixes,
      keepKeys,
    };
  }

  private getCandidateLinkPathsForFile(
    filePath: string,
    selectedFiles: TFile[],
    semanticNeighbors?: Map<string, SemanticNeighbor[]>,
  ): string[] {
    const fallback = selectedFiles
      .filter((candidate) => candidate.path !== filePath)
      .map((candidate) => candidate.path);

    if (!semanticNeighbors || !this.settings.semanticLinkingEnabled) {
      return fallback;
    }

    const semantic = (semanticNeighbors.get(filePath) ?? []).map((item) => item.path);
    if (semantic.length === 0) {
      return fallback;
    }

    const candidateLimit = Math.max(this.settings.maxLinked * 3, this.settings.semanticTopK);
    return mergeUniqueStrings(semantic, fallback).slice(0, candidateLimit);
  }

  private parseExcludedPatterns(): string[] {
    return this.settings.excludedFolderPatterns
      .split(/[\n,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  private isPathExcluded(path: string): boolean {
    const lower = path.toLowerCase();
    const patterns = this.parseExcludedPatterns();
    return patterns.some((pattern) => lower.includes(pattern));
  }

  private getAllMarkdownFiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => !this.isPathExcluded(file.path))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private getAllFolders(): TFolder[] {
    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter(
        (entry): entry is TFolder =>
          entry instanceof TFolder &&
          entry.path.trim().length > 0 &&
          !this.isPathExcluded(entry.path),
      );

    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  private collectFilesFromFolder(
    folder: TFolder,
    includeSubfolders: boolean,
    out: Set<string>,
  ): void {
    if (this.isPathExcluded(folder.path)) {
      return;
    }

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        if (!this.isPathExcluded(child.path)) {
          out.add(child.path);
        }
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
      if (this.isPathExcluded(path)) {
        continue;
      }

      const entry = this.app.vault.getAbstractFileByPath(path);
      if (entry instanceof TFile && entry.extension === "md") {
        selectedPaths.add(entry.path);
      }
    }

    for (const folderPath of this.settings.targetFolderPaths) {
      if (this.isPathExcluded(folderPath)) {
        continue;
      }

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
          5000,
        );
      },
    ).open();
  }

  private async askBackupDecision(): Promise<BackupDecision> {
    return BackupConfirmModal.ask(this.app, this.settings.backupBeforeApply);
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

  private async runPropertyCleanup(dryRun: boolean): Promise<void> {
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
        6000,
      );
      return;
    }

    let backupFolder: string | null = null;
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
          this.notice(`Backup completed before cleanup: ${backupFolder}`, 5000);
        }
      }
    }

    const progressModal = new RunProgressModal(
      this.app,
      dryRun
        ? "Dry-run cleanup for selected frontmatter"
        : "Cleaning selected frontmatter",
    );
    progressModal.open();

    const errors: ProgressErrorItem[] = [];
    const events: ProgressEventItem[] = [];
    const startedAt = Date.now();
    let cancelled = false;
    let changedFiles = 0;
    let removedKeysTotal = 0;
    const dryRunReportRows: string[] = [];

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
        events,
      });
      this.setStatus(
        `${dryRun ? "dry-run cleanup" : "cleaning"} ${index + 1}/${selectedFiles.length}`,
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
            cleanupConfig,
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
            message: `would remove ${previewRemoved.length}`,
          });
          dryRunReportRows.push(`## ${file.path}`);
          dryRunReportRows.push(
            `- Remove keys (${previewRemoved.length}): ${previewRemoved
              .sort((a, b) => a.localeCompare(b))
              .join(", ")}`,
          );
          dryRunReportRows.push(
            `- Before keys: ${Object.keys(snapshot)
              .sort((a, b) => a.localeCompare(b))
              .join(", ")}`,
          );
          dryRunReportRows.push(
            `- After keys: ${Object.keys(previewCleaned.next)
              .sort((a, b) => a.localeCompare(b))
              .join(", ")}`,
          );
          dryRunReportRows.push("");
          continue;
        }

        let removedForFile = 0;

        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const current = frontmatter as Record<string, unknown>;
          const cleaned = cleanupFrontmatterRecord(current, {
            cleanUnknown: this.settings.cleanUnknownFrontmatter,
            cleanupConfig,
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
          message: `removed ${removedForFile}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown cleanup error";
        errors.push({ filePath: file.path, message });
        events.push({ filePath: file.path, status: "error", message });
      }
    }

    progressModal.setFinished(
      cancelled
        ? `${dryRun ? "Dry-run cleanup" : "Cleanup"} stopped by user.`
        : `${dryRun ? "Dry-run cleanup" : "Cleanup"} complete: ${changedFiles} changed of ${selectedFiles.length}`,
    );
    progressModal.close();

    this.setStatus(
      cancelled
        ? `${dryRun ? "dry-run cleanup" : "cleanup"} stopped (${changedFiles}/${selectedFiles.length})`
        : `${dryRun ? "dry-run cleanup" : "cleanup"} done (${changedFiles}/${selectedFiles.length})`,
    );

    let reportPath: string | null = null;
    if (dryRun) {
      const removeKeys = cleanupConfig
        ? [...cleanupConfig.removeKeys].sort((a, b) => a.localeCompare(b)).join(", ")
        : "(none)";
      const removePrefixes = cleanupConfig
        ? cleanupConfig.removePrefixes.join(", ") || "(none)"
        : "(none)";
      const keepKeys = cleanupConfig
        ? [...cleanupConfig.keepKeys].sort((a, b) => a.localeCompare(b)).join(", ")
        : "(none)";

      const lines: string[] = [];
      lines.push("# Auto-Linker Cleanup Dry-Run Report");
      lines.push("");
      lines.push(`Generated: ${new Date().toISOString()}`);
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
        reportPath = normalizePath(
          `Auto-Linker Reports/cleanup-dry-run-${formatBackupStamp(new Date())}.md`,
        );
        await this.ensureParentFolder(reportPath);
        await this.app.vault.adapter.write(
          reportPath,
          `${lines.join("\n").trim()}\n`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown dry-run report error";
        this.notice(`Dry-run report write failed: ${message}`, 6000);
      }
    }

    const summary = `${dryRun ? "Dry-run cleanup" : "Cleanup"} finished. Changed files=${changedFiles}, removed keys=${removedKeysTotal}, errors=${errors.length}${cancelled ? " (stopped early)" : ""}.`;

    if (dryRun && reportPath) {
      this.notice(`${summary} Report: ${reportPath}`, 8000);
      return;
    }

    if (backupFolder) {
      this.notice(`${summary} Backup: ${backupFolder}`, 7000);
    } else {
      this.notice(summary, 6000);
    }
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

      const selectedModel = this.settings.ollamaModel.trim();
      if (!selectedModel) {
        this.notice("Ollama model is empty. Refresh model detection and select one.");
        return;
      }

      if (!isOllamaModelAnalyzable(selectedModel)) {
        this.notice(
          `Selected Ollama model is marked as (불가): ${selectedModel}. Choose a chat/instruct model first.`,
          6000,
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
          6000,
        );
        return;
      }

      if (!isOllamaModelEmbeddingCapable(embeddingModel)) {
        this.notice(
          `Selected embedding model is marked as (불가): ${embeddingModel}. Choose an embedding model first.`,
          6000,
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

    let backupFolder: string | null = null;
    if (decision.backupBeforeRun) {
      this.setStatus("creating backup...");
      backupFolder = await this.createBackupForFiles(selectedFiles);
      if (backupFolder) {
        this.notice(`Backup completed before analysis: ${backupFolder}`, 5000);
      }
    }

    let semanticNeighbors = new Map<string, SemanticNeighbor[]>();
    if (this.settings.semanticLinkingEnabled && this.settings.analyzeLinked) {
      this.setStatus("building semantic candidates...");
      try {
        const semanticResult = await buildSemanticNeighborMap(
          this.app,
          selectedFiles,
          this.settings,
        );
        semanticNeighbors = semanticResult.neighborMap;

        const neighborCount = [...semanticResult.neighborMap.values()].reduce(
          (sum, items) => sum + items.length,
          0,
        );

        this.notice(
          `Semantic candidates ready: vectors=${semanticResult.generatedVectors}, cacheHits=${semanticResult.cacheHits}, cacheWrites=${semanticResult.cacheWrites}, edges=${neighborCount}, model=${semanticResult.model}.`,
          5000,
        );

        if (semanticResult.errors.length > 0) {
          this.notice(
            `Semantic embedding had ${semanticResult.errors.length} issue(s). Falling back per file where needed.`,
            6000,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown semantic embedding error";
        this.notice(`Semantic candidate ranking skipped: ${message}`, 6000);
      }
    }

    const progressModal = new RunProgressModal(this.app, "Analyzing selected notes");
    progressModal.open();

    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions: NoteSuggestion[] = [];
    const errors: ProgressErrorItem[] = [];
    const events: ProgressEventItem[] = [];
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
        events,
      });
      this.setStatus(`analyzing ${index + 1}/${selectedFiles.length}`);

      try {
        const request = {
          sourcePath: file.path,
          sourceText: await this.app.vault.cachedRead(file),
          candidateLinkPaths: this.getCandidateLinkPathsForFile(
            file.path,
            selectedFiles,
            semanticNeighbors,
          ),
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

        const semanticCandidates: SemanticCandidatePreview[] = (
          semanticNeighbors.get(file.path) ?? []
        ).map((item) => ({
          path: item.path,
          similarity: item.similarity,
        }));

        suggestions.push({
          file,
          existing: existingValidated,
          proposed: normalizedProposed,
          reasons: outcome.proposal.reasons ?? {},
          analysis: outcome.meta,
          semanticCandidates,
        });

        events.push({
          filePath: file.path,
          status: "ok",
          message: normalizedProposed.tags.length > 0 ? "suggested" : "no-change",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown analysis error";
        errors.push({ filePath: file.path, message });
        events.push({ filePath: file.path, status: "error", message });
      }
    }

    progressModal.setFinished(
      cancelled
        ? "Analysis stopped by user."
        : `Analysis complete: ${suggestions.length} changed of ${selectedFiles.length}`,
    );
    progressModal.close();

    const summary: AnalysisRunSummary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: selectedFiles.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt,
      cancelled,
      errorCount: errors.length,
    };

    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);

    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes. Provider=${summary.provider}, Model=${summary.model}, Errors=${summary.errorCount}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
        5000,
      );
      return;
    }

    if (cancelled) {
      this.notice(
        `Analysis stopped. Showing partial suggestions (${suggestions.length} file(s)).`,
        5000,
      );
    }

    if (this.settings.suggestionMode) {
      new SuggestionPreviewModal(
        this.app,
        summary,
        suggestions,
        this.settings.includeReasons,
        async () => {
          const applyResult = await this.applySuggestions(
            suggestions,
            selectedFiles,
            backupFolder,
            decision.backupBeforeRun,
            decision.backupBeforeRun,
          );
          if (!applyResult.cancelled && this.settings.generateMoc) {
            await this.generateMocFromSelection(suggestions);
          }
        },
      ).open();
      return;
    }

    const applyResult = await this.applySuggestions(
      suggestions,
      selectedFiles,
      backupFolder,
      decision.backupBeforeRun,
      decision.backupBeforeRun,
    );
    if (!applyResult.cancelled && this.settings.generateMoc) {
      await this.generateMocFromSelection(suggestions);
    }
  }

  private async applySuggestions(
    suggestions: NoteSuggestion[],
    selectedFilesForBackup: TFile[],
    existingBackupFolder: string | null,
    alreadyBackedUp: boolean,
    backupEnabledForRun: boolean,
  ): Promise<{ cancelled: boolean; errors: ProgressErrorItem[] }> {
    let backupFolder = existingBackupFolder;

    if (!alreadyBackedUp && backupEnabledForRun) {
      backupFolder = await this.createBackupForFiles(selectedFilesForBackup);
    }

    const progressModal = new RunProgressModal(this.app, "Applying suggestions");
    progressModal.open();

    const errors: ProgressErrorItem[] = [];
    const events: ProgressEventItem[] = [];
    const startedAt = Date.now();
    const cleanupConfig = this.settings.propertyCleanupEnabled
      ? this.getPropertyCleanupConfig()
      : undefined;
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
        events,
      });
      this.setStatus(`applying ${index + 1}/${suggestions.length}`);

      try {
        await this.app.fileManager.processFrontMatter(
          suggestion.file,
          (frontmatter) => {
            const current = frontmatter as Record<string, unknown>;
            const next = buildNextFrontmatter(current, suggestion.proposed, {
              cleanUnknown: this.settings.cleanUnknownFrontmatter,
              sortArrays: this.settings.sortArrays,
              cleanupConfig,
            });

            for (const key of Object.keys(current)) {
              delete current[key];
            }
            for (const [key, value] of Object.entries(next)) {
              current[key] = value;
            }
          },
        );
        events.push({ filePath: suggestion.file.path, status: "ok", message: "applied" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown apply error";
        errors.push({ filePath: suggestion.file.path, message });
        events.push({ filePath: suggestion.file.path, status: "error", message });
      }
    }

    progressModal.setFinished(
      cancelled
        ? "Apply stopped by user."
        : `Apply complete: ${suggestions.length - errors.length} succeeded`,
    );
    progressModal.close();

    this.setStatus(
      cancelled
        ? `apply stopped (${suggestions.length - errors.length}/${suggestions.length})`
        : `apply done (${suggestions.length - errors.length}/${suggestions.length})`,
    );

    if (backupFolder) {
      this.notice(
        `Apply finished. Backup: ${backupFolder}. Errors: ${errors.length}${cancelled ? " (stopped early)" : ""}`,
        6000,
      );
    } else {
      this.notice(
        `Apply finished. Errors: ${errors.length}${cancelled ? " (stopped early)" : ""}`,
        5000,
      );
    }

    return { cancelled, errors };
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

    await this.pruneOldBackups();

    return backupFolder;
  }

  private async pruneOldBackups(): Promise<void> {
    const keepCount = this.settings.backupRetentionCount;
    if (!Number.isFinite(keepCount) || keepCount < 1) {
      return;
    }

    const backupRoot = normalizePath(this.settings.backupRootPath);
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
