import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { DataService } from "../src/data/data-service.js";
import { MemberStore } from "../src/data/member-store.js";
import { diffMembers, normalizeMembers } from "../src/domain/members.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { mapping, PRIVATE_MARKERS, sheetRows } from "./fixtures/sheet-rows.js";

const NAME_HEADER = "What is your BattleTag and name?";
const quiet = { info() {}, error() {} };
const AT = "2026-09-22T12:00:00.000Z";

async function makeService(rowsRef) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "members-"));
  const memberStore = new MemberStore(path.join(dir, "members.json"));
  let stored = null;
  const cacheStore = { read: async () => stored, write: async (v) => { stored = structuredClone(v); }, getStatus: () => "fresh" };
  const service = new DataService({ source: { fetchRows: async () => rowsRef.rows }, normalize: normalizeRows, mapping, cacheStore, memberStore, normalizeMembers, nameHeader: NAME_HEADER, logger: quiet });
  return { service, dir };
}

test("normalizes named members and skips incomplete or unnamed rows", () => {
  const members = normalizeMembers(sheetRows, mapping, NAME_HEADER);
  assert.deepEqual(members.map((m) => m.name), ["SecretName#1234", "AnotherSecret#5678"]);
  assert.equal(members[0].characterClass, "Priest");
  assert.equal(members[0].comment, undefined);
  assert.equal(JSON.stringify(members).includes("guildmaster@example.com"), false);
  assert.throws(() => normalizeMembers([["x"]], mapping, NAME_HEADER), /Missing required sheet header for name/);
});

test("diffs members by name across syncs", () => {
  const a = { name: "Jakjak#1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Blacksmithing" };
  const b = { ...a, name: "Mira#2", characterClass: "Mage", role: "DPS" };
  const events = diffMembers([a, b], [{ ...a, characterClass: "Rogue" }, { ...b, name: "mira#2" }, { ...a, name: "New#3" }], AT);
  assert.ok(events.some((e) => e.type === "changed" && e.name === "Jakjak#1" && e.from === "Warrior" && e.to === "Rogue"));
  assert.ok(events.some((e) => e.type === "joined" && e.name === "New#3"));
  assert.equal(events.some((e) => e.name === "Mira#2"), false);
  assert.deepEqual(diffMembers([a, b], [a], AT).map((e) => [e.type, e.name]), [["left", "Mira#2"]]);
});

test("data service keeps named history privately and persists it with 0600 permissions", async () => {
  const ref = { rows: sheetRows };
  const { service, dir } = await makeService(ref);
  await service.refresh();
  assert.equal(service.memberSnapshot().members.length, 2);
  assert.equal(service.memberSnapshot().events[0].type, "baseline");
  assert.equal(JSON.stringify(service.snapshot()).includes("SecretName#1234"), false);

  ref.rows = [sheetRows[0], [...sheetRows[1].slice(0, 4), "Mage", ...sheetRows[1].slice(5)], sheetRows[2]];
  await service.refresh();
  assert.ok(service.memberSnapshot().events.some((e) => e.type === "changed" && e.name === "SecretName#1234" && e.to === "Mage"));
  assert.equal((await stat(path.join(dir, "members.json"))).mode & 0o777, 0o600);
});

test("roster and chronicle are public and show names but never private columns", async (t) => {
  const ref = { rows: sheetRows };
  const { service } = await makeService(ref);
  await service.refresh();
  ref.rows = [sheetRows[0], [...sheetRows[1].slice(0, 4), "Mage", ...sheetRows[1].slice(5)], sheetRows[2]];
  await service.refresh();
  const app = buildApp({ dataService: service, logger: false });
  t.after(() => app.close());

  const roster = await app.inject({ url: "/members" });
  assert.equal(roster.statusCode, 200);
  assert.match(roster.body, /SecretName#1234/);
  assert.match(roster.body, /AnotherSecret#5678/);
  const chronicle = await app.inject({ url: "/members/chronicle" });
  assert.match(chronicle.body, /SecretName#1234<\/strong> changed class from Priest to Mage/);

  for (const url of ["/", "/responses", "/statistics", "/members", "/members/chronicle", "/api/public-data"]) {
    const body = (await app.inject({ url })).body;
    for (const marker of PRIVATE_MARKERS.filter((m) => m !== "SecretName#1234")) {
      assert.equal(body.includes(marker), false, `${url} leaked ${marker}`);
    }
  }
});

test("escapes member names before rendering", async (t) => {
  const memberData = { members: [{ name: "<script>x</script>", server: "Normal", race: "Orc", characterClass: "Mage", role: "DPS", profession1: "A", profession2: "B" }], events: [{ type: "left", at: AT, name: "<b>gone</b>" }], fetchedAt: AT };
  const snapshot = { records: [], stats: { totalResponses: 0 }, status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false });
  t.after(() => app.close());
  const roster = (await app.inject({ url: "/members" })).body;
  const history = (await app.inject({ url: "/members/chronicle" })).body;
  assert.equal(roster.includes("<script>x"), false);
  assert.match(roster, /&lt;script&gt;x/);
  assert.equal(history.includes("<b>gone"), false);
});
