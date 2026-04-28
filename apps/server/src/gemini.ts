import crypto from "node:crypto";
import fs from "node:fs";
import type { PromptRecord, RawUsageEvent } from "./types.js";

interface GeminiUsage {
  input: number;
  output: number;
  cached: number;
  thoughts: number;
  tool: number;
  total: number;
}

interface GeminiMessageContent {
  text?: string;
}

interface GeminiMessage {
  id: string;
  timestamp: string;
  type: string;
  content: string | GeminiMessageContent[];
  tokens?: GeminiUsage;
  model?: string;
}

interface GeminiSession {
  sessionId: string;
  messages: GeminiMessage[];
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000 && value < 10_000_000_000 ? value * 1000 : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function makeEventId(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function normalizePromptText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text : null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as { text?: unknown };
      return typeof record.text === "string" ? [record.text] : [];
    })
    .join("\n")
    .trim();

  return text ? text : null;
}

export function parseGeminiSessionFile(filePath: string): { events: RawUsageEvent[]; prompts: PromptRecord[] } {
  const events: RawUsageEvent[] = [];
  const prompts: PromptRecord[] = [];

  let session: GeminiSession;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    session = JSON.parse(content) as GeminiSession;
  } catch {
    return { events, prompts };
  }

  const sessionId = session.sessionId;
  if (!sessionId || !Array.isArray(session.messages)) {
    return { events, prompts };
  }

  for (const message of session.messages) {
    const ts = parseTimestamp(message.timestamp);
    if (ts === null) {
      continue;
    }

    if (message.type === "user") {
      const text = normalizePromptText(message.content);
      if (text) {
        prompts.push({
          id: makeEventId([sessionId, "user", String(ts), text]),
          sessionId: sessionId,
          ts,
          previewText: text
        });
      }
      continue;
    }

    if (message.type !== "gemini" || !message.tokens || !message.model) {
      continue;
    }

    const { tokens, model, id } = message;

    events.push({
      id: id ? makeEventId([sessionId, id]) : makeEventId([sessionId, String(ts), model, String(tokens.total)]),
      sessionId: sessionId,
      ts,
      provider: "google",
      model,
      source: "gemini_cli",
      totalTokens: tokens.total,
      inputTokens: tokens.input,
      cachedInputTokens: tokens.cached,
      outputTokens: tokens.output,
      splitSource: "last_usage",
      transport: "gemini_cli"
    });
  }

  return { events, prompts };
}
