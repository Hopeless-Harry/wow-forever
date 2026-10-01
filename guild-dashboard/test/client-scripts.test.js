import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

function runScript(name, context) {
  vm.runInNewContext(source(name), vm.createContext(context));
}

function liveRefreshHarness({ pageFetchedAt, response }) {
  const state = { reloads: 0, intervals: [], fetches: [] };
  const window = {
    location: { reload: () => { state.reloads += 1; } },
    setInterval: (callback, ms) => { state.intervals.push({ callback, ms }); return state.intervals.length; }
  };
  const fetch = async (url, options) => { state.fetches.push({ url, options }); return response(); };
  runScript("live-refresh.js", { document: { body: { dataset: { fetchedAt: pageFetchedAt } } }, window, fetch });
  return state;
}

test("live refresh polls every two minutes and reloads only when the data timestamp changed", async () => {
  const same = liveRefreshHarness({ pageFetchedAt: "A", response: async () => ({ ok: true, json: async () => ({ fetchedAt: "A" }) }) });
  assert.equal(same.intervals.length, 1);
  assert.equal(same.intervals[0].ms, 120_000);
  await same.intervals[0].callback();
  assert.equal(same.reloads, 0);
  assert.equal(same.fetches[0].url, "/api/public-data");
  assert.equal(same.fetches[0].options.cache, "no-store");

  const changed = liveRefreshHarness({ pageFetchedAt: "A", response: async () => ({ ok: true, json: async () => ({ fetchedAt: "B" }) }) });
  await changed.intervals[0].callback();
  assert.equal(changed.reloads, 1);
});

test("live refresh ignores errors, bad responses and payloads without a timestamp", async () => {
  const cases = {
    "HTTP error": async () => ({ ok: false, json: async () => ({ fetchedAt: "B" }) }),
    "network failure": async () => { throw new TypeError("fetch failed"); },
    "invalid JSON": async () => ({ ok: true, json: async () => { throw new SyntaxError("bad json"); } }),
    "missing timestamp": async () => ({ ok: true, json: async () => ({}) }),
    "null timestamp": async () => ({ ok: true, json: async () => ({ fetchedAt: null }) })
  };
  for (const [label, response] of Object.entries(cases)) {
    const state = liveRefreshHarness({ pageFetchedAt: "A", response });
    await assert.doesNotReject(async () => state.intervals[0].callback(), label);
    assert.equal(state.reloads, 0, label);
  }
});

function countdownHarness({ launch, now, present = true }) {
  const output = { textContent: "4 November 2026, 3 PM PST" };
  const intervals = [];
  const box = { dataset: { launch } };
  const document = { querySelector: (selector) => (!present ? null : selector === "[data-launch]" ? box : selector === "#launch-countdown" ? output : null) };
  const window = { setInterval: (callback, ms) => { intervals.push({ callback, ms }); } };
  const FakeDate = { now: () => now.value, parse: (value) => Date.parse(value) };
  runScript("countdown.js", { document, window, Date: FakeDate });
  return { output, intervals };
}

test("countdown shows days, hours and minutes and ticks every thirty seconds", () => {
  const launch = "2026-11-04T23:00:00Z";
  const now = { value: Date.parse("2026-10-01T18:57:00Z") };
  const { output, intervals } = countdownHarness({ launch, now });
  assert.equal(output.textContent, "34d 4h 3m");
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].ms, 30_000);

  now.value = Date.parse("2026-11-04T22:59:30Z");
  intervals[0].callback();
  assert.equal(output.textContent, "0d 0h 0m");
});

test("countdown announces the launch once the time has passed and never starts a timer", () => {
  const { output, intervals } = countdownHarness({ launch: "2026-11-04T23:00:00Z", now: { value: Date.parse("2026-11-05T00:00:00Z") } });
  assert.equal(output.textContent, "WoW Forever is live");
  assert.equal(intervals.length, 0);
});

test("countdown leaves the static fallback text for a bad date or a page without the banner", () => {
  const bad = countdownHarness({ launch: "not-a-date", now: { value: 0 } });
  assert.equal(bad.output.textContent, "4 November 2026, 3 PM PST");
  assert.equal(bad.intervals.length, 0);

  const missing = countdownHarness({ launch: "2026-11-04T23:00:00Z", now: { value: 0 }, present: false });
  assert.equal(missing.intervals.length, 0);
});

function syncTimeHarness({ datetime, now }) {
  const element = { textContent: "updated 12:00 UTC", getAttribute: (name) => (name === "datetime" ? datetime : null) };
  const intervals = [];
  const clock = { value: now };
  runScript("sync-time.js", {
    document: { querySelector: (selector) => (selector === "[data-sync-time]" && datetime !== undefined ? element : null) },
    window: { setInterval: (callback, ms) => { intervals.push({ callback, ms }); } },
    Date: { now: () => clock.value, parse: (value) => Date.parse(value) }
  });
  return { element, intervals, clock };
}

test("the sync time reads naturally from just now to days and keeps itself current", () => {
  const base = Date.parse("2026-10-01T12:00:00Z");
  const at = (ms) => syncTimeHarness({ datetime: "2026-10-01T12:00:00Z", now: base + ms }).element.textContent;
  assert.equal(at(5_000), "updated just now");
  assert.equal(at(60_000), "updated 1 min ago");
  assert.equal(at(59 * 60_000), "updated 59 min ago");
  assert.equal(at(60 * 60_000), "updated 1 hour ago");
  assert.equal(at(5 * 3_600_000), "updated 5 hours ago");
  assert.equal(at(24 * 3_600_000), "updated 1 day ago");
  assert.equal(at(3 * 86_400_000), "updated 3 days ago");

  const live = syncTimeHarness({ datetime: "2026-10-01T12:00:00Z", now: base });
  assert.equal(live.intervals[0].ms, 30_000);
  live.clock.value = base + 7 * 60_000;
  live.intervals[0].callback();
  assert.equal(live.element.textContent, "updated 7 min ago");
});

test("the sync time ignores a clock that is behind the server, a bad date and pages without it", () => {
  assert.equal(syncTimeHarness({ datetime: "2026-10-01T12:00:00Z", now: Date.parse("2026-10-01T11:00:00Z") }).element.textContent, "updated just now");
  const bad = syncTimeHarness({ datetime: "not a date", now: 0 });
  assert.equal(bad.element.textContent, "updated 12:00 UTC", "falls back to the server-rendered text");
  assert.equal(bad.intervals.length, 0);
  assert.equal(syncTimeHarness({ datetime: undefined, now: 0 }).intervals.length, 0);
});
