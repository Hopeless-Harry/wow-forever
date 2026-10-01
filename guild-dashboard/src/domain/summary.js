import { missingProfessions, raidReadiness } from "./raid.js";
import { LAUNCH_AT, factionOf, roleOf } from "./wow-data.js";

const DAY_MS = 86_400_000;

function tally(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// A short Discord-ready roundup. It uses counts only, so it never repeats a name.
export function buildSummary(snapshot, memberData = {}, now = new Date()) {
  const records = snapshot.records ?? [];
  const members = memberData.members ?? [];
  const lines = ["**Moms Against Magic — guild roster**"];
  if (!records.length) {
    lines.push("No responses yet.");
  } else {
    const factions = tally(records.map((record) => factionOf(record.race)));
    lines.push(`${plural(records.length, "response", "responses")} · ${factions.map(([name, count]) => `${name} ${count}`).join(" · ")}`);

    for (const [faction] of factions) {
      const group = records.filter((record) => factionOf(record.race) === faction);
      const roles = { tank: 0, healer: 0, dps: 0, flex: 0 };
      for (const record of group) roles[roleOf(record.role)] += 1;
      lines.push(`**${faction}** — ${plural(roles.tank, "tank", "tanks")} · ${plural(roles.healer, "healer", "healers")} · ${roles.dps} DPS${roles.flex ? ` · ${roles.flex} flexible` : ""}`);
    }

    lines.push("**Raid readiness:**");
    for (const row of raidReadiness(records)) {
      const readySizes = row.sizes.filter((item) => item.ready).map((item) => item.size);
      const smallest = row.sizes[0];
      lines.push(readySizes.length
        ? `- ${row.label} — ready for a ${Math.max(...readySizes)}-player raid`
        : `- ${row.label} — not ready for ${smallest.size}-player yet (needs ${smallest.needs.join(", ")})`);
    }

    lines.push(`**Top classes:** ${tally(records.map((record) => record.characterClass)).slice(0, 3).map(([name, count]) => `${name} ${count}`).join(", ")}`);
    lines.push(`**Rulesets:** ${tally(records.map((record) => record.server)).map(([name, count]) => `${name} ${count}`).join(", ")}`);

    if (members.length) {
      const gaps = missingProfessions(members);
      const none = [...gaps.primary, ...gaps.secondary];
      lines.push(`**Professions nobody has:** ${none.length ? none.join(", ") : "none — every profession is covered"}`);
    }
  }

  const remaining = Date.parse(LAUNCH_AT) - now.getTime();
  lines.push(remaining > 0
    ? `**WoW Forever launches in ${plural(Math.ceil(remaining / DAY_MS), "day", "days")}** (reported date, unverified)`
    : "**WoW Forever is live**");
  return lines.join("\n");
}
