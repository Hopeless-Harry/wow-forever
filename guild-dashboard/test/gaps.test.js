import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { gapCandidates } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";
import { canFillRole } from "../src/domain/wow-data.js";

const m = (name, characterClass, role, race = "Orc", server = "Normal") => ({ name, server, race, characterClass, role, profession1: "Mining", profession2: "Skinning" });
const FLEX = "Flexible / happy to fill";

test("class capability only rules out clear impossibilities", () => {
  assert.equal(canFillRole("Warrior", "tank"), true);
  assert.equal(canFillRole("Mage", "tank"), false);
  assert.equal(canFillRole("Druid", "healer"), true);
  assert.equal(canFillRole("Rogue", "healer"), false);
  assert.equal(canFillRole("Mage", "dps"), true);
});

test("flexible players are suggested only for roles that are short and that their class can play", () => {
  const members = [
    m("Tanky", "Warrior", FLEX), m("Mara", "Mage", FLEX), m("Dru", "Druid", FLEX),
    m("Healer1", "Priest", "Healer"), m("Healer2", "Priest", "Healer"), m("Healer3", "Paladin", "Healer"),
    m("Tank1", "Warrior", "Tank"), m("Tank2", "Warrior", "Tank"),
    m("Dps1", "Rogue", "DPS")
  ];
  const horde = gapCandidates(members, 10).get("Horde");
  const names = (role) => horde.find((gap) => gap.role === role)?.candidates.map((x) => x.name);

  assert.equal(names("tank"), undefined, "tanks are already covered");
  assert.equal(names("healer"), undefined, "healers are already covered at 10 players");
  assert.deepEqual(names("dps"), ["Dru", "Mara", "Tanky"], "everyone flexible can add damage, sorted by name");
  assert.equal(horde.find((gap) => gap.role === "dps").short, 4);

  const short = gapCandidates([m("Tanky", "Warrior", FLEX), m("Mara", "Mage", FLEX), m("Dru", "Druid", FLEX)], 10).get("Horde");
  assert.deepEqual(short.find((gap) => gap.role === "tank").candidates.map((x) => x.name), ["Dru", "Tanky"], "a Mage is never offered as a tank");
  assert.deepEqual(short.find((gap) => gap.role === "healer").candidates.map((x) => x.name), ["Dru"], "only the Druid can heal");
});

test("gaps are worked out per faction and omitted when nobody can help", () => {
  const members = [m("OrcFlex", "Warrior", FLEX, "Orc"), m("HumanFlex", "Paladin", FLEX, "Human")];
  const result = gapCandidates(members, 10);
  assert.deepEqual(result.get("Horde").flatMap((gap) => gap.candidates.map((x) => x.name)), ["OrcFlex", "OrcFlex", "OrcFlex"].slice(0, 2));
  assert.ok(result.get("Alliance").some((gap) => gap.candidates[0].name === "HumanFlex"));
  assert.equal(gapCandidates([m("OnlyDps", "Rogue", "DPS")], 10).size, 0);
  assert.equal(gapCandidates([], 10).size, 0);
});

async function raidPage(members, url = "/raid?size=10") {
  const records = members.map((x, i) => ({ anonymousId: `Response #${i + 1}`, server: x.server, race: x.race, characterClass: x.characterClass, role: x.role, profession1: x.profession1, profession2: x.profession2 }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url })).body;
  await app.close();
  return body;
}

test("the raid page names who could fill each gap, with links, and escapes names", async () => {
  const body = await raidPage([m("Tank1", "Warrior", "Tank"), m("<b>Flex</b>", "Druid", FLEX), m("Mara", "Mage", FLEX)]);
  assert.match(body, /Flexible players who could fill the gaps/);
  assert.match(body, /Tanks \(short 1\):<\/strong>/);
  assert.match(body, /Healers \(short 3\):<\/strong>/);
  assert.match(body, /href="\/member\?name=%3Cb%3EFlex%3C%2Fb%3E"/);
  assert.equal(body.includes("<b>Flex"), false);
  const tankLine = body.match(/Tanks \(short 1\):<\/strong>[^<]*<a[\s\S]*?<\/li>/)[0];
  assert.equal(tankLine.includes("Mara"), false, "a Mage is not suggested as a tank");
});

test("without anyone able to help, the page falls back to the plain flexible count", async () => {
  const body = await raidPage([m("A", "Warrior", "Tank"), m("B", "Priest", "Healer")]);
  assert.equal(body.includes("could fill the gaps"), false);
  const onlyFlexMage = await raidPage([m("Mara", "Mage", FLEX)]);
  assert.match(onlyFlexMage, /Damage dealers \(short/);
  assert.equal(onlyFlexMage.includes("Tanks (short"), false);
});
