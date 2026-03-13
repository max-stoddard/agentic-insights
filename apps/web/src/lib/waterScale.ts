import { WATER_SCALE_COMPARISONS, type WaterRange, type WaterScaleComparison } from "@agentic-insights/shared";

export const WATER_SCALE_DOMAIN = {
  min: 0.1,
  max: 1_000_000
} as const;

export interface WaterScaleAnchor extends WaterScaleComparison {
  x: number;
}

export interface WaterScaleMarker {
  x: number;
  central: number;
  low: number;
  high: number;
  clampedCentral: number;
  clampedLow: number;
  clampedHigh: number;
}

export function getWaterScaleAnchors(): WaterScaleAnchor[] {
  return [...WATER_SCALE_COMPARISONS]
    .sort((left, right) => left.litres - right.litres)
    .map((comparison, index) => ({
      ...comparison,
      x: index
    }));
}

export function clampWaterScaleLitres(value: number): number {
  return Math.min(WATER_SCALE_DOMAIN.max, Math.max(WATER_SCALE_DOMAIN.min, value));
}

export function interpolateWaterScaleX(value: number, anchors: WaterScaleAnchor[] = getWaterScaleAnchors()): number {
  if (anchors.length <= 1) {
    return 0;
  }

  const safeValue = Math.max(value, Number.MIN_VALUE);
  let lowerIndex = 0;
  let upperIndex = 1;

  if (safeValue <= anchors[0]!.litres) {
    lowerIndex = 0;
    upperIndex = 1;
  } else if (safeValue >= anchors[anchors.length - 1]!.litres) {
    lowerIndex = anchors.length - 2;
    upperIndex = anchors.length - 1;
  } else {
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const lower = anchors[index]!;
      const upper = anchors[index + 1]!;
      if (safeValue >= lower.litres && safeValue <= upper.litres) {
        lowerIndex = index;
        upperIndex = index + 1;
        break;
      }
    }
  }

  const lower = anchors[lowerIndex]!;
  const upper = anchors[upperIndex]!;
  const lowerLog = Math.log10(lower.litres);
  const upperLog = Math.log10(upper.litres);

  if (upperLog === lowerLog) {
    return lower.x;
  }

  const progress = (Math.log10(safeValue) - lowerLog) / (upperLog - lowerLog);
  return Math.min(anchors.length - 1, Math.max(0, lower.x + progress));
}

export function buildWaterScaleMarker(range: WaterRange, anchors: WaterScaleAnchor[] = getWaterScaleAnchors()): WaterScaleMarker {
  return {
    x: interpolateWaterScaleX(range.central, anchors),
    central: range.central,
    low: range.low,
    high: range.high,
    clampedCentral: clampWaterScaleLitres(range.central),
    clampedLow: clampWaterScaleLitres(range.low),
    clampedHigh: clampWaterScaleLitres(range.high)
  };
}

export function getWaterScaleTicks(): number[] {
  const ticks: number[] = [];
  for (let exponent = -1; exponent <= 6; exponent += 1) {
    ticks.push(10 ** exponent);
  }
  return ticks;
}

export interface WaterScalePoint {
  x: number;
  y: number;
}

export function buildSmoothWaterScalePath(points: WaterScalePoint[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const [point] = points;
    return `M ${point!.x} ${point!.y}`;
  }

  const commands = [`M ${points[0]!.x} ${points[0]!.y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const point0 = points[index - 1] ?? points[index]!;
    const point1 = points[index]!;
    const point2 = points[index + 1]!;
    const point3 = points[index + 2] ?? point2;

    const controlPoint1X = point1.x + (point2.x - point0.x) / 6;
    const controlPoint1Y = point1.y + (point2.y - point0.y) / 6;
    const controlPoint2X = point2.x - (point3.x - point1.x) / 6;
    const controlPoint2Y = point2.y - (point3.y - point1.y) / 6;

    commands.push(
      `C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${point2.x} ${point2.y}`
    );
  }

  return commands.join(" ");
}
