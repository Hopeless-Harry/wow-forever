import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { EVENT_TYPES, MAX_EVENTS } from "../domain/chronicle.js";

const ENTRY_FIELDS = ["server", "race", "characterClass", "role", "profession1", "profession2"];
const SHAPES = {
  "census-opened": ["type", "at", "count"],
  joined: ["type", "at", "entry"],
  departed: ["type", "at", "count"],
  "leader-change": ["type", "at", "category", "from", "to"],
  milestone: ["type", "at", "count"]
};

function sameKeys(object, keys) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;
  if (!EVENT_TYPES.includes(event.type) || !sameKeys(event, SHAPES[event.type])) return false;
  if (Number.isNaN(Date.parse(event.at))) return false;
  if ("count" in event && !Number.isInteger(event.count)) return false;
  if (event.type === "joined") {
    const entry = event.entry;
    return Boolean(entry) && typeof entry === "object" && sameKeys(entry, ENTRY_FIELDS) && ENTRY_FIELDS.every((field) => typeof entry[field] === "string");
  }
  if (event.type === "leader-change") {
    return typeof event.category === "string" && typeof event.from === "string" && typeof event.to === "string";
  }
  return true;
}

export class ChronicleStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(parsed.events) ? parsed.events.filter(safeEvent) : [];
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return [];
      throw error;
    }
  }

  async write(events) {
    const kept = events.filter(safeEvent).slice(-MAX_EVENTS);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify({ events: kept }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
    return kept;
  }
}
