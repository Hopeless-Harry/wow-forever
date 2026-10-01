import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { buildStats } from "../src/domain/stats.js";
import { mapping, PRIVATE_MARKERS, sheetRows } from "./fixtures/sheet-rows.js";

test("private columns never cross any browser response; names appear only on member pages", async (t) => {
  const normalized = normalizeRows(sheetRows, mapping);
  const snapshot = {
    ...normalized,
    stats: buildStats(normalized.records),
    fetchedAt: "2026-09-22T12:00:00.000Z",
    status: "fresh",
    lastRefreshFailed: false,
    rawRows: sheetRows
  };
  const app = buildApp({ dataService: { snapshot: () => snapshot }, logger: false });
  t.after(() => app.close());

  for (const url of ["/", "/responses", "/statistics", "/api/public-data"]) {
    const response = await app.inject({ url });
    for (const marker of PRIVATE_MARKERS) {
      assert.equal(response.body.includes(marker), false, `${url} leaked ${marker}`);
    }
  }
});

test("page copy never promises secrecy or anonymity, since names are public", async (t) => {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" }];
  const memberData = { members: [{ name: "Al#1", ...records[0] }], events: [{ type: "left", at: "2026-09-22T12:00:00.000Z", name: "Bea#2" }], fetchedAt: "2026-09-22T12:00:00.000Z" };
  const snapshot = { records, stats: buildStats(records), fetchedAt: memberData.fetchedAt, status: "fresh", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());

  for (const url of ["/", "/responses", "/statistics", "/raid", "/members", "/members/chronicle", "/members/professions", "/member?name=Al%231", "/member?name=nobody"]) {
    const visible = (await app.inject({ url })).body
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(visible, /sealed|vault|anonymous|never leave|without revealing/i, `${url} still implies secrecy`);
  }
});
