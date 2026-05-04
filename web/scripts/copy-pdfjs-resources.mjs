import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pdfjsDistDir = resolve(webRoot, "node_modules/pdfjs-dist");
const targetRootDir = resolve(webRoot, "../server/router/frontend/dist/pdfjs");
const resourceDirectories = ["cmaps", "iccs", "standard_fonts", "wasm"];

const copyDirectorySync = (sourceDirectory, targetDirectory) => {
  mkdirSync(targetDirectory, { recursive: true });
  for (const entryName of readdirSync(sourceDirectory)) {
    const sourcePath = resolve(sourceDirectory, entryName);
    const targetPath = resolve(targetDirectory, entryName);
    if (statSync(sourcePath).isDirectory()) {
      copyDirectorySync(sourcePath, targetPath);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
};

for (const resourceDirectory of resourceDirectories) {
  copyDirectorySync(resolve(pdfjsDistDir, resourceDirectory), resolve(targetRootDir, resourceDirectory));
}
