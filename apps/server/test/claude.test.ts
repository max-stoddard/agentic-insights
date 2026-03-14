import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseClaudeProjectFile, parseClaudeSessionMetaFile } from "../src/claude.js";
import { captureHomeEnv, createClaudeHome, restoreHomeEnv, setUserHomeEnv, writeJsonFile, writeJsonlFile } from "./helpers.js";
import type { HomeEnvSnapshot } from "./helpers.js";

const cleanups: Array<() => void> = [];
let previousHomeEnv: HomeEnvSnapshot = {};

beforeEach(() => {
  previousHomeEnv = captureHomeEnv();
});

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }

  restoreHomeEnv(previousHomeEnv);
});

describe("Claude usage parsing", () => {
  it("parses project jsonl assistant usage and dedupes repeated message snapshots", () => {
    const claude = createClaudeHome();
    cleanups.push(claude.cleanup);
    setUserHomeEnv(claude.homeDir);

    const file = writeJsonlFile(claude.homeDir, ".claude/projects/project-a/session-a.jsonl", [
      {
        type: "assistant",
        timestamp: "2026-03-09T10:00:02.000Z",
        sessionId: "session-a",
        message: {
          id: "msg-1",
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 40,
            output_tokens: 20
          }
        }
      },
      {
        type: "assistant",
        timestamp: "2026-03-09T10:00:03.000Z",
        sessionId: "session-a",
        message: {
          id: "msg-1",
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 40,
            output_tokens: 20
          }
        }
      },
      {
        type: "assistant",
        timestamp: "2026-03-09T10:05:00.000Z",
        sessionId: "session-a",
        message: {
          id: "msg-2",
          model: "claude-haiku-4-5",
          usage: {
            input_tokens: 30,
            cache_creation: {
              ephemeral_5m_input_tokens: 5,
              ephemeral_1h_input_tokens: 10
            },
            output_tokens: 15
          }
        }
      }
    ]);

    const parsed = parseClaudeProjectFile(file);

    expect(parsed.events).toHaveLength(2);
    expect(parsed.prompts).toEqual([]);
    expect(parsed.events[0]).toMatchObject({
      sessionId: "session-a",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      source: "claude_code",
      totalTokens: 145,
      inputTokens: 125,
      cachedInputTokens: 40,
      outputTokens: 20,
      transport: "claude_project"
    });
    expect(parsed.events[1]).toMatchObject({
      model: "claude-haiku-4-5",
      totalTokens: 60,
      inputTokens: 45,
      cachedInputTokens: 0,
      outputTokens: 15
    });
    expect(parsed.sessionModels.get("session-a")).toBe("claude-haiku-4-5");
  });

  it("uses session-meta totals only when no project events exist for that session", () => {
    const claude = createClaudeHome();
    cleanups.push(claude.cleanup);
    setUserHomeEnv(claude.homeDir);

    const metaFile = writeJsonFile(claude.homeDir, ".claude/usage-data/session-meta/session-b.json", {
      session_id: "session-b",
      start_time: "2026-03-09T11:00:00.000Z",
      input_tokens: 80,
      output_tokens: 20
    });

    const [fallbackEvent] = parseClaudeSessionMetaFile(metaFile, {
      sessionModels: new Map([["session-b", "claude-opus-4-1-20250805"]]),
      sessionsWithProjectEvents: new Set()
    });

    expect(fallbackEvent).toMatchObject({
      sessionId: "session-b",
      provider: "anthropic",
      model: "claude-opus-4-1-20250805",
      source: "claude_code",
      totalTokens: 100,
      inputTokens: 80,
      cachedInputTokens: 0,
      outputTokens: 20,
      transport: "claude_summary"
    });

    expect(
      parseClaudeSessionMetaFile(metaFile, {
        sessionModels: new Map(),
        sessionsWithProjectEvents: new Set(["session-b"])
      })
    ).toEqual([]);
  });

  it("counts Claude user rows as prompts", () => {
    const claude = createClaudeHome();
    cleanups.push(claude.cleanup);
    setUserHomeEnv(claude.homeDir);

    const file = writeJsonlFile(claude.homeDir, ".claude/projects/project-b/session-c.jsonl", [
      {
        type: "user",
        uuid: "user-1",
        timestamp: "2026-03-09T12:00:00.000Z",
        sessionId: "session-c",
        message: {
          content: "Summarise this repo"
        }
      },
      {
        type: "user",
        uuid: "user-2",
        timestamp: "2026-03-09T12:05:00.000Z",
        sessionId: "session-c",
        message: {
          content: [{ type: "text", text: "Add tests" }]
        }
      }
    ]);

    const parsed = parseClaudeProjectFile(file);
    expect(parsed.prompts).toHaveLength(2);
    expect(parsed.prompts[0]?.sessionId).toBe("session-c");
  });
});
