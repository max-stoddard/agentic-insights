import { describe, expect, it } from "vitest";
import { aggregateDayTimeseries, aggregateFromDayBuckets, aggregateTimeseries } from "../src/aggregation.js";
import type { ClassifiedUsageEvent } from "../src/types.js";

function supportedEvent(id: string, ts: string, waterCentral: number): ClassifiedUsageEvent {
  return {
    id,
    sessionId: id,
    ts: Date.parse(ts),
    provider: "openai",
    model: "gpt-5.3-codex",
    source: "vscode",
    totalTokens: 100,
    inputTokens: 80,
    outputTokens: 20,
    cachedInputTokens: 10,
    splitSource: "last_usage",
    transport: "session",
    classification: "supported",
    eventCostUsd: 1,
    exclusionReason: null,
    waterLitres: {
      low: waterCentral / 2,
      central: waterCentral,
      high: waterCentral * 2
    },
    energyKwh: waterCentral / 10,
    carbonKgCo2: waterCentral / 20
  };
}

describe("aggregateTimeseries", () => {
  it("fills missing day buckets and preserves totals through week and month rollups", () => {
    const events = [
      supportedEvent("a", "2026-03-03T12:00:00.000Z", 1),
      supportedEvent("b", "2026-03-05T12:00:00.000Z", 2),
      supportedEvent("c", "2026-03-15T12:00:00.000Z", 3)
    ];

    const day = aggregateDayTimeseries(events, "UTC");
    const week = aggregateFromDayBuckets(day, "week", "UTC");
    const month = aggregateFromDayBuckets(day, "month", "UTC");

    const sumWater = (points: typeof day) => points.reduce((total, point) => total + point.waterLitres.central, 0);
    const sumEnergy = (points: typeof day) => points.reduce((total, point) => total + point.energyKwh, 0);
    const sumCarbon = (points: typeof day) => points.reduce((total, point) => total + point.carbonKgCo2, 0);
    expect(sumWater(day)).toBeCloseTo(sumWater(week), 6);
    expect(sumWater(day)).toBeCloseTo(sumWater(month), 6);
    expect(sumEnergy(day)).toBeCloseTo(sumEnergy(week), 6);
    expect(sumEnergy(day)).toBeCloseTo(sumEnergy(month), 6);
    expect(sumCarbon(day)).toBeCloseTo(sumCarbon(week), 6);
    expect(sumCarbon(day)).toBeCloseTo(sumCarbon(month), 6);

    expect(day).toHaveLength(13);
    expect(day[1]).toMatchObject({
      key: "2026-03-04",
      tokens: 0,
      startTs: Date.parse("2026-03-04T00:00:00.000Z")
    });
    expect(week[0]?.label).toMatch(/^Week of /);
    expect(month[0]?.key).toBe("2026-03");
  });

  it("matches the compatibility aggregateTimeseries wrapper", () => {
    const events = [supportedEvent("a", "2026-03-03T12:00:00.000Z", 1), supportedEvent("b", "2026-03-15T12:00:00.000Z", 3)];

    expect(aggregateTimeseries(events, "month", "UTC")).toEqual(aggregateFromDayBuckets(aggregateDayTimeseries(events, "UTC"), "month", "UTC"));
  });

  it("uses timezone-aware bucket labels", () => {
    const points = aggregateDayTimeseries([supportedEvent("a", "2026-03-09T00:30:00.000Z", 1)], "America/Los_Angeles");
    expect(points[0]?.key).toBe("2026-03-08");
    expect(points[0]?.label).toBe("8 Mar 2026");
  });
});
