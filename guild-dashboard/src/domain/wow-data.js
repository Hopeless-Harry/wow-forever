// Reference data for WoW Forever. Third-party guides were the source for the six
// new combinations; Skyborne class lists were not verified, so they are never flagged.
export const RACE_CLASSES = Object.freeze({
  Human: ["Warrior", "Paladin", "Rogue", "Mage", "Priest", "Warlock", "Hunter"],
  Dwarf: ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman"],
  "Night Elf": ["Warrior", "Hunter", "Rogue", "Priest", "Druid"],
  Gnome: ["Warrior", "Rogue", "Mage", "Warlock", "Priest"],
  Orc: ["Warrior", "Hunter", "Rogue", "Shaman", "Warlock", "Mage"],
  Undead: ["Warrior", "Rogue", "Mage", "Priest", "Warlock", "Paladin"],
  Tauren: ["Warrior", "Hunter", "Shaman", "Druid"],
  Troll: ["Warrior", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock"]
});

const HORDE = new Set(["Orc", "Undead", "Tauren", "Troll"]);
const ALLIANCE = new Set(["Human", "Dwarf", "Night Elf", "Gnome"]);

export function factionOf(race) {
  if (HORDE.has(race) || /windshaper/i.test(race)) return "Horde";
  if (ALLIANCE.has(race) || /high order/i.test(race)) return "Alliance";
  return "Unknown";
}

// Returns a plain-language note for combinations the matrix does not list, else "".
export function comboWarning(race, characterClass) {
  const allowed = RACE_CLASSES[race];
  if (!allowed || allowed.includes(characterClass)) return "";
  return `${race} ${characterClass} is not a known WoW Forever combination`;
}

export function roleOf(role) {
  const value = String(role).toLowerCase();
  if (value.includes("tank")) return "tank";
  if (value.includes("heal")) return "healer";
  if (value.includes("dps") || value.includes("damage")) return "dps";
  return "flex";
}

export const RAID_SIZES = Object.freeze([10, 20, 40]);
