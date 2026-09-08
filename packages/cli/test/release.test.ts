import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

describe("release metadata", () => {
  it("keeps workspace versions aligned", () => {
    const rootPackage = readJson("package.json");
    const cliPackage = readJson("packages/cli/package.json");
    const serverPackage = readJson("apps/server/package.json");
    const webPackage = readJson("apps/web/package.json");
    const sharedPackage = readJson("packages/shared/package.json");

    expect(rootPackage.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(cliPackage.version).toBe(rootPackage.version);
    expect(serverPackage.version).toBe(rootPackage.version);
    expect(webPackage.version).toBe(rootPackage.version);
    expect(sharedPackage.version).toBe(rootPackage.version);
    expect(serverPackage.dependencies["@agentic-insights/shared"]).toBe(rootPackage.version);
    expect(webPackage.dependencies["@agentic-insights/shared"]).toBe(rootPackage.version);
  });

  it("includes release notes for the current tag", () => {
    const cliPackage = readJson("packages/cli/package.json");
    const releaseNotesPath = path.join(repoRoot, ".github", "release-notes", `v${cliPackage.version}.md`);

    expect(fs.existsSync(releaseNotesPath)).toBe(true);
    expect(fs.readFileSync(releaseNotesPath, "utf8")).toContain(`# Agentic Insights ${cliPackage.version}`);
  });

  it("publishes the CLI under the expected npm package and GitHub repository", () => {
    const rootPackage = readJson("package.json");
    const cliPackage = readJson("packages/cli/package.json");

    expect(rootPackage.name).toBe("agentic-insights-workspace");
    expect(rootPackage.scripts.build).toContain("-w agentic-insights");
    expect(rootPackage.scripts.test).toContain("-w agentic-insights");
    expect(rootPackage.scripts.lint).toContain("-w agentic-insights");
    expect(rootPackage.scripts.lint).toContain("eslint scripts");
    expect(rootPackage.scripts["pack:cli"]).toBe("npm pack -w agentic-insights");

    expect(cliPackage.name).toBe("agentic-insights");
    expect(cliPackage.bin).toEqual({
      "agentic-insights": "dist/index.js"
    });
    expect(cliPackage.repository).toEqual({
      type: "git",
      url: "git+https://github.com/max-stoddard/agentic-insights.git",
      directory: "packages/cli"
    });
    expect(cliPackage.homepage).toBe("https://github.com/max-stoddard/agentic-insights#readme");
    expect(cliPackage.bugs.url).toBe("https://github.com/max-stoddard/agentic-insights/issues");
  });

  it("keeps release workflow wired to npm, GitHub Packages, and GitHub Releases", () => {
    const releaseWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(releaseWorkflow).toContain("packages: write");
    expect(releaseWorkflow).toContain("workflow_call:");
    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("tag_name:");
    expect(releaseWorkflow).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(releaseWorkflow).toContain("ref: ${{ inputs.tag_name }}");
    expect(releaseWorkflow).toContain("fetch-depth: 0");
    expect(releaseWorkflow).toContain("npm config delete always-auth --location=user || true");
    expect(releaseWorkflow).toContain("Check npm publish status");
    expect(releaseWorkflow).toContain('npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version --registry https://registry.npmjs.org');
    expect(releaseWorkflow).toContain("Check GitHub Packages publish status");
    expect(releaseWorkflow).toContain("env.NPM_TOKEN != ''");
    expect(releaseWorkflow).toContain("env.NPM_TOKEN == ''");
    expect(releaseWorkflow).toContain("steps.npm_status.outputs.exists != 'true'");
    expect(releaseWorkflow).toContain("steps.github_package_status.outputs.exists != 'true'");
    expect(releaseWorkflow).toContain("NODE_AUTH_TOKEN: ${{ env.NPM_TOKEN }}");
    expect(releaseWorkflow).toContain("npm publish -w agentic-insights --access public --provenance");
    expect(releaseWorkflow).toContain("node ./packages/cli/scripts/prepare-github-package.mjs");
    expect(releaseWorkflow).toContain("Set up Node.js for GitHub Packages");
    expect(releaseWorkflow).toContain('scope: "@max-stoddard"');
    expect(releaseWorkflow).toContain("npm publish ./packages/cli/.github-package");
    expect(releaseWorkflow).toContain("https://npm.pkg.github.com");
    expect(releaseWorkflow).toContain("tag_name: ${{ inputs.tag_name }}");
    expect(releaseWorkflow).toContain("softprops/action-gh-release@v2");
  });

  it("defines guarded daily pricing automation and exact-head release validation", () => {
    const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const syncWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "pricing-sync.yml"), "utf8");
    const pricingReleaseWorkflow = fs.readFileSync(
      path.join(repoRoot, ".github", "workflows", "pricing-release.yml"),
      "utf8"
    );
    const incidentReporter = fs.readFileSync(path.join(repoRoot, "scripts", "report-pricing-incident.mjs"), "utf8");
    const releasePreparation = fs.readFileSync(
      path.join(repoRoot, "apps", "server", "src", "pricing-release-preparation.ts"),
      "utf8"
    );

    expect(syncWorkflow).toContain('cron: "17 6 * * *"');
    expect(syncWorkflow).toContain("workflow_dispatch:");
    expect(syncWorkflow).toContain("source_revision:");
    expect(syncWorkflow).toContain("approve_suspicious:");
    expect(syncWorkflow).toContain("check_only:");
    expect(incidentReporter).toContain('const INCIDENT_LABEL = "pricing-sync-incident"');
    expect(syncWorkflow).toContain("gh workflow run pricing-release.yml --ref");
    expect(releasePreparation).toContain("chore [MS]: refresh model pricing");

    expect(pricingReleaseWorkflow).toContain("expected_head_sha:");
    expect(pricingReleaseWorkflow).toContain("ubuntu-latest");
    expect(pricingReleaseWorkflow).toContain("macos-latest");
    expect(pricingReleaseWorkflow).toContain("windows-latest");
    expect(pricingReleaseWorkflow).toContain("npm run test:pack");
    expect(pricingReleaseWorkflow).toContain("--match-head-commit");
    expect(pricingReleaseWorkflow).toContain("baseRefOid");
    expect(pricingReleaseWorkflow).toContain("Main changed after cross-platform validation");
    expect(pricingReleaseWorkflow).toContain("Required pricing release files are missing");
    expect(pricingReleaseWorkflow).toContain("Pricing PR is missing its automation label");
    expect(pricingReleaseWorkflow).toContain("uses: ./.github/workflows/release.yml");
    expect(pricingReleaseWorkflow).toContain("report-pricing-incident.mjs");
    expect(ciWorkflow).toContain("workflow-lint:");
    expect(ciWorkflow).toContain("actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz");
    expect(ciWorkflow).toContain("8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8");
  });

  it("defines the generated GitHub Packages mirror metadata", () => {
    const mirrorScript = fs.readFileSync(
      path.join(repoRoot, "packages", "cli", "scripts", "prepare-github-package.mjs"),
      "utf8"
    );

    expect(mirrorScript).toContain('name: "@max-stoddard/agentic-insights"');
    expect(mirrorScript).toContain('"agentic-insights": "dist/index.js"');
    expect(mirrorScript).toContain("https://npm.pkg.github.com");
  });
});
