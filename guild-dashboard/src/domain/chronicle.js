export const EVENT_TYPES = Object.freeze(["census-opened", "joined", "departed", "leader-change", "milestone"]);
export const MAX_EVENTS = 200;
export const MILESTONES = Object.freeze([5, 10, 20, 25, 40]);

const RECORD_FIELDS = ["server", "race", "characterClass", "role", "profession1", "profession2"];
const LEADER_FIELDS = Object.freeze({ characterClass: "class", role: "role", server: "realm" });

function signature(record) {
  return JSON.stringify(RECORD_FIELDS.map((field) => record[field]));
}

function tally(records) {
  const counts = new Map();
  for (const record of records) counts.set(signature(record), (counts.get(signature(record)) || 0) + 1);
  return counts;
}

// Entries are anonymous and carry no stable identity, so a changed answer reads
// as one departure plus one arrival rather than an edit to "Response #N".
function unmatched(records, otherCounts) {
  const remaining = new Map(otherCounts);
  const result = [];
  for (const record of records) {
    const key = signature(record);
    const left = remaining.get(key) || 0;
    if (left > 0) remaining.set(key, left - 1);
    else result.push(record);
  }
  return result;
}

function leader(records, field) {
  const counts = new Map();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length ? ranked[0][0] : null;
}

export function diffSnapshots(previous, next, at, { hasHistory = true } = {}) {
  const events = [];
  const before = previous || [];
  if (!previous && !hasHistory) {
    if (next.length) events.push({ type: "census-opened", at, count: next.length });
    return events;
  }

  const joined = unmatched(next, tally(before));
  const departed = unmatched(before, tally(next));
  for (const record of joined) {
    events.push({ type: "joined", at, entry: Object.fromEntries(RECORD_FIELDS.map((field) => [field, record[field]])) });
  }
  if (departed.length) events.push({ type: "departed", at, count: departed.length });

  for (const milestone of MILESTONES) {
    if (before.length < milestone && next.length >= milestone) events.push({ type: "milestone", at, count: milestone });
  }

  if (before.length && next.length) {
    for (const [field, category] of Object.entries(LEADER_FIELDS)) {
      const from = leader(before, field);
      const to = leader(next, field);
      if (from !== to) events.push({ type: "leader-change", at, category, from, to });
    }
  }
  return events;
}
