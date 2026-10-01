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

test("a hung Google request times out instead of freezing every later refresh", async () => {
  const hung = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason));
  });
  const source = new SheetSource({ sheetId: "id", sheetRange: "A:Z", tokenProvider: async () => "t", fetchFn: hung, timeoutMs: 40 });
  const started = Date.now();
  const keepAlive = setTimeout(() => {}, 2000); // AbortSignal.timeout timers are unref'd; a real server stays alive on its socket
  try {
    await assert.rejects(() => source.fetchRows(), (error) => error.name === "TimeoutError");
  } finally {
    clearTimeout(keepAlive);
  }
  assert.ok(Date.now() - started < 1000, "gave up quickly");
});
