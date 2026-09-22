export const PUBLIC_FIELDS = Object.freeze([
  "anonymousId",
  "server",
  "race",
  "characterClass",
  "role",
  "profession1",
  "profession2"
]);

const MAPPED_FIELDS = PUBLIC_FIELDS.filter((field) => field !== "anonymousId");

function cleanCell(value) {
  return String(value ?? "").trim().slice(0, 200);
}

function resolveColumns(headers, mapping) {
  const columns = {};
  for (const field of MAPPED_FIELDS) {
    const header = mapping[field];
    const matches = headers.reduce((found, value, index) => {
      if (cleanCell(value) === header) found.push(index);
      return found;
    }, []);
    if (matches.length === 0) throw new Error(`Missing required sheet header for ${field}`);
    if (matches.length > 1) throw new Error(`Duplicate sheet header for ${field}`);
    columns[field] = matches[0];
  }
  return columns;
}

export function normalizeRows(rows, mapping) {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
    throw new Error("Sheet data must include a header row");
  }

  const columns = resolveColumns(rows[0], mapping);
  const records = [];
  let rejectedRows = 0;

  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) {
      rejectedRows += 1;
      continue;
    }
    const values = Object.fromEntries(
      MAPPED_FIELDS.map((field) => [field, cleanCell(row[columns[field]])])
    );
    if (MAPPED_FIELDS.some((field) => values[field] === "")) {
      rejectedRows += 1;
      continue;
    }
    records.push({
      anonymousId: `Response #${records.length + 1}`,
      ...values
    });
  }

  return {
    records,
    rejectedRows,
    sourceRowCount: Math.max(0, rows.length - 1)
  };
}
