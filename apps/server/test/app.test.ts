import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCodexHome, writeJsonlFile, writeTuiLog } from "./helpers.js";

let previousCodexHome: string | undefined;

beforeEach(() => {
  previousCodexHome = process.env.CODEX_HOME;
});

afterEach(() => {
  if (previousCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = previousCodexHome;
  }
});

describe("API routes", () => {
  it("serves overview, timeseries, and methodology consistently", async () => {
    const codex = createCodexHome();
    process.env.CODEX_HOME = codex.dir;

    const sessionId = "session-openai";
    writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-openai.jsonl", [
      {
        timestamp: "2026-03-09T10:00:00.000Z",
        type: "session_meta",
        payload: {
          id: sessionId,
          model_provider: "openai",
          source: "vscode"
        }
      },
      {
        timestamp: "2026-03-09T10:00:01.000Z",
        type: "turn_context",
        payload: {
          model: "gpt-5.3-codex"
        }
      },
      {
        timestamp: "2026-03-09T10:00:02.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              total_tokens: 120,
              input_tokens: 100,
              output_tokens: 20,
              cached_input_tokens: 30
            },
            last_token_usage: {
              input_tokens: 100,
              output_tokens: 20,
              cached_input_tokens: 30
            }
          }
        }
      }
    ]);

    const unsupportedId = "session-ollama";
    writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-ollama.jsonl", [
      {
        timestamp: "2026-03-09T10:05:00.000Z",
        type: "session_meta",
        payload: {
          id: unsupportedId,
          model_provider: "ollama",
          source: "exec"
        }
      },
      {
        timestamp: "2026-03-09T10:05:01.000Z",
        type: "turn_context",
        payload: {
          model: "qwen3.5:9b"
        }
      },
      {
        timestamp: "2026-03-09T10:05:02.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              total_tokens: 50,
              input_tokens: 45,
              output_tokens: 5,
              cached_input_tokens: 0
            },
            last_token_usage: {
              input_tokens: 45,
              output_tokens: 5,
              cached_input_tokens: 0
            }
          }
        }
      }
    ]);

    writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-fallback.jsonl", [
      {
        timestamp: "2026-03-09T11:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "fallback-only",
          model_provider: "openai",
          source: "vscode"
        }
      }
    ]);
    writeTuiLog(codex.dir, "2026-03-09T11:00:02.000Z INFO thread_id=fallback-only total_usage_tokens=60");

    const app = createApp();
    const overviewResponse = await app.inject({ method: "GET", url: "/api/overview" });
    const overview = overviewResponse.json();
    expect(overview.tokenTotals.totalTokens).toBe(230);
    expect(overview.tokenTotals.excludedTokens).toBe(50);
    expect(overview.tokenTotals.unestimatedTokens).toBe(60);
    expect(overview.coverage.supportedEvents).toBe(1);

    const timeseriesResponse = await app.inject({
      method: "GET",
      url: "/api/timeseries?bucket=day&tz=UTC"
    });
    const timeseries = timeseriesResponse.json();
    expect(timeseries.points).toHaveLength(1);
    expect(timeseries.points[0].tokens).toBe(230);

    const methodologyResponse = await app.inject({ method: "GET", url: "/api/methodology" });
    const methodology = methodologyResponse.json();
    expect(methodology.pricingTable.some((entry: { model: string }) => entry.model === "gpt-5.3-codex")).toBe(true);
    expect(methodology.benchmarkCoefficients).toEqual({
      low: 0.010585,
      central: 0.016904,
      high: 0.029926
    });
    expect(methodology.exclusions).toHaveLength(1);
    expect(methodology.sourceLinks).toEqual(
      expect.arrayContaining([
        { label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)", url: "https://doi.org/10.1145/3724499" },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        }
      ])
    );

    await app.close();
    codex.cleanup();
  });
});
