import { describe, expect, it } from "vitest";
import { getOrCreateCalibration } from "../src/calibration.js";
import { BENCHMARK_COEFFICIENTS, calculateEventCostUsd, getMethodologySourceLinks, getPricingEntry } from "../src/pricing.js";

describe("pricing methodology", () => {
  it("looks up cached-input pricing correctly", () => {
    const pricing = getPricingEntry("openai", "gpt-5.3-codex");
    expect(pricing).not.toBeNull();
    expect(pricing?.cachedInputUsdPerMillion).toBe(0.175);
  });

  it("returns null for unsupported models", () => {
    expect(getPricingEntry("ollama", "qwen3.5:9b")).toBeNull();
  });

  it("computes cost-equivalent usage deterministically", () => {
    const pricing = getPricingEntry("openai", "gpt-5.4");
    const result = calculateEventCostUsd(pricing!, 1_000_000, 500_000, 250_000);
    expect(result).toBeCloseTo(6.375, 6);
  });

  it("uses a deterministic median for calibration", () => {
    const calibration = getOrCreateCalibration("test-signature", [0.1, 0.5, 0.2, 0.4, 0.3]);
    expect(calibration?.referenceEventCostUsd).toBeCloseTo(0.3, 6);
  });

  it("uses published academic benchmark coefficients", () => {
    expect(BENCHMARK_COEFFICIENTS).toEqual({
      low: 0.010585,
      central: 0.016904,
      high: 0.029926
    });
  });

  it("includes academic benchmark source links", () => {
    const sourceLinks = getMethodologySourceLinks();
    expect(sourceLinks).toEqual(
      expect.arrayContaining([
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        }
      ])
    );
  });
});
