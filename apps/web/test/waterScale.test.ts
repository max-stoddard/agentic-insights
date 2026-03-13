import { describe, expect, it } from "vitest";
import { buildWaterScaleMarker, getWaterScaleAnchors, interpolateWaterScaleX, WATER_SCALE_DOMAIN } from "../src/lib/waterScale";

describe("waterScale", () => {
  it("sorts anchors in ascending litre order", () => {
    const anchors = getWaterScaleAnchors();
    expect(anchors.map((anchor) => anchor.id)).toEqual([
      "cup-of-water",
      "person-per-day",
      "coffee",
      "beef-burger",
      "jeans",
      "manufacturing-a-car",
      "golf-course-daily"
    ]);
  });

  it("interpolates AI usage between neighboring comparisons in log space", () => {
    const anchors = getWaterScaleAnchors();
    expect(interpolateWaterScaleX(1.2, anchors)).toBeCloseTo(0.719, 3);
  });

  it("clamps extrapolated x positions to the comparison domain", () => {
    const anchors = getWaterScaleAnchors();
    expect(interpolateWaterScaleX(0.01, anchors)).toBe(0);
    expect(interpolateWaterScaleX(2_000_000, anchors)).toBe(anchors.length - 1);
  });

  it("clamps low and high ranges to the chart domain", () => {
    const marker = buildWaterScaleMarker(
      {
        low: 0,
        central: 1.2,
        high: 2_000_000
      },
      getWaterScaleAnchors()
    );

    expect(marker.clampedLow).toBe(WATER_SCALE_DOMAIN.min);
    expect(marker.clampedCentral).toBe(1.2);
    expect(marker.clampedHigh).toBe(WATER_SCALE_DOMAIN.max);
  });
});
