import { createHash } from 'node:crypto';

// Builds the upload from the gateway table in MAMChroniclesDB. Every field is copied explicitly: anything else in the file
// (chat-like text, gold, item names, event history, settings) is never read into the payload, so it cannot be uploaded.
export const STAT_KEYS = [
  'wine', 'ale', 'coffee', 'food', 'cheese', 'cookie', 'pie', 'soup', 'fish', 'juice', 'water', 'bandage', 'potion', 'jumps',
  'kills', 'quests', 'deaths', 'dungeons', 'flights',
];
const STAT_SET = new Set(STAT_KEYS);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const entries = (v) => (isObject(v) ? Object.entries(v) : []);
const list = (v) => (Array.isArray(v) ? v : []);

export function buildPayload(root) {
  const gateway = root?.MAMChroniclesDB?.gateway;
  if (!isObject(gateway) || !isObject(gateway.meta) || int(gateway.meta.writtenAt) === undefined) return null;
  const payload = { writtenAt: gateway.meta.writtenAt, client: gateway.client === 'forever' ? 'forever' : 'retail', members: {}, locations: {}, forget: [], acks: [], catalog: { verified: [], templates: [] } };

  for (const [name, m] of entries(gateway.members).slice(0, 300)) {
    if (!isObject(m)) continue;
    const stats = {};
    for (const [key, value] of entries(m.stats)) if (STAT_SET.has(key) && int(value) !== undefined) stats[key] = value;
    payload.members[name] = clean({
      lastHeard: int(m.lastHeard), level: int(m.level), classID: int(m.classID), raceID: int(m.raceID), title: str(m.title, 30),
      medals: int(m.medals), momMoney: int(m.momMoney), statsAt: int(m.statsAt), stats,
    });
  }
  for (const [name, l] of entries(gateway.locations).slice(0, 300)) {
    if (!isObject(l)) continue;
    payload.locations[name] = clean({ mapID: int(l.mapID), x: num(l.x), y: num(l.y), level: int(l.level), classID: int(l.classID), at: int(l.at), zone: str(l.zone, 40) });
  }
  for (const f of list(gateway.forget).slice(0, 50)) if (isObject(f) && str(f.name, 24) && int(f.at) !== undefined) payload.forget.push({ name: f.name, at: f.at });
  for (const a of list(gateway.ack?.results).slice(-50)) {
    if (isObject(a) && int(a.id) !== undefined && (a.state === 'relayed' || a.state === 'rejected')) payload.acks.push(clean({ id: a.id, state: a.state, reason: str(a.reason, 60), at: int(a.at) }));
  }
  for (const v of list(gateway.catalog?.verified).slice(0, 80)) if (isObject(v) && str(v.id, 40)) payload.catalog.verified.push(clean({ id: v.id, name: str(v.name, 60) }));
  for (const t of list(gateway.catalog?.templates).slice(0, 80)) if (isObject(t) && str(t.id, 20)) payload.catalog.templates.push(clean({ id: t.id, slot: int(t.slot), text: str(t.text, 80) }));
  payload.lastCommandId = int(gateway.ack?.lastCommandId) ?? 0;
  return payload;
}

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Only members whose data changed since the last successful upload are sent. Locations are always sent in full because
// the hub keeps just the latest set. Forget requests and acks are idempotent and always included.
export function selectDelta(payload, state) {
  const known = state.memberHashes ?? {};
  const members = {}, hashes = {};
  for (const [name, m] of Object.entries(payload.members)) {
    hashes[name] = hash(m);
    if (known[name] !== hashes[name]) members[name] = m;
  }
  const { lastCommandId, ...rest } = payload;
  return { body: { ...rest, members }, hashes, changed: Object.keys(members).length };
}
