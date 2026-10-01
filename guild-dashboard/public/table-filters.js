(() => {
  const form = document.querySelector("[data-census-filters]");
  const table = document.querySelector("#census-table");
  if (!form || !table) return;

  const body = table.tBodies[0];
  const originalRows = [...body.rows];
  const count = document.querySelector("#visible-count");
  const noResults = document.querySelector(".no-results");
  const storageKey = `table-filters:${location.pathname}`;

  const selects = ["class", "role", "server", "faction"].filter((name) => form.elements[name]);
  for (const name of selects) {
    const select = form.elements[name];
    const values = [...new Set(originalRows.map((row) => row.dataset[name]).filter(Boolean))].sort();
    for (const value of values) select.add(new Option(value, value));
  }

  function remember() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(
        ["search", ...selects, "sort"].map((field) => [field, form.elements[field].value])
      )));
    } catch {
      // Filters simply reset on reload when storage is unavailable.
    }
  }

  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      for (const field of ["search", ...selects, "sort"]) {
        if (typeof saved[field] === "string") form.elements[field].value = saved[field];
      }
    } catch {
      // Ignore unreadable saved state.
    }
  }

  // Filters live in the address (?q=…&class=…&faction=…&ruleset=…&sort=…) so a filtered view can be shared.
  const URL_KEYS = { search: "q", class: "class", role: "role", faction: "faction", server: "ruleset", sort: "sort" };
  const SORTS = ["name", "class", "role"];

  function readUrl() {
    let found = false;
    try {
      const params = new URLSearchParams(location.search);
      for (const [field, key] of Object.entries(URL_KEYS)) {
        const control = form.elements[field];
        const value = params.get(key);
        if (!control || value === null) continue;
        if (field === "search") {
          control.value = value.slice(0, 100);
          found = true;
        } else if (field === "sort") {
          if (SORTS.includes(value)) { control.value = value; found = true; }
        } else if ([...control.options].some((option) => option.value === value)) {
          control.value = value;
          found = true;
        }
      }
    } catch {
      // A malformed address simply falls back to the remembered filters.
    }
    return found;
  }

  function writeUrl() {
    try {
      const params = new URLSearchParams(location.search);
      for (const [field, key] of Object.entries(URL_KEYS)) {
        params.delete(key);
        const control = form.elements[field];
        if (control && control.value && !(field === "sort" && control.value === "name")) params.set(key, control.value);
      }
      const query = params.toString();
      history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    } catch {
      // The address is a convenience; filtering still works without it.
    }
  }

  const bySortKey = (a, b) => a.dataset.sort.localeCompare(b.dataset.sort);

  function update() {
    const query = form.elements.search.value.trim().toLowerCase();
    const mode = form.elements.sort.value;
    const rows = [...originalRows].sort((a, b) => (
      (mode === "class" || mode === "role") ? a.dataset[mode].localeCompare(b.dataset[mode]) || bySortKey(a, b) : bySortKey(a, b)
    ));
    let visible = 0;
    for (const row of rows) {
      const matches = (!query || row.dataset.search.includes(query))
        && (!form.elements.class.value || row.dataset.class === form.elements.class.value)
        && (!form.elements.role.value || row.dataset.role === form.elements.role.value)
        && (!form.elements.server.value || row.dataset.server === form.elements.server.value)
        && (!form.elements.faction || !form.elements.faction.value || row.dataset.faction === form.elements.faction.value);
      row.hidden = !matches;
      if (matches) visible += 1;
      body.append(row);
    }
    count.textContent = `${visible} ${visible === 1 ? count.dataset.singular : count.dataset.plural}`;
    noResults.hidden = visible !== 0;
  }

  form.addEventListener("input", () => { remember(); writeUrl(); update(); });
  form.addEventListener("change", () => { remember(); writeUrl(); update(); });
  if (!readUrl()) restore();
  update();
  writeUrl();
})();
