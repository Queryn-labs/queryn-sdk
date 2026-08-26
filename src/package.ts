import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExtensionManifest } from "./index.js";
import { validateExtensionManifest } from "./index.js";

export interface PackedExtensionFile {
  path: string;
  sha256: string;
  content: string;
}

export interface PackedExtension {
  format: "queryn-extension-package/1";
  manifest: ExtensionManifest;
  files: PackedExtensionFile[];
  integrity: string;
}

export async function packExtension(sourceDirectory: string, outputPath: string): Promise<PackedExtension> {
  const manifestPath = path.join(sourceDirectory, "extension.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ExtensionManifest;
  const validation = validateExtensionManifest(manifest);
  if (!validation.valid) throw new Error(validation.issues.join("\n"));

  const relativeFiles = (await listPackageFiles(sourceDirectory)).sort();
  const files: PackedExtensionFile[] = [];
  for (const relativePath of relativeFiles) {
    const data = await readFile(path.join(sourceDirectory, relativePath));
    files.push({
      path: relativePath,
      sha256: createHash("sha256").update(data).digest("hex"),
      content: data.toString("base64")
    });
  }
  const integrity = createHash("sha256")
    .update(files.map((file) => `${file.path}:${file.sha256}`).join("\n"))
    .digest("hex");
  const packed: PackedExtension = { format: "queryn-extension-package/1", manifest, files, integrity };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(packed, null, 2)}\n`, "utf8");
  return packed;
}

async function listPackageFiles(rootPath: string, relativeDirectory = ""): Promise<string[]> {
  const entries = await readdir(path.join(rootPath, relativeDirectory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".queryn-package")) return [];
    const relativePath = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name);
    return entry.isDirectory() ? listPackageFiles(rootPath, relativePath) : [relativePath];
  }));
  return nested.flat();
}
