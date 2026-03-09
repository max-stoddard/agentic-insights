import type { MethodologyResponse } from "@ai-water-usage/shared";
import { formatLitres, formatNumber } from "../lib/format";

interface MethodologyPanelProps {
  methodology: MethodologyResponse;
}

export function MethodologyPanel({ methodology }: MethodologyPanelProps) {
  return (
    <section className="methodology-panel shimmer-panel">
      <div className="section-heading">
        <p className="section-kicker">Methodology</p>
        <h2>How tokens become water</h2>
      </div>

      <div className="formula-block">
        <code className="formula-card">
          eventCostUsd = input/1e6 * inputPrice + cachedInput/1e6 * cachedInputPrice + output/1e6 * outputPrice
        </code>
        <code className="formula-card">waterLitres = eventCostUsd / referenceEventCostUsd * benchmarkCoefficient</code>
      </div>

      <p className="methodology-copy">
        Token extraction comes directly from your local Codex logs. Water is not measured directly. Instead, the app uses
        official OpenAI price ratios as a proxy for relative inference intensity, calibrates that proxy against the median
        supported local event, and then applies fixed low/central/high benchmark coefficients.
      </p>

      <div className="methodology-grid">
        <div className="methodology-card">
          <h3>Benchmark coefficients</h3>
          <p>
            Low {formatLitres(methodology.benchmarkCoefficients.low)} · Central{" "}
            {formatLitres(methodology.benchmarkCoefficients.central)} · High{" "}
            {formatLitres(methodology.benchmarkCoefficients.high)}
          </p>
        </div>
        <div className="methodology-card">
          <h3>Calibration snapshot</h3>
          {methodology.calibration ? (
            <p>
              Median supported event cost: {methodology.calibration.referenceEventCostUsd.toFixed(6)} USD-equivalent across{" "}
              {formatNumber(methodology.calibration.supportedEventCount)} supported events.
            </p>
          ) : (
            <p>No supported events were available to compute a local calibration median.</p>
          )}
        </div>
      </div>

      <div className="pricing-table-wrap">
        <table className="pricing-table">
          <thead>
            <tr>
              <th>model</th>
              <th>input / 1M</th>
              <th>cached / 1M</th>
              <th>output / 1M</th>
            </tr>
          </thead>
          <tbody>
            {methodology.pricingTable.map((entry) => (
              <tr key={entry.model}>
                <td>{entry.model}</td>
                <td>${entry.inputUsdPerMillion}</td>
                <td>${entry.cachedInputUsdPerMillion}</td>
                <td>${entry.outputUsdPerMillion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="source-links">
        {methodology.sourceLinks.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
