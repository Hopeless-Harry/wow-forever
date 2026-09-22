import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildStats } from "../src/domain/stats.js";

const record = {
  anonymousId: "Response #1",
  server: "Normal",
  race: "Undead",
  characterClass: "Priest",
  role: "Healer",
  profession1: "Tailoring",
  profession2: "Enchanting"
};

function service(snapshotOverrides = {}) {
  const records = snapshotOverrides.records ?? [record];
  return {
    snapshot: () => ({
      records,
      stats: buildStats(records),
      fetchedAt: "2026-09-22T12:00:00.000Z",
      status: "fresh",
      lastRefreshFailed: false,
      rejectedRows: 0,
      ...snapshotOverrides
    })
  };
}

test("serves the three Guild Ledger pages", async (t) => {
  const app = buildApp({ dataService: service(), logger: false });
  t.after(() => app.close());

  for (const [url, heading] of [["/", "Guild Ledger"], ["/responses", "Guild Census"], ["/statistics", "Guild Statistics"]]) {
    const response = await app.inject({ url });
    assert.equal(response.statusCode, 200, url);
    assert.match(response.body, new RegExp(heading));
    assert.match(response.headers["content-type"], /text\/html/);
  }
});

test("escapes sheet values before rendering HTML", async (t) => {
  const records = [{ ...record, server: "<script>alert(1)</script>" }];
  const app = buildApp({ dataService: service({ records }), logger: false });
  t.after(() => app.close());

  const response = await app.inject({ url: "/responses" });
  assert.doesNotMatch(response.body, /<script>alert/);
  assert.match(response.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("returns only the public API shape", async (t) => {
  const unsafeRecords = [{ ...record, name: "SecretName#1234", comment: "private comment" }];
  const app = buildApp({ dataService: service({ records: unsafeRecords, stats: buildStats([record]), privateDebug: "SecretName#1234" }), logger: false });
  t.after(() => app.close());

  const response = await app.inject({ url: "/api/public-data" });
  const body = response.json();
  assert.deepEqual(Object.keys(body).sort(), ["fetchedAt", "lastRefreshFailed", "records", "stats", "status"]);
  assert.equal(response.body.includes("privateDebug"), false);
  assert.deepEqual(Object.keys(body.records[0]), ["anonymousId", "server", "race", "characterClass", "role", "profession1", "profession2"]);
  assert.equal(response.body.includes("SecretName#1234"), false);
  assert.equal(response.body.includes("private comment"), false);
});

test("applies restrictive public security headers", async (t) => {
  const app = buildApp({ dataService: service(), logger: false });
  t.after(() => app.close());
  const response = await app.inject({ url: "/" });

  assert.match(response.headers["content-security-policy"], /default-src 'self'/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-frame-options"], "DENY");
});

test("distinguishes process and data readiness", async (t) => {
  const app = buildApp({ dataService: service({ records: [], stats: buildStats([]), status: "empty", fetchedAt: null }), logger: false });
  t.after(() => app.close());

  assert.equal((await app.inject({ url: "/health/live" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/health/ready" })).statusCode, 503);
});
