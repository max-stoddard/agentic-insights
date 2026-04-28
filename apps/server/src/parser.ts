import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PromptRecord, RawUsageEvent } from "./types.js";

interface ModelEvent {
  ts: number;
  model: string;
}

interface TokenEvent {
  ts: number;
  total: number | null;
  totalInput: number | null;
  totalOutput: number | null;
  totalCached: number | null;
  lastInput: number | null;
  lastOutput: number | null;
  lastCached: number | null;
}

interface TuiFallbackPoint {
  ts: number;
  total: number;
}

export type TuiFallbackMap = Map<string, TuiFallbackPoint[]>;

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

function filenameSessionId(filePath: string): string {
  const base = path.basename(filePath, ".jsonl");
  const parts = base.split("-");
  return parts.length >= 7 ? parts.slice(-5).join("-") : base;
}

function normalizeSource(source: unknown): string {
  if (typeof source === "string" && source.trim()) {
    return source.toLowerCase();
  }

  if (source && typeof source === "object" && "subagent" in source) {
    const subagent = (source as { subagent?: unknown }).subagent;
    return typeof subagent === "string" && subagent ? `subagent:${subagent}` : "subagent";
  }

  return "unknown";
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nearestModel(models: ModelEvent[], ts: number): string {
  let activeModel = "unknown";
  for (const model of models) {
    if (model.ts <= ts) {
      activeModel = model.model;
      continue;
    }

    break;
  }
  return activeModel;
}

function makeEventId(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function makePromptId(parts: string[]): string {
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
      return record.type === "input_text" && typeof record.text === "string" ? [record.text] : [];
    })
    .join("\n")
    .trim();

  return text ? text : null;
}

function buildEventsFromTokenCounts(
  sessionId: string,
  provider: string,
  source: string,
  models: ModelEvent[],
  tokenEvents: TokenEvent[]
): RawUsageEvent[] {
  const output: RawUsageEvent[] = [];
  let previous = {
    total: 0,
    input: 0,
    output: 0,
    cached: 0
  };

  for (const event of tokenEvents.sort((a, b) => a.ts - b.ts)) {
    if (event.total === null || event.total === previous.total) {
      continue;
    }

    const deltaTotal = event.total - previous.total;
    if (deltaTotal <= 0) {
      previous = {
        total: event.total,
        input: event.totalInput ?? previous.input,
        output: event.totalOutput ?? previous.output,
        cached: event.totalCached ?? previous.cached
      };
      continue;
    }

    const derivedInput = event.totalInput === null ? null : Math.max(0, event.totalInput - previous.input);
    const derivedOutput = event.totalOutput === null ? null : Math.max(0, event.totalOutput - previous.output);
    const derivedCached = event.totalCached === null ? null : Math.max(0, event.totalCached - previous.cached);

    const inputTokens = event.lastInput ?? derivedInput;
    const outputTokens = event.lastOutput ?? derivedOutput;
    const cachedInputTokens = event.lastCached ?? derivedCached;
    const splitSource =
      event.lastInput !== null && event.lastOutput !== null && event.lastCached !== null
        ? "last_usage"
        : inputTokens !== null && outputTokens !== null && cachedInputTokens !== null
          ? "derived_totals"
          : "missing";
    const model = nearestModel(models, event.ts);

    output.push({
      id: makeEventId([
        sessionId,
        String(event.ts),
        String(deltaTotal),
        String(inputTokens),
        String(outputTokens),
        String(cachedInputTokens),
        splitSource
      ]),
      sessionId,
      ts: event.ts,
      provider,
      model,
      source,
      totalTokens: deltaTotal,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      splitSource,
      transport: "session"
    });

    previous = {
      total: event.total,
      input: event.totalInput ?? previous.input,
      output: event.totalOutput ?? previous.output,
      cached: event.totalCached ?? previous.cached
    };
  }

  return output;
}

function buildEventsFromTuiFallback(
  sessionId: string,
  provider: string,
  source: string,
  models: ModelEvent[],
  fallbackPoints: TuiFallbackPoint[]
): RawUsageEvent[] {
  const output: RawUsageEvent[] = [];
  let previousTotal = 0;

  for (const point of fallbackPoints.sort((a, b) => a.ts - b.ts)) {
    if (point.total === previousTotal) {
      continue;
    }

    const deltaTotal = point.total - previousTotal;
    previousTotal = point.total;
    if (deltaTotal <= 0) {
      continue;
    }

    output.push({
      id: makeEventId([sessionId, String(point.ts), String(deltaTotal), "tui_fallback"]),
      sessionId,
      ts: point.ts,
      provider,
      model: nearestModel(models, point.ts),
      source,
      totalTokens: deltaTotal,
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      splitSource: "missing",
      transport: "tui_fallback"
    });
  }

  return output;
}

export function parseTuiFallback(logPath: string): TuiFallbackMap {
  const map: TuiFallbackMap = new Map();
  if (!fs.existsSync(logPath)) {
    return map;
  }

  const regex = /^(\S+)\s+.*thread_id=([^\s]+).*total_usage_tokens=(\d+)/;
  const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(regex);
    if (!match) {
      continue;
    }

    const [, rawTs, sessionId, rawTotal] = match;
    if (!rawTs || !sessionId || !rawTotal) {
      continue;
    }
    const ts = parseTimestamp(rawTs);
    const total = Number.parseInt(rawTotal, 10);
    if (ts === null || !Number.isFinite(total)) {
      continue;
    }

    const existing = map.get(sessionId) ?? [];
    existing.push({ ts, total });
    map.set(sessionId, existing);
  }

  for (const value of map.values()) {
    value.sort((a, b) => a.ts - b.ts);
  }

  return map;
}

export function parseSessionFile(filePath: string, fallbackMap: TuiFallbackMap): RawUsageEvent[] {
  const models: ModelEvent[] = [];
  const tokenEvents: TokenEvent[] = [];

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let sessionId = filenameSessionId(filePath);
  let provider = "unknown";
  let source = "unknown";

  for (const line of lines) {
    let row: {
      timestamp?: unknown;
      type?: string;
      payload?: {
        id?: string;
        model_provider?: string;
        source?: unknown;
        model?: string;
        type?: string;
        info?: {
          total_token_usage?: {
            total_tokens?: number;
            input_tokens?: number;
            output_tokens?: number;
            cached_input_tokens?: number;
          };
          last_token_usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cached_input_tokens?: number;
          };
        };
      };
    };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      continue;
    }
    const ts = parseTimestamp(row.timestamp) ?? 0;

    if (row.type === "session_meta" && row.payload) {
      sessionId = typeof row.payload.id === "string" && row.payload.id ? row.payload.id : sessionId;
      provider = typeof row.payload.model_provider === "string" ? row.payload.model_provider.toLowerCase() : provider;
      source = normalizeSource(row.payload.source);
      continue;
    }

    if (row.type === "turn_context" && typeof row.payload?.model === "string") {
      models.push({ ts, model: row.payload.model });
      continue;
    }

    if (row.type === "event_msg" && row.payload?.type === "token_count") {
      tokenEvents.push({
        ts,
        total: toFiniteNumber(row.payload.info?.total_token_usage?.total_tokens),
        totalInput: toFiniteNumber(row.payload.info?.total_token_usage?.input_tokens),
        totalOutput: toFiniteNumber(row.payload.info?.total_token_usage?.output_tokens),
        totalCached: toFiniteNumber(row.payload.info?.total_token_usage?.cached_input_tokens),
        lastInput: toFiniteNumber(row.payload.info?.last_token_usage?.input_tokens),
        lastOutput: toFiniteNumber(row.payload.info?.last_token_usage?.output_tokens),
        lastCached: toFiniteNumber(row.payload.info?.last_token_usage?.cached_input_tokens)
      });
    }
  }

  const usableSessionEvents = buildEventsFromTokenCounts(sessionId, provider, source, models, tokenEvents);
  if (usableSessionEvents.length > 0) {
    return usableSessionEvents;
  }

  return buildEventsFromTuiFallback(sessionId, provider, source, models, fallbackMap.get(sessionId) ?? []);
}

export function parseSessionPrompts(filePath: string): PromptRecord[] {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  let sessionId = filenameSessionId(filePath);
  const responsePrompts: PromptRecord[] = [];
  const eventPrompts: PromptRecord[] = [];

  for (const line of lines) {
    let row: {
      timestamp?: unknown;
      type?: string;
      payload?: {
        id?: string;
        type?: string;
        role?: string;
        content?: unknown;
        message?: string;
      };
    };

    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      continue;
    }

    const ts = parseTimestamp(row.timestamp);
    if (row.type === "session_meta" && typeof row.payload?.id === "string" && row.payload.id) {
      sessionId = row.payload.id;
      continue;
    }

    if (ts === null) {
      continue;
    }

    if (row.type === "event_msg" && row.payload?.type === "user_message") {
      const text = normalizePromptText(row.payload.message);
      if (!text) {
        continue;
      }

      eventPrompts.push({
        id: makePromptId([sessionId, "event", String(ts), text]),
        sessionId,
        ts,
        previewText: text
      });
      continue;
    }

    if (row.type === "response_item" && row.payload?.type === "message" && row.payload.role === "user") {
      const text = normalizePromptText(row.payload.content);
      if (!text || text.startsWith("# AGENTS.md instructions for ") || text.startsWith("<environment_context>")) {
        continue;
      }

      responsePrompts.push({
        id: makePromptId([sessionId, "response", String(ts), text]),
        sessionId,
        ts,
        previewText: text
      });
    }
  }

  const prompts = eventPrompts.length > 0 ? eventPrompts : responsePrompts;
  const deduped = new Map<string, PromptRecord>();
  for (const prompt of prompts) {
    if (!deduped.has(prompt.id)) {
      deduped.set(prompt.id, prompt);
    }
  }

  return [...deduped.values()].sort((a, b) => a.ts - b.ts);
}
