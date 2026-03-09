import os from "node:os";
import path from "node:path";

export function resolveCodexHome(cliValue: string | null, envValue: string | undefined): string {
  const selected = cliValue ?? envValue ?? path.join(os.homedir(), ".codex");
  return path.resolve(selected);
}

export function resolveBrowserHost(host: string): string {
  if (host === "0.0.0.0" || host === "::" || host === "[::]") {
    return "127.0.0.1";
  }

  return host;
}

export function formatUrl(host: string, port: number): string {
  const normalizedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${normalizedHost}:${port}`;
}
