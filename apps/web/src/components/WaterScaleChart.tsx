import { useEffect, useRef, useState } from "react";
import type { WaterRange } from "@agentic-insights/shared";
import { formatLitres, formatScaledLitres } from "../lib/format";
import {
  WATER_SCALE_DOMAIN,
  buildSmoothWaterScalePath,
  buildWaterScaleMarker,
  getWaterScaleAnchors,
  getWaterScaleTicks,
  type WaterScalePoint
} from "../lib/waterScale";

interface WaterScaleChartProps {
  waterLitres: WaterRange;
}

type TooltipState =
  | {
      kind: "anchor";
      id: string;
      x: number;
      y: number;
      title: string;
      litres: number;
      comparisonType: string;
      description: string;
      sourceLabel: string;
      sourceNote?: string;
    }
  | {
      kind: "ai";
      x: number;
      y: number;
      central: number;
      low: number;
      high: number;
    };

const SVG_WIDTH = 960;
const SVG_HEIGHT = 380;
const CHART_PADDING = {
  top: 28,
  right: 36,
  bottom: 122,
  left: 88
} as const;

function wrapLabel(label: string, maxLineLength = 18): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxLineLength || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function formatComparisonTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function mapY(value: number): number {
  const chartHeight = SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const clampedValue = Math.min(WATER_SCALE_DOMAIN.max, Math.max(WATER_SCALE_DOMAIN.min, value));
  const logMin = Math.log10(WATER_SCALE_DOMAIN.min);
  const logMax = Math.log10(WATER_SCALE_DOMAIN.max);
  const logValue = Math.log10(clampedValue);
  const progress = (logValue - logMin) / (logMax - logMin);

  return CHART_PADDING.top + chartHeight - progress * chartHeight;
}

function mapX(value: number, anchorCount: number): number {
  const chartWidth = SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  if (anchorCount <= 1) {
    return CHART_PADDING.left;
  }

  return CHART_PADDING.left + (value / (anchorCount - 1)) * chartWidth;
}

function getTooltipStyle(tooltip: TooltipState): { left: string; top: string; transform: string } {
  const horizontalOffset = 14;
  const verticalOffset = 14;
  const anchorX = (tooltip.x / SVG_WIDTH) * 100;
  const anchorY = (tooltip.y / SVG_HEIGHT) * 100;
  const placeLeft = tooltip.x > SVG_WIDTH * 0.72;
  const placeBelow = tooltip.y < SVG_HEIGHT * 0.22;

  return {
    left: `${anchorX}%`,
    top: `${anchorY}%`,
    transform: `translate(${placeLeft ? "calc(-100% - 14px)" : `${horizontalOffset}px`}, ${
      placeBelow ? `${verticalOffset}px` : "calc(-100% - 14px)"
    })`
  };
}

export function WaterScaleChart({ waterLitres }: WaterScaleChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const anchors = getWaterScaleAnchors();
  const marker = buildWaterScaleMarker(waterLitres, anchors);
  const ticks = getWaterScaleTicks();
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!activeTooltip) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [activeTooltip]);

  const anchorPoints: WaterScalePoint[] = anchors.map((anchor) => ({
    x: mapX(anchor.x, anchors.length),
    y: mapY(anchor.litres)
  }));
  const guidePath = buildSmoothWaterScalePath(anchorPoints);

  const markerX = mapX(marker.x, anchors.length);
  const markerY = mapY(marker.clampedCentral);
  const rangeTopY = mapY(marker.clampedHigh);
  const rangeBottomY = mapY(marker.clampedLow);
  const markerLabelX = markerX > SVG_WIDTH - 220 ? markerX - 14 : markerX + 14;
  const markerLabelAnchor = markerX > SVG_WIDTH - 220 ? "end" : "start";
  const markerLabelY = markerY < CHART_PADDING.top + 32 ? markerY + 26 : markerY - 18;

  function openAnchorTooltip(index: number) {
    const anchor = anchors[index]!;
    const point = anchorPoints[index]!;
    setActiveTooltip({
      kind: "anchor",
      id: anchor.id,
      x: point.x,
      y: point.y,
      title: anchor.label,
      litres: anchor.litres,
      comparisonType: formatComparisonTypeLabel(anchor.comparisonType),
      description: anchor.description,
      sourceLabel: anchor.sourceLabel,
      ...(anchor.sourceNote ? { sourceNote: anchor.sourceNote } : {})
    });
  }

  function openAiTooltip() {
    setActiveTooltip({
      kind: "ai",
      x: markerX,
      y: markerY,
      central: marker.central,
      low: marker.low,
      high: marker.high
    });
  }

  return (
    <section className="card px-6 py-6 sm:px-8 sm:py-8" data-testid="water-scale-section">
      <div className="max-w-3xl">
        <h2 className="text-base font-semibold text-ink">Water at different scales</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          This places your AI estimate on the same logarithmic scale as everyday drinking water, product footprints,
          and larger operational water use.
        </p>
      </div>

      <div className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-secondary">
        These markers mix direct intake, embedded product footprints, and operational water use, so treat them as
        order-of-magnitude context rather than a like-for-like total.
      </div>

      <div
        ref={chartRef}
        className="mt-6 overflow-x-auto"
        data-testid="water-scale-scroll"
        onMouseLeave={() => setActiveTooltip(null)}
      >
        <div className="relative min-w-[56rem]" data-testid="water-scale-canvas">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label="Water scale comparison chart"
            data-testid="water-scale-chart"
          >
            <defs>
              <linearGradient id="water-scale-guide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => {
              const y = mapY(tick);
              return (
                <g key={tick}>
                  <line
                    x1={CHART_PADDING.left}
                    x2={SVG_WIDTH - CHART_PADDING.right}
                    y1={y}
                    y2={y}
                    stroke="#DDEAF5"
                    strokeDasharray="4 6"
                  />
                  <text x={CHART_PADDING.left - 12} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
                    {formatScaledLitres(tick)}
                  </text>
                </g>
              );
            })}

            <path
              d={guidePath}
              fill="none"
              stroke="url(#water-scale-guide)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="water-scale-guide"
            />

            {anchors.map((anchor, index) => {
              const point = anchorPoints[index]!;
              const labelLines = wrapLabel(anchor.label);
              const active = activeTooltip?.kind === "anchor" && activeTooltip.id === anchor.id;

              return (
                <g key={anchor.id} data-testid={`water-scale-anchor-${anchor.id}`}>
                  <circle cx={point.x} cy={point.y} r="6" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2" />
                  <circle
                    data-testid={`water-scale-hit-${anchor.id}`}
                    cx={point.x}
                    cy={point.y}
                    r="18"
                    fill="transparent"
                    stroke={active ? "#0369A1" : "transparent"}
                    strokeWidth="2"
                    tabIndex={0}
                    role="button"
                    aria-label={`${anchor.label}: ${formatLitres(anchor.litres)}`}
                    onMouseEnter={() => openAnchorTooltip(index)}
                    onFocus={() => openAnchorTooltip(index)}
                    onClick={() => openAnchorTooltip(index)}
                    onBlur={() => setActiveTooltip(null)}
                  />
                  <text
                    x={point.x}
                    y={SVG_HEIGHT - CHART_PADDING.bottom + 28}
                    textAnchor="middle"
                    className="fill-slate-700 text-[12px] font-medium"
                  >
                    {labelLines.map((line, lineIndex) => (
                      <tspan key={`${anchor.id}-${line}`} x={point.x} dy={lineIndex === 0 ? 0 : 14}>
                        {line}
                      </tspan>
                    ))}
                    <tspan x={point.x} dy="16" className="fill-slate-400 text-[11px] font-normal">
                      {formatScaledLitres(anchor.litres)}
                    </tspan>
                  </text>
                </g>
              );
            })}

            <g data-testid="water-scale-range">
              <line x1={markerX} x2={markerX} y1={rangeTopY} y2={rangeBottomY} stroke="#F59E0B" strokeWidth="2" opacity="0.8" />
              <line x1={markerX - 7} x2={markerX + 7} y1={rangeTopY} y2={rangeTopY} stroke="#F59E0B" strokeWidth="2" opacity="0.8" />
              <line x1={markerX - 7} x2={markerX + 7} y1={rangeBottomY} y2={rangeBottomY} stroke="#F59E0B" strokeWidth="2" opacity="0.8" />
            </g>

            <g data-testid="water-scale-ai-marker">
              <circle cx={markerX} cy={markerY} r="14" fill="#F59E0B" opacity="0.18" />
              <circle cx={markerX} cy={markerY} r="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle
                data-testid="water-scale-hit-ai"
                cx={markerX}
                cy={markerY}
                r="20"
                fill="transparent"
                stroke={activeTooltip?.kind === "ai" ? "#B45309" : "transparent"}
                strokeWidth="2"
                tabIndex={0}
                role="button"
                aria-label={`Your AI usage: ${formatLitres(marker.central)}`}
                onMouseEnter={openAiTooltip}
                onFocus={openAiTooltip}
                onClick={openAiTooltip}
                onBlur={() => setActiveTooltip(null)}
              />
              <text
                x={markerLabelX}
                y={markerLabelY}
                textAnchor={markerLabelAnchor}
                className="fill-amber-700 text-[12px] font-semibold"
              >
                <tspan x={markerLabelX} dy="0">
                  Your AI usage
                </tspan>
                <tspan x={markerLabelX} dy="16" className="fill-amber-600 text-[11px] font-medium">
                  {formatLitres(marker.central)}
                </tspan>
              </text>
            </g>
          </svg>

          {activeTooltip ? (
            <div
              data-testid="water-scale-tooltip"
              className="pointer-events-none absolute z-10 w-[18rem] rounded-xl border border-slate-800/80 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur"
              style={getTooltipStyle(activeTooltip)}
            >
              {activeTooltip.kind === "anchor" ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{activeTooltip.comparisonType}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{activeTooltip.title}</p>
                  <p className="mt-1 text-lg font-bold tracking-[-0.03em]">{formatLitres(activeTooltip.litres)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{activeTooltip.description}</p>
                  {activeTooltip.sourceNote ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{activeTooltip.sourceNote}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{activeTooltip.sourceLabel}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-300">AI estimate</p>
                  <p className="mt-1 text-sm font-semibold text-white">Your AI usage</p>
                  <p className="mt-1 text-lg font-bold tracking-[-0.03em]">{formatLitres(activeTooltip.central)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    Between {formatLitres(activeTooltip.low)} and {formatLitres(activeTooltip.high)} on the same
                    logarithmic scale as the comparison points.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
