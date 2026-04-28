import crypto from "node:crypto";
import fs from "node:fs";
import type { PromptRecord, RawUsageEvent } from "./types.js";

interface ClaudeProjectUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

interface ClaudeProjectRow {
  type?: string;
  timestamp?: unknown;
  sessionId?: string;
  uuid?: string;
  message?: {
    id?: string;
    model?: string;
    content?: unknown;
    usage?: ClaudeProjectUsage;
  };
}

interface ClaudeSessionMetaRow {
  session_id?: string;
  start_time?: unknown;
  input_tokens?: number;
  output_tokens?: number;
}

export interface ClaudeProjectParseResult {
  events: RawUsageEvent[];
  prompts: PromptRecord[];
  sessionModels: Map<string, string>;
}

interface ClaudeSessionMetaOptions {
  sessionModels: Map<string, string>;
  sessionsWithProjectEvents: Set<string>;
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

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

      const record = item as { type?: unknown; text?: unknown };
      return typeof record.text === "string" ? [record.text] : [];
    })
    .join("\n")
    .trim();

  return text ? text : null;
}

function getCacheCreationTokens(usage: ClaudeProjectUsage): number {
  const direct = toFiniteNumber(usage.cache_creation_input_tokens);
  if (direct !== null) {
    return direct;
  }

  const ephemeral5m = toFiniteNumber(usage.cache_creation?.ephemeral_5m_input_tokens) ?? 0;
  const ephemeral1h = toFiniteNumber(usage.cache_creation?.ephemeral_1h_input_tokens) ?? 0;
  return ephemeral5m + ephemeral1h;
}

export function parseClaudeProjectFile(filePath: string): ClaudeProjectParseResult {
  const events: RawUsageEvent[] = [];
  const prompts: PromptRecord[] = [];
  const sessionModels = new Map<string, string>();
  const seenMessageIds = new Set<string>();

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let row: ClaudeProjectRow;
    try {
      row = JSON.parse(line) as ClaudeProjectRow;
    } catch {
      continue;
    }

    const sessionId = typeof row.sessionId === "string" && row.sessionId ? row.sessionId : null;
    const model = typeof row.message?.model === "string" && row.message.model ? row.message.model : null;
    if (sessionId && model) {
      sessionModels.set(sessionId, model);
    }

    if (row.type === "user" && sessionId) {
      const text = normalizePromptText(row.message?.content);
      const ts = parseTimestamp(row.timestamp);
      if (text && ts !== null) {
        const promptId =
          typeof row.uuid === "string" && row.uuid
            ? makeEventId([sessionId, row.uuid])
            : makeEventId([sessionId, "user", String(ts), text]);
        prompts.push({
          id: promptId,
          sessionId,
          ts,
          previewText: text
        });
      }
    }

    if (row.type !== "assistant" || !sessionId || !model || !row.message?.usage) {
      continue;
    }

    const messageId = typeof row.message.id === "string" && row.message.id ? row.message.id : null;
    if (messageId && seenMessageIds.has(messageId)) {
      continue;
    }

    const ts = parseTimestamp(row.timestamp);
    const inputTokens = toFiniteNumber(row.message.usage.input_tokens);
    const cacheCreationTokens = getCacheCreationTokens(row.message.usage);
    const cachedInputTokens = toFiniteNumber(row.message.usage.cache_read_input_tokens) ?? 0;
    const outputTokens = toFiniteNumber(row.message.usage.output_tokens);

    if (ts === null || inputTokens === null || outputTokens === null) {
      continue;
    }

    if (messageId) {
      seenMessageIds.add(messageId);
    }

    const resolvedInputTokens = inputTokens + cacheCreationTokens;
    const totalTokens = resolvedInputTokens + outputTokens;

    events.push({
      id: messageId ? makeEventId([sessionId, messageId]) : makeEventId([sessionId, String(ts), model, String(totalTokens)]),
      sessionId,
      ts,
      provider: "anthropic",
      model,
      source: "claude_code",
      totalTokens,
      inputTokens: resolvedInputTokens,
      cachedInputTokens,
      outputTokens,
      splitSource: "last_usage",
      transport: "claude_project"
    });
  }

  return {
    events,
    prompts,
    sessionModels
  };
}

export function parseClaudeSessionMetaFile(filePath: string, options: ClaudeSessionMetaOptions): RawUsageEvent[] {
  let row: ClaudeSessionMetaRow;
  try {
    row = JSON.parse(fs.readFileSync(filePath, "utf8")) as ClaudeSessionMetaRow;
  } catch {
    return [];
  }

  const sessionId = typeof row.session_id === "string" && row.session_id ? row.session_id : null;
  if (!sessionId || options.sessionsWithProjectEvents.has(sessionId)) {
    return [];
  }

  const ts = parseTimestamp(row.start_time);
  const inputTokens = toFiniteNumber(row.input_tokens);
  const outputTokens = toFiniteNumber(row.output_tokens);
  if (ts === null || inputTokens === null || outputTokens === null) {
    return [];
  }

  const model = options.sessionModels.get(sessionId) ?? "unknown";

  return [
    {
      id: makeEventId([sessionId, "claude_summary"]),
      sessionId,
      ts,
      provider: "anthropic",
      model,
      source: "claude_code",
      totalTokens: inputTokens + outputTokens,
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      splitSource: "last_usage",
      transport: "claude_summary"
    }
  ];
}
