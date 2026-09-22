import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { PUBLIC_FIELDS } from "../domain/normalize.js";

function safeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const keys = Object.keys(record).sort();
  const publicKeys = [...PUBLIC_FIELDS].sort();
  return keys.length === publicKeys.length && keys.every((key, index) => key === publicKeys[index]);
}

function validSnapshot(snapshot) {
  return Boolean(
    snapshot &&
    Array.isArray(snapshot.records) &&
    snapshot.records.every(safeRecord) &&
    !Number.isNaN(Date.parse(snapshot.fetchedAt)) &&
    Number.isInteger(snapshot.sourceRowCount) &&
    Number.isInteger(snapshot.rejectedRows)
  );
}

export class CacheStore {
  constructor(filePath, staleAfterMs) {
    this.filePath = filePath;
    this.staleAfterMs = staleAfterMs;
  }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      return validSnapshot(parsed) ? parsed : null;
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async write(snapshot) {
    if (!validSnapshot(snapshot)) throw new Error("Unsafe cache record or invalid snapshot");
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, this.filePath);
  }

  getStatus(snapshot, now = new Date()) {
    if (!snapshot) return "empty";
    const age = now.getTime() - Date.parse(snapshot.fetchedAt);
    return age >= this.staleAfterMs ? "stale" : "fresh";
  }
}
