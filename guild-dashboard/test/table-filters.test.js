import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(new URL("../public/table-filters.js", import.meta.url), "utf8");

const ROWS = [
  { sort: "000003", class: "Warrior", role: "Tank", server: "Normal", search: "warrior tank orc horde normal" },
  { sort: "000002", class: "Priest", role: "DPS", server: "Normal", search: "priest dps undead horde normal" },
  { sort: "000001", class: "Priest", role: "Healer", server: "PvP", search: "priest healer troll horde pvp" },
  { sort: "000004", class: "Hunter", role: "", server: "", search: "hunter troll" }
];

function harness({ saved = null, storageThrows = false, missing = false } = {}) {
  const handlers = {};
  const select = (extra = {}) => ({ value: "", options: [], add(option) { this.options.push(option); }, ...extra });
  const form = {
    elements: { search: { value: "" }, class: select(), role: select(), server: select(), sort: select({ value: "name" }) },
    addEventListener: (type, handler) => { handlers[type] = handler; }
  };
  const rows = ROWS.map((data) => ({ dataset: { ...data }, hidden: false }));
  const body = { rows: [...rows], append(row) { this.rows = this.rows.filter((r) => r !== row); this.rows.push(row); } };
  const table = { tBodies: [body] };
  const count = { textContent: "", dataset: { singular: "member", plural: "members" } };
  const noResults = { hidden: true };
  const store = new Map(saved ? [["table-filters:/members", JSON.stringify(saved)]] : []);
  const sessionStorage = {
    getItem: (key) => { if (storageThrows) throw new Error("blocked"); return store.get(key) ?? null; },
    setItem: (key, value) => { if (storageThrows) throw new Error("blocked"); store.set(key, value); }
  };
  const document = {
    querySelector: (selector) => {
      if (missing) return null;
      return { "[data-census-filters]": form, "#census-table": table, "#visible-count": count, ".no-results": noResults }[selector] ?? null;
    }
  };
  vm.runInNewContext(script, vm.createContext({ document, sessionStorage, location: { pathname: "/members" }, Option: function Option(text, value) { return { text, value }; } }));
  const fire = () => { handlers.input?.(); handlers.change?.(); };
  const visible = () => body.rows.filter((r) => !r.hidden).map((r) => r.dataset.sort);
  const order = () => body.rows.map((r) => r.dataset.sort);
  return { form, count, noResults, store, fire, visible, order, handlers };
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
