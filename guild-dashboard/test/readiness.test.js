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
