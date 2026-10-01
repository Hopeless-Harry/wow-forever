import { factionOf } from "./wow-data.js";

const COLUMNS = ["Name", "Class", "Role", "Race", "Faction", "Ruleset", "Profession 1", "Profession 2"];

// Cells starting with a formula character are prefixed so spreadsheets treat them as text.
function cell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The leading byte-order mark makes Excel read the file as UTF-8 so accents and non-Latin names survive.
export const CSV_BOM = "\uFEFF";

export function membersToCsv(members) {
  const rows = [...members]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => [m.name, m.characterClass, m.role, m.race, factionOf(m.race), m.server, m.profession1, m.profession2]);
  return `${CSV_BOM}${[COLUMNS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
