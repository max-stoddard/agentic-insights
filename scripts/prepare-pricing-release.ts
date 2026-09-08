import fs from "node:fs/promises";
import path from "node:path";
import { preparePricingRelease } from "../apps/server/src/pricing-release-preparation.js";

function getRequiredArgument(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Missing required argument ${name}.`);
  }
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  const result = await preparePricingRelease({
    repoRoot: path.resolve(argv.includes("--repo-root") ? getRequiredArgument(argv, "--repo-root") : "."),
    candidatePath: path.resolve(getRequiredArgument(argv, "--candidate")),
    reportPath: path.resolve(getRequiredArgument(argv, "--report"))
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(result)
        .map(([key, value]) => `${key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)}=${value}\n`)
        .join("")
    );
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
