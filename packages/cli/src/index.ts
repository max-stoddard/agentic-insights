#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CliArgumentError, getHelpText, parseCliArgs } from "./args.js";
import { openBrowser } from "./browser.js";
import { formatUrl, resolveBrowserHost, resolveCodexHome } from "./config.js";
import { findAvailablePort } from "./port.js";

interface RuntimeApp {
  close(): Promise<void>;
  listen(options: { host: string; port: number }): Promise<unknown>;
}

interface RuntimeModule {
  createApp(options?: { webDistDir?: string }): RuntimeApp;
}

function getRuntimeDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "runtime");
}

async function loadRuntimeModule(): Promise<RuntimeModule> {
  const runtimeModuleUrl = pathToFileURL(path.join(getRuntimeDir(), "server", "app.js")).href;
  return import(runtimeModuleUrl) as Promise<RuntimeModule>;
}

async function run(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.help) {
    console.log(getHelpText());
    return;
  }

  const codexHome = resolveCodexHome(options.codexHome, process.env.CODEX_HOME);
  process.env.CODEX_HOME = codexHome;

  const selectedPort = await findAvailablePort(options.host, options.preferredPort);
  const { createApp } = await loadRuntimeModule();
  const app = createApp({
    webDistDir: path.join(getRuntimeDir(), "web")
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`\nReceived ${signal}. Shutting down AI Water Usage...`);
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({ host: options.host, port: selectedPort });

  const browserHost = resolveBrowserHost(options.host);
  const url = formatUrl(browserHost, selectedPort);

  console.log(`AI Water Usage is running at ${url}`);
  console.log(`Reading Codex usage from ${codexHome}`);
  if (selectedPort !== options.preferredPort) {
    console.log(`Port ${options.preferredPort} was unavailable. Using ${selectedPort} instead.`);
  }

  if (options.openBrowser) {
    const opened = await openBrowser(url);
    if (!opened) {
      console.log("Could not open your browser automatically. Open the URL above manually.");
    }
  } else {
    console.log("Browser auto-open disabled.");
  }

  console.log("Press Ctrl+C to stop the local dashboard.");
}

run().catch((error: unknown) => {
  if (error instanceof CliArgumentError) {
    console.error(error.message);
    console.error("");
    console.error(getHelpText());
    process.exit(1);
  }

  const message = error instanceof Error ? error.message : "Unknown launcher error";
  console.error(`Failed to start AI Water Usage: ${message}`);
  process.exit(1);
});
