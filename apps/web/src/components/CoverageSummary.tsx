import { useState } from "react";
import type { MethodologyTabId, OverviewResponse } from "@agentic-insights/shared";
import { ModelUsageList } from "./ModelUsageList";
import { ModelUsageStatusKey } from "./ModelUsageStatusKey";
import { UsageSummaryMetrics } from "./UsageSummaryMetrics";

interface CoverageSummaryProps {
  overview: OverviewResponse;
  onOpenMethodology: (tab?: MethodologyTabId) => void;
}

export function CoverageSummary({ overview, onOpenMethodology }: CoverageSummaryProps) {
  const [showAllModels, setShowAllModels] = useState(false);
  const hasModelUsage = overview.modelUsage.length > 0;
  const topModels = overview.modelUsage.slice(0, 3);
  const remainingModels = overview.modelUsage.slice(3);

  return (
    <section className="card px-6 py-5 sm:px-8 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Agent usage by model</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            See how many sessions and prompts were counted, how many priced tokens were included, and which models are
            driving the most local agent usage.
          </p>
        </div>
        <button
          type="button"
          className="pill transition-colors hover:bg-accent-muted hover:text-accent-hover"
          onClick={() => onOpenMethodology()}
        >
          How it works
        </button>
      </div>

      <UsageSummaryMetrics
        sessions={overview.coverageSummary.sessions}
        prompts={overview.coverageSummary.prompts}
        tokens={overview.tokenTotals.supportedTokens}
        growth={overview.weeklyGrowth}
      />
      <ModelUsageStatusKey />

      {hasModelUsage ? (
        <div className="mt-5">
          <ModelUsageList items={topModels} showRank />

          {remainingModels.length > 0 ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAllModels(!showAllModels)}
                className="flex items-center gap-1.5 text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${showAllModels ? "rotate-90" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
                {showAllModels ? "Show fewer models" : "Show all models"}
              </button>

              {showAllModels ? <div className="mt-3"><ModelUsageList items={remainingModels} /></div> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-secondary">
          No priced model usage has been indexed yet.
        </p>
      )}
    </section>
  );
}
