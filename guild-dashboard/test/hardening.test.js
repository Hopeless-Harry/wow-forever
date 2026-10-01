import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildApp } from "../src/app.js";
import { MemberStore } from "../src/data/member-store.js";
import { normalizeMembers, redactContact } from "../src/domain/members.js";
import { buildStats } from "../src/domain/stats.js";
import { createRateLimiter, isLoopback, limiterKey } from "../src/rate-limit.js";
import { mapping } from "./fixtures/sheet-rows.js";

const run = promisify(execFile);
const AT = "2026-09-22T12:00:00.000Z";
const entry = { server: "Normal", race: "Orc", characterClass: "Mage", role: "DPS", profession1: "A", profession2: "B" };
const member = (name) => ({ name, ...entry });

test("IPv6 clients are counted by /64 and IPv4-mapped addresses collapse", () => {
  assert.equal(limiterKey("2001:db8:abcd:12::1"), limiterKey("2001:db8:abcd:12:ffff:ffff:ffff:ffff"));
  assert.notEqual(limiterKey("2001:db8:abcd:12::1"), limiterKey("2001:db8:abcd:13::1"));
  assert.equal(limiterKey("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(limiterKey("203.0.113.9"), "203.0.113.9");
  assert.ok(isLoopback("::1") && isLoopback("127.0.0.1") && !isLoopback("203.0.113.9"));
});

test("a flood of distinct keys evicts the oldest instead of wiping everyone's counts", () => {
  const limiter = createRateLimiter({ limit: 2 });
  limiter.hit("heavy");
  limiter.hit("heavy");
  for (let i = 0; i < 10_050; i += 1) limiter.hit(`ip-${i}`);
  assert.ok(limiter.size() <= 10_000);
  limiter.hit("recent");
  limiter.hit("recent");
  assert.equal(limiter.hit("recent").allowed, false, "a recent heavy client keeps its count");
});

test("only the two health routes bypass the limiter and every page is no-store", async (t) => {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => ({ members: [member("Al")], events: [], fetchedAt: AT }) }, rateLimitPerMinute: 4, logger: false });
  t.after(() => app.close());

  assert.equal((await app.inject({ url: "/members" })).headers["cache-control"], "no-store");
  assert.equal((await app.inject({ url: "/members.csv" })).headers["cache-control"], "no-store");
  assert.equal((await app.inject({ url: "/assets/styles.css" })).headers["cache-control"], "public, max-age=3600");
  for (let i = 0; i < 5; i += 1) await app.inject({ url: `/health/other?x=${i}` });
  assert.equal((await app.inject({ url: "/health/other?x=final" })).statusCode, 429);
  assert.equal((await app.inject({ url: "/health/live?x=1" })).statusCode, 200);
});

test("a forged X-Forwarded-For does not change the client key and logs see the socket", async (t) => {
  const snapshot = { records: [], stats: buildStats([]), status: "fresh", fetchedAt: AT, lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, rateLimitPerMinute: 1, logger: false });
  t.after(() => app.close());
  assert.equal((await app.inject({ url: "/statistics", headers: { "x-forwarded-for": "1.1.1.1" } })).statusCode, 200);
  assert.equal((await app.inject({ url: "/statistics", headers: { "x-forwarded-for": "2.2.2.2" } })).statusCode, 429);
});

test("a corrupt roster file is preserved, a null file is survivable, and writes are private", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hardening-"));
  const file = path.join(dir, "members.json");

  await writeFile(file, '{"members": [', "utf8");
  const store = new MemberStore(file);
  assert.deepEqual(await store.read(), { members: [], events: [], fetchedAt: null });
  assert.ok((await readdir(dir)).some((name) => name.startsWith("members.json.corrupt-")), "corrupt file kept");

  await writeFile(file, "null", "utf8");
  assert.equal((await store.read()).members.length, 0);

  await store.write({ members: [member("Al")], events: [], fetchedAt: AT });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  await writeFile(`${file}.tmp`, "stale", { mode: 0o644 });
  await store.write({ members: [member("Bea")], events: [], fetchedAt: AT });
  assert.equal((await stat(file)).mode & 0o777, 0o600, "a loose stale temp file cannot leak its mode");

  const nested = new MemberStore(path.join(dir, "new", "deeper", "members.json"));
  await nested.write({ members: [], events: [], fetchedAt: AT });
  assert.equal((await stat(path.join(dir, "new"))).mode & 0o777, 0o700);
});

test("emails and phone numbers typed into the name field are removed", () => {
  assert.equal(redactContact("Jak#1234 jak@example.com"), "Jak#1234 [removed]");
  assert.equal(redactContact("Mira +44 7700 900123"), "Mira [removed]");
  assert.equal(redactContact("Thrall#12345"), "Thrall#12345");
  const rows = [["Name", ...Object.values(mapping)], ["Al call 555-123-4567", "Normal", "Orc", "Mage", "DPS", "A", "B"]];
  const members = normalizeMembers(rows, mapping, "Name");
  assert.equal(members[0].name, "Al call [removed]");
});

test("forget-member erases a member and their whole history", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "forget-"));
  const file = path.join(dir, "members.json");
  const store = new MemberStore(file);
  await store.write({
    members: [member("Al#1"), member("Bea#2")],
    events: [
      { type: "joined", at: AT, name: "Al#1", entry },
      { type: "changed", at: AT, name: "al#1", field: "class", from: "Priest", to: "Mage" },
      { type: "joined", at: AT, name: "Bea#2", entry }
    ],
    fetchedAt: AT
  });

  const script = path.resolve("scripts/forget-member.mjs");
  const { stdout } = await run("node", [script, "AL#1", file]);
  assert.match(stdout, /Removed 1 roster entry and 2 chronicle events/);
  const raw = await readFile(file, "utf8");
  assert.equal(raw.toLowerCase().includes("al#1"), false);
  assert.match(raw, /Bea#2/);
  assert.match((await run("node", [script, "Nobody", file])).stdout, /Nothing found/);
});
