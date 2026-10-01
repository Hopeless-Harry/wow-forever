import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildStats } from "../src/domain/stats.js";

const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
const build = (overrides = {}) => buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [], events: [], fetchedAt: null }), ...overrides }, logger: false, rateLimitPerMinute: 0 });

test("a mistyped or outdated page link shows a friendly in-app page, not raw JSON", async (t) => {
  const app = build();
  t.after(() => app.close());
  for (const url of ["/nope", "/members/nope", "/raid/old-link", "/member/Al"]) {
    const res = await app.inject({ url });
    assert.equal(res.statusCode, 404, url);
    assert.match(res.headers["content-type"], /text\/html/);
    assert.match(res.body, /<h2>That page isn&#39;t here<\/h2>/);
    assert.match(res.body, /Back to the dashboard/);
    assert.match(res.body, /href="\/members">roster<\/a>/);
    assert.match(res.body, /<nav>/, "the normal navigation is present");
    assert.equal(res.body.includes('"statusCode"'), false, "no raw framework JSON");
  }
});

test("a malformed address also gets a friendly page", async (t) => {
  const app = build();
  t.after(() => app.close());
  const res = await app.inject({ url: "/%" });
  assert.equal(res.statusCode, 400);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.body, /That link doesn&#39;t look right/);
  assert.equal(res.body.includes("FST_ERR"), false, "no internal error code");
});

test("data and asset routes keep short JSON that never repeats the address", async (t) => {
  const app = build();
  t.after(() => app.close());
  for (const url of ["/api/nope", "/assets/nope.css", "/assets/<script>alert(1)</script>.js"]) {
    const res = await app.inject({ url });
    assert.equal(res.statusCode, 404, url);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.deepEqual(res.json(), { error: "Not found" });
  }
  const post = await app.inject({ method: "POST", url: "/members", payload: "x=1" });
  assert.equal(post.statusCode, 404);
  assert.match(post.headers["content-type"], /application\/json/, "only page reads get a page");
});

test("an unexpected failure shows a calm page without any error detail", async (t) => {
  const app = build();
  app.get("/boom", async () => { throw new Error("secret database path /var/lib/guild-ledger/members.json"); });
  t.after(() => app.close());
  const res = await app.inject({ url: "/boom" });
  assert.equal(res.statusCode, 500);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.body, /The ledger hit a problem/);
  assert.match(res.body, /try again in a minute/i);
  assert.equal(res.body.includes("secret"), false);
  assert.equal(res.body.includes("/var/lib"), false);

  const broken = build({ snapshot: () => { throw new Error("cache exploded"); } });
  t.after(() => broken.close());
  const down = await broken.inject({ url: "/nope" });
  assert.equal(down.statusCode, 404, "even with the data layer failing, the error page still renders");
  assert.equal(down.body.includes("cache exploded"), false);
  assert.match(down.body, /That page isn&#39;t here/);
});

test("the address is never reflected into the error page, and security headers are always sent", async (t) => {
  const app = build();
  t.after(() => app.close());
  const hostile = await app.inject({ url: "/%3Cscript%3Ealert(1)%3C/script%3E" });
  assert.equal(hostile.statusCode, 404);
  assert.equal(hostile.body.includes("alert(1)"), false);
  assert.equal(hostile.body.includes("<script>alert"), false);

  for (const url of ["/nope", "/%", "/api/nope", "/assets/nope.css"]) {
    const res = await app.inject({ url });
    assert.match(res.headers["content-security-policy"], /default-src 'self'/, url);
    assert.equal(res.headers["x-content-type-options"], "nosniff", url);
    assert.equal(res.headers["x-frame-options"], "DENY", url);
    assert.equal(res.headers["cache-control"], "no-store", url);
  }
});
