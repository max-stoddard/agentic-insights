import fs from "node:fs/promises";
import path from "node:path";
import type { PricingCatalogDiffReport, PricingCatalogChange } from "./pricing-catalog-diff.js";

const WORKSPACE_MANIFESTS = [
  "package.json",
  "apps/server/package.json",
  "apps/web/package.json",
  "packages/cli/package.json",
  "packages/shared/package.json"
] as const;
const SHARED_CONSUMERS = ["apps/server/package.json", "apps/web/package.json"] as const;

interface JsonObject {
  [key: string]: unknown;
}

export interface PrepareReleaseOptions {
  repoRoot: string;
  candidatePath: string;
  reportPath: string;
}

export interface PreparedPricingRelease {
  version: string;
  tagName: string;
  branchName: string;
  title: string;
  releaseNotesPath: string;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function nextPatchVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Cannot automatically patch non-standard version ${version}.`);
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function formatPriceChange(change: PricingCatalogChange): string {
  if (change.kind === "added") {
    return `- Added \`${change.model}\``;
  }
  if (change.kind === "removed") {
    return `- Removed \`${change.model}\``;
  }

  const fields = change.fields
    .map((field) => `${field.field.replace("UsdPerMillion", "")}: $${field.before} → $${field.after}`)
    .join(", ");
  return `- Repriced \`${change.model}\` (${fields})`;
}

export function formatPricingReleaseNotes(version: string, report: PricingCatalogDiffReport): string {
  const sections = report.providerSummaries.map((summary) => {
    const providerChanges = report.changes.filter((change) => change.provider === summary.provider);
    return `## ${summary.provider}\n\n${providerChanges.map(formatPriceChange).join("\n")}`;
  });

  return `# Agentic Insights ${version}\n\nThis automated patch release refreshes the bundled Portkey MIT pricing catalog used for coding-agent impact estimates.\n\n- Portkey source revision: [\`${report.sourceRevision.slice(0, 12)}\`](https://github.com/Portkey-AI/models/commit/${report.sourceRevision})\n- Monitored providers: ${report.monitoredProviders.join(", ")}\n- Catalog changes bundled: ${report.totalCatalogChangeCount}\n\n${sections.join("\n\n")}\n`;
}

function getObject(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${name} to be an object.`);
  }
  return value as JsonObject;
}

export async function preparePricingRelease(options: PrepareReleaseOptions): Promise<PreparedPricingRelease> {
  const report = await readJson<PricingCatalogDiffReport>(options.reportPath);
  if (report.decision !== "safe") {
    throw new Error(`Pricing report decision must be safe, received ${report.decision}.`);
  }
  if (!/^[a-f0-9]{40,64}$/i.test(report.sourceRevision)) {
    throw new Error("Pricing report must identify an exact Portkey commit SHA.");
  }

  const rootManifestPath = path.join(options.repoRoot, "package.json");
  const rootManifest = await readJson<JsonObject>(rootManifestPath);
  const version = nextPatchVersion(String(rootManifest.version ?? ""));

  for (const relativePath of WORKSPACE_MANIFESTS) {
    const manifestPath = path.join(options.repoRoot, relativePath);
    const manifest = await readJson<JsonObject>(manifestPath);
    manifest.version = version;
    if (SHARED_CONSUMERS.includes(relativePath as (typeof SHARED_CONSUMERS)[number])) {
      getObject(manifest.dependencies, `${relativePath} dependencies`)["@agentic-insights/shared"] = version;
    }
    await writeJson(manifestPath, manifest);
  }

  const lockPath = path.join(options.repoRoot, "package-lock.json");
  const lock = await readJson<JsonObject>(lockPath);
  lock.version = version;
  const lockPackages = getObject(lock.packages, "package-lock packages");
  for (const relativePath of WORKSPACE_MANIFESTS) {
    const packageKey = relativePath === "package.json" ? "" : path.dirname(relativePath).replaceAll(path.sep, "/");
    const lockPackage = getObject(lockPackages[packageKey], `package-lock entry ${packageKey || "root"}`);
    lockPackage.version = version;
    if (SHARED_CONSUMERS.includes(relativePath as (typeof SHARED_CONSUMERS)[number])) {
      getObject(lockPackage.dependencies, `package-lock entry ${packageKey} dependencies`)[
        "@agentic-insights/shared"
      ] = version;
    }
  }
  await writeJson(lockPath, lock);

  const generatedPath = path.join(options.repoRoot, "apps/server/src/generated/pricing-catalog.ts");
  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.copyFile(options.candidatePath, generatedPath);
  const tagName = `v${version}`;
  const releaseNotesPath = path.join(options.repoRoot, ".github/release-notes", `${tagName}.md`);
  await fs.mkdir(path.dirname(releaseNotesPath), { recursive: true });
  await fs.writeFile(releaseNotesPath, formatPricingReleaseNotes(version, report));

  return {
    version,
    tagName,
    branchName: `automation/pricing-${tagName}`,
    title: `chore [MS]: refresh model pricing for ${tagName}`,
    releaseNotesPath
  };
}
