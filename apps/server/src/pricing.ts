import type { PricingEntry, WaterRange } from "@ai-water-usage/shared";

export const BENCHMARK_COEFFICIENTS: WaterRange = {
  low: 0.010585,
  central: 0.016904,
  high: 0.029926
};

export const PRICING_TABLE: PricingEntry[] = [
  {
    provider: "openai",
    model: "gpt-5.1-codex-mini",
    inputUsdPerMillion: 0.25,
    cachedInputUsdPerMillion: 0.025,
    outputUsdPerMillion: 2,
    docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.1-codex-mini"
  },
  {
    provider: "openai",
    model: "gpt-5.1-codex-max",
    inputUsdPerMillion: 1.25,
    cachedInputUsdPerMillion: 0.125,
    outputUsdPerMillion: 10,
    docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.1-codex-max"
  },
  {
    provider: "openai",
    model: "gpt-5.2-codex",
    inputUsdPerMillion: 1.75,
    cachedInputUsdPerMillion: 0.175,
    outputUsdPerMillion: 14,
    docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.2-codex"
  },
  {
    provider: "openai",
    model: "gpt-5.3-codex",
    inputUsdPerMillion: 1.75,
    cachedInputUsdPerMillion: 0.175,
    outputUsdPerMillion: 14,
    docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.3-codex"
  },
  {
    provider: "openai",
    model: "gpt-5.4",
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.25,
    outputUsdPerMillion: 15,
    docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.4"
  }
];

const pricingMap = new Map(PRICING_TABLE.map((entry) => [`${entry.provider}:${entry.model}`, entry] as const));

export function getPricingEntry(provider: string, model: string): PricingEntry | null {
  return pricingMap.get(`${provider}:${model}`) ?? null;
}

export function calculateEventCostUsd(
  pricing: PricingEntry,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number
): number {
  return (
    (inputTokens / 1_000_000) * pricing.inputUsdPerMillion +
    (cachedInputTokens / 1_000_000) * pricing.cachedInputUsdPerMillion +
    (outputTokens / 1_000_000) * pricing.outputUsdPerMillion
  );
}

export function getMethodologySourceLinks(): Array<{ label: string; url: string }> {
  return [
    {
      label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
      url: "https://doi.org/10.1145/3724499"
    },
    {
      label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
      url: "https://arxiv.org/abs/2304.03271"
    },
    { label: "OpenAI API pricing", url: "https://openai.com/api/pricing/" },
    ...PRICING_TABLE.map((entry) => ({ label: `${entry.model} model docs`, url: entry.docsUrl })),
  ];
}
