import { Callout } from "@tremor/react";
import { startTransition, useEffect, useState } from "react";
import type { Bucket, MethodologyResponse, OverviewResponse, TimeseriesResponse } from "@ai-water-usage/shared";
import { fetchMethodology, fetchOverview, fetchTimeseries } from "./api";
import { BucketToggle } from "./components/BucketToggle";
import { CoverageNotice } from "./components/CoverageNotice";
import { MethodologyPanel } from "./components/MethodologyPanel";
import { MetricCard } from "./components/MetricCard";
import { WaterChart } from "./components/WaterChart";
import { formatDateTime, formatLitres, formatNumber } from "./lib/format";

function useTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[24px] border border-stone-200 bg-white/80 ${className}`} />;
}

function HeroSnapshot({
  loading,
  overview,
  timeZone
}: {
  loading: boolean;
  overview: OverviewResponse | null;
  timeZone: string;
}) {
  if (loading || !overview) {
    return (
      <div className="panel-muted p-5 sm:p-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-40" />
        </div>
        <div className="mt-6 space-y-3">
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const rows = [
    { label: "Estimated litres", value: formatLitres(overview.waterLitres.central), detail: "central estimate" },
    { label: "Supported events", value: formatNumber(overview.coverage.supportedEvents), detail: "priced and estimated" },
    { label: "Last indexed", value: formatDateTime(overview.lastIndexedAt), detail: timeZone }
  ];

  return (
    <div className="panel-muted p-5 sm:p-6">
      <p className="section-kicker">Current snapshot</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-[-0.05em] text-stone-950">
            {formatLitres(overview.waterLitres.central)}
          </p>
          <p className="mt-1 text-sm text-stone-600">derived from supported local Codex usage</p>
        </div>
        <div className="h-12 w-12 rounded-2xl border border-cyan-200 bg-cyan-50 text-center text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-cyan-700 leading-[3rem]">
          H2O
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 rounded-[20px] border border-stone-200 bg-white px-4 py-3"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{row.label}</p>
              <p className="mt-1 text-sm text-stone-600">{row.detail}</p>
            </div>
            <p className="text-right text-sm font-semibold text-stone-900 sm:text-base">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <section className="space-y-4" aria-label="Loading dashboard">
      <div className="grid gap-4 lg:grid-cols-12">
        <SkeletonBlock className="h-52 lg:col-span-5" />
        <SkeletonBlock className="h-52 lg:col-span-3" />
        <SkeletonBlock className="h-52 lg:col-span-4" />
      </div>
      <SkeletonBlock className="h-[28rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-[28rem]" />
        <SkeletonBlock className="h-[28rem]" />
      </div>
    </section>
  );
}

export default function App() {
  const timeZone = useTimeZone();
  const [bucket, setBucket] = useState<Bucket>("day");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [methodology, setMethodology] = useState<MethodologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchOverview(timeZone), fetchTimeseries(bucket, timeZone), fetchMethodology()])
      .then(([nextOverview, nextTimeseries, nextMethodology]) => {
        if (cancelled) {
          return;
        }
        setOverview(nextOverview);
        setTimeseries(nextTimeseries);
        setMethodology(nextMethodology);
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if (cancelled) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, timeZone]);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="app-frame px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-4 lg:gap-5">
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.82fr)]">
              <div className="panel-shell relative overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
                <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),transparent_56%)]" />
                <div className="relative">
                  <div className="micro-pill">Local Codex Water Usage</div>
                  <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <p className="section-kicker">Water-weighted local estimate</p>
                      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-stone-950 sm:text-5xl">
                        Water usage estimate from your Codex history
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
                        A cleaner read on local usage: pricing-weighted water estimates, explicit exclusions, and a stable
                        low-to-high range based on supported OpenAI events.
                      </p>
                      <div className="mt-8 flex flex-wrap gap-2.5">
                        <span className="micro-pill">Low / central / high range</span>
                        <span className="micro-pill">Local calibration median</span>
                        <span className="micro-pill">Unsupported models kept visible</span>
                      </div>
                    </div>

                    <div className="panel-muted flex flex-col justify-between p-5">
                      <div>
                        <p className="section-kicker">What this tracks</p>
                        <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-stone-950">
                          Supported token flow converted into a water estimate
                        </p>
                      </div>
                      <div className="mt-6 space-y-3 text-sm leading-6 text-stone-600">
                        <p>Exact token counts stay visible.</p>
                        <p>Unsupported providers are separated, not hidden.</p>
                        <p>Range data remains available in the trend view.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <HeroSnapshot loading={loading} overview={overview} timeZone={timeZone} />
            </section>

            {error ? (
              <Callout
                title="Failed to load dashboard data"
                color="rose"
                className="rounded-[24px] border border-rose-200 bg-rose-50/90"
              >
                {error}
              </Callout>
            ) : null}

            {loading || !overview || !timeseries || !methodology ? (
              <LoadingDashboard />
            ) : (
              <>
                <section className="grid gap-4 lg:grid-cols-12">
                  <MetricCard
                    eyebrow="Total water used"
                    title="Estimated litres"
                    value={formatLitres(overview.waterLitres.central)}
                    detail={`Range ${formatLitres(overview.waterLitres.low)} to ${formatLitres(overview.waterLitres.high)}`}
                    footer={<span>Local calibration with fixed benchmark coefficients</span>}
                    tone="feature"
                    className="lg:col-span-5"
                  />
                  <MetricCard
                    eyebrow="Total token usage"
                    title="All parsed tokens"
                    value={formatNumber(overview.tokenTotals.totalTokens)}
                    detail={`${formatNumber(overview.tokenTotals.supportedTokens)} supported · ${formatNumber(
                      overview.tokenTotals.excludedTokens
                    )} excluded · ${formatNumber(overview.tokenTotals.unestimatedTokens)} unestimated`}
                    footer={<span>Water totals exclude unsupported and token-only events</span>}
                    className="lg:col-span-3"
                  />
                  <MetricCard
                    eyebrow="Coverage snapshot"
                    title="Last indexed"
                    value={formatDateTime(overview.lastIndexedAt)}
                    detail={`${formatNumber(overview.coverage.supportedEvents)} supported events with pricing coverage`}
                    footer={<span>Browser timezone: {timeZone}</span>}
                    size="compact"
                    className="lg:col-span-4"
                  />
                </section>

                <section className="panel-shell px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="section-kicker">Trend</p>
                      <h2 className="mt-3 section-heading">Water usage by {bucket}</h2>
                      <p className="mt-4 section-copy">
                        The central estimate is the primary signal. Each point preserves the low and high range together with
                        excluded and unestimated token counts.
                      </p>
                    </div>
                    <BucketToggle
                      active={bucket}
                      onChange={(nextBucket) => {
                        startTransition(() => {
                          setBucket(nextBucket);
                        });
                      }}
                    />
                  </div>
                  <WaterChart points={timeseries.points} />
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <CoverageNotice overview={overview} />
                  <MethodologyPanel methodology={methodology} />
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
