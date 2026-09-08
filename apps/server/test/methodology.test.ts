import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PricingEntry } from "@agentic-insights/shared";
import { getOrCreateCalibration } from "../src/calibration.js";
import { GENERATED_PRICING_CATALOG } from "../src/generated/pricing-catalog.js";
import {
  BENCHMARK_COEFFICIENTS,
  ENERGY_BENCHMARK_KWH,
  PRICING_CATALOG_METADATA,
  calculateEventCostUsd,
  getMethodologySourcesByTab,
  getPricingEntry
} from "../src/pricing.js";
import { createCacheDir } from "./helpers.js";

let previousCacheDir: string | undefined;
let cleanupCacheDir: (() => void) | null = null;

function generatedPricing(provider: string, model: string): PricingEntry {
  const pricing = GENERATED_PRICING_CATALOG.entries.find(
    (entry) => entry.provider === provider && entry.model === model
  );
  if (!pricing) {
    throw new Error(`Missing generated pricing fixture for ${provider}:${model}.`);
  }
  return pricing;
}

function expectPricesToMatch(pricing: PricingEntry | null, expected: PricingEntry) {
  expect(pricing).toMatchObject({
    inputUsdPerMillion: expected.inputUsdPerMillion,
    cachedInputUsdPerMillion: expected.cachedInputUsdPerMillion,
    outputUsdPerMillion: expected.outputUsdPerMillion
  });
}

beforeEach(() => {
  previousCacheDir = process.env.AGENTIC_INSIGHTS_CACHE_DIR;
  const cache = createCacheDir();
  process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;
  cleanupCacheDir = cache.cleanup;
});

afterEach(() => {
  if (cleanupCacheDir) {
    cleanupCacheDir();
    cleanupCacheDir = null;
  }

  if (previousCacheDir === undefined) {
    delete process.env.AGENTIC_INSIGHTS_CACHE_DIR;
  } else {
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = previousCacheDir;
  }
});

describe("pricing methodology", () => {
  it("looks up cached-input pricing correctly", () => {
    const pricing = getPricingEntry("openai", "gpt-5.3-codex");
    expectPricesToMatch(pricing, generatedPricing("openai", "gpt-5.3-codex"));
  });

  it("looks up GPT-5.5 pricing for current Codex usage", () => {
    const pricing = getPricingEntry("openai", "gpt-5.5");
    expect(pricing).toMatchObject({ provider: "openai", model: "gpt-5.5" });
    expectPricesToMatch(pricing, generatedPricing("openai", "gpt-5.5"));
  });

  it("retains pricing coverage for current Gemini CLI usage", () => {
    const shortContext = getPricingEntry("google", "gemini-2.5-pro");
    expect(shortContext).toMatchObject({
      provider: "google",
      model: "gemini-2.5-pro-lte-128k"
    });
    expectPricesToMatch(shortContext, generatedPricing("google", "gemini-2.5-pro-lte-128k"));

    const longContext = getPricingEntry("google", "gemini-2.5-pro", 128_001);
    expect(longContext).toMatchObject({
      provider: "google",
      model: "gemini-2.5-pro-gt-128k"
    });
    expectPricesToMatch(longContext, generatedPricing("google", "gemini-2.5-pro-gt-128k"));
  });

  it("resolves anthropic model aliases and provider aliases", () => {
    const pricing = getPricingEntry("claude", "claude-sonnet-4-20250514");
    expect(pricing).not.toBeNull();
    expect(pricing?.model).toBe("claude-sonnet-4");
    expectPricesToMatch(pricing, generatedPricing("anthropic", "claude-sonnet-4-20250514"));
  });

  it("normalizes dated Claude 4.5 and 4.6 model ids", () => {
    expect(getPricingEntry("claude", "claude-sonnet-4-5-20250929")?.model).toBe("claude-sonnet-4-5");
    expect(getPricingEntry("claude", "claude-haiku-4-5-20251001")?.model).toBe("claude-haiku-4-5");
    expect(getPricingEntry("claude", "claude-opus-4-6")?.model).toBe("claude-opus-4-6");
  });

  it("resolves priced models by model identity even when the provider does not match the catalog provider", () => {
    expect(getPricingEntry("anthropic", "qwen2.5-coder:7b")?.model).toBe("qwen/qwen2.5-coder-7b-instruct");
    expect(getPricingEntry("anthropic", "qwen3-coder:30b")?.model).toBe("qwen3-coder-30b-a3b-instruct");
    expect(getPricingEntry("ollama", "qwen2.5-coder:7b")?.model).toBe("qwen/qwen2.5-coder-7b-instruct");
  });

  it("returns null for truly unknown models", () => {
    expect(getPricingEntry("anthropic", "qwen3.5:9b")).toBeNull();
    expect(getPricingEntry("ollama", "qwen3.5:9b")).toBeNull();
    expect(getPricingEntry("openai", "gpt-5.3-codex-spark")).toBeNull();
  });

  it("computes cost-equivalent usage deterministically", () => {
    const pricing: PricingEntry = {
      provider: "test",
      model: "test-model",
      inputUsdPerMillion: 1,
      cachedInputUsdPerMillion: 0.5,
      outputUsdPerMillion: 2,
      sourceUrl: "https://example.com/pricing",
      sourceLabel: "Test pricing"
    };
    expect(calculateEventCostUsd(pricing, 1_000_000, 500_000, 250_000)).toBeCloseTo(1.75, 6);
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
    expect(ENERGY_BENCHMARK_KWH).toBe(0.004);
  });

  it("exposes catalog provenance and tab-scoped methodology sources", () => {
    expect(PRICING_CATALOG_METADATA.providerCount).toBeGreaterThan(0);
    expect(PRICING_CATALOG_METADATA.modelCount).toBeGreaterThan(0);

    const sources = getMethodologySourcesByTab(["anthropic", "openai"]);
    expect(sources.prompts).toEqual(
      expect.arrayContaining([
        {
          label: "Portkey models repo (MIT)",
          url: "https://github.com/Portkey-AI/models"
        },
        {
          label: "Portkey MIT license",
          url: "https://raw.githubusercontent.com/Portkey-AI/models/main/LICENSE"
        },
        expect.objectContaining({
          label: "Portkey pricing: anthropic.json"
        })
      ])
    );
    expect(sources.water).toEqual(
      expect.arrayContaining([
        {
          label: "NIST Metric Kitchen: Cooking Measurement Equivalencies",
          url: "https://www.nist.gov/pml/owm/metric-kitchen-cooking-measurement-equivalencies"
        },
        {
          label: "EFSA Dietary Reference Values for Water",
          url: "https://www.efsa.europa.eu/en/efsajournal/pub/1459"
        },
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        },
        {
          label: "Ecological Economics DOI: The water footprint of coffee and tea consumption in the Netherlands",
          url: "https://doi.org/10.1016/j.ecolecon.2007.02.022"
        },
        {
          label: "Sustainability Science DOI: Comparing ecological and water footprint of denim jeans and a tri-blend T-shirt",
          url: "https://doi.org/10.1007/s11625-022-01131-0"
        },
        {
          label: "Environmental Science & Technology DOI: Water Footprint of European Cars: Potential Impacts of Water Consumption along Automobile Life Cycles",
          url: "https://doi.org/10.1021/es2040043"
        },
        {
          label: "GCSAA Golf Course Environmental Profile: Phase II Water Use and Conservation Practices on U.S. Golf Courses",
          url: "https://www.gcsaa.org/docs/default-source/Environment/phase-2-water-use-survey-full-report.pdf?sfvrsn=2b39123e_4"
        }
      ])
    );
    expect(sources.water).not.toEqual(
      expect.arrayContaining([
        {
          label: "Portkey models repo (MIT)",
          url: "https://github.com/Portkey-AI/models"
        }
      ])
    );
    expect(sources.energy).toEqual(
      expect.arrayContaining([
        {
          label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
          url: "https://doi.org/10.1145/3724499"
        },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        },
        {
          label: "NeurIPS 2020: Language Models are Few-Shot Learners (Brown et al.)",
          url: "https://papers.nips.cc/paper/2020/file/1457c0d6bfcb4967418bfb8ac142f64a-Paper.pdf"
        },
        {
          label: "JMLR 2023: Estimating the Carbon Footprint of BLOOM",
          url: "https://jmlr.org/papers/v24/23-0069.html"
        }
      ])
    );
    expect(sources.energy).not.toEqual(
      expect.arrayContaining([
        {
          label: "Portkey pricing: anthropic.json",
          url: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json"
        }
      ])
    );
  });
});
