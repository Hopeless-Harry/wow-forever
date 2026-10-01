import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { factionProfessionGaps } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";

const m = (name, race, profession1, profession2, characterClass = "Warrior") => ({ name, server: "Normal", race, characterClass, role: "DPS", profession1, profession2 });

test("a profession only one faction has is reported for the other, and shared or absent ones are not", () => {
  const members = [
    m("Thok", "Orc", "Mining", "Blacksmithing"), m("Mira", "Troll", "Herbalism", "Alchemy"),
    m("Aldo", "Human", "Mining", "Tailoring"), m("Bea", "Dwarf", "Herbalism", "Cooking")
  ];
  const gaps = Object.fromEntries(factionProfessionGaps(members).map((entry) => [entry.faction, entry.missing]));
  assert.deepEqual(gaps.Horde, ["Tailoring", "Cooking"], "Mining and Herbalism are covered on both sides");
  assert.deepEqual(gaps.Alliance, ["Alchemy", "Blacksmithing"]);
  assert.equal(Object.values(gaps).flat().includes("Engineering"), false, "a profession nobody has is not a one-sided gap");
});

test("there is nothing to report with one faction, an empty roster, or perfectly matched sides", () => {
  assert.deepEqual(factionProfessionGaps([m("Thok", "Orc", "Mining", "Skinning")]), []);
  assert.deepEqual(factionProfessionGaps([]), []);
  assert.deepEqual(factionProfessionGaps([m("A", "Orc", "Mining", "Skinning"), m("B", "Human", "Mining", "Skinning")]), []);
  assert.deepEqual(factionProfessionGaps([m("A", "Orc", "Mining", "Skinning"), m("B", "Mystery", "Alchemy", "Tailoring")]), [], "unknown races are not treated as a faction");
});

async function professions(members) {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url: "/members/professions" })).body;
  await app.close();
  return body;
}

test("crafters link to their profile and show their faction", async () => {
  const body = await professions([m("Thok", "Orc", "Mining", "Skinning"), m("<b>Aldo</b>", "Human", "Mining", "Tailoring", "Paladin")]);
  assert.match(body, /<a href="\/member\?name=Thok"><strong>Thok<\/strong><\/a> <span aria-hidden="true">·<\/span> <span class="class-chip class-warrior">Warrior<\/span> <span aria-hidden="true">·<\/span> <small class="faction-tag">Horde<\/small>/);
  assert.match(body, /<small class="faction-tag">Alliance<\/small>/);
  assert.match(body, /href="\/member\?name=%3Cb%3EAldo%3C%2Fb%3E"/);
  assert.equal(body.includes("<b>Aldo"), false, "names are escaped");
});

test("the page explains which side lacks a crafter, only when both factions exist", async () => {
  const both = await professions([m("Thok", "Orc", "Mining", "Blacksmithing"), m("Aldo", "Human", "Mining", "Tailoring")]);
  assert.match(both, /Only one faction has these/);
  assert.match(both, /Horde and Alliance cannot trade/);
  assert.match(both, /<strong>Horde<\/strong> has no Tailoring/);
  assert.match(both, /<strong>Alliance<\/strong> has no Blacksmithing/);

  const one = await professions([m("Thok", "Orc", "Mining", "Blacksmithing")]);
  assert.equal(one.includes("Only one faction has these"), false);
  assert.match(one, /Nobody yet/, "the guild-wide gap list is unchanged");
});
