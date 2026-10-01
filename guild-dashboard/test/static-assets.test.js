import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/app.js";
import { buildStats } from "../src/domain/stats.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function safeService() {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Undead", characterClass: "Priest", role: "Healer", profession1: "Tailoring", profession2: "Enchanting" }];
  return { snapshot: () => ({ records, stats: buildStats(records), fetchedAt: new Date().toISOString(), status: "fresh", lastRefreshFailed: false }) };
}

test("serves local styles and scripts with no external asset dependency", async (t) => {
  const app = buildApp({ dataService: safeService(), logger: false });
  t.after(() => app.close());

  for (const url of ["/assets/styles.css", "/assets/table-filters.js", "/assets/live-refresh.js"]) {
    const response = await app.inject({ url });
    assert.equal(response.statusCode, 200, url);
    assert.doesNotMatch(response.body, /https?:\/\//);
  }
});

test("visual system includes keyboard, motion, mobile, and overflow safeguards", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.table-scroll[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media[^{}]*max-width:\s*700px/);
  assert.match(css, /font-size:\s*1rem/);
  assert.doesNotMatch(css, /url\(["']?https?:/);
});

test("census controls have accessible labels and a usable table", async (t) => {
  const app = buildApp({ dataService: safeService(), logger: false });
  t.after(() => app.close());
  const body = (await app.inject({ url: "/responses" })).body;

  assert.match(body, /<main id="main-content"/);
  assert.match(body, /<label>Search the census<input type="search"/);
  assert.match(body, /<th scope="row">Response #1<\/th>/);
  assert.match(body, /<nav>/);
});

test("raid tables stay inside their panels on phones and pages ship an inline favicon", async (t) => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /\.raid-panel table\s*\{\s*min-width:\s*0/);
  assert.match(css, /\.statistics-grid > \*[^{]*\{\s*min-width:\s*0/);

  const app = buildApp({ dataService: safeService(), logger: false });
  t.after(() => app.close());
  const body = (await app.inject({ url: "/raid" })).body;
  assert.match(body, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.equal(body.match(/<div class="table-scroll">/g)?.length >= 2, true);
});

test("inline links get phone-sized tap targets", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /th\[scope="row"\] a[^{]*\{[^}]*padding:\s*\.55rem 0/);
  assert.match(css, /\.member-tabs a\s*\{[^}]*min-height:\s*2\.75rem/);
});

test("long free-text values wrap instead of widening the page", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /\.ledger-main\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.group-card[^{]*\{\s*min-width:\s*0/);
});

test("the sync badge cannot be crushed by a long page title", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /\.ledger-topbar\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.sync-rune\s*\{[^}]*min-width:\s*9rem/);
});
