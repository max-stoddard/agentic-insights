import { describe, expect, it } from "vitest";
import {
  formatGeneratedPricingCatalogModule,
  type PortkeyPricingFile,
  transformPortkeyPricingCatalog
} from "../src/pricing-catalog-transform.js";

describe("Portkey pricing catalog transform", () => {
  it("transforms provider files into deterministic per-million pricing entries", () => {
    const catalog = transformPortkeyPricingCatalog(
      [
        {
          name: "anthropic.json",
          path: "pricing/anthropic.json",
          download_url: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json",
          type: "file"
        }
      ],
      new Map([
        [
          "anthropic.json",
          {
            default: {
              pricing_config: {
                pay_as_you_go: {
                  request_token: { price: 0 },
                  response_token: { price: 0 }
                }
              }
            },
            "claude-sonnet-4-5": {
              pricing_config: {
                pay_as_you_go: {
                  request_token: { price: 0.0003 },
                  response_token: { price: 0.0015 },
                  cache_read_input_token: { price: 0.00003 }
                }
              }
            },
            "image-only-model": {
              pricing_config: {
                pay_as_you_go: {}
              }
            }
          }
        ]
      ]),
      "2026-03-13T12:00:00.000Z",
      "0123456789abcdef0123456789abcdef01234567"
    );

    expect(catalog.metadata).toEqual({
      generatedAt: "2026-03-13T12:00:00.000Z",
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      sourceRepoUrl: "https://github.com/Portkey-AI/models",
      sourceDirectoryUrl:
        "https://github.com/Portkey-AI/models/tree/0123456789abcdef0123456789abcdef01234567/pricing",
      licenseUrl:
        "https://raw.githubusercontent.com/Portkey-AI/models/0123456789abcdef0123456789abcdef01234567/LICENSE",
      providerCount: 1,
      modelCount: 1
    });
    expect(catalog.providerSources).toEqual([
      {
        provider: "anthropic",
        fileName: "anthropic.json",
        sourceUrl: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json",
        sourceLabel: "Portkey pricing: anthropic.json"
      }
    ]);
    expect(catalog.entries).toEqual([
      {
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputUsdPerMillion: 3,
        cachedInputUsdPerMillion: 0.3,
        outputUsdPerMillion: 15,
        sourceUrl: "https://raw.githubusercontent.com/Portkey-AI/models/main/pricing/anthropic.json",
        sourceLabel: "Portkey pricing: anthropic.json"
      }
    ]);
    expect(formatGeneratedPricingCatalogModule(catalog)).toBe(formatGeneratedPricingCatalogModule(catalog));
  });

  it("rejects incomplete provider downloads", () => {
    expect(() =>
      transformPortkeyPricingCatalog(
        [
          {
            name: "openai.json",
            path: "pricing/openai.json",
            download_url:
              "https://raw.githubusercontent.com/Portkey-AI/models/0123456789abcdef0123456789abcdef01234567/pricing/openai.json",
            type: "file"
          }
        ],
        new Map(),
        "2026-03-13T12:00:00.000Z",
        "0123456789abcdef0123456789abcdef01234567"
      )
    ).toThrow(/Missing downloaded Portkey pricing file/);
  });

  it("rejects malformed or negative upstream price nodes instead of silently treating them as free", () => {
    const index = [
      {
        name: "openai.json",
        path: "pricing/openai.json",
        download_url:
          "https://raw.githubusercontent.com/Portkey-AI/models/0123456789abcdef0123456789abcdef01234567/pricing/openai.json",
        type: "file" as const
      }
    ];
    const malformed = {
      "gpt-malformed": {
        pricing_config: {
          pay_as_you_go: {
            request_token: { price: "1" },
            response_token: { price: 0.001 }
          }
        }
      }
    } as unknown as PortkeyPricingFile;
    const negative = {
      "gpt-negative": {
        pricing_config: {
          pay_as_you_go: {
            request_token: { price: -0.001 },
            response_token: { price: 0.001 }
          }
        }
      }
    } satisfies PortkeyPricingFile;

    expect(() =>
      transformPortkeyPricingCatalog(
        index,
        new Map([["openai.json", malformed]]),
        "2026-03-13T12:00:00.000Z",
        "0123456789abcdef0123456789abcdef01234567"
      )
    ).toThrow(/Invalid Portkey input price/);
    expect(() =>
      transformPortkeyPricingCatalog(
        index,
        new Map([["openai.json", negative]]),
        "2026-03-13T12:00:00.000Z",
        "0123456789abcdef0123456789abcdef01234567"
      )
    ).toThrow(/Invalid Portkey input price/);
  });
});
