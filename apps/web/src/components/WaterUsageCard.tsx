import type { OverviewResponse } from "@agentic-insights/shared";
import { formatLitres, formatNumber } from "../lib/format";
import { MetricCard } from "./MetricCard";

interface WaterUsageCardProps {
  overview: OverviewResponse;
}

export function WaterUsageCard({ overview }: WaterUsageCardProps) {
  return (
    <MetricCard
      eyebrow="Water used"
      eyebrowClassName="text-base sm:text-lg"
      title="Estimated from your local coding agent activity"
      value={formatLitres(overview.waterLitres.central)}
      detail={`Between ${formatLitres(overview.waterLitres.low)} and ${formatLitres(overview.waterLitres.high)}`}
      footer={<span>Based on {formatNumber(overview.coverage.supportedEvents)} supported usage events</span>}
      aside={
        <span className="pill">
          {Math.round((overview.tokenTotals.supportedTokens / Math.max(overview.tokenTotals.totalTokens, 1)) * 100)}%
          {" "}coverage
        </span>
      }
      tone="feature"
    />
  );
}
