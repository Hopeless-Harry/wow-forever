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
  distributions.professions = distribution(
    records.flatMap((record) => [record.profession1, record.profession2])
  );

  const leaders = Object.fromEntries(
    Object.entries(distributions).map(([key, values]) => [
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
