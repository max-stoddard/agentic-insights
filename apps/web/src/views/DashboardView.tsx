import type { Bucket, OverviewResponse, TimeseriesResponse } from "@agentic-insights/shared";
import { AlertBanner } from "../components/AlertBanner";
import { BucketToggle } from "../components/BucketToggle";
import { CoverageSummary } from "../components/CoverageSummary";
import { DataStatusPanel } from "../components/DataStatusPanel";
import { HeroBanner } from "../components/HeroBanner";
import { RoadmapStrip } from "../components/RoadmapStrip";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { WaterUsageCard } from "../components/WaterUsageCard";
import { WaterChart } from "../components/WaterChart";

interface DashboardViewProps {
  bucket: Bucket;
  error: string | null;
  loading: boolean;
  overview: OverviewResponse | null;
  timeseries: TimeseriesResponse | null;
  onBucketChange: (bucket: Bucket) => void;
  onOpenMethodology: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <SkeletonBlock className="h-56" />
      <SkeletonBlock className="h-96" />
      <SkeletonBlock className="h-24" />
    </div>
  );
}

export function DashboardView({
  bucket,
  error,
  loading,
  overview,
  timeseries,
  onBucketChange,
  onOpenMethodology
}: DashboardViewProps) {
  const ready = overview?.diagnostics.state === "ready";
  const showLoading = loading || !overview;
  const showNotReady = overview && !ready;
  const showData = overview && ready;

  return (
    <div className="space-y-6 lg:space-y-8">
      {error ? <AlertBanner title="Something went wrong">{error}</AlertBanner> : null}

      {showLoading ? (
        <LoadingSkeleton />
      ) : showNotReady ? (
        <DataStatusPanel diagnostics={overview.diagnostics} />
      ) : showData ? (
        <>
          <HeroBanner />

          <WaterUsageCard overview={overview} />

          <section className="card px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-ink">Usage over time</h2>
              <BucketToggle active={bucket} onChange={onBucketChange} />
            </div>
            {timeseries ? (
              <WaterChart points={timeseries.points} />
            ) : (
              <div className="mt-6">
                <SkeletonBlock className="h-72 sm:h-80" />
              </div>
            )}
          </section>

          <CoverageSummary overview={overview} onOpenMethodology={onOpenMethodology} />
        </>
      ) : null}

      <RoadmapStrip />
    </div>
  );
}
