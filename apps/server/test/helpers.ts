import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME_ENV_KEYS = ["HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"] as const;

export interface TestCodexHome {
  dir: string;
  cleanup: () => void;
}

export interface TestClaudeHome {
  homeDir: string;
  claudeDir: string;
  cleanup: () => void;
}

export interface TestCacheDir {
  dir: string;
  cleanup: () => void;
}

export type HomeEnvSnapshot = Partial<Record<(typeof HOME_ENV_KEYS)[number], string>>;

export function createCodexHome(): TestCodexHome {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-insights-"));
  fs.mkdirSync(path.join(dir, "sessions", "2026", "03", "09"), { recursive: true });
  fs.mkdirSync(path.join(dir, "archived_sessions"), { recursive: true });
  fs.mkdirSync(path.join(dir, "log"), { recursive: true });
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

export function createCacheDir(): TestCacheDir {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-insights-cache-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

export function createClaudeHome(): TestClaudeHome {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-insights-home-"));
  const claudeDir = path.join(homeDir, ".claude");
  fs.mkdirSync(path.join(claudeDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, "usage-data", "session-meta"), { recursive: true });

  return {
    homeDir,
    claudeDir,
    cleanup: () => fs.rmSync(homeDir, { recursive: true, force: true })
  };
}

export function captureHomeEnv(): HomeEnvSnapshot {
  return Object.fromEntries(
    HOME_ENV_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    })
  ) as HomeEnvSnapshot;
}

export function restoreHomeEnv(snapshot: HomeEnvSnapshot): void {
  for (const key of HOME_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

export function setUserHomeEnv(homeDir: string): void {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;

  if (process.platform !== "win32") {
    return;
  }

  const resolvedHomeDir = path.resolve(homeDir);
  const parsed = path.parse(resolvedHomeDir);
  if (/^[A-Za-z]:\\$/.test(parsed.root)) {
    process.env.HOMEDRIVE = parsed.root.slice(0, 2);
    process.env.HOMEPATH = resolvedHomeDir.slice(2);
    return;
  }

  delete process.env.HOMEDRIVE;
  delete process.env.HOMEPATH;
}

export function writeJsonlFile(root: string, relativePath: string, rows: unknown[]): string {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, rows.map((row) => JSON.stringify(row)).join("\n"));
  return fullPath;
}

export function writeJsonFile(root: string, relativePath: string, value: unknown): string {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2));
  return fullPath;
}

export function writeTuiLog(root: string, content: string): void {
  fs.writeFileSync(path.join(root, "log", "codex-tui.log"), content);
}
