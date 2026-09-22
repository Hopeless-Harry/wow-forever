import assert from "node:assert/strict";
import test from "node:test";

import { SheetSource } from "../src/data/sheet-source.js";

test("fetches the configured Sheets values range", async () => {
  let request;
  const source = new SheetSource({
    sheetId: "sheet id",
    sheetRange: "Form Responses 1!A:Z",
    tokenProvider: async () => "token",
    fetchFn: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ values: [["header"], ["value"]] }) };
    }
  });

  assert.deepEqual(await source.fetchRows(), [["header"], ["value"]]);
  assert.match(request.url, /sheet%20id\/values\/Form%20Responses%201!A%3AZ/);
  assert.equal(request.options.headers.authorization, "Bearer token");
});

test("rejects malformed Sheets payloads", async () => {
  const source = new SheetSource({
    sheetId: "sheet",
    sheetRange: "range",
    tokenProvider: async () => "token",
    fetchFn: async () => ({ ok: true, json: async () => ({}) })
  });
  await assert.rejects(source.fetchRows(), /did not contain rows/);
});
