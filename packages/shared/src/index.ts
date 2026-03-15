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

export interface WeeklyGrowthMetric {
  current: number;
  previous: number;
  increase: number;
}

export interface WeeklyGrowthSummary {
  sessions: WeeklyGrowthMetric;
  prompts: WeeklyGrowthMetric;
  tokens: WeeklyGrowthMetric;
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
  apiCostUsd: number;
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

export type DiagnosticsState = "ready" | "no_data" | "read_error" | "indexing";

export type IndexingPhase = "discovering" | "parsing" | "estimating" | "finalizing";

export interface IndexingStatus {
  phase: IndexingPhase;
  startedAt: number;
  updatedAt: number;
}

export interface OverviewDiagnostics {
  state: DiagnosticsState;
  codexHome: string;
  message: string | null;
}

export interface OverviewResponse {
  tokenTotals: TokenTotals;
  waterLitres: WaterRange;
  energyKwh: number;
  carbonKgCo2: number;
  coverage: CoverageCounts;
  coverageSummary: CoverageSummary;
  weeklyGrowth: WeeklyGrowthSummary;
  modelUsage: ModelUsageEntry[];
  coverageDetails: CoverageDetail[];
  exclusions: ExclusionSummary[];
  lastIndexedAt: number | null;
  calibration: CalibrationSnapshot | null;
  indexing: IndexingStatus | null;
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
  energyKwh: number;
  carbonKgCo2: number;
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

export type WaterComparisonType = "direct_intake" | "embedded_footprint" | "operational_use";

export interface WaterScaleComparison {
  id:
    | "cup-of-water"
    | "person-per-day"
    | "coffee"
    | "jeans"
    | "manufacturing-a-car"
    | "golf-course-daily";
  label: string;
  litres: number;
  comparisonType: WaterComparisonType;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceNote?: string;
  singularLabel?: string;
  pluralLabel?: string;
}

export interface WaterProductEquivalent extends WaterScaleComparison {
  singularLabel: string;
  pluralLabel: string;
}

export const WATER_SCALE_COMPARISONS: readonly WaterScaleComparison[] = [
  {
    id: "cup-of-water",
    label: "A cup of water",
    litres: 0.24,
    comparisonType: "direct_intake",
    description: "The volume of one metric cup of drinking water.",
    sourceLabel: "NIST Metric Kitchen: Cooking Measurement Equivalencies",
    sourceUrl: "https://www.nist.gov/pml/owm/metric-kitchen-cooking-measurement-equivalencies",
    sourceNote: "Uses NIST's 1 cup = 240 mL conversion."
  },
  {
    id: "person-per-day",
    label: "A daily intake",
    litres: 2.25,
    comparisonType: "direct_intake",
    description: "A representative daily adult drinking-water intake from fluids.",
    sourceLabel: "EFSA Dietary Reference Values for Water",
    sourceUrl: "https://www.efsa.europa.eu/en/efsajournal/pub/1459",
    sourceNote: "Midpoint of EFSA adult adequate intakes: 2.0 L/day for females and 2.5 L/day for males."
  },
  {
    id: "coffee",
    label: "A cup of coffee",
    litres: 140,
    comparisonType: "embedded_footprint",
    description: "The embedded freshwater footprint associated with one cup of coffee.",
    sourceLabel: "Ecological Economics DOI: The water footprint of coffee and tea consumption in the Netherlands",
    sourceUrl: "https://doi.org/10.1016/j.ecolecon.2007.02.022",
    sourceNote: "Represents the study's published water footprint per cup of coffee.",
    singularLabel: "cup of coffee",
    pluralLabel: "cups of coffee"
  },
  {
    id: "jeans",
    label: "A pair of jeans",
    litres: 3781,
    comparisonType: "embedded_footprint",
    description: "The embedded freshwater footprint for one pair of denim jeans.",
    sourceLabel: "Sustainability Science DOI: Comparing ecological and water footprint of denim jeans and a tri-blend T-shirt",
    sourceUrl: "https://doi.org/10.1007/s11625-022-01131-0",
    sourceNote: "Uses the study's published footprint for a pair of denim jeans.",
    singularLabel: "pair of jeans",
    pluralLabel: "pairs of jeans"
  },
  {
    id: "manufacturing-a-car",
    label: "A car",
    litres: 67500,
    comparisonType: "operational_use",
    description: "A lifecycle water-consumption estimate for a European passenger car.",
    sourceLabel: "Environmental Science & Technology DOI: Water Footprint of European Cars: Potential Impacts of Water Consumption along Automobile Life Cycles",
    sourceUrl: "https://doi.org/10.1021/es2040043",
    sourceNote: "Uses the midpoint of the study's 52–83 m³/car range. The paper reports that more than 95% occurs in the production phase."
  },
  {
    id: "golf-course-daily",
    label: "A golf course per day",
    litres: 515000,
    comparisonType: "operational_use",
    description: "Approximate daily irrigation-scale water use for an average 18-hole U.S. golf course.",
    sourceLabel: "GCSAA Golf Course Environmental Profile: Phase II Water Use and Conservation Practices on U.S. Golf Courses",
    sourceUrl: "https://www.gcsaa.org/docs/default-source/Environment/phase-2-water-use-survey-full-report.pdf?sfvrsn=2b39123e_4",
    sourceNote: "Derived as about 515,000 L/day from the 152.5 acre-feet/year 18-hole facility average used in GCSAA profile summaries."
  }
] as const;

export const WATER_PRODUCT_EQUIVALENTS: readonly WaterProductEquivalent[] = WATER_SCALE_COMPARISONS.filter(
  (comparison): comparison is WaterProductEquivalent =>
    (comparison.id === "coffee" || comparison.id === "jeans") &&
    comparison.singularLabel !== undefined &&
    comparison.pluralLabel !== undefined
);

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
  energyBenchmarkKwh: number;
  carbonIntensityKgCo2PerKwh: number;
  carbonBenchmarkKgCo2: number;
  calibration: CalibrationSnapshot | null;
  exclusions: ExclusionSummary[];
  pricingCatalog: PricingCatalogMetadata;
  sourcesByTab: Record<MethodologyTabId, MethodologySourceLink[]>;
}

export interface ErrorResponse {
  error: string;
}
