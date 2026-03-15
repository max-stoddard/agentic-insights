import type {
  CalibrationSnapshot,
  CoverageClassification,
  MethodologySourceLink,
  MethodologyTabId,
  OverviewDiagnostics,
  PricingCatalogMetadata,
  PricingEntry,
  WaterRange
} from "@agentic-insights/shared";

export interface FileRecord {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface RawUsageEvent {
  id: string;
  sessionId: string;
  ts: number;
  provider: string;
  model: string;
  source: string;
  totalTokens: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  splitSource: "last_usage" | "derived_totals" | "missing";
  transport: "session" | "tui_fallback" | "claude_project" | "claude_summary" | "gemini_cli";
}

export interface ClassifiedUsageEvent extends RawUsageEvent {
  classification: CoverageClassification;
  waterLitres: WaterRange;
  energyKwh: number;
  carbonKgCo2: number;
  eventCostUsd: number | null;
  exclusionReason: string | null;
}

export interface ExclusionAggregate {
  provider: string;
  model: string;
  source: string;
  tokens: number;
  events: number;
  reason: string;
}

export interface CoverageDetailAggregate {
  provider: string;
  model: string;
  source: string;
  tokens: number;
  events: number;
  classification: CoverageClassification;
  reason: string | null;
}

export interface PromptRecord {
  id: string;
  sessionId: string;
  ts: number;
}

export interface DataSnapshot {
  signature: string;
  events: ClassifiedUsageEvent[];
  promptRecords: PromptRecord[];
  coverageDetails: CoverageDetailAggregate[];
  exclusions: ExclusionAggregate[];
  pricingTable: PricingEntry[];
  pricingCatalog: PricingCatalogMetadata;
  sourcesByTab: Record<MethodologyTabId, MethodologySourceLink[]>;
  benchmarks: WaterRange;
  energyBenchmarkKwh: number;
  carbonIntensityKgCo2PerKwh: number;
  carbonBenchmarkKgCo2: number;
  calibration: CalibrationSnapshot | null;
  lastIndexedAt: number | null;
  diagnostics: OverviewDiagnostics;
}
