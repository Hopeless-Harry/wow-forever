import assert from "node:assert/strict";
import test from "node:test";

import { discordSafe } from "../src/domain/discord.js";
import { groupPlan, groupsToText } from "../src/domain/groups.js";
import { buildSummary } from "../src/domain/summary.js";

const make = (name, characterClass, role, server = "Normal") => ({ name, server, race: "Orc", characterClass, role, profession1: "Mining", profession2: "Skinning" });

test("discordSafe breaks mentions and escapes markdown but leaves plain names alone", () => {
  assert.equal(discordSafe("Plain#1234"), "Plain#1234");
  assert.equal(discordSafe("Zoë Ångström"), "Zoë Ångström");
  assert.ok(!discordSafe("@everyone").includes("@everyone"));
  assert.ok(!discordSafe("@here").includes("@here"));
  assert.ok(!discordSafe("<@&1234567890>").includes("<@"));
  assert.equal(discordSafe("**LOUD** snake_case `x` ~~y~~"), "\\*\\*LOUD\\*\\* snake\\_case \\`x\\` \\~\\~y\\~\\~");
});

test("copied raid groups cannot ping or format from member-supplied names", () => {
  const members = [make("@everyone", "Warrior", "Tank"), make("<@&1234567890>", "Priest", "Healer"), make("**LOUD**", "Mage", "DPS"), make("Ok", "Rogue", "DPS")];
  const text = groupsToText(groupPlan(members, 10), 10);
  assert.ok(!text.includes("@everyone"));
  assert.ok(!text.includes("<@&"));
  assert.ok(!text.includes("**LOUD**"));
  assert.match(text, /Ok \(Rogue\)/);
  assert.ok(text.startsWith("**Raid groups — 10-player**"), "own formatting is kept");
});

test("the summary escapes member-supplied ruleset text", () => {
  const records = [make("A", "Mage", "DPS", "@everyone")];
  const text = buildSummary({ records }, {}, new Date("2026-10-01"));
  assert.ok(!text.includes("@everyone"));
});
