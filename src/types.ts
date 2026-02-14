import type { TFile } from "obsidian";

export type ProviderId =
  | "ollama"
  | "lmstudio"
  | "openai"
  | "anthropic"
  | "gemini";

export interface FieldReasons {
  tags?: string;
  topic?: string;
  linked?: string;
  index?: string;
}

export interface MetadataProposal {
  tags?: string[];
  topic?: string;
  linked?: string[];
  index?: string;
  reasons?: FieldReasons;
}

export interface ManagedFrontmatter {
  tags: string[];
  topic?: string;
  linked: string[];
  index?: string;
}

export interface NoteSuggestion {
  file: TFile;
  existing: ManagedFrontmatter;
  proposed: ManagedFrontmatter;
  reasons: FieldReasons;
  analysis: SuggestionAnalysisMeta;
}

export interface AnalyzeRequest {
  sourcePath: string;
  sourceText: string;
  candidateLinkPaths: string[];
  maxTags: number;
  maxLinked: number;
  analyzeTags: boolean;
  analyzeTopic: boolean;
  analyzeLinked: boolean;
  analyzeIndex: boolean;
  includeReasons: boolean;
}

export interface AIProvider {
  analyze(request: AnalyzeRequest): Promise<MetadataProposal>;
}

export interface SuggestionAnalysisMeta {
  provider: ProviderId;
  model: string;
  elapsedMs: number;
  usedFallback: boolean;
}

export interface AnalysisRunSummary {
  provider: ProviderId;
  model: string;
  totalFiles: number;
  changedFiles: number;
  usedFallbackCount: number;
  elapsedMs: number;
  cancelled: boolean;
  errorCount: number;
}

export interface AnalyzeOutcome {
  proposal: MetadataProposal;
  meta: SuggestionAnalysisMeta;
}

export interface OllamaDetectionResult {
  models: string[];
  recommended?: string;
  reason: string;
}

export interface OllamaModelOption {
  model: string;
  status: "recommended" | "available" | "unavailable";
  reason: string;
}

export interface BackupDecision {
  proceed: boolean;
  backupBeforeRun: boolean;
  rememberAsDefault: boolean;
}

export interface ProgressErrorItem {
  filePath: string;
  message: string;
}

export interface KnowledgeWeaverSettings {
  provider: ProviderId;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaAutoPickEnabled: boolean;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  lmStudioApiKey: string;
  openAIBaseUrl: string;
  openAIModel: string;
  openAIApiKey: string;
  anthropicModel: string;
  anthropicApiKey: string;
  geminiModel: string;
  geminiApiKey: string;
  suggestionMode: boolean;
  includeReasons: boolean;
  cleanUnknownFrontmatter: boolean;
  sortArrays: boolean;
  analyzeTags: boolean;
  analyzeTopic: boolean;
  analyzeLinked: boolean;
  analyzeIndex: boolean;
  maxTags: number;
  maxLinked: number;
  targetFilePaths: string[];
  targetFolderPaths: string[];
  includeSubfoldersInFolderSelection: boolean;
  selectionPathWidthPercent: number;
  backupBeforeApply: boolean;
  backupRootPath: string;
  backupRetentionCount: number;
  excludedFolderPatterns: string;
  showProgressNotices: boolean;
  generateMoc: boolean;
  mocPath: string;
}
