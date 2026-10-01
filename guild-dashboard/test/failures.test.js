import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { DataService } from "../src/data/data-service.js";
import { classifyError } from "../src/data/errors.js";
import { MemberStore } from "../src/data/member-store.js";
import { normalizeMembers } from "../src/domain/members.js";
import { normalizeRows } from "../src/domain/normalize.js";
import { mapping, sheetRows } from "./fixtures/sheet-rows.js";

const NAME_HEADER = "What is your BattleTag and name?";
const quiet = { info() {}, error() {} };

test("classifies failures into actionable categories", () => {
  assert.equal(classifyError(new Error("Missing required sheet header for role")), "mapping");
  assert.equal(classifyError(new Error("Duplicate sheet header for race")), "mapping");
  assert.equal(classifyError(new Error("Google Sheets request failed with status 403")), "access");
  assert.equal(classifyError(new Error("Google Sheets request failed with status 404")), "access");
  assert.equal(classifyError(new Error("Google token exchange failed with status 400")), "credentials");
  assert.equal(classifyError(new Error("Google service account credentials are incomplete")), "credentials");
  assert.equal(classifyError(new Error("Google Sheets request failed with status 503")), "unreachable");
  assert.equal(classifyError(new TypeError("fetch failed")), "unreachable");
});

function service(fetchRows, extra = {}) {
  let stored = null;
  return new DataService({
    source: { fetchRows },
    normalize: normalizeRows,
    mapping,
    cacheStore: { read: async () => stored, write: async (v) => { stored = structuredClone(v); }, getStatus: () => (stored ? "fresh" : "empty") },
    logger: quiet,
    ...extra
  });
}

const page = async (svc, url = "/statistics") => {
  const app = buildApp({ dataService: svc, logger: false });
  const res = await app.inject({ url });
  await app.close();
  return res.body;
};

test("each failure kind is explained on the page, and the last good data stays", async () => {
  const cases = [
    [new Error("Missing required sheet header for role"), /Form(?:'|&#39;)s questions changed/],
    [new Error("Google Sheets request failed with status 403"), /refused access to the Sheet/],
    [new Error("Google token exchange failed with status 400"), /credentials need attention/],
    [new Error("Google Sheets request failed with status 502"), /Google is unreachable/]
  ];
  for (const [error, expected] of cases) {
    let fail = false;
    const svc = service(async () => { if (fail) throw error; return sheetRows; });
    await svc.refresh();
    fail = true;
    await svc.refresh();
    assert.equal(svc.snapshot().records.length, 2);
    assert.match(await page(svc), expected);
  }
});

test("recovering clears the error and returns to the synced message", async () => {
  let fail = true;
  const svc = service(async () => { if (fail) throw new Error("Google Sheets request failed with status 403"); return sheetRows; });
  await svc.refresh();
  assert.equal(svc.snapshot().lastErrorKind, "access");
  fail = false;
  await svc.refresh();
  assert.equal(svc.snapshot().lastErrorKind, null);
  assert.match(await page(svc), /Guild census synced/);
});

test("a synced but empty sheet says no responses yet instead of asking to link the Form", async () => {
  const svc = service(async () => [sheetRows[0]]);
  await svc.refresh();
  const body = await page(svc, "/");
  assert.match(body, /No responses yet/);
  assert.equal(body.includes("Link the Form"), false);

  const fresh = service(async () => { throw new Error("Google Sheets request failed with status 503"); });
  await fresh.refresh();
  assert.match(await page(fresh, "/"), /Link the Form/);
});

test("incomplete responses are reported in the footer", async () => {
  const svc = service(async () => sheetRows);
  await svc.refresh();
  assert.match(await page(svc, "/"), /1 incomplete response was skipped/);
});

test("a renamed name question keeps the census working and warns on the roster", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "failures-"));
  const svc = service(async () => sheetRows, { memberStore: new MemberStore(path.join(dir, "members.json")), normalizeMembers, nameHeader: NAME_HEADER });
  await svc.refresh();
  assert.equal(svc.memberSnapshot().error, null);
  assert.equal(svc.memberSnapshot().members.length, 2);

  svc.nameHeader = "Renamed question";
  await svc.refresh();
  assert.equal(svc.snapshot().records.length, 2, "anonymous census unaffected");
  assert.equal(svc.memberSnapshot().error, "mapping");
  assert.equal(svc.memberSnapshot().members.length, 2, "last saved roster kept");
  assert.match(await page(svc, "/members"), /name question changed on the Form/);

  svc.nameHeader = NAME_HEADER;
  await svc.refresh();
  assert.equal(svc.memberSnapshot().error, null);
});
