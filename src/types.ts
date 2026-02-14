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

export interface KnowledgeWeaverSettings {
  provider: ProviderId;
  ollamaBaseUrl: string;
  ollamaModel: string;
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
  generateMoc: boolean;
  mocPath: string;
}
