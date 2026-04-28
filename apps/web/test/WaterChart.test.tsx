import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimeseriesPoint } from "@agentic-insights/shared";
import { ImpactChart } from "../src/components/WaterChart";

const POINTS: TimeseriesPoint[] = [
  {
    startTs: Date.parse("2026-01-01T00:00:00.000Z"),
    key: "2026-01",
    label: "Jan 2026",
    tokens: 600,
    excludedTokens: 0,
    unestimatedTokens: 0,
    apiCostUsd: 0.02,
    waterLitres: {
      low: 0.6,
      central: 1,
      high: 1.4
    },
    energyKwh: 0.2,
    carbonKgCo2: 0.08
  },
  {
    startTs: Date.parse("2026-02-01T00:00:00.000Z"),
    key: "2026-02",
    label: "Feb 2026",
    tokens: 0,
    excludedTokens: 0,
    unestimatedTokens: 0,
    apiCostUsd: 0,
    waterLitres: {
      low: 0,
      central: 0,
      high: 0
    },
    energyKwh: 0,
    carbonKgCo2: 0
  },
  {
    startTs: Date.parse("2026-03-01T00:00:00.000Z"),
    key: "2026-03",
    label: "Mar 2026",
    tokens: 400,
    excludedTokens: 50,
    unestimatedTokens: 50,
    apiCostUsd: 0.01,
    waterLitres: {
      low: 0.3,
      central: 0.5,
      high: 0.7
    },
    energyKwh: 0.1,
    carbonKgCo2: 0.04
  }
];

function getBarHeight(key: string): number {
  return Number(screen.getByTestId(`impact-bar-${key}`).getAttribute("height"));
}

describe("ImpactChart", () => {
  it("keeps bucket heights stable when toggling between derived metrics", () => {
    const { rerender } = render(<ImpactChart metric="water" points={POINTS} />);

    const waterHeight = getBarHeight("2026-01");
    expect(waterHeight).toBeGreaterThan(0);

    rerender(<ImpactChart metric="energy" points={POINTS} />);
    expect(getBarHeight("2026-01")).toBeCloseTo(waterHeight, 4);

    rerender(<ImpactChart metric="carbon" points={POINTS} />);
    expect(getBarHeight("2026-01")).toBeCloseTo(waterHeight, 4);

    rerender(<ImpactChart metric="cost" points={POINTS} />);
    expect(getBarHeight("2026-01")).toBeCloseTo(waterHeight, 4);
  });
});
