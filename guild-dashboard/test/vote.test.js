import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { rulesetVote } from "../src/domain/raid.js";
import { buildStats } from "../src/domain/stats.js";

const rec = (n, server) => ({ anonymousId: `Response #${n}`, server, race: "Orc", characterClass: "Warrior", role: "DPS", profession1: "Mining", profession2: "Skinning" });
const many = (count, server, start = 1) => Array.from({ length: count }, (_, i) => rec(start + i, server));

test("flexible players count toward every ruleset, and options are ranked by who could play them", () => {
  const vote = rulesetVote([...many(8, "Normal"), ...many(3, "PvP", 9), ...many(2, "Happy with either", 12)]);
  assert.equal(vote.total, 13);
  assert.equal(vote.flexible, 2);
  assert.deepEqual(vote.options.map((o) => [o.name, o.chose, o.canPlay, o.percent]), [["Normal", 8, 10, 77], ["PvP", 3, 5, 38]]);
  assert.equal(vote.leader.name, "Normal");
  assert.equal(vote.close, false);
});

test("a vote within ten points is flagged as close, and a clear one is not", () => {
  assert.equal(rulesetVote([...many(6, "Normal"), ...many(5, "PvP", 7)]).close, true);
  assert.equal(rulesetVote([...many(6, "Normal"), ...many(2, "PvP", 7)]).close, false);
  assert.equal(rulesetVote(many(4, "Normal")).close, false, "one option cannot be close");
});

test("the flexible answer never becomes the leader, and empty or all-flexible guilds are handled", () => {
  const vote = rulesetVote([...many(1, "Normal"), ...many(5, "Happy with either", 2)]);
  assert.equal(vote.leader.name, "Normal");
  assert.equal(vote.leader.canPlay, 6);
  const none = rulesetVote([]);
  assert.deepEqual([none.total, none.leader, none.close], [0, null, false]);
  assert.equal(rulesetVote(many(3, "Happy with either")).leader, null);
});

async function dashboard(records) {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
  const body = (await app.inject({ url: "/" })).body;
  await app.close();
  return body;
}

test("the dashboard card says how many could play the favoured ruleset and flags a close call", async () => {
  const clear = await dashboard([...many(8, "Normal"), ...many(3, "PvP", 9), ...many(2, "Happy with either", 12)]);
  assert.match(clear, /<span>Favoured ruleset<\/span><strong>Normal<\/strong><small>10 of 13 could play it \(8 chose it \+ 2 happy with either\)<\/small>/);
  assert.equal(clear.includes("Close call"), false);

  const close = await dashboard([...many(6, "Normal"), ...many(5, "PvP", 7)]);
  assert.match(close, /<small>6 of 11 could play it \(6 chose it\)<\/small><small class="vote-close">Close call: PvP has 5 of 11<\/small>/);

  assert.match(await dashboard(many(3, "Happy with either")), /<strong>Any<\/strong><small>Everyone is happy with either<\/small>/);
  const empty = await dashboard([]);
  assert.match(empty, /No responses yet/, "an empty synced guild says so, with no broken card");
  assert.equal(empty.includes("could play it"), false);
});
