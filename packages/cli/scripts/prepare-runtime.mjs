import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageDir, "../..");
const packageDistDir = path.join(packageDir, "dist");
const runtimeDir = path.join(packageDistDir, "runtime");
const serverSourceDir = path.join(repoRoot, "apps", "server", "dist", "src");
const webSourceDir = path.join(repoRoot, "apps", "web", "dist");

function assertDirExists(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Expected build output at ${dirPath}`);
  }
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const dirent of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, dirent.name);
    const targetPath = path.join(targetDir, dirent.name);

    if (dirent.isDirectory()) {
      copyDir(sourcePath, targetPath);
      continue;
    }

    if (dirent.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

assertDirExists(packageDistDir);
assertDirExists(serverSourceDir);
assertDirExists(webSourceDir);

fs.rmSync(runtimeDir, { recursive: true, force: true });
copyDir(serverSourceDir, path.join(runtimeDir, "server"));
copyDir(webSourceDir, path.join(runtimeDir, "web"));
