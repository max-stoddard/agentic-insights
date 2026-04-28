import type { OverviewResponse, TimeseriesPoint } from "@agentic-insights/shared";
import { formatCarbon, formatEnergy, formatLitres, formatUsdCost } from "./format";

export type FootprintProperty = "water" | "energy" | "carbon" | "cost" | "token";
export type ImpactMetric = Extract<FootprintProperty, "water" | "energy" | "carbon">;
export type ChartMetric = Extract<FootprintProperty, "water" | "energy" | "carbon" | "cost">;
export type ImpactCardTone = Extract<ImpactMetric, "water" | "energy" | "carbon">;

export const FOOTPRINT_TEXT_CLASS_BY_PROPERTY: Record<FootprintProperty, string> = {
  water: "text-footprint-water",
  energy: "text-footprint-energy",
  carbon: "text-footprint-carbon",
  cost: "text-footprint-cost",
  token: "text-footprint-token"
};

export interface ChartMetricDefinition {
  label: string;
  tone: ChartMetric;
  emptyStateLabel: string;
  formatter: (value: number) => string;
}

export interface ImpactMetricDefinition extends ChartMetricDefinition {
  label: string;
  tone: ImpactCardTone;
  eyebrow: string;
  buttonLabel: string;
}

export const IMPACT_METRIC_DEFINITION: Record<ImpactMetric, ImpactMetricDefinition> = {
  water: {
    label: "Water",
    tone: "water",
    eyebrow: "Total Agent Water Usage",
    buttonLabel: "How is water calculated?",
    emptyStateLabel: "water",
    formatter: formatLitres
  },
  energy: {
    label: "Energy",
    tone: "energy",
    eyebrow: "Total Agent Energy Usage",
    buttonLabel: "How is energy calculated?",
    emptyStateLabel: "energy",
    formatter: formatEnergy
  },
  carbon: {
    label: "Carbon",
    tone: "carbon",
    eyebrow: "Total Agent Carbon Usage",
    buttonLabel: "How is carbon calculated?",
    emptyStateLabel: "carbon",
    formatter: formatCarbon
  }
};

export const CHART_METRIC_DEFINITION: Record<ChartMetric, ChartMetricDefinition> = {
  water: IMPACT_METRIC_DEFINITION.water,
  energy: IMPACT_METRIC_DEFINITION.energy,
  carbon: IMPACT_METRIC_DEFINITION.carbon,
  cost: {
    label: "Cost",
    tone: "cost",
    emptyStateLabel: "cost",
    formatter: formatUsdCost
  }
};

export const CHART_METRIC_ORDER: ChartMetric[] = ["water", "energy", "carbon", "cost"];

export function getImpactMetricValue(metric: ImpactMetric, source: Pick<OverviewResponse, "waterLitres" | "energyKwh" | "carbonKgCo2">): number;
export function getImpactMetricValue(
  metric: ImpactMetric,
  source: Pick<TimeseriesPoint, "waterLitres" | "energyKwh" | "carbonKgCo2">
): number;
export function getImpactMetricValue(
  metric: ImpactMetric,
  source: Pick<OverviewResponse, "waterLitres" | "energyKwh" | "carbonKgCo2"> | Pick<TimeseriesPoint, "waterLitres" | "energyKwh" | "carbonKgCo2">
): number {
  if (metric === "water") {
    return source.waterLitres.central;
  }

  if (metric === "energy") {
    return source.energyKwh;
  }

  return source.carbonKgCo2;
}

export function getChartMetricValue(
  metric: ChartMetric,
  source: Pick<TimeseriesPoint, "waterLitres" | "energyKwh" | "carbonKgCo2" | "apiCostUsd">
): number {
  if (metric === "cost") {
    return source.apiCostUsd;
  }

  return getImpactMetricValue(metric, source);
}
