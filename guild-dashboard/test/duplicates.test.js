import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { possibleDuplicates } from "../src/domain/members.js";
import { buildStats } from "../src/domain/stats.js";

const entry = { server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" };
const m = (name, extra = {}) => ({ name, ...entry, ...extra });
const names = (...list) => list.map((name) => m(name));

test("a bare name matching another entry's name is reported, case-insensitively and with spaces ignored", () => {
  assert.deepEqual(possibleDuplicates(names("Mira", "Mira#1234")), [["Mira", "Mira#1234"]]);
  assert.deepEqual(possibleDuplicates(names("mira", "MIRA#99")), [["mira", "MIRA#99"]]);
  assert.equal(possibleDuplicates(names("Mira ", "Mira#1")).length, 1, "surrounding spaces do not hide a match");
  assert.deepEqual(possibleDuplicates(names("Mira", "Mira#1", "Mira#2")), [["Mira", "Mira#1", "Mira#2"]], "a third entry joins the same group");
});

test("different BattleTag numbers are different accounts, and unrelated or empty names are ignored", () => {
  assert.deepEqual(possibleDuplicates(names("Al#1234", "Al#5678")), [], "two full tags are two people");
  assert.deepEqual(possibleDuplicates(names("Mira", "Thok#1", "Una")), []);
  assert.deepEqual(possibleDuplicates(names("#1234", "#5678", "")), [], "nothing before the # means nothing to compare");
  assert.deepEqual(possibleDuplicates([]), []);
  assert.deepEqual(possibleDuplicates(names("Mira", "Mirabel#1")), [], "only an exact name match counts, not a shared prefix");
});

async function page(members, url) {
  const records = members.map((x, i) => ({ anonymousId: `Response #${i + 1}`, ...entry }));
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url })).body;
  await app.close();
  return body;
}

test("the roster lists possible duplicates with links and advice, and nothing else changes", async () => {
  const body = await page([m("Mira"), m("Mira#1234"), m("Thok#1")], "/members");
  assert.match(body, /<h2 id="check-heading">Possible duplicates<\/h2>/);
  assert.match(body, /<a href="\/member\?name=Mira">Mira<\/a> and <a href="\/member\?name=Mira%231234">Mira#1234<\/a> may be the same person/);
  assert.match(body, /remove the other row from the response sheet/);
  assert.equal(body.includes("answers to double-check"), false, "no odd answers, so no answers heading");
  assert.equal(body.includes("Thok#1</a> may"), false);

  const clean = await page([m("Mira#1"), m("Thok#2")], "/members");
  assert.equal(clean.includes("check-panel"), false);
});

test("odd answers and duplicates share one panel, each under its own heading", async () => {
  const body = await page([m("Mira"), m("Mira#1234", { characterClass: "Mage", role: "Tank" })], "/members");
  assert.match(body, /1 answer to double-check/);
  assert.match(body, /<h3 class="check-subheading">Possible duplicates<\/h3>/);
  assert.equal((body.match(/id="check-panel"/g) ?? []).length, 1, "one panel, one link target");
  assert.ok(body.indexOf("1 answer to double-check") < body.indexOf("Possible duplicates</h3>"));
});

test("names in the duplicate list are escaped", async () => {
  const body = await page([m("<b>X</b>"), m("<b>X</b>#1")], "/members");
  assert.equal(body.includes("<b>X"), false);
  assert.match(body, /&lt;b&gt;X&lt;\/b&gt;<\/a> and/);
});

test("the dashboard notice counts duplicates, with the right wording, and stays quiet when there are none", async () => {
  assert.match(await page([m("Mira"), m("Mira#1")], "/"), /<strong>1 possible duplicate entry\.<\/strong> <a href="\/members#check-panel">Review it on the roster<\/a>/);
  assert.match(await page([m("Mira"), m("Mira#1"), m("Una"), m("Una#2")], "/"), /<strong>2 possible duplicate entries\.<\/strong> <a href="\/members#check-panel">Review them on the roster<\/a>/);
  assert.match(await page([m("Mira"), m("Mira#1"), m("Odd#3", { characterClass: "Mage", role: "Tank" })], "/"), /<strong>1 roster answer looks unusual\. 1 possible duplicate entry\.<\/strong> <a href="\/members#check-panel">Review them on the roster<\/a>/);
  assert.equal((await page([m("Mira#1"), m("Thok#2")], "/")).includes("check-notice"), false);
});
