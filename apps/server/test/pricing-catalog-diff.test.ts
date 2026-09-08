import { describe, expect, it } from "vitest";
import {
  MONITORED_PRICING_PROVIDERS,
  diffPricingCatalogs,
  validateSuspiciousApprovalRequest
} from "../src/pricing-catalog-diff.js";
import type { GeneratedPricingCatalog } from "../src/pricing-catalog-transform.js";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

function catalog(
  overrides: Partial<Record<string, Array<{ model: string; input: number; cached?: number; output: number }>>> = {}
): GeneratedPricingCatalog {
  const providers = Object.fromEntries(
    MONITORED_PRICING_PROVIDERS.map((provider) => [
      provider,
      [{ model: `${provider}-model`, input: 1, cached: 0.1, output: 2 }]
    ])
  );
  Object.assign(providers, overrides);
  const providerSources = Object.keys(providers)
    .sort()
    .map((provider) => ({
      provider,
      fileName: `${provider}.json`,
      sourceUrl: `https://raw.githubusercontent.com/Portkey-AI/models/${REVISION}/pricing/${provider}.json`,
      sourceLabel: `Portkey pricing: ${provider}.json`
    }));
  const entries = Object.entries(providers)
    .flatMap(([provider, models]) =>
      models.map((model) => ({
        provider,
        model: model.model,
        inputUsdPerMillion: model.input,
        cachedInputUsdPerMillion: model.cached ?? 0,
        outputUsdPerMillion: model.output,
        sourceUrl: `https://raw.githubusercontent.com/Portkey-AI/models/${REVISION}/pricing/${provider}.json`,
        sourceLabel: `Portkey pricing: ${provider}.json`
      }))
    )
    .sort((left, right) => `${left.provider}:${left.model}`.localeCompare(`${right.provider}:${right.model}`));

  return {
    metadata: {
      generatedAt: "2026-08-25T06:17:00.000Z",
      sourceRevision: REVISION,
      sourceRepoUrl: "https://github.com/Portkey-AI/models",
      sourceDirectoryUrl: `https://github.com/Portkey-AI/models/tree/${REVISION}/pricing`,
      licenseUrl: `https://raw.githubusercontent.com/Portkey-AI/models/${REVISION}/LICENSE`,
      providerCount: providerSources.length,
      modelCount: entries.length
    },
    providerSources,
    entries
  };
}

describe("pricing catalog safeguards", () => {
  it("ignores metadata and unmonitored-only changes", () => {
    const current = catalog({ extra: [{ model: "one", input: 1, output: 2 }] });
    const candidate = catalog({ extra: [{ model: "two", input: 1, output: 2 }] });

    expect(diffPricingCatalogs(current, candidate)).toMatchObject({
      decision: "no-change",
      changes: [],
      totalCatalogChangeCount: 2
    });
  });

  it("allows small valid additions and repricings", () => {
    const current = catalog();
    const candidate = catalog({
      openai: [
        { model: "openai-model", input: 1.1, cached: 0.1, output: 2 },
        { model: "new-codex", input: 1, cached: 0.1, output: 3 }
      ]
    });

    const report = diffPricingCatalogs(current, candidate);
    expect(report.decision).toBe("safe");
    expect(report.providerSummaries).toContainEqual({ provider: "openai", added: 1, removed: 0, repriced: 1 });
  });

  it("allows price movement at exactly twenty percent", () => {
    const candidate = catalog({
      openai: [{ model: "openai-model", input: 1.2, cached: 0.1, output: 2 }]
    });
    expect(diffPricingCatalogs(catalog(), candidate).decision).toBe("safe");
  });

  it.each([
    ["a removal", catalog({ openai: [{ model: "retained", input: 1, cached: 0.1, output: 2 }] })],
    ["a zero-price transition", catalog({ openai: [{ model: "openai-model", input: 1, cached: 0, output: 2 }] })],
    ["a price movement over twenty percent", catalog({ openai: [{ model: "openai-model", input: 1.21, cached: 0.1, output: 2 }] })],
    [
      "more than twenty changed models",
      catalog({
        openai: Array.from({ length: 22 }, (_, index) => ({
          model: index === 0 ? "openai-model" : `new-${index}`,
          input: 1,
          cached: 0.1,
          output: 2
        }))
      })
    ]
  ])("blocks suspicious change: %s", (_label, candidate) => {
    const report = diffPricingCatalogs(catalog(), candidate);
    expect(report.decision).toBe("blocked");
    expect(report.suspiciousReasons.length).toBeGreaterThan(0);
    expect(report.hardFailures).toEqual([]);
  });

  it("allows an exact-revision caller to approve only suspicious thresholds", () => {
    const candidate = catalog({ openai: [{ model: "retained", input: 1, cached: 0.1, output: 2 }] });
    const report = diffPricingCatalogs(catalog(), candidate, { approveSuspicious: true });

    expect(report.decision).toBe("safe");
    expect(report.approvedSuspiciousChange).toBe(true);
    expect(report.suspiciousReasons.length).toBeGreaterThan(0);
  });

  it("requires an exact source revision for suspicious approval", () => {
    expect(() => validateSuspiciousApprovalRequest(true, null)).toThrow(/requires an exact/);
    expect(() => validateSuspiciousApprovalRequest(true, "main")).toThrow(/exact 40-64/);
    expect(() => validateSuspiciousApprovalRequest(true, REVISION)).not.toThrow();
  });

  it.each([
    [
      "missing monitored provider",
      () => {
        const value = catalog();
        value.providerSources = value.providerSources.filter((source) => source.provider !== "google");
        value.entries = value.entries.filter((entry) => entry.provider !== "google");
        value.metadata.providerCount -= 1;
        value.metadata.modelCount -= 1;
        return value;
      }
    ],
    [
      "duplicate identity",
      () => {
        const value = catalog();
        value.entries.push({ ...value.entries[0]! });
        value.metadata.modelCount += 1;
        return value;
      }
    ],
    [
      "negative price",
      () => {
        const value = catalog();
        value.entries[0]!.inputUsdPerMillion = -1;
        return value;
      }
    ],
    [
      "unpinned source",
      () => {
        const value = catalog();
        value.entries[0]!.sourceUrl = "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json";
        return value;
      }
    ],
    [
      "invalid revision",
      () => {
        const value = catalog();
        value.metadata.sourceRevision = "main";
        return value;
      }
    ],
    [
      "invalid timestamp",
      () => {
        const value = catalog();
        value.metadata.generatedAt = "not-a-date";
        return value;
      }
    ],
    [
      "incorrect model count",
      () => {
        const value = catalog();
        value.metadata.modelCount += 1;
        return value;
      }
    ],
    [
      "non-finite price",
      () => {
        const value = catalog();
        value.entries[0]!.outputUsdPerMillion = Number.POSITIVE_INFINITY;
        return value;
      }
    ],
    [
      "unpinned provider source",
      () => {
        const value = catalog();
        value.providerSources[0]!.sourceUrl =
          "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json";
        return value;
      }
    ]
  ])("hard-blocks invalid catalog: %s", (_label, buildCandidate) => {
    const report = diffPricingCatalogs(catalog(), buildCandidate());
    expect(report.decision).toBe("blocked");
    expect(report.hardFailures.length).toBeGreaterThan(0);
    expect(diffPricingCatalogs(catalog(), buildCandidate(), { approveSuspicious: true }).decision).toBe("blocked");
  });

  it("produces stable incident fingerprints", () => {
    const candidate = catalog({ openai: [] });
    expect(diffPricingCatalogs(catalog(), candidate).fingerprint).toBe(
      diffPricingCatalogs(catalog(), candidate).fingerprint
    );
  });

  it("grandfathers unchanged unmonitored case collisions but blocks new ones", () => {
    const existingCollision = {
      extra: [
        { model: "Model-A", input: 1, output: 2 },
        { model: "model-a", input: 1.5, output: 3 }
      ]
    };
    expect(diffPricingCatalogs(catalog(existingCollision), catalog(existingCollision)).hardFailures).toEqual([]);

    const candidate = catalog(existingCollision);
    expect(diffPricingCatalogs(catalog({ extra: [{ model: "Model-A", input: 1, output: 2 }] }), candidate)).toMatchObject({
      decision: "blocked",
      hardFailures: ["New or changed duplicate pricing identity: extra:model-a."]
    });
  });
});
