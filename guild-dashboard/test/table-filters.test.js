import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(new URL("../public/table-filters.js", import.meta.url), "utf8");

const ROWS = [
  { name: "Thok", sort: "000003", faction: "Horde", class: "Warrior", role: "Tank", server: "Normal", search: "warrior tank orc horde normal" },
  { name: "Una", sort: "000002", faction: "Horde", class: "Priest", role: "DPS", server: "Normal", search: "priest dps undead horde normal" },
  { name: "Mira", sort: "000001", faction: "Alliance", class: "Priest", role: "Healer", server: "PvP", search: "priest healer troll horde pvp" },
  { name: "Kor", sort: "000004", faction: "Alliance", class: "Hunter", role: "", server: "", search: "hunter troll" }
];

function harness({ saved = null, storageThrows = false, missing = false, withFaction = false, search = "", copy = null } = {}) {
  const urls = [];
  const handlers = {};
  const select = (extra = {}) => ({ value: "", options: [], add(option) { this.options.push(option); }, ...extra });
  const form = {
    elements: { search: { value: "" }, class: select(), role: select(), server: select(), sort: select({ value: "name" }), ...(withFaction ? { faction: select() } : {}) },
    addEventListener: (type, handler) => { handlers[type] = handler; }
  };
  const rows = ROWS.map(({ name, ...data }) => ({ dataset: { ...data }, hidden: false, cells: [{ textContent: `  ${name}  ` }] }));
  const body = { rows: [...rows], append(row) { this.rows = this.rows.filter((r) => r !== row); this.rows.push(row); } };
  const table = { tBodies: [body] };
  const count = { textContent: "", dataset: { singular: "member", plural: "members" } };
  const noResults = { hidden: true };
  const store = new Map(saved ? [["table-filters:/members", JSON.stringify(saved)]] : []);
  const sessionStorage = {
    getItem: (key) => { if (storageThrows) throw new Error("blocked"); return store.get(key) ?? null; },
    setItem: (key, value) => { if (storageThrows) throw new Error("blocked"); store.set(key, value); }
  };
  const copyButton = { textContent: "Copy names", handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
  const copyStatus = { textContent: "" };
  const timers = [];
  const scratch = { value: "", select() { scratch.selected = true; }, remove() { scratch.removed = true; } };
  const document = {
    createElement: () => scratch,
    body: { append() {} },
    execCommand: (command) => (copy?.execCommand ? copy.execCommand(command, scratch.value) : false),
    querySelector: (selector) => {
      if (missing) return null;
      return { "[data-census-filters]": form, "#census-table": table, "#visible-count": count, ".no-results": noResults, "[data-copy-names]": copy ? copyButton : null, "#copy-names-status": copy ? copyStatus : null }[selector] ?? null;
    }
  };
  vm.runInNewContext(script, vm.createContext({ document, navigator: { clipboard: copy?.clipboard }, window: { setTimeout: (fn, ms) => timers.push({ fn, ms }) }, sessionStorage, URLSearchParams, history: { replaceState: (_state, _title, url) => { urls.push(url); } }, location: { pathname: "/members", search, hash: "" }, Option: function Option(text, value) { return { text, value }; } }));
  const fire = () => { handlers.input?.(); handlers.change?.(); };
  const visible = () => body.rows.filter((r) => !r.hidden).map((r) => r.dataset.sort);
  const order = () => body.rows.map((r) => r.dataset.sort);
  return { rows, form, count, noResults, store, fire, visible, order, handlers, urls, copyButton, copyStatus, timers, scratch };
}

test("dropdowns list each distinct non-empty value once, sorted", () => {
  const { form } = harness();
  assert.deepEqual(form.elements.class.options.map((o) => o.value), ["Hunter", "Priest", "Warrior"]);
  assert.deepEqual(form.elements.role.options.map((o) => o.value), ["DPS", "Healer", "Tank"]);
  assert.deepEqual(form.elements.server.options.map((o) => o.value), ["Normal", "PvP"]);
});

test("search matches case-insensitively, updates the count with the right noun and reveals the empty message", () => {
  const h = harness();
  assert.equal(h.count.textContent, "4 members");
  assert.equal(h.noResults.hidden, true);

  h.form.elements.search.value = "  PRIEST ";
  h.fire();
  assert.deepEqual(h.visible().sort(), ["000001", "000002"]);
  assert.equal(h.count.textContent, "2 members");

  h.form.elements.search.value = "warrior";
  h.fire();
  assert.equal(h.count.textContent, "1 member");

  h.form.elements.search.value = "nothing matches this";
  h.fire();
  assert.equal(h.count.textContent, "0 members");
  assert.equal(h.noResults.hidden, false);
  assert.deepEqual(h.visible(), []);
});

test("class, role and ruleset filters combine with search", () => {
  const h = harness();
  h.form.elements.class.value = "Priest";
  h.fire();
  assert.deepEqual(h.visible().sort(), ["000001", "000002"]);
  h.form.elements.server.value = "Normal";
  h.fire();
  assert.deepEqual(h.visible(), ["000002"]);
  h.form.elements.role.value = "Healer";
  h.fire();
  assert.deepEqual(h.visible(), []);
  h.form.elements.role.value = "";
  h.form.elements.class.value = "";
  h.form.elements.server.value = "";
  h.form.elements.search.value = "troll";
  h.fire();
  assert.deepEqual(h.visible().sort(), ["000001", "000004"]);
});

test("rows sort by their sort key, or by class or role with the key as tie-break", () => {
  const h = harness();
  assert.deepEqual(h.order(), ["000001", "000002", "000003", "000004"]);

  h.form.elements.sort.value = "class";
  h.fire();
  assert.deepEqual(h.order(), ["000004", "000001", "000002", "000003"]);

  h.form.elements.sort.value = "role";
  h.fire();
  assert.deepEqual(h.order(), ["000004", "000002", "000001", "000003"]);
});

test("filter choices are remembered per page and restored on load", () => {
  const first = harness();
  first.form.elements.search.value = "priest";
  first.form.elements.sort.value = "class";
  first.fire();
  const saved = JSON.parse(first.store.get("table-filters:/members"));
  assert.equal(saved.search, "priest");
  assert.equal(saved.sort, "class");

  const reloaded = harness({ saved });
  assert.equal(reloaded.form.elements.search.value, "priest");
  assert.equal(reloaded.form.elements.sort.value, "class");
  assert.deepEqual(reloaded.visible().sort(), ["000001", "000002"], "restored filters are applied immediately");
});

test("unavailable or corrupt storage never breaks filtering", () => {
  const blocked = harness({ storageThrows: true });
  blocked.form.elements.search.value = "hunter";
  assert.doesNotThrow(() => blocked.fire());
  assert.deepEqual(blocked.visible(), ["000004"]);

  const garbage = harness({ saved: "not an object" });
  assert.equal(garbage.count.textContent, "4 members");
});

test("pages without the filter form or table are left alone", () => {
  const h = harness({ missing: true });
  assert.deepEqual(h.handlers, {});
  assert.equal(h.count.textContent, "");
});

test("a faction filter, when the page has one, lists factions, filters, combines and is remembered", () => {
  const h = harness({ withFaction: true });
  assert.deepEqual(h.form.elements.faction.options.map((o) => o.value), ["Alliance", "Horde"]);

  h.form.elements.faction.value = "Alliance";
  h.fire();
  assert.deepEqual(h.visible().sort(), ["000001", "000004"]);
  assert.equal(h.count.textContent, "2 members");

  h.form.elements.class.value = "Priest";
  h.fire();
  assert.deepEqual(h.visible(), ["000001"], "combines with the other filters");

  const saved = JSON.parse(h.store.get("table-filters:/members"));
  assert.equal(saved.faction, "Alliance");
  const reloaded = harness({ withFaction: true, saved });
  assert.equal(reloaded.form.elements.faction.value, "Alliance");
  assert.deepEqual(reloaded.visible(), ["000001"]);
});

test("pages without a faction filter ignore faction data entirely", () => {
  const h = harness();
  assert.equal(h.form.elements.faction, undefined);
  h.fire();
  assert.equal(h.visible().length, 4);
  assert.equal("faction" in JSON.parse(h.store.get("table-filters:/members") ?? "{}"), false);
});

test("filter choices are written to the address so a filtered view can be shared", () => {
  const h = harness({ withFaction: true });
  assert.deepEqual(h.urls, ["/members"], "an unfiltered page keeps a clean address");

  h.form.elements.faction.value = "Alliance";
  h.form.elements.class.value = "Priest";
  h.form.elements.search.value = "heal er";
  h.form.elements.sort.value = "class";
  h.fire();
  const url = h.urls.at(-1);
  assert.equal(url.startsWith("/members?"), true);
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("faction"), "Alliance");
  assert.equal(params.get("class"), "Priest");
  assert.equal(params.get("q"), "heal er");
  assert.equal(params.get("sort"), "class");
  assert.equal(params.has("role"), false, "unset filters are left out");

  h.form.elements.faction.value = "";
  h.form.elements.class.value = "";
  h.form.elements.search.value = "";
  h.form.elements.sort.value = "name";
  h.fire();
  assert.equal(h.urls.at(-1), "/members", "clearing every filter restores the clean address");
});

test("opening a shared link applies exactly that view, ignoring anything remembered", () => {
  const stale = { search: "warrior", class: "Warrior", faction: "Horde", sort: "role" };
  const h = harness({ withFaction: true, saved: stale, search: "?faction=Alliance&class=Priest&sort=class" });
  assert.equal(h.form.elements.faction.value, "Alliance");
  assert.equal(h.form.elements.class.value, "Priest");
  assert.equal(h.form.elements.sort.value, "class");
  assert.equal(h.form.elements.search.value, "", "remembered text does not leak into a shared link");
  assert.deepEqual(h.visible(), ["000001"]);
  assert.equal(h.count.textContent, "1 member");
});

test("shared links accept the search text and ruleset, and the address stays in sync after loading", () => {
  const h = harness({ search: "?q=troll&ruleset=PvP" });
  assert.equal(h.form.elements.search.value, "troll");
  assert.equal(h.form.elements.server.value, "PvP");
  assert.deepEqual(h.visible(), ["000001"]);
  const params = new URLSearchParams(h.urls.at(-1).split("?")[1]);
  assert.equal(params.get("q"), "troll");
  assert.equal(params.get("ruleset"), "PvP");
});

test("unknown or hostile values in a shared link are ignored and the remembered view is used instead", () => {
  const saved = { search: "priest", class: "", role: "", server: "", sort: "name" };
  const h = harness({ withFaction: true, saved, search: "?faction=Mordor&class=%3Cscript%3E&sort=drop%20table&role=Nobody" });
  assert.equal(h.form.elements.faction.value, "", "an option that does not exist is not applied");
  assert.equal(h.form.elements.class.value, "");
  assert.equal(h.form.elements.sort.value, "name", "an unknown sort falls back");
  assert.equal(h.form.elements.search.value, "priest", "with nothing usable in the link, the remembered view applies");
  assert.equal(h.urls.at(-1).includes("script"), false);
  assert.equal(harness({ search: `?q=${"x".repeat(500)}` }).form.elements.search.value.length, 100, "search text is capped");
});

test("an unavailable address bar never breaks filtering", () => {
  const h = harness();
  h.form.elements.search.value = "hunter";
  assert.doesNotThrow(() => h.fire());
  assert.deepEqual(h.visible(), ["000004"]);
});

test("Copy names copies the visible members in the order shown and says how many", async () => {
  let written = null;
  const h = harness({ withFaction: true, copy: { clipboard: { writeText: async (text) => { written = text; } } } });
  await h.copyButton.handlers.click();
  assert.equal(written, "Mira, Una, Thok, Kor", "names are trimmed and follow the current sort order");
  assert.equal(h.copyStatus.textContent, "Copied 4 names.");
  assert.equal(h.copyButton.textContent, "Copied!");
  h.timers[0].fn();
  assert.equal(h.copyButton.textContent, "Copy names");

  h.form.elements.faction.value = "Alliance";
  h.fire();
  await h.copyButton.handlers.click();
  assert.equal(written, "Mira, Kor", "only the filtered rows are copied");

  h.form.elements.search.value = "hunter";
  h.fire();
  await h.copyButton.handlers.click();
  assert.equal(written, "Kor");
  assert.equal(h.copyStatus.textContent, "Copied 1 name.");

  h.form.elements.sort.value = "class";
  h.form.elements.search.value = "";
  h.form.elements.faction.value = "";
  h.fire();
  await h.copyButton.handlers.click();
  assert.equal(written, "Kor, Mira, Una, Thok", "a different sort changes the copied order");
});

test("Copy names explains an empty result and a blocked clipboard, and falls back to selection", async () => {
  let written = null;
  const none = harness({ copy: { clipboard: { writeText: async (text) => { written = text; } } } });
  none.form.elements.search.value = "nobody matches this";
  none.fire();
  await none.copyButton.handlers.click();
  assert.equal(written, null, "nothing is copied when nothing matches");
  assert.match(none.copyStatus.textContent, /Nothing to copy/);

  const fallback = harness({ copy: { clipboard: { writeText: async () => { throw new Error("denied"); } }, execCommand: (command, value) => command === "copy" && value === "Mira, Una, Thok, Kor" } });
  await fallback.copyButton.handlers.click();
  assert.equal(fallback.scratch.selected, true, "the names were selected in a scratch box");
  assert.equal(fallback.scratch.removed, true, "and the scratch box was cleaned up");
  assert.equal(fallback.copyStatus.textContent, "Copied 4 names.");

  const blocked = harness({ copy: { clipboard: { writeText: async () => { throw new Error("denied"); } }, execCommand: () => false } });
  await blocked.copyButton.handlers.click();
  assert.match(blocked.copyStatus.textContent, /blocked by the browser/);
  assert.equal(blocked.copyButton.textContent, "Copy names");
});

test("pages without a Copy names button are unaffected", () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.copyButton.handlers), []);
});

test("the copy message is cleared when the filters change so it never describes an old view", async () => {
  const h = harness({ copy: { clipboard: { writeText: async () => {} } } });
  await h.copyButton.handlers.click();
  assert.equal(h.copyStatus.textContent, "Copied 4 names.");
  h.form.elements.search.value = "priest";
  h.fire();
  assert.equal(h.copyStatus.textContent, "", "the old message is gone");

  h.form.elements.search.value = "nothing matches";
  h.fire();
  await h.copyButton.handlers.click();
  assert.match(h.copyStatus.textContent, /Nothing to copy/);
  h.form.elements.search.value = "";
  h.fire();
  assert.equal(h.copyStatus.textContent, "", "so the empty-result warning does not linger");
});

test("Copy names cannot ping anyone or turn a name into Discord formatting", async () => {
  let written = null;
  const h = harness({ copy: { clipboard: { writeText: async (text) => { written = text; } } } });
  h.rows[0].cells[0].textContent = "@everyone";
  h.rows[1].cells[0].textContent = "<@&123>";
  h.rows[2].cells[0].textContent = "**Loud_Name**";
  await h.copyButton.handlers.click();
  assert.ok(!written.includes("@everyone") && !written.includes("<@"), "mentions are broken up");
  assert.ok(written.includes("\\*\\*Loud\\_Name\\*\\*"), "markdown is escaped");
  assert.ok(written.endsWith("Kor"), "plain names are untouched");
});
