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
    <main className="app-shell">
      <section className="hero">
        <div className="hero-chip">Local Codex Water Usage</div>
        <div className="hero-grid">
          <div className="hero-copy-block">
            <p className="hero-kicker">Clean local estimate</p>
            <h1>Water-weighted usage from your Codex history.</h1>
            <p className="hero-copy">
              Local session artifacts in, pricing-weighted water estimate out. Exact tokens, explicit exclusions, low to high
              range.
            </p>
          </div>
          <div className="hero-highlight" aria-hidden="true">
            <div className="hero-highlight-orb" />
            <div className="hero-highlight-card shimmer-panel">
              <span>Supported OpenAI token flow</span>
              <strong>Mapped to a local water estimate</strong>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="error-banner">Failed to load dashboard data: {error}</div> : null}

      {loading || !overview || !timeseries || !methodology ? (
        <section className="loading-shell" aria-label="Loading dashboard">
          <div className="loading-card shimmer-panel loading-hero" />
          <div className="loading-grid">
            <div className="loading-card shimmer-panel" />
            <div className="loading-card shimmer-panel" />
            <div className="loading-card shimmer-panel" />
          </div>
          <div className="loading-card shimmer-panel loading-chart" />
          <div className="loading-grid loading-grid-secondary">
            <div className="loading-card shimmer-panel loading-panel" />
            <div className="loading-card shimmer-panel loading-panel" />
          </div>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard
              eyebrow="Total water used"
              title="Estimated litres"
              value={formatLitres(overview.waterLitres.central)}
              detail={`Range ${formatLitres(overview.waterLitres.low)} to ${formatLitres(overview.waterLitres.high)}`}
              footer={<span>Local calibration, fixed benchmark coefficients</span>}
            />
            <MetricCard
              eyebrow="Total token usage"
              title="All parsed tokens"
              value={formatNumber(overview.tokenTotals.totalTokens)}
              detail={`${formatNumber(overview.tokenTotals.supportedTokens)} supported · ${formatNumber(
                overview.tokenTotals.excludedTokens
              )} excluded · ${formatNumber(overview.tokenTotals.unestimatedTokens)} unestimated`}
              footer={<span>Water totals exclude unsupported and token-only events</span>}
            />
            <MetricCard
              eyebrow="Coverage snapshot"
              title="Last indexed"
              value={formatDateTime(overview.lastIndexedAt)}
              detail={`${formatNumber(overview.coverage.supportedEvents)} supported events with pricing coverage`}
              footer={<span>Browser timezone: {timeZone}</span>}
            />
          </section>

          <section className="chart-panel">
            <div className="chart-header">
              <div>
                <p className="section-kicker">Trend</p>
                <h2>Water usage by {bucket}</h2>
                <p className="section-subcopy">Central estimate shown as the primary line, with low/high range preserved.</p>
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

          <CoverageNotice overview={overview} />
          <MethodologyPanel methodology={methodology} />
        </>
      )}
    </main>
  );
}
