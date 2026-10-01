import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { buildApp } from "../src/app.js";
import { buildSummary } from "../src/domain/summary.js";
import { buildStats } from "../src/domain/stats.js";

const rec = (n, race, characterClass, role, server = "Normal") => ({ anonymousId: `Response #${n}`, server, race, characterClass, role, profession1: "Mining", profession2: "Skinning" });
const records = [
  rec(1, "Orc", "Warrior", "Tank"), rec(2, "Troll", "Priest", "Healer", "PvP"), rec(3, "Undead", "Mage", "DPS"),
  rec(4, "Tauren", "Hunter", "Flexible / happy to fill", "Happy with either"), rec(5, "Human", "Paladin", "Healer"), rec(6, "Orc", "Warrior", "DPS")
];
const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
const NOW = new Date("2026-10-01T18:00:00Z");

test("summary lists totals, factions, roles, top classes, rulesets and the launch countdown", () => {
  const text = buildSummary(snapshot, { members: [] }, NOW);
  assert.match(text, /^\*\*Moms Against Magic — guild roster\*\*/);
  assert.match(text, /6 responses · Horde 5 · Alliance 1/);
  assert.match(text, /\*\*Horde\*\* — 1 tank · 1 healer · 2 DPS · 1 flexible/);
  assert.match(text, /\*\*Alliance\*\* — 0 tanks · 1 healer · 0 DPS/);
  assert.match(text, /\*\*Top classes:\*\* Warrior 2, Hunter 1, Mage 1/);
  assert.match(text, /\*\*Rulesets:\*\* Normal 4, Happy with either 1, PvP 1/);
  assert.match(text, /launches in 35 days\*\* \(reported date, unverified\)/);
  assert.doesNotMatch(text, /Professions nobody has/, "omitted when there is no roster data");
});

test("summary reports professions nobody has when roster data exists, and when every one is covered", () => {
  const some = buildSummary(snapshot, { members: [{ name: "A", profession1: "Mining", profession2: "Skinning" }] }, NOW);
  assert.match(some, /Professions nobody has:\*\* Alchemy, Blacksmithing/);
  const all = ["Alchemy", "Blacksmithing", "Enchanting", "Engineering", "Herbalism", "Leatherworking", "Mining", "Skinning", "Tailoring", "Cooking", "First Aid", "Fishing"];
  const members = [];
  for (let i = 0; i < all.length; i += 2) members.push({ name: `M${i}`, profession1: all[i], profession2: all[i + 1] });
  assert.match(buildSummary(snapshot, { members }, NOW), /none — every profession is covered/);
});

test("summary handles one response, an empty guild and a passed launch date", () => {
  const one = buildSummary({ records: [records[0]] }, {}, NOW);
  assert.match(one, /1 response · Horde 1/);
  assert.match(buildSummary({ records: [] }, {}, NOW), /No responses yet\./);
  assert.match(buildSummary(snapshot, {}, new Date("2026-11-05T00:00:00Z")), /WoW Forever is live/);
  assert.match(buildSummary(snapshot, {}, new Date("2026-11-04T22:59:00Z")), /launches in 1 day\*\*/);
  assert.doesNotThrow(() => buildSummary({}, undefined, NOW));
});

test("summary uses counts only and never repeats a member name", () => {
  const members = [{ name: "SecretName#1234", profession1: "Mining", profession2: "Skinning" }];
  assert.equal(buildSummary(snapshot, { members }, NOW).includes("SecretName"), false);
  assert.ok(buildSummary(snapshot, { members }, NOW).length < 1500, "fits in a Discord message");
});

test("dashboard shows the summary with a labelled box and copy button, and /summary.txt serves plain text", async (t) => {
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events: [] }) }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());

  const page = (await app.inject({ url: "/" })).body;
  assert.match(page, /Guild summary for Discord/);
  assert.match(page, /<label for="guild-summary"/);
  assert.match(page, /<textarea id="guild-summary"[^>]*readonly/);
  assert.match(page, /data-copy-target="guild-summary" data-copy-status="copy-status">Copy for Discord<\/button>/);
  assert.match(page, /id="copy-status"[^>]*role="status"/);
  assert.match(page, /\/assets\/copy-summary\.js/);
  assert.match(page, /6 responses · Horde 5 · Alliance 1/);

  const text = await app.inject({ url: "/summary.txt" });
  assert.equal(text.statusCode, 200);
  assert.match(text.headers["content-type"], /text\/plain/);
  assert.equal(text.headers["cache-control"], "no-store");
  assert.match(text.body, /Top classes/);
  assert.equal((await app.inject({ url: "/assets/copy-summary.js" })).statusCode, 200);
});

function copyHarness({ clipboard, execCommand }) {
  const state = { button: { textContent: "Copy for Discord", dataset: { copyTarget: "guild-summary", copyStatus: "copy-status" }, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } }, field: { value: "SUMMARY", selected: false, focused: false, handlers: {}, focus() { this.focused = true; }, select() { this.selected = true; }, addEventListener(type, fn) { this.handlers[type] = fn; } }, status: { textContent: "" }, timers: [] };
  const document = { querySelectorAll: (selector) => (selector === "[data-copy-target]" ? [state.button] : []), getElementById: (id) => ({ "guild-summary": state.field, "copy-status": state.status })[id] ?? null, execCommand };
  vm.runInNewContext(readFileSync(new URL("../public/copy-summary.js", import.meta.url), "utf8"), vm.createContext({ document, navigator: { clipboard }, window: { setTimeout: (fn, ms) => state.timers.push({ fn, ms }) } }));
  return state;
}

test("copy button copies via the clipboard, falls back to selection, and tells the user what happened", async () => {
  let written = null;
  const ok = copyHarness({ clipboard: { writeText: async (text) => { written = text; } }, execCommand: () => false });
  await ok.button.handlers.click();
  assert.equal(written, "SUMMARY");
  assert.equal(ok.button.textContent, "Copied!");
  assert.match(ok.status.textContent, /Copied/);
  ok.timers[0].fn();
  assert.equal(ok.button.textContent, "Copy for Discord");

  const fallback = copyHarness({ clipboard: { writeText: async () => { throw new Error("denied"); } }, execCommand: (command) => command === "copy" });
  await fallback.button.handlers.click();
  assert.equal(fallback.field.selected, true);
  assert.equal(fallback.button.textContent, "Copied!");

  const failed = copyHarness({ clipboard: { writeText: async () => { throw new Error("denied"); } }, execCommand: () => false });
  await failed.button.handlers.click();
  assert.match(failed.status.textContent, /Ctrl\+C/);
  assert.equal(failed.button.textContent, "Copy for Discord");

  failed.field.handlers.focus();
  assert.equal(failed.field.selected, true, "focusing the box selects the text");
});

const many = (count, race, characterClass, role, server = "Normal") => Array.from({ length: count }, (_, i) => rec(i + 1, race, characterClass, role, server));

test("the summary says which raid size each faction is ready for, or exactly what it needs", () => {
  const ready = [...many(2, "Orc", "Warrior", "Tank"), ...many(3, "Troll", "Priest", "Healer"), ...many(5, "Undead", "Mage", "DPS")];
  const text = buildSummary({ records: ready }, {}, NOW);
  assert.match(text, /\*\*Raid readiness:\*\*\n- Horde — ready for a 10-player raid/);

  const notReady = buildSummary({ records: [...many(1, "Orc", "Warrior", "Tank"), ...many(1, "Human", "Paladin", "Healer")] }, {}, NOW);
  assert.match(notReady, /- Horde — not ready for 10-player yet \(needs 1 tank, 3 healers, 5 DPS\)/);
  assert.match(notReady, /- Alliance — not ready for 10-player yet \(needs 2 tanks, 2 healers, 5 DPS\)/);
});

test("the summary reports readiness per ruleset when members chose different ones, never falsely ready", () => {
  const split = [
    ...many(2, "Orc", "Warrior", "Tank", "Normal"),
    ...many(3, "Troll", "Priest", "Healer", "Normal"),
    ...many(5, "Undead", "Mage", "DPS", "PvP")
  ];
  const text = buildSummary({ records: split }, {}, NOW);
  assert.match(text, /- Horde · Normal — not ready for 10-player yet \(needs 5 DPS\)/);
  assert.match(text, /- Horde · PvP — not ready for 10-player yet \(needs 2 tanks, 3 healers\)/);
  assert.equal(/— ready for/.test(text), false);
});

test("a larger ready guild reports its biggest ready size and the summary still fits in a Discord message", () => {
  const big = [...many(4, "Orc", "Warrior", "Tank"), ...many(11, "Troll", "Priest", "Healer"), ...many(25, "Undead", "Mage", "DPS")];
  const text = buildSummary({ records: big }, { members: [{ name: "A", profession1: "Mining", profession2: "Skinning" }] }, NOW);
  assert.match(text, /- Horde — ready for a 40-player raid/);
  assert.ok(text.length < 2000, `summary is ${text.length} characters`);
  assert.equal(buildSummary({ records: [] }, {}, NOW).includes("Raid readiness"), false, "nothing to report for an empty guild");
});

test("several copy buttons on one page each copy their own text box and report in their own status line", async () => {
  const written = [];
  const make = (target, status, value) => ({ button: { textContent: "Copy for Discord", dataset: { copyTarget: target, copyStatus: status }, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } }, field: { value, handlers: {}, focus() {}, select() {}, addEventListener(type, fn) { this.handlers[type] = fn; } }, status: { textContent: "" } });
  const one = make("a-text", "a-status", "FIRST");
  const two = make("b-text", "b-status", "SECOND");
  const byId = { "a-text": one.field, "a-status": one.status, "b-text": two.field, "b-status": two.status };
  const document = { querySelectorAll: () => [one.button, two.button], getElementById: (id) => byId[id] ?? null };
  vm.runInNewContext(readFileSync(new URL("../public/copy-summary.js", import.meta.url), "utf8"), vm.createContext({ document, navigator: { clipboard: { writeText: async (text) => { written.push(text); } } }, window: { setTimeout() {} } }));

  await two.button.handlers.click();
  await one.button.handlers.click();
  assert.deepEqual(written, ["SECOND", "FIRST"]);
  assert.match(two.status.textContent, /Copied/);
  assert.match(one.status.textContent, /Copied/);

  const ghost = { textContent: "x", dataset: { copyTarget: "missing" }, handlers: {}, addEventListener() { throw new Error("must not bind"); } };
  assert.doesNotThrow(() => vm.runInNewContext(readFileSync(new URL("../public/copy-summary.js", import.meta.url), "utf8"), vm.createContext({ document: { querySelectorAll: () => [ghost], getElementById: () => null }, navigator: {}, window: {} })));
});
