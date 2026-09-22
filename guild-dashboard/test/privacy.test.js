import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { buildStats } from "../src/domain/stats.js";
import { mapping, PRIVATE_MARKERS, sheetRows } from "./fixtures/sheet-rows.js";

test("private source markers never cross any browser response", async (t) => {
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
