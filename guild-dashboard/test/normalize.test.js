import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRows, PUBLIC_FIELDS } from "../src/domain/normalize.js";
import { mapping, PRIVATE_MARKERS, sheetRows } from "./fixtures/sheet-rows.js";

test("normalizes only explicitly public fields", () => {
  const result = normalizeRows(sheetRows, mapping);

  assert.equal(result.records.length, 2);
  assert.deepEqual(Object.keys(result.records[0]), PUBLIC_FIELDS);
  assert.deepEqual(result.records[0], {
    anonymousId: "Response #1",
    server: "Normal",
    race: "Undead",
    characterClass: "Priest",
    role: "Healer",
    profession1: "Tailoring",
    profession2: "Enchanting"
  });
  assert.equal(result.sourceRowCount, 3);
  assert.equal(result.rejectedRows, 1);
});

test("serialized normalized data contains no private fixture markers", () => {
  const serialized = JSON.stringify(normalizeRows(sheetRows, mapping));
  for (const marker of PRIVATE_MARKERS) {
    assert.equal(serialized.includes(marker), false, marker);
  }
});

test("fails closed when a required public header is missing", () => {
  const rows = sheetRows.map((row) => [...row]);
  rows[0][3] = "Renamed race field";

  assert.throws(() => normalizeRows(rows, mapping), /Missing required sheet header.*race/);
});

test("fails closed when a mapped header is duplicated", () => {
  const rows = sheetRows.map((row) => [...row]);
  rows[0].push("What class will your main be?");

  assert.throws(() => normalizeRows(rows, mapping), /Duplicate sheet header.*characterClass/);
});

test("returns an empty snapshot for a header-only sheet", () => {
  assert.deepEqual(normalizeRows([sheetRows[0]], mapping), {
    records: [],
    rejectedRows: 0,
    sourceRowCount: 0
  });
});
