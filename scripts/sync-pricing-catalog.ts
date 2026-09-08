import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_PRICING_CATALOG } from "../apps/server/src/generated/pricing-catalog.js";
import {
  diffPricingCatalogs,
  type PricingCatalogDiffReport,
  validateSuspiciousApprovalRequest
} from "../apps/server/src/pricing-catalog-diff.js";
import {
  type GeneratedPricingCatalog,
  type PortkeyPricingFile,
  type PortkeyPricingFileIndexEntry,
  formatGeneratedPricingCatalogModule,
  transformPortkeyPricingCatalog
} from "../apps/server/src/pricing-catalog-transform.js";

const REPOSITORY_API_URL = "https://api.github.com/repos/Portkey-AI/models";
const RAW_REPOSITORY_URL = "https://raw.githubusercontent.com/Portkey-AI/models";
const DEFAULT_OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/server/src/generated/pricing-catalog.ts"
);
const RETRY_DELAYS_MS = [0, 500, 1_500];

interface GitHubCommitResponse {
  sha: string;
  commit: { committer: { date: string } };
}

interface SyncArguments {
  outputPath: string;
  reportPath: string | null;
  sourceRevision: string | null;
  approveSuspicious: boolean;
}

function parseArguments(argv: string[]): SyncArguments {
  const args: SyncArguments = {
    outputPath: DEFAULT_OUTPUT_PATH,
    reportPath: null,
    sourceRevision: null,
    approveSuspicious: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--approve-suspicious") {
      args.approveSuspicious = true;
      continue;
    }

    const next = argv[index + 1];
    if ((value === "--output" || value === "--report" || value === "--source-revision") && !next) {
      throw new Error(`Missing value for ${value}.`);
    }

    if (value === "--output") {
      args.outputPath = path.resolve(next!);
      index += 1;
    } else if (value === "--report") {
      args.reportPath = path.resolve(next!);
      index += 1;
    } else if (value === "--source-revision") {
      args.sourceRevision = next!;
      index += 1;
    } else {
      throw new Error(`Unknown pricing sync argument: ${value}`);
    }
  }

  validateSuspiciousApprovalRequest(args.approveSuspicious, args.sourceRevision);

  return args;
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let finalError: Error | null = null;

  for (const delayMs of RETRY_DELAYS_MS) {
    await wait(delayMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "agentic-insights-sync"
        }
      });
      if (response.ok) {
        return (await response.json()) as T;
      }

      finalError = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      finalError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw finalError ?? new Error(`Failed to fetch ${url}.`);
}

export async function fetchPortkeyPricingCatalog(requestedRevision: string | null): Promise<GeneratedPricingCatalog> {
  const commit = await fetchJson<GitHubCommitResponse>(
    `${REPOSITORY_API_URL}/commits/${encodeURIComponent(requestedRevision ?? "main")}`
  );
  if (requestedRevision && commit.sha.toLowerCase() !== requestedRevision.toLowerCase()) {
    throw new Error(`Portkey resolved ${requestedRevision} to unexpected commit ${commit.sha}.`);
  }

  const sourceRevision = commit.sha;
  const indexEntries = await fetchJson<PortkeyPricingFileIndexEntry[]>(
    `${REPOSITORY_API_URL}/contents/pricing?ref=${encodeURIComponent(sourceRevision)}`
  );
  const pricingEntries = indexEntries
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
    .map((entry) => ({
      ...entry,
      download_url: `${RAW_REPOSITORY_URL}/${sourceRevision}/${entry.path}`
    }));
  const pricingFiles = new Map<string, PortkeyPricingFile>();

  for (const entry of pricingEntries) {
    pricingFiles.set(entry.name, await fetchJson<PortkeyPricingFile>(entry.download_url));
  }

  if (pricingFiles.size !== pricingEntries.length) {
    throw new Error(`Downloaded ${pricingFiles.size} of ${pricingEntries.length} Portkey pricing files.`);
  }

  return transformPortkeyPricingCatalog(
    pricingEntries,
    pricingFiles,
    commit.commit.committer.date,
    sourceRevision
  );
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFailureReport(reportPath: string | null, error: unknown, requestedRevision: string | null) {
  if (!reportPath) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const report: Partial<PricingCatalogDiffReport> & { decision: "blocked"; error: string } = {
    sourceRevision: requestedRevision ?? "unresolved",
    decision: "blocked",
    fingerprint: "sync-failure",
    hardFailures: [message],
    suspiciousReasons: [],
    error: message
  };
  await writeJson(reportPath, report);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));

  try {
    const catalog = await fetchPortkeyPricingCatalog(args.sourceRevision);
    const firstOutput = formatGeneratedPricingCatalogModule(catalog);
    if (firstOutput !== formatGeneratedPricingCatalogModule(catalog)) {
      throw new Error("Pricing catalog generation was not deterministic.");
    }

    const report = diffPricingCatalogs(GENERATED_PRICING_CATALOG, catalog, {
      approveSuspicious: args.approveSuspicious
    });
    await fs.mkdir(path.dirname(args.outputPath), { recursive: true });
    await fs.writeFile(args.outputPath, firstOutput);
    if (args.reportPath) {
      await writeJson(args.reportPath, report);
    }

    process.stdout.write(
      `Prepared ${catalog.entries.length} pricing entries across ${catalog.providerSources.length} providers at ${catalog.metadata.sourceRevision}; decision=${report.decision}\n`
    );
  } catch (error) {
    await writeFailureReport(args.reportPath, error, args.sourceRevision);
    throw error;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
