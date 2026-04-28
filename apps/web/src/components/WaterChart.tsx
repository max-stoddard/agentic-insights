import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { TimeseriesPoint } from "@agentic-insights/shared";
import { Bar, BarChart, CartesianGrid, Cell, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_METRIC_DEFINITION, getChartMetricValue, type ChartMetric } from "../lib/footprint";
import { formatCompactUsdCost, formatLitres, formatNumber } from "../lib/format";

interface ImpactChartProps {
  metric: ChartMetric;
  points: TimeseriesPoint[];
}

interface ChartDatum {
  key: string;
  label: string;
  value: number;
  low: number | null;
  high: number | null;
  tokens: number;
}

interface TooltipContentProps {
  active?: boolean;
  metric: ChartMetric;
  payload?: Array<{ payload: ChartDatum }>;
}

interface ChartBarShapeProps extends ComponentProps<typeof Rectangle> {
  payload?: ChartDatum;
}

interface ChartTheme {
  fillId: string;
  start: string;
  end: string;
  activeFill: string;
  activeStroke: string;
  background: string;
  cursor: string;
  gridStroke: string;
  shell: string;
}

const MAX_VISIBLE_LABELS = 5;
const MIN_CHART_HEIGHT = 280;
const CHART_DOMAIN_HEADROOM_MULTIPLIER = 1.08;
const MIN_NON_ZERO_DOMAIN_MAX = 1;
const CHART_BAR_ANIMATION_ENABLED = typeof navigator === "undefined" || !/\bjsdom\b/i.test(navigator.userAgent);

const CHART_THEME_BY_METRIC: Record<ChartMetric, ChartTheme> = {
  water: {
    fillId: "water-bar-fill",
    start: "#0EA5E9",
    end: "#38BDF8",
    activeFill: "#0284C7",
    activeStroke: "#E0F2FE",
    background: "rgba(186, 230, 253, 0.28)",
    cursor: "rgba(14, 165, 233, 0.08)",
    gridStroke: "#DDEAF5",
    shell:
      "min-w-0 h-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(248,250,252,0.88))] px-3 pb-3 pt-4 sm:h-80 sm:px-4"
  },
  energy: {
    fillId: "energy-bar-fill",
    start: "#F59E0B",
    end: "#FBBF24",
    activeFill: "#D97706",
    activeStroke: "#FEF3C7",
    background: "rgba(253, 230, 138, 0.26)",
    cursor: "rgba(245, 158, 11, 0.10)",
    gridStroke: "#FDE7C2",
    shell:
      "min-w-0 h-72 overflow-hidden rounded-2xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,247,237,0.92))] px-3 pb-3 pt-4 sm:h-80 sm:px-4"
  },
  carbon: {
    fillId: "carbon-bar-fill",
    start: "#475569",
    end: "#64748B",
    activeFill: "#334155",
    activeStroke: "#E2E8F0",
    background: "rgba(203, 213, 225, 0.30)",
    cursor: "rgba(71, 85, 105, 0.10)",
    gridStroke: "#E2E8F0",
    shell:
      "min-w-0 h-72 overflow-hidden rounded-2xl border border-slate-300/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] px-3 pb-3 pt-4 sm:h-80 sm:px-4"
  },
  cost: {
    fillId: "cost-bar-fill",
    start: "#10B981",
    end: "#34D399",
    activeFill: "#059669",
    activeStroke: "#D1FAE5",
    background: "rgba(167, 243, 208, 0.26)",
    cursor: "rgba(16, 185, 129, 0.10)",
    gridStroke: "#CFF7E5",
    shell:
      "min-w-0 h-72 overflow-hidden rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(240,253,250,0.92))] px-3 pb-3 pt-4 sm:h-80 sm:px-4"
  }
};

function toChartData(points: TimeseriesPoint[], metric: ChartMetric): ChartDatum[] {
  return points.map((point) => ({
    key: point.key,
    label: point.label,
    value: getChartMetricValue(metric, point),
    low: metric === "water" ? point.waterLitres.low : null,
    high: metric === "water" ? point.waterLitres.high : null,
    tokens: point.tokens
  }));
}

function getXAxisInterval(pointCount: number): number {
  if (pointCount <= MAX_VISIBLE_LABELS) {
    return 0;
  }

  return Math.ceil(pointCount / MAX_VISIBLE_LABELS) - 1;
}

function getYAxisMax(chartData: ChartDatum[]): number {
  const peakValue = chartData.reduce((currentMax, point) => Math.max(currentMax, point.value), 0);

  if (!(peakValue > 0)) {
    return MIN_NON_ZERO_DOMAIN_MAX;
  }

  return peakValue * CHART_DOMAIN_HEADROOM_MULTIPLIER;
}

function formatAxisValue(metric: ChartMetric, value: number): string {
  if (value === 0) {
    return "0";
  }

  if (metric === "cost") {
    return formatCompactUsdCost(value);
  }

  if (metric === "water") {
    if (Math.abs(value) < 1) {
      return `${Math.round(value * 1000)}mL`;
    }

    if (Math.abs(value) < 10) {
      return `${value.toFixed(1)}L`;
    }

    return `${Math.round(value)}L`;
  }

  if (metric === "energy") {
    if (Math.abs(value) < 1) {
      return `${Math.round(value * 1000)}Wh`;
    }

    if (Math.abs(value) < 10) {
      return `${value.toFixed(1)}kWh`;
    }

    return `${Math.round(value)}kWh`;
  }

  if (Math.abs(value) < 1) {
    return `${Math.round(value * 1000)}g`;
  }

  if (Math.abs(value) < 10) {
    return `${value.toFixed(2)}kg`;
  }

  return `${value.toFixed(1)}kg`;
}

function tooltipDetail(metric: ChartMetric, point: ChartDatum): string {
  if (metric === "water" && point.low !== null && point.high !== null) {
    return `Between ${formatLitres(point.low)} and ${formatLitres(point.high)}`;
  }

  if (metric === "energy") {
    return "Benchmark-based estimate from the same priced token activity.";
  }

  if (metric === "cost") {
    return "Raw API cost for priced usage in this bucket.";
  }

  return "Derived from the same energy estimate using a global electricity CO2 factor.";
}

function ChartTooltipContent({ active, metric, payload }: TooltipContentProps) {
  const point = active ? payload?.[0]?.payload : undefined;

  if (!point) {
    return null;
  }

  return (
    <div
      data-testid="impact-chart-tooltip"
      className="w-[220px] rounded-lg border border-slate-800/70 bg-slate-950/95 px-3 py-2.5 text-white shadow-2xl backdrop-blur"
    >
      <p className="text-xs font-medium text-slate-400">{point.label}</p>
      <p className="mt-1 text-lg font-bold tracking-[-0.03em]">{CHART_METRIC_DEFINITION[metric].formatter(point.value)}</p>
      <p className="mt-0.5 text-xs text-slate-400">{tooltipDetail(metric, point)}</p>
      <p className="mt-1 text-xs text-slate-400">{formatNumber(point.tokens)} tokens</p>
    </div>
  );
}

function ChartBarShape({ payload, ...shapeProps }: ChartBarShapeProps) {
  return <Rectangle {...shapeProps} data-testid={payload ? `impact-bar-${payload.key}` : undefined} />;
}

export function ImpactChart({ metric, points }: ImpactChartProps) {
  const chartData = useMemo(() => toChartData(points, metric), [metric, points]);
  const xAxisInterval = useMemo(() => getXAxisInterval(chartData.length), [chartData.length]);
  const yAxisMax = useMemo(() => getYAxisMax(chartData), [chartData]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: MIN_CHART_HEIGHT });
  const theme = CHART_THEME_BY_METRIC[metric];

  useEffect(() => {
    const element = chartRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(element.clientWidth, 0);
      const nextHeight = Math.max(element.clientHeight, MIN_CHART_HEIGHT);
      setChartSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight
        };
      });
    };

    updateSize();

    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(() => {
        updateSize();
      });
      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  if (chartData.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-ink-secondary">
        No {CHART_METRIC_DEFINITION[metric].emptyStateLabel} estimate available for this time range.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div ref={chartRef} data-testid="impact-chart" className={theme.shell}>
        {chartSize.width > 0 ? (
          <ResponsiveContainer width={chartSize.width} height={chartSize.height}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 18, left: 0 }}
              barCategoryGap={chartData.length > 12 ? "24%" : "32%"}
            >
              <defs>
                <linearGradient id={theme.fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.start} />
                  <stop offset="100%" stopColor={theme.end} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke={theme.gridStroke} strokeDasharray="3 6" />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={xAxisInterval}
                minTickGap={24}
                tick={{ fill: "#64748B", fontSize: 12, fontWeight: 500 }}
                dy={10}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                width={metric === "cost" ? 72 : 56}
                domain={[0, yAxisMax]}
                allowDataOverflow
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                tickFormatter={(value) => formatAxisValue(metric, value)}
              />

              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={<ChartTooltipContent metric={metric} />}
                wrapperStyle={{ outline: "none" }}
              />

              <Bar
                dataKey="value"
                radius={[12, 12, 4, 4]}
                fill={`url(#${theme.fillId})`}
                activeBar={{ fill: theme.activeFill, stroke: theme.activeStroke, strokeWidth: 1.25 }}
                background={{ fill: theme.background }}
                isAnimationActive={CHART_BAR_ANIMATION_ENABLED}
                minPointSize={chartData.length > 1 ? 3 : 6}
                shape={<ChartBarShape />}
              >
                {chartData.map((point) => (
                  <Cell key={point.key} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  );
}
