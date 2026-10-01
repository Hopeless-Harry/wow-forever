import { roleTargets } from "./raid.js";
import { factionOf, roleOf } from "./wow-data.js";

const GROUP_SIZE = 5;

function pickGroup(groups, member) {
  let best = null;
  for (const group of groups) {
    if (group.members.length >= GROUP_SIZE) continue;
    const same = group.members.filter((other) => other.characterClass === member.characterClass).length;
    if (!best || group.members.length < best.group.members.length || (group.members.length === best.group.members.length && same < best.same)) {
      best = { group, same };
    }
  }
  return best?.group ?? null;
}

// Greedy, deterministic grouping: tanks first (one per group), healers spread
// across groups, then everyone else into the emptiest group with the fewest of
// their class. Anyone who does not fit is benched.
export function buildGroups(members, size) {
  const groups = Array.from({ length: Math.max(1, Math.floor(size / GROUP_SIZE)) }, () => ({ members: [] }));
  const targets = roleTargets(size);
  const ordered = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const byRole = (role) => ordered.filter((member) => roleOf(member.role) === role);
  const leftovers = [];

  byRole("tank").forEach((member, index) => {
    if (index < targets.tank && index < groups.length) groups[index].members.push(member);
    else leftovers.push(member);
  });
  byRole("healer").forEach((member, index) => {
    const group = index < targets.healer ? groups[index % groups.length] : null;
    if (group && group.members.length < GROUP_SIZE) group.members.push(member);
    else leftovers.push(member);
  });
  const placed = new Set(groups.flatMap((group) => group.members));
  const rest = [...byRole("dps"), ...leftovers, ...byRole("flex")].filter((member) => !placed.has(member));
  const bench = [];
  for (const member of new Set(rest)) {
    const group = pickGroup(groups, member);
    if (group) group.members.push(member);
    else bench.push(member);
  }
  return { groups, bench };
}

export function groupPlan(members, size) {
  const byFaction = new Map();
  for (const member of members) {
    const faction = factionOf(member.race);
    if (!byFaction.has(faction)) byFaction.set(faction, []);
    byFaction.get(faction).push(member);
  }
  return ["Horde", "Alliance", "Unknown"].filter((faction) => byFaction.has(faction)).map((faction) => {
    const group = byFaction.get(faction);
    const rulesets = new Map();
    for (const member of group) rulesets.set(member.server, (rulesets.get(member.server) || 0) + 1);
    return {
      faction,
      rulesets: [...rulesets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count })),
      ...buildGroups(group, size)
    };
  });
}

// Discord-ready text for the suggested groups. Empty groups are left out; null when nobody is placed.
export function groupsToText(plan, size, ruleset = "") {
  const sections = [];
  for (const faction of plan) {
    const lines = [];
    faction.groups.forEach((group, index) => {
      if (group.members.length) lines.push(`Group ${index + 1}: ${group.members.map((member) => `${member.name} (${member.characterClass})`).join(", ")}`);
    });
    if (faction.bench.length) lines.push(`Bench: ${faction.bench.map((member) => member.name).join(", ")}`);
    if (lines.length) sections.push([`**${faction.faction}**`, ...lines].join("\n"));
  }
  if (!sections.length) return null;
  return [`**Raid groups — ${size}-player${ruleset ? ` (${ruleset})` : ""}**`, ...sections].join("\n");
}
