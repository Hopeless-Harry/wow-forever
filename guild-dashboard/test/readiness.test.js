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
  assert.deepEqual(ten, { size: 10, ready: true, needs: [], flexHelp: 0 });

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

test("the dashboard puts the raid answer before the charts so it is not buried", async () => {
  const body = await dashboard([...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")]);
  const order = ["Responses received", "Can we raid?", "Class muster", "Guild summary for Discord", "Recent roster entries"].map((text) => body.indexOf(text));
  assert.ok(order.every((index) => index > 0), `all panels present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "panels appear in this order: headline numbers, raid readiness, charts, summary, recent entries");
});

const FLEX = "Flexible / happy to fill";

test("flexible players who could take a short role are counted as help, and ones who cannot are not", () => {
  const base = [...many(1, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")];
  const row = (extra) => raidReadiness([...base, ...extra])[0].sizes.find((item) => item.size === 10);

  assert.equal(row([rec(90, "Orc", "Warrior", FLEX), rec(91, "Orc", "Druid", FLEX)]).flexHelp, 2, "a Warrior and a Druid could both take the missing tank");
  assert.equal(row([rec(92, "Orc", "Mage", FLEX)]).flexHelp, 0, "a flexible Mage cannot tank, and tanks are the only gap");
  assert.deepEqual(row([rec(92, "Orc", "Mage", FLEX)]).needs, ["1 tank"]);
  assert.equal(row([]).flexHelp, 0, "no flexible players, no help");
});

test("a ready group has nothing to help with, and role-assigned players are never counted as flexible", () => {
  const full = [...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS"), rec(99, "Orc", "Warrior", FLEX)];
  const ten = raidReadiness(full)[0].sizes.find((item) => item.size === 10);
  assert.equal(ten.ready, true);
  assert.equal(ten.flexHelp, 0, "no shortage left to help with");
  const twenty = raidReadiness(full)[0].sizes.find((item) => item.size === 20);
  assert.equal(twenty.flexHelp, 1, "for a bigger raid the flexible Warrior could take a tank slot");
  assert.equal(raidReadiness([rec(1, "Orc", "Warrior", "Tank")])[0].sizes[0].flexHelp, 0);
});

test("help is counted within each ruleset row, using flexible players of that ruleset or happy with either", () => {
  const records = [
    { ...rec(1, "Orc", "Warrior", FLEX), server: "Normal" },
    { ...rec(2, "Orc", "Warrior", FLEX), server: "PvP" },
    { ...rec(3, "Orc", "Priest", "Healer"), server: "Normal" },
    { ...rec(4, "Orc", "Mage", "DPS"), server: "PvP" }
  ];
  const [normal, pvp] = raidReadiness(records);
  assert.deepEqual([normal.label, pvp.label], ["Horde · Normal", "Horde · PvP"]);
  assert.equal(normal.sizes[0].flexHelp, 1, "only the Normal Warrior");
  assert.equal(pvp.sizes[0].flexHelp, 1, "only the PvP Warrior");
});

test("the dashboard says how many flexible players could help, with singular wording, and omits it when none can", async () => {
  const base = [...many(1, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")];
  const two = await dashboard([...base, rec(90, "Orc", "Warrior", FLEX), rec(91, "Orc", "Druid", FLEX)]);
  assert.match(two, /Needs 1 tank<\/span><small class="flex-help">2 flexible players could help<\/small>/);
  const one = await dashboard([...base, rec(90, "Orc", "Warrior", FLEX)]);
  assert.match(one, /<small class="flex-help">1 flexible player could help<\/small>/);
  const none = await dashboard([...base, rec(92, "Orc", "Mage", FLEX)]);
  assert.match(none, /Needs 1 tank<\/span><\/td>/, "a flexible Mage cannot tank, so the 10-player cell offers no help");
  assert.match(none, /Needs [^<]*DPS<\/span><small class="flex-help">1 flexible player could help<\/small>/, "but for bigger raids the same Mage could add damage");
  const ready = await dashboard([...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS"), rec(99, "Orc", "Warrior", FLEX)]);
  assert.match(ready, /<span class="plan-badge">Ready<\/span><\/td>/);
});
