/* global Buffer, console, process, setTimeout */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-water-pack-"));
const requireFromHere = createRequire(import.meta.url);

let tarballPath = null;
let child = null;
let stdout = "";
let stderr = "";

function lastTarballName(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line && line.endsWith(".tgz")) {
      return line;
    }
  }

  throw new Error(`Could not determine tarball name from npm pack output:\n${output}`);
}

function createCodexHome(rootDir) {
  const codexHome = path.join(rootDir, "codex-home");
  fs.mkdirSync(path.join(codexHome, "sessions", "2026", "03", "09"), { recursive: true });
  fs.mkdirSync(path.join(codexHome, "archived_sessions"), { recursive: true });
  fs.mkdirSync(path.join(codexHome, "log"), { recursive: true });

  const rows = [
    {
      timestamp: "2026-03-09T10:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "smoke-openai",
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
  ];

  fs.writeFileSync(
    path.join(codexHome, "sessions", "2026", "03", "09", "smoke-openai.jsonl"),
    rows.map((row) => JSON.stringify(row)).join("\n")
  );

  return codexHome;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Expected a TCP address."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          statusCode: response.statusCode ?? 0
        });
      });
    });

    req.on("error", reject);
  });
}

function findPackageRoot(entryPath) {
  let current = path.dirname(entryPath);

  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Could not locate package root for ${entryPath}`);
}

function linkRuntimeDependencies(packageDir) {
  const cliPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "packages", "cli", "package.json"), "utf8"));
  const dependencyNames = Object.keys(cliPackage.dependencies ?? {});
  const resolutionPaths = [path.join(repoRoot, "apps", "server"), repoRoot];

  fs.mkdirSync(path.join(packageDir, "node_modules"), { recursive: true });

  for (const dependencyName of dependencyNames) {
    const resolvedEntry = requireFromHere.resolve(dependencyName, { paths: resolutionPaths });
    const installedPackageDir = findPackageRoot(resolvedEntry);
    const targetPath = path.join(packageDir, "node_modules", ...dependencyName.split("/"));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.symlinkSync(installedPackageDir, targetPath, "dir");
  }
}

async function waitForServer(url, onRunning) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      throw new Error(`Packed CLI exited early.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    try {
      const result = await request(url);
      if (result.statusCode === 200) {
        return onRunning(result.body);
      }
    } catch {
      // Keep polling until the deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${url}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
}

async function main() {
  const packOutput = execFileSync("npm", ["pack", "-w", "ai-water-usage", "--silent"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  tarballPath = path.join(repoRoot, lastTarballName(packOutput));

  const tarContents = execFileSync("tar", ["-tf", tarballPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(tarContents, /package\/dist\/index\.js/);
  assert.match(tarContents, /package\/dist\/runtime\/server\/app\.js/);
  assert.match(tarContents, /package\/dist\/runtime\/web\/index\.html/);

  const extractDir = path.join(tempRoot, "extract");
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("tar", ["-xf", tarballPath, "-C", extractDir], { cwd: repoRoot });

  const packageDir = path.join(extractDir, "package");
  linkRuntimeDependencies(packageDir);

  const codexHome = createCodexHome(tempRoot);
  const cacheDir = path.join(tempRoot, "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const port = await findFreePort();

  child = spawn(
    process.execPath,
    [path.join(packageDir, "dist", "index.js"), "--port", String(port), "--no-open", "--codex-home", codexHome],
    {
      cwd: packageDir,
      env: {
        ...process.env,
        AI_WATER_USAGE_CACHE_DIR: cacheDir
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  await waitForServer(`http://127.0.0.1:${port}/api/overview`, (body) => {
    const overview = JSON.parse(body);
    assert.equal(overview.diagnostics.state, "ready");
    assert.equal(overview.tokenTotals.totalTokens, 120);
  });

  await waitForServer(`http://127.0.0.1:${port}/`, (body) => {
    assert.match(body, /<div id="root"><\/div>/);
  });

  assert.match(stdout, new RegExp(`AI Water Usage is running at http://127\\.0\\.0\\.1:${port}`));
  assert.match(stdout, /Browser auto-open disabled\./);
}

try {
  await main();
  console.log("Pack smoke test passed.");
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
  }

  if (tarballPath) {
    fs.rmSync(tarballPath, { force: true });
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
}
