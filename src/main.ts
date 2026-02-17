import { exec as nodeExec } from "child_process";
import * as nodeFs from "fs";
import * as nodeOs from "os";
import * as nodePath from "path";
import { promisify } from "util";
import {
  App,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  Notice,
  parseYaml,
  Plugin,
  PluginSettingTab,
  requestUrl,
  setIcon,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
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
  AnalyzeRequest,
  AnalyzeOutcome,
  AnalysisRunSummary,
  BackupDecision,
  FieldReasons,
  KnowledgeWeaverSettings,
  ManagedFrontmatter,
  MetadataProposal,
  NoteSuggestion,
  OllamaDetectionResult,
  OllamaModelOption,
  ProgressErrorItem,
  ProviderId,
  QaPipelinePreset,
  QaRolePreset,
  SemanticCandidatePreview,
  SuggestionAnalysisMeta,
} from "./types";

const execAsync = promisify(nodeExec);

const DEFAULT_SETTINGS: KnowledgeWeaverSettings = {
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
  semanticMaxChars: 5000,
  qaOllamaBaseUrl: "http://127.0.0.1:11434",
  qaOllamaModel: "",
  qaTopK: 5,
  qaMaxContextChars: 12000,
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
  qaCustomSystemPrompt:
    "너는 로컬 Obsidian 노트 기반 실행 에이전트다. 항상 한국어로 답한다. 제공된 소스 범위 안에서만 답하고, 근거가 부족하면 반드시 \"정보 부족\"이라고 명시한다. 추측/환각/과장 표현을 금지한다. 우선순위: (1) 노트 링크를 정확히 연결해 그래프 인사이트를 강화 (2) 노트 기반 문서/분석/개발 작업 효율을 높이는 실행안 제시. 첨부가 있으면 첨부를 1순위 근거로 사용하고, 선택 노트는 보조 근거로만 사용한다. 답변 형식: 1) 한 줄 요약 2) 핵심 근거 (최대 5개) 3) 실행 가능한 다음 단계 (최대 5개). 주장에는 가능한 경우 소스 경로를 괄호로 표기한다. 장황함보다 정확성과 재현 가능성을 우선한다.",
  qaRolePreset: "ask",
  qaPipelinePreset: "orchestrator_safeguard",
  qaAskModel: "",
  qaAskVisionModel: "",
  qaImageGeneratorModel: "",
  qaCoderModel: "",
  qaArchitectModel: "",
  qaOrchestratorModel: "",
  qaSafeguardModel: "",
  qaBalancedPresetBaseModel: "qwen3:14b",
  qaBalancedPresetVisionModel: "qwen2.5vl:7b",
  qaBalancedPresetEmbeddingModel: "nomic-embed-text",
  qaQualityPresetBaseModel: "qwen3:30b",
  qaQualityPresetVisionModel: "qwen2.5vl:7b",
  qaQualityPresetEmbeddingModel: "nomic-embed-text",
  qaAskSystemPrompt:
    "너는 로컬 노트 기반 Ask 에이전트다. 항상 한국어로 답한다. 근거가 부족하면 '정보 부족'을 명시하고, 핵심만 정확하게 전달한다.",
  qaAskVisionSystemPrompt:
    "너는 Ask(vision) 역할이지만, 현재 파이프라인은 텍스트 중심임을 전제로 동작한다. 항상 한국어로 답한다. 실제 이미지를 직접 본 것처럼 말하지 않는다. 이미지 자체가 입력되지 않았으면 \"이미지 원본 확인 불가\"를 명시하고, 텍스트 기반으로 가능한 해석/요청사항/다음 확인 절차를 제시한다. 답변 형식: 1) 현재 확인 가능한 사실 2) 확인 불가능한 항목 3) 추가로 받으면 정확도가 올라가는 입력 목록",
  qaImageGeneratorSystemPrompt:
    "너는 이미지 생성 워크플로 설계 에이전트다. 항상 한국어로 답한다. 실제 이미지를 생성했다고 주장하지 말고, \"생성용 프롬프트 설계\"만 제공한다. 출력 형식: 1) 목적 요약 2) Positive prompt 3) Negative prompt 4) 스타일/구도/조명/색감 지시 5) 권장 파라미터(비율, 스텝, 시드 전략) 요청이 불명확하면 기본값을 명시하고 보수적으로 제안한다.",
  qaCoderSystemPrompt:
    "너는 구현 중심 코더 에이전트다. 항상 한국어로 답한다. 설계 설명보다 \"바로 적용 가능한 변경안\"을 우선한다. 규칙: - 요구사항에 직접 연결된 코드/구조만 제시 - 불확실한 부분은 가정을 명시 - 테스트/검증 절차를 반드시 포함 출력 형식: 1) 변경 요약 2) 파일 단위 수정 계획 3) 핵심 코드 스니펫 또는 패치 형태 제안 4) 테스트 항목(정상/엣지/회귀) 5) 롤백 방법",
  qaDebuggerSystemPrompt:
    "너는 디버깅 에이전트다. 항상 한국어로 답한다. 목표: 재현 가능성, 원인 분리, 안전한 수정. 규칙: - 원인 후보를 우선순위로 정리 - 각 후보별 검증 실험을 제시 - 확정되지 않은 원인을 단정하지 않는다 출력 형식: 1) 증상 정리 2) 원인 가설 Top 3 3) 가설별 검증 절차 4) 최소 수정안 5) 수정 후 검증 체크리스트",
  qaArchitectSystemPrompt:
    "너는 시스템 아키텍트 에이전트다. 항상 한국어로 답한다. 목표: 장기 유지보수 가능한 구조와 트레이드오프 제시. 규칙: - 대안 최소 2개 제시 - 성능/복잡도/운영비/보안 관점 비교 - 의사결정 기준을 명확히 제시 출력 형식: 1) 요구사항/제약 요약 2) 아키텍처 옵션 비교표 3) 권장안과 선택 이유 4) 단계적 이행 계획 5) 리스크와 모니터링 포인트",
  qaOrchestratorSystemPrompt:
    "너는 멀티 에이전트 오케스트레이터다. 항상 한국어로 답한다. 목표: 질문을 실행 가능한 작업 흐름으로 분해하고, 필요한 하위 역할(architect/coder/debugger/safeguard)을 지정한다. 규칙: - 사실 생성 금지, 근거 부족 시 \"정보 부족\" 표기 - 과도한 장문 금지, 핵심 의사결정 중심 - 첨부가 있으면 첨부를 1순위 근거로 사용 출력 형식: 1) 작업 목표/범위 2) 단계별 계획(순서/의존성/완료조건) 3) 역할 라우팅 표 (역할 | 맡길 일 | 기대 산출물) 4) 역할 실행 요약 (역할 | 실제 기여 | 산출물 | 조율 메모 | 미해결 이슈) 5) 위험요소와 완화책 6) 즉시 실행할 3단계",
  qaSafeguardSystemPrompt:
    "너는 보안/안전 검증 에이전트다. 항상 한국어로 답한다. 초점: 개인정보, 보안, 규정 준수, 과장/허위 주장 제거. 규칙: - 근거 없는 문장은 삭제 또는 \"정보 부족\"으로 낮춰 표현 - 민감정보 노출 가능성, 외부 전송 위험, 권한 과다 여부를 우선 점검 출력 형식: 1) 위험 요약 (심각도: 높음/중간/낮음) 2) 발견 항목 (문제 | 영향 | 근거) 3) 즉시 수정 권고안 4) 운영 전 최종 체크리스트",
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
  qaAttachmentIngestRootPath: "Auto Link Ingest",
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
  mocPath: "MOC/Selected Knowledge MOC.md",
};

const LOCAL_QA_VIEW_TYPE = "auto-linker-local-qa-view";
const LOCAL_QA_MAX_ATTACHMENTS = 10;
const LOCAL_QA_PDF_OCR_MAX_PAGES_FAST = 3;
const LOCAL_QA_PDF_OCR_MAX_PAGES_DETAILED = 8;
const ANALYSIS_CACHE_FILE = "analysis-proposal-cache.json";
const ANALYSIS_CACHE_VERSION = 1;
const ANALYSIS_CACHE_MAX_ENTRIES = 4000;
const ANALYSIS_HARD_MAX_CANDIDATES = 120;

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

function splitThinkingBlocks(rawText: string): {
  answer: string;
  thinking: string;
  hasOpenThinking: boolean;
} {
  const raw = rawText ?? "";
  if (!raw) {
    return { answer: "", thinking: "", hasOpenThinking: false };
  }

  let cursor = 0;
  let answer = "";
  let hasOpenThinking = false;
  const thinkingParts: string[] = [];

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
    hasOpenThinking,
  };
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

function isEnterLikeKey(event: KeyboardEvent): boolean {
  const legacyCode = (event as KeyboardEvent & { keyCode?: number; which?: number }).keyCode
    ?? (event as KeyboardEvent & { keyCode?: number; which?: number }).which
    ?? 0;
  return (
    event.key === "Enter" ||
    event.code === "Enter" ||
    event.code === "NumpadEnter" ||
    legacyCode === 13
  );
}

function shouldSubmitChatOnEnter(event: KeyboardEvent): boolean {
  return (
    isEnterLikeKey(event) &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing
  );
}

function insertTextareaLineBreak(target: HTMLTextAreaElement): void {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  target.setRangeText("\n", start, end, "end");
}

function handleChatTextareaEnterKey(
  event: KeyboardEvent,
  target: HTMLTextAreaElement,
  onSubmit: () => Promise<void>,
): void {
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

function cloneMetadataProposal(proposal: MetadataProposal): MetadataProposal {
  return {
    tags: Array.isArray(proposal.tags) ? [...proposal.tags] : [],
    topic: proposal.topic,
    linked: Array.isArray(proposal.linked) ? [...proposal.linked] : [],
    index: proposal.index,
    reasons: proposal.reasons
      ? {
          tags: proposal.reasons.tags,
          topic: proposal.reasons.topic,
          linked: proposal.reasons.linked,
          index: proposal.reasons.index,
        }
      : {},
  };
}

function cloneSuggestionMeta(meta: SuggestionAnalysisMeta): SuggestionAnalysisMeta {
  return {
    provider: meta.provider,
    model: meta.model,
    elapsedMs: meta.elapsedMs,
    usedFallback: meta.usedFallback,
  };
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

interface CapacityDecision {
  proceed: boolean;
}

interface NewNoteWatchDecision {
  action: "ignore" | "add_only" | "analyze_now";
}

class CapacityGuardModal extends Modal {
  private readonly selectedCount: number;
  private readonly recommendedMax: number;
  private readonly modelName: string;
  private readonly semanticEnabled: boolean;
  private readonly onResolve: (decision: CapacityDecision) => void;

  constructor(
    app: App,
    selectedCount: number,
    recommendedMax: number,
    modelName: string,
    semanticEnabled: boolean,
    onResolve: (decision: CapacityDecision) => void,
  ) {
    super(app);
    this.selectedCount = selectedCount;
    this.recommendedMax = recommendedMax;
    this.modelName = modelName;
    this.semanticEnabled = semanticEnabled;
    this.onResolve = onResolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Large selection warning" });
    contentEl.createEl("p", {
      text: `Selected ${this.selectedCount} notes. Recommended max for this setup is about ${this.recommendedMax}.`,
    });
    contentEl.createEl("p", {
      text: `Model: ${this.modelName || "(not set)"} | semantic linking: ${this.semanticEnabled ? "on" : "off"}`,
    });
    contentEl.createEl("p", {
      text: "Too many candidates can lower linked quality and slow local analysis. Continue anyway?",
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

  private resolve(decision: CapacityDecision): void {
    this.onResolve(decision);
    this.close();
  }

  static ask(
    app: App,
    selectedCount: number,
    recommendedMax: number,
    modelName: string,
    semanticEnabled: boolean,
  ): Promise<CapacityDecision> {
    return new Promise((resolve) => {
      new CapacityGuardModal(
        app,
        selectedCount,
        recommendedMax,
        modelName,
        semanticEnabled,
        resolve,
      ).open();
    });
  }
}

class NewNoteWatchModal extends Modal {
  private readonly filePath: string;
  private readonly watchedFolder: string;
  private readonly onResolve: (decision: NewNoteWatchDecision) => void;
  private resolved = false;

  constructor(
    app: App,
    filePath: string,
    watchedFolder: string,
    onResolve: (decision: NewNoteWatchDecision) => void,
  ) {
    super(app);
    this.filePath = filePath;
    this.watchedFolder = watchedFolder;
    this.onResolve = onResolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New note detected in watched folder" });
    contentEl.createEl("p", { text: `Folder: ${this.watchedFolder}` });
    contentEl.createEl("p", { text: `File: ${this.filePath}` });
    contentEl.createEl("p", {
      text: "Add this note to target selection and run analysis now?",
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
      cls: "mod-cta",
    });
    analyzeNowButton.onclick = () => this.resolve({ action: "analyze_now" });
  }

  onClose(): void {
    if (!this.resolved) {
      this.onResolve({ action: "ignore" });
      this.resolved = true;
    }
    this.contentEl.empty();
  }

  private resolve(decision: NewNoteWatchDecision): void {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.onResolve(decision);
    this.close();
  }

  static ask(app: App, filePath: string, watchedFolder: string): Promise<NewNoteWatchDecision> {
    return new Promise((resolve) => {
      new NewNoteWatchModal(app, filePath, watchedFolder, resolve).open();
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

interface LocalQASourceItem {
  path: string;
  similarity: number;
}

type LocalQaProgressStage =
  | "retrieval"
  | "generation"
  | "thinking"
  | "warning"
  | "error"
  | "info";

interface LocalQaProgressEvent {
  stage: LocalQaProgressStage;
  message: string;
  timestamp: string;
  detail?: string;
  thinkingChunk?: string;
}

type LocalQaResponseIntent = "default" | "comparison" | "plan" | "sources_only";
type LocalQaEndpointKind = "chat" | "generate";
type LocalQaPipelineStage =
  | "orchestrator"
  | "architect"
  | "coder"
  | "debugger"
  | "safeguard";

interface LocalQaCompletionPayload {
  answer: string;
  thinking: string;
  endpoint: LocalQaEndpointKind;
}

type LocalQaAgentActionType =
  | "read_note"
  | "write_note"
  | "append_note"
  | "list_folder"
  | "run_shell";

interface LocalQaAgentAction {
  type: LocalQaAgentActionType;
  path?: string;
  content?: string;
  command?: string;
  cwd?: string;
  timeoutSec?: number;
}

interface LocalQaAgentActionPlan {
  id: string;
  createdAt: string;
  model: string;
  question: string;
  actions: LocalQaAgentAction[];
}

interface LocalQaAgentActionResult {
  status: "ok" | "error" | "blocked";
  title: string;
  detail: string;
}

interface LocalQAResultPayload {
  question: string;
  answer: string;
  thinking: string;
  model: string;
  embeddingModel: string;
  sources: LocalQASourceItem[];
  retrievalCacheHits: number;
  retrievalCacheWrites: number;
}

interface LocalQAConversationTurn {
  role: "user" | "assistant";
  text: string;
}

interface LocalQaExternalContextDoc {
  label: string;
  content: string;
  path?: string;
}

type LocalQaAttachmentKind = "text" | "image" | "pdf";

interface LocalQaExternalAttachment {
  kind: LocalQaAttachmentKind;
  label: string;
  content?: string;
  imageBase64?: string;
  mimeType?: string;
  path?: string;
}

interface LocalQaAskOptions {
  openFilePath?: string;
}

interface LocalQAViewMessage {
  role: "user" | "assistant" | "system" | "thinking";
  text: string;
  timestamp: string;
  timeline?: LocalQaProgressEvent[];
  thinkingDetails?: string;
  sources?: LocalQASourceItem[];
  model?: string;
  embeddingModel?: string;
  retrievalCacheHits?: number;
  retrievalCacheWrites?: number;
  isDraft?: boolean;
}

interface LocalQaThreadSyncInput {
  messages: LocalQAViewMessage[];
  threadPath?: string;
  threadId?: string;
  createdAt?: string;
}

interface QaQuickCustomProfileSnapshot {
  version: number;
  savedAt: string;
  label: string;
  settings: {
    qaLocalPresetProfile: KnowledgeWeaverSettings["qaLocalPresetProfile"];
    ollamaModel: string;
    qaOllamaModel: string;
    semanticOllamaModel: string;
    qaAskModel: string;
    qaAskVisionModel: string;
    qaImageGeneratorModel: string;
    qaCoderModel: string;
    qaArchitectModel: string;
    qaOrchestratorModel: string;
    qaSafeguardModel: string;
    qaTopK: number;
    qaMaxContextChars: number;
    qaRolePreset: QaRolePreset;
    qaPipelinePreset: QaPipelinePreset;
    qaStructureGuardEnabled: boolean;
    qaAlwaysDetailedAnswer: boolean;
    qaMinAnswerChars: number;
    qaRoleModelAutoPickEnabled: boolean;
    semanticAutoPickEnabled: boolean;
    qaBalancedPresetBaseModel: string;
    qaBalancedPresetVisionModel: string;
    qaBalancedPresetEmbeddingModel: string;
    qaQualityPresetBaseModel: string;
    qaQualityPresetVisionModel: string;
    qaQualityPresetEmbeddingModel: string;
    qaAttachmentIngestRootPath: string;
  };
}

interface LocalQaThreadSyncResult {
  path: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
}

class VaultTextInputModal extends Modal {
  private readonly titleText: string;
  private readonly placeholder: string;
  private readonly initialValue: string;
  private readonly submitText: string;
  private readonly onSubmitValue: (value: string) => Promise<void>;
  private inputEl!: HTMLInputElement;
  private submitButton!: HTMLButtonElement;

  constructor(
    app: App,
    titleText: string,
    placeholder: string,
    initialValue: string,
    submitText: string,
    onSubmitValue: (value: string) => Promise<void>,
  ) {
    super(app);
    this.titleText = titleText;
    this.placeholder = placeholder;
    this.initialValue = initialValue;
    this.submitText = submitText;
    this.onSubmitValue = onSubmitValue;
  }

  onOpen(): void {
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

    const cancelButton = footer.createEl("button", { text: "Cancel / 취소" });
    cancelButton.onclick = () => this.close();

    this.submitButton = footer.createEl("button", {
      text: this.submitText,
      cls: "mod-cta",
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

  private async commit(): Promise<void> {
    const value = this.inputEl.value.trim();
    if (!value) {
      new Notice("값이 비어 있습니다. / Value is empty.", 4000);
      return;
    }
    this.submitButton.disabled = true;
    try {
      await this.onSubmitValue(value);
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown input error";
      new Notice(message, 7000);
      this.submitButton.disabled = false;
      this.inputEl.focus();
    }
  }
}

class LocalQAChatModal extends Modal {
  private readonly plugin: KnowledgeWeaverPlugin;
  private readonly defaultTopK: number;
  private topKInput!: HTMLInputElement;
  private inputEl!: HTMLTextAreaElement;
  private threadEl!: HTMLElement;
  private sendButton!: HTMLButtonElement;
  private running = false;
  private history: LocalQAConversationTurn[] = [];

  constructor(app: App, plugin: KnowledgeWeaverPlugin, defaultTopK: number) {
    super(app);
    this.plugin = plugin;
    this.defaultTopK = defaultTopK;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Local Q&A" });

    const hint = contentEl.createEl("p", {
      text: "Natural conversation style. Selected notes are used when available.",
    });
    hint.style.marginTop = "0";

    const topKRow = contentEl.createDiv();
    topKRow.style.display = "flex";
    topKRow.style.gap = "8px";
    topKRow.style.alignItems = "center";
    topKRow.style.marginBottom = "8px";
    topKRow.createEl("label", { text: "Top sources" });
    this.topKInput = topKRow.createEl("input", { type: "number" });
    this.topKInput.min = "1";
    this.topKInput.max = "15";
    this.topKInput.value = String(this.defaultTopK);

    this.threadEl = contentEl.createDiv();
    this.threadEl.style.maxHeight = "46vh";
    this.threadEl.style.overflow = "auto";
    this.threadEl.style.border = "1px solid var(--background-modifier-border)";
    this.threadEl.style.borderRadius = "8px";
    this.threadEl.style.padding = "10px";
    this.threadEl.style.marginBottom = "8px";
    this.threadEl.style.userSelect = "text";
    this.threadEl.style.setProperty("-webkit-user-select", "text");
    this.threadEl.createEl("div", { text: "질문을 입력하면 답변을 이어서 보여줍니다." });

    this.inputEl = contentEl.createEl("textarea");
    this.inputEl.style.width = "100%";
    this.inputEl.style.minHeight = "90px";
    this.inputEl.placeholder = "질문하세요...";

    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "8px";

    const closeButton = footer.createEl("button", { text: "Close" });
    closeButton.onclick = () => this.close();

    this.sendButton = footer.createEl("button", { text: "Send", cls: "mod-cta" });
    this.sendButton.onclick = async () => {
      await this.submitQuestion();
    };

    this.inputEl.addEventListener(
      "keydown",
      (event) => {
        handleChatTextareaEnterKey(event, this.inputEl, async () => this.submitQuestion());
      },
      { capture: true },
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
      { capture: true },
    );
  }

  private appendUserMessage(text: string): void {
    const box = this.threadEl.createDiv();
    box.style.marginBottom = "10px";
    box.createEl("strong", { text: "You" });
    const body = box.createDiv();
    body.style.whiteSpace = "pre-wrap";
    body.setText(text);
    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }

  private appendAssistantMessage(payload: LocalQAResultPayload): void {
    const box = this.threadEl.createDiv();
    box.style.marginBottom = "12px";
    box.createEl("strong", { text: "Assistant" });
    const body = box.createDiv();
    body.style.whiteSpace = "pre-wrap";
    body.setText(payload.answer || "(empty answer)");

    const meta = box.createEl("small", {
      text: `model=${payload.model}, embedding=${payload.embeddingModel}, cacheHits=${payload.retrievalCacheHits}, cacheWrites=${payload.retrievalCacheWrites}`,
    });
    meta.style.display = "block";
    meta.style.marginTop = "4px";

    if (payload.sources.length > 0) {
      const src = box.createDiv();
      src.style.marginTop = "6px";
      src.createEl("strong", { text: "Sources" });
      for (const source of payload.sources) {
        src.createEl("div", {
          text: `- ${source.path} (${formatSimilarity(source.similarity)})`,
        });
      }
    }

    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }

  private appendSystemMessage(text: string): void {
    const row = this.threadEl.createDiv();
    row.style.marginBottom = "8px";
    const small = row.createEl("small", { text });
    small.style.opacity = "0.85";
    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }

  private async submitQuestion(): Promise<void> {
    if (this.running) {
      return;
    }

    const question = this.inputEl.value.trim();
    if (!question) {
      new Notice("Question is empty.");
      return;
    }

    const parsedTopK = Number.parseInt(this.topKInput.value, 10);
    const topK =
      Number.isFinite(parsedTopK) && parsedTopK >= 1
        ? Math.min(15, parsedTopK)
        : this.defaultTopK;

    this.inputEl.value = "";
    this.appendUserMessage(question);
    this.running = true;
    this.sendButton.disabled = true;
    this.appendSystemMessage("Preparing context...");

    try {
      const result = await this.plugin.askLocalQa(question, topK, this.history);
      this.appendAssistantMessage(result);
      const nextHistory: LocalQAConversationTurn[] = [
        ...this.history,
        { role: "user", text: question },
        { role: "assistant", text: result.answer },
      ];
      this.history = nextHistory.slice(-12);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown local QA error";
      this.appendSystemMessage(`Error: ${message}`);
      new Notice(`Local Q&A failed: ${message}`, 6000);
    } finally {
      this.running = false;
      this.sendButton.disabled = false;
      this.inputEl.focus();
    }
  }
}

class LocalQAWorkspaceView extends ItemView {
  private readonly plugin: KnowledgeWeaverPlugin;
  private roleSelect: HTMLSelectElement | null = null;
  private pipelineSelect: HTMLSelectElement | null = null;
  private topKInput!: HTMLInputElement;
  private conversationModeSelect: HTMLSelectElement | null = null;
  private modelPresetHintEl!: HTMLElement;
  private modelLayoutSummaryEl!: HTMLElement;
  private activeFileStatusEl!: HTMLElement;
  private attachmentStatusEl!: HTMLElement;
  private pendingAttachments: LocalQaExternalAttachment[] = [];
  private inputEl!: HTMLTextAreaElement;
  private threadEl!: HTMLElement;
  private sendButton!: HTMLButtonElement;
  private stopButton!: HTMLButtonElement;
  private qaContextButton: HTMLButtonElement | null = null;
  private scopeEl!: HTMLElement;
  private runtimeSummaryEl!: HTMLElement;
  private threadInfoEl!: HTMLElement;
  private syncInfoEl!: HTMLElement;
  private running = false;
  private stopRequested = false;
  private activeRequestController: AbortController | null = null;
  private messages: LocalQAViewMessage[] = [];
  private threadPath: string | null = null;
  private threadId = "";
  private threadCreatedAt = "";
  private syncStatus = "Not synced yet";
  private syncTimer: number | null = null;
  private syncInFlight = false;
  private syncQueued = false;
  private queuedTurns: Array<{
    question: string;
    attachments: LocalQaExternalAttachment[];
    openFilePath?: string;
  }> = [];
  private pendingPreemptTurn: {
    question: string;
    attachments: LocalQaExternalAttachment[];
    openFilePath?: string;
  } | null = null;
  private queueDrainInProgress = false;
  private renderVersion = 0;
  private streamRenderTimer: number | null = null;
  private fileOpenEventBound = false;
  private lastKnownOpenMarkdownPath: string | null = null;
  private commandAvailabilityCache = new Map<string, boolean>();

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeWeaverPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return LOCAL_QA_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Auto Link Local Chat / 로컬 채팅";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    this.resetThreadState();
    this.render();
    if (!this.fileOpenEventBound) {
      this.registerEvent(
        this.app.workspace.on("file-open", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            this.lastKnownOpenMarkdownPath = file.path;
          } else {
            this.lastKnownOpenMarkdownPath = null;
          }
          void this.refreshActiveFileStatus();
          void this.refreshScopeLabel();
        }),
      );
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", () => {
          void this.refreshActiveFileStatus();
          void this.refreshScopeLabel();
        }),
      );
      this.fileOpenEventBound = true;
    }
    const initialOpen = this.resolveVisibleMarkdownFile();
    if (initialOpen instanceof TFile) {
      this.lastKnownOpenMarkdownPath = initialOpen.path;
    }
    await this.refreshFromSettingsForQa();
    this.refreshThreadMeta();
  }

  async onClose(): Promise<void> {
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

  private resetThreadState(): void {
    const now = new Date();
    this.threadId = `chat-${formatBackupStamp(now)}`;
    this.threadCreatedAt = now.toISOString();
    this.threadPath = null;
    this.syncStatus = this.plugin.isQaThreadAutoSyncEnabledForQa()
      ? "Auto-sync ready / 자동 동기화 준비"
      : "Manual save mode / 수동 저장 모드";
    this.refreshThreadMeta();
  }

  private requestImmediateStop(reason?: string): void {
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
    } catch {
      // ignore abort errors
    }
    if (reason && this.running) {
      this.pushMessage({
        role: "system",
        text: `중지 요청됨: ${reason}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private refreshThreadMeta(): void {
    if (!this.threadInfoEl || !this.syncInfoEl) {
      return;
    }
    const threadLabel = this.threadPath
      ? this.threadPath
      : `${this.threadId}.md (pending)`;
    this.threadInfoEl.setText(`Thread / 스레드: ${threadLabel}`);
    this.syncInfoEl.setText(`Sync / 동기화: ${this.syncStatus}`);
  }

  private setSyncStatus(next: string): void {
    this.syncStatus = next;
    this.refreshThreadMeta();
  }

  private createHeaderIconButton(
    parent: HTMLElement,
    icon: string,
    tooltip: string,
    onClick: () => void | Promise<void>,
    cta = false,
  ): HTMLButtonElement {
    const button = parent.createEl("button");
    button.addClass("auto-linker-chat-btn");
    button.addClass("auto-linker-chat-icon-btn");
    if (cta) {
      button.addClass("mod-cta");
    }
    button.setAttr("aria-label", tooltip);
    button.setAttr("title", tooltip);
    setIcon(button, icon);
    button.onclick = () => {
      void onClick();
    };
    return button;
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-linker-chat-view");

    const root = contentEl.createDiv({ cls: "auto-linker-chat-root" });
    const header = root.createDiv({ cls: "auto-linker-chat-header" });
    header.createEl("h3", {
      text: "Auto Link Chat",
    });
    this.scopeEl = header.createDiv({ cls: "auto-linker-chat-scope" });

    const actionRow = root.createDiv({ cls: "auto-linker-chat-actions" });
    this.createHeaderIconButton(
      actionRow,
      "plus-square",
      "새 스레드",
      async () => {
        await this.startNewThread();
      },
    );
    this.createHeaderIconButton(
      actionRow,
      "files",
      "노트 선택",
      async () => {
        await this.plugin.openSelectionForQa();
        await this.refreshScopeLabel();
      },
    );
    this.createHeaderIconButton(
      actionRow,
      "rotate-ccw",
      "선택 초기화",
      async () => {
        await this.plugin.clearSelectionForQa(true);
        await this.refreshScopeLabel();
        this.pushMessage({
          role: "system",
          text: "선택된 파일/폴더 범위를 초기화했습니다.",
          timestamp: new Date().toISOString(),
        });
      },
    );
    this.createHeaderIconButton(
      actionRow,
      "refresh-cw",
      "모델 감지 새로고침",
      async () => {
        await this.plugin.refreshOllamaDetection({ notify: false, autoApply: false });
        this.refreshModelOptions();
        await this.refreshScopeLabel();
      },
    );
    this.createHeaderIconButton(
      actionRow,
      "file-text",
      "채팅 노트 열기",
      async () => {
        await this.openThreadNote();
      },
    );

    const newThreadButton = actionRow.createEl("button", { text: "New thread / 새 스레드" });
    newThreadButton.addClass("auto-linker-chat-btn");
    newThreadButton.addClass("auto-linker-chat-hidden-action");
    newThreadButton.onclick = async () => {
      await this.startNewThread();
    };

    const selectButton = actionRow.createEl("button", { text: "Select notes / 노트 선택" });
    selectButton.addClass("auto-linker-chat-btn");
    selectButton.addClass("auto-linker-chat-hidden-action");
    selectButton.onclick = async () => {
      await this.plugin.openSelectionForQa();
      await this.refreshScopeLabel();
    };

    const resetSelectionButton = actionRow.createEl("button", {
      text: "Select reset / 선택 초기화",
    });
    resetSelectionButton.addClass("auto-linker-chat-btn");
    resetSelectionButton.addClass("auto-linker-chat-hidden-action");
    resetSelectionButton.onclick = async () => {
      await this.plugin.clearSelectionForQa(true);
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: "선택된 파일/폴더 범위를 초기화했습니다.",
        timestamp: new Date().toISOString(),
      });
    };

    const refreshModelsButton = actionRow.createEl("button", { text: "Refresh models / 모델 감지" });
    refreshModelsButton.addClass("auto-linker-chat-btn");
    refreshModelsButton.addClass("auto-linker-chat-hidden-action");
    refreshModelsButton.setAttr(
      "title",
      "로컬 모델 감지를 다시 읽고, 채팅의 모델 선택 목록을 갱신합니다.",
    );
    refreshModelsButton.onclick = async () => {
      await this.plugin.refreshOllamaDetection({ notify: false, autoApply: false });
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };

    const openThreadButton = actionRow.createEl("button", { text: "Open chat note / 채팅 노트 열기" });
    openThreadButton.addClass("auto-linker-chat-btn");
    openThreadButton.addClass("auto-linker-chat-hidden-action");
    openThreadButton.onclick = async () => {
      await this.openThreadNote();
    };

    const utilityDetails = root.createEl("details", { cls: "auto-linker-chat-collapsible" });
    utilityDetails.createEl("summary", { text: "More tools / 추가 도구" });
    utilityDetails.createEl("small", {
      text: "Cleanup keys는 AI 분석 없이 frontmatter 키만 정리하므로 Analyze/Apply보다 일반적으로 빠릅니다.",
    });
    const utilityRow = utilityDetails.createDiv({ cls: "auto-linker-chat-actions" });

    const cleanupPickerButton = utilityRow.createEl("button", { text: "Cleanup keys / 정리 키" });
    cleanupPickerButton.addClass("auto-linker-chat-btn");
    cleanupPickerButton.onclick = async () => {
      await this.plugin.openCleanupKeyPickerForQa();
      await this.refreshScopeLabel();
    };

    const cleanupApplyButton = utilityRow.createEl("button", { text: "Run cleanup / 정리 실행" });
    cleanupApplyButton.addClass("auto-linker-chat-btn");
    cleanupApplyButton.onclick = async () => {
      await this.plugin.runCleanupForQa(false);
      await this.refreshScopeLabel();
    };

    const cleanupDryRunButton = utilityRow.createEl("button", { text: "Cleanup dry-run / 정리 미리보기" });
    cleanupDryRunButton.addClass("auto-linker-chat-btn");
    cleanupDryRunButton.onclick = async () => {
      await this.plugin.runCleanupForQa(true);
      await this.refreshScopeLabel();
    };

    const folderButton = utilityRow.createEl("button", { text: "Chat folder / 채팅 폴더" });
    folderButton.addClass("auto-linker-chat-btn");
    folderButton.setAttr("title", "채팅 기록 저장 폴더를 변경합니다.");
    folderButton.onclick = () => {
      const current = this.plugin.getChatTranscriptRootPathForQa() || "Auto Link Chats";
      new VaultTextInputModal(
        this.app,
        "Chat transcript folder / 채팅 저장 폴더",
        "Auto Link Chats",
        current,
        "Save / 저장",
        async (value) => {
          await this.plugin.setChatTranscriptRootPathForQa(value);
          new Notice(
            `Chat folder set / 채팅 폴더 설정: ${this.plugin.getChatTranscriptRootPathForQa()}`,
            5000,
          );
          await this.refreshScopeLabel();
        },
      ).open();
    };

    const modelDetails = root.createEl("details", { cls: "auto-linker-chat-collapsible" });
    modelDetails.createEl("summary", { text: "Model options / 모델 옵션" });
    this.modelPresetHintEl = modelDetails.createEl("small", {
      cls: "auto-linker-chat-model-hint",
    });
    this.modelLayoutSummaryEl = modelDetails.createDiv({
      cls: "auto-linker-chat-model-layout-summary",
    });
    const presetRow = modelDetails.createDiv({ cls: "auto-linker-chat-actions" });
    presetRow.createEl("small", {
      text: "One-click local presets / 원클릭 프리셋",
    });
    const applyPresetFromChat = async (
      preset: "fast_local" | "balanced_local",
    ): Promise<void> => {
      const summary = await this.plugin.applyOneClickLocalPresetForQa(preset);
      new Notice(summary, 6500);
      this.refreshRoleOptions();
      this.refreshPipelineOptions();
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };
    const applyCustomSlotFromChat = async (slotKey: QaQuickCustomSlotKey): Promise<void> => {
      try {
        const summary = await this.plugin.applyQaQuickCustomProfileSlot(slotKey);
        new Notice(summary, 6000);
        this.refreshModelOptions();
        await this.refreshScopeLabel();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "커스텀 프리셋을 적용할 수 없습니다.";
        new Notice(message, 6000);
      }
    };
    const fastPresetButton = presetRow.createEl("button", { text: "Flash" });
    fastPresetButton.addClass("auto-linker-chat-btn");
    fastPresetButton.onclick = async () => {
      await applyPresetFromChat("fast_local");
    };
    const proPresetButton = presetRow.createEl("button", { text: "Pro" });
    proPresetButton.addClass("auto-linker-chat-btn");
    proPresetButton.onclick = async () => {
      await applyPresetFromChat("balanced_local");
    };
    const custom1Button = presetRow.createEl("button", { text: "Custom 1" });
    custom1Button.addClass("auto-linker-chat-btn");
    custom1Button.onclick = async () => {
      await applyCustomSlotFromChat("qaQuickCustomProfileSlot1");
    };
    const custom2Button = presetRow.createEl("button", { text: "Custom 2" });
    custom2Button.addClass("auto-linker-chat-btn");
    custom2Button.onclick = async () => {
      await applyCustomSlotFromChat("qaQuickCustomProfileSlot2");
    };
    const custom3Button = presetRow.createEl("button", { text: "Custom 3" });
    custom3Button.addClass("auto-linker-chat-btn");
    custom3Button.onclick = async () => {
      await applyCustomSlotFromChat("qaQuickCustomProfileSlot3");
    };
    const refreshLocalAiButton = presetRow.createEl("button", {
      text: "Refresh Local AI",
    });
    refreshLocalAiButton.addClass("auto-linker-chat-btn");
    refreshLocalAiButton.onclick = async () => {
      await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
      await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
      this.refreshModelOptions();
      await this.refreshScopeLabel();
    };

    const controlRow = modelDetails.createDiv({ cls: "auto-linker-chat-controls" });
    const topKWrap = controlRow.createDiv({ cls: "auto-linker-chat-control" });
    topKWrap.createEl("label", { text: "Top sources / 상위 소스 수" });
    this.topKInput = topKWrap.createEl("input", {
      type: "number",
      cls: "auto-linker-chat-topk-input",
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

    const runtimePanel = root.createEl("details", { cls: "auto-linker-chat-runtime-panel" });
    runtimePanel.open = false;
    runtimePanel.createEl("summary", {
      cls: "auto-linker-chat-runtime-head",
      text: "Runtime status / 현재 상태",
    });
    const runtimeBody = runtimePanel.createDiv({ cls: "auto-linker-chat-runtime-body" });
    const runtimeMetaRow = runtimeBody.createDiv({ cls: "auto-linker-chat-meta" });
    this.threadInfoEl = runtimeMetaRow.createDiv({ cls: "auto-linker-chat-thread-info" });
    this.syncInfoEl = runtimeMetaRow.createDiv({ cls: "auto-linker-chat-sync-info" });
    this.runtimeSummaryEl = runtimeBody.createDiv({ cls: "auto-linker-chat-runtime-summary" });

    this.threadEl = root.createDiv({ cls: "auto-linker-chat-thread" });
    this.threadEl.createDiv({
      cls: "auto-linker-chat-empty",
      text: "질문을 입력해 대화를 시작하세요. / Ask a question to start.",
    });

    const composer = root.createDiv({ cls: "auto-linker-chat-composer" });
    composer.addEventListener("dragover", (event) => {
      event.preventDefault();
      composer.addClass("auto-linker-chat-drop-active");
    });
    composer.addEventListener("dragleave", () => {
      composer.removeClass("auto-linker-chat-drop-active");
    });
    composer.addEventListener("drop", (event) => {
      void this.handleChatDrop(event, composer);
    });

    this.activeFileStatusEl = composer.createDiv({ cls: "auto-linker-chat-active-file-status" });
    void this.refreshActiveFileStatus();

    this.inputEl = composer.createEl("textarea", { cls: "auto-linker-chat-input" });
    this.inputEl.placeholder =
      "선택 문서가 없어도 대화할 수 있습니다. 첨부/선택 문서 기반 질문도 가능합니다.";
    this.attachmentStatusEl = composer.createDiv({
      cls: "auto-linker-chat-attachment-status",
    });
    this.refreshAttachmentStatus();

    const footer = composer.createDiv({ cls: "auto-linker-chat-footer" });
    const footerLeft = footer.createDiv({ cls: "auto-linker-chat-footer-left" });
    const attachButton = footerLeft.createEl("button", { text: "+ 첨부 / Add" });
    attachButton.addClass("auto-linker-chat-btn");
    attachButton.onclick = async () => {
      await this.openAttachmentPicker();
    };

    const conversationModeSelect = footerLeft.createEl("select", {
      cls: "auto-linker-chat-mode-select",
    });
    this.conversationModeSelect = conversationModeSelect;
    conversationModeSelect.setAttr("aria-label", "Conversation mode");
    conversationModeSelect.setAttr("title", "대화 모드");
    conversationModeSelect.onchange = async () => {
      const mode = conversationModeSelect.value as QaConversationMode;
      await this.plugin.setQaConversationModeForQa(mode);
      this.refreshConversationModeOptions();
      this.refreshRoleOptions();
      this.refreshPipelineOptions();
      this.refreshModelOptions();
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: `대화 모드를 ${this.plugin.getQaConversationModeLabelForQa()}로 변경했습니다.`,
        timestamp: new Date().toISOString(),
      });
    };

    this.qaContextButton = footerLeft.createEl("button", { text: "QA ON" });
    this.qaContextButton.addClass("auto-linker-chat-btn");
    this.qaContextButton.onclick = async () => {
      const next = !this.plugin.isQaContextEnabledForQa();
      await this.plugin.setQaContextEnabledForQa(next);
      this.refreshQaContextButton();
      await this.refreshScopeLabel();
      this.pushMessage({
        role: "system",
        text: next
          ? "QA 컨텍스트 ON: 선택 노트/열린 문서 기반 리트리벌을 사용합니다."
          : "QA 컨텍스트 OFF: 일반 채팅 모드(선택 노트 리트리벌 없음)로 전환했습니다.",
        timestamp: new Date().toISOString(),
      });
    };
    this.refreshQaContextButton();

    this.sendButton = footer.createEl("button", { text: "Send / 전송", cls: "mod-cta" });
    this.sendButton.addClass("auto-linker-chat-send");
    this.sendButton.onclick = async () => {
      await this.submitQuestion();
    };
    this.stopButton = footer.createEl("button", { text: "Stop / 중지" });
    this.stopButton.addClass("auto-linker-chat-stop");
    this.stopButton.disabled = true;
    this.stopButton.onclick = () => {
      if (!this.running) {
        return;
      }
      this.stopButton.disabled = true;
      this.requestImmediateStop("사용자가 중지 버튼을 눌렀습니다.");
    };

    this.inputEl.addEventListener(
      "keydown",
      (event) => {
        handleChatTextareaEnterKey(event, this.inputEl, async () => this.submitQuestion());
      },
      { capture: true },
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
      { capture: true },
    );
    this.registerDomEvent(
      window,
      "keydown",
      (event: KeyboardEvent) => {
        if (document.activeElement !== this.inputEl) {
          return;
        }
        handleChatTextareaEnterKey(event, this.inputEl, async () => this.submitQuestion());
      },
      { capture: true },
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

  async refreshFromSettingsForQa(): Promise<void> {
    if (!this.contentEl.isConnected) {
      return;
    }
    this.refreshRoleOptions();
    this.refreshPipelineOptions();
    this.refreshModelOptions();
    this.refreshConversationModeOptions();
    this.refreshQaContextButton();
    if (this.topKInput) {
      this.topKInput.value = String(this.plugin.settings.qaTopK);
    }
    await this.refreshScopeLabel();
    await this.refreshActiveFileStatus();
    this.refreshThreadMeta();
  }

  private refreshRoleOptions(): void {
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

  private refreshPipelineOptions(): void {
    if (!this.pipelineSelect) {
      return;
    }
    const options = this.plugin.getQaPipelinePresetOptionsForQa();
    const current = this.plugin.getQaPipelinePresetForQa();
    this.pipelineSelect.empty();
    for (const option of options) {
      this.pipelineSelect.createEl("option", {
        text: option.label,
        value: option.value,
      });
    }
    this.pipelineSelect.value = current;
  }

  private refreshConversationModeOptions(): void {
    if (!this.conversationModeSelect) {
      return;
    }
    const options = this.plugin.getQaConversationModeOptionsForQa();
    const current = this.plugin.getQaConversationModeForQa();
    this.conversationModeSelect.empty();
    for (const option of options) {
      this.conversationModeSelect.createEl("option", {
        text: option.label,
        value: option.value,
      });
    }
    this.conversationModeSelect.value = current;
    this.conversationModeSelect.setAttr(
      "title",
      `Mode=${this.plugin.getQaConversationModeLabelForQa()}`,
    );
  }

  private refreshQaContextButton(): void {
    if (!this.qaContextButton) {
      return;
    }
    const enabled = this.plugin.isQaContextEnabledForQa();
    this.qaContextButton.setText(enabled ? "QA ON" : "QA OFF");
    this.qaContextButton.setAttr(
      "title",
      enabled
        ? "선택 노트/열린 문서 기반 QA 컨텍스트를 사용합니다."
        : "선택 노트 리트리벌 없이 일반 채팅으로 동작합니다.",
    );
    this.qaContextButton.toggleClass("mod-cta", enabled);
  }

  private refreshModelOptions(): void {
    const presetLabel = this.plugin.getQaPresetProfileLabelForQa();

    if (this.modelPresetHintEl) {
      this.modelPresetHintEl.setText(
        `Preset=${presetLabel} | convo=${this.plugin.getQaConversationModeLabelForQa()} | pipeline=${getQaPipelinePresetLabel(this.plugin.getQaPipelinePresetForQa())}`,
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
        `safeguard: ${this.plugin.getQaModelLabelForQa("safeguard")}`,
      ];
      this.modelLayoutSummaryEl.setText(lines.join(" | "));
      this.modelLayoutSummaryEl.setAttr("title", lines.join("\n"));
    }
  }

  private refreshSendButtonState(): void {
    if (!this.sendButton) {
      return;
    }
    if (this.running) {
      const queueCount = this.queuedTurns.length;
      const preemptPending = this.pendingPreemptTurn !== null;
      this.sendButton.setText(
        preemptPending
          ? queueCount > 0
            ? `Steer 대기중 +${queueCount}`
            : "Steer 전환 대기중"
          : queueCount > 0
            ? `Steer +1 (대기 ${queueCount + 1})`
            : "Steer / 중간 지시",
      );
      this.sendButton.setAttr(
        "title",
        preemptPending
          ? "현재 턴 중지 후 steer 질문을 우선 실행합니다."
          : "실행 중에는 전송 대신 steer 기능으로 즉시 전환/대기열 추가가 동작합니다.",
      );
      this.sendButton.disabled = false;
      this.sendButton.removeClass("mod-cta");
      return;
    }
    this.sendButton.setText("Send / 전송");
    this.sendButton.setAttr("title", "현재 입력한 질문을 즉시 전송합니다.");
    this.sendButton.disabled = false;
    this.sendButton.addClass("mod-cta");
  }

  private captureCurrentInputTurn(): {
    question: string;
    attachments: LocalQaExternalAttachment[];
    openFilePath?: string;
  } | null {
    const question = this.inputEl.value.trim();
    if (!question) {
      return null;
    }
    const attachments = this.consumePendingAttachments();
    const openFile = this.resolveVisibleMarkdownFile();
    const openFilePath =
      openFile instanceof TFile && openFile.extension === "md"
        ? openFile.path
        : undefined;
    this.inputEl.value = "";
    return {
      question,
      attachments,
      openFilePath,
    };
  }

  private queueCurrentInputTurn(): boolean {
    const captured = this.captureCurrentInputTurn();
    if (!captured) {
      return false;
    }
    this.queuedTurns.push({
      question: captured.question,
      attachments: captured.attachments,
      openFilePath: captured.openFilePath,
    });
    this.pushMessage({
      role: "system",
      text: `실행 중이라 steer 기능으로 대기열에 추가했습니다. (현재 대기 ${this.queuedTurns.length}개)`,
      timestamp: new Date().toISOString(),
    });
    this.refreshSendButtonState();
    void this.refreshScopeLabel();
    return true;
  }

  private preemptRunningTurnWithCurrentInput(): boolean {
    const captured = this.captureCurrentInputTurn();
    if (!captured) {
      return false;
    }
    if (this.pendingPreemptTurn) {
      this.queuedTurns.push(captured);
      this.pushMessage({
        role: "system",
        text: `중지 전환 처리 중이라 steer 질문을 대기열로 추가했습니다. (현재 대기 ${this.queuedTurns.length}개)`,
        timestamp: new Date().toISOString(),
      });
      this.refreshSendButtonState();
      void this.refreshScopeLabel();
      return true;
    }
    this.pendingPreemptTurn = captured;
    this.pushMessage({
      role: "system",
      text: "steer 즉시 전환: 현재 응답을 중단하고 새 질문을 우선 실행합니다.",
      timestamp: new Date().toISOString(),
    });
    this.requestImmediateStop("steer 즉시 전환");
    this.refreshSendButtonState();
    void this.refreshScopeLabel();
    return true;
  }

  private async drainQueuedTurns(): Promise<void> {
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

  private normalizeAttachmentLabel(raw: string, fallback: string): string {
    const trimmed = raw.trim();
    const value = trimmed || fallback;
    return value.length > 96 ? `${value.slice(0, 93)}...` : value;
  }

  private clampAttachmentText(text: string, maxChars = 12000): string {
    if (text.length <= maxChars) {
      return text;
    }
    return `${text.slice(0, maxChars)}\n...(truncated ${text.length - maxChars} chars)`;
  }

  private attachmentMimeFromExt(ext: string): string {
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

  private isImageExt(ext: string): boolean {
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "svgz"].includes(
      ext.toLowerCase(),
    );
  }

  private isPdfExt(ext: string): boolean {
    return ext.toLowerCase() === "pdf";
  }

  private isLikelyTextFile(file: File): boolean {
    if (file.type.startsWith("text/")) {
      return true;
    }
    const lowerType = file.type.toLowerCase();
    if (
      lowerType.includes("json") ||
      lowerType.includes("xml") ||
      lowerType.includes("yaml") ||
      lowerType.includes("csv")
    ) {
      return true;
    }
    const name = file.name.toLowerCase();
    return /\.(md|txt|json|ya?ml|csv|ts|js|jsx|tsx|py|java|go|rs|c|cpp|h|hpp|html|css|sql)$/i
      .test(name);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private attachmentKey(item: LocalQaExternalAttachment): string {
    const source = item.path?.trim() || item.label.trim();
    return `${item.kind}:${source}`;
  }

  private sanitizeIngestFileName(rawName: string, fallbackBase: string, extHint = ""): string {
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

  private async ensureVaultFolderPathForIngest(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    if (!normalized) {
      return;
    }
    const parts = normalized.split("/");
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(cursor);
      if (existing instanceof TFolder || existing instanceof TFile) {
        continue;
      }
      await this.app.vault.createFolder(cursor);
    }
  }

  private buildIngestVaultPath(fileName: string, extHint: string, kind: LocalQaAttachmentKind): string {
    const stamp = formatBackupStamp(new Date());
    const day = stamp.slice(0, 10);
    const root = normalizePath(
      (this.plugin.settings.qaAttachmentIngestRootPath || "").trim()
        || DEFAULT_SETTINGS.qaAttachmentIngestRootPath,
    );
    const safeName = this.sanitizeIngestFileName(fileName, `${kind}-attachment`, extHint);
    const suffix = Math.random().toString(36).slice(2, 8);
    return normalizePath(
      `${root}/${kind}/${day}/${stamp}-${suffix}-${safeName}`,
    );
  }

  private async persistBinaryAttachmentToIngest(
    fileName: string,
    extHint: string,
    kind: LocalQaAttachmentKind,
    binary: ArrayBuffer,
  ): Promise<string | undefined> {
    try {
      const targetPath = this.buildIngestVaultPath(fileName, extHint, kind);
      const folder = normalizePath(targetPath.split("/").slice(0, -1).join("/"));
      await this.ensureVaultFolderPathForIngest(folder);
      const adapter = this.app.vault.adapter as {
        writeBinary?: (path: string, data: ArrayBuffer) => Promise<void>;
      };
      const vaultWithBinary = this.app.vault as {
        createBinary?: (path: string, data: ArrayBuffer) => Promise<TFile>;
      };
      if (typeof adapter.writeBinary === "function") {
        await adapter.writeBinary(targetPath, binary);
      } else if (typeof vaultWithBinary.createBinary === "function") {
        await vaultWithBinary.createBinary(targetPath, binary);
      } else {
        return undefined;
      }
      return targetPath;
    } catch {
      return undefined;
    }
  }

  private async persistTextAttachmentToIngest(
    fileName: string,
    extHint: string,
    kind: LocalQaAttachmentKind,
    content: string,
  ): Promise<string | undefined> {
    try {
      const targetPath = this.buildIngestVaultPath(fileName, extHint, kind);
      const folder = normalizePath(targetPath.split("/").slice(0, -1).join("/"));
      await this.ensureVaultFolderPathForIngest(folder);
      await this.app.vault.adapter.write(targetPath, content);
      return targetPath;
    } catch {
      return undefined;
    }
  }

  private decodePdfLiteralString(raw: string): string {
    let value = raw.replace(/\\\r?\n/g, "");
    value = value.replace(/\\([nrtbf()\\])/g, (_match, token: string) => {
      switch (token) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        default:
          return token;
      }
    });
    value = value.replace(/\\([0-7]{1,3})/g, (_match, octal: string) => {
      const parsed = Number.parseInt(octal, 8);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
    return value;
  }

  private extractPdfFallbackText(binary: ArrayBuffer): string {
    const buffer = Buffer.from(binary);
    const latin = buffer.toString("latin1");
    const fragments: string[] = [];
    const literalRegex = /\(([^()]{2,})\)\s*T[Jj]/g;
    let match: RegExpExecArray | null = literalRegex.exec(latin);
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
    return utf8
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private shellQuoteArg(value: string): string {
    return `'${value.replace(/'/g, "'\"'\"'")}'`;
  }

  private async canUseShellCommand(command: string): Promise<boolean> {
    const safe = command.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(safe)) {
      return false;
    }
    if (this.commandAvailabilityCache.has(safe)) {
      return this.commandAvailabilityCache.get(safe) ?? false;
    }
    try {
      await execAsync(`command -v ${safe}`);
      this.commandAvailabilityCache.set(safe, true);
      return true;
    } catch {
      this.commandAvailabilityCache.set(safe, false);
      return false;
    }
  }

  private async extractPdfTextViaPdftotext(pdfAbsolutePath: string): Promise<string> {
    const command = [
      "pdftotext",
      "-enc",
      "UTF-8",
      "-layout",
      "-nopgbrk",
      this.shellQuoteArg(pdfAbsolutePath),
      "-",
    ].join(" ");
    const result = await execAsync(command, { timeout: 25000, maxBuffer: 12 * 1024 * 1024 });
    return (result.stdout ?? "").trim();
  }

  private async extractPdfTextViaOcr(pdfAbsolutePath: string, maxPages: number): Promise<string> {
    const tmpRoot = await nodeFs.promises.mkdtemp(
      nodePath.join(nodeOs.tmpdir(), "auto-link-ocr-"),
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
        this.shellQuoteArg(prefix),
      ].join(" ");
      await execAsync(renderCommand, { timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
      const pageImages = (await nodeFs.promises.readdir(tmpRoot))
        .filter((name) => /^page-\d+\.png$/i.test(name))
        .map((name) => nodePath.join(tmpRoot, name))
        .sort((a, b) => a.localeCompare(b));
      const chunks: string[] = [];
      for (const imagePath of pageImages) {
        const ocrCommand = [
          "tesseract",
          this.shellQuoteArg(imagePath),
          "stdout",
          "-l",
          "kor+eng",
          "--psm",
          "6",
        ].join(" ");
        try {
          const output = await execAsync(ocrCommand, {
            timeout: 45000,
            maxBuffer: 12 * 1024 * 1024,
          });
          const text = (output.stdout ?? "").trim();
          if (text) {
            chunks.push(text);
          }
        } catch {
          // ignore OCR page failure
        }
      }
      return chunks.join("\n").trim();
    } finally {
      await nodeFs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {
        // ignore cleanup failures
      });
    }
  }

  private resolveVaultAbsolutePath(vaultPath: string): string | undefined {
    const base = this.getVaultBasePathForChatView();
    if (!base) {
      return undefined;
    }
    return nodePath.resolve(base, vaultPath);
  }

  private async extractPdfTextWithParserChain(
    binary: ArrayBuffer,
    sourceAbsolutePath?: string,
  ): Promise<{
    content: string;
    parser: string;
    notes: string[];
  }> {
    const notes: string[] = [];
    let parser = "metadata-only";
    let extracted = "";
    let workingPath = sourceAbsolutePath;
    let tempDir: string | undefined;
    const parserMode = this.plugin.settings.qaParserMode === "detailed"
      ? "detailed"
      : "fast";
    const preferDetailed = parserMode === "detailed";
    const pdftotextEnoughLength = preferDetailed ? 220 : 120;
    const ocrMaxPages = preferDetailed
      ? LOCAL_QA_PDF_OCR_MAX_PAGES_DETAILED
      : LOCAL_QA_PDF_OCR_MAX_PAGES_FAST;
    notes.push(`parser mode=${parserMode}`);

    try {
      if (!workingPath) {
        tempDir = await nodeFs.promises.mkdtemp(
          nodePath.join(nodeOs.tmpdir(), "auto-link-pdf-"),
        );
        workingPath = nodePath.join(tempDir, "input.pdf");
        await nodeFs.promises.writeFile(workingPath, Buffer.from(binary));
      }

      if (await this.canUseShellCommand("pdftotext")) {
        try {
          extracted = await this.extractPdfTextViaPdftotext(workingPath);
          if (extracted.length > pdftotextEnoughLength) {
            parser = "pdftotext";
          } else {
            notes.push("pdftotext 결과가 짧아 OCR/fallback을 추가 시도합니다.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "pdftotext failed";
          notes.push(`pdftotext 실패: ${message}`);
        }
      } else {
        notes.push("pdftotext 미설치: fallback 추출로 진행합니다.");
      }

      if (
        extracted.length < pdftotextEnoughLength &&
        (await this.canUseShellCommand("pdftoppm")) &&
        (await this.canUseShellCommand("tesseract"))
      ) {
        try {
          const ocrText = await this.extractPdfTextViaOcr(workingPath, ocrMaxPages);
          if (ocrText.length > extracted.length) {
            extracted = ocrText;
            parser = "ocr";
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "OCR failed";
          notes.push(`OCR 실패: ${message}`);
        }
      }
    } finally {
      if (tempDir) {
        await nodeFs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {
          // ignore cleanup failures
        });
      }
    }

    if (!extracted.trim()) {
      extracted = this.extractPdfFallbackText(binary);
      parser = "fallback";
    }

    const clipped = this.clampAttachmentText(
      extracted.trim(),
      preferDetailed ? 32000 : 20000,
    );
    if (!clipped) {
      return {
        parser,
        notes,
        content: [
          "PDF attachment received.",
          "본문을 안정적으로 추출하지 못했습니다. 핵심 페이지를 이미지/텍스트로 추가 첨부해 주세요.",
        ].join("\n"),
      };
    }
    return {
      parser,
      notes,
      content: clipped,
    };
  }

  private async extractImageTextViaOcr(imageAbsolutePath: string): Promise<string> {
    const command = [
      "tesseract",
      this.shellQuoteArg(imageAbsolutePath),
      "stdout",
      "-l",
      "kor+eng",
      "--psm",
      "6",
    ].join(" ");
    const result = await execAsync(command, { timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
    return (result.stdout ?? "").trim();
  }

  private async extractImageTextWithParserChain(
    binary: ArrayBuffer,
    sourceAbsolutePath?: string,
    fallbackExt = "png",
  ): Promise<{
    content: string;
    parser: string;
    notes: string[];
  }> {
    const notes: string[] = [];
    let parser = "metadata-only";
    let extracted = "";
    let workingPath = sourceAbsolutePath;
    let tempDir: string | undefined;
    const parserMode = this.plugin.settings.qaParserMode === "detailed"
      ? "detailed"
      : "fast";
    const preferDetailed = parserMode === "detailed";
    notes.push(`parser mode=${parserMode}`);

    try {
      if (!workingPath) {
        tempDir = await nodeFs.promises.mkdtemp(
          nodePath.join(nodeOs.tmpdir(), "auto-link-image-"),
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
            notes.push("OCR 결과가 짧아 이미지 설명만 유지합니다.");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "image OCR failed";
          notes.push(`OCR 실패: ${message}`);
        }
      } else {
        notes.push("tesseract 미설치: OCR 없이 이미지 자체 컨텍스트만 사용합니다.");
      }
    } finally {
      if (tempDir) {
        await nodeFs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {
          // ignore cleanup failures
        });
      }
    }

    const clipped = this.clampAttachmentText(
      extracted.trim(),
      preferDetailed ? 18000 : 10000,
    );
    return {
      parser,
      notes,
      content: clipped,
    };
  }

  private async readVaultFileAsAttachment(file: TFile): Promise<LocalQaExternalAttachment | null> {
    const ext = file.extension.toLowerCase();
    if (this.isImageExt(ext)) {
      const adapter = this.app.vault.adapter as {
        readBinary?: (path: string) => Promise<ArrayBuffer>;
      };
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
        content: parsed.content
          ? [
            `Image attachment: ${file.name}`,
            `Parser: ${parsed.parser}`,
            ...parsed.notes.map((note) => `- ${note}`),
            "---",
            parsed.content,
          ].join("\n")
          : undefined,
      };
    }

    if (this.isPdfExt(ext)) {
      if (!this.plugin.settings.qaPdfAttachmentEnabled) {
        return null;
      }
      const adapter = this.app.vault.adapter as {
        readBinary?: (path: string) => Promise<ArrayBuffer>;
      };
      if (typeof adapter.readBinary !== "function") {
        return {
          kind: "pdf",
          label: this.normalizeAttachmentLabel(file.name, file.path),
          path: file.path,
          content: [
            `PDF attachment: ${file.name}`,
            "PDF 본문 추출 실패: readBinary API unavailable.",
          ].join("\n"),
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
          parsed.content,
        ].join("\n"),
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
      content: trimmed,
    };
  }

  private extractDropTextCandidates(text: string): string[] {
    const candidates = new Set<string>();
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null = wikiRegex.exec(text);
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

  private resolveDroppedVaultFile(candidate: string): TFile | null {
    let token = candidate.trim();
    if (!token) {
      return null;
    }
    if (token.startsWith("[[") && token.endsWith("]]")) {
      token = token.slice(2, -2);
    }
    token = token.split("|")[0]?.split("#")[0]?.trim() ?? "";
    if (!token) {
      return null;
    }

    const linked = this.app.metadataCache.getFirstLinkpathDest(
      token,
      this.threadPath ?? "",
    );
    if (linked instanceof TFile) {
      return linked;
    }

    const normalized = normalizePath(token);
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile) {
      return direct;
    }

    if (!normalized.toLowerCase().endsWith(".md")) {
      const withMd = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withMd instanceof TFile) {
        return withMd;
      }
    }
    return null;
  }

  private async readExternalFileAsAttachment(file: File): Promise<LocalQaExternalAttachment | null> {
    const absolutePath = this.extractDesktopAbsolutePathFromFile(file);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (file.type.startsWith("image/") || this.isImageExt(ext)) {
      if (file.size > 4 * 1024 * 1024) {
        return null;
      }
      const binary = await file.arrayBuffer();
      const mirroredPath = await this.persistBinaryAttachmentToIngest(
        file.name,
        ext || "png",
        "image",
        binary,
      );
      const mirroredAbsolutePath = mirroredPath
        ? this.resolveVaultAbsolutePath(mirroredPath)
        : undefined;
      const parsed = await this.extractImageTextWithParserChain(
        binary,
        absolutePath || mirroredAbsolutePath,
        ext || "png",
      );
      return {
        kind: "image",
        label: this.normalizeAttachmentLabel(file.name, `image-${Date.now()}`),
        imageBase64: this.arrayBufferToBase64(binary),
        mimeType: file.type || this.attachmentMimeFromExt(ext),
        path: mirroredPath || absolutePath,
        content: parsed.content
          ? [
            `Image attachment: ${file.name}`,
            `Parser: ${parsed.parser}`,
            ...parsed.notes.map((note) => `- ${note}`),
            "---",
            parsed.content,
          ].join("\n")
          : undefined,
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
      const mirroredPath = await this.persistBinaryAttachmentToIngest(
        file.name,
        ext || "pdf",
        "pdf",
        binary,
      );
      const mirroredAbsolutePath = mirroredPath
        ? this.resolveVaultAbsolutePath(mirroredPath)
        : undefined;
      const parsed = await this.extractPdfTextWithParserChain(
        binary,
        absolutePath || mirroredAbsolutePath,
      );
      return {
        kind: "pdf",
        label: this.normalizeAttachmentLabel(file.name, `pdf-${Date.now()}`),
        path: mirroredPath || absolutePath,
        content: [
          `PDF attachment: ${file.name}`,
          `Parser: ${parsed.parser}`,
          ...parsed.notes.map((note) => `- ${note}`),
          "---",
          parsed.content,
        ].join("\n"),
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
      content,
    );
    return {
      kind: "text",
      label: this.normalizeAttachmentLabel(file.name, `document-${Date.now()}`),
      path: mirroredPath || absolutePath,
      content,
    };
  }

  private extractDesktopAbsolutePathFromFile(file: File): string | undefined {
    const raw = ((file as File & { path?: string }).path ?? "").trim();
    if (!raw) {
      return undefined;
    }
    if (nodePath.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
      return nodePath.resolve(raw);
    }
    return undefined;
  }

  private async collectAttachmentsFromDrop(
    dataTransfer: DataTransfer,
  ): Promise<LocalQaExternalAttachment[]> {
    const collected: LocalQaExternalAttachment[] = [];
    const seen = new Set<string>();
    const pushItem = (item: LocalQaExternalAttachment | null): void => {
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

    const files = Array.from(dataTransfer.files ?? []);
    for (const file of files) {
      if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
      try {
        pushItem(await this.readExternalFileAsAttachment(file));
      } catch {
        // ignore dropped file parsing errors
      }
    }

    const textPayloads = [
      dataTransfer.getData("text/plain"),
      dataTransfer.getData("text/uri-list"),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    for (const payload of textPayloads) {
      if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
        break;
      }
      for (const candidate of this.extractDropTextCandidates(payload)) {
        if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
          break;
        }
        const file = this.resolveDroppedVaultFile(candidate);
        if (!(file instanceof TFile)) {
          continue;
        }
        try {
          pushItem(await this.readVaultFileAsAttachment(file));
        } catch {
          // ignore vault read errors
        }
      }
    }

    return collected.slice(0, LOCAL_QA_MAX_ATTACHMENTS);
  }

  private async collectAttachmentsFromClipboard(
    dataTransfer: DataTransfer,
  ): Promise<LocalQaExternalAttachment[]> {
    const collected: LocalQaExternalAttachment[] = [];
    const items = Array.from(dataTransfer.items ?? []);
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
      } catch {
        // ignore clipboard parse errors
      }
    }

    if (collected.length === 0) {
      for (const file of Array.from(dataTransfer.files ?? [])) {
        if (collected.length >= LOCAL_QA_MAX_ATTACHMENTS) {
          break;
        }
        try {
          const parsed = await this.readExternalFileAsAttachment(file);
          if (parsed) {
            collected.push(parsed);
          }
        } catch {
          // ignore clipboard parse errors
        }
      }
    }
    return collected.slice(0, LOCAL_QA_MAX_ATTACHMENTS);
  }

  private mergePendingAttachments(incoming: LocalQaExternalAttachment[]): void {
    if (incoming.length === 0) {
      return;
    }
    const merged: LocalQaExternalAttachment[] = [];
    const seen = new Set<string>();
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

  private consumePendingAttachments(): LocalQaExternalAttachment[] {
    const out = [...this.pendingAttachments];
    this.pendingAttachments = [];
    this.refreshAttachmentStatus();
    void this.refreshScopeLabel();
    return out;
  }

  private removePendingAttachmentAt(index: number): void {
    if (index < 0 || index >= this.pendingAttachments.length) {
      return;
    }
    this.pendingAttachments = this.pendingAttachments.filter((_, itemIndex) => itemIndex !== index);
    this.refreshAttachmentStatus();
    void this.refreshScopeLabel();
  }

  private refreshAttachmentStatus(): void {
    if (!this.attachmentStatusEl) {
      return;
    }
    this.attachmentStatusEl.empty();
    if (this.pendingAttachments.length === 0) {
      this.attachmentStatusEl.createSpan({
        text: `첨부 없음 (최대 ${LOCAL_QA_MAX_ATTACHMENTS}개): 드래그/업로드/붙여넣기(Ctrl/Cmd+V) 사용 가능`,
      });
      return;
    }

    const head = this.attachmentStatusEl.createDiv({
      cls: "auto-linker-chat-attachment-head",
    });
    head.createSpan({
      text: `첨부 ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS} (다음 전송에 포함)`,
    });
    const clearButton = head.createEl("button", {
      text: "첨부 비우기",
    });
    clearButton.addClass("auto-linker-chat-drop-clear");
    clearButton.onclick = () => {
      this.pendingAttachments = [];
      this.refreshAttachmentStatus();
      void this.refreshScopeLabel();
    };

    const list = this.attachmentStatusEl.createDiv({
      cls: "auto-linker-chat-attachment-list",
    });
    this.pendingAttachments.forEach((item, index) => {
      const card = list.createDiv({ cls: "auto-linker-chat-attachment-item" });
      if (item.kind === "image" && item.imageBase64) {
        const image = card.createEl("img", { cls: "auto-linker-chat-attachment-thumb" });
        image.src = `data:${item.mimeType || "image/png"};base64,${item.imageBase64}`;
        image.alt = item.label || `image-${index + 1}`;
      } else {
        card.createDiv({
          cls: "auto-linker-chat-attachment-file-badge",
          text: "FILE",
        });
      }
      const meta = card.createDiv({ cls: "auto-linker-chat-attachment-meta" });
      meta.createDiv({
        cls: "auto-linker-chat-attachment-title",
        text: item.label || item.path || `attachment-${index + 1}`,
      });
      meta.createDiv({
        cls: "auto-linker-chat-attachment-sub",
        text:
          item.path?.trim() ||
          (item.kind === "image"
            ? "image attachment"
            : item.kind === "pdf"
              ? "pdf attachment"
              : "document attachment"),
      });
      const removeButton = card.createEl("button", {
        text: "제거",
      });
      removeButton.addClass("auto-linker-chat-attachment-remove");
      removeButton.onclick = () => {
        this.removePendingAttachmentAt(index);
      };
    });
  }

  private async openAttachmentPicker(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept =
      ".md,.txt,.json,.yml,.yaml,.csv,.ts,.js,.py,.java,.go,.rs,.c,.cpp,.html,.css,.pdf,image/*";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async () => {
      try {
        const files = Array.from(input.files ?? []);
        const attachments: LocalQaExternalAttachment[] = [];
        for (const file of files) {
          if (
            attachments.length + this.pendingAttachments.length >= LOCAL_QA_MAX_ATTACHMENTS
          ) {
            break;
          }
          try {
            const parsed = await this.readExternalFileAsAttachment(file);
            if (parsed) {
              attachments.push(parsed);
            }
          } catch {
            // ignore attachment parsing errors
          }
        }
        if (attachments.length === 0) {
          new Notice("첨부할 수 있는 파일(텍스트/이미지/PDF)을 찾지 못했습니다.");
        } else {
          this.mergePendingAttachments(attachments);
          this.pushMessage({
            role: "system",
            text: `첨부 추가됨: ${attachments.length}개 (현재 ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        input.remove();
      }
    };

    input.click();
  }

  private async handleChatDrop(event: DragEvent, dropZone: HTMLElement): Promise<void> {
    event.preventDefault();
    dropZone.removeClass("auto-linker-chat-drop-active");
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    const attachments = await this.collectAttachmentsFromDrop(dataTransfer);
    if (attachments.length === 0) {
      new Notice("드래그한 항목에서 읽을 수 있는 텍스트/이미지/PDF를 찾지 못했습니다.");
      return;
    }
    this.mergePendingAttachments(attachments);
    this.pushMessage({
      role: "system",
      text: `드래그 첨부 추가됨: ${attachments.length}개 (현재 ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleChatPaste(event: ClipboardEvent): Promise<void> {
    const dataTransfer = event.clipboardData;
    if (!dataTransfer) {
      return;
    }
    const hasFilePayload =
      Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file") ||
      (dataTransfer.files?.length ?? 0) > 0;
    if (!hasFilePayload) {
      return;
    }
    event.preventDefault();
    const attachments = await this.collectAttachmentsFromClipboard(dataTransfer);
    if (attachments.length === 0) {
      new Notice("붙여넣은 데이터에서 첨부 가능한 파일/이미지를 찾지 못했습니다.");
      return;
    }
    this.mergePendingAttachments(attachments);
    this.pushMessage({
      role: "system",
      text: `붙여넣기 첨부 추가됨: ${attachments.length}개 (현재 ${this.pendingAttachments.length}/${LOCAL_QA_MAX_ATTACHMENTS})`,
      timestamp: new Date().toISOString(),
    });
  }

  private formatTime(iso: string): string {
    const date = new Date(iso);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  private formatThinkingStage(stage: LocalQaProgressStage): string {
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

  private buildThinkingTranscriptText(
    timeline: LocalQaProgressEvent[],
    modelThinking: string,
  ): string {
    const lines = timeline.map(
      (event) =>
        `- [${this.formatTime(event.timestamp)}] [${this.formatThinkingStage(event.stage)}] ${event.message}`,
    );
    const trimmedThinking = modelThinking.trim();
    if (!trimmedThinking) {
      return lines.join("\n");
    }

    return [
      ...lines,
      "",
      "Model thinking (raw):",
      trimmedThinking,
    ].join("\n");
  }

  private scheduleStreamRender(delayMs = 80): void {
    if (this.streamRenderTimer !== null) {
      return;
    }
    this.streamRenderTimer = window.setTimeout(() => {
      this.streamRenderTimer = null;
      this.renderMessages();
    }, delayMs);
  }

  private getVaultBasePathForChatView(): string | null {
    const adapter = this.app.vault.adapter as {
      getBasePath?: () => string;
    };
    if (typeof adapter.getBasePath !== "function") {
      return null;
    }
    const base = adapter.getBasePath();
    if (!base || typeof base !== "string") {
      return null;
    }
    return nodePath.resolve(base);
  }

  private resolveVisibleMarkdownFile(): TFile | null {
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension === "md") {
      return active;
    }

    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf?.view instanceof MarkdownView) {
      const file = activeLeaf.view.file;
      if (file instanceof TFile && file.extension === "md") {
        return file;
      }
    }
    return null;
  }

  private decodeChatLinkValue(raw: string): string {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) {
      return "";
    }
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  private resolveVaultFileFromChatLink(raw: string): TFile | null {
    const decoded = this.decodeChatLinkValue(raw);
    if (!decoded || /^https?:\/\//i.test(decoded)) {
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

    const normalized = normalizePath(candidate);
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile) {
      return direct;
    }

    if (!normalized.toLowerCase().endsWith(".md")) {
      const withMd = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withMd instanceof TFile) {
        return withMd;
      }
    }

    const vaultBase = this.getVaultBasePathForChatView();
    if (vaultBase && (nodePath.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate))) {
      const absolute = nodePath.resolve(candidate);
      const relative = nodePath.relative(vaultBase, absolute);
      if (relative && !relative.startsWith("..") && !nodePath.isAbsolute(relative)) {
        const vaultPath = normalizePath(relative);
        const fromAbsolute = this.app.vault.getAbstractFileByPath(vaultPath);
        if (fromAbsolute instanceof TFile) {
          return fromAbsolute;
        }
      }
    }
    return null;
  }

  private buildFileUrlFromAbsolutePath(rawPath: string): string | null {
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

  private async openLinkWithDesktopShell(url: string): Promise<boolean> {
    try {
      const win = window as Window & { require?: (id: string) => unknown };
      const electron = typeof win.require === "function"
        ? (win.require("electron") as {
            shell?: {
              openExternal?: (target: string) => Promise<void>;
              openPath?: (targetPath: string) => Promise<string>;
            };
          })
        : null;
      if (electron?.shell?.openExternal) {
        await electron.shell.openExternal(url);
        return true;
      }
      if (electron?.shell?.openPath && /^file:\/\//i.test(url)) {
        const path = decodeURIComponent(url.replace(/^file:\/\//i, ""));
        const result = await electron.shell.openPath(path);
        return !result;
      }
      window.open(url, "_blank");
      return true;
    } catch {
      try {
        window.open(url, "_blank");
        return true;
      } catch {
        return false;
      }
    }
  }

  private async tryOpenExternalFromChatLink(raw: string): Promise<boolean> {
    const decoded = this.decodeChatLinkValue(raw);
    if (!decoded) {
      return false;
    }
    try {
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
    } catch {
      return false;
    }
  }

  private bindChatMarkdownLinkHandlers(container: HTMLElement): void {
    container.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        const image = target?.closest("img");
        if (!(image instanceof HTMLImageElement)) {
          return;
        }
        const src = (image.getAttribute("src") ?? "").trim();
        if (!src) {
          return;
        }
        const internalImageFile = this.resolveVaultFileFromChatLink(src);
        const shouldInterceptImage =
          internalImageFile instanceof TFile ||
          /^https?:\/\//i.test(src) ||
          /^file:\/\//i.test(src) ||
          nodePath.isAbsolute(src) ||
          /^[A-Za-z]:[\\/]/.test(src);
        if (!shouldInterceptImage) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          if (internalImageFile instanceof TFile) {
            await this.app.workspace.getLeaf(true).openFile(internalImageFile);
            return;
          }
          await this.tryOpenExternalFromChatLink(src);
        })();
        return;
      }
      const candidates = [
        anchor.getAttribute("href") ?? "",
        anchor.textContent ?? "",
      ]
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (candidates.length === 0) {
        return;
      }
      const shouldIntercept = candidates.some((candidate) => {
        const decoded = this.decodeChatLinkValue(candidate);
        if (!decoded || decoded === "#") {
          return false;
        }
        if (
          /^https?:\/\//i.test(decoded) ||
          /^file:\/\//i.test(decoded) ||
          nodePath.isAbsolute(decoded) ||
          /^[A-Za-z]:[\\/]/.test(decoded)
        ) {
          return true;
        }
        return this.resolveVaultFileFromChatLink(decoded) instanceof TFile;
      });
      if (!shouldIntercept) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const openInternal = async (): Promise<boolean> => {
        for (const candidate of candidates) {
          const file = this.resolveVaultFileFromChatLink(candidate);
          if (!(file instanceof TFile)) {
            continue;
          }
          await this.app.workspace.getLeaf(true).openFile(file);
          return true;
        }
        return false;
      };

      const openExternalPath = async (): Promise<boolean> => {
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

  private renderMarkdownBody(
    container: HTMLElement,
    markdown: string,
    sourcePath: string,
    version: number,
  ): void {
    container.empty();
    void MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, this)
      .catch(() => {
        container.setText(markdown);
      })
      .finally(() => {
        this.bindChatMarkdownLinkHandlers(container);
        if (version === this.renderVersion) {
          this.threadEl.scrollTop = this.threadEl.scrollHeight;
        }
      });
  }

  private renderThinkingCard(parent: HTMLElement, message: LocalQAViewMessage): void {
    const timeline = message.timeline ?? [];
    const latest = timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
    const panel = parent.createEl("details", { cls: "auto-linker-chat-thinking-panel" });
    panel.open = false;
    const head = panel.createEl("summary", { cls: "auto-linker-chat-thinking-head" });
    const summaryText = latest
      ? `Thinking timeline · ${timeline.length} events · ${this.formatThinkingStage(latest.stage)}`
      : "Thinking timeline";
    head.createDiv({
      text: summaryText,
      cls: "auto-linker-chat-thinking-summary",
    });
    if (message.isDraft) {
      head.createDiv({
        cls: "auto-linker-chat-thinking-live",
        text: "LIVE",
      });
    }

    const body = panel.createDiv({ cls: "auto-linker-chat-thinking-body" });
    if (timeline.length > 0) {
      const timelineEl = body.createDiv({ cls: "auto-linker-chat-thinking-timeline" });
      for (const event of timeline.slice(-24)) {
        const card = timelineEl.createDiv({
          cls: `auto-linker-chat-thinking-event auto-linker-chat-thinking-event-${event.stage}`,
        });
        card.createEl("span", {
          cls: "auto-linker-chat-thinking-event-stage",
          text: this.formatThinkingStage(event.stage),
        });
        const content = card.createDiv({ cls: "auto-linker-chat-thinking-event-content" });
        content.createDiv({
          cls: "auto-linker-chat-thinking-event-message",
          text: event.message,
        });
        if (event.detail) {
          content.createDiv({
            cls: "auto-linker-chat-thinking-event-detail",
            text: event.detail,
          });
        }
        card.createEl("span", {
          cls: "auto-linker-chat-thinking-event-time",
          text: this.formatTime(event.timestamp),
        });
      }
    }

    if (message.thinkingDetails?.trim()) {
      const raw = body.createDiv({ cls: "auto-linker-chat-thinking-raw" });
      raw.createEl("div", {
        cls: "auto-linker-chat-thinking-raw-title",
        text: "Model thinking (raw)",
      });
      raw.createEl("pre", {
        cls: "auto-linker-chat-thinking-raw-body",
        text: message.thinkingDetails.trim(),
      });
    } else if (!timeline.length) {
      body.setText(message.text || "(empty)");
    }
  }

  private async startNewThread(): Promise<void> {
    if (
      this.messages.length > 0 &&
      (this.plugin.isQaThreadAutoSyncEnabledForQa() || this.threadPath)
    ) {
      await this.flushThreadSync(true);
    }
    this.messages = [];
    this.renderMessages();
    this.resetThreadState();
    this.inputEl.focus();
  }

  private scheduleThreadSync(delayMs = 850): void {
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

  private async flushThreadSync(force: boolean): Promise<void> {
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
        threadPath: this.threadPath ?? undefined,
        threadId: this.threadId,
        createdAt: this.threadCreatedAt,
      });
      this.threadPath = synced.path;
      this.threadId = synced.threadId;
      this.threadCreatedAt = synced.createdAt;
      this.setSyncStatus(`Synced ${this.formatTime(synced.updatedAt)}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown thread sync error";
      this.setSyncStatus("Sync failed");
      new Notice(`Chat sync failed: ${message}`, 7000);
    } finally {
      this.syncInFlight = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        this.scheduleThreadSync(350);
      }
    }
  }

  private async openThreadNote(): Promise<void> {
    if (this.messages.length === 0) {
      new Notice("No chat messages yet. / 아직 채팅 메시지가 없습니다.");
      return;
    }
    await this.flushThreadSync(true);
    if (!this.threadPath) {
      new Notice("Thread note is not ready yet. / 스레드 노트가 아직 준비되지 않았습니다.");
      return;
    }
    const target = this.app.vault.getAbstractFileByPath(this.threadPath);
    if (target instanceof TFile) {
      await this.app.workspace.getLeaf(true).openFile(target);
      return;
    }
    new Notice(`Thread note not found / 스레드 노트 없음: ${this.threadPath}`, 7000);
  }

  private renderSourceLink(parent: HTMLElement, source: LocalQASourceItem): void {
    const row = parent.createDiv({ cls: "auto-linker-chat-source-row" });
    const sourcePath = source.path.trim();
    const isAttachmentVirtual = sourcePath.startsWith("[ATTACHMENT-");
    const virtualLabel = isAttachmentVirtual
      ? sourcePath.replace(/^\[ATTACHMENT-[^\]]+\]\s*/, "").trim()
      : "";
    const fallbackTarget = isAttachmentVirtual
      ? this.resolveVaultFileFromChatLink(virtualLabel)
      : null;
    const target = !isAttachmentVirtual
      ? this.app.vault.getAbstractFileByPath(sourcePath)
      : fallbackTarget;
    const canOpenExternal =
      (
        /^https?:\/\//i.test(sourcePath)
        || /^file:\/\//i.test(sourcePath)
        || nodePath.isAbsolute(sourcePath)
        || /^[A-Za-z]:[\\/]/.test(sourcePath)
        || (isAttachmentVirtual && (
          /^https?:\/\//i.test(virtualLabel)
          || /^file:\/\//i.test(virtualLabel)
          || nodePath.isAbsolute(virtualLabel)
          || /^[A-Za-z]:[\\/]/.test(virtualLabel)
        ))
      );
    const externalPath = isAttachmentVirtual ? virtualLabel : sourcePath;

    if (target instanceof TFile) {
      const link = row.createEl("a", {
        text: sourcePath,
        href: "#",
        cls: "auto-linker-chat-source-link",
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
        cls: "auto-linker-chat-source-link",
      });
      link.setAttr("title", sourcePath);
      link.onclick = async (event) => {
        event.preventDefault();
        const opened = await this.tryOpenExternalFromChatLink(externalPath);
        if (!opened) {
          new Notice(`Source not found: ${externalPath}`, 5000);
        }
      };
    } else {
      const text = row.createEl("span", {
        text: sourcePath,
        cls: "auto-linker-chat-source-link",
      });
      text.setAttr(
        "title",
        isAttachmentVirtual
          ? "가상 첨부 출처입니다. 절대경로/볼트 경로가 포함되면 클릭 열기가 가능합니다."
          : `Source not found: ${sourcePath}`,
      );
      text.style.opacity = "0.82";
      text.style.cursor = "default";
    }

    row.createEl("span", {
      text: formatSimilarity(source.similarity),
      cls: "auto-linker-chat-source-similarity",
    });
  }

  private renderMessages(): void {
    this.renderVersion += 1;
    const version = this.renderVersion;
    this.threadEl.empty();
    if (this.messages.length === 0) {
      this.threadEl.createDiv({
        cls: "auto-linker-chat-empty",
        text: "질문을 입력해 대화를 시작하세요. / Ask a question to start.",
      });
      return;
    }

    for (const message of this.messages) {
      const box = this.threadEl.createDiv({
        cls: `auto-linker-chat-message auto-linker-chat-message-${message.role}`,
      });
      if (message.role === "thinking") {
        this.renderThinkingCard(box, message);
        continue;
      }
      if (message.role === "system") {
        const panel = box.createEl("details", { cls: "auto-linker-chat-system-panel" });
        panel.open = false;
        const summary = panel.createEl("summary", { cls: "auto-linker-chat-system-head" });
        summary.createEl("strong", { text: "System / 시스템" });
        summary.createEl("small", {
          text: this.formatTime(message.timestamp),
          cls: "auto-linker-chat-message-time",
        });
        const body = panel.createDiv({ cls: "auto-linker-chat-message-body" });
        body.setText(message.text);
        continue;
      }

      const head = box.createDiv({ cls: "auto-linker-chat-message-head" });
      head.createEl("strong", {
        text:
          message.role === "assistant"
            ? "Assistant / 어시스턴트"
            : message.role === "user"
              ? "You / 사용자"
              : "System / 시스템",
      });
      head.createEl("small", {
        text: this.formatTime(message.timestamp),
        cls: "auto-linker-chat-message-time",
      });

      const body = box.createDiv({ cls: "auto-linker-chat-message-body" });
      if (message.role === "assistant" && !message.isDraft) {
        body.addClass("auto-linker-chat-markdown");
        this.renderMarkdownBody(body, message.text, this.threadPath ?? "", version);
      } else {
        body.setText(message.text);
      }

      if (message.role === "assistant" && message.sources && message.sources.length > 0) {
        const src = box.createDiv({ cls: "auto-linker-chat-sources" });
        src.createDiv({
          cls: "auto-linker-chat-sources-title",
          text: `Sources / 출처 (${message.sources.length})`,
        });
        for (const source of message.sources) {
          this.renderSourceLink(src, source);
        }
      }

      if (
        message.role === "assistant" &&
        message.model &&
        message.embeddingModel
      ) {
        box.createDiv({
          cls: "auto-linker-chat-message-meta",
          text: `model=${message.model} | embedding=${message.embeddingModel}`,
        });
      }
    }

    this.threadEl.scrollTop = this.threadEl.scrollHeight;
  }

  private pushMessage(message: LocalQAViewMessage): void {
    this.messages.push(message);
    if (this.messages.length > 120) {
      this.messages = this.messages.slice(-120);
    }
    this.renderMessages();
    this.scheduleThreadSync();
  }

  private buildHistoryTurns(): LocalQAConversationTurn[] {
    const turns: LocalQAConversationTurn[] = this.messages
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({
        role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
        text: item.text,
      }));
    return turns.slice(-12);
  }

  private async refreshScopeLabel(): Promise<void> {
    const fileCount = this.plugin.getSelectedFilesForQa().length;
    const folderCount = this.plugin.getSelectedFolderPathsForQa().length;
    const attachmentCount = this.pendingAttachments.length;
    const role = this.plugin.getQaRolePresetForQa();
    const presetLabel = this.plugin.getQaPresetProfileLabelForQa();
    const conversationMode = this.plugin.getQaConversationModeLabelForQa();
    const model = this.plugin.getQaModelLabelForQa(role);
    const syncMode = this.plugin.isQaThreadAutoSyncEnabledForQa()
      ? "auto / 자동"
      : "manual / 수동";
    const fullSummary = `Scope / 범위: files=${fileCount}, folders=${folderCount}, attachments=${attachmentCount}`;
    const runtimeSummary =
      `convo=${conversationMode} | preset=${presetLabel} | QA=${model} | sync=${syncMode}`;

    this.scopeEl.empty();
    this.scopeEl.setAttr("title", fullSummary);

    this.scopeEl.createDiv({
      cls: "auto-linker-chat-scope-counts",
      text: `파일(Files): ${fileCount} / 폴더(Folders): ${folderCount} / 첨부 파일(Attach): ${attachmentCount}`,
    });
    if (this.runtimeSummaryEl) {
      this.runtimeSummaryEl.setText(runtimeSummary);
      this.runtimeSummaryEl.setAttr("title", runtimeSummary);
    }
  }

  private async refreshActiveFileStatus(): Promise<void> {
    if (!this.activeFileStatusEl || !this.contentEl.isConnected) {
      return;
    }
    this.activeFileStatusEl.empty();
    const active = this.resolveVisibleMarkdownFile();
    if (!(active instanceof TFile) || active.extension !== "md") {
      this.activeFileStatusEl.addClass("is-empty");
      this.activeFileStatusEl.setText("Open file / 열려있는 문서: 없음");
      return;
    }
    this.lastKnownOpenMarkdownPath = active.path;
    this.activeFileStatusEl.removeClass("is-empty");
    const chip = this.activeFileStatusEl.createDiv({
      cls: "auto-linker-chat-active-file-chip",
    });
    chip.addClass("is-current");
    chip.createSpan({
      cls: "auto-linker-chat-active-file-label",
      text: "Open file",
    });
    chip.createSpan({
      cls: "auto-linker-chat-active-file-name",
      text: `@${active.basename}`,
    });
    chip.setAttr("title", active.path);
  }

  private async submitQuestion(preloadedTurn?: {
    question: string;
    attachments: LocalQaExternalAttachment[];
    openFilePath?: string;
  }): Promise<void> {
    if (this.running) {
      if (!preloadedTurn) {
        this.preemptRunningTurnWithCurrentInput();
      }
      return;
    }
    this.stopRequested = false;
    const question = (preloadedTurn?.question ?? this.inputEl.value).trim();
    if (!question) {
      new Notice("Question is empty. / 질문이 비어 있습니다.");
      return;
    }

    const selectedFiles = this.plugin.getSelectedFilesForQa();
    const qaContextEnabled = this.plugin.isQaContextEnabledForQa();
    const attachmentsForTurn = preloadedTurn?.attachments ?? this.consumePendingAttachments();
    const hasPendingAttachments = attachmentsForTurn.length > 0;
    const openFileForTurn = this.resolveVisibleMarkdownFile();
    const openFilePathForTurn = preloadedTurn?.openFilePath
      ?? (
        qaContextEnabled && openFileForTurn instanceof TFile && openFileForTurn.extension === "md"
          ? openFileForTurn.path
          : undefined
      );
    if (!qaContextEnabled && !hasPendingAttachments) {
      this.pushMessage({
        role: "system",
        text: "QA 컨텍스트 OFF 상태입니다. 선택 노트 리트리벌 없이 일반 채팅으로 진행합니다.",
        timestamp: new Date().toISOString(),
      });
    } else if (selectedFiles.length === 0 && !hasPendingAttachments) {
      this.pushMessage({
        role: "system",
        text: openFilePathForTurn
          ? `선택 노트/첨부가 없어 현재 열린 문서를 우선 컨텍스트로 사용합니다: ${openFilePathForTurn}`
          : "선택 노트/첨부 없이 일반 대화를 진행합니다. 필요하면 노트를 선택하거나 첨부를 추가하세요.",
        timestamp: new Date().toISOString(),
      });
    }
    if (attachmentsForTurn.length > 0) {
      this.pushMessage({
        role: "system",
        text: `이번 질문에 첨부 ${attachmentsForTurn.length}개를 포함합니다.`,
        timestamp: new Date().toISOString(),
      });
    }

    const parsedTopK = Number.parseInt(this.topKInput.value, 10);
    const topK =
      Number.isFinite(parsedTopK) && parsedTopK >= 1
        ? Math.min(15, parsedTopK)
        : this.plugin.settings.qaTopK;

    if (!preloadedTurn) {
      this.inputEl.value = "";
    }
    this.pushMessage({
      role: "user",
      text: question,
      timestamp: new Date().toISOString(),
    });
    this.running = true;
    this.refreshSendButtonState();
    this.stopButton.disabled = false;
    this.stopRequested = false;
    const abortController = new AbortController();
    this.activeRequestController = abortController;
    const thinkingMessage: LocalQAViewMessage = {
      role: "thinking",
      text: "- Retrieving relevant notes...",
      timestamp: new Date().toISOString(),
      isDraft: true,
    };
    this.messages.push(thinkingMessage);
    const thinkingIndex = this.messages.length - 1;

    const draftMessage: LocalQAViewMessage = {
      role: "assistant",
      text: "",
      timestamp: new Date().toISOString(),
      isDraft: true,
    };
    this.messages.push(draftMessage);
    const draftIndex = this.messages.length - 1;
    this.renderMessages();
    this.scheduleThreadSync(300);

    const timeline: LocalQaProgressEvent[] = [];
    let modelThinking = "";
    let rawResponse = "";
    let thinkingStreamAnnounced = false;

    const updateThinkingMessage = (isDraft: boolean, forceTimestamp?: string): void => {
      const item = this.messages[thinkingIndex];
      if (!item || item.role !== "thinking") {
        return;
      }
      item.timeline = [...timeline];
      item.thinkingDetails = modelThinking.trim() || undefined;
      item.text = this.buildThinkingTranscriptText(timeline, modelThinking);
      item.isDraft = isDraft;
      item.timestamp = forceTimestamp ?? new Date().toISOString();
      this.scheduleStreamRender(80);
      this.scheduleThreadSync(900);
    };

    const pushTimelineEvent = (event: Omit<LocalQaProgressEvent, "timestamp"> & {
      timestamp?: string;
    }): void => {
      const timestamp = event.timestamp ?? new Date().toISOString();
      const prev = timeline[timeline.length - 1];
      if (
        prev &&
        prev.stage === event.stage &&
        prev.message === event.message &&
        prev.detail === event.detail
      ) {
        return;
      }
      timeline.push({
        stage: event.stage,
        message: event.message,
        detail: event.detail,
        timestamp,
      });
      if (timeline.length > 80) {
        timeline.splice(0, timeline.length - 80);
      }
      updateThinkingMessage(true, timestamp);
    };

    pushTimelineEvent({
      stage: "retrieval",
      message: "Retrieval started",
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
          const draft = this.messages[draftIndex];
          if (draft && draft.role === "assistant") {
            draft.text = parsed.answer;
            draft.isDraft = true;
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
                timestamp: event.timestamp,
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
        },
      );
      const draft = this.messages[draftIndex];
      if (draft && draft.role === "assistant") {
        draft.text = result.answer;
        draft.timestamp = new Date().toISOString();
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
              message: "Model thinking captured",
            });
            thinkingStreamAnnounced = true;
          }
        }
        pushTimelineEvent({
          stage: "generation",
          message: "Answer generated",
        });
        updateThinkingMessage(false);
        this.renderMessages();
        this.scheduleThreadSync(120);
      } else {
        this.pushMessage({
          role: "assistant",
          text: result.answer,
          timestamp: new Date().toISOString(),
          sources: result.sources,
          model: result.model,
          embeddingModel: result.embeddingModel,
          retrievalCacheHits: result.retrievalCacheHits,
          retrievalCacheWrites: result.retrievalCacheWrites,
          isDraft: false,
        });
      }

      const thinking = this.messages[thinkingIndex];
      if (thinking && thinking.role === "thinking") {
        const hasTimeline = (thinking.timeline?.length ?? 0) > 0;
        const hasThinkingText = Boolean(thinking.thinkingDetails?.trim());
        if (!hasTimeline && !hasThinkingText) {
          this.messages.splice(thinkingIndex, 1);
        } else {
          thinking.isDraft = false;
          thinking.timestamp = new Date().toISOString();
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
      const message = cancelled
        ? "요청이 중지되었습니다."
        : error instanceof Error
          ? error.message
          : "Unknown local QA error";
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
          message: cancelled ? "Request cancelled by user" : `Error: ${message}`,
        });
        thinking.isDraft = false;
        thinking.timestamp = new Date().toISOString();
      }
      this.pushMessage({
        role: "system",
        text: cancelled
          ? preemptPending
            ? "steer 전환을 위해 이전 응답을 중지했습니다."
            : `중지: ${message}`
          : `오류: ${message}`,
        timestamp: new Date().toISOString(),
      });
      if (!cancelled) {
        new Notice(`Local Q&A failed: ${message}`, 7000);
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
}

const SETTINGS_HEADER_KO_MAP: Readonly<Record<string, string>> = {
  "Local provider config": "로컬 제공자 설정",
  "Cloud provider config": "클라우드 제공자 설정",
  Behavior: "동작 설정",
  "Semantic linking (Ollama embeddings)": "시맨틱 링크(올라마 임베딩)",
  "Property cleanup": "속성 정리",
  "Selection and backup": "선택 및 백업",
  MOC: "MOC",
};

const SETTINGS_NAME_KO_MAP: Readonly<Record<string, string>> = {
  "Settings view mode": "설정 보기 모드",
  "Settings UI language": "설정 UI 언어",
  "Plugin mission": "플러그인 목적",
  "Quick one-click setup": "빠른 원클릭 설정",
  "Conversation mode (chat runtime)": "대화 모드(채팅 런타임)",
  "Mode behavior summary": "모드 동작 요약",
  "Quick custom profile slots": "빠른 커스텀 프로필 슬롯",
  "Quick model pickers": "빠른 모델 선택기",
  "One-click local presets": "원클릭 로컬 프리셋",
  "Local AI readiness": "로컬 AI 준비 상태",
  "Open preset guide": "프리셋 가이드 열기",
  "Guide actions": "가이드 동작",
  "Need advanced options?": "고급 설정이 필요한가요?",
  Provider: "제공자",
  "Ollama base URL": "Ollama 기본 URL",
  "Ollama detected model picker": "Ollama 감지 모델 선택기",
  "Ollama model (manual)": "Ollama 모델(수동)",
  "Auto-pick recommended Ollama model": "권장 Ollama 모델 자동 선택",
  "Ollama detection summary": "Ollama 감지 요약",
  "LM Studio base URL": "LM Studio 기본 URL",
  "LM Studio model": "LM Studio 모델",
  "LM Studio API key (optional)": "LM Studio API 키(선택)",
  "OpenAI base URL": "OpenAI 기본 URL",
  "OpenAI model": "OpenAI 모델",
  "OpenAI API key": "OpenAI API 키",
  "Anthropic model": "Anthropic 모델",
  "Anthropic API key": "Anthropic API 키",
  "Gemini model": "Gemini 모델",
  "Gemini API key": "Gemini API 키",
  "Analyzed depth mode": "분석 깊이 모드",
  "Analyzed runtime estimate": "분석 예상 시간",
  "Analyzed scope snapshot": "분석 범위 스냅샷",
  "Suggestion mode (recommended)": "제안 모드(권장)",
  "Show reasons for each field": "각 필드 근거 표시",
  "Show progress notices": "진행 알림 표시",
  "Analyze tags": "태그 분석",
  "Analyze topic": "주제 분석",
  "Analyze linked": "연결 노트 분석",
  "Force all-to-all linked (deterministic)": "선택 노트 전체 상호 linked 강제(결정적)",
  "Analyze index": "인덱스 분석",
  "Max tags": "최대 태그 수",
  "Max linked": "최대 linked 수",
  "Enable semantic candidate ranking": "시맨틱 후보 랭킹 사용",
  "Embedding Ollama base URL": "임베딩 Ollama 기본 URL",
  "Embedding detected model picker": "임베딩 감지 모델 선택기",
  "Embedding model (manual)": "임베딩 모델(수동)",
  "Auto-pick recommended embedding model": "권장 임베딩 모델 자동 선택",
  "Embedding detection summary": "임베딩 감지 요약",
  "Semantic top-k candidates": "시맨틱 top-k 후보 수",
  "Semantic min similarity": "시맨틱 최소 유사도",
  "Semantic source max chars": "시맨틱 소스 최대 문자 수",
  "Q&A Ollama base URL": "Q&A Ollama 기본 URL",
  "Q&A model": "Q&A 모델",
  "Q&A pipeline preset": "Q&A 파이프라인 프리셋",
  "Role model detection controls": "역할 모델 감지 제어",
  "Role model detection summary": "역할 모델 감지 요약",
  "Auto-pick recommended role models": "권장 역할 모델 자동 선택",
  "Apply role recommendations now": "역할 추천값 즉시 적용",
  "Role recommendation summary": "역할별 추천 요약",
  "Ask model (text)": "Ask 모델(텍스트)",
  "Ask model (vision)": "Ask 모델(비전)",
  "Image generator model": "이미지 생성 모델",
  "Coder model": "Coder 모델",
  "Architect model": "Architect 모델",
  "Orchestrator model": "Orchestrator 모델",
  "Safeguard model": "Safeguard 모델",
  "Role system prompt editor": "역할 시스템 프롬프트 편집기",
  "Prefer Ollama /api/chat (with fallback)": "Ollama /api/chat 우선(폴백 포함)",
  "Chat transcript folder path": "채팅 기록 폴더 경로",
  "Attachment ingest folder path": "첨부 미러링 폴더 경로",
  "Use QA context in chat": "채팅에서 QA 컨텍스트 사용",
  "Parser mode": "파서 모드",
  "Parser tool readiness": "파서 도구 준비 상태",
  "Auto-sync chat thread": "채팅 스레드 자동 동기화",
  "PDF attachments in chat": "채팅 PDF 첨부",
  "Allow PDF attachments in chat (experimental)": "채팅 PDF 첨부 허용(실험)",
  "Enable agent tool mode (experimental)": "에이전트 도구 모드 사용(실험)",
  "Require approval before tool execution": "도구 실행 전 승인 필요",
  "Allow shell tool (danger)": "셸 도구 허용(위험)",
  "Agent shell full access (danger)": "에이전트 셸 전체 접근(위험)",
  "Shell tool timeout (seconds)": "셸 도구 타임아웃(초)",
  "Shell tool default cwd (vault-relative, optional)": "셸 도구 기본 작업 폴더(vault-relative, 선택)",
  "Agent path allowlist (absolute, comma/newline)": "에이전트 경로 허용목록(절대경로, 쉼표/줄바꿈)",
  "Balanced preset base model": "Balanced 프리셋 기본 모델",
  "Balanced preset vision model": "Balanced 프리셋 비전 모델",
  "Balanced preset embedding model": "Balanced 프리셋 임베딩 모델",
  "Pro preset base model": "Pro 프리셋 기본 모델",
  "Pro preset vision model": "Pro 프리셋 비전 모델",
  "Pro preset embedding model": "Pro 프리셋 임베딩 모델",
  "Quality+ preset base model": "Quality+ 프리셋 기본 모델",
  "Quality+ preset vision model": "Quality+ 프리셋 비전 모델",
  "Quality+ preset embedding model": "Quality+ 프리셋 임베딩 모델",
  "Preset override warning summary": "프리셋 오버라이드 경고 요약",
  "Agent role model health check": "에이전트 역할 모델 상태 점검",
  "Allow non-local Q&A endpoint (danger)": "로컬 외 Q&A 엔드포인트 허용(위험)",
  "Allowed outbound hosts (non-local Q&A)": "허용 외부 호스트(비로컬 Q&A)",
  "Remove legacy AI-prefixed keys": "레거시 AI 접두 키 제거",
  "Enable cleanup rules during apply": "적용 시 정리 규칙 사용",
  "Cleanup exact keys": "정리 정확 키",
  "Pick cleanup keys from selected notes": "선택 노트에서 정리 키 선택",
  "Cleanup key prefixes": "정리 키 접두어",
  "Never remove these keys": "절대 제거하지 않을 키",
  "Run cleanup command": "정리 명령 실행",
  "Cleanup dry-run report folder": "정리 dry-run 리포트 폴더",
  "Sort tags and linked arrays": "tags/linked 배열 정렬",
  "Include subfolders for selected folders": "선택 폴더 하위폴더 포함",
  "Selection path width percent": "선택 경로 너비 비율",
  "Excluded folder patterns": "제외 폴더 패턴",
  "Backup selected notes before apply": "적용 전 선택 노트 백업",
  "Backup root path": "백업 루트 경로",
  "Backup retention count": "백업 보관 개수",
  "Generate MOC after apply": "적용 후 MOC 생성",
  "MOC file path": "MOC 파일 경로",
};

const SETTINGS_DESC_KO_MAP: Readonly<Record<string, string>> = {
  "Simple shows essentials only. Full shows all advanced controls without removing features.": "Simple은 핵심 옵션만 보이고, Full은 모든 고급 옵션을 표시합니다(기능은 제거되지 않음).",
  "Choose language style used in setting labels/descriptions across all tabs.": "모든 탭의 설정 라벨/설명에 사용할 언어 표시 방식을 선택합니다.",
  "1) Auto-link notes for graph-based second-brain insight. 2) Secure local AI chat/generation grounded in your notes and attachments.": "1) 노트 linked 자동화로 그래프 기반 제2의 뇌/인사이트를 지원합니다. 2) 노트·첨부 기반 로컬 AI 채팅/생성을 보안 우선으로 제공합니다.",
  "Fast, balanced, and quality presets for local usage.": "로컬 사용 기준으로 속도/균형/품질 프리셋을 원클릭 적용합니다.",
  "Ask/Plan/Agent/Orchestration 모드를 선택하면 역할/파이프라인/에이전트 도구 기본값을 즉시 재배치합니다.": "Ask/Plan/Agent/Orchestration 모드를 선택하면 역할/파이프라인/에이전트 도구 기본값을 즉시 재배치합니다.",
  "Fast/Balanced/Quality+ presets with automatic local model detection and role assignment.": "Fast/Balanced/Quality+를 누르면 로컬 모델을 자동 감지하고 기본/역할 모델 배치를 자동 적용합니다.",
  "Flash/Pro presets with automatic local model detection and role assignment.": "Flash/Pro를 누르면 로컬 모델을 자동 감지하고 기본/역할 모델 배치를 자동 적용합니다.",
  "See what each preset changes and which local models are recommended.": "각 프리셋에서 바뀌는 설정과 권장 로컬 모델 구성을 확인합니다.",
  "Refresh local detection or return to Quick tab.": "로컬 감지를 새로고침하거나 Quick 탭으로 돌아갑니다.",
  "Switch to Full once to access all expert controls. Features are unchanged.": "전문가용 전체 제어가 필요하면 Full로 전환하세요. 기능은 동일하게 유지됩니다.",
  "Return to Simple to focus on essentials.": "핵심 항목 중심으로 보려면 Simple로 돌아갑니다.",
  "Choose AI provider. Local providers are recommended first.": "AI 제공자를 선택합니다. 로컬 제공자를 우선 권장합니다.",
  "Choose among detected models. (추천)=recommended, (불가)=not suitable for analysis.": "감지된 모델 중에서 선택합니다. (추천)=권장, (불가)=분석 부적합",
  "Manual override if you want a custom model name.": "사용자 지정 모델명을 직접 입력할 때 사용합니다.",
  "Detect local models and auto-choose recommended when current is missing.": "로컬 모델을 감지해 현재 모델이 없으면 권장 모델을 자동 선택합니다.",
  "Analyze first, preview changes, and apply only when approved.": "먼저 분석하고 변경 미리보기를 확인한 뒤 승인 시에만 적용합니다.",
  "When enabled, linked field includes all selected notes for each note (except self). maxLinked is ignored in this mode.": "켜면 각 노트의 linked에 선택된 모든 노트(자기 자신 제외)를 넣습니다. 이 모드에서는 maxLinked를 무시합니다.",
  "In addition to persistent progress modal, show short notices.": "고정 진행 모달 외에도 짧은 알림을 표시합니다.",
  "Quick: changed-notes 중심 + semantic off. Detailed: semantic on + 전체 범위 기반 분석.": "Quick은 변경 노트 중심+semantic off, Detailed는 semantic on+전체 범위 기반 분석입니다.",
  "Use local Ollama embeddings to rank likely related notes before AI linked suggestion.": "AI linked 제안 전에 로컬 Ollama 임베딩으로 관련 가능 노트를 우선 정렬합니다.",
  "Choose among detected models. (추천)=recommended, (불가)=not suitable for embeddings.": "감지된 모델 중에서 선택합니다. (추천)=권장, (불가)=임베딩 부적합",
  "Choose among embedding-capable detected models. (추천)=recommended.": "임베딩 가능한 감지 모델 중에서 선택합니다. (추천)=권장",
  "Manual override if you want a custom embedding model name.": "사용자 지정 임베딩 모델명을 직접 입력할 때 사용합니다.",
  "Range: 0.0 to 1.0": "범위: 0.0 ~ 1.0",
  "Trim note text before embedding to keep local runs fast.": "로컬 실행 성능을 위해 임베딩 전 노트 텍스트 길이를 제한합니다.",
  "Leave empty to use main Ollama base URL.": "비워두면 메인 Ollama 기본 URL을 사용합니다.",
  "Leave empty to use main analysis model.": "비워두면 메인 분석 모델을 사용합니다.",
  "Select execution pipeline for post-generation passes.": "생성 후 후처리 패스의 실행 파이프라인을 선택합니다.",
  "Refresh local model detection manually, then choose role-specific models below.": "로컬 모델 감지를 수동으로 갱신한 뒤, 아래에서 역할별 모델을 선택합니다.",
  "Auto-fill role model fields from detected models when values are missing or legacy-uniform.": "값이 비어 있거나 기존처럼 동일 모델로만 채워진 경우, 감지 모델 기반 권장값으로 역할별 필드를 자동 채웁니다.",
  "Calculate role-specific recommended models from detected list and apply.": "감지된 모델 목록에서 역할별 권장 모델을 계산해 즉시 적용합니다.",
  "Optional role-specific model. Empty uses Q&A model as fallback.": "역할 전용 모델(선택)입니다. 비우면 Q&A 모델을 사용합니다.",
  "Prefer vision-capable models for Ask (vision). Chat supports image attachments (drop/upload/paste).": "Ask(비전)은 비전 가능한 모델을 우선 권장합니다. 채팅은 이미지 첨부(드래그/업로드/붙여넣기)를 지원합니다.",
  "Reserved for image-generation workflows. Current chat UI is text-first.": "이미지 생성 워크플로용 예약 모델입니다. 현재 채팅 UI는 텍스트 중심입니다.",
  "Add extra system instructions per role agent. Empty keeps built-in role prompt only.": "역할별 에이전트에 추가 시스템 지시를 넣습니다. 비우면 기본 역할 프롬프트만 사용합니다.",
  "Use role-based chat first, then fallback to /api/generate when unavailable.": "역할 기반 /api/chat을 우선 사용하고, 불가하면 /api/generate로 폴백합니다.",
  "Vault-relative path for saving chat transcripts.": "채팅 기록 저장용 vault-relative 경로입니다.",
  "Vault-relative folder where external attachments are mirrored for stable source links.": "외부 첨부를 안정적인 출처 링크로 열기 위해 vault 내부로 미러링하는 폴더 경로입니다.",
  "When disabled, chat runs in general mode without selected-note retrieval context.": "비활성화하면 선택 노트 리트리벌 없이 일반 채팅 모드로 동작합니다.",
  "Fast: lightweight parsing. Detailed: OCR and deeper parser chain for difficult files.": "Fast는 경량 파서, Detailed는 OCR/심화 체인을 적극 사용합니다.",
  "When enabled, the current chat thread is continuously saved and updated as messages change.": "활성화하면 현재 채팅 스레드를 메시지 변경에 맞춰 계속 저장/동기화합니다.",
  "When enabled, PDF files can be attached in chat. Current mode keeps metadata/label context and routes to vision role for safer handling.": "활성화하면 채팅에서 PDF 첨부를 허용합니다. 현재는 메타데이터/라벨 중심 컨텍스트로 처리하며 비전 역할로 우선 라우팅합니다.",
  "Shows all preset override fields currently marked with warning (⚠) in one place.": "⚠ 경고가 붙은 프리셋 오버라이드 필드를 한 곳에서 모아 보여줍니다.",
  "Quick diagnostic for role-model auto assignment and unavailable role mappings.": "역할 모델 자동 배치와 불가 매핑을 빠르게 점검합니다.",
  "Allow model-proposed actions (read/write/list/shell) from chat responses via auto-link-actions JSON block.": "채팅 응답의 auto-link-actions JSON 블록을 통해 모델 제안 액션(읽기/쓰기/목록/셸)을 허용합니다.",
  "Recommended. If enabled, proposed actions are queued and run only after user sends '승인' or '/approve'.": "권장 설정입니다. 켜면 제안된 액션을 대기열에 두고 사용자가 '승인' 또는 '/approve' 입력 시에만 실행합니다.",
  "Allows run_shell actions via local terminal command execution. Keep off unless absolutely needed.": "로컬 터미널 명령 실행 기반 run_shell 액션을 허용합니다. 꼭 필요할 때만 켜세요.",
  "If enabled, run_shell and agent file actions(read/write/list) can use any absolute path (allowlist bypass).": "활성화하면 run_shell과 에이전트 파일 액션(read/write/list)이 임의의 절대경로를 사용할 수 있습니다(allowlist 우회).",
  "Per command timeout for run_shell actions.": "run_shell 액션의 명령별 제한 시간입니다.",
  "Example: '.' for vault root, 'Projects' for a subfolder. Empty means vault root.": "예: vault 루트는 '.', 하위 폴더는 'Projects'. 비워두면 vault 루트를 사용합니다.",
  "Shell tool absolute cwd allowlist. Default: (empty, set explicitly if needed)": "Shell 도구의 절대경로 작업 폴더 허용 목록입니다. 기본값: (비어 있음, 필요 시 직접 설정)",
  "Absolute path allowlist for run_shell cwd and agent file actions(read/write/list) when full access is OFF. Default: (empty, vault-only)": "full access OFF일 때 run_shell cwd와 에이전트 파일 액션(read/write/list)에 사용할 절대경로 허용 목록입니다. 기본값: (비어 있음, vault 전용)",
  "Optional manual base-model override for Balanced preset.": "Balanced 프리셋 적용 시 기본 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual vision-model override for Balanced preset.": "Balanced 프리셋 적용 시 비전 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual embedding-model override for Balanced preset.": "Balanced 프리셋 적용 시 임베딩 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual base-model override for Pro preset.": "Pro 프리셋 적용 시 기본 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual vision-model override for Pro preset.": "Pro 프리셋 적용 시 비전 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual embedding-model override for Pro preset.": "Pro 프리셋 적용 시 임베딩 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual base-model override for Quality+ preset.": "Quality+ 프리셋 적용 시 기본 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual vision-model override for Quality+ preset.": "Quality+ 프리셋 적용 시 비전 모델을 수동으로 덮어씁니다(선택).",
  "Optional manual embedding-model override for Quality+ preset.": "Quality+ 프리셋 적용 시 임베딩 모델을 수동으로 덮어씁니다(선택).",
  "Off by default. Keep disabled to prevent note data leaving localhost.": "기본값은 꺼짐입니다. 노트 데이터가 localhost 밖으로 나가지 않도록 비활성 상태를 권장합니다.",
  "Comma/newline-separated host allowlist used when non-local endpoint is enabled. Example: api.openai.com, api.anthropic.com": "비로컬 엔드포인트를 사용할 때 적용할 호스트 허용 목록입니다(쉼표/줄바꿈 구분). 예: api.openai.com, api.anthropic.com",
  "If enabled, removes only legacy keys like ai_*/autolinker_* while preserving other existing keys (including linter date fields).": "활성화하면 ai_*/autolinker_* 같은 레거시 키만 제거하고, 다른 기존 키(린터 날짜 필드 포함)는 유지합니다.",
  "When applying AI suggestions, also remove frontmatter keys by rules below.": "AI 제안 적용 시 아래 규칙에 따라 frontmatter 키도 함께 정리합니다.",
  "Comma/newline separated keys. Example: related, linked_context": "쉼표/줄바꿈으로 구분한 키 목록입니다. 예: related, linked_context",
  "Scan selected notes and choose keys by checkbox.": "선택한 노트를 스캔해 체크박스로 정리 키를 선택합니다.",
  "Comma/newline separated prefixes. Example: temp_, draft_": "쉼표/줄바꿈으로 구분한 접두어 목록입니다. 예: temp_, draft_",
  "Comma/newline separated keys that override cleanup rules.": "정리 규칙보다 우선하는 키 목록(쉼표/줄바꿈 구분)입니다.",
  "Use command palette: apply='Cleanup frontmatter properties for selected notes', preview='Dry-run cleanup frontmatter properties for selected notes'.": "명령 팔레트 사용: apply='Cleanup frontmatter properties for selected notes', preview='Dry-run cleanup frontmatter properties for selected notes'.",
  "Vault-relative folder for cleanup dry-run report files.": "정리 dry-run 리포트 저장용 vault-relative 폴더입니다.",
  "Helps keep stable output and reduce linter churn.": "출력 안정성을 높이고 린터 변경 잡음을 줄여줍니다.",
  "Controls path width in Select target notes/folders modal (45-100).": "Select target notes/folders 모달의 경로 너비를 조절합니다(45-100).",
  "Comma-separated substrings. Matched folders are ignored during selection/analysis.": "쉼표로 구분한 문자열 패턴입니다. 일치하는 폴더는 선택/분석에서 제외됩니다.",
  "You can also override this every run from the backup confirmation dialog.": "백업 확인 대화상자에서 실행마다 이 설정을 덮어쓸 수 있습니다.",
  "Vault-relative folder path used for versioned backups.": "버전형 백업에 사용하는 vault-relative 폴더 경로입니다.",
  "Keep only latest N backups (old backups are deleted automatically).": "최신 N개 백업만 유지합니다(오래된 백업은 자동 삭제).",
  "Vault-relative markdown path.": "vault-relative 마크다운 경로입니다.",
};

function toKoreanBilingualLabel(
  originalText: string | null | undefined,
  translationMap: Readonly<Record<string, string>>,
): string | null {
  const normalized = originalText?.trim() ?? "";
  if (!normalized || normalized.includes(" / ")) {
    return null;
  }
  const translated = translationMap[normalized];
  if (!translated) {
    return null;
  }
  return `${normalized} / ${translated}`;
}

function toKoreanBilingualParts(
  originalText: string | null | undefined,
  translationMap: Readonly<Record<string, string>>,
): { en: string; ko: string } | null {
  const normalized = originalText?.trim() ?? "";
  if (!normalized || normalized.includes(" / ")) {
    return null;
  }
  const translated = translationMap[normalized];
  if (!translated) {
    return null;
  }
  return { en: normalized, ko: translated };
}

function splitInlineBilingualText(
  originalText: string | null | undefined,
): { en: string; ko: string } | null {
  const normalized = originalText?.trim() ?? "";
  if (!normalized || !normalized.includes(" / ")) {
    return null;
  }
  const parts = normalized.split(" / ");
  if (parts.length < 2) {
    return null;
  }
  const en = (parts[0] ?? "").trim();
  const ko = parts.slice(1).join(" / ").trim();
  if (!en || !ko) {
    return null;
  }
  return { en, ko };
}

type RoleModelSettingKey =
  | "qaAskModel"
  | "qaAskVisionModel"
  | "qaImageGeneratorModel"
  | "qaCoderModel"
  | "qaArchitectModel"
  | "qaOrchestratorModel"
  | "qaSafeguardModel";

type PresetProfileModelSettingKey =
  | "qaBalancedPresetBaseModel"
  | "qaBalancedPresetVisionModel"
  | "qaBalancedPresetEmbeddingModel"
  | "qaQualityPresetBaseModel"
  | "qaQualityPresetVisionModel"
  | "qaQualityPresetEmbeddingModel";

type PresetProfileModelKind = "text" | "vision" | "embedding";

interface RoleModelSettingConfig {
  key: RoleModelSettingKey;
  role: QaRolePreset;
  name: string;
  description: string;
}

interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

const ROLE_MODEL_FALLBACK_VALUE = "__fallback__";

const ROLE_MODEL_SETTING_CONFIGS: ReadonlyArray<RoleModelSettingConfig> = [
  {
    key: "qaAskModel",
    role: "ask",
    name: "Ask model (text)",
    description: "Optional role-specific model. Empty uses Q&A model as fallback.",
  },
  {
    key: "qaAskVisionModel",
    role: "ask_vision",
    name: "Ask model (vision)",
    description:
      "Prefer vision-capable models for Ask (vision). Chat supports image attachments (drop/upload/paste).",
  },
  {
    key: "qaImageGeneratorModel",
    role: "image_generator",
    name: "Image generator model",
    description: "Reserved for image-generation workflows. Current chat UI is text-first.",
  },
  {
    key: "qaCoderModel",
    role: "coder",
    name: "Coder model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback.",
  },
  {
    key: "qaArchitectModel",
    role: "architect",
    name: "Architect model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback.",
  },
  {
    key: "qaOrchestratorModel",
    role: "orchestrator",
    name: "Orchestrator model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback.",
  },
  {
    key: "qaSafeguardModel",
    role: "safeguard",
    name: "Safeguard model",
    description: "Optional role-specific model. Empty uses Q&A model as fallback.",
  },
];

const CODER_MODEL_REGEX = /(coder|code|codellama|codestral|starcoder|deepseek-coder)/i;
const SAFEGUARD_MODEL_REGEX = /(guard|safeguard|safety|llama-guard)/i;
const VISION_MODEL_REGEX =
  /(vision|llava|bakllava|moondream|qwen.*vl|pixtral|internvl|minicpm[-_]?v|florence|gemma3)/i;
const IMAGE_GENERATOR_MODEL_REGEX = /(flux|sdxl|stable[-_ ]?diffusion|diffusion|imagegen|image-gen)/i;
const GENERAL_TEXT_MODEL_REGEX = /(qwen|llama|gpt-oss|gemma|mistral|devstral|phi|deepseek|yi)/i;
const LARGE_MODEL_SIZE_REGEX = /:(12|14|20|24|27|30|32|34|70)b\b/i;
const MID_MODEL_SIZE_REGEX = /:(7|8|9|10|11)b\b/i;
const SMALL_MODEL_SIZE_REGEX = /:(0\.[0-9]+|1|2|3|4|5|6)b\b/i;

function extractModelSizeBillions(modelName: string): number | null {
  const matched = modelName.toLowerCase().match(/:(\d+(?:\.\d+)?)b\b/);
  if (!matched) {
    return null;
  }
  const parsed = Number.parseFloat(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOllamaModelAllowedForQaRole(role: QaRolePreset, modelName: string): boolean {
  const trimmed = modelName.trim();
  if (!trimmed) {
    return false;
  }
  if (role === "ask_vision" || role === "image_generator") {
    return VISION_MODEL_REGEX.test(trimmed.toLowerCase());
  }
  return isOllamaModelAnalyzable(trimmed);
}

function scoreRoleModel(role: QaRolePreset, modelName: string): number {
  if (!isOllamaModelAllowedForQaRole(role, modelName)) {
    return -100;
  }
  const lower = modelName.toLowerCase();
  const isCoder = CODER_MODEL_REGEX.test(lower);
  const isSafeguard = SAFEGUARD_MODEL_REGEX.test(lower);
  const isVision = VISION_MODEL_REGEX.test(lower);
  const isImageGenerator = IMAGE_GENERATOR_MODEL_REGEX.test(lower);
  const isGeneral =
    GENERAL_TEXT_MODEL_REGEX.test(lower) && !isVision && !isImageGenerator;
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

function buildRoleSpecificOllamaModelOptions(
  role: QaRolePreset,
  models: string[],
): OllamaModelOption[] {
  const scored = models
    .map((model) => ({ model, score: scoreRoleModel(role, model) }))
    .sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));
  const recommended = scored.find((item) => item.score > -100)?.model;
  const options = models.map((model): OllamaModelOption => {
    const isRoleCompatible = isOllamaModelAllowedForQaRole(role, model);
    if (!isRoleCompatible) {
      return {
        model,
        status: "unavailable",
        reason:
          role === "ask_vision" || role === "image_generator"
            ? "Not suitable for vision/image role."
            : "Not suitable for current text-based role pipeline.",
      };
    }
    if (recommended && model === recommended) {
      return {
        model,
        status: "recommended",
        reason: `Recommended for ${role} role based on detected local model profile.`,
      };
    }
    return {
      model,
      status: "available",
      reason:
        (role === "ask_vision" || role === "image_generator")
          && VISION_MODEL_REGEX.test(model.toLowerCase())
          ? "Available vision-capable model for multimodal role."
          : "Available text-capable model.",
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

const QA_ROLE_PRESET_OPTIONS: ReadonlyArray<LabeledOption<QaRolePreset>> = [
  { value: "ask", label: "Ask (default / 기본)" },
  { value: "ask_vision", label: "Ask (vision / 비전)" },
  { value: "image_generator", label: "Image generator / 이미지 생성" },
  { value: "orchestrator", label: "Orchestrator / 오케스트레이터" },
  { value: "coder", label: "Coder / 코더" },
  { value: "debugger", label: "Debugger / 디버거" },
  { value: "architect", label: "Architect / 아키텍트" },
  { value: "safeguard", label: "Safeguard (security / 보안)" },
];

const QA_PIPELINE_PRESET_OPTIONS: ReadonlyArray<LabeledOption<QaPipelinePreset>> = [
  {
    value: "orchestrator_safeguard",
    label: "Orchestrator -> Safeguard (default / 기본)",
  },
  {
    value: "orchestrator_auto_route",
    label: "Orchestrator -> Auto route sub agents -> Safeguard (자동 라우팅)",
  },
  {
    value: "orchestrator_coder_safeguard",
    label: "Orchestrator -> Coder -> Safeguard",
  },
  {
    value: "orchestrator_architect_safeguard",
    label: "Orchestrator -> Architect -> Safeguard",
  },
  {
    value: "orchestrator_architect_coder_safeguard",
    label: "Orchestrator -> Architect -> Coder -> Safeguard",
  },
  {
    value: "legacy_auto",
    label: "Legacy auto (기존 자동 규칙)",
  },
];

function getQaRolePresetLabel(value: QaRolePreset): string {
  const found = QA_ROLE_PRESET_OPTIONS.find((option) => option.value === value);
  return found?.label ?? value;
}

function getQaPipelinePresetLabel(value: QaPipelinePreset): string {
  const found = QA_PIPELINE_PRESET_OPTIONS.find((option) => option.value === value);
  return found?.label ?? value;
}

type SettingsPanelTab =
  | "quick"
  | "analyzed"
  | "models"
  | "chat"
  | "advanced"
  | "orchestration"
  | "skills"
  | "parser"
  | "guide";

type QaLocalPresetProfile = KnowledgeWeaverSettings["qaLocalPresetProfile"];
type QaConversationMode = KnowledgeWeaverSettings["qaConversationMode"];
type QaQuickCustomSlotKey =
  | "qaQuickCustomProfileSlot1"
  | "qaQuickCustomProfileSlot2"
  | "qaQuickCustomProfileSlot3";

const QA_QUICK_CUSTOM_SLOT_CONFIGS: Array<{
  key: QaQuickCustomSlotKey;
  label: string;
}> = [
  { key: "qaQuickCustomProfileSlot1", label: "커스텀 1" },
  { key: "qaQuickCustomProfileSlot2", label: "커스텀 2" },
  { key: "qaQuickCustomProfileSlot3", label: "커스텀 3" },
];

const QA_CONVERSATION_MODE_OPTIONS: ReadonlyArray<LabeledOption<QaConversationMode>> = [
  { value: "ask", label: "Ask" },
  { value: "plan", label: "Plan" },
  { value: "agent", label: "Agent" },
  { value: "orchestration", label: "Orchestration" },
];

function getQaLocalPresetProfileLabel(value: QaLocalPresetProfile): string {
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

function getQaConversationModeLabel(value: QaConversationMode): string {
  const found = QA_CONVERSATION_MODE_OPTIONS.find((option) => option.value === value);
  return found?.label ?? "Ask";
}

class KnowledgeWeaverSettingTab extends PluginSettingTab {
  private readonly plugin: KnowledgeWeaverPlugin;
  private rolePromptEditorTarget: QaRolePreset = "ask";
  private static readonly TAB_OPTIONS: Array<{
    key: SettingsPanelTab;
    en: string;
    ko: string;
  }> = [
    { key: "quick", en: "Quick", ko: "빠른 설정" },
    { key: "models", en: "Models", ko: "모델" },
    { key: "analyzed", en: "Analyzed", ko: "분석" },
    { key: "chat", en: "Chat", ko: "채팅" },
    { key: "advanced", en: "Advanced", ko: "고급" },
    { key: "orchestration", en: "Orchestration", ko: "오케스트레이션" },
    { key: "skills", en: "Skills", ko: "스킬스" },
    { key: "parser", en: "Parser", ko: "파서" },
    { key: "guide", en: "Guide", ko: "설명" },
  ];
  private static readonly QUICK_TAB_VISIBLE_NAME_PREFIXES: string[] = [
    "Settings UI language",
    "Provider",
    "Ollama base URL",
    "Q&A Ollama base URL",
    "LM Studio base URL",
    "OpenAI base URL",
    "Quick model pickers",
    "Local AI readiness",
  ];
  private static readonly ANALYZED_TAB_VISIBLE_NAME_PREFIXES: string[] = [
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
    "Auto-pick recommended embedding model",
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
    "MOC file path",
  ];
  private static readonly MODELS_TAB_VISIBLE_NAME_PREFIXES: string[] = [
    "Ollama detected model picker",
    "Ollama model (manual)",
    "Auto-pick recommended Ollama model",
    "Ollama detection summary",
    "LM Studio model",
    "LM Studio API key (optional)",
    "OpenAI model",
    "OpenAI API key",
    "Anthropic model",
    "Anthropic API key",
    "Gemini model",
    "Gemini API key",
  ];
  private static readonly CHAT_TAB_VISIBLE_NAME_PREFIXES: string[] = [
    "Conversation mode (chat runtime)",
    "One-click local presets",
    "Quick custom profile slots",
    "Prefer Ollama /api/chat (with fallback)",
    "Q&A retrieval top-k",
    "Q&A max context chars",
    "Structured answer guard",
    "Always detailed answers",
    "Minimum answer chars",
    "Preferred response language",
    "Role preset",
    "Q&A pipeline preset",
    "Role model detection controls",
    "Role model detection summary",
    "Auto-pick recommended role models",
    "Apply role recommendations now",
    "Role recommendation summary",
    "Ask model (text)",
    "Ask model (vision)",
    "Image generator model",
    "Coder model",
    "Architect model",
    "Orchestrator model",
    "Safeguard model",
    "Pro preset base model",
    "Pro preset vision model",
    "Pro preset embedding model",
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
    "Agent path allowlist (absolute, comma/newline)",
  ];
  private static readonly ADVANCED_TAB_VISIBLE_NAME_PREFIXES: string[] = [
    "Allow non-local Q&A endpoint (danger)",
    "Allowed outbound hosts (non-local Q&A)",
    "Custom system prompt",
    "Role system prompt editor",
    "Preset override warning summary",
    "Agent role model health check",
    "Include selection inventory",
    "Inventory max files",
  ];
  private static readonly SIMPLE_HIDDEN_SECTION_TITLES = new Set<string>([
    "Cloud provider config",
    "Semantic linking (Ollama embeddings)",
    "Property cleanup",
    "Selection and backup",
    "MOC",
  ]);
  private static readonly SIMPLE_VISIBLE_NAME_PREFIXES: string[] = [
    "Settings UI language",
    "Plugin mission",
    "Quick one-click setup",
    "Conversation mode (chat runtime)",
    "One-click local presets",
    "Local AI readiness",
    "Open preset guide",
  ];
  private static readonly SIMPLE_HIDDEN_NAME_KEYWORDS: string[] = [
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
    "Inventory max files",
  ];

  constructor(app: App, plugin: KnowledgeWeaverPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private formatDetectedModelLabel(option: OllamaModelOption): string {
    const suffix =
      option.status === "recommended"
        ? " (추천)"
        : option.status === "unavailable"
          ? " (불가)"
          : "";
    return `${option.model}${suffix}`;
  }

  private addRoleModelPickerSetting(
    containerEl: HTMLElement,
    config: RoleModelSettingConfig,
    roleOptions: OllamaModelOption[],
  ): void {
    const currentValue = this.plugin.settings[config.key].trim();
    const compatibleOptions = roleOptions.filter((option) => option.status !== "unavailable");
    const hasCompatible = compatibleOptions.length > 0;
    const currentUnavailable =
      currentValue.length > 0 &&
      !roleOptions.some((option) => option.model === currentValue && option.status !== "unavailable");
    const setting = new Setting(containerEl)
      .setName(config.name)
      .setDesc(
        hasCompatible
          ? currentUnavailable
            ? `${config.description}\n⚠ 현재 선택 모델 '${currentValue}'은(는) 이 역할에서 불가입니다. 폴백 또는 권장 모델로 변경하세요.`
            : config.description
          : `${config.description}\n⚠ 현재 감지된 호환 모델이 없어 이 역할은 실행 불가 상태입니다.`,
      )
      .addDropdown((dropdown) => {
        dropdown.addOption(
          ROLE_MODEL_FALLBACK_VALUE,
          "Use Q&A model fallback / Q&A 모델 폴백",
        );
        for (const option of compatibleOptions) {
          dropdown.addOption(option.model, this.formatDetectedModelLabel(option));
        }

        const selected = currentValue && compatibleOptions.some((option) => option.model === currentValue)
          ? currentValue
          : ROLE_MODEL_FALLBACK_VALUE;
        dropdown.setValue(selected);

        dropdown.onChange(async (value) => {
          const chosen = roleOptions.find((option) => option.model === value);
          if (chosen?.status === "unavailable") {
            new Notice(`Selected model is marked as (불가): ${value}`, 4500);
            this.display();
            return;
          }
          this.plugin.settings[config.key] =
            value === ROLE_MODEL_FALLBACK_VALUE ? "" : value;
          await this.plugin.saveSettings();

          this.display();
        });
        if (!hasCompatible) {
          dropdown.setDisabled(true);
        }
      });
    if (!hasCompatible) {
      setting.settingEl.addClass("auto-linker-setting-unavailable-model");
      const link =
        config.role === "ask_vision" || config.role === "image_generator"
          ? "https://ollama.com/library/qwen2.5vl"
          : "https://ollama.com/library/qwen3";
      setting
        .addButton((button) =>
          button.setButtonText("추천 모델 링크").onClick(() => {
            window.open(link);
          }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("alert-triangle")
            .setTooltip("감지된 호환 모델이 없어 해당 역할을 사용할 수 없습니다."),
        );
    }
  }

  private getPresetModelAvailabilityInfo(
    kind: PresetProfileModelKind,
    modelName: string,
    presetHint?: "balanced_local" | "quality_local",
  ): {
    available: boolean;
    note: string;
    recommended: string;
    link: string;
    detectedCount: number;
  } {
    const current = modelName.trim();
    if (kind === "embedding") {
      const options = this.plugin.getEmbeddingModelOptions();
      const detected = options.map((option) => option.model);
      const recommended =
        options.find((option) => option.status === "recommended")?.model ?? "";
      const available = !current || detected.includes(current);
      if (!current) {
        return {
          available: true,
          note: `현재 비어 있음. 권장 임베딩 모델: ${recommended || "(none / 없음)"}`,
          recommended,
          link: "https://ollama.com/library/nomic-embed-text",
          detectedCount: detected.length,
        };
      }
      return {
        available,
        note: available
          ? `현재 모델 감지됨: ${current}`
          : `⚠ 현재 모델 '${current}'이(가) 감지 목록에 없습니다. 실행 시 폴백/성능 저하가 발생할 수 있습니다.`,
        recommended,
        link: "https://ollama.com/library/nomic-embed-text",
        detectedCount: detected.length,
      };
    }

    const options = this.plugin.getOllamaModelOptions();
    const filtered =
      kind === "vision"
        ? options.filter((option) => VISION_MODEL_REGEX.test(option.model.toLowerCase()))
        : options;
    const detected = filtered.map((option) => option.model);
    const recommendedFromPreset = presetHint
      ? this.plugin.getRecommendedPresetOverrideModelForQa(presetHint, kind)
      : "";
    const recommended = recommendedFromPreset
      || (
        kind === "vision"
          ? (
            filtered.find((option) => option.status === "recommended")?.model
            || filtered.find((option) => option.status === "available")?.model
            || ""
          )
          : (
            filtered.find((option) => option.status === "recommended")?.model
            || options.find((option) => option.status === "recommended")?.model
            || ""
          )
      );
    const available = !current || detected.includes(current);
    const link =
      kind === "vision"
        ? "https://ollama.com/library/qwen2.5vl"
        : "https://ollama.com/library/qwen3";
    if (kind === "vision" && detected.length === 0) {
      return {
        available: false,
        note:
          "⚠ 감지된 비전 모델이 없습니다. Ask(vision) 역할 및 이미지/PDF 기반 처리는 현재 활용 불가입니다.",
        recommended: "",
        link,
        detectedCount: 0,
      };
    }
    if (!current) {
      return {
        available: true,
        note: `현재 비어 있음. 권장 모델: ${recommended || "(none / 없음)"}`,
        recommended,
        link,
        detectedCount: detected.length,
      };
    }
    return {
      available,
      note: available
        ? `현재 모델 감지됨: ${current}`
        : `⚠ 현재 모델 '${current}'이(가) 감지 목록에 없습니다. 실행 시 폴백/성능 저하가 발생할 수 있습니다.`,
      recommended,
      link,
      detectedCount: detected.length,
    };
  }

  private addPresetProfileModelSetting(
    containerEl: HTMLElement,
    config: {
      name: string;
      description: string;
      key: PresetProfileModelSettingKey;
      kind: PresetProfileModelKind;
      placeholder: string;
      preset: "balanced_local" | "quality_local";
    },
  ): void {
    const current = this.plugin.settings[config.key].trim();
    const availability = this.getPresetModelAvailabilityInfo(config.kind, current, config.preset);
    const showModelGuideLink =
      !availability.available || !availability.recommended || availability.detectedCount === 0;
    const setting = new Setting(containerEl)
      .setName(config.name)
      .setDesc(`${config.description}\n${availability.note}`)
      .addText((text) =>
        text
          .setPlaceholder(config.placeholder)
          .setValue(current)
          .onChange(async (value) => {
            this.plugin.settings[config.key] = value.trim();
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    if (showModelGuideLink) {
      setting.addButton((button) =>
        button.setButtonText("추천 모델 링크").onClick(async () => {
          window.open(availability.link);
        }),
      );
    }
    if (availability.recommended) {
      setting.addButton((button) =>
        button.setButtonText("권장값").onClick(async () => {
          this.plugin.settings[config.key] = availability.recommended;
          await this.plugin.saveSettings();
          this.display();
        }),
      );
    }
    if (!availability.available || (config.kind === "vision" && availability.detectedCount === 0)) {
      setting.settingEl.addClass("auto-linker-setting-unavailable-model");
      setting.addExtraButton((button) =>
        button
          .setIcon("alert-triangle")
          .setTooltip(
            config.kind === "vision" && availability.detectedCount === 0
              ? "비전 모델이 감지되지 않아 해당 프리셋 비전 경로를 사용할 수 없습니다."
              : "감지되지 않은 모델입니다. 설치/이름 확인이 필요합니다.",
          ),
      );
    }
  }

  private collectPresetOverrideWarnings(): Array<{ name: string; note: string; link: string }> {
    const checks: Array<{
      name: string;
      key: PresetProfileModelSettingKey;
      kind: PresetProfileModelKind;
    }> = [
      { name: "Pro base", key: "qaBalancedPresetBaseModel", kind: "text" },
      { name: "Pro vision", key: "qaBalancedPresetVisionModel", kind: "vision" },
      { name: "Pro embedding", key: "qaBalancedPresetEmbeddingModel", kind: "embedding" },
    ];
    const warnings: Array<{ name: string; note: string; link: string }> = [];
    for (const check of checks) {
      const value = this.plugin.settings[check.key].trim();
      if (!value) {
        continue;
      }
      const availability = this.getPresetModelAvailabilityInfo(
        check.kind,
        value,
        "balanced_local",
      );
      if (!availability.available) {
        warnings.push({
          name: check.name,
          note: availability.note,
          link: availability.link,
        });
      }
    }
    return warnings;
  }

  private getRoleModelHealthSummary(): {
    unavailable: string[];
    blockedRoles: string[];
    summary: string;
  } {
    const unavailable: string[] = [];
    const blockedRoles: string[] = [];
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
    const parts: string[] = [];
    if (blockedRoles.length > 0) {
      parts.push(`활용 불가 역할 ${blockedRoles.length}개: ${blockedRoles.join(", ")}`);
    }
    if (unavailable.length > 0) {
      parts.push(`불가 매핑 ${unavailable.length}개: ${unavailable.join(", ")}`);
    }
    if (parts.length === 0) {
      parts.push("역할 모델 매핑 상태 정상(불가 항목 없음).");
    }
    return { unavailable, blockedRoles, summary: parts.join(" | ") };
  }

  private getVaultFolderOptionsForShellCwd(): string[] {
    const seen = new Set<string>();
    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter((entry): entry is TFolder => entry instanceof TFolder)
      .map((folder) => normalizePath(folder.path))
      .filter((path) => path.length > 0 && path !== "/")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const unique: string[] = [];
    for (const folderPath of folders) {
      if (seen.has(folderPath)) {
        continue;
      }
      seen.add(folderPath);
      unique.push(folderPath);
    }
    return unique;
  }

  private splitGuideLines(rawText: string): string[] {
    return (rawText ?? "")
      .split(/\n|\|/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private addViewModeAndPresetControls(containerEl: HTMLElement): void {
    const quickModelSetting = new Setting(containerEl)
      .setName("Quick model pickers")
      .setDesc("감지된 Ollama/임베딩 모델을 빠르게 선택합니다.")
      .addDropdown((dropdown) => {
        const options = this.plugin.getOllamaModelOptions();
        const current = this.plugin.settings.qaOllamaModel.trim() || this.plugin.settings.ollamaModel.trim();
        dropdown.addOption("", "Ollama 텍스트 모델(감지값 선택)");
        for (const option of options) {
          dropdown.addOption(option.model, this.formatDetectedModelLabel(option));
        }
        dropdown.setValue(current);
        dropdown.onChange(async (value) => {
          const model = value.trim();
          this.plugin.settings.ollamaModel = model;
          await this.plugin.setQaModelOverrideForQa(model);
          await this.plugin.saveSettings();
          this.display();
        });
      })
      .addDropdown((dropdown) => {
        const options = this.plugin.getEmbeddingModelOptions()
          .filter((option) => option.status !== "unavailable");
        const current = this.plugin.settings.semanticOllamaModel.trim();
        dropdown.addOption("", "Embedding 모델(감지값 선택)");
        for (const option of options) {
          const suffix = option.status === "recommended" ? " (추천)" : "";
          dropdown.addOption(option.model, `${option.model}${suffix}`);
        }
        dropdown.setValue(current);
        dropdown.onChange(async (value) => {
          this.plugin.settings.semanticOllamaModel = value.trim();
          await this.plugin.saveSettings();
          this.display();
        });
      });
    quickModelSetting.settingEl.addClass("auto-linker-settings-quick");

    const detectedModels = this.plugin.getOllamaModelOptions();
    const localReadySummary =
      detectedModels.length > 0
        ? `Detected ${detectedModels.length} local model(s).`
        : "No local Ollama model detected yet. Start Ollama and pull models.";
    const readinessSetting = new Setting(containerEl)
      .setName("Local AI readiness")
      .setDesc(localReadySummary)
      .addButton((button) =>
        button.setButtonText("Refresh").onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
          await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("컴퓨터 사양 보기").onClick(async () => {
          new Notice(this.plugin.getHardwareCapabilitySummaryForQa(), 7000);
        }),
      );
    readinessSetting.settingEl.addClass("auto-linker-settings-quick");
  }

  private addChatPresetControls(containerEl: HTMLElement): void {
    const applyPreset = async (
      preset: "fast_local" | "balanced_local",
    ): Promise<void> => {
      const summary = await this.plugin.applyOneClickLocalPresetForQa(preset);
      new Notice(summary, 6500);
      this.display();
    };
    new Setting(containerEl)
      .setName("One-click local presets")
      .setDesc("Flash/Pro presets with automatic local model detection and role assignment.")
      .addButton((button) =>
        button.setButtonText("Flash").onClick(async () => {
          await applyPreset("fast_local");
        }),
      )
      .addButton((button) =>
        button.setButtonText("Pro").setCta().onClick(async () => {
          await applyPreset("balanced_local");
        }),
      );

    for (const slot of QA_QUICK_CUSTOM_SLOT_CONFIGS) {
      new Setting(containerEl)
        .setName(`Quick custom profile slots · ${slot.label}`)
        .setDesc(this.plugin.getQaQuickCustomProfileSlotSummary(slot.key))
        .addButton((button) =>
          button.setButtonText("현재값 저장").onClick(async () => {
            const summary = await this.plugin.saveQaQuickCustomProfileSlot(
              slot.key,
              `${slot.label} (${new Date().toLocaleString()})`,
            );
            new Notice(summary, 6000);
            this.display();
          }),
        )
        .addButton((button) =>
          button.setButtonText("적용").setCta().onClick(async () => {
            try {
              const summary = await this.plugin.applyQaQuickCustomProfileSlot(slot.key);
              new Notice(summary, 6000);
              this.display();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "커스텀 프로필을 적용할 수 없습니다.";
              new Notice(message, 6000);
            }
          }),
        );
    }
  }

  private addSettingsTabSwitcher(containerEl: HTMLElement): void {
    const row = containerEl.createDiv({ cls: "auto-linker-settings-tab-row" });
    const mode = this.plugin.settings.settingsUiLanguage;
    for (const tab of KnowledgeWeaverSettingTab.TAB_OPTIONS) {
      const label =
        mode === "en" ? tab.en : mode === "ko" ? tab.ko : `${tab.en} / ${tab.ko}`;
      const button = row.createEl("button", { text: label });
      button.addClass("auto-linker-settings-tab-btn");
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

  private addSettingsLanguageControl(containerEl: HTMLElement): void {
    const languageSetting = new Setting(containerEl)
      .setName("Settings UI language")
      .setDesc("Choose language style used in setting labels/descriptions across all tabs.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ko", "[KO] 한국어")
          .addOption("en", "[EN] English")
          .addOption("bilingual", "[KO/EN] Bilingual")
          .setValue(this.plugin.settings.settingsUiLanguage)
          .onChange(async (value) => {
            const next = value === "en" || value === "bilingual" ? value : "ko";
            this.plugin.settings.settingsUiLanguage = next;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    languageSetting.settingEl.addClass("auto-linker-settings-quick");
  }

  private isSectionVisibleForTab(sectionTitle: string, tab: SettingsPanelTab): boolean {
    if (tab === "advanced") {
      return true;
    }
    if (tab === "guide") {
      return false;
    }
    switch (tab) {
      case "quick":
        return (
          sectionTitle === "__prelude" ||
          sectionTitle === "Local provider config" ||
          sectionTitle === "Cloud provider config" ||
          sectionTitle === "Local Q&A (security-first) / 로컬 Q&A (보안 우선)"
        );
      case "analyzed":
        return (
          sectionTitle === "Behavior" ||
          sectionTitle === "Semantic linking (Ollama embeddings)" ||
          sectionTitle === "Property cleanup" ||
          sectionTitle === "Selection and backup" ||
          sectionTitle === "MOC"
        );
      case "models":
        return (
          sectionTitle === "__prelude" ||
          sectionTitle === "Local provider config" ||
          sectionTitle === "Cloud provider config" ||
          sectionTitle === "Local Q&A (security-first) / 로컬 Q&A (보안 우선)"
        );
      case "chat":
        return (
          sectionTitle === "__prelude" ||
          sectionTitle === "Behavior" ||
          sectionTitle === "Local Q&A (security-first) / 로컬 Q&A (보안 우선)"
        );
      default:
        return true;
    }
  }

  private settingNameStartsWithPrefixes(name: string, prefixes: readonly string[]): boolean {
    return prefixes.some((prefix) =>
      name.startsWith(prefix)
    );
  }

  private isSettingVisibleForTab(name: string, tab: SettingsPanelTab): boolean {
    if (name.startsWith("Settings UI language")) {
      return true;
    }
    switch (tab) {
      case "quick":
        return this.settingNameStartsWithPrefixes(
          name,
          KnowledgeWeaverSettingTab.QUICK_TAB_VISIBLE_NAME_PREFIXES,
        );
      case "analyzed":
        return this.settingNameStartsWithPrefixes(
          name,
          KnowledgeWeaverSettingTab.ANALYZED_TAB_VISIBLE_NAME_PREFIXES,
        );
      case "models":
        return this.settingNameStartsWithPrefixes(
          name,
          KnowledgeWeaverSettingTab.MODELS_TAB_VISIBLE_NAME_PREFIXES,
        );
      case "chat":
        return this.settingNameStartsWithPrefixes(
          name,
          KnowledgeWeaverSettingTab.CHAT_TAB_VISIBLE_NAME_PREFIXES,
        );
      case "advanced":
        return this.settingNameStartsWithPrefixes(
          name,
          KnowledgeWeaverSettingTab.ADVANCED_TAB_VISIBLE_NAME_PREFIXES,
        );
      case "orchestration":
      case "skills":
      case "parser":
      case "guide":
        return false;
      default:
        return true;
    }
  }

  private applySettingsTabVisibility(containerEl: HTMLElement): void {
    const activeTab = this.plugin.settings.settingsActiveTab;
    if (activeTab === "guide") {
      return;
    }

    let currentSection = "__prelude";
    for (const child of Array.from(containerEl.children)) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      if (
        child.tagName === "H2" ||
        child.classList.contains("auto-linker-settings-tab-row") ||
        child.classList.contains("auto-linker-settings-mode-note")
      ) {
        continue;
      }
      if (child.tagName === "P" && !child.classList.contains("setting-item")) {
        continue;
      }

      if (child.tagName === "H3") {
        currentSection = (child.textContent ?? "").trim();
        const visible = this.isSectionVisibleForTab(currentSection, activeTab);
        child.classList.toggle("auto-linker-hidden-tab", !visible);
        continue;
      }

      let shouldHide = !this.isSectionVisibleForTab(currentSection, activeTab);
      if (!shouldHide && child.classList.contains("setting-item")) {
        const name = child.querySelector<HTMLElement>(".setting-item-name")?.textContent?.trim() ?? "";
        if (name && !this.isSettingVisibleForTab(name, activeTab)) {
          shouldHide = true;
        }
      } else if (shouldHide && child.classList.contains("setting-item")) {
        const name = child.querySelector<HTMLElement>(".setting-item-name")?.textContent?.trim() ?? "";
        if (name.startsWith("Settings UI language")) {
          shouldHide = false;
        }
      }

      if (shouldHide) {
        child.classList.add("auto-linker-hidden-tab");
      }
    }
  }

  private hideEmptySettingSections(containerEl: HTMLElement): void {
    const children = Array.from(containerEl.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
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
        if (
          !candidate.classList.contains("auto-linker-hidden-tab") &&
          !candidate.classList.contains("auto-linker-hidden-simple")
        ) {
          hasVisibleSetting = true;
          break;
        }
      }
      child.classList.toggle("auto-linker-hidden-tab", !hasVisibleSetting);
    }
  }

  private isSimpleEssentialSettingName(name: string): boolean {
    return KnowledgeWeaverSettingTab.SIMPLE_VISIBLE_NAME_PREFIXES.some((prefix) =>
      name.startsWith(prefix)
    );
  }

  private applyCompactSettingsVisibility(containerEl: HTMLElement): void {
    if (this.plugin.settings.settingsViewMode !== "simple") {
      return;
    }
    if (this.plugin.settings.settingsActiveTab !== "quick") {
      return;
    }

    let hideSection = false;
    for (const child of Array.from(containerEl.children)) {
      if (child.tagName === "H3") {
        const title = (child.textContent ?? "").trim();
        hideSection = KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_SECTION_TITLES.has(title);
        child.toggleClass("auto-linker-hidden-simple", hideSection);
        continue;
      }
      if (hideSection) {
        child.classList.add("auto-linker-hidden-simple");
      }
    }

    const items = containerEl.querySelectorAll<HTMLElement>(".setting-item");
    for (const item of Array.from(items)) {
      const name = item.querySelector<HTMLElement>(".setting-item-name")?.textContent?.trim() ?? "";
      if (!name) {
        continue;
      }
      const hiddenByKeyword = KnowledgeWeaverSettingTab.SIMPLE_HIDDEN_NAME_KEYWORDS.some(
        (keyword) => name.includes(keyword),
      );
      const hiddenByNonEssential = !this.isSimpleEssentialSettingName(name);
      const shouldHide = hiddenByKeyword || hiddenByNonEssential;
      if (shouldHide) {
        item.classList.add("auto-linker-hidden-simple");
      }
    }
  }

  private renderGuideTab(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Quick preset guide / 빠른 설정 가이드" });
    containerEl.createEl("p", {
      text: [
        "One-click presets detect local models first.",
        "Then they auto-assign base/role/embedding models by preset + hardware capability.",
      ].join("\n"),
      cls: "auto-linker-settings-guide-note auto-linker-settings-guide-preline",
    });

    const detectedModels = this.plugin.getOllamaModelOptions();
    const hardwareSummary = this.plugin.getHardwareCapabilitySummaryForQa();
    const readiness = containerEl.createDiv({ cls: "auto-linker-settings-guide-card" });
    readiness.createEl("strong", {
      text:
        detectedModels.length > 0
          ? `Local AI ready: ${detectedModels.length} model(s) detected`
          : "Local AI not ready: no Ollama model detected",
    });
    const readinessLines = detectedModels.length > 0
      ? this.splitGuideLines(this.plugin.getOllamaDetectionSummary())
      : [
          "Install/start Ollama.",
          "Pull at least one text model + one vision model + one embedding model.",
        ];
    const hardwareLines = this.splitGuideLines(hardwareSummary);
    const readinessList = readiness.createEl("ul", {
      cls: "auto-linker-settings-guide-list auto-linker-settings-guide-card-list",
    });
    for (const line of [...readinessLines, ...hardwareLines]) {
      readinessList.createEl("li", { text: line });
    }

    containerEl.createEl("h3", { text: "When to use each preset / 프리셋 선택 기준" });
    const presetList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    presetList.createEl("li", {
      text: "Flash: 문서 1~20개 기반 빠른 조회/요약. Role/Pipeline을 경량 고정해 지연을 최소화합니다.",
    });
    presetList.createEl("li", {
      text: "Pro: 수십~수백개 문서 분석/인사이트/초안 작성. Orchestrator/Safeguard 중심으로 품질과 속도를 균형화합니다.",
    });
    presetList.createEl("li", {
      text: "로컬 모델이 감지되지 않으면 프리셋은 보안/동작 기본값만 적용하고 기존 Provider를 유지합니다.",
    });

    containerEl.createEl("h3", { text: "Chat shortcut reference / 채팅 단축키 안내" });
    const shortcutList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    shortcutList.createEl("li", {
      text: "Enter: 전송",
    });
    shortcutList.createEl("li", {
      text: "Shift+Enter: 줄바꿈",
    });
    shortcutList.createEl("li", {
      text: "Ctrl/Cmd+V: 이미지/텍스트/PDF 첨부 붙여넣기",
    });
    shortcutList.createEl("li", {
      text: "중지 버튼(Stop): 스트리밍/리트리벌/후처리 즉시 중단",
    });

    containerEl.createEl("h3", { text: "Agent external-path policy / 에이전트 외부 경로 정책" });
    const securityGuideList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    securityGuideList.createEl("li", {
      text: "기본값은 보수적(vault 범위)입니다. 외부 절대경로 접근은 allowlist 또는 full access 조건에서만 허용됩니다.",
    });
    securityGuideList.createEl("li", {
      text: "full access를 켜기 전에는 allowlist 경로를 먼저 지정하고, 필요한 최소 범위만 등록하세요.",
    });
    securityGuideList.createEl("li", {
      text: "시스템 프롬프트에 '외부 경로 접근 시 반드시 허용 경로/승인 조건/로그 기록' 규칙을 명시하면 정책 충돌을 줄일 수 있습니다.",
    });
    securityGuideList.createEl("li", {
      text: "상세 정책은 README의 보안 주의사항 섹션을 참고하세요.",
    });

    containerEl.createEl("h3", { text: "PDF parsing notes / PDF 파싱 고려사항" });
    const pdfGuideList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    pdfGuideList.createEl("li", {
      text: "PDF는 pdftotext -> OCR(tesseract/pdftoppm) -> fallback 체인으로 본문 추출을 시도합니다.",
    });
    pdfGuideList.createEl("li", {
      text: "이미지 첨부도 OCR 파서를 통해 텍스트를 보강합니다. 단, 표/수식/스캔은 오인식 가능성이 있어 핵심 구간 텍스트 발췌를 함께 첨부하세요.",
    });
    pdfGuideList.createEl("li", {
      text: "출처 정확성이 중요한 작업(평가계획/법적 문서)은 PDF 원문 페이지 번호를 함께 요구하도록 프롬프트를 고정하세요.",
    });
    pdfGuideList.createEl("li", {
      text: "상세 운영 팁은 README의 문제 해결 섹션을 참고하세요.",
    });

    containerEl.createEl("h3", { text: "Reference models by tier / 티어별 참고 모델" });
    const modelList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    modelList.createEl("li", {
      text: "Flash tier text: qwen3:8b / llama3.1:8b / gemma3:4b",
    });
    modelList.createEl("li", {
      text: "Pro tier text: qwen3:14b / gpt-oss:20b / qwen3:30b (환경 의존)",
    });
    modelList.createEl("li", {
      text: "Vision: qwen2.5vl 계열, llava 계열",
    });
    modelList.createEl("li", {
      text: "Embedding: nomic-embed-text, bge-m3, mxbai-embed-large, e5/gte 계열",
    });

    containerEl.createEl("pre", {
      cls: "auto-linker-settings-guide-code",
      text: [
        "ollama pull qwen3:8b",
        "ollama pull qwen3:14b",
        "ollama pull qwen2.5vl:7b",
        "ollama pull nomic-embed-text",
      ].join("\n"),
    });

    containerEl.createEl("h3", { text: "Official references / 공식 참고" });
    const refList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    const references = [
      "https://ollama.com/library/qwen3",
      "https://ollama.com/library/qwen2.5vl",
      "https://ollama.com/library/nomic-embed-text",
      "https://docs.ollama.com/api/chat",
      "https://docs.ollama.com/api/generate",
    ];
    for (const url of references) {
      const item = refList.createEl("li");
      item.createEl("a", { text: url, href: url });
    }

    containerEl.createEl("h3", { text: "Preset warning snapshot / 프리셋 경고 스냅샷" });
    const warningList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    const warnings = this.collectPresetOverrideWarnings();
    if (warnings.length === 0) {
      warningList.createEl("li", { text: "현재 프리셋 오버라이드 경고(⚠) 없음" });
    } else {
      for (const warning of warnings) {
        warningList.createEl("li", {
          text: `${warning.name}: ${warning.note}`,
        });
      }
    }
    warningList.createEl("li", {
      text: "릴리즈 전에는 경고(⚠)가 붙은 프리셋 오버라이드 필드를 우선 확인하세요.",
    });
    warningList.createEl("li", {
      text: "프리셋 기본값은 Settings > Quick/Models 탭의 현재 표시값을 기준으로 검토하세요.",
    });

    new Setting(containerEl)
      .setName("Guide actions")
      .setDesc("Refresh local detection or return to Quick tab.")
      .addButton((button) =>
        button.setButtonText("Refresh detection").setCta().onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
          await this.plugin.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Go Quick").onClick(async () => {
          this.plugin.settings.settingsActiveTab = "quick";
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }

  private renderOrchestrationTab(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Orchestration controls / 오케스트레이션 제어" });
    containerEl.createEl("p", {
      cls: "auto-linker-settings-guide-note",
      text: "내부 문서 보호를 우선하며, 외부 연결은 allowlist 기반으로 제한된 상태에서만 실행하세요.",
    });

    new Setting(containerEl)
      .setName("Conversation mode (chat runtime)")
      .setDesc("오케스트레이션 중심으로 모드를 고정하고 파이프라인 기본값을 맞춥니다.")
      .addButton((button) =>
        button.setButtonText("Orchestration 모드 적용").setCta().onClick(async () => {
          await this.plugin.setQaConversationModeForQa("orchestration");
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Allowed outbound hosts (non-local Q&A)")
      .setDesc("오케스트레이션에서 외부 엔드포인트를 쓸 때 허용 호스트를 명시합니다.")
      .addTextArea((area) =>
        area
          .setPlaceholder("api.openai.com\napi.anthropic.com")
          .setValue(this.plugin.settings.qaAllowedOutboundHosts)
          .onChange(async (value) => {
            this.plugin.settings.qaAllowedOutboundHosts = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private renderSkillsTab(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Skills manager (beta) / 스킬 관리(베타)" });
    containerEl.createEl("p", {
      cls: "auto-linker-settings-guide-note",
      text: "오케스트레이션으로 생성한 스킬 문서를 내부/외부 경로에서 관리하기 위한 준비 탭입니다.",
    });

    new Setting(containerEl)
      .setName("Agent path allowlist (absolute, comma/newline)")
      .setDesc("Skills 로딩/실행에 허용할 절대경로를 관리합니다.")
      .addTextArea((area) =>
        area
          .setPlaceholder("/absolute/path/project\n/absolute/path/project/skills")
          .setValue(this.plugin.settings.qaAgentPathAllowlist)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentPathAllowlist = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private renderParserTab(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Parser pipeline / 파서 파이프라인" });
    containerEl.createEl("p", {
      cls: "auto-linker-settings-guide-note",
      text: "PDF/이미지 파서를 중심으로 첨부 컨텍스트 품질을 높입니다. excel/hwp는 현재 미리보기 수준이며 추후 확장됩니다.",
    });

    new Setting(containerEl)
      .setName("Parser mode")
      .setDesc("Fast는 경량 파서, Detailed는 OCR 페이지 확장과 긴 텍스트 추출을 사용합니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("fast", "Fast / 빠른 파서")
          .addOption("detailed", "Detailed / 상세 파서")
          .setValue(this.plugin.settings.qaParserMode)
          .onChange(async (value) => {
            this.plugin.settings.qaParserMode = value === "detailed" ? "detailed" : "fast";
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName("PDF attachments in chat")
      .setDesc("기본 ON입니다. PDF는 pdftotext -> OCR -> fallback 체인으로 자동 처리됩니다.");

    new Setting(containerEl)
      .setName("Parser tool readiness")
      .setDesc(this.plugin.getParserToolReadinessSummaryForQa())
      .addButton((button) =>
        button.setButtonText("Refresh / 점검").onClick(async () => {
          await this.plugin.refreshParserToolReadinessForQa(true);
          this.display();
        }),
      );

    const parserList = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    parserList.createEl("li", {
      text: "PDF: pdftotext(텍스트 추출) + pdftoppm/tesseract(OCR) + fallback",
    });
    parserList.createEl("li", {
      text: "Image: tesseract OCR + 원본 이미지 컨텍스트",
    });
    parserList.createEl("li", {
      text: "Excel/HWP: 현재 기본 미지원(텍스트 변환본 첨부 권장)",
    });
    for (const line of this.plugin.getParserToolReadinessLinesForQa()) {
      parserList.createEl("li", { text: line });
    }

    new Setting(containerEl)
      .setName("Attachment ingest folder path")
      .setDesc("외부 첨부를 vault 내부로 미러링할 경로입니다.")
      .addText((text) =>
        text
          .setPlaceholder("Auto Link Ingest")
          .setValue(this.plugin.settings.qaAttachmentIngestRootPath)
          .onChange(async (value) => {
            this.plugin.settings.qaAttachmentIngestRootPath = normalizePath(
              value.trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath,
            );
            await this.plugin.saveSettings();
          }),
      );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-linker-settings-tab");
    this.addSettingsLanguageControl(containerEl);
    const uiMode = this.plugin.settings.settingsUiLanguage;
    containerEl.createEl("h2", {
      text:
        uiMode === "en"
          ? "Auto Link Settings"
          : uiMode === "ko"
            ? "Auto Link 설정"
            : "Auto Link Settings / Auto Link 설정",
    });

    containerEl.createEl("p", {
      text:
        uiMode === "en"
          ? "Language docs: README.md (EN) | README_KO.md (KO)"
          : uiMode === "ko"
            ? "언어 문서: README.md (EN) | README_KO.md (KO)"
            : "Language docs / 언어 문서: README.md (EN) | README_KO.md (KO)",
    });
    this.addSettingsTabSwitcher(containerEl);
    const activeTab = this.plugin.settings.settingsActiveTab;
    if (activeTab === "quick") {
      this.addViewModeAndPresetControls(containerEl);
    }
    if (activeTab === "chat") {
      this.addChatPresetControls(containerEl);
    }
    if (activeTab === "orchestration") {
      this.renderOrchestrationTab(containerEl);
      this.applyBilingualSettingsLabels(containerEl);
      return;
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

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Choose AI provider. Local providers are recommended first.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ollama", "Ollama (local / 로컬)")
          .addOption("lmstudio", "LM Studio (local / 로컬)")
          .addOption("openai", "OpenAI / Codex")
          .addOption("anthropic", "Claude / 클로드")
          .addOption("gemini", "Gemini / 제미나이")
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
            new Notice(`Selected model is marked as (불가): ${value}`, 4500);
            this.display();
            return;
          }

          this.plugin.settings.ollamaModel = value;
          await this.plugin.saveSettings();
          this.display();
        });
      })
      .addButton((button) =>
        button.setButtonText("Refresh / 새로고침").onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Use recommended / 권장값 사용").onClick(async () => {
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

    const analyzedDepthMode = (
      this.plugin.settings.semanticLinkingEnabled || !this.plugin.settings.analysisOnlyChangedNotes
    )
      ? "detailed"
      : "quick";
    new Setting(containerEl)
      .setName("Analyzed depth mode")
      .setDesc(
        "Quick: changed-notes 중심 + semantic off. Detailed: semantic on + 전체 범위 기반 분석.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("quick", "Quick / 빠른 분석")
          .addOption("detailed", "Detailed / 상세 분석")
          .setValue(analyzedDepthMode)
          .onChange(async (value) => {
            const quickMode = value === "quick";
            this.plugin.settings.analysisOnlyChangedNotes = quickMode;
            this.plugin.settings.semanticLinkingEnabled = !quickMode;
            this.plugin.settings.includeReasons = !quickMode;
            this.plugin.settings.qaTopK = quickMode
              ? Math.min(this.plugin.settings.qaTopK, 4)
              : Math.max(this.plugin.settings.qaTopK, 6);
            this.plugin.settings.semanticTopK = quickMode
              ? Math.min(this.plugin.settings.semanticTopK, 16)
              : Math.max(this.plugin.settings.semanticTopK, 28);
            this.plugin.settings.qaAlwaysDetailedAnswer = !quickMode;
            this.plugin.settings.qaMaxContextChars = quickMode
              ? Math.min(this.plugin.settings.qaMaxContextChars, 12000)
              : Math.max(this.plugin.settings.qaMaxContextChars, 18000);
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    const analyzedSelectedFiles = this.plugin.getSelectedFilesForQa().length;
    const analyzedEmbeddingModel = this.plugin.settings.semanticOllamaModel.trim() || "(none)";
    const analyzedQuickSec = Math.max(1, analyzedSelectedFiles) * 0.45;
    const analyzedDetailedSec = Math.max(1, analyzedSelectedFiles) * 1.15;
    new Setting(containerEl)
      .setName("Analyzed runtime estimate")
      .setDesc(
        [
          `선택 파일: ${analyzedSelectedFiles}개`,
          `임베딩 모델: ${analyzedEmbeddingModel}`,
          `Quick 예상: 약 ${analyzedQuickSec.toFixed(1)}초 + 모델 응답 시간`,
          `Detailed 예상: 약 ${analyzedDetailedSec.toFixed(1)}초 + 모델 응답 시간`,
        ].join(" | "),
      );

    new Setting(containerEl)
      .setName("Analyzed scope snapshot")
      .setDesc(this.plugin.getAnalyzedScopeSnapshotSummaryForQa());

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
      .setName("Force all-to-all linked (deterministic)")
      .setDesc(
        "When enabled, linked field includes all selected notes for each note (except self). maxLinked is ignored in this mode.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.forceAllToAllLinkedEnabled)
          .onChange(async (value) => {
            this.plugin.settings.forceAllToAllLinkedEnabled = value;
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

    new Setting(containerEl)
      .setName("Analyze changed notes only / 변경된 노트만 분석")
      .setDesc(
        "Skip unchanged notes when cache metadata matches. Turn off to include cached notes in every run. / 캐시와 동일하면 스킵합니다.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.analysisOnlyChangedNotes)
          .onChange(async (value) => {
            this.plugin.settings.analysisOnlyChangedNotes = value;
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

    const embeddingOptions = this.plugin.getEmbeddingModelOptions()
      .filter((option) => option.status !== "unavailable");
    new Setting(containerEl)
      .setName("Embedding detected model picker")
      .setDesc(
        "Choose among embedding-capable detected models. (추천)=recommended.",
      )
      .addDropdown((dropdown) => {
        if (embeddingOptions.length === 0) {
          dropdown.addOption("", "(No embedding models detected)");
          dropdown.setValue("");
        } else {
          for (const option of embeddingOptions) {
            const suffix =
              option.status === "recommended"
                ? " (추천)"
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
          this.display();
        });
      })
      .addButton((button) =>
        button.setButtonText("Refresh / 새로고침").onClick(async () => {
          await this.plugin.refreshEmbeddingModelDetection({
            notify: true,
            autoApply: true,
          });
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
      .setDesc(
        "질문과 관련 있을 가능성이 높은 후보 문서를 몇 개까지 볼지 정합니다. 값을 올리면 근거 후보가 늘고, 속도는 느려질 수 있습니다.",
      )
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
      .setDesc(
        "관련도 최소 기준입니다(0.0~1.0). 낮추면 더 많은 문서가 포함되고, 높이면 더 엄격하게 걸러집니다.",
      )
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
      .setDesc(
        "임베딩 전에 각 문서에서 사용할 최대 글자 수입니다. 줄이면 빠르고, 늘리면 문맥 정보가 많아집니다.",
      )
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

    containerEl.createEl("h3", { text: "Local Q&A (security-first) / 로컬 Q&A (보안 우선)" });

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
            await this.plugin.setQaModelOverrideForQa(value.trim());
          }),
      );

    new Setting(containerEl)
      .setName("Prefer Ollama /api/chat (with fallback)")
      .setDesc("Use role-based chat first, then fallback to /api/generate when unavailable.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaPreferChatApi)
          .onChange(async (value) => {
            this.plugin.settings.qaPreferChatApi = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Q&A retrieval top-k / 검색 소스 수")
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
      .setName("Q&A max context chars / 최대 컨텍스트 길이")
      .setDesc("Maximum total note characters to send to local LLM. / 로컬 LLM에 전달할 최대 문자 수")
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
      .setName("Structured answer guard / 구조화 출력 가드")
      .setDesc("Enforce table/checklist/link structure for comparison/plan/source questions. / 표·체크리스트·링크 형식을 강제합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaStructureGuardEnabled)
          .onChange(async (value) => {
            this.plugin.settings.qaStructureGuardEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Always detailed answers / 항상 자세한 답변")
      .setDesc("Prefer long, structured answers unless user explicitly asks for brief output. / 사용자가 짧게 요청하지 않으면 상세 답변을 우선합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAlwaysDetailedAnswer)
          .onChange(async (value) => {
            this.plugin.settings.qaAlwaysDetailedAnswer = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Minimum answer chars / 최소 답변 길이")
      .setDesc("Used by structured guard depth repair. / 구조화 가드의 길이 보정 기준")
      .addText((text) =>
        text
          .setPlaceholder("320")
          .setValue(String(this.plugin.settings.qaMinAnswerChars))
          .onChange(async (value) => {
            this.plugin.settings.qaMinAnswerChars = parsePositiveInt(
              value,
              this.plugin.settings.qaMinAnswerChars,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Preferred response language / 답변 언어 우선")
      .setDesc("Applies to local Q&A prompt. / 로컬 Q&A 프롬프트에 적용")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "Auto / 자동")
          .addOption("korean", "Korean / 한국어")
          .addOption("english", "English / 영어")
          .setValue(this.plugin.settings.qaPreferredResponseLanguage)
          .onChange(async (value) => {
            this.plugin.settings.qaPreferredResponseLanguage = value as
              | "auto"
              | "korean"
              | "english";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Role preset / 역할 프리셋")
      .setDesc("Prompt style preset for local Q&A. / 로컬 Q&A 답변 성향 프리셋")
      .addDropdown((dropdown) => {
        for (const option of QA_ROLE_PRESET_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.plugin.settings.qaRolePreset)
          .onChange(async (value) => {
            await this.plugin.setQaRolePresetForQa(value as QaRolePreset);
          });
      });

    new Setting(containerEl)
      .setName("Q&A pipeline preset")
      .setDesc("Select execution pipeline for post-generation passes. / 답변 후처리 파이프라인을 선택합니다.")
      .addDropdown((dropdown) => {
        for (const option of QA_PIPELINE_PRESET_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.plugin.settings.qaPipelinePreset)
          .onChange(async (value) => {
            await this.plugin.setQaPipelinePresetForQa(value as QaPipelinePreset);
            this.display();
          });
      });

    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset base model",
      description: "Optional manual base-model override for Pro preset.",
      key: "qaBalancedPresetBaseModel",
      kind: "text",
      placeholder: "qwen3:14b",
      preset: "balanced_local",
    });
    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset vision model",
      description: "Optional manual vision-model override for Pro preset.",
      key: "qaBalancedPresetVisionModel",
      kind: "vision",
      placeholder: "qwen2.5vl:7b",
      preset: "balanced_local",
    });
    this.addPresetProfileModelSetting(containerEl, {
      name: "Pro preset embedding model",
      description: "Optional manual embedding-model override for Pro preset.",
      key: "qaBalancedPresetEmbeddingModel",
      kind: "embedding",
      placeholder: "nomic-embed-text",
      preset: "balanced_local",
    });

    const presetWarnings = this.collectPresetOverrideWarnings();
    new Setting(containerEl)
      .setName("Preset override warning summary")
      .setDesc(
        presetWarnings.length > 0
          ? presetWarnings.map((item) => `- ${item.name}: ${item.note}`).join("\n")
          : "현재 감지된 프리셋 오버라이드 경고(⚠)가 없습니다.",
      )
      .addButton((button) =>
        button.setButtonText("Guide에서 보기").onClick(async () => {
          this.plugin.settings.settingsActiveTab = "guide";
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Role model detection controls")
      .setDesc(
        "Refresh local model detection manually, then choose role-specific models below.",
      )
      .addButton((button) =>
        button.setButtonText("Refresh / 새로고침").onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: true, autoApply: true });
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Use recommended / 권장값 사용").onClick(async () => {
          await this.plugin.applyRecommendedOllamaModel(true);
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Role model detection summary")
      .setDesc(this.plugin.getOllamaDetectionSummary());

    new Setting(containerEl)
      .setName("Auto-pick recommended role models")
      .setDesc(
        "Auto-fill role model fields from detected models when values are missing or legacy-uniform.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaRoleModelAutoPickEnabled)
          .onChange(async (value) => {
            this.plugin.settings.qaRoleModelAutoPickEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Apply role recommendations now")
      .setDesc("Calculate role-specific recommended models from detected list and apply.")
      .addButton((button) =>
        button.setButtonText("Auto-fill now / 지금 자동 채우기").onClick(async () => {
          await this.plugin.applyRecommendedRoleModelsForQa(true, true);
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Role recommendation summary")
      .setDesc(this.plugin.getRoleModelRecommendationSummaryForQa());

    const health = this.getRoleModelHealthSummary();
    new Setting(containerEl)
      .setName("Agent role model health check")
      .setDesc(
        [
          health.summary,
          `자동 배치: ${this.plugin.settings.qaRoleModelAutoPickEnabled ? "ON" : "OFF"}`,
          `현재 역할 모델: ${this.plugin.getQaRoleModelSummaryForQa()}`,
        ].join("\n"),
      )
      .addButton((button) =>
        button.setButtonText("Run health check now").onClick(async () => {
          await this.plugin.refreshOllamaDetection({ notify: false, autoApply: true });
          await this.plugin.applyRecommendedRoleModelsForQa(true, false);
          this.display();
        }),
      );

    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const roleOptions = this.plugin.getRoleModelOptionsForQa(config.role);
      this.addRoleModelPickerSetting(containerEl, config, roleOptions);
    }

    if (this.plugin.settings.qaPipelinePreset === "legacy_auto") {
      new Setting(containerEl)
        .setName("Enable orchestrator pipeline / 오케스트레이터 파이프라인")
        .setDesc("Use an orchestration rewrite pass for planning/report/PPT/game-style tasks. / 계획서·보고서·PPT·게임 과제에 추가 정리 패스를 적용")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.qaOrchestratorEnabled)
            .onChange(async (value) => {
              this.plugin.settings.qaOrchestratorEnabled = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Enable safeguard verification / 세이프가드 검증")
        .setDesc("Run a final factual/safety consistency pass against sources before returning answer. / 출처 기준 사실·보안 일관성 최종 점검")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.qaSafeguardPassEnabled)
            .onChange(async (value) => {
              this.plugin.settings.qaSafeguardPassEnabled = value;
              await this.plugin.saveSettings();
            }),
        );
    }

    const customPromptSetting = new Setting(containerEl)
      .setName("Custom system prompt / 사용자 시스템 프롬프트")
      .setDesc(
        "Optional global policy/style instructions. Beginner default is prefilled and can be restored anytime. / 전체 역할에 공통 적용되는 지시입니다.",
      )
      .addTextArea((text) => {
        text.inputEl.addClass("auto-linker-setting-prompt-textarea");
        text.inputEl.rows = 10;
        return text
          .setPlaceholder(DEFAULT_SETTINGS.qaCustomSystemPrompt)
          .setValue(this.plugin.settings.qaCustomSystemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.qaCustomSystemPrompt = value;
            await this.plugin.saveSettings();
          });
      })
      .addButton((button) =>
        button.setButtonText("Use default / 기본값").onClick(async () => {
          this.plugin.settings.qaCustomSystemPrompt = DEFAULT_SETTINGS.qaCustomSystemPrompt;
          await this.plugin.saveSettings();
          this.display();
        }),
      );
    customPromptSetting.settingEl.addClass("auto-linker-setting-prompt-editor");

    const rolePromptSetting = new Setting(containerEl)
      .setName("Role system prompt editor")
      .setDesc(
        "Add extra system instructions per role agent. Empty keeps built-in role prompt only.",
      )
      .addDropdown((dropdown) => {
        for (const option of QA_ROLE_PRESET_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.rolePromptEditorTarget)
          .onChange((value) => {
            this.rolePromptEditorTarget = value as QaRolePreset;
            this.display();
          });
      })
      .addTextArea((text) => {
        text.inputEl.addClass("auto-linker-setting-prompt-textarea");
        text.inputEl.rows = 12;
        return text
          .setPlaceholder(
            this.plugin.getDefaultQaRoleSystemPromptForQa(this.rolePromptEditorTarget),
          )
          .setValue(this.plugin.getQaRoleSystemPromptForQa(this.rolePromptEditorTarget))
          .onChange(async (value) => {
            await this.plugin.setQaRoleSystemPromptForQa(
              this.rolePromptEditorTarget,
              value,
            );
          });
      })
      .addButton((button) =>
        button.setButtonText("Use role default / 역할 기본값").onClick(async () => {
          await this.plugin.setQaRoleSystemPromptForQa(
            this.rolePromptEditorTarget,
            this.plugin.getDefaultQaRoleSystemPromptForQa(this.rolePromptEditorTarget),
          );
          this.display();
        }),
      );
    rolePromptSetting.settingEl.addClass("auto-linker-setting-prompt-editor");

    containerEl.createEl("h3", { text: "Advanced scenario examples / 고급 시나리오 예시" });
    const advancedExamples = containerEl.createEl("ul", { cls: "auto-linker-settings-guide-list" });
    const exampleFast = advancedExamples.createEl("li");
    exampleFast.createDiv({ text: "Flash (빠른 질의응답)" });
    exampleFast.createEl("small", {
      text: "ask + lightweight, 1~2개 문서 요약/정의 확인",
    });
    exampleFast.createEl("small", {
      text: "권장: qwen3:8b / gpt-oss:20b(여유 시), 필요 시 ask_vision에 gemma3 계열",
    });

    const examplePro = advancedExamples.createEl("li");
    examplePro.createDiv({ text: "Pro (문서 분석/초안)" });
    examplePro.createEl("small", {
      text: "orchestrator -> safeguard, 첨부 우선 + 선택 노트 보조",
    });
    examplePro.createEl("small", {
      text: "권장: qwen3:14b + nomic-embed-text + qwen2.5vl:7b",
    });

    const exampleOrchestration = advancedExamples.createEl("li");
    exampleOrchestration.createDiv({ text: "Orchestration (프로젝트/개발)" });
    exampleOrchestration.createEl("small", {
      text: "orchestrator -> architect -> coder/debugger -> safeguard",
    });
    exampleOrchestration.createEl("small", {
      text: "예시: 수업용 웹앱 개발(평가계획/교안 자료 기반)에서 설계->구현->디버깅->보안 점검 순서",
    });
    exampleOrchestration.createEl("small", {
      text: "권장: orchestrator/architect=qwen3:30b, coder=qwen3-coder:30b, safeguard=gpt-oss-safeguard:20b",
    });

    const exampleOrch = advancedExamples.createEl("li");
    exampleOrch.createDiv({ text: "Orchestrator 결과물 점검" });
    exampleOrch.createEl("small", {
      text: "역할 실행 요약에 architect/coder/debugger/safeguard의 기여·산출물·조율·미해결 이슈가 포함되어야 함",
    });

    new Setting(containerEl)
      .setName("Include selection inventory / 선택 파일 인벤토리 포함")
      .setDesc("For large scopes, include selected-file metadata list to reduce 'insufficient evidence' answers. / 대규모 선택 시 전체 파일 메타 목록을 컨텍스트에 추가")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaIncludeSelectionInventory)
          .onChange(async (value) => {
            this.plugin.settings.qaIncludeSelectionInventory = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Inventory max files / 인벤토리 최대 파일 수")
      .setDesc("Upper bound for selected-file metadata snapshot in Q&A context. / Q&A 컨텍스트에 넣을 최대 파일 수")
      .addText((text) =>
        text
          .setPlaceholder("200")
          .setValue(String(this.plugin.settings.qaSelectionInventoryMaxFiles))
          .onChange(async (value) => {
            this.plugin.settings.qaSelectionInventoryMaxFiles = parsePositiveInt(
              value,
              this.plugin.settings.qaSelectionInventoryMaxFiles,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Chat transcript folder path")
      .setDesc("Vault-relative path for saving chat transcripts.")
      .addText((text) =>
        text
          .setPlaceholder("Auto Link Chats")
          .setValue(this.plugin.settings.chatTranscriptRootPath)
          .onChange(async (value) => {
            this.plugin.settings.chatTranscriptRootPath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Attachment ingest folder path")
      .setDesc("Vault-relative folder where external attachments are mirrored for stable source links.")
      .addText((text) =>
        text
          .setPlaceholder("Auto Link Ingest")
          .setValue(this.plugin.settings.qaAttachmentIngestRootPath)
          .onChange(async (value) => {
            this.plugin.settings.qaAttachmentIngestRootPath = normalizePath(
              value.trim() || DEFAULT_SETTINGS.qaAttachmentIngestRootPath,
            );
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-sync chat thread")
      .setDesc(
        "When enabled, the current chat thread is continuously saved and updated as messages change.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaThreadAutoSyncEnabled)
          .onChange(async (value) => {
            this.plugin.settings.qaThreadAutoSyncEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("PDF attachments in chat")
      .setDesc("기본 ON입니다. 상세 파서 설정은 Parser 탭에서 관리합니다.");

    new Setting(containerEl)
      .setName("Parser mode")
      .setDesc("Fast는 속도 우선, Detailed는 OCR/추출 품질 우선입니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("fast", "Fast")
          .addOption("detailed", "Detailed")
          .setValue(this.plugin.settings.qaParserMode)
          .onChange(async (value) => {
            this.plugin.settings.qaParserMode = value === "detailed" ? "detailed" : "fast";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Enable agent tool mode (experimental)")
      .setDesc(
        "Allow model-proposed actions (read/write/list/shell) from chat responses via auto-link-actions JSON block.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAgentToolModeEnabled)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentToolModeEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Require approval before tool execution")
      .setDesc(
        "Recommended. If enabled, proposed actions are queued and run only after user sends '승인' or '/approve'.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAgentRequireApproval)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentRequireApproval = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Allow shell tool (danger)")
      .setDesc(
        "Allows run_shell actions via local terminal command execution. Keep off unless absolutely needed.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAgentAllowShellTool)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentAllowShellTool = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Agent shell full access (danger)")
      .setDesc(
        "If enabled, run_shell and agent file actions(read/write/list) can use any absolute path (allowlist bypass).",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.qaAgentShellFullAccess)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentShellFullAccess = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Shell tool timeout (seconds)")
      .setDesc("run_shell 명령 1회당 최대 실행 시간(초)입니다. 무한 대기 방지용 안전장치입니다.")
      .addText((text) =>
        text
          .setPlaceholder("20")
          .setValue(String(this.plugin.settings.qaAgentShellTimeoutSec))
          .onChange(async (value) => {
            this.plugin.settings.qaAgentShellTimeoutSec = Math.max(
              3,
              Math.min(
                300,
                parsePositiveInt(value, this.plugin.settings.qaAgentShellTimeoutSec),
              ),
            );
            await this.plugin.saveSettings();
            text.setValue(String(this.plugin.settings.qaAgentShellTimeoutSec));
          }),
      );

    new Setting(containerEl)
      .setName("Shell tool default cwd (vault-relative, optional)")
      .setDesc(
        "Pick a vault folder from dropdown for run_shell default start location. This is separate from absolute allowlist rules. / run_shell 기본 시작 폴더를 vault 드롭다운에서 선택합니다. 절대경로 allowlist와는 별개입니다.",
      )
      .addDropdown((dropdown) => {
        const folderOptions = this.getVaultFolderOptionsForShellCwd();
        const optionValues = new Set<string>();
        dropdown.addOption("", ". (Vault root / vault 루트)");
        optionValues.add("");
        for (const folder of folderOptions) {
          dropdown.addOption(folder, folder);
          optionValues.add(folder);
        }

        const current = this.plugin.settings.qaAgentShellCwdPath.trim();
        const isAbsoluteCurrent =
          current.startsWith("/") || /^[A-Za-z]:/.test(current);
        if (current && !optionValues.has(current)) {
          const customLabel = isAbsoluteCurrent
            ? `${current} (absolute custom / 절대경로 사용자값)`
            : `${current} (custom / 사용자값)`;
          dropdown.addOption(current, customLabel);
        }
        dropdown.setValue(current);

        dropdown.onChange(async (value) => {
          const trimmed = value.trim();
          try {
            if (!trimmed) {
              this.plugin.settings.qaAgentShellCwdPath = "";
            } else {
              this.plugin.settings.qaAgentShellCwdPath =
                this.plugin.sanitizeQaShellCwdPath(trimmed);
            }
            await this.plugin.saveSettings();
          } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid shell cwd path";
            new Notice(message, 7000);
            this.display();
          }
        });
      })
      .addButton((button) =>
        button.setButtonText("Refresh folders / 폴더 새로고침").onClick(() => {
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Agent path allowlist (absolute, comma/newline)")
      .setDesc("Absolute path allowlist for run_shell cwd and agent file actions(read/write/list) when full access is OFF. Default: (empty, vault-only)")
      .addTextArea((text) =>
        text
          .setPlaceholder("/absolute/path/project,/absolute/path/vault")
          .setValue(this.plugin.settings.qaAgentPathAllowlist)
          .onChange(async (value) => {
            this.plugin.settings.qaAgentPathAllowlist = value;
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
      .setName("Allowed outbound hosts (non-local Q&A)")
      .setDesc(
        "Comma/newline-separated host allowlist used when non-local endpoint is enabled. Example: api.openai.com, api.anthropic.com",
      )
      .addTextArea((text) =>
        text
          .setPlaceholder("api.openai.com,api.anthropic.com,generativelanguage.googleapis.com")
          .setValue(this.plugin.settings.qaAllowedOutboundHosts)
          .onChange(async (value) => {
            this.plugin.settings.qaAllowedOutboundHosts = value;
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
      .setDesc(
        "AI 제안을 적용할 때, 아래 규칙으로 frontmatter 키를 자동 정리합니다. 초보자는 먼저 dry-run으로 확인을 권장합니다.",
      )
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
        button.setButtonText("Open picker / 선택기 열기").onClick(async () => {
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
        "실제 적용 전 `Dry-run cleanup...`으로 결과를 먼저 확인하고, 문제 없을 때 `Cleanup...`을 실행하세요.",
      );

    new Setting(containerEl)
      .setName("Cleanup dry-run report folder")
      .setDesc(
        "dry-run 결과 리포트를 저장할 폴더입니다. 실제 파일 수정 없이 변경 예정 항목만 확인할 수 있습니다.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Auto Link Reports")
          .setValue(this.plugin.settings.cleanupReportRootPath)
          .onChange(async (value) => {
            this.plugin.settings.cleanupReportRootPath = value.trim();
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
      .setName("Watch folders for new notes / 신규 노트 폴더 감시")
      .setDesc(
        "When a new markdown file appears in watched folders, prompt to add/analyze it. / 신규 문서 생성 시 선택/분석 여부를 묻습니다.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.watchNewNotesEnabled)
          .onChange(async (value) => {
            this.plugin.settings.watchNewNotesEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Watched folders / 감시 폴더")
      .setDesc("Comma/newline separated vault-relative folder paths. Example: Inbox,Clippings / 예: Inbox,Clippings")
      .addTextArea((text) =>
        text
          .setPlaceholder("Inbox,Clippings")
          .setValue(this.plugin.settings.watchNewNotesFolders)
          .onChange(async (value) => {
            this.plugin.settings.watchNewNotesFolders = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-tag active note / 현재 문서 자동 태깅")
      .setDesc("On file-open, auto-analyze and merge tags for the active markdown note. / 문서 열기 시 태그만 자동 분석·병합")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoTagActiveNoteEnabled)
          .onChange(async (value) => {
            this.plugin.settings.autoTagActiveNoteEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-tag cooldown seconds / 자동 태깅 쿨다운(초)")
      .setDesc("Minimum interval before re-tagging the same note. / 같은 노트 재태깅 최소 간격")
      .addText((text) =>
        text
          .setPlaceholder("90")
          .setValue(String(this.plugin.settings.autoTagActiveNoteCooldownSec))
          .onChange(async (value) => {
            this.plugin.settings.autoTagActiveNoteCooldownSec = parsePositiveInt(
              value,
              this.plugin.settings.autoTagActiveNoteCooldownSec,
            );
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
          .setPlaceholder(".obsidian,Auto Link Backups")
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
          .setPlaceholder("Auto Link Backups")
          .setValue(this.plugin.settings.backupRootPath)
          .onChange(async (value) => {
            try {
              await this.plugin.setBackupRootPathForQa(value);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Invalid backup root path.";
              new Notice(message, 6000);
              text.setValue(this.plugin.settings.backupRootPath);
            }
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
            try {
              await this.plugin.setMocPathForQa(value);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Invalid MOC path.";
              new Notice(message, 6000);
              text.setValue(this.plugin.settings.mocPath);
            }
          }),
      );

    this.applySettingsTabVisibility(containerEl);
    this.applyCompactSettingsVisibility(containerEl);
    this.hideEmptySettingSections(containerEl);
    this.applyBilingualSettingsLabels(containerEl);
  }

  private applyBilingualSettingsLabels(containerEl: HTMLElement): void {
    const mode = this.plugin.settings.settingsUiLanguage;
    if (mode === "en") {
      const nameEls = containerEl.querySelectorAll<HTMLElement>(".setting-item-name");
      for (const nameEl of Array.from(nameEls)) {
        const inline = splitInlineBilingualText(nameEl.textContent);
        if (!inline) {
          continue;
        }
        nameEl.removeClass("auto-linker-bilingual-field");
        nameEl.textContent = inline.en;
      }
      const descEls = containerEl.querySelectorAll<HTMLElement>(".setting-item-description");
      for (const descEl of Array.from(descEls)) {
        const inline = splitInlineBilingualText(descEl.textContent);
        if (!inline) {
          continue;
        }
        descEl.removeClass("auto-linker-bilingual-field");
        descEl.textContent = inline.en;
      }
      const headerEls = containerEl.querySelectorAll<HTMLElement>("h2, h3");
      for (const headerEl of Array.from(headerEls)) {
        const inline = splitInlineBilingualText(headerEl.textContent);
        if (!inline) {
          continue;
        }
        headerEl.textContent = inline.en;
      }
      return;
    }

    const headerEls = containerEl.querySelectorAll<HTMLElement>("h2, h3");
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

    const nameEls = containerEl.querySelectorAll<HTMLElement>(".setting-item-name");
    for (const nameEl of Array.from(nameEls)) {
      const inline = splitInlineBilingualText(nameEl.textContent);
      if (inline) {
        nameEl.removeClass("auto-linker-bilingual-field");
        nameEl.textContent = mode === "ko" ? inline.ko : `${inline.en} / ${inline.ko}`;
        continue;
      }
      const localized = toKoreanBilingualParts(nameEl.textContent, SETTINGS_NAME_KO_MAP);
      if (localized && mode === "ko") {
        nameEl.removeClass("auto-linker-bilingual-field");
        nameEl.textContent = localized.ko;
      } else if (localized && mode === "bilingual") {
        nameEl.empty();
        nameEl.addClass("auto-linker-bilingual-field");
        nameEl.createSpan({
          text: localized.en,
          cls: "auto-linker-bilingual-en",
        });
        nameEl.createSpan({
          text: localized.ko,
          cls: "auto-linker-bilingual-ko",
        });
      }
    }

    const descEls = containerEl.querySelectorAll<HTMLElement>(".setting-item-description");
    for (const descEl of Array.from(descEls)) {
      const inline = splitInlineBilingualText(descEl.textContent);
      if (inline) {
        descEl.removeClass("auto-linker-bilingual-field");
        descEl.textContent = mode === "ko" ? inline.ko : `${inline.en} / ${inline.ko}`;
        continue;
      }
      const localized = toKoreanBilingualParts(descEl.textContent, SETTINGS_DESC_KO_MAP);
      if (localized && mode === "ko") {
        descEl.removeClass("auto-linker-bilingual-field");
        descEl.textContent = localized.ko;
      } else if (localized && mode === "bilingual") {
        descEl.empty();
        descEl.addClass("auto-linker-bilingual-field");
        descEl.createSpan({
          text: localized.en,
          cls: "auto-linker-bilingual-en",
        });
        descEl.createSpan({
          text: localized.ko,
          cls: "auto-linker-bilingual-ko",
        });
      }
    }
  }
}

interface BackupManifest {
  createdAt: string;
  backupFolder: string;
  fileCount: number;
  files: string[];
}

interface AnalysisCacheEntry {
  requestSignature: string;
  settingsSignature?: string;
  selectionSignature?: string;
  mtime: number;
  size: number;
  proposal: MetadataProposal;
  meta: SuggestionAnalysisMeta;
  updatedAt: string;
}

interface AnalysisCacheData {
  version: number;
  entries: Record<string, AnalysisCacheEntry>;
}

interface AnalysisRequestSignatureInput {
  sourcePath: string;
  candidateLinkPaths: string[];
  maxTags: number;
  maxLinked: number;
  analyzeTags: boolean;
  analyzeTopic: boolean;
  analyzeLinked: boolean;
  forceAllToAllLinkedEnabled: boolean;
  analyzeIndex: boolean;
  includeReasons: boolean;
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
  private analysisCache: AnalysisCacheData | null = null;
  private analysisCacheDirty = false;
  private pendingQaActionPlan: LocalQaAgentActionPlan | null = null;
  private pendingNewNoteWatchPrompts = new Set<string>();
  private autoTagInFlightPaths = new Set<string>();
  private autoTagLastRunByPath = new Map<string, number>();
  private parserToolStatus: Record<"pdftotext" | "pdftoppm" | "tesseract", boolean> = {
    pdftotext: false,
    pdftoppm: false,
    tesseract: false,
  };
  private parserToolSummary = "Parser tool check has not run yet.";

  async onload(): Promise<void> {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("idle");
    this.registerView(
      LOCAL_QA_VIEW_TYPE,
      (leaf) => new LocalQAWorkspaceView(leaf, this),
    );
    await this.cleanupLegacyCacheArtifacts();
    void this.refreshParserToolReadinessForQa(false);
    this.addRibbonIcon("message-square", "Open Auto Link Local Chat", () => {
      void this.openLocalQaWorkspaceView();
    });
    this.addRibbonIcon("list-checks", "Open Auto Link Analyzed Track", () => {
      void this.openAnalyzedTrack();
    });
    this.registerEvent(
      this.app.vault.on("create", (entry) => {
        if (!(entry instanceof TFile) || entry.extension !== "md") {
          return;
        }
        void this.handleWatchedNewFile(entry);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") {
          return;
        }
        void this.handleAutoTagOnFileOpen(file);
      }),
    );

    this.addCommand({
      id: "select-target-notes",
      name: "Select target notes/folders",
      callback: async () => this.openSelectionModal(),
    });

    this.addCommand({
      id: "open-analyzed-track",
      name: "Open analyzed track (selection + analyzed settings)",
      callback: async () => this.openAnalyzedTrack(),
    });

    this.addCommand({
      id: "analyze-target-notes",
      name: "Analyze selected notes (suggestions by default)",
      callback: async () => this.runAnalysis(),
    });

    this.addCommand({
      id: "auto-tag-active-note",
      name: "Auto-tag active note (tags only)",
      callback: async () => {
        const active = this.app.workspace.getActiveFile();
        if (!(active instanceof TFile) || active.extension !== "md") {
          this.notice("No active markdown note.");
          return;
        }
        await this.runAutoTagForFile(active, "manual");
      },
    });

    this.addCommand({
      id: "clear-target-notes",
      name: "Clear selected target notes/folders",
      callback: async () => {
        await this.clearSelectionForQa(true);
      },
    });

    this.addCommand({
      id: "backup-selected-notes",
      name: "Backup selected notes",
      callback: async () => this.backupSelectedNotesNow(),
    });

    this.addCommand({
      id: "restore-latest-backup",
      name: "Restore from latest backup",
      callback: async () => this.restoreFromLatestBackup(),
    });

    this.addCommand({
      id: "cleanup-selected-frontmatter",
      name: "Cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(false),
    });

    this.addCommand({
      id: "cleanup-selected-frontmatter-dry-run",
      name: "Dry-run cleanup frontmatter properties for selected notes",
      callback: async () => this.runPropertyCleanup(true),
    });

    this.addCommand({
      id: "select-cleanup-keys-from-selected-notes",
      name: "Select cleanup keys from selected notes",
      callback: async () => this.openCleanupKeyPicker(),
    });

    this.addCommand({
      id: "refresh-ollama-models",
      name: "Refresh Ollama model detection",
      callback: async () => {
        await this.refreshOllamaDetection({ notify: true, autoApply: true });
      },
    });

    this.addCommand({
      id: "refresh-embedding-models",
      name: "Refresh embedding model detection",
      callback: async () => {
        await this.refreshEmbeddingModelDetection({ notify: true, autoApply: true });
      },
    });

    this.addCommand({
      id: "generate-moc-now",
      name: "Generate MOC from selected notes",
      callback: async () => this.generateMocFromSelection(),
    });

    this.addCommand({
      id: "ask-local-ai-from-selected-notes",
      name: "Ask local AI from selected notes",
      callback: async () => this.openLocalQaWorkspaceView(),
    });

    this.addSettingTab(new KnowledgeWeaverSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE).forEach((leaf) => leaf.detach());
    this.setStatus("idle");
  }

  getOllamaDetectionSummary(): string {
    return this.ollamaDetectionSummary;
  }

  getOllamaModelOptions(): OllamaModelOption[] {
    return this.ollamaDetectionOptions;
  }

  private getDetectedOllamaModelNames(): string[] {
    if (this.ollamaDetectionCache?.models && this.ollamaDetectionCache.models.length > 0) {
      return [...this.ollamaDetectionCache.models];
    }
    return this.ollamaDetectionOptions.map((option) => option.model);
  }

  private hasDetectedOllamaModel(modelName: string): boolean {
    const target = modelName.trim();
    if (!target) {
      return false;
    }
    return this.getDetectedOllamaModelNames().includes(target);
  }

  private resolveDetectedRoleFallbackModel(role: QaRolePreset): string | null {
    const options = this.getRoleModelOptionsForQa(role);
    const recommended = options.find((option) => option.status === "recommended")?.model?.trim();
    if (recommended) {
      return recommended;
    }
    const available = options.find((option) => option.status !== "unavailable")?.model?.trim();
    return available || null;
  }

  private getRoleModelSettingKey(role: QaRolePreset): RoleModelSettingKey | null {
    if (role === "debugger") {
      return "qaCoderModel";
    }
    const found = ROLE_MODEL_SETTING_CONFIGS.find((config) => config.role === role);
    return found?.key ?? null;
  }

  private readRoleModelSetting(key: RoleModelSettingKey): string {
    return this.settings[key].trim();
  }

  private writeRoleModelSetting(key: RoleModelSettingKey, value: string): void {
    this.settings[key] = value.trim();
  }

  private isLegacyUniformRoleModelConfig(): boolean {
    const values = ROLE_MODEL_SETTING_CONFIGS
      .map((config) => this.readRoleModelSetting(config.key))
      .filter((value) => value.length > 0);
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

  getRoleModelOptionsForQa(role: QaRolePreset): OllamaModelOption[] {
    const models = this.getDetectedOllamaModelNames();
    if (models.length === 0) {
      return [];
    }
    return buildRoleSpecificOllamaModelOptions(role, models);
  }

  getRoleModelRecommendationSummaryForQa(): string {
    const parts = ROLE_MODEL_SETTING_CONFIGS.map((config) => {
      const options = this.getRoleModelOptionsForQa(config.role);
      const recommended = options.find((option) => option.status === "recommended")?.model ?? "(none)";
      return `${config.name}: ${recommended}`;
    });
    return parts.join(" | ");
  }

  async applyRecommendedRoleModelsForQa(notify: boolean, forceApply: boolean): Promise<void> {
    const legacyUniform = this.isLegacyUniformRoleModelConfig();
    let changed = 0;
    for (const config of ROLE_MODEL_SETTING_CONFIGS) {
      const options = this.getRoleModelOptionsForQa(config.role);
      const recommended = options.find((option) => option.status === "recommended")?.model;
      const current = this.readRoleModelSetting(config.key);
      if (!recommended) {
        if (current.length > 0 && !isOllamaModelAllowedForQaRole(config.role, current)) {
          this.writeRoleModelSetting(config.key, "");
          changed += 1;
        }
        continue;
      }
      const currentFound = current.length > 0 && options.some((option) => option.model === current);
      const currentUnavailable =
        current.length > 0 && !isOllamaModelAllowedForQaRole(config.role, current);
      const shouldApply =
        forceApply ||
        legacyUniform ||
        current.length === 0 ||
        !currentFound ||
        currentUnavailable;
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

  getEmbeddingDetectionSummary(): string {
    return this.embeddingDetectionSummary;
  }

  getEmbeddingModelOptions(): OllamaEmbeddingModelOption[] {
    return this.embeddingDetectionOptions;
  }

  async openLocalQaWorkspaceView(): Promise<void> {
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
        active: true,
      });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  async openAnalyzedTrack(): Promise<void> {
    const selectedFiles = this.getSelectedFiles();
    const folderCounter = new Map<string, number>();
    for (const file of selectedFiles) {
      const folder = normalizePath(file.path.split("/").slice(0, -1).join("/")) || "(root)";
      folderCounter.set(folder, (folderCounter.get(folder) ?? 0) + 1);
    }
    const topFolders = [...folderCounter.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([folder, count]) => `${folder}(${count})`);
    const sampleFiles = selectedFiles
      .slice(0, 4)
      .map((file) => file.path);
    const cache = await this.loadAnalysisCache();
    const cacheEntries = Object.keys(cache.entries).length;

    this.settings.settingsActiveTab = "analyzed";
    await this.saveSettings();
    const appWithSetting = this.app as App & {
      setting?: {
        open?: () => void;
        openTabById?: (id: string) => void;
      };
    };
    if (typeof appWithSetting.setting?.open === "function") {
      appWithSetting.setting.open();
      if (typeof appWithSetting.setting.openTabById === "function") {
        appWithSetting.setting.openTabById(this.manifest.id);
      }
    }
    this.notice(
      [
        `Analyzed snapshot: files=${selectedFiles.length}, selectedFolders=${this.settings.targetFolderPaths.length}, cacheEntries=${cacheEntries}`,
        topFolders.length > 0
          ? `Top folders: ${topFolders.join(", ")}`
          : "Top folders: (none)",
        sampleFiles.length > 0
          ? `Sample files: ${sampleFiles.join(", ")}`
          : "Sample files: (none)",
      ].join(" | "),
      7000,
    );
    await this.openSelectionModal();
  }

  private async refreshOpenQaWorkspaceViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(LOCAL_QA_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof LocalQAWorkspaceView) {
        await view.refreshFromSettingsForQa();
      }
    }
  }

  getSelectedFilesForQa(): TFile[] {
    return this.getSelectedFiles();
  }

  getSelectedFolderPathsForQa(): string[] {
    return [...this.settings.targetFolderPaths];
  }

  getAnalyzedScopeSnapshotSummaryForQa(): string {
    const files = this.getSelectedFiles();
    const folderSet = new Set<string>();
    for (const file of files) {
      const folder = normalizePath(file.path.split("/").slice(0, -1).join("/")) || "(root)";
      folderSet.add(folder);
    }
    const folderCount = folderSet.size;
    const cacheCount = this.analysisCache
      ? Object.keys(this.analysisCache.entries).length
      : 0;
    return [
      `선택 파일 ${files.length}개`,
      `선택 폴더 ${this.settings.targetFolderPaths.length}개`,
      `포함 폴더(확장) ${folderCount}개`,
      `분석 캐시 엔트리 ${cacheCount}개`,
    ].join(" | ");
  }

  getQaModelOverrideForQa(): string {
    return this.settings.qaOllamaModel.trim();
  }

  getQaRolePresetForQa(): QaRolePreset {
    return this.settings.qaRolePreset;
  }

  getQaPipelinePresetForQa(): QaPipelinePreset {
    return this.settings.qaPipelinePreset;
  }

  getQaPresetProfileForQa(): QaLocalPresetProfile {
    return this.settings.qaLocalPresetProfile;
  }

  getQaPresetProfileLabelForQa(): string {
    return getQaLocalPresetProfileLabel(this.settings.qaLocalPresetProfile);
  }

  getQaConversationModeForQa(): QaConversationMode {
    return this.settings.qaConversationMode;
  }

  getQaConversationModeLabelForQa(): string {
    return getQaConversationModeLabel(this.settings.qaConversationMode);
  }

  getQaConversationModeOptionsForQa(): ReadonlyArray<LabeledOption<QaConversationMode>> {
    return QA_CONVERSATION_MODE_OPTIONS;
  }

  private applyQaConversationModePreset(mode: QaConversationMode): void {
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
        this.settings.qaRolePreset = "ask";
        this.settings.qaPipelinePreset = "orchestrator_safeguard";
        this.settings.qaAgentToolModeEnabled = false;
        this.settings.qaOrchestratorEnabled = true;
        this.settings.qaSafeguardPassEnabled = true;
        this.settings.qaAlwaysDetailedAnswer = true;
        this.settings.qaMinAnswerChars = Math.max(260, this.settings.qaMinAnswerChars);
        break;
      case "agent":
        this.settings.qaRolePreset = "ask";
        this.settings.qaPipelinePreset = "legacy_auto";
        this.settings.qaAgentToolModeEnabled = true;
        this.settings.qaAgentRequireApproval = true;
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

  async setQaConversationModeForQa(mode: QaConversationMode): Promise<void> {
    this.applyQaConversationModePreset(mode);
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  getQaRolePresetOptionsForQa(): ReadonlyArray<LabeledOption<QaRolePreset>> {
    return QA_ROLE_PRESET_OPTIONS;
  }

  getQaPipelinePresetOptionsForQa(): ReadonlyArray<LabeledOption<QaPipelinePreset>> {
    return QA_PIPELINE_PRESET_OPTIONS;
  }

  getQaModelLabelForQa(role?: QaRolePreset): string {
    const resolvedRole = role ?? this.resolveQaPrimaryRole();
    return this.resolveQaModelForRole(resolvedRole) || "(not set)";
  }

  getQaEmbeddingModelForQa(): string {
    return this.settings.semanticOllamaModel.trim();
  }

  getQaParserModeForQa(): "fast" | "detailed" {
    return this.settings.qaParserMode === "detailed" ? "detailed" : "fast";
  }

  getParserToolReadinessSummaryForQa(): string {
    return this.parserToolSummary;
  }

  getParserToolReadinessLinesForQa(): string[] {
    const tools: Array<keyof typeof this.parserToolStatus> = ["pdftotext", "pdftoppm", "tesseract"];
    return tools.map((tool) => `${tool}: ${this.parserToolStatus[tool] ? "ready" : "missing"}`);
  }

  private async isShellCommandAvailable(command: string): Promise<boolean> {
    const safe = command.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(safe)) {
      return false;
    }
    try {
      await execAsync(`command -v ${safe}`);
      return true;
    } catch {
      return false;
    }
  }

  async refreshParserToolReadinessForQa(notify: boolean): Promise<string> {
    const pdftotext = await this.isShellCommandAvailable("pdftotext");
    const pdftoppm = await this.isShellCommandAvailable("pdftoppm");
    const tesseract = await this.isShellCommandAvailable("tesseract");
    this.parserToolStatus = { pdftotext, pdftoppm, tesseract };
    const coreReady = pdftotext && pdftoppm && tesseract;
    this.parserToolSummary = [
      `PDF text: ${pdftotext ? "ready" : "missing"}`,
      `PDF OCR render: ${pdftoppm ? "ready" : "missing"}`,
      `OCR engine: ${tesseract ? "ready" : "missing"}`,
      coreReady
        ? "Detailed parser chain available."
        : "Fallback parser mode will be used for missing tools.",
    ].join(" | ");
    if (notify) {
      this.notice(this.parserToolSummary, 7000);
    }
    return this.parserToolSummary;
  }

  getQaRoleModelSummaryForQa(): string {
    const entries: Array<{ role: QaRolePreset; short: string }> = [
      { role: "ask", short: "ask" },
      { role: "ask_vision", short: "vision" },
      { role: "image_generator", short: "image" },
      { role: "orchestrator", short: "orch" },
      { role: "architect", short: "arch" },
      { role: "coder", short: "coder" },
      { role: "debugger", short: "debug" },
      { role: "safeguard", short: "safe" },
    ];
    return entries
      .map((entry) => {
        const model = this.getQaModelLabelForQa(entry.role);
        const status = isOllamaModelAllowedForQaRole(entry.role, model) ? "" : "(불가)";
        return `${entry.short}=${model}${status}`;
      })
      .join(", ");
  }

  getQaAgentModeSummaryForQa(): string {
    if (!this.settings.qaAgentToolModeEnabled) {
      return "off";
    }
    const parts = [
      this.settings.qaAgentRequireApproval ? "approval" : "auto",
      this.settings.qaAgentAllowShellTool ? "shell:on" : "shell:off",
      this.settings.qaAgentShellFullAccess ? "access:full" : "access:scoped",
    ];
    if (this.pendingQaActionPlan) {
      parts.push(`pending:${this.pendingQaActionPlan.actions.length}`);
    }
    return parts.join(",");
  }

  isQaContextEnabledForQa(): boolean {
    return this.settings.qaContextInChat;
  }

  async setQaContextEnabledForQa(enabled: boolean): Promise<void> {
    this.settings.qaContextInChat = enabled;
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  isQaAgentToolModeEnabledForQa(): boolean {
    return this.settings.qaAgentToolModeEnabled;
  }

  async setQaAgentToolModeEnabledForQa(enabled: boolean): Promise<void> {
    this.settings.qaAgentToolModeEnabled = enabled;
    await this.saveSettings();
  }

  getQaRoleSystemPromptForQa(role: QaRolePreset): string {
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

  getDefaultQaRoleSystemPromptForQa(role: QaRolePreset): string {
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

  async setQaRoleSystemPromptForQa(role: QaRolePreset, prompt: string): Promise<void> {
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

  getQaModelOptionsForQa(): string[] {
    const models = this.ollamaDetectionOptions
      .map((option) => option.model)
      .filter((model) => isOllamaModelAnalyzable(model));
    const deduped = [...new Set(models)];
    const current = this.settings.qaOllamaModel.trim();
    if (current && !deduped.includes(current)) {
      deduped.unshift(current);
    }
    return deduped;
  }

  async setQaModelOverrideForQa(modelOverride: string): Promise<void> {
    this.settings.qaOllamaModel = modelOverride.trim();
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  async applyQaChatModelSelectionForQa(role: QaRolePreset, modelName: string): Promise<void> {
    const next = modelName.trim();
    this.settings.qaOllamaModel = next;
    this.settings.qaLocalPresetProfile = "custom";
    const roleKey = this.getRoleModelSettingKey(role);
    if (roleKey) {
      this.settings[roleKey] = next;
    }
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  async setQaRolePresetForQa(rolePreset: QaRolePreset): Promise<void> {
    this.settings.qaRolePreset = rolePreset;
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  async setQaPipelinePresetForQa(pipelinePreset: QaPipelinePreset): Promise<void> {
    this.settings.qaPipelinePreset = pipelinePreset;
    this.settings.qaLocalPresetProfile = "custom";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  private getPresetRank(preset: "fast_local" | "balanced_local" | "quality_local"): number {
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

  private resolveHardwarePresetCeiling(): {
    ceiling: "fast_local" | "balanced_local" | "quality_local";
    ramGiB: number;
    cpuThreads: number;
    reason: string;
  } {
    const ramGiB = Number((nodeOs.totalmem() / (1024 ** 3)).toFixed(1));
    const cpuThreads = nodeOs.cpus()?.length ?? 0;
    if (!Number.isFinite(ramGiB) || ramGiB <= 0) {
      return {
        ceiling: "balanced_local",
        ramGiB: 0,
        cpuThreads,
        reason: "RAM 정보를 정확히 읽지 못해 Pro까지 허용합니다.",
      };
    }

    if (ramGiB < 16 || cpuThreads < 6) {
      return {
        ceiling: "fast_local",
        ramGiB,
        cpuThreads,
        reason: "RAM<16GB 또는 CPU 스레드<6 이므로 Flash 권장/제한입니다.",
      };
    }
    if (ramGiB < 32 || cpuThreads < 10) {
      return {
        ceiling: "balanced_local",
        ramGiB,
        cpuThreads,
        reason: "중간급 사양으로 Pro까지 안정적입니다.",
      };
    }
    return {
      ceiling: "quality_local",
      ramGiB,
      cpuThreads,
      reason: "고사양으로 Pro(확장) 구성이 권장됩니다.",
    };
  }

  getHardwareCapabilitySummaryForQa(): string {
    const profile = this.resolveHardwarePresetCeiling();
    const ceilingLabel = profile.ceiling === "fast_local" ? "Flash" : "Pro";
    const ramText = profile.ramGiB > 0 ? `${profile.ramGiB}GB` : "unknown";
    return `Hardware: RAM=${ramText}, CPU threads=${profile.cpuThreads || "unknown"} | Max preset=${ceilingLabel}. ${profile.reason}`;
  }

  private clampPresetByHardware(
    requested: "fast_local" | "balanced_local" | "quality_local",
  ): {
    effective: "fast_local" | "balanced_local" | "quality_local";
    note: string;
  } {
    const profile = this.resolveHardwarePresetCeiling();
    if (this.getPresetRank(requested) <= this.getPresetRank(profile.ceiling)) {
      return {
        effective: requested,
        note: "",
      };
    }
    const requestedLabel = requested === "fast_local" ? "Flash" : "Pro";
    const effectiveLabel = profile.ceiling === "fast_local" ? "Flash" : "Pro";
    return {
      effective: profile.ceiling,
      note: `Requested ${requestedLabel}, but hardware limit applied: ${effectiveLabel}. ${profile.reason}`,
    };
  }

  private scoreModelForPreset(
    modelName: string,
    preset: "fast_local" | "balanced_local" | "quality_local",
    requireVision: boolean,
  ): number {
    const lower = modelName.toLowerCase();
    if (requireVision && !VISION_MODEL_REGEX.test(lower)) {
      return -1000;
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

  private pickPresetModelFromOptions(
    options: OllamaModelOption[],
    preset: "fast_local" | "balanced_local" | "quality_local",
    requireVision = false,
  ): string | null {
    const candidates = options
      .filter((option) => option.status !== "unavailable")
      .map((option) => ({
        model: option.model,
        score:
          this.scoreModelForPreset(option.model, preset, requireVision) +
          (option.status === "recommended" ? 8 : 0),
      }))
      .filter((item) => item.score > -900)
      .sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));
    return candidates[0]?.model ?? null;
  }

  getRecommendedPresetOverrideModelForQa(
    preset: "balanced_local" | "quality_local",
    kind: PresetProfileModelKind,
  ): string {
    if (kind === "embedding") {
      const embeddingOptions = this.getEmbeddingModelOptions();
      return embeddingOptions.find((option) => option.status === "recommended")?.model ?? "";
    }
    if (kind === "vision") {
      const askVisionOptions = this.getRoleModelOptionsForQa("ask_vision");
      return this.pickPresetModelFromOptions(askVisionOptions, preset, true) ?? "";
    }
    const textOptions = this.getOllamaModelOptions();
    return this.pickPresetModelFromOptions(textOptions, preset, false) ?? "";
  }

  private applyPresetAwareRoleModels(
    preset: "fast_local" | "balanced_local" | "quality_local",
  ): {
    baseModel: string;
    visionModel: string;
    roleAssignedCount: number;
  } {
    const baseModel =
      this.pickPresetModelFromOptions(this.getOllamaModelOptions(), preset, false) ||
      this.settings.ollamaModel.trim();
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
        config.role === "ask_vision",
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
      roleAssignedCount,
    };
  }

  async applyOneClickLocalPresetForQa(
    preset: "fast_local" | "balanced_local" | "quality_local",
  ): Promise<string> {
    const presetClamp = this.clampPresetByHardware(preset);
    const effectivePreset = presetClamp.effective;
    const previousProvider = this.settings.provider;
    this.settings.ollamaBaseUrl =
      this.settings.ollamaBaseUrl.trim() || DEFAULT_SETTINGS.ollamaBaseUrl;
    this.settings.qaOllamaBaseUrl =
      this.settings.qaOllamaBaseUrl.trim() || this.settings.ollamaBaseUrl;
    this.settings.semanticOllamaBaseUrl =
      this.settings.semanticOllamaBaseUrl.trim() || this.settings.ollamaBaseUrl;
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
      this.settings.qaMaxContextChars = 8000;
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
      summary =
        "Flash preset applied: speed-first local mode (lightweight pipeline, short context, concise responses).";
    } else if (effectivePreset === "quality_local") {
      this.settings.suggestionMode = true;
      this.settings.includeReasons = true;
      this.settings.analysisOnlyChangedNotes = false;
      this.settings.semanticLinkingEnabled = true;
      this.settings.semanticTopK = Math.max(this.settings.semanticTopK, 36);
      this.settings.semanticMinSimilarity = Math.min(this.settings.semanticMinSimilarity, 0.2);
      this.settings.qaTopK = 8;
      this.settings.qaMaxContextChars = Math.max(this.settings.qaMaxContextChars, 22000);
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
        400,
      );
      summary =
        "Legacy Quality+ preset applied: quality-first local mode (semantic on, deep pipeline, extended context).";
    } else {
      this.settings.suggestionMode = true;
      this.settings.includeReasons = true;
      this.settings.analysisOnlyChangedNotes = false;
      this.settings.semanticLinkingEnabled = true;
      this.settings.qaTopK = 5;
      this.settings.qaMaxContextChars = 12000;
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
        200,
      );
      summary =
        "Pro preset applied: balanced local mode (semantic on, moderate context, safe defaults).";
    }

    const detected = await this.refreshOllamaDetection({
      notify: false,
      autoApply: true,
    });
    const detectedModels = detected?.models ?? [];
    const hasDetectedLocalModels = detectedModels.length > 0;
    let detectionSummary = "";
    if (hasDetectedLocalModels) {
      this.settings.provider = "ollama";
      const embeddingDetected = await this.refreshEmbeddingModelDetection({
        notify: false,
        autoApply: true,
      });
      const modelLayout = this.applyPresetAwareRoleModels(effectivePreset);
      if (embeddingDetected?.recommended) {
        this.settings.semanticOllamaModel = embeddingDetected.recommended;
      }
      const manualOverrides: string[] = [];
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
      detectionSummary =
        `Detected ${detectedModels.length} local model(s). Auto-assigned base model=${this.settings.ollamaModel || "(none)"}`
        + `, embedding=${this.settings.semanticOllamaModel || "(none)"}`
        + `, vision=${visionModel || "(not detected)"}, role fields=${modelLayout.roleAssignedCount}.`
        + (manualOverrides.length > 0
          ? ` Manual preset overrides: ${manualOverrides.join(", ")}.`
          : "");
    } else {
      this.settings.provider = previousProvider;
      detectionSummary =
        "No local model was detected. Provider was kept as-is. Start Ollama and install text/vision/embedding models, then re-run preset.";
    }

    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    const clampNote = presetClamp.note ? ` ${presetClamp.note}` : "";
    return `${summary} ${detectionSummary}${clampNote}`.trim();
  }

  private buildQaQuickCustomProfileSnapshot(label: string): QaQuickCustomProfileSnapshot {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
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
        qaAttachmentIngestRootPath: this.settings.qaAttachmentIngestRootPath,
      },
    };
  }

  private parseQaQuickCustomProfileSlot(raw: string): QaQuickCustomProfileSnapshot | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed) as QaQuickCustomProfileSnapshot;
      if (!parsed || typeof parsed !== "object" || !parsed.settings) {
        return null;
      }
      if (typeof parsed.savedAt !== "string") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  getQaQuickCustomProfileSlotSummary(slotKey: QaQuickCustomSlotKey): string {
    const parsed = this.parseQaQuickCustomProfileSlot(this.settings[slotKey]);
    if (!parsed) {
      return "저장된 프로필 없음";
    }
    const stamp = parsed.savedAt.replace("T", " ").replace("Z", " UTC");
    return `${parsed.label || "Custom"} · ${stamp}`;
  }

  async saveQaQuickCustomProfileSlot(slotKey: QaQuickCustomSlotKey, label: string): Promise<string> {
    const snapshot = this.buildQaQuickCustomProfileSnapshot(label);
    this.settings[slotKey] = JSON.stringify(snapshot);
    await this.saveSettings();
    return `${snapshot.label} 저장 완료 (${snapshot.savedAt})`;
  }

  async applyQaQuickCustomProfileSlot(slotKey: QaQuickCustomSlotKey): Promise<string> {
    const parsed = this.parseQaQuickCustomProfileSlot(this.settings[slotKey]);
    if (!parsed) {
      throw new Error("저장된 커스텀 프로필이 없습니다.");
    }
    const next = parsed.settings;
    const roleValid = QA_ROLE_PRESET_OPTIONS.some((option) => option.value === next.qaRolePreset);
    const pipelineValid = QA_PIPELINE_PRESET_OPTIONS.some(
      (option) => option.value === next.qaPipelinePreset,
    );
    this.settings.qaLocalPresetProfile = next.qaLocalPresetProfile;
    this.settings.ollamaModel = next.ollamaModel;
    this.settings.qaOllamaModel = next.qaOllamaModel;
    this.settings.semanticOllamaModel = next.semanticOllamaModel;
    this.settings.qaAskModel = next.qaAskModel;
    this.settings.qaAskVisionModel = next.qaAskVisionModel;
    this.settings.qaImageGeneratorModel = next.qaImageGeneratorModel;
    this.settings.qaCoderModel = next.qaCoderModel;
    this.settings.qaArchitectModel = next.qaArchitectModel;
    this.settings.qaOrchestratorModel = next.qaOrchestratorModel;
    this.settings.qaSafeguardModel = next.qaSafeguardModel;
    this.settings.qaTopK = Math.max(1, Math.min(15, Math.floor(next.qaTopK || this.settings.qaTopK)));
    this.settings.qaMaxContextChars = Math.max(
      1200,
      Math.min(50000, Math.floor(next.qaMaxContextChars || this.settings.qaMaxContextChars)),
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
      Math.min(3000, Math.floor(next.qaMinAnswerChars || this.settings.qaMinAnswerChars)),
    );
    this.settings.qaRoleModelAutoPickEnabled = Boolean(next.qaRoleModelAutoPickEnabled);
    this.settings.semanticAutoPickEnabled = Boolean(next.semanticAutoPickEnabled);
    this.settings.qaBalancedPresetBaseModel = next.qaBalancedPresetBaseModel ?? "";
    this.settings.qaBalancedPresetVisionModel = next.qaBalancedPresetVisionModel ?? "";
    this.settings.qaBalancedPresetEmbeddingModel = next.qaBalancedPresetEmbeddingModel ?? "";
    this.settings.qaQualityPresetBaseModel = next.qaQualityPresetBaseModel ?? "";
    this.settings.qaQualityPresetVisionModel = next.qaQualityPresetVisionModel ?? "";
    this.settings.qaQualityPresetEmbeddingModel = next.qaQualityPresetEmbeddingModel ?? "";
    this.settings.qaAttachmentIngestRootPath = normalizePath(
      (next.qaAttachmentIngestRootPath ?? "").trim()
        || this.settings.qaAttachmentIngestRootPath
        || DEFAULT_SETTINGS.qaAttachmentIngestRootPath,
    );
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    return `${parsed.label || "Custom"} 프로필을 적용했습니다.`;
  }

  async applyRecommendedQuickSetupForQa(): Promise<string> {
    const presetSummary = await this.applyOneClickLocalPresetForQa("balanced_local");
    await this.refreshOllamaDetection({ notify: false, autoApply: true });
    await this.refreshEmbeddingModelDetection({ notify: false, autoApply: true });
    await this.applyRecommendedRoleModelsForQa(false, true);
    this.settings.qaLocalPresetProfile = "balanced_local";
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    return `추천 세팅 적용 완료: ${presetSummary}`;
  }

  async openSelectionForQa(): Promise<void> {
    await this.openSelectionModal();
    await this.refreshOpenQaWorkspaceViews();
  }

  async clearSelectionForQa(notify: boolean): Promise<void> {
    this.settings.targetFilePaths = [];
    this.settings.targetFolderPaths = [];
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
    if (notify) {
      this.notice("Target file/folder selection cleared.");
    }
  }

  async openCleanupKeyPickerForQa(): Promise<void> {
    await this.openCleanupKeyPicker();
  }

  async runCleanupForQa(dryRun: boolean): Promise<void> {
    await this.runPropertyCleanup(dryRun);
  }

  getAgentShellFolderOptionsForQa(): string[] {
    const out = new Set<string>(["."]);
    const all = this.app.vault.getAllLoadedFiles();
    for (const entry of all) {
      if (!(entry instanceof TFolder)) {
        continue;
      }
      const normalized = normalizePath(entry.path.trim());
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

  getChatTranscriptRootPathForQa(): string {
    return this.settings.chatTranscriptRootPath.trim();
  }

  isQaThreadAutoSyncEnabledForQa(): boolean {
    return this.settings.qaThreadAutoSyncEnabled;
  }

  private isSafeVaultRelativePath(path: string): boolean {
    const normalized = normalizePath(path.trim());
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

  private resolveSafeFolderPath(rawPath: string, fallback: string, label: string): string {
    const normalized = normalizePath(rawPath.trim() || fallback);
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} path must be a safe vault-relative folder path.`);
    }
    return normalized;
  }

  sanitizeVaultFolderPathForQa(rawPath: string, fallback: string, label: string): string {
    return this.resolveSafeFolderPath(rawPath, fallback, label);
  }

  async setChatTranscriptRootPathForQa(path: string): Promise<void> {
    const next = this.resolveSafeFolderPath(path, "Auto Link Chats", "Chat transcript");
    this.settings.chatTranscriptRootPath = next;
    await this.saveSettings();
    await this.refreshOpenQaWorkspaceViews();
  }

  async setBackupRootPathForQa(path: string): Promise<void> {
    const next = this.resolveSafeFolderPath(path, "Auto Link Backups", "Backup root");
    this.settings.backupRootPath = next;
    await this.saveSettings();
  }

  async setMocPathForQa(path: string): Promise<void> {
    const raw = path.trim() || "MOC/Selected Knowledge MOC.md";
    const next = this.resolveSafeMarkdownPath(raw, "MOC");
    this.settings.mocPath = next;
    await this.saveSettings();
  }

  private escapeYamlValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private collectTopSourcePaths(
    messages: LocalQAViewMessage[],
    maxItems: number,
  ): string[] {
    const bestByPath = new Map<string, number>();
    for (const message of messages) {
      if (message.role !== "assistant" || !message.sources) {
        continue;
      }
      for (const source of message.sources) {
        const prev = bestByPath.get(source.path);
        if (prev === undefined || source.similarity > prev) {
          bestByPath.set(source.path, source.similarity);
        }
      }
    }

    return [...bestByPath.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, Math.max(1, maxItems))
      .map(([path]) => path);
  }

  private normalizeThreadId(rawThreadId: string | undefined, fallbackDate: Date): string {
    const fallback = `chat-${formatBackupStamp(fallbackDate)}`;
    const trimmed = (rawThreadId ?? "").trim();
    if (!trimmed) {
      return fallback;
    }
    const normalized = trimmed
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
    return normalized || fallback;
  }

  private resolveSafeMarkdownPath(rawPath: string, label: string): string {
    const normalized = normalizePath(rawPath.trim());
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} path must be a safe vault-relative markdown path.`);
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      throw new Error(`${label} path must end with .md`);
    }
    return normalized;
  }

  private async allocateTimestampedMocPath(basePath: string): Promise<string> {
    const safeBasePath = this.resolveSafeMarkdownPath(basePath, "MOC");
    const baseWithoutExt = safeBasePath.replace(/\.md$/i, "");
    const stamp = formatBackupStamp(new Date());
    let outputPath = normalizePath(`${baseWithoutExt}-${stamp}.md`);
    let suffix = 1;
    while (await this.app.vault.adapter.exists(outputPath)) {
      outputPath = normalizePath(`${baseWithoutExt}-${stamp}-${suffix}.md`);
      suffix += 1;
    }
    return outputPath;
  }

  private async allocateLocalQaThreadPath(threadId: string): Promise<string> {
    const folder = this.resolveSafeFolderPath(
      this.settings.chatTranscriptRootPath,
      "Auto Link Chats",
      "Chat transcript",
    );
    let outputPath = normalizePath(`${folder}/${threadId}.md`);
    let suffix = 1;
    while (await this.app.vault.adapter.exists(outputPath)) {
      outputPath = normalizePath(`${folder}/${threadId}-${suffix}.md`);
      suffix += 1;
    }
    return outputPath;
  }

  private buildLocalQaTranscriptMarkdown(params: {
    messages: LocalQAViewMessage[];
    threadId: string;
    createdAt: string;
    updatedAt: string;
  }): string {
    const { messages, threadId, createdAt, updatedAt } = params;
    const qaModel = this.getQaModelLabelForQa();
    const embeddingModel = this.getQaEmbeddingModelForQa();
    const selectedFiles = this.getSelectedFilesForQa().map((file) => file.path);
    const selectedFolders = this.getSelectedFolderPathsForQa().sort((a, b) =>
      a.localeCompare(b),
    );
    const topSourcePaths = this.collectTopSourcePaths(
      messages,
      Math.max(1, this.settings.qaTopK),
    );
    const turns = messages.filter(
      (item) => item.role === "user" || item.role === "assistant",
    );

    const lines: string[] = [];
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

    return `${lines.join("\n").trim()}\n`;
  }

  async syncLocalQaTranscript(input: LocalQaThreadSyncInput): Promise<LocalQaThreadSyncResult> {
    const now = new Date();
    const updatedAt = now.toISOString();
    const createdDate = input.createdAt ? new Date(input.createdAt) : now;
    const createdAt = Number.isNaN(createdDate.getTime())
      ? updatedAt
      : createdDate.toISOString();
    const threadId = this.normalizeThreadId(input.threadId, new Date(createdAt));
    const outputPath = input.threadPath
      ? this.resolveSafeMarkdownPath(input.threadPath, "Chat thread")
      : await this.allocateLocalQaThreadPath(threadId);

    const markdown = this.buildLocalQaTranscriptMarkdown({
      messages: input.messages,
      threadId,
      createdAt,
      updatedAt,
    });
    await this.ensureParentFolder(outputPath);
    await this.app.vault.adapter.write(outputPath, markdown);

    return {
      path: outputPath,
      threadId,
      createdAt,
      updatedAt,
    };
  }

  async saveLocalQaTranscript(messages: LocalQAViewMessage[]): Promise<string> {
    const now = new Date();
    const synced = await this.syncLocalQaTranscript({
      messages,
      threadId: `chat-${formatBackupStamp(now)}`,
      createdAt: now.toISOString(),
    });
    return synced.path;
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

      if (options.autoApply && this.settings.qaRoleModelAutoPickEnabled) {
        await this.applyRecommendedRoleModelsForQa(false, false);
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
    if (
      this.settings.settingsViewMode !== "simple" &&
      this.settings.settingsViewMode !== "full"
    ) {
      this.settings.settingsViewMode = DEFAULT_SETTINGS.settingsViewMode;
    }
    this.settings.settingsViewMode = "full";
    if (
      this.settings.settingsUiLanguage !== "ko" &&
      this.settings.settingsUiLanguage !== "en" &&
      this.settings.settingsUiLanguage !== "bilingual"
    ) {
      this.settings.settingsUiLanguage = DEFAULT_SETTINGS.settingsUiLanguage;
    }
    if (
      this.settings.settingsActiveTab !== "quick" &&
      this.settings.settingsActiveTab !== "analyzed" &&
      this.settings.settingsActiveTab !== "models" &&
      this.settings.settingsActiveTab !== "chat" &&
      this.settings.settingsActiveTab !== "advanced" &&
      this.settings.settingsActiveTab !== "orchestration" &&
      this.settings.settingsActiveTab !== "skills" &&
      this.settings.settingsActiveTab !== "parser" &&
      this.settings.settingsActiveTab !== "guide"
    ) {
      this.settings.settingsActiveTab = DEFAULT_SETTINGS.settingsActiveTab;
    }
    if ((this.settings as { settingsActiveTab?: string }).settingsActiveTab === "workflow") {
      this.settings.settingsActiveTab = "analyzed";
    }

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
    try {
      this.settings.backupRootPath = this.resolveSafeFolderPath(
        this.settings.backupRootPath,
        DEFAULT_SETTINGS.backupRootPath,
        "Backup root",
      );
    } catch {
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
      this.settings.forceAllToAllLinkedEnabled =
        DEFAULT_SETTINGS.forceAllToAllLinkedEnabled;
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
    if (typeof this.settings.qaAllowedOutboundHosts !== "string") {
      this.settings.qaAllowedOutboundHosts = DEFAULT_SETTINGS.qaAllowedOutboundHosts;
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
    if (
      this.settings.qaPreferredResponseLanguage !== "auto" &&
      this.settings.qaPreferredResponseLanguage !== "korean" &&
      this.settings.qaPreferredResponseLanguage !== "english"
    ) {
      this.settings.qaPreferredResponseLanguage =
        DEFAULT_SETTINGS.qaPreferredResponseLanguage;
    }
    const presetProfile = this.settings.qaLocalPresetProfile;
    if (
      presetProfile !== "fast_local" &&
      presetProfile !== "balanced_local" &&
      presetProfile !== "quality_local" &&
      presetProfile !== "custom"
    ) {
      this.settings.qaLocalPresetProfile = DEFAULT_SETTINGS.qaLocalPresetProfile;
    }
    if (
      this.settings.qaConversationMode !== "ask" &&
      this.settings.qaConversationMode !== "plan" &&
      this.settings.qaConversationMode !== "agent" &&
      this.settings.qaConversationMode !== "orchestration"
    ) {
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
      (option) => option.value === this.settings.qaRolePreset,
    );
    if (!rolePresetValid) {
      this.settings.qaRolePreset = DEFAULT_SETTINGS.qaRolePreset;
    }
    const pipelinePresetValid = QA_PIPELINE_PRESET_OPTIONS.some(
      (option) => option.value === this.settings.qaPipelinePreset,
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
      this.settings.qaImageGeneratorSystemPrompt =
        DEFAULT_SETTINGS.qaImageGeneratorSystemPrompt;
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
    const promptFields: Array<keyof KnowledgeWeaverSettings> = [
      "qaCustomSystemPrompt",
      "qaAskSystemPrompt",
      "qaAskVisionSystemPrompt",
      "qaImageGeneratorSystemPrompt",
      "qaCoderSystemPrompt",
      "qaDebuggerSystemPrompt",
      "qaArchitectSystemPrompt",
      "qaOrchestratorSystemPrompt",
      "qaSafeguardSystemPrompt",
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
      this.settings.qaThreadAutoSyncEnabled =
        DEFAULT_SETTINGS.qaThreadAutoSyncEnabled;
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
      Math.min(300, Math.floor(this.settings.qaAgentShellTimeoutSec)),
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
    if (
      this.settings.qaParserMode !== "fast" &&
      this.settings.qaParserMode !== "detailed"
    ) {
      this.settings.qaParserMode = DEFAULT_SETTINGS.qaParserMode;
    }
    this.settings.qaPdfAttachmentEnabled = true;
    if (typeof this.settings.qaAttachmentIngestRootPath !== "string") {
      this.settings.qaAttachmentIngestRootPath = DEFAULT_SETTINGS.qaAttachmentIngestRootPath;
    }
    this.settings.qaAttachmentIngestRootPath = normalizePath(
      this.settings.qaAttachmentIngestRootPath.trim()
        || DEFAULT_SETTINGS.qaAttachmentIngestRootPath,
    );
    if (this.settings.qaAgentShellCwdPath.trim()) {
      try {
        this.settings.qaAgentShellCwdPath = this.sanitizeQaShellCwdPath(
          this.settings.qaAgentShellCwdPath,
        );
      } catch {
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
    } catch {
      this.settings.mocPath = DEFAULT_SETTINGS.mocPath;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private setStatus(text: string): void {
    this.statusBarEl?.setText(`Auto Link: ${text}`);
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

  private readRawFrontmatterTags(frontmatter: Record<string, unknown>): string[] {
    const value = frontmatter.tags;
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }

  private parseModelSizeB(modelName: string): number | null {
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

  private estimateRecommendedSelectionMax(modelName: string): number {
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

  private getAnalysisCachePath(): string {
    return normalizePath(
      `${this.app.vault.configDir}/plugins/auto-link/${ANALYSIS_CACHE_FILE}`,
    );
  }

  private async cleanupLegacyCacheArtifacts(): Promise<void> {
    const legacyFiles = [
      normalizePath("Auto-Linker Cache/analysis-proposal-cache.json"),
      normalizePath("Auto-Linker Cache/semantic-embedding-cache.json"),
    ];

    for (const path of legacyFiles) {
      try {
        if (await this.app.vault.adapter.exists(path)) {
          await this.app.vault.adapter.remove(path);
        }
      } catch {
        // ignore cleanup failures; legacy cache removal is best-effort only
      }
    }

    const legacyFolder = normalizePath("Auto-Linker Cache");
    try {
      if (!(await this.app.vault.adapter.exists(legacyFolder))) {
        return;
      }
      const listing = await this.app.vault.adapter.list(legacyFolder);
      if (listing.files.length === 0 && listing.folders.length === 0) {
        await this.app.vault.adapter.rmdir(legacyFolder, false);
      }
    } catch {
      // ignore cleanup failures
    }
  }

  private getProviderCacheSignature(): string {
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

  private hashString(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  private buildAnalysisCacheKey(providerSignature: string, filePath: string): string {
    return `${providerSignature}::${filePath}`;
  }

  private buildAnalysisRequestSignature(
    providerSignature: string,
    request: AnalysisRequestSignatureInput,
  ): string {
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
      includeReasons: request.includeReasons,
    });
    return this.hashString(payload);
  }

  private buildAnalysisSettingsSignature(providerSignature: string): string {
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
      semanticMaxChars: this.settings.semanticMaxChars,
    });
    return this.hashString(payload);
  }

  private buildSelectionSignature(selectedFiles: TFile[]): string {
    const payload = JSON.stringify(selectedFiles.map((file) => file.path));
    return this.hashString(payload);
  }

  private canSkipByChangedOnlyMode(
    cache: AnalysisCacheData,
    cacheKey: string,
    file: TFile,
    settingsSignature: string,
    selectionSignature: string,
  ): boolean {
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

  private async loadAnalysisCache(): Promise<AnalysisCacheData> {
    if (this.analysisCache) {
      return this.analysisCache;
    }

    const path = this.getAnalysisCachePath();
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      this.analysisCache = {
        version: ANALYSIS_CACHE_VERSION,
        entries: {},
      };
      this.analysisCacheDirty = false;
      return this.analysisCache;
    }

    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as Partial<AnalysisCacheData>;
      const version =
        typeof parsed.version === "number" ? parsed.version : ANALYSIS_CACHE_VERSION;
      const entries =
        parsed.entries && typeof parsed.entries === "object"
          ? (parsed.entries as Record<string, AnalysisCacheEntry>)
          : {};

      if (version !== ANALYSIS_CACHE_VERSION) {
        this.analysisCache = {
          version: ANALYSIS_CACHE_VERSION,
          entries: {},
        };
      } else {
        this.analysisCache = {
          version,
          entries,
        };
      }
      this.analysisCacheDirty = false;
      return this.analysisCache;
    } catch {
      this.analysisCache = {
        version: ANALYSIS_CACHE_VERSION,
        entries: {},
      };
      this.analysisCacheDirty = false;
      return this.analysisCache;
    }
  }

  private pruneAnalysisCache(cache: AnalysisCacheData): void {
    const entries = Object.entries(cache.entries);
    if (entries.length <= ANALYSIS_CACHE_MAX_ENTRIES) {
      return;
    }

    entries.sort((a, b) => {
      const aTime = Date.parse(a[1]?.updatedAt ?? "") || 0;
      const bTime = Date.parse(b[1]?.updatedAt ?? "") || 0;
      return aTime - bTime || a[0].localeCompare(b[0]);
    });

    const overflow = entries.length - ANALYSIS_CACHE_MAX_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
      delete cache.entries[entries[i][0]];
    }
  }

  private async flushAnalysisCache(): Promise<void> {
    if (!this.analysisCache || !this.analysisCacheDirty) {
      return;
    }

    this.pruneAnalysisCache(this.analysisCache);
    const path = this.getAnalysisCachePath();
    await this.ensureParentFolder(path);
    await this.app.vault.adapter.write(path, JSON.stringify(this.analysisCache));
    this.analysisCacheDirty = false;
  }

  private getCachedAnalysisOutcome(
    cache: AnalysisCacheData,
    cacheKey: string,
    requestSignature: string,
    file: TFile,
    settingsSignature: string,
    selectionSignature: string,
  ): AnalyzeOutcome | null {
    const entry = cache.entries[cacheKey];
    if (
      !entry ||
      entry.requestSignature !== requestSignature ||
      entry.mtime !== file.stat.mtime ||
      entry.size !== file.stat.size
    ) {
      return null;
    }

    if (
      entry.settingsSignature !== settingsSignature ||
      entry.selectionSignature !== selectionSignature
    ) {
      entry.settingsSignature = settingsSignature;
      entry.selectionSignature = selectionSignature;
      entry.updatedAt = new Date().toISOString();
      this.analysisCacheDirty = true;
    }

    return {
      proposal: cloneMetadataProposal(entry.proposal),
      meta: {
        ...cloneSuggestionMeta(entry.meta),
        elapsedMs: 0,
      },
    };
  }

  private storeAnalysisOutcome(
    cache: AnalysisCacheData,
    cacheKey: string,
    requestSignature: string,
    settingsSignature: string,
    selectionSignature: string,
    file: TFile,
    outcome: AnalyzeOutcome,
  ): void {
    cache.entries[cacheKey] = {
      requestSignature,
      settingsSignature,
      selectionSignature,
      mtime: file.stat.mtime,
      size: file.stat.size,
      proposal: cloneMetadataProposal(outcome.proposal),
      meta: cloneSuggestionMeta(outcome.meta),
      updatedAt: new Date().toISOString(),
    };
    this.analysisCacheDirty = true;
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

  private parseQaAllowedOutboundHosts(): string[] {
    return this.settings.qaAllowedOutboundHosts
      .split(/[\n,]/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
  }

  private isHostAllowedByPolicy(hostname: string, allowlist: string[]): boolean {
    const host = hostname.trim().toLowerCase();
    if (!host) {
      return false;
    }
    return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }

  private validateQaEndpointPolicy(qaBaseUrl: string): string | null {
    if (this.isLocalEndpoint(qaBaseUrl)) {
      return null;
    }
    if (!this.settings.qaAllowNonLocalEndpoint) {
      return "Blocked by security policy: Q&A endpoint must be localhost unless explicitly allowed.";
    }
    let parsed: URL;
    try {
      parsed = new URL(qaBaseUrl);
    } catch {
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

  private resolveQaBaseUrl(): string {
    const qa = this.settings.qaOllamaBaseUrl.trim();
    const fallback = this.settings.ollamaBaseUrl.trim();
    return qa || fallback;
  }

  private resolveQaModel(): string {
    return this.resolveQaModelForRole(this.resolveQaPrimaryRole());
  }

  private trimTextForContext(source: string, maxChars: number): string {
    const collapsed = source.replace(/\s+/g, " ").trim();
    return collapsed.slice(0, Math.max(400, maxChars));
  }

  isAbortError(error: unknown): boolean {
    if (!error) {
      return false;
    }
    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
      return error.name === "AbortError";
    }
    if (error instanceof Error) {
      return (
        error.name === "AbortError" ||
        /aborted|abort/i.test(error.message)
      );
    }
    return false;
  }

  private emitQaEvent(
    onEvent: ((event: LocalQaProgressEvent) => void) | undefined,
    stage: LocalQaProgressStage,
    message: string,
    options: { detail?: string; thinkingChunk?: string } = {},
  ): void {
    if (!onEvent) {
      return;
    }
    onEvent({
      stage,
      message,
      detail: options.detail,
      thinkingChunk: options.thinkingChunk,
      timestamp: new Date().toISOString(),
    });
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

  private countTermMatches(text: string, terms: string[]): number {
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

  private detectLocalQaIntent(question: string): LocalQaResponseIntent {
    const normalized = question.toLowerCase();
    if (
      /(출처|근거|source|sources|reference|references|링크만|links?\s+only|only\s+links|cite)/i
        .test(normalized)
    ) {
      return "sources_only";
    }
    if (
      /(비교|차이|장단점|vs\b|versus|compare|comparison|trade[- ]?off|선택지)/i
        .test(normalized)
    ) {
      return "comparison";
    }
    if (
      /(계획|플랜|로드맵|체크리스트|준비|실행|우선순위|plan|roadmap|checklist|todo|action\s+plan)/i
        .test(normalized)
    ) {
      return "plan";
    }
    return "default";
  }

  private resolveQaRetrievalCandidateK(intent: LocalQaResponseIntent, topK: number): number {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(topK * 8, 28);
    }
    if (intent === "sources_only") {
      return Math.max(topK * 5, 24);
    }
    return Math.max(topK * 6, 24);
  }

  private resolveQaRerankTopK(intent: LocalQaResponseIntent, topK: number): number {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(topK * 3, topK + 4);
    }
    if (intent === "sources_only") {
      return Math.max(topK * 2, 6);
    }
    return Math.max(topK * 2, topK);
  }

  private resolveQaContextCharLimit(intent: LocalQaResponseIntent): number {
    if (intent === "comparison" || intent === "plan") {
      return Math.max(3200, this.settings.qaMaxContextChars);
    }
    if (intent === "sources_only") {
      return Math.max(2200, this.settings.qaMaxContextChars);
    }
    return Math.max(2000, this.settings.qaMaxContextChars);
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
      const matched = this.countTermMatches(lowerPath, terms);
      const boost = Math.min(0.09, matched * 0.03);
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

  private splitSourceIntoContextBlocks(source: string): Array<{
    index: number;
    text: string;
    lower: string;
    heading: boolean;
  }> {
    const normalized = source.replace(/\r\n/g, "\n");
    const rawBlocks = normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    const mergedBlocks: string[] = [];
    for (let i = 0; i < rawBlocks.length; i += 1) {
      let segment = rawBlocks[i];
      if (
        /^#{1,6}\s/.test(segment) &&
        i + 1 < rawBlocks.length &&
        !/^#{1,6}\s/.test(rawBlocks[i + 1])
      ) {
        segment = `${segment}\n${rawBlocks[i + 1]}`;
        i += 1;
      }

      if (segment.length <= 1700) {
        mergedBlocks.push(segment);
        continue;
      }

      const lines = segment.split("\n");
      let chunk = "";
      for (const line of lines) {
        const candidate = chunk ? `${chunk}\n${line}` : line;
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
      heading: /^#{1,6}\s/.test(text),
    }));
  }

  private extractRelevantSnippet(
    source: string,
    query: string,
    maxChars: number,
  ): string {
    const terms = this.tokenizeQuery(query);
    const blocks = this.splitSourceIntoContextBlocks(source);

    if (terms.length === 0 || blocks.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }

    const queryLower = query.trim().toLowerCase();
    const scored = blocks
      .map((block) => {
        let score = this.countTermMatches(block.lower, terms);
        if (block.heading) {
          score += 0.35;
        }
        if (queryLower.length >= 8 && block.lower.includes(queryLower.slice(0, 64))) {
          score += 0.6;
        }
        return { idx: block.index, score };
      })
      .filter((item) => item.score > 0);

    if (scored.length === 0) {
      return this.trimTextForContext(source, maxChars);
    }

    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    const pickedIndexes = new Set<number>();
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
      const candidate =
        output.length > 0
          ? `${output}\n\n---\n\n${segment}`
          : segment;
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

  private hasMarkdownTable(answer: string): boolean {
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

  private hasChecklist(answer: string): boolean {
    return /^\s*[-*]\s+\[[ xX]\]\s+/m.test(answer);
  }

  private hasSourceLinkList(answer: string): boolean {
    const matches = answer.match(
      /^\s*[-*]\s+.*(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/gm,
    );
    return (matches?.length ?? 0) > 0;
  }

  private needsQaStructureRepair(intent: LocalQaResponseIntent, answer: string): boolean {
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

  private shouldPreferDetailedAnswer(
    question: string,
    intent: LocalQaResponseIntent,
  ): boolean {
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

  private needsQaDepthRepair(
    intent: LocalQaResponseIntent,
    answer: string,
    preferDetailed: boolean,
  ): boolean {
    if (!preferDetailed || intent === "sources_only") {
      return false;
    }
    const compact = answer.replace(/\s+/g, " ").trim();
    if (!compact) {
      return true;
    }
    const paragraphCount = answer
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0).length;
    const bulletCount = (answer.match(/^\s*[-*]\s+/gm) ?? []).length;
    const minChars = Math.max(140, this.settings.qaMinAnswerChars);
    if (compact.length < minChars) {
      return true;
    }
    if (paragraphCount < 2 && bulletCount < 4) {
      return true;
    }
    return false;
  }

  private getQaContractLines(
    intent: LocalQaResponseIntent,
    preferDetailed: boolean,
  ): string[] {
    if (intent === "comparison") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence conclusion.",
        "- Include at least one markdown table for comparison.",
        "- After the table, add key trade-offs and recommendation.",
        "- If information is missing, fill with '정보 부족' and explain briefly.",
      ];
    }
    if (intent === "plan") {
      return [
        "Output contract:",
        "- Start with 2-3 sentence overview.",
        "- Include a checklist using '- [ ]' format.",
        "- Add priority or order hints for each checklist item.",
        "- Add short rationale for critical steps and risks.",
      ];
    }
    if (intent === "sources_only") {
      return [
        "Output contract:",
        "- Return source links only (bullet list).",
        "- No extra narrative unless required for missing evidence.",
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
        "- Avoid one-line answers unless user explicitly asks for brevity.",
      ];
    }
    return [
      "Output contract:",
      "- Start with a direct answer in 1-3 sentences.",
      "- Add concise synthesis only when useful.",
    ];
  }

  private buildLocalQaSourceContext(
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>,
  ): string {
    return sourceBlocks
      .map((item, index) => {
        const sourceType = item.path.startsWith("[ATTACHMENT-")
          || item.content.startsWith("Attachment document (PRIMARY EVIDENCE)")
          ? "attachment"
          : "selected-note";
        return `Source ${index + 1}\nType: ${sourceType}\nPath: ${item.path}\nSimilarity: ${formatSimilarity(item.similarity)}\nContent:\n${item.content}`;
      })
      .join("\n\n---\n\n");
  }

  private shouldIncludeSelectionInventory(
    question: string,
    selectedCount: number,
    intent: LocalQaResponseIntent,
  ): boolean {
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
    if (
      /(전체|모든|파일\s*목록|목록|리스트|요약표|테이블|표로|all\s+files?|file\s+list|inventory|table)/i.test(
        normalized,
      )
    ) {
      return true;
    }
    return false;
  }

  private buildSelectionInventoryContext(files: TFile[]): string {
    const maxFiles = Math.max(20, Math.min(600, this.settings.qaSelectionInventoryMaxFiles));
    const charBudget = Math.max(1800, Math.min(12000, Math.floor(this.settings.qaMaxContextChars * 0.6)));
    const lines: string[] = [];
    lines.push(`Total selected files: ${files.length}`);
    lines.push("Listed files: 0");
    lines.push("");

    let listed = 0;
    for (const file of files.slice(0, maxFiles)) {
      const frontmatter =
        (this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
      const tags = this.readRawFrontmatterTags(frontmatter).slice(0, 6).join(", ");
      const topic =
        typeof frontmatter.topic === "string" ? frontmatter.topic.trim() : "";
      const index =
        typeof frontmatter.index === "string" ? frontmatter.index.trim() : "";
      const row =
        `- path=${file.path} | size=${file.stat.size} | mtime=${new Date(file.stat.mtime).toISOString()} | tags=${tags || "(none)"} | topic=${topic || "(none)"} | index=${index || "(none)"}`;
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

  private isOrchestrationTask(question: string, intent: LocalQaResponseIntent): boolean {
    if (intent === "plan" || intent === "comparison") {
      return true;
    }
    const normalized = question.toLowerCase();
    return /(계획서|보고서|ppt|슬라이드|발표|수업|교안|학습\s*게임|게임\s*개발|roadmap|plan|report|presentation|slides|lesson|game\s*design|project\s*plan)/i
      .test(normalized);
  }

  private resolveQaPrimaryRole(): QaRolePreset {
    return this.settings.qaRolePreset;
  }

  private getQaRoleModelOverride(role: QaRolePreset): string {
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

  private resolveQaModelForRole(role: QaRolePreset): string {
    const roleModel = this.getQaRoleModelOverride(role).trim();
    const qa = this.settings.qaOllamaModel.trim();
    const fallback = this.settings.ollamaModel.trim();
    return roleModel || qa || fallback;
  }

  private isVisionCapableModel(modelName: string): boolean {
    return VISION_MODEL_REGEX.test(modelName.toLowerCase());
  }

  private resolveVisionModelForImageAttachments(): string | null {
    const detected = this.getDetectedOllamaModelNames();
    const isDetectedOrUnknown = (model: string): boolean =>
      detected.length === 0 || detected.includes(model);

    const explicitVision = this.settings.qaAskVisionModel.trim();
    if (
      explicitVision &&
      this.isVisionCapableModel(explicitVision) &&
      isDetectedOrUnknown(explicitVision)
    ) {
      return explicitVision;
    }

    const roleOptions = this.getRoleModelOptionsForQa("ask_vision");
    const recommendedVision = roleOptions
      .filter((option) => option.status !== "unavailable")
      .map((option) => option.model)
      .sort((a, b) => {
        const aLlamaVision = /llama3\.2-vision/i.test(a);
        const bLlamaVision = /llama3\.2-vision/i.test(b);
        if (aLlamaVision !== bLlamaVision) {
          return aLlamaVision ? -1 : 1;
        }
        return a.localeCompare(b);
      })
      .find((model) =>
        this.isVisionCapableModel(model) && isDetectedOrUnknown(model)
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

    const detectedVision = detected
      .filter((name) => this.isVisionCapableModel(name))
      .sort((a, b) => {
        const aLlamaVision = /llama3\.2-vision/i.test(a);
        const bLlamaVision = /llama3\.2-vision/i.test(b);
        if (aLlamaVision !== bLlamaVision) {
          return aLlamaVision ? -1 : 1;
        }
        return a.localeCompare(b);
      });
    return detectedVision[0] ?? null;
  }

  private shouldUseLightweightQaPipeline(
    question: string,
    intent: LocalQaResponseIntent,
  ): boolean {
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

    const complexitySignals =
      /(계획서|보고서|로드맵|발표|아키텍처|구조|구현|리팩터|디버그|오류 분석|체크리스트|단계별|pipeline|orchestrator|roadmap|report|architecture|design|debug|refactor|checklist|step[- ]by[- ]step|trade[- ]?off)/i;
    if (complexitySignals.test(normalized)) {
      return false;
    }

    const directQuestionSignals =
      /(무엇|뭐야|뜻|정의|요약|간단|짧게|한줄|차이|why|what is|meaning|summary|brief|quick answer|difference)/i;
    if (directQuestionSignals.test(normalized)) {
      return true;
    }

    return normalized.split(/\s+/).length <= 14;
  }

  private shouldRunOrchestratorPassLegacy(
    question: string,
    intent: LocalQaResponseIntent,
  ): boolean {
    if (this.settings.qaRolePreset === "orchestrator") {
      return true;
    }
    if (!this.settings.qaOrchestratorEnabled) {
      return false;
    }
    return this.isOrchestrationTask(question, intent);
  }

  private shouldRunSafeguardPassLegacy(
    question: string,
    intent: LocalQaResponseIntent,
  ): boolean {
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
    return /(보안|security|개인정보|privacy|위험|risk|규정|compliance|정책|safety)/i
      .test(normalized);
  }

  private shouldRunRolePresetRefinementForRole(role: QaRolePreset): boolean {
    return role === "coder" || role === "architect" || role === "debugger";
  }

  private resolveLegacyAutoPipelineStages(
    question: string,
    intent: LocalQaResponseIntent,
  ): LocalQaPipelineStage[] {
    const stages: LocalQaPipelineStage[] = [];
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

  private resolveOrchestratorAutoRouteStages(
    question: string,
    intent: LocalQaResponseIntent,
  ): LocalQaPipelineStage[] {
    const stages: LocalQaPipelineStage[] = ["orchestrator"];
    const normalized = question.toLowerCase();

    const debugSignals =
      /(버그|오류|에러|예외|실패|고장|재현|원인|로그|debug|bug|error|exception|trace|crash|failure)/i;
    const codingSignals =
      /(코드|구현|함수|클래스|리팩터|테스트|스크립트|쿼리|api|endpoint|typescript|javascript|python|sql|regex|algorithm|implement|code|refactor|test)/i;
    const architectureSignals =
      /(아키텍처|설계|구조|시스템|모듈|컴포넌트|인터페이스|확장성|trade[- ]?off|architecture|design|scalability|boundary|topology|pattern)/i;
    const safeguardSignals =
      /(보안|개인정보|규정|정책|위험|컴플라이언스|security|privacy|compliance|policy|risk|safety)/i;

    const wantsDebug = debugSignals.test(normalized);
    const wantsCoding = codingSignals.test(normalized);
    const wantsArchitecture =
      architectureSignals.test(normalized) || intent === "plan" || intent === "comparison";
    const wantsSafeguard = safeguardSignals.test(normalized);

    if (wantsArchitecture) {
      stages.push("architect");
    }
    if (wantsDebug) {
      stages.push("debugger");
    } else if (wantsCoding) {
      stages.push("coder");
    }
    if (
      wantsSafeguard ||
      intent === "plan" ||
      intent === "comparison" ||
      this.settings.qaSafeguardPassEnabled ||
      stages.length === 1
    ) {
      stages.push("safeguard");
    }

    return [...new Set(stages)];
  }

  private resolveQaPipelineStages(
    question: string,
    intent: LocalQaResponseIntent,
  ): LocalQaPipelineStage[] {
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

  private buildRolePresetRefinementInstruction(role: QaRolePreset): string {
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

  private getQaRolePresetInstruction(role: QaRolePreset): string {
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

  private getQaRoleSystemPrompt(role: QaRolePreset): string {
    return this.getQaRoleSystemPromptForQa(role).trim();
  }

  private getQaPreferredLanguageInstruction(): string {
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

  private isLikelyKoreanResponse(text: string): boolean {
    const value = text.trim();
    if (!value) {
      return false;
    }
    const hangulMatches = value.match(/[가-힣]/g) ?? [];
    const latinMatches = value.match(/[A-Za-z]/g) ?? [];
    if (hangulMatches.length >= 18) {
      return true;
    }
    if (hangulMatches.length === 0) {
      return false;
    }
    return hangulMatches.length >= Math.max(8, Math.floor(latinMatches.length * 0.35));
  }

  private async enforcePreferredLanguageIfNeeded(params: {
    answer: string;
    question: string;
    qaBaseUrl: string;
    qaModel: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
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
      "Answer language drift detected; retrying final output in Korean.",
    );
    const systemPrompt = [
      "You are a strict Korean localization editor.",
      "Return Korean only.",
      "Preserve markdown structure, bullet order, checkboxes, tables, and source citations.",
      "Do not add new facts; if uncertain keep original uncertainty wording.",
      "Keep code blocks and inline code as-is unless plain-language comments require translation.",
      "Output only the localized final answer.",
    ].join("\n");
    const userPrompt = [
      `Original user question: ${question}`,
      "",
      "Rewrite the following answer in Korean:",
      trimmed,
    ].join("\n");

    try {
      const localized = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history: [],
        onEvent,
        abortSignal,
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
        detail: message,
      });
      return answer;
    }
  }

  private getQaAgentToolInstructionLines(): string[] {
    if (!this.settings.qaAgentToolModeEnabled) {
      return [];
    }
    const allowlist = this.parseQaAgentAbsoluteAllowlist();
    const fullAccess = this.settings.qaAgentShellFullAccess;
    const allowlistText =
      allowlist.length > 0 ? allowlist.join(", ") : "(vault only)";
    const shellLine = this.settings.qaAgentAllowShellTool
      ? "- run_shell: execute a local shell command (`command` required, `cwd` optional)."
      : "- run_shell: unavailable (disabled by settings).";
    const shellScopeLine = fullAccess
      ? "Shell access scope: FULL ACCESS enabled (danger). Any absolute cwd is allowed."
      : `Shell allowlist roots: ${allowlistText}`;
    return [
      "Agent tool mode is enabled.",
      shellScopeLine,
      "If an action is required, append ONE fenced code block using language `auto-link-actions` and strict JSON:",
      "{ \"actions\": [ ... ] }",
      "Supported actions:",
      "- read_note: read file content (`path` required; vault-relative or allowed absolute path).",
      "- write_note: overwrite/create file (`path`, `content` required; vault-relative or allowed absolute path).",
      "- append_note: append to file (`path`, `content` required; vault-relative or allowed absolute path).",
      "- list_folder: list folder (`path` required; use \".\" for vault root, or allowed absolute path).",
      shellLine,
      "Action schema examples:",
      "{ \"type\": \"read_note\", \"path\": \"Projects/TODO.md\" }",
      "{ \"type\": \"read_note\", \"path\": \"/absolute/path/project/README.md\" }",
      "{ \"type\": \"write_note\", \"path\": \"Projects/plan.md\", \"content\": \"# Plan\" }",
      "{ \"type\": \"append_note\", \"path\": \"Daily/2026-02-16.md\", \"content\": \"\\n- done\" }",
      "{ \"type\": \"list_folder\", \"path\": \".\" }",
      "{ \"type\": \"run_shell\", \"command\": \"npm run check\", \"cwd\": \"obsidian-plugin/auto-link\", \"timeoutSec\": 20 }",
      "When actions are included, keep non-action answer brief and focused.",
      "Never include multiple action blocks.",
    ];
  }

  private buildLocalQaSystemPrompt(
    intent: LocalQaResponseIntent,
    preferDetailed: boolean,
    hasSourceContext: boolean,
    roleOverride?: QaRolePreset,
  ): string {
    const role = roleOverride ?? this.resolveQaPrimaryRole();
    const toneLine = preferDetailed
      ? "Keep tone natural, direct, and sufficiently detailed."
      : "Keep tone natural, direct, and concise.";
    return [
      "You are a local-note assistant for Obsidian.",
      hasSourceContext
        ? "Answer only from the provided sources."
        : "No note sources were provided for this turn. You may answer from general knowledge with explicit uncertainty notes.",
      this.getQaPreferredLanguageInstruction(),
      ...this.getQaAgentToolInstructionLines(),
      this.getQaRolePresetInstruction(role),
      toneLine,
      "Output in markdown.",
      hasSourceContext
        ? "When making claims, cite source paths inline in parentheses."
        : "Do not fabricate source citations when no source context is provided.",
      "If evidence is insufficient, state it clearly and do not invent facts.",
      ...this.getQaContractLines(intent, preferDetailed),
      this.getQaRoleSystemPrompt(role)
        ? `Role system prompt (${role}):\n${this.getQaRoleSystemPrompt(role)}`
        : "",
      this.settings.qaCustomSystemPrompt.trim()
        ? `Custom system prompt:\n${this.settings.qaCustomSystemPrompt.trim()}`
        : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  }

  private buildLocalQaUserPrompt(
    question: string,
    sourceContext: string,
    selectionInventoryContext?: string,
    attachmentLabels: string[] = [],
  ): string {
    const sourceBlock = sourceContext.trim() || "(no source excerpts provided)";
    const hasVisionAttachment = attachmentLabels.some(
      (label) => label.startsWith("[IMG]") || label.startsWith("[PDF]"),
    );
    const attachmentBlock =
      attachmentLabels.length > 0
        ? [
            "",
            "Attachments for this turn (highest priority evidence):",
            ...attachmentLabels.map((label) => `- ${label}`),
          ]
        : [];
    const attachmentPriorityLine =
      attachmentLabels.length > 0
        ? "Priority rule (strict): treat attachments as PRIMARY evidence. Use selected-note excerpts only as SECONDARY fallback when attachment evidence is missing."
        : "";
    const imageHandlingLine = hasVisionAttachment
      ? "Image/PDF attachments are already included in this request. Do not ask user for local file paths."
      : "";
    const inventoryBlock = selectionInventoryContext?.trim()
      ? ["", "Selection inventory metadata:", selectionInventoryContext.trim()]
      : [];
    return [
      `Question: ${question}`,
      "",
      attachmentPriorityLine,
      imageHandlingLine,
      "Sources:",
      sourceBlock,
      ...attachmentBlock,
      ...inventoryBlock,
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  }

  private buildLocalQaGeneratePrompt(
    systemPrompt: string,
    userPrompt: string,
    history: LocalQAConversationTurn[],
  ): string {
    const historyText =
      history.length > 0
        ? history
            .slice(-6)
            .map(
              (turn) =>
                `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.text}`,
            )
            .join("\n")
        : "(none)";

    return [
      "System instructions:",
      systemPrompt,
      "",
      "Conversation so far:",
      historyText,
      "",
      userPrompt,
    ].join("\n");
  }

  private buildLocalQaChatMessages(
    systemPrompt: string,
    userPrompt: string,
    history: LocalQAConversationTurn[],
    userImages: string[] = [],
  ): Array<{
    role: "system" | "user" | "assistant";
    content: string;
    images?: string[];
  }> {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
      images?: string[];
    }> = [
      { role: "system", content: systemPrompt },
    ];
    for (const turn of history.slice(-6)) {
      messages.push({
        role: turn.role,
        content: turn.text,
      });
    }
    messages.push({
      role: "user",
      content: userPrompt,
      images: userImages.length > 0 ? userImages : undefined,
    });
    return messages;
  }

  private extractOllamaTokenChunk(payload: Record<string, unknown>): {
    token: string;
    thinking: string;
  } {
    let token = "";
    let thinking = "";

    const message = payload.message;
    if (message && typeof message === "object") {
      const parsed = message as Record<string, unknown>;
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

  private async consumeOllamaJsonLineStream(
    body: ReadableStream<Uint8Array>,
    onToken?: (token: string) => void,
    onEvent?: (event: LocalQaProgressEvent) => void,
    abortSignal?: AbortSignal,
  ): Promise<{ answer: string; thinking: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let thinking = "";

    const throwIfAborted = (): void => {
      if (abortSignal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
    };
    const cancelReaderOnAbort = (): void => {
      void reader.cancel("aborted").catch(() => {
        // ignore reader cancellation errors
      });
    };
    abortSignal?.addEventListener("abort", cancelReaderOnAbort, { once: true });

    const consumeLine = (line: string): void => {
      throwIfAborted();
      if (!line) {
        return;
      }
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const chunk = this.extractOllamaTokenChunk(parsed);
        if (chunk.thinking) {
          thinking += chunk.thinking;
          this.emitQaEvent(onEvent, "thinking", "Model thinking chunk", {
            thinkingChunk: chunk.thinking,
          });
        }
        if (chunk.token) {
          answer += chunk.token;
          onToken?.(chunk.token);
        }
      } catch {
        // ignore malformed stream lines
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
      abortSignal?.removeEventListener("abort", cancelReaderOnAbort);
    }

    return { answer, thinking };
  }

  private async requestLocalQaGenerate(params: {
    qaBaseUrl: string;
    qaModel: string;
    prompt: string;
    images?: string[];
    onToken?: (token: string) => void;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<{ answer: string; thinking: string }> {
    const {
      qaBaseUrl,
      qaModel,
      prompt,
      images,
      onToken,
      onEvent,
      abortSignal,
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
          images: images && images.length > 0 ? images : undefined,
          stream: true,
        }),
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Local Q&A request failed: ${streamResponse.status}`);
      }
      return this.consumeOllamaJsonLineStream(
        streamResponse.body,
        onToken,
        onEvent,
        abortSignal,
      );
    }

    if (abortSignal) {
      const response = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          prompt,
          images: images && images.length > 0 ? images : undefined,
          stream: false,
        }),
      });
      if (!response.ok) {
        throw new Error(`Local Q&A request failed: ${response.status}`);
      }
      const raw = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }
      const chunk = this.extractOllamaTokenChunk(parsed);
      const answer = chunk.token.trim() || raw.trim();
      return {
        answer,
        thinking: chunk.thinking.trim(),
      };
    }

    const response = await requestUrl({
      url: `${base}/api/generate`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        prompt,
        images: images && images.length > 0 ? images : undefined,
        stream: false,
      }),
      throw: false,
    });
    if (response.status >= 300) {
      throw new Error(`Local Q&A request failed: ${response.status}`);
    }

    const parsed =
      response.json && typeof response.json === "object"
        ? (response.json as Record<string, unknown>)
        : {};
    const chunk = this.extractOllamaTokenChunk(parsed);
    const answer = chunk.token.trim() || response.text.trim();
    return {
      answer,
      thinking: chunk.thinking.trim(),
    };
  }

  private async requestLocalQaChat(params: {
    qaBaseUrl: string;
    qaModel: string;
    systemPrompt: string;
    userPrompt: string;
    history: LocalQAConversationTurn[];
    images?: string[];
    onToken?: (token: string) => void;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<{ answer: string; thinking: string }> {
    const {
      qaBaseUrl,
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      images,
      onToken,
      onEvent,
      abortSignal,
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
          stream: true,
        }),
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Local Q&A chat request failed: ${streamResponse.status}`);
      }
      return this.consumeOllamaJsonLineStream(
        streamResponse.body,
        onToken,
        onEvent,
        abortSignal,
      );
    }

    if (abortSignal) {
      const response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          model: qaModel,
          messages,
          stream: false,
        }),
      });
      if (!response.ok) {
        throw new Error(`Local Q&A chat request failed: ${response.status}`);
      }
      const raw = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }
      const chunk = this.extractOllamaTokenChunk(parsed);
      const answer = chunk.token.trim() || raw.trim();
      return {
        answer,
        thinking: chunk.thinking.trim(),
      };
    }

    const response = await requestUrl({
      url: `${base}/api/chat`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: qaModel,
        messages,
        stream: false,
      }),
      throw: false,
    });
    if (response.status >= 300) {
      throw new Error(`Local Q&A chat request failed: ${response.status}`);
    }
    const parsed =
      response.json && typeof response.json === "object"
        ? (response.json as Record<string, unknown>)
        : {};
    const chunk = this.extractOllamaTokenChunk(parsed);
    const answer = chunk.token.trim() || response.text.trim();
    return {
      answer,
      thinking: chunk.thinking.trim(),
    };
  }

  private async requestLocalQaCompletion(params: {
    qaBaseUrl: string;
    qaModel: string;
    systemPrompt: string;
    userPrompt: string;
    history: LocalQAConversationTurn[];
    images?: string[];
    onToken?: (token: string) => void;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<LocalQaCompletionPayload> {
    const {
      qaBaseUrl,
      qaModel,
      systemPrompt,
      userPrompt,
      history,
      images,
      onToken,
      onEvent,
      abortSignal,
    } = params;

    const hasImages = Boolean(images && images.length > 0);

    if (hasImages) {
      this.emitQaEvent(
        onEvent,
        "generation",
        "Image attachments detected; using /api/generate endpoint",
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
          abortSignal,
        });
        if (chatResult.answer.trim()) {
          return {
            ...chatResult,
            endpoint: "chat",
          };
        }
        this.emitQaEvent(onEvent, "warning", "/api/chat returned an empty answer", {
          detail: "Fallback to /api/generate",
        });
      } catch (error) {
        if (this.isAbortError(error)) {
          throw error;
        }
        const message =
          error instanceof Error ? error.message : "Unknown /api/chat error";
        this.emitQaEvent(onEvent, "warning", "Falling back to /api/generate", {
          detail: message,
        });
      }
    }

    this.emitQaEvent(onEvent, "generation", "Using /api/generate endpoint");
    const prompt = this.buildLocalQaGeneratePrompt(systemPrompt, userPrompt, history);
    let generateResult: { answer: string; thinking: string };
    try {
      generateResult = await this.requestLocalQaGenerate({
        qaBaseUrl,
        qaModel,
        prompt,
        images,
        onToken,
        onEvent,
        abortSignal,
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }
      if (images && images.length > 0) {
        const message =
          error instanceof Error ? error.message : "Unknown image generate error";
        this.emitQaEvent(onEvent, "warning", "Image input failed; retrying without images", {
          detail: message,
        });
        generateResult = await this.requestLocalQaGenerate({
          qaBaseUrl,
          qaModel,
          prompt,
          images: [],
          onToken,
          onEvent,
          abortSignal,
        });
      } else {
        throw error;
      }
    }
    return {
      ...generateResult,
      endpoint: "generate",
    };
  }

  private buildSourceOnlyFallback(
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>,
  ): string {
    const lines = sourceBlocks
      .slice(0, 8)
      .map((item) => `- [[${item.path}]] (${formatSimilarity(item.similarity)})`);
    return lines.length > 0 ? lines.join("\n") : "- (no sources)";
  }

  private async repairQaStructureIfNeeded(params: {
    intent: LocalQaResponseIntent;
    answer: string;
    question: string;
    preferDetailed: boolean;
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>;
    qaBaseUrl: string;
    qaModel: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
    const {
      intent,
      answer,
      question,
      preferDetailed,
      sourceBlocks,
      qaBaseUrl,
      qaModel,
      onEvent,
      abortSignal,
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
      ...this.getQaContractLines(intent, preferDetailed),
    ].join("\n");

    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      sourceContext,
    ].join("\n");

    try {
      const repaired = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal,
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
        detail: message,
      });
    }

    if (intent === "sources_only") {
      return this.buildSourceOnlyFallback(sourceBlocks);
    }
    return answer;
  }

  private resolvePassModelOrWarn(
    role: QaRolePreset,
    onEvent?: (event: LocalQaProgressEvent) => void,
  ): string | null {
    let model = this.resolveQaModelForRole(role).trim();
    if (!model) {
      this.emitQaEvent(onEvent, "warning", `Skipping ${role} pass: model is empty`);
      return null;
    }
    const detected = this.getDetectedOllamaModelNames();
    if (detected.length > 0 && !this.hasDetectedOllamaModel(model)) {
      const fallback = this.resolveDetectedRoleFallbackModel(role);
      if (fallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Pass model not detected (${model}); fallback to ${fallback}`,
        );
        model = fallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Skipping ${role} pass: model not detected (${model})`,
        );
        return null;
      }
    }
    if (!isOllamaModelAllowedForQaRole(role, model)) {
      this.emitQaEvent(
        onEvent,
        "warning",
        `Skipping ${role} pass: model is not suitable (${model})`,
      );
      return null;
    }
    return model;
  }

  private async applyOrchestratorPass(params: {
    question: string;
    answer: string;
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>;
    qaBaseUrl: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
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
      "When evidence is missing, explicitly mark as '정보 부족'.",
      "Use this structure when suitable:",
      "- Objective and scope",
      "- Core findings",
      "- Execution plan/checklist",
      "- Role coordination summary (architect/coder/debugger/safeguard: responsibility, output, handoff, unresolved)",
      "- Deliverables (report/PPT/materials/code)",
      "- Risks and safeguards",
      "- Next actions",
      roleSystemPrompt
        ? `Role system prompt (orchestrator):\n${roleSystemPrompt}`
        : "",
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks),
    ].join("\n");

    try {
      const improved = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal,
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

  private async applyRolePresetRefinementPass(params: {
    role: "coder" | "architect" | "debugger";
    question: string;
    answer: string;
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>;
    qaBaseUrl: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
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
      "Do not invent facts. Mark uncertain points as '정보 부족'.",
      this.buildRolePresetRefinementInstruction(role),
      "Return markdown only.",
      roleSystemPrompt ? `Role system prompt (${role}):\n${roleSystemPrompt}` : "",
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks),
    ].join("\n");

    try {
      const rewritten = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal,
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
        detail: message,
      });
      return answer;
    }
  }

  private async applySafeguardPass(params: {
    question: string;
    answer: string;
    sourceBlocks: Array<{ path: string; similarity: number; content: string }>;
    qaBaseUrl: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
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
      roleSystemPrompt ? `Role system prompt (safeguard):\n${roleSystemPrompt}` : "",
    ].join("\n");
    const userPrompt = [
      `Question: ${question}`,
      "",
      "Draft answer:",
      answer,
      "",
      "Source excerpts:",
      this.buildLocalQaSourceContext(sourceBlocks),
    ].join("\n");

    try {
      const verified = await this.requestLocalQaCompletion({
        qaBaseUrl,
        qaModel: passModel,
        systemPrompt,
        userPrompt,
        history: [],
        abortSignal,
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

  private async openLocalQaChatModal(): Promise<void> {
    await this.openLocalQaWorkspaceView();
  }

  private parseQaAgentApprovalCommand(question: string): "approve" | "deny" | null {
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

  private normalizeQaAgentAction(raw: unknown): LocalQaAgentAction | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const parsed = raw as Record<string, unknown>;
    if (typeof parsed.type !== "string") {
      return null;
    }
    const type = parsed.type.trim() as LocalQaAgentActionType;
    const allowedTypes: LocalQaAgentActionType[] = [
      "read_note",
      "write_note",
      "append_note",
      "list_folder",
      "run_shell",
    ];
    if (!allowedTypes.includes(type)) {
      return null;
    }
    const action: LocalQaAgentAction = { type };
    if (typeof parsed.path === "string") {
      action.path = parsed.path.trim();
    }
    if (typeof parsed.content === "string") {
      action.content = parsed.content;
    }
    if (typeof parsed.command === "string") {
      action.command = parsed.command.trim();
    }
    if (typeof parsed.cwd === "string") {
      action.cwd = parsed.cwd.trim();
    }
    if (typeof parsed.timeoutSec === "number" && Number.isFinite(parsed.timeoutSec)) {
      action.timeoutSec = Math.floor(parsed.timeoutSec);
    }
    return action;
  }

  private summarizeQaAgentAction(action: LocalQaAgentAction): string {
    switch (action.type) {
      case "read_note":
        return `read_note path=${action.path || "(missing)"}`;
      case "write_note":
        return `write_note path=${action.path || "(missing)"}`;
      case "append_note":
        return `append_note path=${action.path || "(missing)"}`;
      case "list_folder":
        return `list_folder path=${action.path || "(missing)"}`;
      case "run_shell":
        return `run_shell command=${action.command || "(missing)"}`;
      default:
        return action.type;
    }
  }

  private parseQaAgentActionPlanFromAnswer(params: {
    answer: string;
    question: string;
    model: string;
  }): {
    answerWithoutPlan: string;
    plan: LocalQaAgentActionPlan | null;
    warning?: string;
  } {
    const { answer, question, model } = params;
    const blockRegex = /```auto-link-actions\s*([\s\S]*?)```/i;
    const match = blockRegex.exec(answer);
    const answerWithoutPlan = answer.replace(blockRegex, "").trim();
    if (!match) {
      return { answerWithoutPlan: answer.trim(), plan: null };
    }

    const jsonText = match[1]?.trim() ?? "";
    if (!jsonText) {
      return {
        answerWithoutPlan,
        plan: null,
        warning: "Agent action block is empty.",
      };
    }

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const rawActions = Array.isArray(parsed.actions) ? parsed.actions : null;
      if (!rawActions || rawActions.length === 0) {
        return {
          answerWithoutPlan,
          plan: null,
          warning: "Agent action block has no actions array.",
        };
      }
      const normalized = rawActions
        .map((item) => this.normalizeQaAgentAction(item))
        .filter((item): item is LocalQaAgentAction => Boolean(item));
      if (normalized.length === 0) {
        return {
          answerWithoutPlan,
          plan: null,
          warning: "Agent action block contains unsupported action types.",
        };
      }
      const capped = normalized.slice(0, 8);
      const plan: LocalQaAgentActionPlan = {
        id: `qa-actions-${formatBackupStamp(new Date())}`,
        createdAt: new Date().toISOString(),
        model,
        question,
        actions: capped,
      };
      const warning =
        normalized.length > capped.length
          ? `Action count exceeded limit. Only first ${capped.length} actions were kept.`
          : undefined;
      return {
        answerWithoutPlan,
        plan,
        warning,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error";
      return {
        answerWithoutPlan,
        plan: null,
        warning: `Agent action JSON parse failed: ${message}`,
      };
    }
  }

  private buildQaActionApprovalText(plan: LocalQaAgentActionPlan): string {
    const lines = [
      "### Agent action plan / 에이전트 액션 계획",
      `Plan ID: ${plan.id}`,
      `Proposed by model: ${plan.model}`,
      `Created: ${plan.createdAt}`,
      "",
    ];
    for (let index = 0; index < plan.actions.length; index += 1) {
      lines.push(`${index + 1}. ${this.summarizeQaAgentAction(plan.actions[index])}`);
    }
    lines.push("");
    lines.push("실행하려면 `승인` 또는 `/approve` 를 입력하세요.");
    lines.push("취소하려면 `거부` 또는 `/deny` 를 입력하세요.");
    return lines.join("\n");
  }

  private trimQaToolText(text: string, maxChars: number): string {
    const normalized = text ?? "";
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, maxChars)}\n...(truncated ${normalized.length - maxChars} chars)`;
  }

  private resolveSafeQaAgentPath(rawPath: string, label: string): string {
    const normalized = normalizePath((rawPath ?? "").trim());
    if (!this.isSafeVaultRelativePath(normalized)) {
      throw new Error(`${label} must be a safe vault-relative path.`);
    }
    return normalized;
  }

  private getVaultBasePathForQaShell(): string {
    const adapter = this.app.vault.adapter as {
      getBasePath?: () => string;
    };
    if (typeof adapter.getBasePath !== "function") {
      throw new Error("Shell tool requires desktop filesystem vault adapter.");
    }
    const base = adapter.getBasePath();
    if (!base || typeof base !== "string") {
      throw new Error("Could not resolve vault base path for shell tool.");
    }
    return base;
  }

  private parseQaAgentAbsoluteAllowlist(): string[] {
    return this.settings.qaAgentPathAllowlist
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .filter((item) => item.startsWith("/") || /^[A-Za-z]:/.test(item))
      .map((item) => nodePath.resolve(item))
      .filter((item, index, arr) => arr.indexOf(item) === index);
  }

  private isPathInsideAnyAllowedRoot(resolvedPath: string, allowedRoots: string[]): boolean {
    return allowedRoots.some((root) => {
      const normalizedRoot = nodePath.resolve(root);
      const relative = nodePath.relative(normalizedRoot, resolvedPath);
      return relative === "" || (!relative.startsWith("..") && !nodePath.isAbsolute(relative));
    });
  }

  private isAbsoluteQaPath(pathValue: string): boolean {
    return pathValue.startsWith("/") || /^[A-Za-z]:/.test(pathValue);
  }

  private resolveQaAgentPathTarget(
    rawPath: string,
    label: string,
    kind: "file" | "folder",
  ): { mode: "vault"; path: string } | { mode: "absolute"; path: string } {
    const requested = (rawPath ?? "").trim();
    if (!requested) {
      throw new Error(`${label} is required.`);
    }
    if (!this.isAbsoluteQaPath(requested)) {
      if (kind === "folder") {
        return {
          mode: "vault",
          path: this.resolveSafeFolderPath(requested, ".", label),
        };
      }
      return {
        mode: "vault",
        path: this.resolveSafeQaAgentPath(requested, label),
      };
    }

    const resolved = nodePath.resolve(requested);
    if (this.settings.qaAgentShellFullAccess) {
      return {
        mode: "absolute",
        path: resolved,
      };
    }
    const allowedRoots = [
      nodePath.resolve(this.getVaultBasePathForQaShell()),
      ...this.parseQaAgentAbsoluteAllowlist(),
    ];
    if (!this.isPathInsideAnyAllowedRoot(resolved, allowedRoots)) {
      throw new Error(
        `${label} absolute path is blocked. Allowed roots: ${allowedRoots.join(", ") || "(none)"}`,
      );
    }
    return {
      mode: "absolute",
      path: resolved,
    };
  }

  sanitizeQaShellCwdPath(rawCwd: string): string {
    const requested = (rawCwd ?? "").trim();
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
          `Shell cwd must be inside allowlist roots: ${allowedRoots.join(", ") || "(none)"}`,
        );
      }
      return resolved;
    }
    return this.resolveSafeFolderPath(requested, ".", "Shell cwd");
  }

  private resolveQaShellCwd(rawCwd?: string): string {
    const basePath = this.getVaultBasePathForQaShell();
    const baseResolved = nodePath.resolve(basePath);
    const fullAccess = this.settings.qaAgentShellFullAccess;
    const allowedRoots = [baseResolved, ...this.parseQaAgentAbsoluteAllowlist()];
    const requested = (rawCwd ?? this.settings.qaAgentShellCwdPath ?? "").trim();
    if (!requested) {
      return baseResolved;
    }
    const sanitized = this.sanitizeQaShellCwdPath(requested);
    const resolved =
      sanitized.startsWith("/") || /^[A-Za-z]:/.test(sanitized)
        ? nodePath.resolve(sanitized)
        : nodePath.resolve(baseResolved, sanitized);
    if (fullAccess) {
      return resolved;
    }
    if (!this.isPathInsideAnyAllowedRoot(resolved, allowedRoots)) {
      throw new Error(
        `Shell cwd must stay inside vault or allowlist roots: ${allowedRoots.join(", ")}`,
      );
    }
    return resolved;
  }

  private async writeVaultTextFile(path: string, content: string): Promise<void> {
    await this.ensureParentFolder(path);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
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

  private async executeQaAgentAction(
    action: LocalQaAgentAction,
  ): Promise<LocalQaAgentActionResult> {
    try {
      if (action.type === "read_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "read_note.path",
          "file",
        );
        let content = "";
        if (target.mode === "vault") {
          const exists = await this.app.vault.adapter.exists(target.path);
          if (!exists) {
            return {
              status: "error",
              title: `read_note ${target.path}`,
              detail: "File does not exist.",
            };
          }
          content = await this.app.vault.adapter.read(target.path);
        } else {
          try {
            content = await nodeFs.promises.readFile(target.path, "utf8");
          } catch {
            return {
              status: "error",
              title: `read_note ${target.path}`,
              detail: "File does not exist or is not readable.",
            };
          }
        }
        return {
          status: "ok",
          title: `read_note ${target.path}`,
          detail: this.trimQaToolText(content, 2400),
        };
      }

      if (action.type === "write_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "write_note.path",
          "file",
        );
        const content = action.content ?? "";
        if (target.mode === "vault") {
          await this.writeVaultTextFile(target.path, content);
        } else {
          await nodeFs.promises.mkdir(nodePath.dirname(target.path), { recursive: true });
          await nodeFs.promises.writeFile(target.path, content, "utf8");
        }
        return {
          status: "ok",
          title: `write_note ${target.path}`,
          detail: `Wrote ${content.length} chars.`,
        };
      }

      if (action.type === "append_note") {
        const target = this.resolveQaAgentPathTarget(
          action.path || "",
          "append_note.path",
          "file",
        );
        const appendText = action.content ?? "";
        let previous = "";
        if (target.mode === "vault") {
          const exists = await this.app.vault.adapter.exists(target.path);
          previous = exists ? await this.app.vault.adapter.read(target.path) : "";
        } else {
          try {
            previous = await nodeFs.promises.readFile(target.path, "utf8");
          } catch {
            previous = "";
          }
        }
        const separator =
          previous.length > 0 &&
          !previous.endsWith("\n") &&
          appendText.length > 0 &&
          !appendText.startsWith("\n")
            ? "\n"
            : "";
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
          detail: `Appended ${appendText.length} chars (total ${merged.length}).`,
        };
      }

      if (action.type === "list_folder") {
        const target = this.resolveQaAgentPathTarget(
          action.path || ".",
          "list_folder.path",
          "folder",
        );
        const lines = [
          `folder=${target.path}`,
        ];
        let folders: string[] = [];
        let files: string[] = [];
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
          detail: lines.join("\n"),
        };
      }

      if (action.type === "run_shell") {
        if (!this.settings.qaAgentAllowShellTool) {
          return {
            status: "blocked",
            title: "run_shell",
            detail: "Blocked by settings: 'Allow shell tool (danger)' is disabled.",
          };
        }
        const command = (action.command ?? "").trim();
        if (!command) {
          return {
            status: "error",
            title: "run_shell",
            detail: "command is empty.",
          };
        }
        const timeoutSec = Math.max(
          3,
          Math.min(
            300,
            Math.floor(action.timeoutSec ?? this.settings.qaAgentShellTimeoutSec),
          ),
        );
        const cwd = this.resolveQaShellCwd(action.cwd);
        const output = await execAsync(command, {
          cwd,
          timeout: timeoutSec * 1000,
          maxBuffer: 1024 * 1024,
        });
        const stdout = this.trimQaToolText(String(output.stdout ?? ""), 2000);
        const stderr = this.trimQaToolText(String(output.stderr ?? ""), 1600);
        const lines = [
          `cwd=${cwd}`,
          `timeout=${timeoutSec}s`,
          stdout ? `stdout:\n${stdout}` : "stdout: (empty)",
          stderr ? `stderr:\n${stderr}` : "stderr: (empty)",
        ];
        return {
          status: "ok",
          title: "run_shell",
          detail: lines.join("\n"),
        };
      }

      return {
        status: "error",
        title: `unsupported action: ${String(action.type)}`,
        detail: "Unsupported action type.",
      };
    } catch (error) {
      if (action.type === "run_shell") {
        const shellError = error as {
          code?: string | number;
          message?: string;
          signal?: string;
          stdout?: string | Buffer;
          stderr?: string | Buffer;
        };
        const stdout = this.trimQaToolText(String(shellError.stdout ?? ""), 1800);
        const stderr = this.trimQaToolText(String(shellError.stderr ?? ""), 1800);
        const details = [
          shellError.message ?? "Shell execution failed.",
          shellError.code !== undefined ? `code=${String(shellError.code)}` : "",
          shellError.signal ? `signal=${shellError.signal}` : "",
          stdout ? `stdout:\n${stdout}` : "",
          stderr ? `stderr:\n${stderr}` : "",
        ]
          .filter((line) => line.length > 0)
          .join("\n");
        return {
          status: "error",
          title: "run_shell",
          detail: details,
        };
      }
      const message = error instanceof Error ? error.message : "Unknown action error";
      return {
        status: "error",
        title: this.summarizeQaAgentAction(action),
        detail: message,
      };
    }
  }

  private async executeQaAgentActionPlan(
    plan: LocalQaAgentActionPlan,
    onEvent?: (event: LocalQaProgressEvent) => void,
  ): Promise<string> {
    const lines = [
      "### Agent action execution report / 에이전트 액션 실행 리포트",
      `Plan ID: ${plan.id}`,
      `Actions: ${plan.actions.length}`,
      "",
    ];
    for (let index = 0; index < plan.actions.length; index += 1) {
      const action = plan.actions[index];
      const actionLabel = this.summarizeQaAgentAction(action);
      this.emitQaEvent(
        onEvent,
        "info",
        `Executing action ${index + 1}/${plan.actions.length}: ${actionLabel}`,
      );
      const result = await this.executeQaAgentAction(action);
      if (result.status === "ok") {
        this.emitQaEvent(onEvent, "info", `Action completed: ${actionLabel}`);
      } else if (result.status === "blocked") {
        this.emitQaEvent(onEvent, "warning", `Action blocked: ${actionLabel}`, {
          detail: result.detail,
        });
      } else {
        this.emitQaEvent(onEvent, "error", `Action failed: ${actionLabel}`, {
          detail: result.detail,
        });
      }
      lines.push(
        `#### ${index + 1}. [${result.status.toUpperCase()}] ${result.title}`,
      );
      if (result.detail) {
        lines.push(result.detail);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  private buildQaAgentControlResult(
    question: string,
    answer: string,
  ): LocalQAResultPayload {
    return {
      question: question.trim(),
      answer,
      thinking: "",
      model: "agent-tools",
      embeddingModel: this.settings.semanticOllamaModel.trim() || "(none)",
      sources: [],
      retrievalCacheHits: 0,
      retrievalCacheWrites: 0,
    };
  }

  private async applyQaAgentActionsFromAnswer(params: {
    answer: string;
    question: string;
    qaModel: string;
    onEvent?: (event: LocalQaProgressEvent) => void;
    abortSignal?: AbortSignal;
  }): Promise<string> {
    const { answer, question, qaModel, onEvent, abortSignal } = params;
    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    if (!this.settings.qaAgentToolModeEnabled) {
      return answer;
    }

    const parsed = this.parseQaAgentActionPlanFromAnswer({
      answer,
      question,
      model: qaModel,
    });
    if (!parsed.plan) {
      if (!parsed.warning) {
        return parsed.answerWithoutPlan;
      }
      const warningLine = `> Agent action parse warning: ${parsed.warning}`;
      return [parsed.answerWithoutPlan, warningLine].filter((line) => line.trim()).join("\n\n");
    }

    if (parsed.warning) {
      this.emitQaEvent(onEvent, "warning", parsed.warning);
    }

    if (this.settings.qaAgentRequireApproval) {
      if (abortSignal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      this.pendingQaActionPlan = parsed.plan;
      this.emitQaEvent(
        onEvent,
        "info",
        `Queued ${parsed.plan.actions.length} action(s) for manual approval.`,
      );
      return [
        parsed.answerWithoutPlan || "(Action-only response)",
        this.buildQaActionApprovalText(parsed.plan),
      ]
        .filter((line) => line.trim().length > 0)
        .join("\n\n");
    }

    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const report = await this.executeQaAgentActionPlan(parsed.plan, onEvent);
    return [parsed.answerWithoutPlan, report]
      .filter((line) => line.trim().length > 0)
      .join("\n\n");
  }

  private normalizeQaExternalAttachments(
    attachments: LocalQaExternalAttachment[],
  ): {
    textDocs: LocalQaExternalContextDoc[];
    images: string[];
    imageLabels: string[];
    pdfLabels: string[];
    imageItems: Array<{ label: string; path?: string }>;
    pdfItems: Array<{ label: string; path?: string }>;
  } {
    const textDocs: LocalQaExternalContextDoc[] = [];
    const images: string[] = [];
    const imageLabels: string[] = [];
    const pdfLabels: string[] = [];
    const imageItems: Array<{ label: string; path?: string }> = [];
    const pdfItems: Array<{ label: string; path?: string }> = [];

    for (const attachment of attachments.slice(0, LOCAL_QA_MAX_ATTACHMENTS)) {
      if (attachment.kind === "image") {
        const base64 = (attachment.imageBase64 ?? "").trim();
        if (base64) {
          images.push(base64);
          const label = (attachment.label || attachment.path || `image-${images.length}`).trim();
          const path = attachment.path?.trim();
          imageLabels.push(label);
          imageItems.push({ label, path });
        }
      }

      if (attachment.kind === "pdf") {
        const label = (attachment.label || attachment.path || `pdf-${pdfLabels.length + 1}`).trim();
        const path = attachment.path?.trim();
        pdfLabels.push(label);
        pdfItems.push({ label, path });
      }

      const content = this.trimQaToolText((attachment.content ?? "").trim(), 12000);
      if (!content) {
        continue;
      }
      const label = (attachment.label || attachment.path || `document-${textDocs.length + 1}`)
        .trim();
      const path = attachment.path?.trim();
      textDocs.push({
        label,
        path,
        content,
      });
    }

    return {
      textDocs: textDocs.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      images: images.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      imageLabels: imageLabels.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      pdfLabels: pdfLabels.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      imageItems: imageItems.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
      pdfItems: pdfItems.slice(0, LOCAL_QA_MAX_ATTACHMENTS),
    };
  }

  async askLocalQa(
    question: string,
    topK: number,
    history: LocalQAConversationTurn[] = [],
    onToken?: (token: string) => void,
    onEvent?: (event: LocalQaProgressEvent) => void,
    abortSignal?: AbortSignal,
    externalAttachments: LocalQaExternalAttachment[] = [],
    options: LocalQaAskOptions = {},
  ): Promise<LocalQAResultPayload> {
    const safeQuestion = question.trim();
    if (!safeQuestion) {
      throw new Error("Question is empty.");
    }
    const throwIfAborted = (): void => {
      if (abortSignal?.aborted) {
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
            "대기 중인 액션 계획이 없습니다. / No pending action plan.",
          );
        }
        if (approvalCommand === "deny") {
          const cancelled = this.pendingQaActionPlan;
          this.pendingQaActionPlan = null;
          return this.buildQaAgentControlResult(
            safeQuestion,
            `계획을 취소했습니다: ${cancelled.id} (${cancelled.actions.length} actions).`,
          );
        }
        const plan = this.pendingQaActionPlan;
        this.pendingQaActionPlan = null;
        const report = await this.executeQaAgentActionPlan(plan, onEvent);
        return this.buildQaAgentControlResult(safeQuestion, report);
      }
    }

    const qaContextEnabled = this.settings.qaContextInChat;
    const selectedFiles = qaContextEnabled ? this.getSelectedFiles() : [];
    const normalizedExternal = this.normalizeQaExternalAttachments(externalAttachments);
    const openFilePath = normalizePath((options.openFilePath ?? "").trim());
    const openFileEntry = openFilePath
      ? this.app.vault.getAbstractFileByPath(openFilePath)
      : null;
    const openFile =
      qaContextEnabled && openFileEntry instanceof TFile && openFileEntry.extension === "md"
        ? openFileEntry
        : null;
    const hasImageAttachments = normalizedExternal.images.length > 0;
    const hasPdfAttachments = normalizedExternal.pdfLabels.length > 0;
    const hasVisionAttachments = hasImageAttachments || hasPdfAttachments;
    const hasExternalContext =
      normalizedExternal.textDocs.length > 0
      || normalizedExternal.images.length > 0
      || normalizedExternal.pdfLabels.length > 0;

    const intent = this.detectLocalQaIntent(safeQuestion);
    const preferDetailed = this.shouldPreferDetailedAnswer(safeQuestion, intent);

    const safeTopK = Math.max(1, Math.min(15, topK));
    const qaBaseUrl = this.resolveQaBaseUrl();
    if (!qaBaseUrl) {
      throw new Error("Q&A base URL is empty.");
    }
    const endpointPolicyError = this.validateQaEndpointPolicy(qaBaseUrl);
    if (endpointPolicyError) {
      throw new Error(endpointPolicyError);
    }
    if (!qaContextEnabled) {
      this.emitQaEvent(
        onEvent,
        "retrieval",
        "QA context is disabled; running general chat without selected-note retrieval.",
      );
    }

    let primaryRole = this.resolveQaPrimaryRole();
    if (hasVisionAttachments && primaryRole !== "ask_vision") {
      primaryRole = "ask_vision";
      this.emitQaEvent(
        onEvent,
        "info",
        "Vision-compatible attachments detected (image/pdf); switching role to Ask (vision) for this turn.",
      );
    }

    let qaModel = this.resolveQaModelForRole(primaryRole);
    const detectedModels = this.getDetectedOllamaModelNames();
    if (qaModel && detectedModels.length > 0 && !this.hasDetectedOllamaModel(qaModel)) {
      const roleFallback = this.resolveDetectedRoleFallbackModel(primaryRole);
      if (roleFallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Selected ${primaryRole} model is not detected (${qaModel}); fallback to ${roleFallback}`,
        );
        qaModel = roleFallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Selected ${primaryRole} model is not detected (${qaModel}); continuing with configured value.`,
        );
      }
    }
    if (hasVisionAttachments && !this.isVisionCapableModel(qaModel)) {
      const visionFallback = this.resolveVisionModelForImageAttachments();
      if (visionFallback) {
        this.emitQaEvent(
          onEvent,
          "warning",
          `Current model is text-only for image input. Switching to vision model: ${visionFallback}`,
        );
        qaModel = visionFallback;
      } else {
        this.emitQaEvent(
          onEvent,
          "error",
          "No vision-capable local model detected. Image/PDF understanding is unavailable in current setup.",
        );
        throw new Error(
          "비전 모델이 감지되지 않았습니다. 이미지/PDF 첨부를 처리하려면 Guide의 비전 모델 설치 안내를 먼저 완료하세요.",
        );
      }
    }
    if (!qaModel) {
      throw new Error("Q&A model is empty.");
    }
    if (!isOllamaModelAllowedForQaRole(primaryRole, qaModel)) {
      throw new Error(`Q&A model is not suitable: ${qaModel}`);
    }

    try {
      throwIfAborted();
      let embeddingModel = this.settings.semanticOllamaModel.trim();
      let retrievalCacheHits = 0;
      let retrievalCacheWrites = 0;
      const maxContextChars = this.resolveQaContextCharLimit(intent);
      let sourceBlocks: Array<{ path: string; similarity: number; content: string }> = [];

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
            abortSignal,
          );
          retrievalCacheHits = retrieval.cacheHits;
          retrievalCacheWrites = retrieval.cacheWrites;
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `Retrieved ${retrieval.hits.length} candidates (cache hits=${retrieval.cacheHits}, writes=${retrieval.cacheWrites})`,
          );

          if (retrieval.errors.length > 0) {
            this.notice(`Semantic retrieval had ${retrieval.errors.length} issue(s).`, 6000);
            this.emitQaEvent(
              onEvent,
              "warning",
              `Retrieval warnings: ${retrieval.errors.length}`,
            );
          }
          if (retrieval.hits.length === 0 && !hasExternalContext) {
            throw new Error("No relevant notes were found for this question.");
          }

          const rankedHits = this.rerankQaHits(
            retrieval.hits,
            safeQuestion,
            this.resolveQaRerankTopK(intent, safeTopK),
          );
          const queryTerms = this.tokenizeQuery(safeQuestion);
          const sourceCandidates: Array<{
            path: string;
            similarity: number;
            content: string;
            relevance: number;
          }> = [];
          let usedChars = 0;

          for (const hit of rankedHits) {
            throwIfAborted();
            if (usedChars >= maxContextChars) {
              break;
            }
            const entry = this.app.vault.getAbstractFileByPath(hit.path);
            if (!(entry instanceof TFile)) {
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
              relevance,
            });
            usedChars += snippet.length;
          }
          sourceCandidates.sort(
            (a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path),
          );
          const sourceLimit =
            intent === "comparison" || intent === "plan"
              ? Math.max(safeTopK + 2, safeTopK)
              : intent === "sources_only"
                ? Math.max(safeTopK, 5)
                : safeTopK;
          sourceBlocks = sourceCandidates.slice(0, sourceLimit).map((item) => ({
            path: item.path,
            similarity: item.similarity,
            content: item.content,
          }));
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `Context built from ${sourceBlocks.length} notes (${usedChars} chars)`,
          );
        } catch (error) {
          if (this.isAbortError(error)) {
            throw error;
          }
          if (!hasExternalContext) {
            throw error;
          }
          const message =
            error instanceof Error ? error.message : "Unknown semantic retrieval error";
          this.emitQaEvent(
            onEvent,
            "warning",
            `Semantic retrieval failed. Falling back to attachments: ${message}`,
          );
          this.notice(`Semantic retrieval fallback: ${message}`, 7000);
          sourceBlocks = [];
        }
      } else if (selectedFiles.length > 0 && !embeddingModel) {
        if (!hasExternalContext) {
          throw new Error("Embedding model is empty. Refresh embedding detection first.");
        }
        this.emitQaEvent(
          onEvent,
          "warning",
          "Embedding model is empty. Selected-note retrieval skipped; using attachments only.",
        );
        embeddingModel = "(attachments-priority)";
      } else if (!hasExternalContext && openFile instanceof TFile) {
        const openRaw = await this.app.vault.cachedRead(openFile);
        throwIfAborted();
        const snippet = this.extractRelevantSnippet(openRaw, safeQuestion, maxContextChars);
        if (snippet.trim().length > 0) {
          sourceBlocks = [{
            path: openFile.path,
            similarity: 1,
            content: snippet,
          }];
          embeddingModel = "(open-file-fallback)";
          this.emitQaEvent(
            onEvent,
            "retrieval",
            `No selected scope/attachments. Using currently open file: ${openFile.path}`,
          );
        } else {
          embeddingModel = "(open-file-empty)";
          this.emitQaEvent(
            onEvent,
            "warning",
            `Open file detected but no readable text: ${openFile.path}`,
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
              doc.content,
            ].join("\n"),
            Math.max(900, Math.floor(maxContextChars * 0.6)),
          ),
        }));
        sourceBlocks = [...attachmentBlocks, ...sourceBlocks];
        this.emitQaEvent(
          onEvent,
          "retrieval",
          `Included ${attachmentBlocks.length} attached text document(s).`,
        );
      }

      if (sourceBlocks.length > 0) {
        const trimmedBlocks: Array<{ path: string; similarity: number; content: string }> = [];
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
            content: nextContent,
          });
          used += nextContent.length;
        }
        sourceBlocks = trimmedBlocks;
      }

      if (sourceBlocks.length === 0 && (normalizedExternal.images.length > 0 || normalizedExternal.pdfLabels.length > 0)) {
        const imageBlocks = normalizedExternal.imageItems.map((item, index) => ({
          path: item.path?.trim() || `[ATTACHMENT-IMAGE] ${item.label || `image-${index + 1}`}`,
          similarity: 1,
          content: "Image attachment (model should inspect attached image input).",
        }));
        const pdfBlocks = normalizedExternal.pdfItems.map((item, index) => ({
          path: item.path?.trim() || `[ATTACHMENT-PDF] ${item.label || `pdf-${index + 1}`}`,
          similarity: 1,
          content:
            "PDF attachment (if direct parsing is limited, request converted image/text excerpts for precise grounding).",
        }));
        sourceBlocks = [...pdfBlocks, ...imageBlocks];
      }

      const sourceContext = this.buildLocalQaSourceContext(sourceBlocks);
      const hasSourceContext =
        sourceBlocks.length > 0
        || normalizedExternal.images.length > 0
        || normalizedExternal.pdfLabels.length > 0;
      const attachmentLabels = [
        ...normalizedExternal.textDocs.map((doc) => `[DOC] ${doc.label}`),
        ...normalizedExternal.imageLabels.map((label) => `[IMG] ${label}`),
        ...normalizedExternal.pdfLabels.map((label) => `[PDF] ${label}`),
      ];
      const selectionInventoryContext = selectedFiles.length > 0 && this.shouldIncludeSelectionInventory(
        safeQuestion,
        selectedFiles.length,
        intent,
      )
        ? this.buildSelectionInventoryContext(selectedFiles)
        : undefined;
      const systemPrompt = this.buildLocalQaSystemPrompt(
        intent,
        preferDetailed,
        hasSourceContext,
        primaryRole,
      );
      const userPrompt = this.buildLocalQaUserPrompt(
        safeQuestion,
        sourceContext,
        selectionInventoryContext,
        attachmentLabels,
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
        abortSignal,
      });
      if (abortSignal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      const split = splitThinkingBlocks(completion.answer);
      const initialAnswer = split.answer.trim() || completion.answer.trim();
      if (!initialAnswer) {
        throw new Error("Local Q&A returned an empty answer.");
      }

      const hasAgentActionBlock =
        this.settings.qaAgentToolModeEnabled &&
        /```auto-link-actions[\s\S]*?```/i.test(initialAnswer);
      let finalAnswer = initialAnswer;
      if (!hasSourceContext) {
        this.emitQaEvent(
          onEvent,
          "info",
          "No source context for this turn; skipping source-based rewrite passes.",
        );
      } else if (hasAgentActionBlock) {
        this.emitQaEvent(
          onEvent,
          "info",
          "Agent action block detected; skipping post-generation rewrite passes.",
        );
      } else if (hasVisionAttachments) {
        this.emitQaEvent(
          onEvent,
          "info",
          "Vision-compatible attachments detected; limiting rewrite passes to safeguard-only.",
        );
        const limitedStages = this.resolveQaPipelineStages(safeQuestion, intent)
          .filter((stage) => stage === "safeguard");
        for (const stage of limitedStages) {
          throwIfAborted();
          finalAnswer = await this.applySafeguardPass({
            question: safeQuestion,
            answer: finalAnswer,
            sourceBlocks,
            qaBaseUrl,
            onEvent,
            abortSignal,
          });
        }
      } else {
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
          abortSignal,
        });

        const useLightweightPipeline = this.shouldUseLightweightQaPipeline(
          safeQuestion,
          intent,
        );
        if (useLightweightPipeline) {
          this.emitQaEvent(
            onEvent,
            "info",
            "Simple question detected; skipping heavy pipeline passes for faster response.",
          );
        }
        const pipelineStages = useLightweightPipeline
          ? []
          : this.resolveQaPipelineStages(safeQuestion, intent);
        if (pipelineStages.length > 0) {
          this.emitQaEvent(
            onEvent,
            "generation",
            `Pipeline: ${pipelineStages.join(" -> ")}`,
          );
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
              abortSignal,
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
              abortSignal,
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
            abortSignal,
          });
        }
      }

      const shouldSkipLanguageGuard =
        this.settings.qaAgentToolModeEnabled &&
        /```auto-link-actions[\s\S]*?```/i.test(finalAnswer);
      if (!shouldSkipLanguageGuard) {
        throwIfAborted();
        finalAnswer = await this.enforcePreferredLanguageIfNeeded({
          answer: finalAnswer,
          question: safeQuestion,
          qaBaseUrl,
          qaModel,
          onEvent,
          abortSignal,
        });
      }

      const mergedThinking = [completion.thinking.trim(), split.thinking.trim()]
        .filter((item) => item.length > 0)
        .join("\n\n")
        .trim();
      this.emitQaEvent(onEvent, "generation", `Generation completed (${completion.endpoint})`);

      const sourceList: LocalQASourceItem[] = sourceBlocks.map((item) => ({
        path: item.path,
        similarity: item.similarity,
      }));
      throwIfAborted();
      const answerWithActions = await this.applyQaAgentActionsFromAnswer({
        answer: finalAnswer,
        question: safeQuestion,
        qaModel,
        onEvent,
        abortSignal,
      });

      return {
        question: safeQuestion,
        answer: answerWithActions,
        thinking: mergedThinking,
        model: qaModel,
        embeddingModel,
        sources: sourceList,
        retrievalCacheHits,
        retrievalCacheWrites,
      };
    } finally {
      this.setStatus("idle");
    }
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

  private extractPathTerms(path: string): string[] {
    return path
      .toLowerCase()
      .replace(/\.md$/i, "")
      .split(/[^a-z0-9가-힣]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  private scoreCandidatePath(sourcePath: string, candidatePath: string): number {
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

  private getCandidateLinkPathsForFile(
    filePath: string,
    selectedFiles: TFile[],
    semanticNeighbors?: Map<string, SemanticNeighbor[]>,
  ): string[] {
    const fallback = selectedFiles
      .filter((candidate) => candidate.path !== filePath)
      .map((candidate) => candidate.path);
    const candidateLimit = Math.max(
      this.settings.maxLinked * 6,
      this.settings.semanticTopK,
      ANALYSIS_HARD_MAX_CANDIDATES,
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

    const semantic = (semanticNeighbors.get(filePath) ?? []).map((item) => item.path);
    if (semantic.length === 0) {
      return rankedFallback.slice(0, candidateLimit);
    }

    return mergeUniqueStrings(semantic, rankedFallback).slice(0, candidateLimit);
  }

  private normalizeFolderPrefix(path: string): string {
    const normalized = normalizePath(path.trim());
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  private isPathInsideFolder(filePath: string, folderPath: string): boolean {
    const fileNormalized = normalizePath(filePath);
    const folderNormalized = normalizePath(folderPath);
    if (!fileNormalized || !folderNormalized) {
      return false;
    }
    if (fileNormalized === folderNormalized) {
      return true;
    }
    return fileNormalized.startsWith(this.normalizeFolderPrefix(folderNormalized));
  }

  private parseWatchedFolders(): string[] {
    return this.settings.watchNewNotesFolders
      .split(/[\n,;]+/)
      .map((item) => normalizePath(item.trim()))
      .filter((item) => item.length > 0)
      .filter((item) => this.isSafeVaultRelativePath(item))
      .sort((a, b) => a.localeCompare(b));
  }

  private resolveMatchedWatchedFolder(filePath: string): string | null {
    const watchedFolders = this.parseWatchedFolders();
    for (const folder of watchedFolders) {
      if (this.isPathInsideFolder(filePath, folder)) {
        return folder;
      }
    }
    return null;
  }

  private isManagedOutputPath(path: string): boolean {
    try {
      const chatRoot = this.resolveSafeFolderPath(
        this.settings.chatTranscriptRootPath,
        "Auto Link Chats",
        "Chat transcript",
      );
      if (this.isPathInsideFolder(path, chatRoot)) {
        return true;
      }
    } catch {
      // ignore invalid setting in watch filter
    }

    try {
      const reportRoot = this.resolveSafeFolderPath(
        this.settings.cleanupReportRootPath,
        "Auto Link Reports",
        "Cleanup dry-run report",
      );
      if (this.isPathInsideFolder(path, reportRoot)) {
        return true;
      }
    } catch {
      // ignore invalid setting in watch filter
    }

    try {
      const backupRoot = this.resolveSafeFolderPath(
        this.settings.backupRootPath,
        "Auto Link Backups",
        "Backup root",
      );
      if (this.isPathInsideFolder(path, backupRoot)) {
        return true;
      }
    } catch {
      // ignore invalid setting in watch filter
    }

    return false;
  }

  private async addFileToSelection(filePath: string): Promise<"added" | "already"> {
    const normalized = normalizePath(filePath);
    if (!normalized || this.isPathExcluded(normalized)) {
      return "already";
    }

    const alreadySelected = this.getSelectedFiles().some((file) => file.path === normalized);
    if (alreadySelected || this.settings.targetFilePaths.includes(normalized)) {
      return "already";
    }

    this.settings.targetFilePaths = [...this.settings.targetFilePaths, normalized].sort(
      (a, b) => a.localeCompare(b),
    );
    await this.saveSettings();
    return "added";
  }

  private async handleWatchedNewFile(file: TFile): Promise<void> {
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
          this.notice(`Added to selection: ${file.path}`, 5000);
        } else {
          this.notice(`Already included in selection: ${file.path}`, 4000);
        }
        return;
      }

      if (addResult === "added") {
        this.notice(`Added and analyzing: ${file.path}`, 5000);
      } else {
        this.notice(`Analyzing with current selection: ${file.path}`, 5000);
      }
      await this.runAnalysis();
    } finally {
      this.pendingNewNoteWatchPrompts.delete(file.path);
    }
  }

  private buildAutoTagCandidatePaths(file: TFile): string[] {
    const selected = this.getSelectedFiles()
      .filter((candidate) => candidate.path !== file.path)
      .map((candidate) => candidate.path);
    if (selected.length > 0) {
      return selected.slice(0, ANALYSIS_HARD_MAX_CANDIDATES);
    }

    return this.getAllMarkdownFiles()
      .filter((candidate) => candidate.path !== file.path)
      .sort((a, b) => {
        const scoreDiff = this.scoreCandidatePath(file.path, b.path) -
          this.scoreCandidatePath(file.path, a.path);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return a.path.localeCompare(b.path);
      })
      .slice(0, ANALYSIS_HARD_MAX_CANDIDATES)
      .map((candidate) => candidate.path);
  }

  private async runAutoTagForFile(file: TFile, source: "auto" | "manual"): Promise<void> {
    if (this.isPathExcluded(file.path)) {
      return;
    }
    if (this.autoTagInFlightPaths.has(file.path)) {
      return;
    }

    const cooldownSec = Math.max(10, this.settings.autoTagActiveNoteCooldownSec);
    const cooldownMs = cooldownSec * 1000;
    const now = Date.now();
    const lastRun = this.autoTagLastRunByPath.get(file.path) ?? 0;
    if (source === "auto" && now - lastRun < cooldownMs) {
      return;
    }

    if (this.settings.provider === "ollama") {
      const selectedModel = this.settings.ollamaModel.trim();
      if (!selectedModel || !isOllamaModelAnalyzable(selectedModel)) {
        if (source === "manual") {
          this.notice("Auto-tag skipped: select an analyzable Ollama model first.", 5000);
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
        JSON.stringify([file.path, ...candidateLinkPaths]),
      );
      const signatureInput: AnalysisRequestSignatureInput = {
        sourcePath: file.path,
        candidateLinkPaths,
        maxTags: this.settings.maxTags,
        maxLinked: this.settings.maxLinked,
        analyzeTags: true,
        analyzeTopic: false,
        analyzeLinked: false,
        forceAllToAllLinkedEnabled: false,
        analyzeIndex: false,
        includeReasons: this.settings.includeReasons,
      };
      const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
      const requestSignature = this.buildAnalysisRequestSignature(
        providerCacheSignature,
        signatureInput,
      );
      const cachedOutcome = this.getCachedAnalysisOutcome(
        analysisCache,
        cacheKey,
        requestSignature,
        file,
        settingsSignature,
        selectionSignature,
      );

      let outcome: AnalyzeOutcome;
      if (cachedOutcome) {
        outcome = cachedOutcome;
      } else {
        outcome = await analyzeWithFallback(this.settings, {
          ...signatureInput,
          sourceText: await this.app.vault.cachedRead(file),
        });
        this.storeAnalysisOutcome(
          analysisCache,
          cacheKey,
          requestSignature,
          settingsSignature,
          selectionSignature,
          file,
          outcome,
        );
      }

      const existingFrontmatter =
        (this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined) ?? {};
      const existingTags = normalizeTags(this.readRawFrontmatterTags(existingFrontmatter));
      const proposedTags = normalizeTags(
        (outcome.proposal.tags ?? []).slice(0, this.settings.maxTags),
      );
      const mergedTags = normalizeTags(mergeUniqueStrings(existingTags, proposedTags));
      const unchanged =
        mergedTags.length === existingTags.length &&
        mergedTags.every((item, idx) => item === existingTags[idx]);
      if (unchanged || mergedTags.length === 0) {
        if (source === "manual") {
          this.notice("Auto-tag: no tag changes for active note.", 4000);
        }
      } else {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const current = frontmatter as Record<string, unknown>;
          current.tags = mergedTags;
        });
        if (source === "manual") {
          this.notice(`Auto-tag applied: ${file.path} (${mergedTags.length} tags)`, 5000);
        }
      }

      if (this.analysisCacheDirty) {
        await this.flushAnalysisCache();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auto-tag error";
      if (source === "manual") {
        this.notice(`Auto-tag failed: ${message}`, 6000);
      }
    } finally {
      this.autoTagInFlightPaths.delete(file.path);
    }
  }

  private async handleAutoTagOnFileOpen(file: TFile): Promise<void> {
    if (!this.settings.autoTagActiveNoteEnabled) {
      return;
    }
    await this.runAutoTagForFile(file, "auto");
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
      lines.push("# Auto Link Cleanup Dry-Run Report");
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
        const reportFolder = this.resolveSafeFolderPath(
          this.settings.cleanupReportRootPath,
          "Auto Link Reports",
          "Cleanup dry-run report",
        );
        reportPath = normalizePath(
          `${reportFolder}/cleanup-dry-run-${formatBackupStamp(new Date())}.md`,
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

    const analysisCache = await this.loadAnalysisCache();
    const providerCacheSignature = this.getProviderCacheSignature();
    const settingsSignature = this.buildAnalysisSettingsSignature(providerCacheSignature);
    const selectionSignature = this.buildSelectionSignature(selectedFiles);

    let skippedUnchanged = 0;
    let filesToAnalyze = selectedFiles;
    if (this.settings.analysisOnlyChangedNotes) {
      const pending: TFile[] = [];
      for (const file of selectedFiles) {
        const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
        if (
          this.canSkipByChangedOnlyMode(
            analysisCache,
            cacheKey,
            file,
            settingsSignature,
            selectionSignature,
          )
        ) {
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
          5000,
        );
        return;
      }
      this.notice(
        `Changed-only mode: ${skippedUnchanged} skipped, ${filesToAnalyze.length} queued.`,
        4000,
      );
    }

    const capacityModelLabel = getProviderModelLabel(this.settings);
    const recommendedMax = this.estimateRecommendedSelectionMax(capacityModelLabel);
    if (filesToAnalyze.length >= Math.floor(recommendedMax * 0.85)) {
      this.notice(
        `Selected ${filesToAnalyze.length}. Recommended max for current model is about ${recommendedMax}.`,
        5000,
      );
    }
    if (filesToAnalyze.length > recommendedMax) {
      const capacityDecision = await CapacityGuardModal.ask(
        this.app,
        filesToAnalyze.length,
        recommendedMax,
        capacityModelLabel,
        this.settings.semanticLinkingEnabled && this.settings.analyzeLinked,
      );
      if (!capacityDecision.proceed) {
        this.notice("Analysis cancelled due to large selection size.");
        return;
      }
    }

    const forceAllToAllLinked =
      this.settings.analyzeLinked && this.settings.forceAllToAllLinkedEnabled;
    if (forceAllToAllLinked) {
      this.notice(
        "All-to-all linked mode is ON. Each note will include all selected notes (except itself).",
        6000,
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

    let backupFolder: string | null = null;
    if (decision.backupBeforeRun) {
      this.setStatus("creating backup...");
      backupFolder = await this.createBackupForFiles(filesToAnalyze);
      if (backupFolder) {
        this.notice(`Backup completed before analysis: ${backupFolder}`, 5000);
      }
    }

    let semanticNeighbors = new Map<string, SemanticNeighbor[]>();
    const shouldBuildSemanticNeighbors =
      this.settings.semanticLinkingEnabled &&
      this.settings.analyzeLinked &&
      !forceAllToAllLinked;
    if (shouldBuildSemanticNeighbors) {
      this.setStatus("building semantic candidates...");
      try {
        const semanticScopeFiles = this.settings.analysisOnlyChangedNotes
          ? filesToAnalyze
          : selectedFiles;
        const semanticResult = await buildSemanticNeighborMap(
          this.app,
          semanticScopeFiles,
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
    } else if (forceAllToAllLinked && this.settings.semanticLinkingEnabled) {
      this.notice(
        "Semantic candidate build skipped because all-to-all linked mode is ON.",
        5000,
      );
    }

    const progressModal = new RunProgressModal(this.app, "Analyzing selected notes");
    progressModal.open();

    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const suggestions: NoteSuggestion[] = [];
    const errors: ProgressErrorItem[] = [];
    const events: ProgressEventItem[] = [];
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
        events,
      });
      this.setStatus(`analyzing ${index + 1}/${filesToAnalyze.length}`);

      try {
        const candidateLinkPaths = this.getCandidateLinkPathsForFile(
          file.path,
          selectedFiles,
          semanticNeighbors,
        );
        const analyzeLinkedByModel = this.settings.analyzeLinked && !forceAllToAllLinked;
        const candidateLinkPathsForRequest = analyzeLinkedByModel ? candidateLinkPaths : [];
        const signatureInput: AnalysisRequestSignatureInput = {
          sourcePath: file.path,
          candidateLinkPaths: candidateLinkPathsForRequest,
          maxTags: this.settings.maxTags,
          maxLinked: this.settings.maxLinked,
          analyzeTags: this.settings.analyzeTags,
          analyzeTopic: this.settings.analyzeTopic,
          analyzeLinked: analyzeLinkedByModel,
          forceAllToAllLinkedEnabled: forceAllToAllLinked,
          analyzeIndex: this.settings.analyzeIndex,
          includeReasons: this.settings.includeReasons,
        };

        const cacheKey = this.buildAnalysisCacheKey(providerCacheSignature, file.path);
        const requestSignature = this.buildAnalysisRequestSignature(
          providerCacheSignature,
          signatureInput,
        );

        const cachedOutcome = this.getCachedAnalysisOutcome(
          analysisCache,
          cacheKey,
          requestSignature,
          file,
          settingsSignature,
          selectionSignature,
        );
        let outcome: AnalyzeOutcome;
        if (cachedOutcome) {
          outcome = cachedOutcome;
          analysisCacheHits += 1;
        } else {
          const request: AnalyzeRequest = {
            ...signatureInput,
            sourceText: await this.app.vault.cachedRead(file),
          };
          outcome = await analyzeWithFallback(this.settings, request);
          this.storeAnalysisOutcome(
            analysisCache,
            cacheKey,
            requestSignature,
            settingsSignature,
            selectionSignature,
            file,
            outcome,
          );
          analysisCacheWrites += 1;
        }

        if (outcome.meta.usedFallback) {
          usedFallbackCount += 1;
        }

        const currentFrontmatter =
          (this.app.metadataCache.getFileCache(file)?.frontmatter as
            | Record<string, unknown>
            | undefined) ?? {};
        const rawExistingTags = this.readRawFrontmatterTags(currentFrontmatter);

        const existingBase = normalizeManagedFrontmatter(
          extractManagedFrontmatter(currentFrontmatter),
        );
        const existingValidated: ManagedFrontmatter = {
          tags: existingBase.tags,
          topic: existingBase.topic,
          linked: normalizeLinked(this.app, file.path, existingBase.linked),
          index: existingBase.index,
        };
        const existingForComparison: ManagedFrontmatter = {
          tags: rawExistingTags,
          topic: existingValidated.topic,
          linked: existingValidated.linked,
          index: existingValidated.index,
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
          const linkedSource = forceAllToAllLinked
            ? selectedFiles
                .filter((candidate) => candidate.path !== file.path)
                .map((candidate) => candidate.path)
            : (outcome.proposal.linked ?? []).slice(0, this.settings.maxLinked);
          const proposedLinked = normalizeLinked(
            this.app,
            file.path,
            linkedSource,
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
        if (!managedFrontmatterChanged(existingForComparison, normalizedProposed)) {
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
          existing: existingForComparison,
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

    if (analysisCacheWrites > 0 || this.analysisCacheDirty) {
      try {
        await this.flushAnalysisCache();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown analysis cache write error";
        this.notice(`Analysis cache write failed: ${message}`, 6000);
      }
    }

    progressModal.setFinished(
      cancelled
        ? "Analysis stopped by user."
        : `Analysis complete: ${suggestions.length} changed of ${filesToAnalyze.length}`,
    );
    progressModal.close();

    const summary: AnalysisRunSummary = {
      provider: this.settings.provider,
      model: getProviderModelLabel(this.settings),
      totalFiles: filesToAnalyze.length,
      changedFiles: suggestions.length,
      usedFallbackCount,
      elapsedMs: Date.now() - runStartedAt,
      cancelled,
      errorCount: errors.length,
    };

    this.setStatus(`analysis done (${summary.changedFiles}/${summary.totalFiles} changed)`);

    if (suggestions.length === 0) {
      this.notice(
        `No metadata changes. Provider=${summary.provider}, Model=${summary.model}, Errors=${summary.errorCount}, Elapsed=${formatDurationMs(summary.elapsedMs)}, CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}.`,
        5000,
      );
      return;
    }

    if (cancelled) {
      this.notice(
        `Analysis stopped. Showing partial suggestions (${suggestions.length} file(s)). CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}.`,
        5000,
      );
    }

    this.notice(
      `Analysis complete: ${summary.changedFiles}/${summary.totalFiles} changed. CacheHits=${analysisCacheHits}, CacheWrites=${analysisCacheWrites}, SkippedUnchanged=${skippedUnchanged}, Elapsed=${formatDurationMs(summary.elapsedMs)}.`,
      5000,
    );

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

    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root",
    );
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

    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root",
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

  private async getLatestBackupFolder(): Promise<string | null> {
    const backupRoot = this.resolveSafeFolderPath(
      this.settings.backupRootPath,
      DEFAULT_SETTINGS.backupRootPath,
      "Backup root",
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

    const outputPath = await this.allocateTimestampedMocPath(this.settings.mocPath);
    await this.ensureParentFolder(outputPath);
    const existing = this.app.vault.getAbstractFileByPath(outputPath);
    const content = `${lines.join("\n").trim()}\n`;

    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }

    this.notice(`MOC saved: ${outputPath}`);
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
