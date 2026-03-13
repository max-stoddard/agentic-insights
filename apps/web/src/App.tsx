import { startTransition, useEffect, useState } from "react";
import type { Bucket, MethodologyResponse, MethodologyTabId, OverviewResponse, TimeseriesResponse } from "@agentic-insights/shared";
import { fetchMethodology, fetchOverview, fetchTimeseries } from "./api";
import { DashboardFooter } from "./components/DashboardFooter";
import { Header } from "./components/Header";
import { MethodologyDrawer } from "./components/MethodologyDrawer";
import { DashboardView } from "./views/DashboardView";

function useTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getErrorMessage(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : "Unknown error";
}

export default function App() {
  const timeZone = useTimeZone();
  const [bucket, setBucket] = useState<Bucket>("day");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseriesByBucket, setTimeseriesByBucket] = useState<Partial<Record<Bucket, TimeseriesResponse>>>({});
  const [methodology, setMethodology] = useState<MethodologyResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [methodologyTab, setMethodologyTab] = useState<MethodologyTabId>("prompts");
  const [loadedTimeZone, setLoadedTimeZone] = useState(timeZone);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [methodologyLoading, setMethodologyLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null);

  useEffect(() => {
    if (loadedTimeZone === timeZone) {
      return;
    }

    setLoadedTimeZone(timeZone);
    setOverview(null);
    setTimeseriesByBucket({});
    setMethodology(null);
    setOverviewError(null);
    setTimeseriesError(null);
  }, [loadedTimeZone, timeZone]);

  useEffect(() => {
    if (overview) {
      return;
    }

    let cancelled = false;
    setOverviewLoading(true);
    setOverviewError(null);

    fetchOverview(timeZone)
      .then((nextOverview) => {
        if (!cancelled) {
          setOverview(nextOverview);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setOverviewError(getErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [overview, timeZone]);

  useEffect(() => {
    if (!overview || overview.diagnostics.state !== "ready" || timeseriesByBucket[bucket]) {
      return;
    }

    let cancelled = false;
    setTimeseriesLoading(true);
    setTimeseriesError(null);

    fetchTimeseries(bucket, timeZone)
      .then((nextTimeseries) => {
        if (!cancelled) {
          setTimeseriesByBucket((current) => ({
            ...current,
            [nextTimeseries.bucket]: nextTimeseries
          }));
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setTimeseriesError(getErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTimeseriesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, overview, timeZone, timeseriesByBucket]);

  useEffect(() => {
    if (!drawerOpen || methodology) {
      return;
    }

    let cancelled = false;
    setMethodologyLoading(true);

    fetchMethodology()
      .then((nextMethodology) => {
        if (!cancelled) {
          setMethodology(nextMethodology);
        }
      })
      .catch(() => {
        // Methodology errors are non-critical; drawer shows loading state
      })
      .finally(() => {
        if (!cancelled) {
          setMethodologyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, methodology]);

  const activeTimeseries = timeseriesByBucket[bucket] ?? null;
  const openMethodology = (tab: MethodologyTabId = "prompts") => {
    setMethodologyTab(tab);
    setDrawerOpen(true);
  };

  return (
    <main className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
        <Header onOpenMethodology={openMethodology} />

        <DashboardView
          bucket={bucket}
          overview={overview}
          overviewLoading={overviewLoading}
          overviewError={overviewError}
          timeseries={activeTimeseries}
          timeseriesLoading={timeseriesLoading}
          timeseriesError={timeseriesError}
          onBucketChange={(nextBucket) => {
            startTransition(() => {
              setBucket(nextBucket);
            });
          }}
          onOpenMethodology={openMethodology}
        />

        <DashboardFooter lastIndexedAt={overview?.lastIndexedAt ?? null} timeZone={timeZone} />
      </div>

      <MethodologyDrawer
        open={drawerOpen}
        methodology={methodology}
        overview={overview}
        defaultTab={methodologyTab}
        loading={methodologyLoading && !methodology}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
