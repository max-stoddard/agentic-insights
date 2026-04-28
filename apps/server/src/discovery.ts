import fs from "node:fs";
import path from "node:path";
import type { FileRecord } from "./types.js";

function walkFiles(dirPath: string, extension: ".json" | ".jsonl", output: FileRecord[]): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      walkFiles(fullPath, extension, output);
      continue;
    }

    if (!dirent.isFile() || !fullPath.endsWith(extension)) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    output.push({
      path: fullPath,
      mtimeMs: Math.floor(stat.mtimeMs),
      size: stat.size
    });
  }
}

export function listSessionFiles(codexHome: string): FileRecord[] {
  const files: FileRecord[] = [];
  walkFiles(path.join(codexHome, "sessions"), ".jsonl", files);
  walkFiles(path.join(codexHome, "archived_sessions"), ".jsonl", files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function listCodexSessionIndexFiles(codexHome: string): FileRecord[] {
  const filePath = path.join(codexHome, "session_index.jsonl");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return [];
  }

  const stat = fs.statSync(filePath);
  return [
    {
      path: filePath,
      mtimeMs: Math.floor(stat.mtimeMs),
      size: stat.size
    }
  ];
}

export function listClaudeProjectFiles(claudeHome: string): FileRecord[] {
  const files: FileRecord[] = [];
  walkFiles(path.join(claudeHome, "projects"), ".jsonl", files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function listClaudeSessionMetaFiles(claudeHome: string): FileRecord[] {
  const files: FileRecord[] = [];
  walkFiles(path.join(claudeHome, "usage-data", "session-meta"), ".json", files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function listClaudeFacetFiles(claudeHome: string): FileRecord[] {
  const files: FileRecord[] = [];
  walkFiles(path.join(claudeHome, "usage-data", "facets"), ".json", files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function listGeminiSessionFiles(geminiHome: string): FileRecord[] {
  const files: FileRecord[] = [];
  const tmpDir = path.join(geminiHome, "tmp");

  if (fs.existsSync(tmpDir)) {
    for (const dirent of fs.readdirSync(tmpDir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        const chatsDir = path.join(tmpDir, dirent.name, "chats");
        walkFiles(chatsDir, ".json", files);
      }
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function getTuiLogPath(codexHome: string): string {
  return path.join(codexHome, "log", "codex-tui.log");
}
