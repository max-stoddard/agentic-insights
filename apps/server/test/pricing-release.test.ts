import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { PricingCatalogDiffReport } from "../src/pricing-catalog-diff.js";
import {
  formatPricingReleaseNotes,
  nextPatchVersion,
  preparePricingRelease
} from "../src/pricing-release-preparation.js";

const temporaryDirectories: string[] = [];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function report(): PricingCatalogDiffReport {
  return {
    sourceRevision: "0123456789abcdef0123456789abcdef01234567",
    generatedAt: "2026-08-25T06:17:00.000Z",
    monitoredProviders: ["openai"],
    decision: "safe",
    approvedSuspiciousChange: false,
    fingerprint: "fingerprint",
    hardFailures: [],
    suspiciousReasons: [],
    providerSummaries: [{ provider: "openai", added: 1, removed: 0, repriced: 1 }],
    changes: [
      { provider: "openai", model: "gpt-new", kind: "added", fields: [] },
      {
        provider: "openai",
        model: "gpt-existing",
        kind: "repriced",
        fields: [
          {
            field: "inputUsdPerMillion",
            before: 1,
            after: 1.1,
            percentageChange: 0.1
          }
        ]
      }
    ],
    totalCatalogChangeCount: 2
  };
}

function createReleaseFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-insights-release-"));
  temporaryDirectories.push(repoRoot);
  const manifests = [
    ["package.json", "agentic-insights-workspace", {}],
    ["apps/server/package.json", "@agentic-insights/server", { "@agentic-insights/shared": "0.2.0" }],
    ["apps/web/package.json", "@agentic-insights/web", { "@agentic-insights/shared": "0.2.0" }],
    ["packages/cli/package.json", "agentic-insights", {}],
    ["packages/shared/package.json", "@agentic-insights/shared", {}]
  ] as const;

  for (const [relativePath, name, dependencies] of manifests) {
    writeJson(path.join(repoRoot, relativePath), { name, version: "0.2.0", dependencies });
  }
  writeJson(path.join(repoRoot, "package-lock.json"), {
    name: "agentic-insights-workspace",
    version: "0.2.0",
    lockfileVersion: 3,
    packages: Object.fromEntries(
      manifests.map(([relativePath, name, dependencies]) => [
        relativePath === "package.json" ? "" : path.dirname(relativePath).replaceAll(path.sep, "/"),
        { name, version: "0.2.0", dependencies }
      ])
    )
  });
  const candidatePath = path.join(repoRoot, "candidate.ts");
  fs.writeFileSync(candidatePath, "export const candidate = true;\n");
  const reportPath = path.join(repoRoot, "report.json");
  writeJson(reportPath, report());

  return { repoRoot, candidatePath, reportPath };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("automated pricing release preparation", () => {
  it("increments stable patch versions", () => {
    expect(nextPatchVersion("0.2.0")).toBe("0.2.1");
    expect(() => nextPatchVersion("0.2.0-beta.1")).toThrow(/non-standard/);
  });

  it("updates every workspace, internal dependency, lock entry, catalog, and release note", async () => {
    const fixture = createReleaseFixture();
    const result = await preparePricingRelease(fixture);

    expect(result).toMatchObject({
      version: "0.2.1",
      tagName: "v0.2.1",
      branchName: "automation/pricing-v0.2.1",
      title: "chore [MS]: refresh model pricing for v0.2.1"
    });

    for (const relativePath of [
      "package.json",
      "apps/server/package.json",
      "apps/web/package.json",
      "packages/cli/package.json",
      "packages/shared/package.json"
    ]) {
      expect(JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, relativePath), "utf8")).version).toBe("0.2.1");
    }
    expect(JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, "apps/server/package.json"), "utf8")).dependencies).toEqual({
      "@agentic-insights/shared": "0.2.1"
    });
    const lock = JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, "package-lock.json"), "utf8"));
    expect(lock.version).toBe("0.2.1");
    expect(lock.packages["apps/web"].dependencies["@agentic-insights/shared"]).toBe("0.2.1");
    expect(fs.readFileSync(path.join(fixture.repoRoot, "apps/server/src/generated/pricing-catalog.ts"), "utf8")).toContain(
      "candidate = true"
    );
    expect(fs.readFileSync(result.releaseNotesPath, "utf8")).toContain("gpt-new");
  });

  it("rejects blocked reports", async () => {
    const fixture = createReleaseFixture();
    const blocked = { ...report(), decision: "blocked" };
    writeJson(fixture.reportPath, blocked);
    await expect(preparePricingRelease(fixture)).rejects.toThrow(/must be safe/);
  });

  it("formats auditable source and price changes", () => {
    const notes = formatPricingReleaseNotes("0.2.1", report());
    expect(notes).toContain("0123456789ab");
    expect(notes).toContain("input: $1 → $1.1");
  });
});
