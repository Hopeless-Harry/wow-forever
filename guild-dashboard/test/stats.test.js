import assert from "node:assert/strict";
import test from "node:test";

import { buildStats } from "../src/domain/stats.js";

const records = [
  { anonymousId: "Response #1", server: "Normal", race: "Undead", characterClass: "Hunter", role: "DPS", profession1: "Skinning", profession2: "Leatherworking" },
  { anonymousId: "Response #2", server: "Normal", race: "Troll", characterClass: "Hunter", role: "DPS", profession1: "Tailoring", profession2: "Skinning" },
  { anonymousId: "Response #3", server: "Happy with either", race: "Undead", characterClass: "Priest", role: "Healer", profession1: "Tailoring", profession2: "Enchanting" }
];

test("builds sorted categorical distributions and combined professions", () => {
  const stats = buildStats(records);

  assert.equal(stats.totalResponses, 3);
  assert.deepEqual(stats.distributions.characterClass, [
    { label: "Hunter", count: 2, percent: 67 },
    { label: "Priest", count: 1, percent: 33 }
  ]);
  assert.deepEqual(stats.distributions.professions, [
    { label: "Skinning", count: 2, percent: 33 },
    { label: "Tailoring", count: 2, percent: 33 },
    { label: "Enchanting", count: 1, percent: 17 },
    { label: "Leatherworking", count: 1, percent: 17 }
  ]);
});

test("identifies leaders without inventing a result for empty data", () => {
  assert.deepEqual(buildStats(records).leaders.characterClass, { label: "Hunter", count: 2 });
  assert.equal(buildStats([]).leaders.characterClass, null);
  assert.equal(buildStats([]).totalResponses, 0);
});

test("sorts tied distributions alphabetically", () => {
  const stats = buildStats(records);
  assert.deepEqual(stats.distributions.race.map((item) => item.label), ["Undead", "Troll"]);
});
