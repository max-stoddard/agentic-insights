import type { OverviewResponse } from "@ai-water-usage/shared";
import { formatNumber } from "../lib/format";

interface CoverageNoticeProps {
  overview: OverviewResponse;
}

export function CoverageNotice({ overview }: CoverageNoticeProps) {
  const hasExceptions = overview.exclusions.length > 0 || overview.tokenTotals.unestimatedTokens > 0;

  return (
    <section className="coverage-panel shimmer-panel">
      <div className="section-heading">
        <p className="section-kicker">Coverage</p>
        <h2>What counts toward water totals</h2>
      </div>
      <p className="coverage-summary">
        Supported OpenAI events are priced and converted into a water estimate. Unsupported providers/models and fallback-only
        token totals remain visible, but they do not contribute to the water total.
      </p>
      <div className="coverage-grid">
        <div className="coverage-stat">
          <strong>{formatNumber(overview.coverage.supportedEvents)}</strong>
          <span>supported events</span>
        </div>
        <div className="coverage-stat">
          <strong>{formatNumber(overview.coverage.excludedEvents)}</strong>
          <span>excluded events</span>
        </div>
        <div className="coverage-stat">
          <strong>{formatNumber(overview.coverage.tokenOnlyEvents)}</strong>
          <span>token-only events</span>
        </div>
      </div>
      {hasExceptions ? (
        <div className="coverage-list">
          {overview.exclusions.map((item) => (
            <div key={`${item.provider}:${item.model}`} className="coverage-item">
              <strong>
                {item.provider} / {item.model}
              </strong>
              <span>
                {formatNumber(item.tokens)} tokens excluded because {item.reason.toLowerCase()}.
              </span>
            </div>
          ))}
          {overview.tokenTotals.unestimatedTokens > 0 ? (
            <div className="coverage-item">
              <strong>Fallback-only sessions</strong>
              <span>
                {formatNumber(overview.tokenTotals.unestimatedTokens)} tokens were recovered from TUI totals without split token
                data, so they remain unestimated.
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="coverage-clean">Everything parsed so far has pricing coverage and split-token data.</p>
      )}
    </section>
  );
}
