import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { membersToCsv } from "../src/domain/export.js";
import { buildStats } from "../src/domain/stats.js";
import { roleWarning } from "../src/domain/wow-data.js";

const member = (name, extra = {}) => ({ name, server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning", ...extra });
const AT = "2026-09-22T12:00:00.000Z";

function appWith(members, events = []) {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  return buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events, fetchedAt: AT }) }, logger: false });
}

test("flags only clear role and class impossibilities", () => {
  assert.match(roleWarning("Mage", "Tank"), /not normally a tank/);
  assert.match(roleWarning("Rogue", "Healer"), /not normally a healer/);
  assert.equal(roleWarning("Paladin", "Tank"), "");
  assert.equal(roleWarning("Druid", "Healer"), "");
  assert.equal(roleWarning("Mage", "DPS"), "");
  assert.equal(roleWarning("Mage", "Flexible / happy to fill"), "");
});

test("CSV export neutralises spreadsheet formulas and escapes quotes and commas", () => {
  const csv = membersToCsv([member("=HYPERLINK(\"x\")"), member("Bea, the \"Wise\"", { characterClass: "Mage", role: "DPS" })]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Name,Class,Role,Race,Faction,Ruleset,Profession 1,Profession 2");
  assert.ok(lines.some((line) => line.startsWith("\"'=HYPERLINK(\"\"x\"\")\"")) || lines.some((line) => line.startsWith("'=HYPERLINK")));
  assert.ok(lines.some((line) => line.startsWith('"Bea, the ""Wise"""')));
  assert.ok(!lines.some((line) => /^=/.test(line)));
});

test("serves the CSV download with attachment headers", async (t) => {
  const app = appWith([member("Al#1")]);
  t.after(() => app.close());
  const res = await app.inject({ url: "/members.csv" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/csv/);
  assert.match(res.headers["content-disposition"], /attachment; filename="guild-roster.csv"/);
  assert.match(res.body, /Al#1,Warrior,Tank,Orc,Horde,Normal,Mining,Skinning/);
});

test("member profile shows facts, flags and only that member's history", async (t) => {
  const events = [
    { type: "joined", at: AT, name: "Al#1", entry: { server: "Normal", race: "Orc", characterClass: "Mage", role: "Tank", profession1: "Mining", profession2: "Skinning" } },
    { type: "changed", at: AT, name: "Bea#2", field: "class", from: "Mage", to: "Priest" },
    { type: "changed", at: AT, name: "al#1", field: "role", from: "DPS", to: "Tank" }
  ];
  const app = appWith([member("Al#1", { characterClass: "Mage", role: "Tank" }), member("Bea#2")], events);
  t.after(() => app.close());

  const res = await app.inject({ url: `/member?name=${encodeURIComponent("AL#1")}` });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Mage is not normally a tank/);
  assert.match(res.body, /changed role from DPS to Tank/);
  assert.equal(res.body.includes("Bea#2"), false);

  const roster = (await app.inject({ url: "/members" })).body;
  assert.match(roster, /href="\/member\?name=Al%231"/);
});

test("unknown or hostile member names return a safe 404", async (t) => {
  const app = appWith([member("Al#1")]);
  t.after(() => app.close());
  const missing = await app.inject({ url: "/member?name=nobody" });
  assert.equal(missing.statusCode, 404);
  const hostile = await app.inject({ url: `/member?name=${encodeURIComponent("<script>alert(1)</script>")}` });
  assert.equal(hostile.statusCode, 404);
  assert.equal(hostile.body.includes("<script>alert"), false);
  assert.equal((await app.inject({ url: "/member" })).statusCode, 404);
});

test("dashboard shows recent activity only when there are real events", async (t) => {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" }];
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const make = (events) => buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events, fetchedAt: AT }) }, logger: false });

  const quiet = make([{ type: "baseline", at: AT, name: "3" }]);
  t.after(() => quiet.close());
  assert.equal((await quiet.inject({ url: "/" })).body.includes("Recent activity"), false);

  const busy = make([{ type: "left", at: AT, name: "<b>Gone</b>" }]);
  t.after(() => busy.close());
  const body = (await busy.inject({ url: "/" })).body;
  assert.match(body, /Recent activity/);
  assert.equal(body.includes("<b>Gone"), false);
});
