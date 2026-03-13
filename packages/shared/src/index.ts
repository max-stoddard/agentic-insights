export type Bucket = "day" | "week" | "month";

export interface WaterRange {
  low: number;
  central: number;
  high: number;
}

export interface TokenTotals {
  totalTokens: number;
  supportedTokens: number;
  excludedTokens: number;
  unestimatedTokens: number;
}

export interface CoverageCounts {
  supportedEvents: number;
  excludedEvents: number;
  tokenOnlyEvents: number;
}

export interface CoverageSummary {
  sessions: number;
  prompts: number;
  excludedModels: number;
}

export type ModelUsageStatus = "allowed" | "unknown" | "local";

export interface ModelUsageEntry {
  provider: string;
  model: string;
  totalTokens: number;
  events: number;
  supportedTokens: number;
  excludedTokens: number;
  unestimatedTokens: number;
  status: ModelUsageStatus;
  statusNote: string | null;
}

export type CoverageClassification = "supported" | "excluded" | "token_only";

export interface CoverageDetail {
  provider: string;
  model: string;
  source: string;
  tokens: number;
  events: number;
  classification: CoverageClassification;
  reason: string | null;
}

export interface ExclusionSummary {
  provider: string;
  model: string;
  source: string;
  tokens: number;
  events: number;
  reason: string;
}

export interface CalibrationSnapshot {
  referenceEventCostUsd: number;
  computedAt: number;
  supportedEventCount: number;
  supportedMedianSource: string;
}

export type DiagnosticsState = "ready" | "no_data" | "read_error";

export interface OverviewDiagnostics {
  state: DiagnosticsState;
  codexHome: string;
  message: string | null;
}

export interface OverviewResponse {
  tokenTotals: TokenTotals;
  waterLitres: WaterRange;
  coverage: CoverageCounts;
  coverageSummary: CoverageSummary;
  modelUsage: ModelUsageEntry[];
  coverageDetails: CoverageDetail[];
  exclusions: ExclusionSummary[];
  lastIndexedAt: number | null;
  calibration: CalibrationSnapshot | null;
  diagnostics: OverviewDiagnostics;
}

export interface TimeseriesPoint {
  startTs: number;
  key: string;
  label: string;
  tokens: number;
  excludedTokens: number;
  unestimatedTokens: number;
  waterLitres: WaterRange;
}

export interface TimeseriesResponse {
  bucket: Bucket;
  points: TimeseriesPoint[];
}

export interface PricingEntry {
  provider: string;
  model: string;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  sourceUrl: string;
  sourceLabel: string;
}

export type MethodologyTabId = "prompts" | "water" | "energy" | "carbon";

export interface MethodologySourceLink {
  label: string;
  url: string;
}

export interface PricingCatalogMetadata {
  generatedAt: string;
  sourceRepoUrl: string;
  sourceDirectoryUrl: string;
  licenseUrl: string;
  providerCount: number;
  modelCount: number;
}

export interface MethodologyResponse {
  pricingTable: PricingEntry[];
  benchmarkCoefficients: WaterRange;
  calibration: CalibrationSnapshot | null;
  exclusions: ExclusionSummary[];
  pricingCatalog: PricingCatalogMetadata;
  sourcesByTab: Record<MethodologyTabId, MethodologySourceLink[]>;
}

export interface ErrorResponse {
  error: string;
}
