import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { WowPaths } from "./config.js";
import { redactWowPath } from "./redact.js";

export interface SavedVariableSummary {
  path: string;
  bytes: number;
  modifiedAt: string;
}

async function walkForFile(root: string, fileName: string): Promise<string[]> {
  const matches: string[] = [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...await walkForFile(fullPath, fileName));
    else if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) matches.push(fullPath);
  }
  return matches;
}

export async function findSavedVariables(
  paths: WowPaths,
  addon: string,
): Promise<SavedVariableSummary[]> {
  if (!/^[A-Za-z0-9_-]+$/u.test(addon)) throw new Error(`Invalid addon name: ${addon}`);
  const matches = await walkForFile(paths.wtf, `${addon}.lua`);
  return Promise.all(matches.sort().map(async (filePath) => {
    const info = await stat(filePath);
    return {
      path: redactWowPath(filePath, paths.wtf),
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  }));
}

