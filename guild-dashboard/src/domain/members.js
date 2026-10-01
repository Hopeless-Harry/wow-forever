export const MEMBER_FIELDS = Object.freeze(["server", "race", "characterClass", "role", "profession1", "profession2"]);
export const MAX_MEMBER_EVENTS = 500;

const FIELD_LABELS = Object.freeze({
  server: "ruleset preference",
  race: "race",
  characterClass: "class",
  role: "role",
  profession1: "first profession",
  profession2: "second profession"
});

function cleanCell(value) {
  return String(value ?? "").trim().slice(0, 200);
}

// The name field is free text. Contact details are removed before anything is stored or shown.
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

export function redactContact(name) {
  return name.replace(EMAIL, "[removed]").replace(PHONE, "[removed]").replace(/\s+/g, " ").trim();
}

function memberKey(name) {
  return name.toLowerCase();
}

function findColumn(headers, header, label) {
  const matches = headers.reduce((found, value, index) => {
    if (cleanCell(value) === header) found.push(index);
    return found;
  }, []);
  if (matches.length === 0) throw new Error(`Missing required sheet header for ${label}`);
  if (matches.length > 1) throw new Error(`Duplicate sheet header for ${label}`);
  return matches[0];
}

// Private pipeline: keeps the submitted name so history can follow each member.
// Later submissions with the same name replace earlier ones.
export function normalizeMembers(rows, mapping, nameHeader) {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
    throw new Error("Sheet data must include a header row");
  }
  const nameColumn = findColumn(rows[0], nameHeader, "name");
  const columns = Object.fromEntries(MEMBER_FIELDS.map((field) => [field, findColumn(rows[0], mapping[field], field)]));
  const byKey = new Map();

  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue;
    const name = redactContact(cleanCell(row[nameColumn]));
    const values = Object.fromEntries(MEMBER_FIELDS.map((field) => [field, cleanCell(row[columns[field]])]));
    if (!name || MEMBER_FIELDS.some((field) => values[field] === "")) continue;
    byKey.set(memberKey(name), { name, ...values });
  }
  return [...byKey.values()];
}

export function diffMembers(previous, next, at) {
  const events = [];
  const before = new Map(previous.map((member) => [memberKey(member.name), member]));
  const after = new Map(next.map((member) => [memberKey(member.name), member]));

  for (const [key, member] of after) {
    const old = before.get(key);
    if (!old) {
      events.push({ type: "joined", at, name: member.name, entry: Object.fromEntries(MEMBER_FIELDS.map((field) => [field, member[field]])) });
      continue;
    }
    for (const field of MEMBER_FIELDS) {
      if (old[field] !== member[field]) {
        events.push({ type: "changed", at, name: member.name, field: FIELD_LABELS[field], from: old[field], to: member[field] });
      }
    }
  }
  for (const [key, member] of before) {
    if (!after.has(key)) events.push({ type: "left", at, name: member.name });
  }
  return events;
}
