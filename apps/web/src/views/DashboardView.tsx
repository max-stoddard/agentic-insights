import type { Bucket, MethodologyTabId, OverviewResponse, TimeseriesResponse } from "@agentic-insights/shared";
import { AlertBanner } from "../components/AlertBanner";
import { BucketToggle } from "../components/BucketToggle";
import { CoverageSummary } from "../components/CoverageSummary";
import { DataStatusPanel } from "../components/DataStatusPanel";
import { HeroBanner } from "../components/HeroBanner";
import { RoadmapStrip } from "../components/RoadmapStrip";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { WaterScaleChart } from "../components/WaterScaleChart";
import { WaterUsageCard, WaterUsageCardSkeleton } from "../components/WaterUsageCard";
import { WaterChart } from "../components/WaterChart";

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
  return (
    <section className="card px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">Usage over time</h2>
        <BucketToggle active={bucket} onChange={onBucketChange} />
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
        <WaterChart points={timeseries.points} />
      ) : null}
    </section>
  );
}

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
  const showNotReady = overview && !ready;
  const showData = overview && ready;
  const showOverviewSkeleton = !overview && (overviewLoading || !overviewError);
  const showOverviewError = !overview && overviewError;

  return (
    <div className="space-y-6 lg:space-y-8">
      <HeroBanner />

      {showOverviewError ? (
        <AlertBanner title="Something went wrong">{overviewError}</AlertBanner>
      ) : showOverviewSkeleton ? (
        <>
          <WaterUsageCardSkeleton />
          <SkeletonBlock className="h-[34rem]" data-testid="water-scale-skeleton" />
          <UsageOverTimeSection bucket={bucket} loading error={null} timeseries={null} onBucketChange={onBucketChange} />
          <SkeletonBlock className="h-96" data-testid="coverage-summary-skeleton" />
        </>
      ) : showNotReady ? (
        <DataStatusPanel diagnostics={overview.diagnostics} />
      ) : showData ? (
        <>
          <WaterUsageCard overview={overview} onOpenMethodology={() => onOpenMethodology("water")} />

          <WaterScaleChart waterLitres={overview.waterLitres} />

          <UsageOverTimeSection
            bucket={bucket}
            loading={!timeseries && (timeseriesLoading || !timeseriesError)}
            error={timeseries ? null : timeseriesError}
            timeseries={timeseries}
            onBucketChange={onBucketChange}
          />

          <CoverageSummary overview={overview} onOpenMethodology={onOpenMethodology} />
        </>
      ) : null}

      <RoadmapStrip />
    </div>
  );
}
