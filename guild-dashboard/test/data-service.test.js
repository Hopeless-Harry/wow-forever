import assert from "node:assert/strict";
import test from "node:test";

import { DataService } from "../src/data/data-service.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { mapping, sheetRows } from "./fixtures/sheet-rows.js";

const quietLogger = { info() {}, error() {} };

function memoryCache(existing = null) {
  let stored = existing;
  return {
    read: async () => stored,
    write: async (value) => { stored = structuredClone(value); },
    getStatus: (value) => value ? "fresh" : "empty",
    current: () => stored
  };
}

test("refreshes, sanitizes, persists, and calculates statistics", async () => {
  const cacheStore = memoryCache();
  const service = new DataService({
    source: { fetchRows: async () => sheetRows },
    normalize: normalizeRows,
    mapping,
    cacheStore,
    now: () => new Date("2026-09-22T12:00:00.000Z"),
    logger: quietLogger
  });

  assert.equal(await service.refresh(), true);
  assert.equal(service.snapshot().stats.totalResponses, 2);
  assert.equal(cacheStore.current().records[0].anonymousId, "Response #1");
});

test("coalesces simultaneous refreshes", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = new DataService({
    source: { fetchRows: async () => { calls += 1; await pending; return sheetRows; } },
    normalize: normalizeRows,
    mapping,
    cacheStore: memoryCache(),
    logger: quietLogger
  });

  const first = service.refresh();
  const second = service.refresh();
  release();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(calls, 1);
});

test("continues serving cached data when Google fails", async () => {
  const cached = {
    records: [{ anonymousId: "Response #1", server: "Normal", race: "Undead", characterClass: "Priest", role: "Healer", profession1: "Tailoring", profession2: "Enchanting" }],
    fetchedAt: "2026-09-22T11:00:00.000Z",
    sourceRowCount: 1,
    rejectedRows: 0
  };
  const service = new DataService({
    source: { fetchRows: async () => { throw new Error("Google unavailable"); } },
    normalize: normalizeRows,
    mapping,
    cacheStore: memoryCache(cached),
    logger: quietLogger
  });

  await service.start({ schedule: false });
  assert.equal(await service.refresh(), false);
  assert.equal(service.snapshot().records.length, 1);
  assert.equal(service.snapshot().lastRefreshFailed, true);
});

test("rejects a malformed refresh without replacing the good cache", async () => {
  const cached = { records: [], fetchedAt: "2026-09-22T11:00:00.000Z", sourceRowCount: 0, rejectedRows: 0 };
  const cacheStore = memoryCache(cached);
  const service = new DataService({
    source: { fetchRows: async () => [["unexpected"]] },
    normalize: normalizeRows,
    mapping,
    cacheStore,
    logger: quietLogger
  });

  await service.start({ schedule: false });
  assert.equal(await service.refresh(), false);
  assert.deepEqual(cacheStore.current(), cached);
});
