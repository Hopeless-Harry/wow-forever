import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createRateLimiter } from "../src/rate-limit.js";
import { buildStats } from "../src/domain/stats.js";

test("limits per key within a window and resets afterwards", () => {
  let clock = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => clock });
  assert.equal(limiter.hit("a").allowed, true);
  assert.equal(limiter.hit("a").allowed, true);
  const blocked = limiter.hit("a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 60);
  assert.equal(limiter.hit("b").allowed, true);
  clock += 60_001;
  assert.equal(limiter.hit("a").allowed, true);
});

test("a limit of zero disables limiting and memory stays bounded", () => {
  const off = createRateLimiter({ limit: 0 });
  for (let i = 0; i < 1000; i += 1) assert.equal(off.hit("a").allowed, true);

  const limiter = createRateLimiter({ limit: 5 });
  for (let i = 0; i < 25_000; i += 1) limiter.hit(`ip-${i}`);
  assert.ok(limiter.size() <= 10_000);
});

test("app answers 429 with Retry-After but never throttles health checks", async (t) => {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, rateLimitPerMinute: 3, logger: false });
  t.after(() => app.close());

  for (let i = 0; i < 3; i += 1) assert.equal((await app.inject({ url: "/statistics" })).statusCode, 200);
  const blocked = await app.inject({ url: "/statistics" });
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["retry-after"]) >= 1);
  assert.match(blocked.headers["content-security-policy"], /default-src 'self'/);
  assert.equal(blocked.headers["x-content-type-options"], "nosniff");
  for (let i = 0; i < 10; i += 1) assert.equal((await app.inject({ url: "/health/live" })).statusCode, 200);
});

test("rate limit setting is validated", () => {
  assert.equal(loadConfig({}).rateLimitPerMinute, 300);
  assert.equal(loadConfig({ RATE_LIMIT_PER_MINUTE: "0" }).rateLimitPerMinute, 0);
  assert.throws(() => loadConfig({ RATE_LIMIT_PER_MINUTE: "-1" }), /RATE_LIMIT_PER_MINUTE/);
});

test("spoofed X-Forwarded-For cannot dodge the limit, but real clients are counted separately", async (t) => {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: "2026-09-22T12:00:00.000Z", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, rateLimitPerMinute: 2, logger: false });
  t.after(() => app.close());

  const codes = [];
  for (let i = 0; i < 4; i += 1) codes.push((await app.inject({ url: "/statistics", headers: { "x-forwarded-for": `9.9.9.${i}` } })).statusCode);
  assert.deepEqual(codes, [200, 200, 429, 429]);

  const a = await app.inject({ url: "/statistics", headers: { "cf-connecting-ip": "1.1.1.1" } });
  const b = await app.inject({ url: "/statistics", headers: { "cf-connecting-ip": "2.2.2.2" } });
  assert.equal(a.statusCode, 200);
  assert.equal(b.statusCode, 200);
});
