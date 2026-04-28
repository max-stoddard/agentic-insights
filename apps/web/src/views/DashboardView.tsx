import { useState } from "react";
import type { Bucket, MethodologyTabId, OverviewResponse, TimeseriesResponse } from "@agentic-insights/shared";
import { AlertBanner } from "../components/AlertBanner";
import { BucketToggle } from "../components/BucketToggle";
import { CoverageSummary } from "../components/CoverageSummary";
import { DataStatusPanel } from "../components/DataStatusPanel";
import { HeroBanner } from "../components/HeroBanner";
import { HighestSpendSessionsCard } from "../components/HighestSpendSessionsCard";
import { ImpactMetricToggle } from "../components/ImpactMetricToggle";
import { IndexingStatusCard } from "../components/IndexingStatusCard";
import { ScrollReveal } from "../components/ScrollReveal";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { WaterScaleChart } from "../components/WaterScaleChart";
import { CarbonUsageCard, EnergyUsageCard, UsageCardsSkeleton, WaterUsageCard } from "../components/WaterUsageCard";
import { ImpactChart } from "../components/WaterChart";
import type { ChartMetric } from "../lib/footprint";

interface DashboardViewProps {
  bucket: Bucket;
  overview: OverviewResponse | null;
  overviewLoading: boolean;
  overviewError: string | null;
  timeseries: TimeseriesResponse | null;
  timeseriesLoading: boolean;
  timeseriesError: string | null;
  onBucketChange: (bucket: Bucket) => void;
  onOpenMethodology: (tab?: MethodologyTabId) => void;
}

interface UsageOverTimeSectionProps {
  bucket: Bucket;
  loading: boolean;
  error: string | null;
  timeseries: TimeseriesResponse | null;
  onBucketChange: (bucket: Bucket) => void;
}

function UsageOverTimeSection({ bucket, loading, error, timeseries, onBucketChange }: UsageOverTimeSectionProps) {
  const [metric, setMetric] = useState<ChartMetric>("water");

  return (
    <section className="card px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-base font-semibold text-ink">Usage over time</h2>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ImpactMetricToggle active={metric} onChange={setMetric} />
          <BucketToggle active={bucket} onChange={onBucketChange} />
        </div>
      </div>

      {loading ? (
        <div className="mt-6" data-testid="usage-over-time-skeleton">
          <SkeletonBlock className="h-72 sm:h-80" />
        </div>
      ) : error ? (
        <div className="mt-6" data-testid="usage-over-time-error">
          <AlertBanner title="Could not load usage over time">{error}</AlertBanner>
        </div>
      ) : timeseries ? (
        <ImpactChart metric={metric} points={timeseries.points} />
      ) : null}
    </section>
  );
}

function hasOverviewContent(overview: OverviewResponse): boolean {
  return (
    overview.tokenTotals.totalTokens > 0 ||
    overview.energyKwh > 0 ||
    overview.carbonKgCo2 > 0 ||
    overview.coverageSummary.sessions > 0 ||
    overview.coverageSummary.prompts > 0 ||
    overview.modelUsage.length > 0 ||
    overview.highestSpendSessions.length > 0 ||
    overview.coverageDetails.length > 0 ||
    overview.exclusions.length > 0 ||
    overview.lastIndexedAt !== null ||
    overview.calibration !== null
  );
}

const INITIAL_INDEXING_PLACEHOLDER: NonNullable<OverviewResponse["indexing"]> = {
  phase: "discovering",
  startedAt: 0,
  updatedAt: 0
};

export function DashboardView({
  bucket,
  overview,
  overviewLoading,
  overviewError,
  timeseries,
  timeseriesLoading,
  timeseriesError,
  onBucketChange,
  onOpenMethodology
}: DashboardViewProps) {
  const ready = overview?.diagnostics.state === "ready";
  const indexing = overview?.diagnostics.state === "indexing";
  const overviewHasContent = overview ? hasOverviewContent(overview) : false;
  const showNotReady = overview && !ready && !indexing;
  const showData = overview && (ready || (indexing && overviewHasContent));
  const showOverviewSkeleton = (!overview && (overviewLoading || !overviewError)) || (Boolean(indexing) && !overviewHasContent);
  const showOverviewError = !overview && overviewError;
  const indexingCardState = overview?.indexing ?? (!overview && overviewLoading && !overviewError ? INITIAL_INDEXING_PLACEHOLDER : null);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="space-y-4">
        <HeroBanner />
        <IndexingStatusCard indexing={indexingCardState} />
      </div>

      {showOverviewError ? (
        <AlertBanner title="Something went wrong">{overviewError}</AlertBanner>
      ) : showOverviewSkeleton ? (
        <>
          <UsageCardsSkeleton />
          <UsageOverTimeSection bucket={bucket} loading error={null} timeseries={null} onBucketChange={onBucketChange} />
          <SkeletonBlock className="h-[34rem]" data-testid="water-scale-skeleton" />
          <SkeletonBlock className="h-96" data-testid="coverage-summary-skeleton" />
          <SkeletonBlock className="h-80" data-testid="highest-spend-skeleton" />
        </>
      ) : showNotReady ? (
        <ScrollReveal>
          <DataStatusPanel diagnostics={overview.diagnostics} />
        </ScrollReveal>
      ) : showData ? (
        <>
          <ScrollReveal>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <WaterUsageCard overview={overview} onOpenMethodology={() => onOpenMethodology("water")} />
              </div>
              <EnergyUsageCard overview={overview} onOpenMethodology={() => onOpenMethodology("energy")} />
              <CarbonUsageCard overview={overview} onOpenMethodology={() => onOpenMethodology("carbon")} />
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={80}>
            <UsageOverTimeSection
              bucket={bucket}
              loading={!timeseries && (timeseriesLoading || !timeseriesError)}
              error={timeseries ? null : timeseriesError}
              timeseries={timeseries}
              onBucketChange={onBucketChange}
            />
          </ScrollReveal>

          <ScrollReveal delayMs={160}>
            <WaterScaleChart waterLitres={overview.waterLitres} />
          </ScrollReveal>

          <ScrollReveal delayMs={240}>
            <CoverageSummary overview={overview} onOpenMethodology={onOpenMethodology} />
          </ScrollReveal>

          <ScrollReveal delayMs={320}>
            <HighestSpendSessionsCard sessions={overview.highestSpendSessions} />
          </ScrollReveal>
        </>
      ) : null}
    </div>
  );
}
