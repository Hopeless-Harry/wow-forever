import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { groupPlan, placementsFor } from "../src/domain/groups.js";
import { buildStats } from "../src/domain/stats.js";

const m = (name, characterClass, role, race = "Orc", server = "Normal") => ({ name, server, race, characterClass, role, profession1: "Mining", profession2: "Skinning" });
const FLEX = "Flexible / happy to fill";

const members = [
  m("Thok", "Warrior", "Tank"), m("Brek", "Warrior", "Tank"),
  m("Mira", "Priest", "Healer", "Troll"), m("Una", "Priest", "Healer", "Tauren"), m("Pia", "Priest", "Healer", "Troll"),
  ...["Gruk", "Zed", "Lux", "Kor", "Vex"].map((name, i) => m(name, i % 2 ? "Rogue" : "Mage", "DPS", i % 2 ? "Orc" : "Undead")),
  m("Extra", "Mage", "DPS", "Undead")
];

test("a member is placed in a numbered group with their groupmates for each raid size", () => {
  const places = placementsFor(members, members.find((x) => x.name === "Thok"));
  assert.deepEqual(places.map((p) => p.size), [10, 20, 40]);
  const ten = places[0];
  assert.ok(ten.group >= 1 && ten.group <= 2, `group ${ten.group}`);
  assert.equal(ten.bench, false);
  assert.ok(ten.mates.length >= 1 && !ten.mates.includes("Thok"), "mates exclude the member themselves");
  assert.ok(ten.mates.every((name) => members.some((x) => x.name === name)));
});

const benched = (list, size = 10) => groupPlan(list, size)[0].bench[0];

test("a member who does not fit a small raid is on the bench, and found again in a bigger one", () => {
  const left = benched(members);
  assert.ok(left, "11 Horde players cannot all fit 10 slots");
  const places = placementsFor(members, left);
  assert.equal(places[0].group, null);
  assert.equal(places[0].bench, true);
  assert.equal(places[1].bench, false, "a 20-player raid has room");
  assert.ok(places[1].group >= 1);
});

test("the pool is the member's own ruleset plus players happy with either, never other rulesets", () => {
  const mixed = [
    m("Thok", "Warrior", "Tank", "Orc", "Normal"), m("Mira", "Priest", "Healer", "Troll", "Normal"),
    m("Zed", "Rogue", "DPS", "Orc", "PvP"), m("Una", "Priest", "Healer", "Tauren", "PvP"), m("Anyone", "Mage", "DPS", "Undead", "Happy with either")
  ];
  const thok = placementsFor(mixed, mixed[0])[0];
  assert.equal(thok.ruleset, "Normal");
  assert.ok(thok.mates.every((name) => ["Anyone", "Mira"].includes(name)), `only Normal or flexible players: ${thok.mates}`);
  assert.equal(thok.mates.some((name) => ["Zed", "Una"].includes(name)), false, "never the PvP players");
  const everyone = groupPlan(mixed.filter((x) => x.server === "Normal" || x.server === "Happy with either"), 10)[0].groups.flatMap((g) => g.members.map((x) => x.name));
  assert.deepEqual([...everyone].sort(), ["Anyone", "Mira", "Thok"], "the Normal pool is exactly those three");

  const anyone = placementsFor(mixed, mixed[4])[0];
  assert.equal(anyone.ruleset, "", "a flexible member is pooled with everyone");
  assert.ok(anyone.mates.length >= 1, "pooled with the Normal and PvP players alike");
  assert.equal(anyone.mates.every((name) => ["Thok", "Mira", "Zed", "Una"].includes(name)), true);
});

test("factions never share a group, a lone member is placed alone, and names match case-insensitively", () => {
  const sides = [m("Orcy", "Warrior", "Tank", "Orc"), m("Humy", "Paladin", "Tank", "Human")];
  assert.deepEqual(placementsFor(sides, sides[0])[0].mates, []);
  assert.equal(placementsFor(sides, sides[0])[0].group, 1);
  const lookalike = { ...sides[0], name: "ORCY" };
  assert.equal(placementsFor(sides, lookalike)[0].group, 1, "matched by lower-cased name");
});

async function profile(list, name) {
  const records = list.map((x, i) => ({ anonymousId: `Response #${i + 1}`, server: x.server, race: x.race, characterClass: x.characterClass, role: x.role, profession1: x.profession1, profession2: x.profession2 }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: list, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const res = await app.inject({ url: `/member?name=${encodeURIComponent(name)}` });
  await app.close();
  return res;
}

test("the profile shows the suggested spot per raid size, with linked groupmates and an honest caveat", async () => {
  const body = (await profile(members, "Thok")).body;
  assert.match(body, /<h2>Suggested raid spot<\/h2>/);
  assert.match(body, /only a suggestion; the raid leader decides the real groups/);
  assert.match(body, /<li><strong>10-player:<\/strong> Group \d with <a href="\/member\?name=[^"]+">[^<]+<\/a>/);
  assert.match(body, /<li><strong>20-player:<\/strong>/);
  assert.match(body, /<li><strong>40-player:<\/strong>/);
  assert.match(body, /among Normal players and anyone happy with either/);
  assert.match(body, /href="\/raid\?size=10&amp;ruleset=Normal">Open raid planner/);
  assert.ok(body.indexOf("Suggested raid spot") < body.indexOf("'s chronicle"), "sits between the facts and the history");
});

test("a bench spot, a solo member and hostile names read correctly and safely", async () => {
  assert.match((await profile(members, benched(members).name)).body, /<strong>10-player:<\/strong> On the bench for now/);
  assert.match((await profile([m("Solo", "Warrior", "Tank")], "Solo")).body, /Group 1, with nobody else yet/);

  const hostile = (await profile([m("<b>X</b>", "Warrior", "Tank"), m('"><img src=x>', "Priest", "Healer")], "<b>X</b>")).body;
  assert.equal(hostile.includes("<b>X"), false);
  assert.equal(hostile.includes("<img src=x>"), false);
  assert.match(hostile, /href="\/member\?name=%22%3E%3Cimg%20src%3Dx%3E"/, "groupmate links are encoded");

  const missing = await profile(members, "Nobody");
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.includes("Suggested raid spot"), false);
});
