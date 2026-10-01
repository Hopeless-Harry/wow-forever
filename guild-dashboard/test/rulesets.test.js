import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { groupPlan } from "../src/domain/groups.js";
import { buildStats } from "../src/domain/stats.js";
import { forRuleset, isFlexibleRuleset, rulesetOptions } from "../src/domain/wow-data.js";

const m = (name, characterClass, role, server) => ({ name, server, race: "Orc", characterClass, role, profession1: "Mining", profession2: "Skinning" });
const members = [m("A", "Warrior", "Tank", "Normal"), m("B", "Priest", "Healer", "PvP"), m("C", "Mage", "DPS", "Normal"), m("D", "Rogue", "DPS", "PvP"), m("E", "Hunter", "DPS", "Happy with either")];

test("flexible answers are recognised and never become a ruleset tab", () => {
  assert.equal(isFlexibleRuleset("Happy with either"), true);
  assert.equal(isFlexibleRuleset("Any is fine"), true);
  assert.equal(isFlexibleRuleset("Normal"), false);
  assert.equal(isFlexibleRuleset("PvP"), false);
  assert.deepEqual(rulesetOptions(members), ["Normal", "PvP"]);
  assert.deepEqual(rulesetOptions([m("X", "Mage", "DPS", "")]), []);
});

test("a chosen ruleset keeps its players plus flexible ones, and no choice keeps everyone", () => {
  assert.deepEqual(forRuleset(members, "Normal").map((x) => x.name), ["A", "C", "E"]);
  assert.deepEqual(forRuleset(members, "PvP").map((x) => x.name), ["B", "D", "E"]);
  assert.equal(forRuleset(members, "").length, 5);
  assert.deepEqual(forRuleset(members, "Hardcore").map((x) => x.name), ["E"], "a ruleset nobody chose leaves only flexible players");
});

test("groups built for a ruleset never mix rulesets", () => {
  for (const ruleset of ["Normal", "PvP"]) {
    const [horde] = groupPlan(forRuleset(members, ruleset), 10);
    for (const group of horde.groups) {
      const chosen = new Set(group.members.map((x) => x.server).filter((s) => !isFlexibleRuleset(s)));
      assert.ok(chosen.size <= 1, `${ruleset}: ${[...chosen].join("+")}`);
    }
  }
});

async function raid(url) {
  const records = members.map((x, i) => ({ anonymousId: `Response #${i + 1}`, server: x.server, race: x.race, characterClass: x.characterClass, role: x.role, profession1: x.profession1, profession2: x.profession2 }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const res = await app.inject({ url });
  await app.close();
  return res;
}

test("the raid page filters by ruleset case-insensitively and keeps the choice in every link", async () => {
  const all = (await raid("/raid?size=10")).body;
  assert.match(all, /aria-label="Ruleset"/);
  assert.match(all, /href="\/raid\?size=10" aria-current="page">All rulesets/);
  assert.match(all, /5 placed/);

  const pvp = (await raid("/raid?size=10&ruleset=pvp")).body;
  assert.match(pvp, /href="\/raid\?size=10&amp;ruleset=PvP" aria-current="page">PvP/);
  assert.match(pvp, /href="\/raid\?size=20&amp;ruleset=PvP"/, "size links keep the ruleset");
  assert.match(pvp, /Showing players who chose PvP or are happy with either/);
  assert.match(pvp, /3 placed/);
  assert.equal(pvp.includes("<strong>A</strong>"), false, "a Normal-only player is left out");
  assert.match(pvp, /<strong>E<\/strong>/, "a flexible player stays in");
});

test("unknown or hostile ruleset values are ignored and never reflected", async () => {
  for (const value of ["<script>alert(1)</script>", "Hardcore", "", "%00", "a".repeat(5000)]) {
    const res = await raid(`/raid?size=10&ruleset=${encodeURIComponent(value)}`);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.includes("<script>alert"), false);
    assert.match(res.body, /5 placed/, `falls back to everyone for ${value.slice(0, 20)}`);
    assert.match(res.body, /href="\/raid\?size=10" aria-current="page">All rulesets/);
  }
});

test("no ruleset tabs appear when everyone chose the same one", async () => {
  const single = members.map((x) => ({ ...x, server: "Normal" }));
  const records = single.map((x, i) => ({ anonymousId: `Response #${i + 1}`, ...x, name: undefined }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: single, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url: "/raid" })).body;
  await app.close();
  assert.equal(body.includes('aria-label="Ruleset"'), false);
});
