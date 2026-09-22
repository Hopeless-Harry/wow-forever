(() => {
  const form = document.querySelector("[data-census-filters]");
  const table = document.querySelector("#census-table");
  if (!form || !table) return;

  const body = table.tBodies[0];
  const originalRows = [...body.rows];
  const count = document.querySelector("#visible-count");
  const noResults = document.querySelector(".no-results");

  for (const name of ["class", "role", "server"]) {
    const select = form.elements[name];
    const values = [...new Set(originalRows.map((row) => row.dataset[name]))].sort();
    for (const value of values) select.add(new Option(value, value));
  }

  function numberOf(row) {
    return Number(row.cells[0].textContent.match(/\d+/)?.[0] || 0);
  }

  function update() {
    const query = form.elements.search.value.trim().toLowerCase();
    const rows = [...originalRows];
    rows.sort((a, b) => {
      const mode = form.elements.sort.value;
      if (mode === "class" || mode === "role") return a.dataset[mode].localeCompare(b.dataset[mode]) || numberOf(a) - numberOf(b);
      return numberOf(a) - numberOf(b);
    });
    let visible = 0;
    for (const row of rows) {
      const matches = (!query || row.dataset.search.includes(query))
        && (!form.elements.class.value || row.dataset.class === form.elements.class.value)
        && (!form.elements.role.value || row.dataset.role === form.elements.role.value)
        && (!form.elements.server.value || row.dataset.server === form.elements.server.value);
      row.hidden = !matches;
      if (matches) visible += 1;
      body.append(row);
    }
    count.textContent = `${visible} ${visible === 1 ? "entry" : "entries"}`;
    noResults.hidden = visible !== 0;
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
})();
