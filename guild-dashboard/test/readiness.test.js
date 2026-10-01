import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { raidReadiness } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";

const rec = (n, race, characterClass, role) => ({ anonymousId: `Response #${n}`, server: "Normal", race, characterClass, role, profession1: "Mining", profession2: "Skinning" });
const many = (count, race, characterClass, role) => Array.from({ length: count }, (_, i) => rec(i + 1, race, characterClass, role));

test("a faction is ready for a size only when every role target is met, and says what is missing otherwise", () => {
  const horde = [...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")];
  const [group] = raidReadiness(horde);
  assert.equal(group.faction, "Horde");
  assert.equal(group.total, 10);

  const ten = group.sizes.find((item) => item.size === 10);
  assert.deepEqual(ten, { size: 10, ready: true, needs: [] });

  const twenty = group.sizes.find((item) => item.size === 20);
  assert.equal(twenty.ready, false);
  assert.deepEqual(twenty.needs, ["3 healers", "7 DPS"]);

  const forty = group.sizes.find((item) => item.size === 40);
  assert.deepEqual(forty.needs, ["2 tanks", "8 healers", "20 DPS"]);
});

test("wording is singular for one and flexible players are not counted as a role", () => {
  const group = raidReadiness([rec(1, "Orc", "Warrior", "Tank"), rec(2, "Orc", "Warrior", "Tank"), rec(3, "Orc", "Priest", "Healer"), rec(4, "Orc", "Priest", "Healer"), rec(5, "Orc", "Hunter", "Flexible / happy to fill")])[0];
  const ten = group.sizes.find((item) => item.size === 10);
  assert.deepEqual(ten.needs, ["1 healer", "5 DPS"]);
});

test("factions are separate and an empty guild has no rows", () => {
  const groups = raidReadiness([...many(2, "Orc", "Warrior", "Tank"), ...many(2, "Human", "Paladin", "Tank")]);
  assert.deepEqual(groups.map((group) => group.faction), ["Horde", "Alliance"]);
  assert.deepEqual(raidReadiness([]), []);
});

async function dashboard(records) {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url: "/" })).body;
  await app.close();
  return body;
}

test("the dashboard shows a readiness table with a named table, a link to the planner and plain wording", async () => {
  const body = await dashboard([...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")]);
  assert.match(body, /Can we raid\?/);
  assert.match(body, /<table aria-label="Raid readiness by faction and raid size">/);
  assert.match(body, /<th scope="col">10-player<\/th><th scope="col">20-player<\/th><th scope="col">40-player<\/th>/);
  assert.match(body, /Horde<small>10 players<\/small>/);
  assert.match(body, /<td class="plan-ready"><span class="plan-badge">Ready<\/span><\/td>/);
  assert.match(body, /Needs 3 healers, 7 DPS/);
  assert.match(body, /href="\/raid"/);
  assert.ok(body.indexOf("Can we raid?") < body.indexOf("Guild summary for Discord"), "readiness comes before the summary");
});

test("one player reads as '1 player' and an empty guild shows no readiness panel", async () => {
  assert.match(await dashboard([rec(1, "Orc", "Warrior", "Tank")]), /Horde<small>1 player<\/small>/);
  assert.equal((await dashboard([])).includes("Can we raid?"), false);
});

const withServer = (record, server) => ({ ...record, server });

test("tanks and healers on one ruleset plus damage on another is not ready for anyone", () => {
  const split = [
    ...many(2, "Orc", "Warrior", "Tank").map((x) => withServer(x, "Normal")),
    ...many(3, "Troll", "Priest", "Healer").map((x) => withServer(x, "Normal")),
    ...many(5, "Undead", "Mage", "DPS").map((x) => withServer(x, "PvP"))
  ];
  const rows = raidReadiness(split);
  assert.deepEqual(rows.map((row) => row.label), ["Horde · Normal", "Horde · PvP"]);
  for (const row of rows) assert.equal(row.sizes.find((item) => item.size === 10).ready, false, row.label);
  assert.deepEqual(rows[0].sizes.find((item) => item.size === 10).needs, ["5 DPS"]);
  assert.deepEqual(rows[1].sizes.find((item) => item.size === 10).needs, ["2 tanks", "3 healers"]);
});

test("a ruleset with a full group is ready on its own row, and flexible-ruleset players count for every row", () => {
  const players = [
    ...many(2, "Orc", "Warrior", "Tank").map((x) => withServer(x, "Normal")),
    ...many(3, "Troll", "Priest", "Healer").map((x) => withServer(x, "Normal")),
    ...many(4, "Undead", "Mage", "DPS").map((x) => withServer(x, "Normal")),
    withServer(rec(99, "Orc", "Rogue", "DPS"), "Happy with either"),
    withServer(rec(100, "Orc", "Warrior", "Tank"), "PvP")
  ];
  const [normal, pvp] = raidReadiness(players);
  assert.equal(normal.label, "Horde · Normal");
  assert.equal(normal.total, 10, "9 Normal players plus the flexible one");
  assert.equal(normal.sizes.find((item) => item.size === 10).ready, true);
  assert.equal(pvp.label, "Horde · PvP");
  assert.equal(pvp.total, 2, "the PvP tank plus the flexible player");
  assert.equal(pvp.sizes.find((item) => item.size === 10).ready, false);
});

test("a single ruleset keeps the plain faction row, and factions never share a row", () => {
  const one = raidReadiness(many(3, "Orc", "Warrior", "Tank").map((x) => withServer(x, "Normal")));
  assert.deepEqual(one.map((row) => row.label), ["Horde"]);
  const mixed = raidReadiness([...many(2, "Orc", "Warrior", "Tank").map((x) => withServer(x, "Normal")), ...many(2, "Human", "Paladin", "Tank").map((x) => withServer(x, "PvP"))]);
  assert.deepEqual(mixed.map((row) => row.label), ["Horde", "Alliance"], "each faction has only one ruleset, so no split");
});

test("the dashboard labels each ruleset row so an officer sees which group is ready", async () => {
  const body = await dashboard([
    ...many(2, "Orc", "Warrior", "Tank").map((x) => withServer(x, "Normal")),
    ...many(3, "Troll", "Priest", "Healer").map((x) => withServer(x, "Normal")),
    ...many(5, "Undead", "Mage", "DPS").map((x) => withServer(x, "PvP"))
  ]);
  assert.match(body, /Horde · Normal<small>/);
  assert.match(body, /Horde · PvP<small>/);
  assert.equal(body.includes('<td class="plan-ready">'), false, "nothing is falsely ready");
});
