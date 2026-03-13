import type { OverviewResponse } from "@agentic-insights/shared";
import { formatLitres, formatNumber } from "../lib/format";
import { MetricCard } from "./MetricCard";

interface WaterUsageCardProps {
  overview: OverviewResponse;
  onOpenMethodology: () => void;
}

function LoadingLine({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/16 ${className}`} />;
}

export function WaterUsageCard({ overview, onOpenMethodology }: WaterUsageCardProps) {
  return (
    <MetricCard
      eyebrow="Water used"
      eyebrowClassName="text-base sm:text-lg"
      title="Estimated from your local coding agent activity"
      value={formatLitres(overview.waterLitres.central)}
      detail={`Between ${formatLitres(overview.waterLitres.low)} and ${formatLitres(overview.waterLitres.high)}`}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Based on {formatNumber(overview.coverage.supportedEvents)} supported usage events</span>
          <button
            type="button"
            onClick={onOpenMethodology}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            How is this calculated?
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path
                fillRule="evenodd"
                d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      }
      tone="feature"
    />
  );
}

export function WaterUsageCardSkeleton() {
  return (
    <div data-testid="water-usage-card-skeleton">
      <MetricCard
        eyebrow="Water used"
        eyebrowClassName="text-base sm:text-lg"
        title="Estimated from your local coding agent activity"
        value={
          <div className="max-w-[22rem]">
            <LoadingLine className="h-10 w-40 sm:h-12 sm:w-52 lg:h-16 lg:w-64" />
          </div>
        }
        detail={
          <div className="space-y-2">
            <LoadingLine className="h-4 w-56 max-w-full" />
            <LoadingLine className="h-4 w-44 max-w-full" />
          </div>
        }
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <LoadingLine className="h-4 w-52 max-w-full" />
            <LoadingLine className="h-9 w-40 rounded-lg max-w-full" />
          </div>
        }
        tone="feature"
      />
    </div>
  );
}
