import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CacheStore } from "../src/data/cache-store.js";

const safeRecord = {
  anonymousId: "Response #1",
  server: "Normal",
  race: "Undead",
  characterClass: "Priest",
  role: "Healer",
  profession1: "Tailoring",
  profession2: "Enchanting"
};

test("writes and reads an allowlisted snapshot", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guild-ledger-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "cache.json");
  const store = new CacheStore(file, 600_000);
  const snapshot = { records: [safeRecord], fetchedAt: "2026-09-22T12:00:00.000Z", sourceRowCount: 1, rejectedRows: 0 };

  await store.write(snapshot);

  assert.deepEqual(await store.read(), snapshot);
  assert.equal((await readFile(file, "utf8")).includes("SecretName#1234"), false);
});

test("rejects records carrying a private or unknown field", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guild-ledger-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new CacheStore(path.join(directory, "cache.json"), 600_000);

  await assert.rejects(
    store.write({ records: [{ ...safeRecord, name: "SecretName#1234" }], fetchedAt: new Date().toISOString(), sourceRowCount: 1, rejectedRows: 0 }),
    /Unsafe cache record/
  );
});

test("reports empty, fresh, and stale cache states", () => {
  const store = new CacheStore("unused.json", 600_000);
  const now = new Date("2026-09-22T12:10:00.000Z");

  assert.equal(store.getStatus(null, now), "empty");
  assert.equal(store.getStatus({ fetchedAt: "2026-09-22T12:05:00.001Z" }, now), "fresh");
  assert.equal(store.getStatus({ fetchedAt: "2026-09-22T11:59:59.999Z" }, now), "stale");
});

test("returns null for missing or malformed cache files", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guild-ledger-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new CacheStore(path.join(directory, "cache.json"), 600_000);

  assert.equal(await store.read(), null);
});
