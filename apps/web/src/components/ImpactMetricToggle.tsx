import type { KeyboardEvent } from "react";
import { CHART_METRIC_DEFINITION, CHART_METRIC_ORDER, FOOTPRINT_TEXT_CLASS_BY_PROPERTY, type ChartMetric } from "../lib/footprint";
import { FootprintIcon } from "./FootprintIcon";

interface ImpactMetricToggleProps {
  active: ChartMetric;
  onChange: (metric: ChartMetric) => void;
}

function nextIndex(index: number, direction: 1 | -1): number {
  return (index + direction + CHART_METRIC_ORDER.length) % CHART_METRIC_ORDER.length;
}

function activeClasses(metric: ChartMetric): string {
  if (metric === "water") {
    return "bg-white text-sky-700";
  }

  if (metric === "energy") {
    return "bg-white text-amber-700";
  }

  if (metric === "cost") {
    return "bg-white text-emerald-700";
  }

  return "bg-white text-slate-700";
}

function iconClasses(metric: ChartMetric): string {
  return FOOTPRINT_TEXT_CLASS_BY_PROPERTY[metric];
}

function tabClasses(metric: ChartMetric, selected: boolean): string {
  const spacing = metric === "cost" ? "min-w-[5.9rem] gap-1.5 pl-3 pr-4" : "min-w-[6.5rem] gap-2 px-4";
  const base = `inline-flex items-center justify-center rounded-md py-2 text-sm transition-all ${spacing}`;

  if (selected) {
    return `${base} font-semibold shadow-sm ${activeClasses(metric)}`;
  }

  return `${base} font-medium text-ink-secondary hover:text-ink`;
}

export function ImpactMetricToggle({ active, onChange }: ImpactMetricToggleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(CHART_METRIC_ORDER[nextIndex(index, 1)]!);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(CHART_METRIC_ORDER[nextIndex(index, -1)]!);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(CHART_METRIC_ORDER[0]!);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(CHART_METRIC_ORDER[CHART_METRIC_ORDER.length - 1]!);
    }
  };

  return (
    <div role="tablist" aria-label="Impact metric" className="inline-flex self-start rounded-lg bg-surface-muted p-1">
      {CHART_METRIC_ORDER.map((metric, index) => {
        const selected = metric === active;
        const definition = CHART_METRIC_DEFINITION[metric];

        return (
          <button
            key={metric}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(metric)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClasses(metric, selected)}
          >
            <span className={iconClasses(metric)}>
              <FootprintIcon property={metric} className="h-4 w-4" />
            </span>
            <span>{definition.label}</span>
          </button>
        );
      })}
    </div>
  );
}
