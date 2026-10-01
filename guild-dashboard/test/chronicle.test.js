import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { ChronicleStore } from "../src/data/chronicle-store.js";
import { DataService } from "../src/data/data-service.js";
import { diffSnapshots } from "../src/domain/chronicle.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { buildStats } from "../src/domain/stats.js";
import { mapping, PRIVATE_MARKERS, sheetRows } from "./fixtures/sheet-rows.js";

const priest = { anonymousId: "Response #1", server: "Normal", race: "Undead", characterClass: "Priest", role: "Healer", profession1: "Tailoring", profession2: "Enchanting" };
const hunter = { anonymousId: "Response #2", server: "Normal", race: "Troll", characterClass: "Hunter", role: "DPS", profession1: "Skinning", profession2: "Leatherworking" };
const AT = "2026-09-22T12:00:00.000Z";

test("opens the census on the first ever sync", () => {
  assert.deepEqual(diffSnapshots(null, [priest], AT, { hasHistory: false }), [{ type: "census-opened", at: AT, count: 1 }]);
});

test("records joiners, leavers, milestones and leader changes", () => {
  const joined = diffSnapshots([priest], [priest, hunter], AT);
  assert.equal(joined.filter((e) => e.type === "joined").length, 1);
  assert.equal(joined.find((e) => e.type === "joined").entry.characterClass, "Hunter");
  assert.equal(joined.find((e) => e.type === "joined").entry.anonymousId, undefined);

  const departed = diffSnapshots([priest, hunter], [priest], AT);
  assert.deepEqual(departed.filter((e) => e.type === "departed"), [{ type: "departed", at: AT, count: 1 }]);

  const many = Array.from({ length: 5 }, () => priest);
  assert.ok(diffSnapshots([priest], many, AT).some((e) => e.type === "milestone" && e.count === 5));

  const leader = diffSnapshots([priest], [{ ...priest, characterClass: "Mage" }], AT);
  assert.ok(leader.some((e) => e.type === "leader-change" && e.category === "class" && e.to === "Mage"));
});

test("ignores unchanged syncs and renumbering", () => {
  assert.deepEqual(diffSnapshots([priest, hunter], [{ ...hunter, anonymousId: "Response #1" }, { ...priest, anonymousId: "Response #2" }], AT), []);
});

test("chronicle store persists only allowlisted events and caps history", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chronicle-"));
  const store = new ChronicleStore(path.join(dir, "chronicle.json"));
  assert.deepEqual(await store.read(), []);
  await store.write([
    { type: "milestone", at: AT, count: 5 },
    { type: "joined", at: AT, entry: { ...hunter, anonymousId: undefined, name: "SecretName#1234" } },
    { type: "bogus", at: AT }
  ]);
  const raw = await readFile(path.join(dir, "chronicle.json"), "utf8");
  assert.equal(raw.includes("SecretName#1234"), false);
  assert.equal((await store.read()).length, 1);
});

test("data service chronicles sync-to-sync changes and survives restarts", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chronicle-"));
  const chronicleStore = new ChronicleStore(path.join(dir, "chronicle.json"));
  let rows = sheetRows;
  let stored = null;
  const cacheStore = { read: async () => stored, write: async (v) => { stored = structuredClone(v); }, getStatus: () => "fresh" };
  const make = () => new DataService({ source: { fetchRows: async () => rows }, normalize: normalizeRows, mapping, cacheStore, chronicleStore, logger: { info() {}, error() {} } });

  const service = make();
  await service.start({ schedule: false });
  assert.deepEqual(service.snapshot().chronicle.map((e) => e.type), ["census-opened"]);

  rows = [...sheetRows.slice(0, 2), ["", "", "Normal", "Tauren", "Warrior", "Tank", "Mining", "Blacksmithing"]];
  rows[0] = sheetRows[0];
  await service.refresh();
  assert.ok(service.snapshot().chronicle.some((e) => e.type === "joined"));

  const restarted = make();
  await restarted.start({ schedule: false, immediate: false });
  assert.equal(restarted.snapshot().chronicle.length, service.snapshot().chronicle.length);
});

test("serves a private-marker-free Chronicles page", async (t) => {
  const normalized = normalizeRows(sheetRows, mapping);
  const chronicle = diffSnapshots([], normalized.records, AT);
  const snapshot = { ...normalized, stats: buildStats(normalized.records), chronicle, fetchedAt: AT, status: "fresh", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, logger: false });
  t.after(() => app.close());

  const response = await app.inject({ url: "/chronicles" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /The Chronicle/);
  assert.match(response.body, /Troll Hunter/);
  for (const marker of PRIVATE_MARKERS) assert.equal(response.body.includes(marker), false);

  const empty = buildApp({ dataService: { snapshot: () => ({ ...snapshot, chronicle: undefined }) }, logger: false });
  t.after(() => empty.close());
  assert.match((await empty.inject({ url: "/chronicles" })).body, /awaits its first page/);
});
