import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { membersToCsv } from "../src/domain/export.js";
import { buildStats } from "../src/domain/stats.js";
import { roleWarning } from "../src/domain/wow-data.js";

const member = (name, extra = {}) => ({ name, server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning", ...extra });
const AT = "2026-09-22T12:00:00.000Z";

function appWith(members, events = []) {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  return buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events, fetchedAt: AT }) }, logger: false });
}

test("flags only clear role and class impossibilities", () => {
  assert.match(roleWarning("Mage", "Tank"), /not normally a tank/);
  assert.match(roleWarning("Rogue", "Healer"), /not normally a healer/);
  assert.equal(roleWarning("Paladin", "Tank"), "");
  assert.equal(roleWarning("Druid", "Healer"), "");
  assert.equal(roleWarning("Mage", "DPS"), "");
  assert.equal(roleWarning("Mage", "Flexible / happy to fill"), "");
});

test("CSV export neutralises spreadsheet formulas and escapes quotes and commas", () => {
  const csv = membersToCsv([member("=HYPERLINK(\"x\")"), member("Bea, the \"Wise\"", { characterClass: "Mage", role: "DPS" })]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Name,Class,Role,Race,Faction,Ruleset,Profession 1,Profession 2");
  assert.ok(lines.some((line) => line.startsWith("\"'=HYPERLINK(\"\"x\"\")\"")) || lines.some((line) => line.startsWith("'=HYPERLINK")));
  assert.ok(lines.some((line) => line.startsWith('"Bea, the ""Wise"""')));
  assert.ok(!lines.some((line) => /^=/.test(line)));
});

test("serves the CSV download with attachment headers", async (t) => {
  const app = appWith([member("Al#1")]);
  t.after(() => app.close());
  const res = await app.inject({ url: "/members.csv" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/csv/);
  assert.match(res.headers["content-disposition"], /attachment; filename="guild-roster.csv"/);
  assert.match(res.body, /Al#1,Warrior,Tank,Orc,Horde,Normal,Mining,Skinning/);
});

test("member profile shows facts, flags and only that member's history", async (t) => {
  const events = [
    { type: "joined", at: AT, name: "Al#1", entry: { server: "Normal", race: "Orc", characterClass: "Mage", role: "Tank", profession1: "Mining", profession2: "Skinning" } },
    { type: "changed", at: AT, name: "Bea#2", field: "class", from: "Mage", to: "Priest" },
    { type: "changed", at: AT, name: "al#1", field: "role", from: "DPS", to: "Tank" }
  ];
  const app = appWith([member("Al#1", { characterClass: "Mage", role: "Tank" }), member("Bea#2")], events);
  t.after(() => app.close());

  const res = await app.inject({ url: `/member?name=${encodeURIComponent("AL#1")}` });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Mage is not normally a tank/);
  assert.match(res.body, /changed role from DPS to Tank/);
  assert.equal(res.body.includes("Bea#2"), false);

  const roster = (await app.inject({ url: "/members" })).body;
  assert.match(roster, /href="\/member\?name=Al%231"/);
});

test("unknown or hostile member names return a safe 404", async (t) => {
  const app = appWith([member("Al#1")]);
  t.after(() => app.close());
  const missing = await app.inject({ url: "/member?name=nobody" });
  assert.equal(missing.statusCode, 404);
  const hostile = await app.inject({ url: `/member?name=${encodeURIComponent("<script>alert(1)</script>")}` });
  assert.equal(hostile.statusCode, 404);
  assert.equal(hostile.body.includes("<script>alert"), false);
  assert.equal((await app.inject({ url: "/member" })).statusCode, 404);
});

test("dashboard shows recent activity only when there are real events", async (t) => {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" }];
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const make = (events) => buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events, fetchedAt: AT }) }, logger: false });

  const quiet = make([{ type: "baseline", at: AT, name: "3" }]);
  t.after(() => quiet.close());
  assert.equal((await quiet.inject({ url: "/" })).body.includes("Recent activity"), false);

  const busy = make([{ type: "left", at: AT, name: "<b>Gone</b>" }]);
  t.after(() => busy.close());
  const body = (await busy.inject({ url: "/" })).body;
  assert.match(body, /Recent activity/);
  assert.equal(body.includes("<b>Gone"), false);
});

test("profession cards label the crafter count and the chronicle opener reads naturally", async (t) => {
  const members = [member("Al#1"), member("Bea#2", { profession1: "Mining" })];
  const events = [{ type: "baseline", at: AT, name: "2" }];
  const app = appWith(members, events);
  t.after(() => app.close());

  const professions = (await app.inject({ url: "/members/professions" })).body;
  assert.match(professions, /Mining <small>2 crafters<\/small>/);
  assert.match(professions, /Skinning <small>2 crafters<\/small>|Skinning <small>1 crafter<\/small>/);
  assert.doesNotMatch(professions, /<small>\d+<\/small>/, "no bare numbers");

  const chronicle = (await app.inject({ url: "/members/chronicle" })).body;
  assert.match(chronicle, /The roll opened with 2 adventurers\./);
  assert.equal(chronicle.includes("on the muster"), false);
  assert.equal((chronicle.match(/<h2>Guild Chronicle<\/h2>/g) ?? []).length, 0, "page title is not repeated as a panel heading");
});

test("counts read naturally for one item: no '1 plans' or '1 entries' anywhere", async (t) => {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" }];
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: AT, lastRefreshFailed: false, rejectedRows: 1 };
  const members = [member("Al#1")];
  const events = [{ type: "baseline", at: AT, name: "1" }, { type: "left", at: AT, name: "Bea#2" }];
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events, fetchedAt: AT }) }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());

  const wrongPlural = /\b1 (plans|responses|entries|members|adventurers|crafters|players)\b/;
  for (const url of ["/", "/statistics", "/responses", "/members", "/members/chronicle", "/members/professions", "/raid?size=10", "/member?name=Al%231"]) {
    const text = (await app.inject({ url })).body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, wrongPlural, `${url} has a plural error`);
  }
  assert.match((await app.inject({ url: "/statistics" })).body, /1 plan, counted exactly/);
  assert.match((await app.inject({ url: "/responses" })).body, /id="visible-count"[^>]*>1 entry</);
});

test("only the roster has a faction filter, and each roster row carries its faction", async (t) => {
  const members = [member("Al#1"), member("Bea#2", { race: "Human", characterClass: "Paladin" })];
  const app = appWith(members);
  t.after(() => app.close());

  const roster = (await app.inject({ url: "/members" })).body;
  assert.match(roster, /<label>Faction<select name="faction"><option value="">Both<\/option><\/select><\/label>/);
  assert.match(roster, /data-faction="Horde" data-search="al#1/);
  assert.match(roster, /data-faction="Alliance" data-search="bea#2/);

  const census = (await app.inject({ url: "/responses" })).body;
  assert.equal(census.includes('name="faction"'), false);
  assert.equal(census.includes("data-faction"), false);
});

test("the roster lists odd answers at the top so officers can follow them up", async (t) => {
  const odd = [
    member("Mage#1", { characterClass: "Mage", role: "Tank" }),
    member("Tauren#2", { race: "Tauren", characterClass: "Mage", role: "DPS" }),
    member("<b>Both</b>", { race: "Tauren", characterClass: "Mage", role: "Tank" }),
    member("Fine#4")
  ];
  const app = appWith(odd);
  t.after(() => app.close());

  const body = (await app.inject({ url: "/members" })).body;
  assert.match(body, /4 answers to double-check/);
  assert.match(body, /<a href="\/member\?name=Mage%231">Mage#1<\/a> — Mage is not normally a tank/);
  assert.match(body, /Tauren Mage is not a known WoW Forever combination/);
  assert.match(body, /nothing is changed automatically/);
  assert.equal(body.includes("Fine#4</a> —"), false, "clean members are not listed");
  assert.equal(body.includes("<b>Both"), false, "names are escaped");
  assert.ok(body.indexOf("to double-check") < body.indexOf('id="census-table"'), "the list sits above the table");
});

test("one odd answer reads in the singular, and a clean roster shows no notice", async (t) => {
  const one = appWith([member("Mage#1", { characterClass: "Mage", role: "Tank" }), member("Fine#2")]);
  t.after(() => one.close());
  assert.match((await one.inject({ url: "/members" })).body, /1 answer to double-check/);

  const clean = appWith([member("Fine#1"), member("Fine#2", { characterClass: "Druid", role: "Healer", race: "Tauren" })]);
  t.after(() => clean.close());
  const body = (await clean.inject({ url: "/members" })).body;
  assert.equal(body.includes("double-check"), false);
  assert.equal(body.includes("check-panel"), false);
});

test("the chronicle can be filtered to joined, left or changed, with counts, and falls back to everything", async (t) => {
  const entry = { server: "Normal", race: "Orc", characterClass: "Rogue", role: "DPS", profession1: "A", profession2: "B" };
  const events = [
    { type: "baseline", at: AT, name: "3" },
    { type: "joined", at: AT, name: "Zed", entry },
    { type: "changed", at: AT, name: "Thok", field: "class", from: "Hunter", to: "Warrior" },
    { type: "changed", at: AT, name: "Mira", field: "role", from: "DPS", to: "Healer" },
    { type: "left", at: AT, name: "Zed" }
  ];
  const app = appWith([member("Thok")], events);
  t.after(() => app.close());
  const page = async (query = "") => (await app.inject({ url: `/members/chronicle${query}` })).body;

  const all = await page();
  assert.match(all, /All \(5\)<\/a>/);
  assert.match(all, /Joined \(1\)<\/a>/);
  assert.match(all, /Left \(1\)<\/a>/);
  assert.match(all, /Changed \(2\)<\/a>/);
  assert.match(all, /href="\/members\/chronicle" aria-current="page">All \(5\)/);
  assert.match(all, /5 entries/);

  const changed = await page("?type=changed");
  assert.match(changed, /href="\/members\/chronicle\?type=changed" aria-current="page">Changed \(2\)/);
  assert.match(changed, /2 entries/);
  assert.match(changed, /Thok<\/strong> changed class from Hunter to Warrior/);
  assert.equal(changed.includes("left the roll"), false);
  assert.equal(changed.includes("The roll opened"), false, "the opening entry only shows under All");

  const left = await page("?type=left");
  assert.match(left, /1 entry</);
  assert.match(left, /Zed<\/strong> left the roll/);
  assert.equal(left.includes("changed class"), false);

  for (const odd of ["?type=nonsense", "?type=", "?type=%3Cscript%3E", "?type=changed&type=left", "?type[]=left"]) {
    const body = await page(odd);
    assert.equal(body.includes("<script>"), false, odd);
    assert.match(body, /aria-current="page">(All|Changed) \(/, `${odd} lands on a valid tab`);
  }
});

test("a filter with no matches says so plainly, and a roll with no history still shows the opening message", async (t) => {
  const events = [{ type: "baseline", at: AT, name: "1" }, { type: "joined", at: AT, name: "Zed", entry: { server: "Normal", race: "Orc", characterClass: "Rogue", role: "DPS", profession1: "A", profession2: "B" } }];
  const app = appWith([member("Zed")], events);
  t.after(() => app.close());
  const left = (await app.inject({ url: "/members/chronicle?type=left" })).body;
  assert.match(left, /Nobody has left the roll\./);
  assert.match(left, /0 entries/);
  assert.match(left, /Left \(0\)<\/a>/);

  const none = appWith([], []);
  t.after(() => none.close());
  const empty = (await none.inject({ url: "/members/chronicle" })).body;
  assert.match(empty, /The Chronicle awaits its first page/);
  assert.equal(empty.includes("Filter the chronicle"), false, "no tabs before there is any history");
});

import { answerFlags } from "../src/domain/wow-data.js";

test("answer flags list one entry per problem and nothing for sensible answers", () => {
  const flags = answerFlags([
    member("Fine#1"),
    member("Both#2", { race: "Tauren", characterClass: "Mage", role: "Tank" }),
    member("Role#3", { characterClass: "Rogue", role: "Healer" })
  ]);
  assert.deepEqual(flags.map((f) => [f.member.name, f.reason]), [
    ["Both#2", "Tauren Mage is not a known WoW Forever combination"],
    ["Both#2", "Mage is not normally a tank"],
    ["Role#3", "Rogue is not normally a healer"]
  ]);
  assert.deepEqual(answerFlags([]), []);
});

test("the dashboard points officers at unusual roster answers, with the right wording and a working link", async (t) => {
  const odd = (n) => member(`Odd#${n}`, { characterClass: "Mage", role: "Tank" });
  const record = { anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" };
  const snapshot = { records: [record], stats: buildStats([record]), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const dashboard = async (members) => {
    const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: AT }) }, logger: false, rateLimitPerMinute: 0 });
    const body = (await app.inject({ url: "/" })).body;
    await app.close();
    return body;
  };

  const one = await dashboard([odd(1), member("Fine#2")]);
  assert.match(one, /<p class="check-notice" role="note"><strong>1 roster answer looks unusual\.<\/strong> <a href="\/members#check-panel">Review it on the roster<\/a><\/p>/);

  const three = await dashboard([odd(1), odd(2), odd(3)]);
  assert.match(three, /<strong>3 roster answers look unusual\.<\/strong> <a href="\/members#check-panel">Review them on the roster<\/a>/);

  const clean = await dashboard([member("Fine#1"), member("Fine#2", { characterClass: "Druid", role: "Healer", race: "Tauren" })]);
  assert.equal(clean.includes("check-notice"), false, "nothing to flag, nothing shown");
  assert.equal((await dashboard([])).includes("check-notice"), false);

  const target = appWith([odd(1)]);
  t.after(() => target.close());
  const roster = (await target.inject({ url: "/members" })).body;
  assert.match(roster, /<section class="parchment-panel check-panel" id="check-panel" aria-labelledby="check-heading">/, "the link lands on the whole double-check panel");
  assert.match(roster, /<h2 id="check-heading">/);
});

test("only the roster offers Copy names, with its own status line", async (t) => {
  const app = appWith([member("Al#1")]);
  t.after(() => app.close());
  const roster = (await app.inject({ url: "/members" })).body;
  assert.match(roster, /<p class="copy-names"><button class="wow-button" type="button" data-copy-names>Copy names<\/button> <span id="copy-names-status" class="quiet" role="status"><\/span><\/p>/);
  assert.ok(roster.indexOf("data-copy-names") < roster.indexOf('id="census-table"'), "the button sits above the table");
  assert.equal((await app.inject({ url: "/responses" })).body.includes("data-copy-names"), false, "entry numbers are not names, so the census has no button");
});
