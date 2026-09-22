import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import type { WowPaths } from "./config.js";

export interface AddonSummary {
  name: string;
  title: string;
  version: string;
  interfaceVersion: string;
}

function tocMetadata(text: string): Map<string, string> {
  const metadata = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^##\s*([^:]+):\s*(.*)$/u);
    if (match?.[1] && match[2] !== undefined) metadata.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return metadata;
}

export async function listAddons(paths: WowPaths): Promise<AddonSummary[]> {
  const entries = await readdir(paths.addons, { withFileTypes: true }).catch((): Dirent[] => []);
  const addons: AddonSummary[] = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const folder = path.join(paths.addons, entry.name);
    const files = await readdir(folder).catch((): string[] => []);
    const tocName = files.includes(`${entry.name}.toc`)
      ? `${entry.name}.toc`
      : files.filter((file) => file.toLowerCase().endsWith(".toc")).sort()[0];
    if (!tocName) continue;
    const metadata = tocMetadata(await readFile(path.join(folder, tocName), "utf8"));
    addons.push({
      name: entry.name,
      title: metadata.get("title") ?? entry.name,
      version: metadata.get("version") ?? "unknown",
      interfaceVersion: metadata.get("interface") ?? "unknown",
    });
  }
  return addons;
}
