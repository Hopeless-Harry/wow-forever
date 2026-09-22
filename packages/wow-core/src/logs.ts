import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { WowPaths } from "./config.js";

const ALLOWED_LOGS = new Set(["FrameXML.log", "Lua.log", "CombatLog.txt", "WoWCombatLog.txt"]);

export interface LogTail {
  name: string;
  exists: boolean;
  modifiedAt: string | null;
  lines: string[];
}

export async function readLogTail(paths: WowPaths, name: string, lineCount = 100): Promise<LogTail> {
  if (!ALLOWED_LOGS.has(name)) throw new Error(`Log is not allowed: ${name}`);
  const filePath = path.join(paths.logs, name);
  const count = Math.max(1, Math.min(500, Math.trunc(lineCount)));
  try {
    const [text, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    const lines = text.split(/\r?\n/u);
    if (lines.at(-1) === "") lines.pop();
    return { name, exists: true, modifiedAt: info.mtime.toISOString(), lines: lines.slice(-count) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { name, exists: false, modifiedAt: null, lines: [] };
    throw error;
  }
}

