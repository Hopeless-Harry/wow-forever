import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipFile } from "yazl";

export interface AddonPackageResult {
  addonName: string;
  archivePath: string;
  entries: string[];
}

interface PackageOptions {
  repoRoot: string;
  outputRoot?: string;
}

const ARCHIVE_DATE = new Date("1980-01-01T00:00:00.000Z");

async function writeArchive(archivePath: string, entries: Array<{ name: string; data: Buffer }>): Promise<void> {
  const zip = new ZipFile();
  for (const entry of entries) {
    zip.addBuffer(entry.data, entry.name, { mtime: ARCHIVE_DATE, mode: 0o100644 });
  }
  zip.end();
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject);
    zip.outputStream.pipe(output);
  });
}

export async function packageAddons(options: PackageOptions): Promise<AddonPackageResult[]> {
  const addonsRoot = path.join(options.repoRoot, "addons");
  const outputRoot = options.outputRoot ?? path.join(options.repoRoot, "dist", "addons");
  await mkdir(outputRoot, { recursive: true });
  const addonFolders = (await readdir(addonsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const results: AddonPackageResult[] = [];

  for (const addonName of addonFolders) {
    const addonRoot = path.join(addonsRoot, addonName);
    const allowedFiles = (await readdir(addonRoot))
      .filter((name) => [".lua", ".toc", ".xml", ".md"].includes(path.extname(name).toLowerCase()))
      .sort();
    if (!allowedFiles.includes(`${addonName}.toc`)) continue;
    const entries = await Promise.all(allowedFiles.map(async (name) => ({
      name: `${addonName}/${name}`,
      data: await readFile(path.join(addonRoot, name)),
    })));
    const archivePath = path.join(outputRoot, `${addonName}.zip`);
    await writeArchive(archivePath, entries);
    results.push({ addonName, archivePath, entries: entries.map((entry) => entry.name) });
  }
  return results;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const results = await packageAddons({ repoRoot: process.cwd() });
  for (const result of results) console.log(`Packaged ${result.addonName}: ${result.archivePath}`);
}
