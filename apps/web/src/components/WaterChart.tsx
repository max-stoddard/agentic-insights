import { useEffect, useState } from "react";
import type { TimeseriesPoint } from "@ai-water-usage/shared";
import { formatLitres, formatNumber } from "../lib/format";

interface WaterChartProps {
  points: TimeseriesPoint[];
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function WaterChart({ points }: WaterChartProps) {
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(points.length - 1, 0));

  useEffect(() => {
    setActiveIndex(Math.max(points.length - 1, 0));
  }, [points]);

  if (points.length === 0) {
    return <div className="chart-empty">No Codex usage events were found for the selected bucket.</div>;
  }

  const width = 860;
  const height = 300;
  const padding = { top: 20, right: 24, bottom: 36, left: 24 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxHigh = Math.max(...points.map((point) => point.waterLitres.high), 1);

  const coordinates = points.map((point, index) => {
    const denominator = Math.max(points.length - 1, 1);
    const x = padding.left + (innerWidth * index) / denominator;
    const toY = (value: number) => padding.top + innerHeight - (value / maxHigh) * innerHeight;
    return {
      x,
      centerY: toY(point.waterLitres.central),
      lowY: toY(point.waterLitres.low),
      highY: toY(point.waterLitres.high)
    };
  });

  const upperPath = buildPath(coordinates.map((point) => ({ x: point.x, y: point.highY })));
  const lowerPath = buildPath([...coordinates].reverse().map((point) => ({ x: point.x, y: point.lowY })));
  const bandPath = `${upperPath} ${lowerPath.replace(/^M/, "L")} Z`;
  const centerPath = buildPath(coordinates.map((point) => ({ x: point.x, y: point.centerY })));
  const safeActiveIndex = Math.min(activeIndex, points.length - 1);
  const activePoint = points[safeActiveIndex]!;

  return (
    <div className="chart-shell">
      <svg className="water-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Water usage chart">
        <defs>
          <linearGradient id="water-band" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(57, 124, 255, 0.24)" />
            <stop offset="100%" stopColor="rgba(57, 124, 255, 0.02)" />
          </linearGradient>
        </defs>
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className="chart-axis" />
        <path d={bandPath} className="chart-band" />
        <path d={centerPath} className="chart-line" />
        {coordinates.map((point, index) => {
          const chartPoint = points[index]!;
          const previousPoint = index === 0 ? null : coordinates[index - 1]!;
          const nextPoint = index === points.length - 1 ? null : coordinates[index + 1]!;
          const leftBoundary = previousPoint ? (previousPoint.x + point.x) / 2 : padding.left;
          const rightBoundary = nextPoint ? (nextPoint.x + point.x) / 2 : width - padding.right;
          return (
          <g key={chartPoint.key}>
            <rect
              x={leftBoundary}
              y={padding.top}
              width={rightBoundary - leftBoundary}
              height={innerHeight}
              className="chart-hitbox"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              tabIndex={0}
              aria-label={`${chartPoint.label}: ${formatLitres(chartPoint.waterLitres.central)}`}
            />
            <circle
              cx={point.x}
              cy={point.centerY}
              r={activeIndex === index ? 6 : 4}
              className={activeIndex === index ? "chart-dot is-active" : "chart-dot"}
            />
          </g>
          );
        })}
      </svg>
      <div className="chart-tooltip shimmer-panel" aria-live="polite">
        <p className="chart-tooltip-label">{activePoint.label}</p>
        <p className="chart-tooltip-primary">{formatLitres(activePoint.waterLitres.central)}</p>
        <p className="chart-tooltip-detail">
          Range {formatLitres(activePoint.waterLitres.low)} to {formatLitres(activePoint.waterLitres.high)}
        </p>
        <p className="chart-tooltip-detail">{formatNumber(activePoint.tokens)} tokens</p>
        {(activePoint.excludedTokens > 0 || activePoint.unestimatedTokens > 0) && (
          <p className="chart-tooltip-note">
            {activePoint.excludedTokens > 0 ? `${formatNumber(activePoint.excludedTokens)} excluded` : ""}
            {activePoint.excludedTokens > 0 && activePoint.unestimatedTokens > 0 ? " · " : ""}
            {activePoint.unestimatedTokens > 0 ? `${formatNumber(activePoint.unestimatedTokens)} unestimated` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
