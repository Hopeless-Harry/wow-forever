import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildRaidPlan, professionDirectory, roleTargets } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";
import { comboWarning, factionOf, roleOf } from "../src/domain/wow-data.js";

const base = { server: "Normal", profession1: "Mining", profession2: "Blacksmithing" };
const records = [
  { anonymousId: "Response #1", race: "Orc", characterClass: "Warrior", role: "Tank", ...base },
  { anonymousId: "Response #2", race: "Troll", characterClass: "Shaman", role: "Healer", ...base },
  { anonymousId: "Response #3", race: "Human", characterClass: "Paladin", role: "Healer", ...base },
  { anonymousId: "Response #4", race: "Gnome", characterClass: "Mage", role: "Flexible / happy to fill", ...base }
];

test("scales role targets from the 40-player guide", () => {
  assert.deepEqual(roleTargets(40), { tank: 4, healer: 11, dps: 25 });
  const small = roleTargets(10);
  assert.equal(small.tank + small.healer + small.dps, 10);
  assert.ok(small.tank >= 1 && small.healer >= 2);
});

test("maps factions and roles, tolerating unknown values", () => {
  assert.equal(factionOf("Undead"), "Horde");
  assert.equal(factionOf("Night Elf"), "Alliance");
  assert.equal(factionOf("Skyborne Windshaper"), "Horde");
  assert.equal(factionOf("Skyborne High Order"), "Alliance");
  assert.equal(factionOf("Mystery"), "Unknown");
  assert.equal(roleOf("Flexible / happy to fill"), "flex");
  assert.equal(roleOf("DPS"), "dps");
});

test("flags impossible race and class combinations but allows the new ones", () => {
  assert.match(comboWarning("Tauren", "Mage"), /not a known/);
  assert.equal(comboWarning("Undead", "Paladin"), "");
  assert.equal(comboWarning("Orc", "Mage"), "");
  assert.equal(comboWarning("Skyborne Windshaper", "Mage"), "");
});

test("plans each faction separately with coverage status", () => {
  const plan = buildRaidPlan(records, 40);
  assert.deepEqual(plan.map((g) => g.faction), ["Horde", "Alliance"]);
  const horde = plan[0];
  assert.equal(horde.roles.find((r) => r.role === "tank").status, "short");
  assert.equal(horde.roles.find((r) => r.role === "dps").status, "missing");
  assert.equal(horde.utility.find((u) => u.label === "Warrior tank").status, "ready");
  assert.equal(horde.utility.find((u) => u.label === "Druid").status, "missing");
  assert.equal(plan[1].flex, 1);
});

test("builds a profession directory sorted by crafter count", () => {
  const members = [
    { name: "Bea", ...base, profession1: "Mining", profession2: "Mining" },
    { name: "Al", ...base, profession1: "Mining", profession2: "Tailoring" }
  ];
  const directory = professionDirectory(members);
  assert.equal(directory[0].profession, "Mining");
  assert.deepEqual(directory[0].crafters.map((m) => m.name), ["Al", "Bea"]);
  assert.equal(directory[0].crafters.length, 2);
});

test("serves raid planner and profession pages with safe defaults", async (t) => {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const memberData = { members: [{ name: "<i>Al</i>", server: "Normal", race: "Tauren", characterClass: "Mage", role: "DPS", profession1: "Mining", profession2: "Tailoring" }], events: [], fetchedAt: snapshot.fetchedAt };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false });
  t.after(() => app.close());

  const raid = await app.inject({ url: "/raid?size=20" });
  assert.equal(raid.statusCode, 200);
  assert.match(raid.body, /Horde muster/);
  assert.match(raid.body, /href="\/raid\?size=20" aria-current="page"/);
  assert.match((await app.inject({ url: "/raid?size=999" })).body, /href="\/raid\?size=40" aria-current="page"/);
  assert.equal((await app.inject({ url: "/raid?size=%3Cscript%3E" })).statusCode, 200);

  const professions = await app.inject({ url: "/members/professions" });
  assert.equal(professions.statusCode, 200);
  assert.equal(professions.body.includes("<i>Al"), false);
  assert.match(professions.body, /&lt;i&gt;Al/);

  const roster = await app.inject({ url: "/members" });
  assert.match(roster.body, /Tauren Mage is not a known WoW Forever combination/);
});

test("raid planner handles an empty roster", async (t) => {
  const snapshot = { records: [], stats: buildStats([]), status: "empty", fetchedAt: null, lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, logger: false });
  t.after(() => app.close());
  assert.equal((await app.inject({ url: "/raid" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/members/professions" })).statusCode, 200);
});

test("roster has search and filters, and statistics show the faction split", async (t) => {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const memberData = { members: [{ name: "Al#1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Tailoring" }], events: [], fetchedAt: snapshot.fetchedAt };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false });
  t.after(() => app.close());

  const roster = (await app.inject({ url: "/members" })).body;
  assert.match(roster, /<label>Search the roster<input type="search"/);
  assert.match(roster, /data-class="Warrior" data-role="Tank" data-server="Normal"/);
  assert.match(roster, /<table id="census-table"/);
  assert.match(roster, /\/assets\/responses\.js/);

  assert.match((await app.inject({ url: "/statistics" })).body, /Faction split/);
  assert.deepEqual(buildStats(records).distributions.faction.map((f) => [f.label, f.count]), [["Alliance", 2], ["Horde", 2]]);
});
