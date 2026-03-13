import type { MethodologySourceLink, MethodologyTabId, PricingCatalogMetadata, PricingEntry, WaterRange } from "@agentic-insights/shared";
import { GENERATED_PRICING_CATALOG } from "./generated/pricing-catalog.js";

export const BENCHMARK_COEFFICIENTS: WaterRange = {
  low: 0.010585,
  central: 0.016904,
  high: 0.029926
};

const WATER_PAPER_SOURCES: MethodologySourceLink[] = [
  {
    label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)",
    url: "https://doi.org/10.1145/3724499"
  },
  {
    label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
    url: "https://arxiv.org/abs/2304.03271"
  }
];

const ENERGY_SOURCES: MethodologySourceLink[] = [
  {
    label: "CodeCarbon methodology",
    url: "https://mlco2.github.io/codecarbon/methodology.html"
  }
];

const CARBON_SOURCES: MethodologySourceLink[] = [
  {
    label: "GHG Protocol Corporate Standard",
    url: "https://ghgprotocol.org/corporate-standard"
  },
  {
    label: "GHG Protocol Scope 2 Guidance",
    url: "https://ghgprotocol.org/scope-2-guidance"
  },
  ...ENERGY_SOURCES
];

const LOCAL_MODEL_ALIASES = new Map<string, string>([
  ["gpt-5.1-codex-max-old", "gpt-5.1-codex-max"],
  ["claude-sonnet-4-20250514", "claude-sonnet-4"],
  ["claude-sonnet-4-0", "claude-sonnet-4"],
  ["claude-sonnet-4.6", "claude-sonnet-4-6"],
  ["claude-sonnet-4-6-latest", "claude-sonnet-4-6"],
  ["claude-sonnet-3.7", "claude-3-7-sonnet-latest"],
  ["claude-sonnet-3.5", "claude-3-5-sonnet-latest"],
  ["claude-opus-4-20250514", "claude-opus-4"],
  ["claude-opus-4-0", "claude-opus-4"],
  ["claude-4-opus-20250514", "claude-opus-4"],
  ["claude-opus-4-1-20250805", "claude-opus-4-1"],
  ["claude-opus-3", "claude-3-opus-latest"],
  ["claude-haiku-4.5", "claude-haiku-4-5"],
  ["claude-haiku-4-5-latest", "claude-haiku-4-5"],
  ["claude-haiku-3.5", "claude-3-5-haiku-latest"],
  ["claude-haiku-3", "claude-3-haiku-20240307"]
]);

const MODEL_FALLBACK_ALIASES = new Map<string, string[]>([
  ["qwen2.5-coder:7b", ["qwen/qwen2.5-coder-7b-instruct"]],
  ["qwen3-coder:30b", ["qwen3-coder-30b-a3b-instruct", "qwen/qwen3-coder-30b-a3b-instruct"]]
]);

const PREFERRED_SOURCE_MODELS = new Map<string, string>([
  ["claude-opus-4", "claude-opus-4-20250514"],
  ["claude-opus-4-1", "claude-opus-4-1-20250805"],
  ["claude-sonnet-4", "claude-sonnet-4-20250514"],
  ["claude-haiku-4-5", "claude-haiku-4-5-20251001"]
]);

export const PRICING_CATALOG_METADATA: PricingCatalogMetadata = GENERATED_PRICING_CATALOG.metadata;

function dedupeSourceLinks(...links: MethodologySourceLink[]): MethodologySourceLink[] {
  const unique = new Map<string, MethodologySourceLink>();
  for (const link of links) {
    unique.set(link.url, link);
  }
  return [...unique.values()];
}

export function normalizeProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  return normalized === "claude" ? "anthropic" : normalized;
}

export function normalizeDisplayProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  return normalized || "unknown";
}

function stripClaudeDateSuffix(model: string): string {
  if (!model.startsWith("claude-")) {
    return model;
  }

  return model.replace(/-\d{8}$/, "");
}

export function normalizeModel(provider: string, model: string): string {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedModel = model.trim().toLowerCase();
  const directAlias = LOCAL_MODEL_ALIASES.get(normalizedModel);
  if (directAlias) {
    return directAlias;
  }

  if (normalizedProvider !== "anthropic") {
    return normalizedModel;
  }

  const strippedClaudeModel = stripClaudeDateSuffix(normalizedModel);
  return LOCAL_MODEL_ALIASES.get(strippedClaudeModel) ?? strippedClaudeModel;
}

export function canonicalizePricingIdentity(provider: string, model: string): { provider: string; model: string } {
  const normalizedProvider = normalizeProvider(provider);
  return {
    provider: normalizedProvider,
    model: normalizeModel(normalizedProvider, model)
  };
}

export function canonicalizeDisplayIdentity(provider: string, model: string): { provider: string; model: string } {
  return {
    provider: normalizeDisplayProvider(provider),
    model: normalizeModel(provider, model)
  };
}

function getLookupAliases(provider: string, canonicalModel: string): string[] {
  const aliases = new Set<string>([canonicalModel]);

  for (const [aliasModel, targetModel] of LOCAL_MODEL_ALIASES.entries()) {
    if (targetModel === canonicalModel) {
      aliases.add(aliasModel);
    }
  }

  if (provider === "anthropic" && canonicalModel.startsWith("claude-")) {
    aliases.add(`${canonicalModel}-latest`);
  }

  return [...aliases];
}

function selectCheapestEntry(entries: PricingEntry[]): PricingEntry {
  return [...entries].sort((left, right) => {
    const leftTotal = left.inputUsdPerMillion + left.cachedInputUsdPerMillion + left.outputUsdPerMillion;
    const rightTotal = right.inputUsdPerMillion + right.cachedInputUsdPerMillion + right.outputUsdPerMillion;
    if (leftTotal !== rightTotal) {
      return leftTotal - rightTotal;
    }

    return `${left.provider}:${left.model}`.localeCompare(`${right.provider}:${right.model}`);
  })[0]!;
}

function getModelFallbackCandidates(provider: string, model: string): string[] {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedModel = model.trim().toLowerCase();
  const displayModel = normalizeModel(normalizedProvider, model);
  const fallbackAliases = [
    ...(MODEL_FALLBACK_ALIASES.get(normalizedModel) ?? []),
    ...(MODEL_FALLBACK_ALIASES.get(displayModel) ?? [])
  ];

  return [...new Set([normalizedModel, displayModel, ...fallbackAliases])];
}

function selectPreferredRawEntry(canonicalModel: string, entries: PricingEntry[]): PricingEntry {
  const preferredSourceModel = PREFERRED_SOURCE_MODELS.get(canonicalModel);

  return [...entries].sort((left, right) => {
    const leftModel = left.model.toLowerCase();
    const rightModel = right.model.toLowerCase();
    const leftScore =
      Number(leftModel === canonicalModel) * 4 +
      Number(preferredSourceModel !== undefined && leftModel === preferredSourceModel) * 3 +
      Number(leftModel.endsWith("-latest")) * -1;
    const rightScore =
      Number(rightModel === canonicalModel) * 4 +
      Number(preferredSourceModel !== undefined && rightModel === preferredSourceModel) * 3 +
      Number(rightModel.endsWith("-latest")) * -1;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return leftModel.localeCompare(rightModel);
  })[0]!;
}

function buildPricingRegistry() {
  const groupedEntries = new Map<string, PricingEntry[]>();
  const providerSources = new Map<string, MethodologySourceLink>();
  const modelLookupGroups = new Map<string, Map<string, PricingEntry>>();

  const registerModelLookup = (model: string, entry: PricingEntry) => {
    const normalizedModel = model.trim().toLowerCase();
    const entries = modelLookupGroups.get(normalizedModel) ?? new Map<string, PricingEntry>();
    entries.set(`${entry.provider}:${entry.model}`, entry);
    modelLookupGroups.set(normalizedModel, entries);
  };

  for (const providerSource of GENERATED_PRICING_CATALOG.providerSources) {
    providerSources.set(normalizeProvider(providerSource.provider), {
      label: providerSource.sourceLabel,
      url: providerSource.sourceUrl
    });
  }

  for (const rawEntry of GENERATED_PRICING_CATALOG.entries) {
    const { provider, model } = canonicalizePricingIdentity(rawEntry.provider, rawEntry.model);
    const key = `${provider}:${model}`;
    const entries = groupedEntries.get(key) ?? [];
    entries.push(rawEntry);
    groupedEntries.set(key, entries);
  }

  const aliases = new Map<string, PricingEntry>();
  const canonicalEntries: PricingEntry[] = [];

  for (const [key, rawEntries] of groupedEntries.entries()) {
    const separator = key.indexOf(":");
    const provider = key.slice(0, separator);
    const model = key.slice(separator + 1);
    const preferredRawEntry = selectPreferredRawEntry(model, rawEntries);
    const canonicalEntry: PricingEntry = {
      ...preferredRawEntry,
      provider,
      model,
      sourceUrl: preferredRawEntry.sourceUrl,
      sourceLabel: preferredRawEntry.sourceLabel
    };

    canonicalEntries.push(canonicalEntry);

    for (const rawEntry of rawEntries) {
      aliases.set(`${normalizeProvider(rawEntry.provider)}:${rawEntry.model.trim().toLowerCase()}`, canonicalEntry);
      registerModelLookup(rawEntry.model, canonicalEntry);
    }

    for (const aliasModel of getLookupAliases(provider, model)) {
      aliases.set(`${provider}:${aliasModel}`, canonicalEntry);
      registerModelLookup(aliasModel, canonicalEntry);
    }

    registerModelLookup(model, canonicalEntry);
  }

  canonicalEntries.sort((left, right) => {
    if (left.provider !== right.provider) {
      return left.provider.localeCompare(right.provider);
    }

    return left.model.localeCompare(right.model);
  });

  const modelLookup = new Map<string, PricingEntry>();
  for (const [model, entries] of modelLookupGroups.entries()) {
    modelLookup.set(model, selectCheapestEntry([...entries.values()]));
  }

  return {
    canonicalEntries,
    aliases,
    providerSources,
    modelLookup
  };
}

const registry = buildPricingRegistry();

export const PRICING_TABLE: PricingEntry[] = registry.canonicalEntries;

export function getPricingEntry(provider: string, model: string): PricingEntry | null {
  const { provider: normalizedProvider } = canonicalizePricingIdentity(provider, model);
  const normalizedModel = model.trim().toLowerCase();
  const directMatch =
    registry.aliases.get(`${normalizedProvider}:${normalizedModel}`) ??
    registry.aliases.get(`${normalizedProvider}:${normalizeModel(normalizedProvider, model)}`);
  if (directMatch) {
    return directMatch;
  }

  for (const candidate of getModelFallbackCandidates(normalizedProvider, model)) {
    const fallbackMatch = registry.modelLookup.get(candidate);
    if (fallbackMatch) {
      return fallbackMatch;
    }
  }

  return null;
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

export function getMethodologySourcesByTab(providers: Iterable<string>): Record<MethodologyTabId, MethodologySourceLink[]> {
  const providerSources = [...new Set([...providers].map((provider) => normalizeProvider(provider)))]
    .flatMap((provider) => {
      const source = registry.providerSources.get(provider);
      return source ? [source] : [];
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  const catalogSources = dedupeSourceLinks(
    {
      label: "Portkey models repo (MIT)",
      url: PRICING_CATALOG_METADATA.sourceRepoUrl
    },
    {
      label: "Portkey pricing directory",
      url: PRICING_CATALOG_METADATA.sourceDirectoryUrl
    },
    {
      label: "Portkey MIT license",
      url: PRICING_CATALOG_METADATA.licenseUrl
    },
    ...providerSources
  );

  return {
    prompts: catalogSources,
    water: dedupeSourceLinks(...WATER_PAPER_SOURCES, ...catalogSources),
    energy: dedupeSourceLinks(...ENERGY_SOURCES, ...catalogSources),
    carbon: dedupeSourceLinks(...CARBON_SOURCES, ...catalogSources)
  };
}
