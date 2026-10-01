import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildStats, classRoleMatrix } from "../src/domain/stats.js";

const rec = (n, characterClass, role, race = "Orc") => ({ anonymousId: `Response #${n}`, server: "Normal", race, characterClass, role, profession1: "Mining", profession2: "Skinning" });
const F = "Flexible / happy to fill";
const records = [
  rec(1, "Priest", "Healer"), rec(2, "Priest", "Healer"), rec(3, "Priest", "DPS"), rec(4, "Priest", F),
  rec(5, "Warrior", "Tank"), rec(6, "Warrior", "DPS"),
  rec(7, "Mage", "DPS")
];

test("the class by role matrix counts each class's roles, sorts by size and totals correctly", () => {
  const { rows, totals } = classRoleMatrix(records);
  assert.deepEqual(rows.map((row) => row.characterClass), ["Priest", "Warrior", "Mage"]);
  assert.deepEqual(rows[0], { characterClass: "Priest", tank: 0, healer: 2, dps: 1, flex: 1, total: 4 });
  assert.deepEqual(rows[1], { characterClass: "Warrior", tank: 1, healer: 0, dps: 1, flex: 0, total: 2 });
  assert.deepEqual(totals, { tank: 1, healer: 2, dps: 3, flex: 1, total: 7 });
  assert.equal(totals.total, rows.reduce((sum, row) => sum + row.total, 0));
});

test("ties sort alphabetically and an empty guild gives an empty matrix", () => {
  const { rows } = classRoleMatrix([rec(1, "Rogue", "DPS"), rec(2, "Druid", "Healer")]);
  assert.deepEqual(rows.map((row) => row.characterClass), ["Druid", "Rogue"]);
  assert.deepEqual(classRoleMatrix([]), { rows: [], totals: { tank: 0, healer: 0, dps: 0, flex: 0, total: 0 } });
});

test("the statistics page shows a named table with a total row, muted zeros and no names", async (t) => {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());
  const body = (await app.inject({ url: "/statistics" })).body;

  assert.match(body, /<h2>Class by role<\/h2>/);
  assert.match(body, /<table aria-label="Players by class and role">/);
  assert.match(body, /<th scope="col">Tank<\/th><th scope="col">Healer<\/th><th scope="col">DPS<\/th><th scope="col">Flexible<\/th><th scope="col">Total<\/th>/);
  assert.match(body, /<th scope="row"><span class="class-chip class-priest">Priest<\/span><\/th><td class="zero">0<\/td><td class="">2<\/td><td class="">1<\/td><td class="">1<\/td><td><strong>4<\/strong><\/td>/);
  assert.match(body, /<tfoot><tr><th scope="row">All classes<\/th><td>1<\/td><td>2<\/td><td>3<\/td><td>1<\/td><td><strong>7<\/strong><\/td>/);
  assert.ok(body.indexOf("Class by role") < body.indexOf("Profession demand"), "sits before profession demand");

  const empty = buildApp({ dataService: { snapshot: () => ({ ...snapshot, records: [], stats: buildStats([]) }) }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => empty.close());
  assert.equal((await empty.inject({ url: "/statistics" })).body.includes("Class by role"), false, "no table for an empty guild");
});
