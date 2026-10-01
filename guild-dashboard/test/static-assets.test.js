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

test("launch countdown is a banner outside the overview grid and phone nav wraps instead of hiding links", async (t) => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /\.launch-banner\s*\{/);
  assert.match(css, /\.guild-rail nav\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.doesNotMatch(css, /\.guild-rail nav\s*\{[^}]*overflow-x:\s*auto/);

  const app = buildApp({ dataService: safeService(), logger: false });
  t.after(() => app.close());
  const body = (await app.inject({ url: "/" })).body;
  const banner = body.indexOf('class="launch-banner"');
  assert.ok(banner > 0 && banner < body.indexOf('class="ledger-overview"'), "banner precedes the overview");
  assert.match(body, /id="launch-countdown"/);
});

test("text colours on parchment meet 4.5:1 contrast even at the darkest end of the gradient", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const darkestParchment = "#c3a363";
  const selectors = [
    ".panel-heading span", ".panel-heading p", ".parchment-panel .quiet", ".chronicle-entry time", ".profile-facts dt",
    ".raid-panel th small", ".plan-ready .plan-badge", ".plan-short .plan-badge", ".plan-missing .plan-badge", ".combo-flag"
  ];
  for (const selector of selectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped}[^{]*\\{[^}]*?(?:^|[;\\s])color:\\s*(#[0-9a-fA-F]{6})`, "m"));
    assert.ok(match, `${selector} sets a solid colour`);
    assert.ok(ratio(match[1], darkestParchment) >= 4.5, `${selector} ${match[1]} is ${ratio(match[1], darkestParchment).toFixed(2)}:1`);
  }
  assert.doesNotMatch(css, /\.chronicle-entry time[^{]*\{[^}]*opacity/);
});

test("every table is named and filter feedback is announced to screen readers", async (t) => {
  const records = [{ anonymousId: "Response #1", server: "Normal", race: "Orc", characterClass: "Warrior", role: "Tank", profession1: "Mining", profession2: "Skinning" }];
  const memberData = { members: [{ name: "Al#1", ...records[0] }], events: [], fetchedAt: "2026-09-22T12:00:00.000Z" };
  const snapshot = { records, stats: buildStats(records), fetchedAt: memberData.fetchedAt, status: "fresh", lastRefreshFailed: false };
  const app = buildApp({ dataService: { snapshot: () => snapshot, memberSnapshot: () => memberData }, logger: false, rateLimitPerMinute: 0 });
  t.after(() => app.close());

  let tables = 0;
  for (const url of ["/", "/responses", "/statistics", "/members", "/members/chronicle", "/members/professions", "/raid", "/member?name=Al%231"]) {
    const body = (await app.inject({ url })).body;
    for (const tag of body.match(/<table[^>]*>/g) ?? []) {
      tables += 1;
      assert.match(tag, /aria-label="[^"]+"/, `${url} has an unnamed table: ${tag}`);
    }
  }
  assert.ok(tables >= 5, "tables were actually checked");

  for (const url of ["/responses", "/members"]) {
    const body = (await app.inject({ url })).body;
    assert.match(body, /id="visible-count" aria-live="polite" aria-atomic="true"/);
    assert.match(body, /class="no-results" role="status" hidden/);
  }
});

test("a print stylesheet hides navigation and controls and keeps cards whole", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.ok(css.includes("@media print"));
  assert.match(print, /\.guild-rail[^}]*display:\s*none/);
  assert.match(print, /\.census-tools[^}]*display:\s*none/);
  assert.match(print, /\.group-card[^}]*break-inside:\s*avoid/);
  assert.match(print, /background:\s*#fff/);
  assert.match(print, /\.statistics-grid[^}]*display:\s*block/, "grids collapse to one full-width column");
});

test("every class colour is readable on the darkest parchment", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const classes = ["warrior", "paladin", "hunter", "rogue", "priest", "shaman", "mage", "warlock", "druid"];
  for (const name of classes) {
    const match = css.match(new RegExp(`\\.class-${name}\\s*\\{\\s*color:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(match, `${name} has a colour`);
    assert.ok(ratio(match[1], "#c3a363") >= 4.5, `${name} ${match[1]} is ${ratio(match[1], "#c3a363").toFixed(2)}:1`);
  }
});

test("raid tables use a fixed three-column layout so Status never scrolls out of view", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  assert.match(css, /\.raid-panel table\s*\{[^}]*table-layout:\s*fixed/);
  for (const column of [1, 2, 3]) assert.match(css, new RegExp(`\\.raid-panel th:nth-child\\(${column}\\)\\s*\\{\\s*width:`));
  assert.match(css, /\.raid-panel tbody th\s*\{\s*white-space:\s*normal/, "row descriptions wrap instead of overlapping the next column");
});

test("on phones the headline stat cards sit two per row so the raid answer is not pushed off screen", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  const phone = css.slice(css.indexOf("@media (max-width: 700px)"));
  assert.match(phone, /\.stat-rack\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.doesNotMatch(phone, /\.stat-rack,\s*\.dashboard-grid/, "stat cards no longer collapse to one column");
});

test("on phones the first column of scrolling tables stays pinned and opaque", async () => {
  const css = await readFile(path.join(projectRoot, "public", "styles.css"), "utf8");
  const start = css.indexOf("keep the name column pinned");
  assert.ok(start > 0, "the pinned-column block is present");
  const phone = css.slice(start, css.indexOf("@media (max-width: 700px)", start) + 900);
  assert.match(phone, /\.table-scroll tbody th\[scope="row"\]\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0/);
  assert.match(phone, /\.table-scroll tbody th\[scope="row"\]\s*\{[^}]*background:\s*#[0-9a-f]{6}/i, "opaque, so scrolled cells do not show through");
  assert.match(phone, /\.table-scroll thead th:first-child\s*\{[^}]*position:\s*sticky/);
  assert.match(phone, /max-width:\s*8\.5rem/, "a very long name cannot take over the screen");
  assert.match(phone, /\.table-scroll tbody th\[scope="row"\] a\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*break-word/, "the link inside wraps within the cell instead of spilling over its neighbours");
});
