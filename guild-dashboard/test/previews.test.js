import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildStats } from "../src/domain/stats.js";

const entry = { server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" };
const PAGES = ["/", "/responses", "/statistics", "/raid", "/members", "/members/chronicle", "/members/professions"];

function appFor(members, records) {
  const snapshot = { records, stats: buildStats(records), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  return buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members, events: [], fetchedAt: snapshot.fetchedAt }) }, logger: false, rateLimitPerMinute: 0 });
}

const meta = (body, key) => body.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)">`))?.[1];

test("every page carries a description and link-preview tags so a pasted link says what it is", async (t) => {
  const app = appFor([{ name: "Al#1", ...entry }], [{ anonymousId: "Response #1", ...entry }]);
  t.after(() => app.close());
  const seen = new Map();
  for (const url of PAGES) {
    const body = (await app.inject({ url })).body;
    const description = meta(body, "description");
    assert.ok(description && description.length > 20 && description.length <= 160, `${url} description: ${description}`);
    assert.equal(meta(body, "og:description"), description, `${url} preview description matches`);
    assert.match(meta(body, "og:title"), /· Moms Against Magic$/);
    assert.equal(meta(body, "og:site_name"), "Moms Against Magic");
    assert.equal(meta(body, "og:type"), "website");
    assert.equal(meta(body, "twitter:card"), "summary");
    assert.equal(seen.has(description), false, `${url} has its own description`);
    seen.set(description, url);
  }
  assert.equal(seen.size, PAGES.length);
});

test("preview text is static: it never contains guild data, names or numbers from the roster", async (t) => {
  const members = [{ name: "SecretlyNamedPlayer#9999", ...entry }];
  const records = Array.from({ length: 37 }, (_, i) => ({ anonymousId: `Response #${i + 1}`, ...entry }));
  const app = appFor(members, records);
  t.after(() => app.close());
  for (const url of [...PAGES, "/member?name=SecretlyNamedPlayer%239999"]) {
    const body = (await app.inject({ url })).body;
    const previews = [meta(body, "description"), meta(body, "og:description"), meta(body, "og:title")].join(" ");
    assert.equal(previews.includes("SecretlyNamedPlayer"), false, `${url} preview leaks a name`);
    assert.equal(/\b37\b/.test(previews), false, `${url} preview shows a live count that would go stale in a cache`);
  }
});

test("a hostile page title cannot break out of the preview tags, and error pages get the default description", async (t) => {
  const app = appFor([{ name: '"><script>alert(1)</script>', ...entry }], [{ anonymousId: "Response #1", ...entry }]);
  t.after(() => app.close());
  const profile = (await app.inject({ url: `/member?name=${encodeURIComponent('"><script>alert(1)</script>')}` })).body;
  assert.equal(profile.includes("<script>alert"), false);
  assert.equal(meta(profile, "og:title"), "Guild member profile · Moms Against Magic", "link previews never carry a member name");
  assert.match(profile, /<title>&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; · Moms Against Magic<\/title>/, "the page title still shows the name, escaped");

  const missing = (await app.inject({ url: "/nope" })).body;
  assert.equal(meta(missing, "description"), "Moms Against Magic guild ledger for WoW Forever.");
  assert.equal(meta(missing, "og:title"), "Page not found · Moms Against Magic");
});
