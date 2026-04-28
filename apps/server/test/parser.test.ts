import { afterEach, describe, expect, it } from "vitest";
import { parseSessionFile, parseSessionPrompts, parseTuiFallback } from "../src/parser.js";
import { createCodexHome, writeJsonlFile, writeTuiLog } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("parseSessionFile", () => {
  it("dedupes repeated cumulative totals and extracts provider/model/source", () => {
    const codex = createCodexHome();
    cleanups.push(codex.cleanup);
    const file = writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-demo.jsonl", [
      {
        timestamp: "2026-03-09T10:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-1",
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
              total_tokens: 100,
              input_tokens: 80,
              output_tokens: 20,
              cached_input_tokens: 10
            },
            last_token_usage: {
              input_tokens: 80,
              output_tokens: 20,
              cached_input_tokens: 10
            }
          }
        }
      },
      {
        timestamp: "2026-03-09T10:00:03.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              total_tokens: 100,
              input_tokens: 80,
              output_tokens: 20,
              cached_input_tokens: 10
            },
            last_token_usage: {
              input_tokens: 80,
              output_tokens: 20,
              cached_input_tokens: 10
            }
          }
        }
      },
      {
        timestamp: "2026-03-09T10:00:04.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              total_tokens: 150,
              input_tokens: 110,
              output_tokens: 40,
              cached_input_tokens: 15
            },
            last_token_usage: {
              input_tokens: 30,
              output_tokens: 20,
              cached_input_tokens: 5
            }
          }
        }
      }
    ]);

    const events = parseSessionFile(file, parseTuiFallback(`${codex.dir}/log/codex-tui.log`));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      sessionId: "session-1",
      provider: "openai",
      model: "gpt-5.3-codex",
      source: "vscode",
      totalTokens: 100,
      inputTokens: 80,
      outputTokens: 20,
      cachedInputTokens: 10,
      splitSource: "last_usage"
    });
    expect(events[1]?.totalTokens).toBe(50);
  });

  it("uses derived total deltas when last token usage is missing", () => {
    const codex = createCodexHome();
    cleanups.push(codex.cleanup);
    const file = writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-derived.jsonl", [
      {
        timestamp: "2026-03-09T10:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-2",
          model_provider: "openai",
          source: "exec"
        }
      },
      {
        timestamp: "2026-03-09T10:00:01.000Z",
        type: "turn_context",
        payload: {
          model: "gpt-5.1-codex-mini"
        }
      },
      {
        timestamp: "2026-03-09T10:00:02.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              total_tokens: 60,
              input_tokens: 50,
              output_tokens: 10,
              cached_input_tokens: 5
            }
          }
        }
      }
    ]);

    const [event] = parseSessionFile(file, new Map());
    if (!event) {
      throw new Error("Expected a parsed event.");
    }
    expect(event.splitSource).toBe("derived_totals");
    expect(event.inputTokens).toBe(50);
    expect(event.outputTokens).toBe(10);
    expect(event.cachedInputTokens).toBe(5);
  });

  it("falls back to TUI totals and marks them as token-only transport", () => {
    const codex = createCodexHome();
    cleanups.push(codex.cleanup);
    const sessionId = "019cc5ec-eadc-78d1-85a4-b7dfd65bfe0d";
    const file = writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-fallback.jsonl", [
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
          model: "gpt-5.4"
        }
      }
    ]);
    writeTuiLog(
      codex.dir,
      `2026-03-09T10:00:02.000Z INFO thread_id=${sessionId} total_usage_tokens=120\n2026-03-09T10:00:03.000Z INFO thread_id=${sessionId} total_usage_tokens=200`
    );

    const fallback = parseTuiFallback(`${codex.dir}/log/codex-tui.log`);
    const events = parseSessionFile(file, fallback);
    expect(events).toHaveLength(2);
    expect(events[0]?.transport).toBe("tui_fallback");
    expect(events[0]?.totalTokens).toBe(120);
    expect(events[1]?.totalTokens).toBe(80);
    expect(events[0]?.inputTokens).toBeNull();
  });

  it("counts codex prompts from canonical user message events", () => {
    const codex = createCodexHome();
    cleanups.push(codex.cleanup);
    const file = writeJsonlFile(codex.dir, "sessions/2026/03/09/rollout-prompts.jsonl", [
      {
        timestamp: "2026-03-09T10:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-prompts",
          model_provider: "openai",
          source: "vscode"
        }
      },
      {
        timestamp: "2026-03-09T10:00:01.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "# AGENTS.md instructions for /tmp/demo" }]
        }
      },
      {
        timestamp: "2026-03-09T10:00:02.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Explain the result" }]
        }
      },
      {
        timestamp: "2026-03-09T10:00:02.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Explain the result"
        }
      },
      {
        timestamp: "2026-03-09T10:00:03.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Add a chart"
        }
      }
    ]);

    const prompts = parseSessionPrompts(file);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]?.sessionId).toBe("session-prompts");
    expect(prompts[0]?.previewText).toBe("Explain the result");
    expect(prompts[1]?.previewText).toBe("Add a chart");
  });
});
