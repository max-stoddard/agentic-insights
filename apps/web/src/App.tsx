import { startTransition, useEffect, useState } from "react";
import type { Bucket, MethodologyResponse, OverviewResponse, TimeseriesResponse } from "@agentic-insights/shared";
import { fetchMethodology, fetchOverview, fetchTimeseries } from "./api";
import { AgentMark } from "./components/AgentMark";
import { HomeView } from "./views/HomeView";
import { MethodologyView } from "./views/MethodologyView";
import { PlaceholderView } from "./views/PlaceholderView";

type AppView = "home" | "usage-over-time" | "prompts" | "methodology";

const NAV_ITEMS: Array<{
  description: string;
  hash: `#${AppView}`;
  label: string;
  view: AppView;
}> = [
  {
    view: "home",
    hash: "#home",
    label: "Home",
    description: "Water usage estimate from your Codex history"
  },
  {
    view: "usage-over-time",
    hash: "#usage-over-time",
    label: "Usage over time",
    description: "A dedicated trend page for longer-range water usage analysis is coming soon."
  },
  {
    view: "prompts",
    hash: "#prompts",
    label: "Prompts",
    description: "Prompt-level water analysis and prompt attribution are coming soon."
  },
  {
    view: "methodology",
    hash: "#methodology",
    label: "Methodology",
    description: "Water estimate assumptions, pricing references, and exclusions."
  }
];

function resolveViewFromHash(hash: string): AppView {
  const matchedItem = NAV_ITEMS.find((item) => item.hash === hash);
  return matchedItem?.view ?? "home";
}

function useTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getErrorMessage(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : "Unknown error";
}

export default function App() {
  const timeZone = useTimeZone();
  const [activeView, setActiveView] = useState<AppView>(() => resolveViewFromHash(window.location.hash));
  const [bucket, setBucket] = useState<Bucket>("day");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseriesByBucket, setTimeseriesByBucket] = useState<Partial<Record<Bucket, TimeseriesResponse>>>({});
  const [methodology, setMethodology] = useState<MethodologyResponse | null>(null);
  const [loadedTimeZone, setLoadedTimeZone] = useState(timeZone);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [methodologyLoading, setMethodologyLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null);
  const [methodologyError, setMethodologyError] = useState<string | null>(null);

  useEffect(() => {
    const syncViewFromHash = () => {
      setActiveView(resolveViewFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", syncViewFromHash);
    return () => {
      window.removeEventListener("hashchange", syncViewFromHash);
    };
  }, []);

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
    setMethodologyError(null);
  }, [loadedTimeZone, timeZone]);

  useEffect(() => {
    if (activeView !== "home" && activeView !== "methodology") {
      return;
    }

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
  }, [activeView, overview, timeZone]);

  useEffect(() => {
    if (activeView !== "home") {
      return;
    }

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
  }, [activeView, bucket, overview, timeZone, timeseriesByBucket]);

  useEffect(() => {
    if (activeView !== "methodology") {
      return;
    }

    if (methodology) {
      return;
    }

    let cancelled = false;
    setMethodologyLoading(true);
    setMethodologyError(null);

    fetchMethodology()
      .then((nextMethodology) => {
        if (!cancelled) {
          setMethodology(nextMethodology);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setMethodologyError(getErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMethodologyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, methodology]);

  const navigateTo = (view: AppView) => {
    const nextHash = NAV_ITEMS.find((item) => item.view === view)?.hash ?? "#home";
    setActiveView(view);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  const activeItem = NAV_ITEMS.find((item) => item.view === activeView) ?? NAV_ITEMS[0]!;
  const activeTimeseries = timeseriesByBucket[bucket] ?? null;
  const shouldUseTimeseries = overview?.diagnostics.state === "ready";
  const homeLoading = (overviewLoading && !overview) || (shouldUseTimeseries && timeseriesLoading && !activeTimeseries);
  const homeError = overviewError ?? (shouldUseTimeseries ? timeseriesError : null);
  const methodologyViewLoading = (overviewLoading && !overview) || (methodologyLoading && !methodology);
  const methodologyViewError = overviewError ?? methodologyError;

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="app-frame">
          <header className="border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <a
                href="#home"
                className="brand-lockup"
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo("home");
                }}
              >
                <span className="brand-mark-shell">
                  <AgentMark className="h-7 w-7" />
                </span>
                <span className="text-lg font-semibold tracking-[-0.04em] text-stone-950 sm:text-xl">Agentic Insights</span>
              </a>

              <nav aria-label="Primary" className="flex flex-wrap gap-2 lg:justify-end">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.view === activeView;
                  return (
                    <a
                      key={item.view}
                      href={item.hash}
                      aria-current={isActive ? "page" : undefined}
                      className={isActive ? "nav-link nav-link-active" : "nav-link"}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateTo(item.view);
                      }}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </header>

          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {activeView === "home" ? (
              <HomeView
                bucket={bucket}
                error={homeError}
                loading={homeLoading}
                overview={overview}
                timeseries={activeTimeseries}
                timeZone={timeZone}
                onBucketChange={(nextBucket) => {
                  startTransition(() => {
                    setBucket(nextBucket);
                  });
                }}
                onOpenMethodology={() => {
                  navigateTo("methodology");
                }}
              />
            ) : null}

            {activeView === "usage-over-time" ? (
              <PlaceholderView
                eyebrow="Usage over time"
                title="Dedicated timeline view coming soon"
                description={activeItem.description}
              />
            ) : null}

            {activeView === "prompts" ? (
              <PlaceholderView
                eyebrow="Prompts"
                title="Prompt-level water analysis coming soon"
                description={activeItem.description}
              />
            ) : null}

            {activeView === "methodology" ? (
              <MethodologyView
                error={methodologyViewError}
                loading={methodologyViewLoading}
                methodology={methodology}
                overview={overview}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
