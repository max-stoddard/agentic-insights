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

    expect(rootPackage.version).toBe("0.1.1");
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
    expect(fs.readFileSync(releaseNotesPath, "utf8")).toContain("fixes the published CLI manifest");
  });

  it("publishes the CLI under the expected npm package and GitHub repository", () => {
    const rootPackage = readJson("package.json");
    const cliPackage = readJson("packages/cli/package.json");

    expect(rootPackage.name).toBe("agentic-insights-workspace");
    expect(rootPackage.scripts.build).toContain("-w agentic-insights");
    expect(rootPackage.scripts.test).toContain("-w agentic-insights");
    expect(rootPackage.scripts.lint).toContain("-w agentic-insights");
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
    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("tag_name:");
    expect(releaseWorkflow).toContain("TAG_NAME:");
    expect(releaseWorkflow).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(releaseWorkflow).toContain("ref: ${{ env.TAG_NAME }}");
    expect(releaseWorkflow).toContain("npm config delete always-auth --location=user || true");
    expect(releaseWorkflow).toContain("env.NPM_TOKEN != ''");
    expect(releaseWorkflow).toContain("env.NPM_TOKEN == ''");
    expect(releaseWorkflow).toContain("NODE_AUTH_TOKEN: ${{ env.NPM_TOKEN }}");
    expect(releaseWorkflow).toContain("npm publish -w agentic-insights --access public --provenance");
    expect(releaseWorkflow).toContain("node ./packages/cli/scripts/prepare-github-package.mjs");
    expect(releaseWorkflow).toContain("npm publish ./packages/cli/.github-package");
    expect(releaseWorkflow).toContain("https://npm.pkg.github.com");
    expect(releaseWorkflow).toContain("tag_name: ${{ env.TAG_NAME }}");
    expect(releaseWorkflow).toContain("softprops/action-gh-release@v2");
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
