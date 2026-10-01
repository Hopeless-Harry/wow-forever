import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { buildStats } from "../src/domain/stats.js";

const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform";
const entry = { server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" };

test("FORM_URL is optional, must be a real https address, and is normalised", () => {
  assert.equal(loadConfig({}).formUrl, "");
  assert.equal(loadConfig({ FORM_URL: "" }).formUrl, "");
  assert.equal(loadConfig({ FORM_URL: FORM }).formUrl, FORM);
  assert.equal(loadConfig({ FORM_URL: "https://Example.com/a b" }).formUrl, "https://example.com/a%20b");
  for (const bad of ["http://example.com/form", "javascript:alert(1)", "data:text/html,<script>", "ftp://example.com", "not a url", "//example.com", `https://example.com/${"a".repeat(300)}`]) {
    assert.throws(() => loadConfig({ FORM_URL: bad }), /FORM_URL must be a full https:\/\/ address/, bad.slice(0, 40));
  }
});

function appWith(formUrl) {
  const members = [{ name: "Al#1", ...entry }];
  const records = [{ anonymousId: "Response #1", ...entry }];
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  return buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, formUrl, logger: false, rateLimitPerMinute: 0 });
}

test("the dashboard and roster offer an Add yourself button that opens the Form safely in a new tab", async (t) => {
  const app = appWith(FORM);
  t.after(() => app.close());
  for (const url of ["/", "/members"]) {
    const body = (await app.inject({ url })).body;
    assert.match(body, new RegExp(`<p class="join-bar"><span>Not on the roster yet\\?</span> <a class="wow-button" href="${FORM.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" target="_blank" rel="noopener noreferrer">Add yourself<span class="visually-hidden"> \\(opens the sign-up Form in a new tab\\)</span></a></p>`), url);
  }
  const dashboard = (await app.inject({ url: "/" })).body;
  assert.ok(dashboard.indexOf("join-bar") < dashboard.indexOf('class="ledger-overview"'), "sits above the headline numbers");
});

test("without a Form address nothing is shown, and other pages never carry the button", async (t) => {
  const none = appWith("");
  t.after(() => none.close());
  for (const url of ["/", "/members"]) assert.equal((await none.inject({ url })).body.includes("join-bar"), false, url);

  const some = appWith(FORM);
  t.after(() => some.close());
  for (const url of ["/responses", "/statistics", "/raid", "/members/chronicle", "/members/professions", "/summary.txt"]) {
    assert.equal((await some.inject({ url })).body.includes("docs.google.com"), false, `${url} stays free of the sign-up link`);
  }
});

test("the address is escaped inside the attribute and never reaches the data API or the summary", async (t) => {
  const app = appWith('https://example.com/form?a=1&b="x"');
  t.after(() => app.close());
  const body = (await app.inject({ url: "/" })).body;
  assert.match(body, /href="https:\/\/example\.com\/form\?a=1&amp;b=&quot;x&quot;"/, "even a raw address is escaped by the page, on top of the config normalising it");
  assert.equal(body.includes('b="x"'), false, "a quote cannot close the attribute");

  const api = (await app.inject({ url: "/api/public-data" })).json();
  assert.equal("formUrl" in api, false, "the public data payload keeps its fixed shape");
  assert.equal(JSON.stringify(api).includes("example.com"), false);
});
