import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("App", () => {
  it("loads overview data and switches bucket datasets", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return new Response(
          JSON.stringify({
            tokenTotals: {
              totalTokens: 1000,
              supportedTokens: 900,
              excludedTokens: 50,
              unestimatedTokens: 50
            },
            waterLitres: {
              low: 0.5,
              central: 1.2,
              high: 2.1
            },
            coverage: {
              supportedEvents: 9,
              excludedEvents: 1,
              tokenOnlyEvents: 1
            },
            exclusions: [
              {
                provider: "ollama",
                model: "qwen3.5:9b",
                tokens: 50,
                events: 1,
                reason: "Unsupported provider: ollama"
              }
            ],
            lastIndexedAt: Date.parse("2026-03-09T12:00:00.000Z"),
            calibration: {
              referenceEventCostUsd: 0.123,
              computedAt: Date.parse("2026-03-09T12:00:00.000Z"),
              supportedEventCount: 9,
              supportedMedianSource: "local_median_event_cost_usd"
            }
          }),
          { status: 200 }
        );
      }

      if (url.startsWith("/api/methodology")) {
        return new Response(
          JSON.stringify({
            pricingTable: [
              {
                provider: "openai",
                model: "gpt-5.3-codex",
                inputUsdPerMillion: 1.75,
                cachedInputUsdPerMillion: 0.175,
                outputUsdPerMillion: 14,
                docsUrl: "https://developers.openai.com/api/docs/models/gpt-5.3-codex"
              }
            ],
            benchmarkCoefficients: {
              low: 0.010619,
              central: 0.016904,
              high: 0.029915
            },
            calibration: {
              referenceEventCostUsd: 0.123,
              computedAt: Date.parse("2026-03-09T12:00:00.000Z"),
              supportedEventCount: 9,
              supportedMedianSource: "local_median_event_cost_usd"
            },
            exclusions: [],
            sourceLinks: [{ label: "OpenAI API pricing", url: "https://openai.com/api/pricing/" }]
          }),
          { status: 200 }
        );
      }

      if (url.includes("bucket=day")) {
        return new Response(
          JSON.stringify({
            bucket: "day",
            points: [
              {
                key: "2026-03-09",
                label: "9 Mar 2026",
                tokens: 1000,
                excludedTokens: 50,
                unestimatedTokens: 50,
                waterLitres: {
                  low: 0.5,
                  central: 1.2,
                  high: 2.1
                }
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.includes("bucket=week")) {
        return new Response(
          JSON.stringify({
            bucket: "week",
            points: [
              {
                key: "2026-W11",
                label: "Week of 9 Mar 2026",
                tokens: 2000,
                excludedTokens: 100,
                unestimatedTokens: 100,
                waterLitres: {
                  low: 1,
                  central: 2.4,
                  high: 4.2
                }
              }
            ]
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          bucket: "month",
          points: []
        }),
        { status: 200 }
      );
    });

    render(<App />);

    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    await screen.findByText(/Water-weighted usage from your Codex history/i);
    await waitFor(() => {
      expect(screen.getAllByText("1.20 L").length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText("Loading dashboard")).not.toBeInTheDocument();
    expect(screen.getByText(/50 tokens excluded because unsupported provider/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "week" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("bucket=week"));
    });
    await waitFor(() => {
      expect(screen.getAllByText("2.40 L").length).toBeGreaterThan(0);
    });
  });
});
