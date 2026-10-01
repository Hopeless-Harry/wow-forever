import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildGroups, groupPlan } from "../src/domain/groups.js";
import { missingProfessions } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";

const make = (name, characterClass, role, race = "Orc", server = "Normal") => ({ name, server, race, characterClass, role, profession1: "Mining", profession2: "Skinning" });

const horde = [
  make("T1", "Warrior", "Tank"), make("T2", "Druid", "Tank", "Tauren"),
  make("H1", "Priest", "Healer", "Troll"), make("H2", "Shaman", "Healer"), make("H3", "Priest", "Healer", "Undead"),
  ...Array.from({ length: 8 }, (_, i) => make(`D${i}`, i % 2 ? "Mage" : "Rogue", "DPS", i % 2 ? "Troll" : "Orc")),
  make("F1", "Hunter", "Flexible / happy to fill", "Tauren", "Happy with either")
];

test("builds balanced groups of five with tanks and healers spread out", () => {
  const { groups, bench } = buildGroups(horde, 10);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((g) => g.members.length <= 5));
  assert.equal(groups.reduce((sum, g) => sum + g.members.length, 0) + bench.length, horde.length);
  assert.ok(groups.every((g) => g.members.some((m) => m.role === "Tank")), "each group has a tank");
  assert.ok(groups.every((g) => g.members.some((m) => m.role === "Healer")), "each group has a healer");
  assert.equal(new Set(groups.flatMap((g) => g.members.map((m) => m.name))).size, groups.flatMap((g) => g.members).length, "no duplicates");
});

test("benches overflow members and handles tiny rosters", () => {
  assert.equal(buildGroups(horde, 10).bench.length, horde.length - 10);
  const small = buildGroups([make("Solo", "Mage", "DPS")], 40);
  assert.equal(small.groups.length, 8);
  assert.equal(small.bench.length, 0);
  assert.deepEqual(buildGroups([], 20).groups.map((g) => g.members.length), [0, 0, 0, 0]);
});

test("grouping is deterministic and separates factions with ruleset counts", () => {
  const mixed = [...horde, make("A1", "Paladin", "Healer", "Human"), make("A2", "Warrior", "Tank", "Dwarf", "PvP")];
  const first = groupPlan(mixed, 20);
  assert.deepEqual(first, groupPlan([...mixed].reverse(), 20));
  assert.deepEqual(first.map((f) => f.faction), ["Horde", "Alliance"]);
  assert.deepEqual(first[0].rulesets, [{ label: "Normal", count: 13 }, { label: "Happy with either", count: 1 }]);
  assert.ok(first[1].groups.flatMap((g) => g.members).every((m) => ["Human", "Dwarf"].includes(m.race)));
});

test("reports professions nobody has", () => {
  const gaps = missingProfessions([make("A", "Mage", "DPS")]);
  assert.ok(gaps.primary.includes("Alchemy") && !gaps.primary.includes("Mining"));
  assert.deepEqual(gaps.secondary, ["Cooking", "First Aid", "Fishing"]);
});

test("pages render groups, gaps and the launch countdown safely", async (t) => {
  const records = horde.map((m, i) => ({ anonymousId: `Response #${i + 1}`, server: m.server, race: m.race, characterClass: m.characterClass, role: m.role, profession1: m.profession1, profession2: m.profession2 }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const memberData = { members: [...horde.slice(0, 3), make("<b>Bad</b>", "Mage", "DPS")], events: [], fetchedAt: snapshot.fetchedAt };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false });
  t.after(() => app.close());

  const raid = (await app.inject({ url: "/raid?size=10" })).body;
  assert.match(raid, /Horde suggested groups/);
  assert.match(raid, /Group 1/);
  assert.match(raid, /Players can only group within one faction and one ruleset/);
  assert.equal(raid.includes("<b>Bad"), false);

  const professions = (await app.inject({ url: "/members/professions" })).body;
  assert.match(professions, /Nobody yet/);
  assert.match(professions, /Alchemy/);

  const dashboard = (await app.inject({ url: "/" })).body;
  assert.match(dashboard, /data-launch="2026-11-04T23:00:00Z"/);
  assert.match(dashboard, /\/assets\/countdown\.js/);
  const script = await app.inject({ url: "/assets/countdown.js" });
  assert.equal(script.statusCode, 200);
  assert.doesNotMatch(script.body, /https?:\/\//);
});

test("group cards put each member's class and role on their own line and filters stay two-up on phones", async (t) => {
  const memberData = { members: [make("Al#1", "Priest", "Healer", "Troll")], events: [], fetchedAt: "2026-09-22T12:00:00.000Z" };
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Troll", characterClass: "Priest", role: "Healer", profession1: "Mining", profession2: "Skinning" }];
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: memberData.fetchedAt, lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());

  const raid = (await app.inject({ url: "/raid?size=10" })).body;
  assert.match(raid, /<li><strong>Al#1<\/strong><span class="member-meta"><span class="class-chip class-priest">Priest<\/span> <span aria-hidden="true">·<\/span> Healer<\/span><\/li>/);

  const css = (await import("node:fs")).readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.group-card li\s*\{[^}]*display:\s*grid/);
  assert.doesNotMatch(css, /\.census-tools\s*\{\s*grid-template-columns:\s*1fr;\s*\}/, "filters no longer collapse to one column");
});

import { groupsToText } from "../src/domain/groups.js";

test("group text lists each non-empty group with names and classes, then the bench", () => {
  const plan = groupPlan(horde, 10);
  const text = groupsToText(plan, 10);
  const lines = text.split("\n");
  assert.equal(lines[0], "**Raid groups — 10-player**");
  assert.equal(lines[1], "**Horde**");
  assert.match(lines[2], /^Group 1: [A-Za-z0-9]+ \((Warrior|Druid|Priest|Shaman|Mage|Rogue|Hunter)\)(, [A-Za-z0-9]+ \([A-Za-z]+\))+$/);
  assert.ok(lines.some((line) => line.startsWith("Group 2: ")));
  assert.match(lines.at(-1), /^Bench: /, "overflow players are listed last");
  assert.equal((text.match(/\(/g) ?? []).length, 10, "a class is shown for each of the ten placed players, none for the bench");
});

test("group text names the ruleset, separates factions and skips empty groups", () => {
  const mixed = [make("Aldo", "Paladin", "Tank", "Human"), make("Thok", "Warrior", "Tank", "Orc")];
  const text = groupsToText(groupPlan(mixed, 20), 20, "PvP");
  assert.match(text, /^\*\*Raid groups — 20-player \(PvP\)\*\*/);
  assert.match(text, /\*\*Horde\*\*\nGroup 1: Thok \(Warrior\)/);
  assert.match(text, /\*\*Alliance\*\*\nGroup 1: Aldo \(Paladin\)/);
  assert.equal(text.includes("Group 2"), false, "empty groups are not listed");
  assert.equal(groupsToText([], 10), null);
  assert.equal(groupsToText(groupPlan([], 10), 10), null);
});

test("the raid page offers the group list for copying, with a length note and a long-list warning", async () => {
  const records = horde.map((m, i) => ({ anonymousId: `Response #${i + 1}`, server: m.server, race: m.race, characterClass: m.characterClass, role: m.role, profession1: m.profession1, profession2: m.profession2 }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const page = async (members, url = "/raid?size=10") => {
    const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
    const body = (await app.inject({ url })).body;
    await app.close();
    return body;
  };

  const body = await page(horde);
  assert.match(body, /Raid groups for Discord/);
  assert.match(body, /<label for="raid-groups-text"/);
  assert.match(body, /<textarea id="raid-groups-text"[^>]*readonly[^>]*>\*\*Raid groups — 10-player\*\*/);
  assert.match(body, /data-copy-target="raid-groups-text" data-copy-status="raid-copy-status"/);
  assert.match(body, /id="raid-copy-status"[^>]*role="status"/);
  assert.match(body, /\/assets\/copy-summary\.js/);
  assert.match(body, /\d+ characters\./);
  assert.equal(body.includes("over Discord"), false);

  const hostile = await page([make("<b>Bad</b>", "Mage", "DPS")]);
  assert.equal(hostile.includes("<b>Bad"), false, "names are escaped inside the text box");

  const huge = Array.from({ length: 80 }, (_, i) => make(`LongerPlayerName${String(i).padStart(3, "0")}`, "Mage", i % 9 === 0 ? "Tank" : i % 5 === 0 ? "Healer" : "DPS"));
  assert.match(await page(huge, "/raid?size=40"), /over Discord's 2,000-character message limit, so paste it in two messages/);

  const none = await page([]);
  assert.equal(none.includes("Raid groups for Discord"), false, "no panel without a roster");
});
