import { PRIMARY_PROFESSIONS, SECONDARY_PROFESSIONS, factionOf, roleOf } from "./wow-data.js";

// Rough guide from community raid-planning advice: about 4 tanks, 11 healers and
// 25 DPS in a 40-player raid, scaled down for smaller groups (never fewer than two tanks).
export function roleTargets(size) {
  const tanks = Math.max(2, Math.round((4 * size) / 40));
  const healers = Math.max(2, Math.round((11 * size) / 40));
  return { tank: tanks, healer: healers, dps: Math.max(0, size - tanks - healers) };
}

const UTILITY = [
  { label: "Warrior tank", note: "Main tanks are usually Warriors", test: (r) => r.characterClass === "Warrior" && roleOf(r.role) === "tank", need: () => 1 },
  { label: "Druid", note: "Unique raid buffs and off-tanking", test: (r) => r.characterClass === "Druid", need: () => 1 },
  { label: "Hunter", note: "Some fights need Tranquilizing Shot", test: (r) => r.characterClass === "Hunter", need: () => 1 },
  { label: "Paladin", note: "Blessings; about 4 for a 40-player raid", test: (r) => r.characterClass === "Paladin", need: (size) => Math.max(1, Math.round(size / 10)) },
  { label: "Shaman", note: "Totems; about one per melee group", test: (r) => r.characterClass === "Shaman", need: (size) => Math.max(1, Math.round(size / 10)) },
  { label: "Priest", note: "Core healers and Fortitude", test: (r) => r.characterClass === "Priest", need: (size) => Math.max(1, Math.round(size / 10)) },
  { label: "Mage", note: "Core damage and Intellect buff", test: (r) => r.characterClass === "Mage", need: (size) => Math.max(1, Math.round(size / 10)) },
  { label: "Warlock", note: "Curses and Soulstones", test: (r) => r.characterClass === "Warlock", need: (size) => Math.max(1, Math.round(size / 20)) }
];

function status(have, need) {
  if (have >= need) return "ready";
  return have > 0 ? "short" : "missing";
}

export function buildRaidPlan(records, size) {
  const targets = roleTargets(size);
  const byFaction = new Map();
  for (const record of records) {
    const faction = factionOf(record.race);
    if (!byFaction.has(faction)) byFaction.set(faction, []);
    byFaction.get(faction).push(record);
  }
  const order = ["Horde", "Alliance", "Unknown"].filter((faction) => byFaction.has(faction));
  return order.map((faction) => {
    const members = byFaction.get(faction);
    const roles = Object.fromEntries(["tank", "healer", "dps", "flex"].map((role) => [role, members.filter((r) => roleOf(r.role) === role).length]));
    return {
      faction,
      total: members.length,
      roles: ["tank", "healer", "dps"].map((role) => ({ role, have: roles[role], need: targets[role], status: status(roles[role], targets[role]) })),
      flex: roles.flex,
      utility: UTILITY.map((item) => {
        const have = members.filter(item.test).length;
        const need = item.need(size);
        return { label: item.label, note: item.note, have, need, status: status(have, need) };
      })
    };
  });
}

export function professionDirectory(members) {
  const byProfession = new Map();
  for (const member of members) {
    for (const profession of new Set([member.profession1, member.profession2])) {
      if (!byProfession.has(profession)) byProfession.set(profession, []);
      byProfession.get(profession).push(member);
    }
  }
  return [...byProfession.entries()]
    .map(([profession, crafters]) => ({ profession, crafters: crafters.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => b.crafters.length - a.crafters.length || a.profession.localeCompare(b.profession));
}

export function missingProfessions(members) {
  const covered = new Set(members.flatMap((member) => [member.profession1, member.profession2]));
  return {
    primary: PRIMARY_PROFESSIONS.filter((profession) => !covered.has(profession)),
    secondary: SECONDARY_PROFESSIONS.filter((profession) => !covered.has(profession))
  };
}
