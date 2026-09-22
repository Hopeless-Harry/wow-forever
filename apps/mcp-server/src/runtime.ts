import { readFile } from "node:fs/promises";
import path from "node:path";

async function isProjectRoot(candidate: string): Promise<boolean> {
  try {
    const value = JSON.parse(await readFile(path.join(candidate, "package.json"), "utf8")) as { name?: unknown };
    return value.name === "wow-forever-platform";
  } catch {
    return false;
  }
}

export async function findProjectRoot(startPath: string): Promise<string> {
  const configured = process.env.WOW_FOREVER_PROJECT_ROOT;
  if (configured) {
    const resolved = path.resolve(configured);
    if (await isProjectRoot(resolved)) return resolved;
    throw new Error(`Configured WoW Forever project root is invalid: ${resolved}`);
  }

  let current = path.resolve(startPath);
  while (true) {
    if (await isProjectRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not find the WoW Forever project root from ${startPath}`);
}

