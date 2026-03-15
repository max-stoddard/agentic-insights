import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as aggregation from "../src/aggregation.js";
import * as discovery from "../src/discovery.js";
import { calculateEventCostUsd, getPricingEntry } from "../src/pricing.js";
import { DashboardService } from "../src/service.js";
import {
  captureHomeEnv,
  createCacheDir,
  createClaudeHome,
  createCodexHome,
  restoreHomeEnv,
  setUserHomeEnv,
  writeJsonFile,
  writeJsonlFile,
  writeTuiLog
} from "./helpers.js";
import type { HomeEnvSnapshot } from "./helpers.js";

let previousCodexHome: string | undefined;
let previousCacheDir: string | undefined;
let previousHomeEnv: HomeEnvSnapshot = {};

function createSessionRows(
  sessionId: string,
  timestamp: string,
  totalTokens: number,
  options: {
    provider?: string;
    source?: string;
    model?: string;
  } = {}
) {
  const provider = options.provider ?? "openai";
  const source = options.source ?? "vscode";
  const model = options.model ?? "gpt-5.3-codex";

  return [
    {
      timestamp,
      type: "session_meta",
      payload: {
        id: sessionId,
        model_provider: provider,
        source
      }
    },
    {
      timestamp,
      type: "turn_context",
      payload: {
        model
      }
    },
    {
      timestamp,
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            total_tokens: totalTokens,
            input_tokens: totalTokens - 20,
            output_tokens: 20,
            cached_input_tokens: 10
          },
          last_token_usage: {
            input_tokens: totalTokens - 20,
            output_tokens: 20,
            cached_input_tokens: 10
          }
        }
      }
    }
  ];
}

function createImmediateDashboardService() {
  return createDashboardService();
}

function createDashboardService(options: { now?: () => number } = {}) {
  return new DashboardService({
    scheduleIndexingTask: (task) => task(),
    ...(options.now ? { now: options.now } : {})
  });
}

function createDeferredScheduler() {
  const tasks: Array<() => void> = [];

  return {
    schedule(task: () => void) {
      tasks.push(task);
    },
    runNext() {
      const task = tasks.shift();
      task?.();
    },
    pendingCount() {
      return tasks.length;
    }
  };
}

beforeEach(() => {
  previousCodexHome = process.env.CODEX_HOME;
  previousCacheDir = process.env.AGENTIC_INSIGHTS_CACHE_DIR;
  previousHomeEnv = captureHomeEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

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

  restoreHomeEnv(previousHomeEnv);
});

describe("DashboardService", () => {
  it("reuses cached day aggregations for repeated week and month requests until the snapshot changes", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;
    let now = new Date("2026-03-09T12:00:00.000Z").getTime();

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const daySpy = vi.spyOn(aggregation, "aggregateDayTimeseries");
    const bucketSpy = vi.spyOn(aggregation, "aggregateFromDayBuckets");
    const service = createDashboardService({
      now: () => now
    });

    const firstMonth = service.getTimeseries("month", "UTC");
    const secondMonth = service.getTimeseries("month", "UTC");
    const week = service.getTimeseries("week", "UTC");

    expect(firstMonth).toEqual(secondMonth);
    expect(firstMonth.points[0]?.tokens).toBe(120);
    expect(firstMonth.points[0]?.energyKwh).toBeGreaterThan(0);
    expect(firstMonth.points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(week.points[0]?.tokens).toBe(120);
    expect(week.points[0]?.energyKwh).toBeGreaterThan(0);
    expect(week.points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(daySpy).toHaveBeenCalledTimes(1);
    expect(bucketSpy).toHaveBeenCalledTimes(2);

    writeJsonlFile(codex.dir, "sessions/2026/03/10/session-b.jsonl", createSessionRows("session-b", "2026-03-10T10:00:00.000Z", 80));
    now += 1_001;

    const refreshedMonth = service.getTimeseries("month", "UTC");

    expect(refreshedMonth.points[0]?.tokens).toBe(200);
    expect(daySpy).toHaveBeenCalledTimes(2);
    expect(bucketSpy).toHaveBeenCalledTimes(4);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("reuses persisted aggregate bundles across service instances for the same signature", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const firstService = createImmediateDashboardService();
    expect(firstService.getTimeseries("month", "UTC").points[0]?.tokens).toBe(120);

    const daySpy = vi.spyOn(aggregation, "aggregateDayTimeseries");
    const bucketSpy = vi.spyOn(aggregation, "aggregateFromDayBuckets");
    const secondService = createImmediateDashboardService();

    expect(secondService.getTimeseries("week", "UTC").points[0]?.tokens).toBe(120);
    expect(secondService.getTimeseries("week", "UTC").points[0]?.energyKwh).toBeGreaterThan(0);
    expect(secondService.getTimeseries("week", "UTC").points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(daySpy).not.toHaveBeenCalled();
    expect(bucketSpy).not.toHaveBeenCalled();

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("invalidates persisted aggregate bundles when the snapshot signature changes", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const firstService = createImmediateDashboardService();
    expect(firstService.getTimeseries("month", "UTC").points[0]?.tokens).toBe(120);

    writeJsonlFile(codex.dir, "sessions/2026/03/10/session-b.jsonl", createSessionRows("session-b", "2026-03-10T10:00:00.000Z", 80));

    const daySpy = vi.spyOn(aggregation, "aggregateDayTimeseries");
    const bucketSpy = vi.spyOn(aggregation, "aggregateFromDayBuckets");
    const secondService = createImmediateDashboardService();

    expect(secondService.getTimeseries("month", "UTC").points[0]?.tokens).toBe(200);
    expect(secondService.getTimeseries("month", "UTC").points[0]?.energyKwh).toBeGreaterThan(0);
    expect(secondService.getTimeseries("month", "UTC").points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(daySpy).toHaveBeenCalledTimes(1);
    expect(bucketSpy).toHaveBeenCalledTimes(2);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("memoizes discovery scans briefly across rapid overview and timeseries requests", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;
    let now = new Date("2026-03-09T12:00:00.000Z").getTime();

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const sessionSpy = vi.spyOn(discovery, "listSessionFiles");
    const service = createDashboardService({
      now: () => now
    });

    expect(service.getOverview("UTC").diagnostics.state).toBe("ready");
    expect(service.getTimeseries("day", "UTC").points[0]?.tokens).toBe(120);
    expect(service.getTimeseries("day", "UTC").points[0]?.energyKwh).toBeGreaterThan(0);
    expect(service.getTimeseries("day", "UTC").points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(service.getTimeseries("week", "UTC").points[0]?.tokens).toBe(120);
    expect(sessionSpy).toHaveBeenCalledTimes(1);

    now += 1_001;

    expect(service.getOverview("UTC").diagnostics.state).toBe("ready");
    expect(sessionSpy).toHaveBeenCalledTimes(2);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("rebuilds persisted aggregate bundles when the cached points are missing carbon data", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const firstService = createImmediateDashboardService();
    expect(firstService.getTimeseries("month", "UTC").points[0]?.energyKwh).toBeGreaterThan(0);
    expect(firstService.getTimeseries("month", "UTC").points[0]?.carbonKgCo2).toBeGreaterThan(0);

    const cachePath = path.join(cache.dir, "timeseries.json");
    const persisted = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      signature: string;
      byTimeZone: Record<string, { day: Array<Record<string, unknown>>; week: Array<Record<string, unknown>>; month: Array<Record<string, unknown>> }>;
    };

    for (const bundle of Object.values(persisted.byTimeZone)) {
      for (const series of [bundle.day, bundle.week, bundle.month]) {
        for (const point of series) {
          delete point.carbonKgCo2;
        }
      }
    }

    fs.writeFileSync(cachePath, JSON.stringify(persisted, null, 2));

    const daySpy = vi.spyOn(aggregation, "aggregateDayTimeseries");
    const bucketSpy = vi.spyOn(aggregation, "aggregateFromDayBuckets");
    const secondService = createImmediateDashboardService();

    expect(secondService.getTimeseries("week", "UTC").points[0]?.energyKwh).toBeGreaterThan(0);
    expect(secondService.getTimeseries("week", "UTC").points[0]?.carbonKgCo2).toBeGreaterThan(0);
    expect(daySpy).toHaveBeenCalledTimes(1);
    expect(bucketSpy).toHaveBeenCalledTimes(2);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("returns indexing first and then ready after the background snapshot completes", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    const scheduler = createDeferredScheduler();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const service = new DashboardService({
      scheduleIndexingTask: scheduler.schedule
    });

    const firstOverview = service.getOverview("UTC");
    expect(firstOverview.diagnostics.state).toBe("indexing");
    expect(firstOverview.indexing?.phase).toBe("discovering");
    expect(firstOverview.tokenTotals.totalTokens).toBe(0);

    scheduler.runNext();

    const secondOverview = service.getOverview("UTC");
    expect(secondOverview.diagnostics.state).toBe("ready");
    expect(secondOverview.indexing).toBeNull();
    expect(secondOverview.tokenTotals.totalTokens).toBe(120);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("transitions from indexing to no_data only after the background snapshot completes", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    const scheduler = createDeferredScheduler();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    const service = new DashboardService({
      scheduleIndexingTask: scheduler.schedule
    });

    const firstOverview = service.getOverview("UTC");
    expect(firstOverview.diagnostics.state).toBe("indexing");
    expect(firstOverview.indexing?.phase).toBe("discovering");

    scheduler.runNext();

    const secondOverview = service.getOverview("UTC");
    expect(secondOverview.diagnostics.state).toBe("no_data");
    expect(secondOverview.indexing).toBeNull();

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("deduplicates concurrent overview requests while indexing is already active", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    const scheduler = createDeferredScheduler();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-a.jsonl", createSessionRows("session-a", "2026-03-09T10:00:00.000Z", 120));

    const service = new DashboardService({
      scheduleIndexingTask: scheduler.schedule
    });

    const firstOverview = service.getOverview("UTC");
    const secondOverview = service.getOverview("UTC");

    expect(firstOverview.diagnostics.state).toBe("indexing");
    expect(secondOverview.diagnostics.state).toBe("indexing");
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.runNext();

    const readyOverview = service.getOverview("UTC");
    expect(readyOverview.diagnostics.state).toBe("ready");
    expect(readyOverview.tokenTotals.totalTokens).toBe(120);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("computes weekly growth using week-to-date windows instead of full previous weeks", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;
    const now = new Date("2026-03-13T12:00:00.000Z").getTime();

    writeJsonlFile(codex.dir, "sessions/2026/03/10/session-current-a.jsonl", [
      ...createSessionRows("session-current-a", "2026-03-10T10:00:00.000Z", 120),
      {
        timestamp: "2026-03-10T10:00:01.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Summarise this week"
        }
      }
    ]);
    writeJsonlFile(codex.dir, "sessions/2026/03/12/session-current-b.jsonl", [
      ...createSessionRows("session-current-b", "2026-03-12T09:00:00.000Z", 80),
      {
        timestamp: "2026-03-12T09:00:01.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Compare the latest usage"
        }
      }
    ]);
    writeJsonlFile(codex.dir, "sessions/2026/03/04/session-previous-a.jsonl", [
      ...createSessionRows("session-previous-a", "2026-03-04T10:00:00.000Z", 50),
      {
        timestamp: "2026-03-04T10:00:01.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Summarise the earlier week"
        }
      }
    ]);
    writeJsonlFile(codex.dir, "sessions/2026/03/07/session-previous-late.jsonl", [
      ...createSessionRows("session-previous-late", "2026-03-07T15:00:00.000Z", 200),
      {
        timestamp: "2026-03-07T15:00:01.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "This should not count for week-to-date"
        }
      }
    ]);

    const service = createDashboardService({
      now: () => now
    });
    const overview = service.getOverview("UTC");

    expect(overview.weeklyGrowth).toEqual({
      sessions: {
        current: 2,
        previous: 1,
        increase: 1
      },
      prompts: {
        current: 2,
        previous: 1,
        increase: 1
      },
      tokens: {
        current: 200,
        previous: 50,
        increase: 150
      }
    });

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("supports model-first pricing, keeps local ollama usage excluded, and filters synthetic model rows", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-openai-vscode.jsonl",
      [
        ...createSessionRows("session-openai-vscode", "2026-03-09T10:00:00.000Z", 120, {
          source: "vscode",
          model: "gpt-5.3-codex"
        }),
        {
          timestamp: "2026-03-09T10:00:03.000Z",
          type: "event_msg",
          payload: {
            type: "user_message",
            message: "Explain this chart"
          }
        }
      ]
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-openai-cli.jsonl",
      createSessionRows("session-openai-cli", "2026-03-09T10:05:00.000Z", 80, {
        source: "exec",
        model: "gpt-5.3-codex"
      })
    );
    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-openai-fallback.jsonl", [
      {
        timestamp: "2026-03-09T10:06:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-openai-fallback",
          model_provider: "openai",
          source: "exec"
        }
      },
      {
        timestamp: "2026-03-09T10:06:00.000Z",
        type: "turn_context",
        payload: {
          model: "gpt-5.3-codex"
        }
      }
    ]);
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-claude.jsonl",
      createSessionRows("session-claude", "2026-03-09T10:10:00.000Z", 60, {
        provider: "claude",
        source: "cli",
        model: "claude-sonnet-4-20250514"
      })
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-anthropic-qwen-known.jsonl",
      createSessionRows("session-anthropic-qwen-known", "2026-03-09T10:12:00.000Z", 70, {
        provider: "anthropic",
        source: "cli",
        model: "qwen2.5-coder:7b"
      })
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-anthropic-qwen-unknown.jsonl",
      createSessionRows("session-anthropic-qwen-unknown", "2026-03-09T10:13:00.000Z", 35, {
        provider: "anthropic",
        source: "cli",
        model: "qwen3.5:9b"
      })
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-ollama.jsonl",
      createSessionRows("session-ollama", "2026-03-09T10:15:00.000Z", 40, {
        provider: "ollama",
        source: "exec",
        model: "qwen3.5:9b"
      })
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-ollama-known.jsonl",
      createSessionRows("session-ollama-known", "2026-03-09T10:16:00.000Z", 45, {
        provider: "ollama",
        source: "exec",
        model: "qwen2.5-coder:7b"
      })
    );
    writeJsonlFile(
      codex.dir,
      "sessions/2026/03/09/session-synthetic.jsonl",
      createSessionRows("session-synthetic", "2026-03-09T10:17:00.000Z", 25, {
        provider: "anthropic",
        source: "cli",
        model: "<synthetic>"
      })
    );
    writeTuiLog(codex.dir, "2026-03-09T10:06:01.000Z INFO thread_id=session-openai-fallback total_usage_tokens=50");

    const service = createImmediateDashboardService();
    const overview = service.getOverview("UTC");
    const openAiPricing = getPricingEntry("openai", "gpt-5.3-codex");
    expect(openAiPricing).not.toBeNull();
    const expectedOpenAiCost =
      calculateEventCostUsd(openAiPricing!, 100, 10, 20) + calculateEventCostUsd(openAiPricing!, 60, 10, 20);

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
          provider: "openai",
          model: "gpt-5.3-codex",
          source: "CLI",
          classification: "supported",
          tokens: 80
        }),
        expect.objectContaining({
          provider: "openai",
          model: "gpt-5.3-codex",
          source: "CLI",
          classification: "token_only",
          tokens: 50,
          reason: "Token totals are available, but token splits needed for pricing-weighted estimation are missing."
        }),
        expect.objectContaining({
          provider: "claude",
          model: "claude-sonnet-4",
          source: "CLI",
          classification: "supported",
          tokens: 60
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "qwen2.5-coder:7b",
          source: "CLI",
          classification: "supported",
          tokens: 70
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "qwen3.5:9b",
          source: "CLI",
          classification: "excluded",
          tokens: 35,
          reason: "Unknown model: qwen3.5:9b"
        }),
        expect.objectContaining({
          provider: "ollama",
          model: "qwen3.5:9b",
          source: "CLI",
          classification: "excluded",
          tokens: 40,
          reason: "Local usage: qwen3.5:9b"
        }),
        expect.objectContaining({
          provider: "ollama",
          model: "qwen2.5-coder:7b",
          source: "CLI",
          classification: "excluded",
          tokens: 45,
          reason: "Local usage: qwen2.5-coder:7b"
        })
      ])
    );
    expect(overview.modelUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "openai",
          model: "gpt-5.3-codex",
          totalTokens: 250,
          supportedTokens: 200,
          unestimatedTokens: 50,
          status: "allowed",
          statusNote: "includes fallback-only usage"
        }),
        expect.objectContaining({
          provider: "claude",
          model: "claude-sonnet-4",
          totalTokens: 60,
          supportedTokens: 60,
          apiCostUsd: expect.any(Number),
          status: "allowed",
          statusNote: null
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "qwen2.5-coder:7b",
          totalTokens: 70,
          supportedTokens: 70,
          apiCostUsd: expect.any(Number),
          status: "allowed",
          statusNote: null
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "qwen3.5:9b",
          totalTokens: 35,
          excludedTokens: 35,
          apiCostUsd: 0,
          status: "unknown",
          statusNote: "pricing not available yet"
        }),
        expect.objectContaining({
          provider: "ollama",
          model: "qwen2.5-coder:7b",
          totalTokens: 45,
          excludedTokens: 45,
          apiCostUsd: 0,
          status: "local",
          statusNote: "Ran on local hardware"
        }),
        expect.objectContaining({
          provider: "ollama",
          model: "qwen3.5:9b",
          totalTokens: 40,
          excludedTokens: 40,
          apiCostUsd: 0,
          status: "local",
          statusNote: "Ran on local hardware"
        })
      ])
    );
    expect(overview.modelUsage.find((item) => item.provider === "openai" && item.model === "gpt-5.3-codex")?.apiCostUsd).toBeCloseTo(
      expectedOpenAiCost,
      12
    );
    expect(overview.modelUsage.find((item) => item.provider === "anthropic" && item.model === "qwen3.5:9b")?.apiCostUsd).toBe(0);
    expect(overview.modelUsage.find((item) => item.provider === "ollama" && item.model === "qwen2.5-coder:7b")?.apiCostUsd).toBe(0);
    expect(
      overview.modelUsage.some((item) => item.provider === "anthropic" && item.model === "<synthetic>")
    ).toBe(false);

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });

  it("merges Claude Code usage from ~/.claude into overview totals", () => {
    const codex = createCodexHome();
    const claude = createClaudeHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    setUserHomeEnv(claude.homeDir);
    process.env.AGENTIC_INSIGHTS_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-openai.jsonl", createSessionRows("session-openai", "2026-03-09T10:00:00.000Z", 120));
    writeJsonlFile(claude.homeDir, ".claude/projects/project-a/session-claude.jsonl", [
      {
        type: "user",
        uuid: "prompt-1",
        timestamp: "2026-03-09T11:00:00.000Z",
        sessionId: "session-claude",
        message: {
          content: "Summarise the model output"
        }
      },
      {
        type: "assistant",
        timestamp: "2026-03-09T11:00:00.000Z",
        sessionId: "session-claude",
        message: {
          id: "msg-claude-1",
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 70,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 20,
            output_tokens: 30
          }
        }
      }
    ]);
    writeJsonFile(claude.homeDir, ".claude/usage-data/session-meta/session-fallback.json", {
      session_id: "session-fallback",
      start_time: "2026-03-09T12:00:00.000Z",
      input_tokens: 50,
      output_tokens: 10
    });

    const service = createImmediateDashboardService();
    const overview = service.getOverview("UTC");
    const claudePricing = getPricingEntry("anthropic", "claude-sonnet-4");
    expect(claudePricing).not.toBeNull();
    const expectedClaudeCost = calculateEventCostUsd(claudePricing!, 80, 20, 30);

    expect(overview.coverageSummary).toEqual({
      sessions: 3,
      prompts: 1,
      excludedModels: 1
    });
    expect(overview.tokenTotals.totalTokens).toBe(290);
    expect(overview.coverageDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          model: "claude-sonnet-4",
          source: "Claude Code",
          classification: "supported",
          tokens: 110
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "unknown",
          source: "Claude Code",
          classification: "excluded",
          tokens: 60,
          reason: "Unknown model: unknown"
        })
      ])
    );
    expect(overview.modelUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          model: "claude-sonnet-4",
          totalTokens: 110,
          supportedTokens: 110,
          apiCostUsd: expect.any(Number)
        }),
        expect.objectContaining({
          provider: "anthropic",
          model: "unknown",
          totalTokens: 60,
          excludedTokens: 60,
          apiCostUsd: 0,
          status: "unknown",
          statusNote: "pricing not available yet"
        })
      ])
    );
    expect(overview.modelUsage.find((item) => item.provider === "anthropic" && item.model === "claude-sonnet-4")?.apiCostUsd).toBeCloseTo(
      expectedClaudeCost,
      12
    );

    codex.cleanup();
    claude.cleanup();
    cache.cleanup();
  });
});
