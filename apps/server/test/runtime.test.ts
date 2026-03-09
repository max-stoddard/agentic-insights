import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCacheDir, createCodexHome, writeJsonlFile } from "./helpers.js";

let previousCodexHome: string | undefined;
let previousCacheDir: string | undefined;
const cleanupDirs: string[] = [];

beforeEach(() => {
  previousCodexHome = process.env.CODEX_HOME;
  previousCacheDir = process.env.AI_WATER_USAGE_CACHE_DIR;
});

afterEach(() => {
  if (previousCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = previousCodexHome;
  }

  if (previousCacheDir === undefined) {
    delete process.env.AI_WATER_USAGE_CACHE_DIR;
  } else {
    process.env.AI_WATER_USAGE_CACHE_DIR = previousCacheDir;
  }

  for (const dir of cleanupDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createWebDist(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-water-web-"));
  cleanupDirs.push(dir);

  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html><body><div id=\"root\"></div></body></html>");
  fs.writeFileSync(path.join(dir, "assets", "app.js"), "console.log('ai-water-usage');");

  return dir;
}

describe("server runtime", () => {
  it("serves the bundled web shell when a web dist directory is configured", async () => {
    const app = createApp({ webDistDir: createWebDist() });

    const indexResponse = await app.inject({ method: "GET", url: "/" });
    expect(indexResponse.statusCode).toBe(200);
    expect(indexResponse.headers["content-type"]).toContain("text/html");
    expect(indexResponse.body).toContain("<div id=\"root\"></div>");

    const assetResponse = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(assetResponse.statusCode).toBe(200);
    expect(assetResponse.headers["content-type"]).toContain("text/javascript");
    expect(assetResponse.body).toContain("ai-water-usage");

    const fallbackResponse = await app.inject({ method: "GET", url: "/methodology" });
    expect(fallbackResponse.statusCode).toBe(200);
    expect(fallbackResponse.body).toContain("<div id=\"root\"></div>");

    await app.close();
  });

  it("reports ready diagnostics when parsed Codex usage is available", async () => {
    const codex = createCodexHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    process.env.AI_WATER_USAGE_CACHE_DIR = cache.dir;

    writeJsonlFile(codex.dir, "sessions/2026/03/09/session-openai.jsonl", [
      {
        timestamp: "2026-03-09T10:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-openai",
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

    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/api/overview" });
    const overview = response.json<{ diagnostics: { codexHome: string; message: string | null; state: string } }>();

    expect(overview.diagnostics).toEqual({
      codexHome: codex.dir,
      message: null,
      state: "ready"
    });

    await app.close();
    codex.cleanup();
    cache.cleanup();
  });

  it("reports no_data diagnostics when the Codex home is empty", async () => {
    const codex = createCodexHome();
    const cache = createCacheDir();
    process.env.CODEX_HOME = codex.dir;
    process.env.AI_WATER_USAGE_CACHE_DIR = cache.dir;

    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/api/overview" });
    const overview = response.json<{ diagnostics: { codexHome: string; message: string; state: string } }>();

    expect(overview.diagnostics.codexHome).toBe(codex.dir);
    expect(overview.diagnostics.state).toBe("no_data");
    expect(overview.diagnostics.message).toMatch(/No Codex usage files/i);

    await app.close();
    codex.cleanup();
    cache.cleanup();
  });

  it("reports read_error diagnostics when the configured Codex home is missing", async () => {
    const missingDir = path.join(os.tmpdir(), `ai-water-missing-${Date.now()}`);
    const cache = createCacheDir();
    process.env.CODEX_HOME = missingDir;
    process.env.AI_WATER_USAGE_CACHE_DIR = cache.dir;

    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/api/overview" });
    const overview = response.json<{ diagnostics: { codexHome: string; message: string; state: string } }>();

    expect(overview.diagnostics).toEqual({
      codexHome: missingDir,
      message: "Configured Codex home does not exist.",
      state: "read_error"
    });

    await app.close();
    cache.cleanup();
  });
});
