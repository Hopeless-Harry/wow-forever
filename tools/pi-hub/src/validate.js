// Strict allowlist validation of everything the companion uploads and every command an admin composes.
// Nothing outside these fields ever reaches the database. Chat, whispers, BattleTags, account paths, item names and gold
// are not part of the data model and are dropped silently if a client ever sends them.

export const STAT_KEYS = [
  'wine', 'ale', 'coffee', 'food', 'cheese', 'cookie', 'pie', 'soup', 'fish', 'juice', 'water', 'bandage', 'potion', 'jumps',
  'kills', 'quests', 'deaths', 'dungeons', 'flights',
];
const STAT_SET = new Set(STAT_KEYS);

export const LIMITS = { members: 300, locations: 300, forget: 50, acks: 50, catalog: 80, name: 24, title: 30, zone: 40, stats: 40, announce: 570, motd: 100 };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
export const validName = (n) => typeof n === 'string' && n.length >= 1 && n.length <= LIMITS.name && /^[^\s\x00-\x1f|]+$/u.test(n);
const printable = (s, max) => typeof s === 'string' && s.length <= max && /^[\x20-\x7e]*$/.test(s);

function member(name, raw, errors) {
  if (!validName(name) || !isObject(raw)) { errors.push(`member ${String(name).slice(0, 24)}: bad entry`); return null; }
  const out = {
    name,
    lastHeard: int(raw.lastHeard, 0, 4102444800),
    level: int(raw.level, 0, 130), classID: int(raw.classID, 0, 20), raceID: int(raw.raceID, 0, 200),
    medals: int(raw.medals, 0, 100000), momMoney: int(raw.momMoney, 0, 100000000),
    title: typeof raw.title === 'string' && raw.title.length <= LIMITS.title && /^[A-Za-z0-9 '\-]*$/.test(raw.title) ? raw.title : null,
    statsAt: int(raw.statsAt, 0, 4102444800),
    stats: {},
  };
  if (out.lastHeard === null) { errors.push(`member ${name}: bad lastHeard`); return null; }
  if (isObject(raw.stats)) {
    let count = 0;
    for (const [key, value] of Object.entries(raw.stats)) {
      if (!STAT_SET.has(key)) continue; // unknown keys (for example anything gold-like) are dropped
      const v = int(value, 0, 1_000_000_000);
      if (v === null || count >= LIMITS.stats) continue;
      out.stats[key] = v; count += 1;
    }
  }
  return out;
}

function location(name, raw, errors) {
  if (!validName(name) || !isObject(raw)) { errors.push(`location ${String(name).slice(0, 24)}: bad entry`); return null; }
  const out = {
    name, mapID: int(raw.mapID, 1, 99999), x: num(raw.x, 0, 1), y: num(raw.y, 0, 1),
    level: int(raw.level, 0, 130), classID: int(raw.classID, 0, 20), at: int(raw.at, 0, 4102444800),
    zone: typeof raw.zone === 'string' && printable(raw.zone, LIMITS.zone) ? raw.zone : null,
  };
  if (out.mapID === null || out.x === null || out.y === null || out.at === null) { errors.push(`location ${name}: bad values`); return null; }
  return out;
}

export function validateIngest(payload) {
  const errors = [];
  if (!isObject(payload)) return { ok: false, errors: ['body must be an object'] };
  const value = { writtenAt: int(payload.writtenAt, 0, 4102444800), members: [], locations: [], forget: [], acks: [], catalog: { verified: [], templates: [] } };
  if (value.writtenAt === null) return { ok: false, errors: ['writtenAt is required'] };
  if (isObject(payload.members)) {
    for (const [name, raw] of Object.entries(payload.members).slice(0, LIMITS.members)) { const m = member(name, raw, errors); if (m) value.members.push(m); }
  }
  if (isObject(payload.locations)) {
    for (const [name, raw] of Object.entries(payload.locations).slice(0, LIMITS.locations)) { const l = location(name, raw, errors); if (l) value.locations.push(l); }
  }
  if (Array.isArray(payload.forget)) {
    for (const raw of payload.forget.slice(0, LIMITS.forget)) {
      if (isObject(raw) && validName(raw.name) && int(raw.at, 0, 4102444800) !== null) value.forget.push({ name: raw.name, at: raw.at });
    }
  }
  if (Array.isArray(payload.acks)) {
    for (const raw of payload.acks.slice(0, LIMITS.acks)) {
      if (!isObject(raw) || int(raw.id, 1, 2147483647) === null || !['relayed', 'rejected'].includes(raw.state)) continue;
      value.acks.push({ id: raw.id, state: raw.state, reason: printable(raw.reason ?? '', 60) ? (raw.reason ?? '') : '', at: int(raw.at, 0, 4102444800) ?? 0 });
    }
  }
  if (isObject(payload.catalog)) {
    for (const raw of (Array.isArray(payload.catalog.verified) ? payload.catalog.verified : []).slice(0, LIMITS.catalog)) {
      if (isObject(raw) && typeof raw.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(raw.id) && printable(raw.name ?? '', 60)) value.catalog.verified.push({ id: raw.id, name: raw.name ?? raw.id });
    }
    for (const raw of (Array.isArray(payload.catalog.templates) ? payload.catalog.templates : []).slice(0, LIMITS.catalog)) {
      if (isObject(raw) && typeof raw.id === 'string' && /^[A-Za-z_]{1,20}$/.test(raw.id) && int(raw.slot, 1, 3) !== null && printable(raw.text ?? '', 80)) value.catalog.templates.push({ id: raw.id, slot: raw.slot, text: raw.text ?? raw.id });
    }
  }
  return { ok: true, value, errors };
}

// Commands in the exact shape the addon's inbox accepts (Orders:Validate). Returns { ok, command, error }.
export function validateCommand(kind, input) {
  if (!isObject(input)) return { ok: false, error: 'bad command' };
  if (kind === 'announce') {
    const text = typeof input.text === 'string' ? input.text.replace(/\|/g, '/').trim() : '';
    if (!text || text.length > LIMITS.announce || !/^[\x20-\x7e]+$/.test(text)) return { ok: false, error: 'announcement must be 1-570 printable ASCII characters' };
    return { ok: true, command: { kind, text } };
  }
  if (kind === 'award' || kind === 'revoke') {
    if (!validName(input.target)) return { ok: false, error: 'bad character name' };
    if (typeof input.medal !== 'string' || !/^[A-Za-z0-9_]{1,40}$/.test(input.medal)) return { ok: false, error: 'bad medal id' };
    return { ok: true, command: { kind, target: input.target, medal: input.medal } };
  }
  if (kind === 'quests') {
    const week = int(input.week, 1, 100000);
    if (week === null || !Array.isArray(input.slots) || input.slots.length !== 3) return { ok: false, error: 'quests need a week and three slots' };
    const slots = input.slots.map((s) => (s === '-' || (typeof s === 'string' && /^[A-Za-z_]{1,20}$/.test(s)) ? s : null));
    if (slots.includes(null)) return { ok: false, error: 'bad quest template id' };
    return { ok: true, command: { kind, week, slots } };
  }
  if (kind === 'config') {
    const text = typeof input.text === 'string' ? input.text.replace(/\|/g, '/').trim() : '';
    if (input.key !== 'motd' || !text || text.length > LIMITS.motd || !/^[\x20-\x7e]+$/.test(text)) return { ok: false, error: 'guild message must be 1-100 printable ASCII characters' };
    return { ok: true, command: { kind, key: 'motd', text } };
  }
  return { ok: false, error: 'unknown command kind' };
}

// Officers may announce, award and revoke. Everything else is admin only.
export const ROLE_COMMANDS = { admin: ['announce', 'award', 'revoke', 'quests', 'config'], officer: ['announce', 'award', 'revoke'] };
export const canSend = (role, kind) => (ROLE_COMMANDS[role] ?? []).includes(kind);
