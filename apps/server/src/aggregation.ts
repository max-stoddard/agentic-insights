import type { Bucket, TimeseriesPoint, WaterRange } from "@agentic-insights/shared";
import type { ClassifiedUsageEvent } from "./types.js";
import { getBucketKeyFromStart, getBucketLabelFromStart, getBucketStartTs, getNextBucketStartTs } from "./timezone.js";

function zeroRange(): WaterRange {
  return { low: 0, central: 0, high: 0 };
}

function addRange(target: WaterRange, source: WaterRange): void {
  target.low += source.low;
  target.central += source.central;
  target.high += source.high;
}

function createPoint(startTs: number, bucket: Bucket, timeZone: string): TimeseriesPoint {
  return {
    startTs,
    key: getBucketKeyFromStart(startTs, bucket, timeZone),
    label: getBucketLabelFromStart(startTs, bucket, timeZone),
    tokens: 0,
    excludedTokens: 0,
    unestimatedTokens: 0,
    waterLitres: zeroRange(),
    energyKwh: 0,
    carbonKgCo2: 0
  };
}

function addPointTotals(
  target: TimeseriesPoint,
  source: Pick<TimeseriesPoint, "tokens" | "excludedTokens" | "unestimatedTokens" | "waterLitres" | "energyKwh" | "carbonKgCo2">
) {
  target.tokens += source.tokens;
  target.excludedTokens += source.excludedTokens;
  target.unestimatedTokens += source.unestimatedTokens;
  addRange(target.waterLitres, source.waterLitres);
  target.energyKwh += source.energyKwh;
  target.carbonKgCo2 += source.carbonKgCo2;
}

function fillPoints(
  pointsByStart: Map<number, TimeseriesPoint>,
  firstStartTs: number,
  lastStartTs: number,
  bucket: Bucket,
  timeZone: string
): TimeseriesPoint[] {
  const points: TimeseriesPoint[] = [];
  let currentStartTs = firstStartTs;

  while (currentStartTs <= lastStartTs) {
    points.push(pointsByStart.get(currentStartTs) ?? createPoint(currentStartTs, bucket, timeZone));
    const nextStartTs = getNextBucketStartTs(currentStartTs, bucket, timeZone);
    if (nextStartTs <= currentStartTs) {
      break;
    }
    currentStartTs = nextStartTs;
  }

  return points;
}

export function aggregateDayTimeseries(events: ClassifiedUsageEvent[], timeZone: string): TimeseriesPoint[] {
  const pointsByStart = new Map<number, TimeseriesPoint>();
  let firstStartTs = Number.POSITIVE_INFINITY;
  let lastStartTs = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const startTs = getBucketStartTs(event.ts, "day", timeZone);
    const point = pointsByStart.get(startTs) ?? createPoint(startTs, "day", timeZone);

    point.tokens += event.totalTokens;
    addRange(point.waterLitres, event.waterLitres);
    point.energyKwh += event.energyKwh;
    point.carbonKgCo2 += event.carbonKgCo2;
    if (event.classification === "excluded") {
      point.excludedTokens += event.totalTokens;
    }
    if (event.classification === "token_only") {
      point.unestimatedTokens += event.totalTokens;
    }

    pointsByStart.set(startTs, point);
    firstStartTs = Math.min(firstStartTs, startTs);
    lastStartTs = Math.max(lastStartTs, startTs);
  }

  if (pointsByStart.size === 0) {
    return [];
  }

  return fillPoints(pointsByStart, firstStartTs, lastStartTs, "day", timeZone);
}

export function aggregateFromDayBuckets(dayPoints: TimeseriesPoint[], bucket: Bucket, timeZone: string): TimeseriesPoint[] {
  if (bucket === "day") {
    return dayPoints.map((point) => ({
      ...point,
      waterLitres: { ...point.waterLitres }
    }));
  }

  if (dayPoints.length === 0) {
    return [];
  }

  const pointsByStart = new Map<number, TimeseriesPoint>();
  let firstStartTs = getBucketStartTs(dayPoints[0]!.startTs, bucket, timeZone);
  let lastStartTs = getBucketStartTs(dayPoints[dayPoints.length - 1]!.startTs, bucket, timeZone);

  for (const dayPoint of dayPoints) {
    const startTs = getBucketStartTs(dayPoint.startTs, bucket, timeZone);
    const point = pointsByStart.get(startTs) ?? createPoint(startTs, bucket, timeZone);
    addPointTotals(point, dayPoint);
    pointsByStart.set(startTs, point);
    firstStartTs = Math.min(firstStartTs, startTs);
    lastStartTs = Math.max(lastStartTs, startTs);
  }

  return fillPoints(pointsByStart, firstStartTs, lastStartTs, bucket, timeZone);
}

export function aggregateTimeseries(events: ClassifiedUsageEvent[], bucket: Bucket, timeZone: string): TimeseriesPoint[] {
  return aggregateFromDayBuckets(aggregateDayTimeseries(events, timeZone), bucket, timeZone);
}
