import { factionOf, roleOf } from "./wow-data.js";

const DISTRIBUTION_FIELDS = ["server", "race", "characterClass", "role"];

function distribution(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildStats(records) {
  const distributions = Object.fromEntries(
    DISTRIBUTION_FIELDS.map((field) => [field, distribution(records.map((record) => record[field]))])
  );
  distributions.faction = distribution(records.map((record) => factionOf(record.race)));
  distributions.professions = distribution(
    records.flatMap((record) => [record.profession1, record.profession2])
  );

  const leaders = Object.fromEntries(
    Object.entries(distributions).filter(([key]) => key !== "faction").map(([key, values]) => [
      key,
      values.length ? { label: values[0].label, count: values[0].count } : null
    ])
  );

  return {
    totalResponses: records.length,
    distributions,
    leaders
  };
}

// How many players of each class chose each role. Counts only, so it stays anonymous.
export function classRoleMatrix(records) {
  const rows = new Map();
  for (const record of records) {
    if (!rows.has(record.characterClass)) rows.set(record.characterClass, { characterClass: record.characterClass, tank: 0, healer: 0, dps: 0, flex: 0, total: 0 });
    const row = rows.get(record.characterClass);
    row[roleOf(record.role)] += 1;
    row.total += 1;
  }
  const list = [...rows.values()].sort((a, b) => b.total - a.total || a.characterClass.localeCompare(b.characterClass));
  const totals = list.reduce((sum, row) => ({ tank: sum.tank + row.tank, healer: sum.healer + row.healer, dps: sum.dps + row.dps, flex: sum.flex + row.flex, total: sum.total + row.total }), { tank: 0, healer: 0, dps: 0, flex: 0, total: 0 });
  return { rows: list, totals };
}
