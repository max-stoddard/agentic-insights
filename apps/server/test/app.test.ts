import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCacheDir, createClaudeHome, createCodexHome, writeJsonFile, writeJsonlFile, writeTuiLog } from "./helpers.js";

let previousCodexHome: string | undefined;
let previousCacheDir: string | undefined;
let previousHome: string | undefined;

beforeEach(() => {
  previousCodexHome = process.env.CODEX_HOME;
  previousCacheDir = process.env.AGENTIC_INSIGHTS_CACHE_DIR;
  previousHome = process.env.HOME;
});

afterEach(() => {
  if (previousCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = previousCodexHome;
  }

  if (previousCacheDir === undefined) {
    delete process.env.AGENTIC_INSIGHTS_CACHE_DIR;
  } else {
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = previousCacheDir;
  }

  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }
});

describe("API routes", () => {
  it("serves overview, timeseries, and methodology consistently", async () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    process.env.HOME = claude.homeDir;
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

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
      },
      {
        timestamp: "2026-03-09T10:00:03.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Explain the estimate"
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

    writeJsonlFile(claude.homeDir, ".claude/projects/project-a/rollout-claude.jsonl", [
      {
        type: "user",
        uuid: "user-claude-1",
        timestamp: "2026-03-09T10:09:59.000Z",
        sessionId: "session-claude",
        message: {
          content: "Review the methodology"
        }
      },
      {
        type: "assistant",
        timestamp: "2026-03-09T10:10:00.000Z",
        sessionId: "session-claude",
        message: {
          id: "msg-claude-1",
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 55,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 10,
            output_tokens: 15
          }
        }
      },
      {
        type: "assistant",
        timestamp: "2026-03-09T10:10:01.000Z",
        sessionId: "session-claude",
        message: {
          id: "msg-claude-1",
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 55,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 10,
            output_tokens: 15
          }
        }
      }
    ]);
    writeJsonFile(claude.homeDir, ".claude/usage-data/session-meta/session-claude-fallback.json", {
      session_id: "session-claude-fallback",
      start_time: "2026-03-09T10:12:00.000Z",
      input_tokens: 40,
      output_tokens: 10
    });

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
    expect(overview.tokenTotals.totalTokens).toBe(360);
    expect(overview.tokenTotals.supportedTokens).toBe(200);
    expect(overview.tokenTotals.excludedTokens).toBe(100);
    expect(overview.tokenTotals.unestimatedTokens).toBe(60);
    expect(overview.coverage.supportedEvents).toBe(2);
    expect(overview.coverageSummary).toEqual({
      sessions: 5,
      prompts: 2,
      excludedModels: 2
    });
    expect(overview.modelUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "openai",
          model: "gpt-5.3-codex",
          totalTokens: 120,
          supportedTokens: 120
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "claude-sonnet-4",
          totalTokens: 80,
          supportedTokens: 80,
          status: "allowed",
          statusNote: null
        })
      ])
    );
    expect(overview.coverageDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "openai",
          model: "gpt-5.3-codex",
          source: "VS Code extension",
          classification: "supported",
          tokens: 120
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "claude-sonnet-4",
          source: "Claude Code",
          classification: "supported",
          tokens: 80
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "unknown",
          source: "Claude Code",
          classification: "excluded",
          tokens: 50,
          reason: "Unknown model: unknown"
        }),
        expect.objectContaining({
          provider: "ollama",
          model: "qwen3.5:9b",
          source: "CLI",
          classification: "excluded",
          tokens: 50,
          reason: "Local usage: qwen3.5:9b"
        })
      ])
    );
    expect(overview.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "ollama",
          model: "qwen3.5:9b",
          source: "CLI"
        })
      ])
    );

    const timeseriesResponse = await app.inject({
      method: "GET",
      url: "/api/timeseries?bucket=day&tz=UTC"
    });
    const timeseries = timeseriesResponse.json();
    expect(timeseries.points).toHaveLength(1);
    expect(timeseries.points[0].tokens).toBe(360);

    const methodologyResponse = await app.inject({ method: "GET", url: "/api/methodology" });
    const methodology = methodologyResponse.json();
    expect(methodology.pricingTable.some((entry: { model: string }) => entry.model === "gpt-5.2-codex")).toBe(true);
    expect(methodology.pricingTable.some((entry: { model: string }) => entry.model === "claude-sonnet-4")).toBe(true);
    expect(methodology.benchmarkCoefficients).toEqual({
      low: 0.010585,
      central: 0.016904,
      high: 0.029926
    });
    expect(methodology.exclusions).toHaveLength(2);
    expect(methodology.pricingCatalog).toEqual(
      expect.objectContaining({
        sourceRepoUrl: "https://github.com/Portkey-AI/models"
      })
    );
    expect(methodology.sourcesByTab.water).toEqual(
      expect.arrayContaining([
        { label: "CACM DOI: Making AI Less 'Thirsty' (Li, Yang, Islam, Ren)", url: "https://doi.org/10.1145/3724499" },
        {
          label: "arXiv: Uncovering and Addressing the Secret Water Footprint of AI Models",
          url: "https://arxiv.org/abs/2304.03271"
        }
      ])
    );
    expect(methodology.sourcesByTab.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Portkey models repo (MIT)",
          url: "https://github.com/Portkey-AI/models"
        })
      ])
    );

    await app.close();
    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });
});
