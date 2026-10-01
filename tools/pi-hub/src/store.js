import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// SQLite store. Daily stat snapshots and the audit log are kept forever (owner decision); only the latest location per
// member is kept and it expires after LOCATION_TTL seconds. Everything is bounded by the guild size.
export const LOCATION_TTL = 600;
const sha = (text) => createHash('sha256').update(text).digest('hex');
const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members(name TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_heard INTEGER NOT NULL, level INTEGER, class_id INTEGER, race_id INTEGER, title TEXT, medals INTEGER, mom_money INTEGER, stats_at INTEGER);
CREATE TABLE IF NOT EXISTS stats_latest(name TEXT NOT NULL, key TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(name, key));
CREATE TABLE IF NOT EXISTS stats_daily(name TEXT NOT NULL, day TEXT NOT NULL, key TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(name, day, key));
CREATE TABLE IF NOT EXISTS locations(name TEXT PRIMARY KEY, map_id INTEGER NOT NULL, x REAL NOT NULL, y REAL NOT NULL, level INTEGER, class_id INTEGER, at INTEGER NOT NULL, zone TEXT);
CREATE TABLE IF NOT EXISTS commands(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, created_by TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL, state TEXT NOT NULL, state_at INTEGER NOT NULL, reason TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT NOT NULL, role TEXT, action TEXT NOT NULL, detail TEXT);
CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, role TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL UNIQUE, key_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_seen INTEGER);
CREATE TABLE IF NOT EXISTS forgotten(name TEXT PRIMARY KEY, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS catalog(kind TEXT NOT NULL, id TEXT NOT NULL, label TEXT NOT NULL, slot INTEGER, PRIMARY KEY(kind, id));
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS stats_daily_by_day ON stats_daily(day);
CREATE INDEX IF NOT EXISTS audit_by_at ON audit(at);
`;

export function createStore(path, { now = () => Math.floor(Date.now() / 1000) } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  const q = (sql) => db.prepare(sql);
  const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const setMeta = (key, value) => q('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));

  const store = {
    db,
    close() { db.close(); },

    // ------------------------------------------------------------ audit
    audit(actor, role, action, detail = '') {
      q('INSERT INTO audit(at, actor, role, action, detail) VALUES(?, ?, ?, ?, ?)').run(now(), String(actor).slice(0, 40), role ?? null, String(action).slice(0, 40), String(detail).slice(0, 400));
    },
    listAudit(limit = 100, offset = 0) { return q('SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset); },

    // ------------------------------------------------------------ ingest (already validated)
    forget(name, at) {
      for (const table of ['members', 'stats_latest', 'stats_daily', 'locations']) q(`DELETE FROM ${table} WHERE name = ?`).run(name);
      q('INSERT INTO forgotten(name, at) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET at = MAX(at, excluded.at)').run(name, at);
    },
    ingest(value, source = 'gateway') {
      return tx(() => {
        const t = now();
        let forgot = 0, stored = 0;
        for (const f of value.forget) { store.forget(f.name, f.at); forgot += 1; }
        const tomb = new Map(q('SELECT name, at FROM forgotten').all().map((r) => [r.name, r.at]));
        for (const m of value.members) {
          if (tomb.has(m.name) && m.lastHeard <= tomb.get(m.name)) continue;
          if (tomb.has(m.name)) q('DELETE FROM forgotten WHERE name = ?').run(m.name);
          const old = q('SELECT first_seen FROM members WHERE name = ?').get(m.name);
          q(`INSERT INTO members(name, first_seen, last_heard, level, class_id, race_id, title, medals, mom_money, stats_at) VALUES(?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(name) DO UPDATE SET last_heard = MAX(last_heard, excluded.last_heard), level = COALESCE(excluded.level, level), class_id = COALESCE(excluded.class_id, class_id),
             race_id = COALESCE(excluded.race_id, race_id), title = COALESCE(excluded.title, title), medals = COALESCE(excluded.medals, medals), mom_money = COALESCE(excluded.mom_money, mom_money),
             stats_at = COALESCE(excluded.stats_at, stats_at)`)
            .run(m.name, old?.first_seen ?? t, m.lastHeard, m.level, m.classID, m.raceID, m.title, m.medals, m.momMoney, m.statsAt);
          const keys = Object.keys(m.stats);
          if (keys.length) {
            const d = day(m.statsAt ?? m.lastHeard);
            q('DELETE FROM stats_latest WHERE name = ?').run(m.name);
            for (const key of keys) {
              q('INSERT INTO stats_latest(name, key, value) VALUES(?,?,?)').run(m.name, key, m.stats[key]);
              q('INSERT INTO stats_daily(name, day, key, value) VALUES(?,?,?,?) ON CONFLICT(name, day, key) DO UPDATE SET value = excluded.value').run(m.name, d, key, m.stats[key]);
            }
          }
          stored += 1;
        }
        // The gateway sends the full latest set of locations each time, so the table is replaced.
        q('DELETE FROM locations').run();
        for (const l of value.locations) {
          if (tomb.has(l.name) && (l.at ?? 0) <= tomb.get(l.name)) continue;
          q('INSERT INTO locations(name, map_id, x, y, level, class_id, at, zone) VALUES(?,?,?,?,?,?,?,?)').run(l.name, l.mapID, l.x, l.y, l.level, l.classID, l.at, l.zone);
        }
        for (const a of value.acks) {
          q("UPDATE commands SET state = ?, state_at = ?, reason = ? WHERE id = ? AND state IN ('queued','fetched')").run(a.state, t, a.reason || null, a.id);
        }
        if (value.catalog.verified.length || value.catalog.templates.length) {
          q('DELETE FROM catalog').run();
          for (const v of value.catalog.verified) q("INSERT INTO catalog(kind, id, label, slot) VALUES('verified',?,?,NULL)").run(v.id, v.name);
          for (const v of value.catalog.templates) q("INSERT INTO catalog(kind, id, label, slot) VALUES('template',?,?,?)").run(v.id, v.text, v.slot);
        }
        setMeta('last_upload_at', t); setMeta('last_written_at', value.writtenAt);
        return { stored, forgot, locations: value.locations.length, acks: value.acks.length };
      });
    },

    // ------------------------------------------------------------ reads
    meta(key) { return q('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null; },
    listMembers() { return q('SELECT * FROM members ORDER BY name COLLATE NOCASE').all(); },
    leaderboard(by = 'mom_money', limit = 50) {
      const column = by === 'medals' ? 'medals' : 'mom_money';
      return q(`SELECT name, level, class_id, title, medals, mom_money, last_heard FROM members ORDER BY ${column} DESC, name COLLATE NOCASE LIMIT ?`).all(limit);
    },
    member(name) {
      const row = q('SELECT * FROM members WHERE name = ?').get(name);
      if (!row) return null;
      const stats = Object.fromEntries(q('SELECT key, value FROM stats_latest WHERE name = ?').all(name).map((r) => [r.key, r.value]));
      const history = q('SELECT day, key, value FROM stats_daily WHERE name = ? ORDER BY day DESC LIMIT 400').all(name);
      return { ...row, stats, history };
    },
    locations(ttl = LOCATION_TTL) {
      q('DELETE FROM locations WHERE at < ?').run(now() - ttl);
      return q('SELECT * FROM locations ORDER BY zone, name COLLATE NOCASE').all();
    },
    catalog() {
      const plain = (rows) => rows.map((r) => ({ ...r }));
      return { verified: plain(q("SELECT id, label FROM catalog WHERE kind = 'verified' ORDER BY label").all()), templates: plain(q("SELECT id, label, slot FROM catalog WHERE kind = 'template' ORDER BY slot, id").all()) };
    },
    overview() {
      const count = (sql, ...a) => q(sql).get(...a).n;
      return {
        members: count('SELECT COUNT(*) n FROM members'),
        heard24h: count('SELECT COUNT(*) n FROM members WHERE last_heard >= ?', now() - 86400),
        heard7d: count('SELECT COUNT(*) n FROM members WHERE last_heard >= ?', now() - 7 * 86400),
        medals: count('SELECT COALESCE(SUM(medals),0) n FROM members'),
        lastUploadAt: Number(store.meta('last_upload_at')) || null,
        lastWrittenAt: Number(store.meta('last_written_at')) || null,
        pendingCommands: count("SELECT COUNT(*) n FROM commands WHERE state IN ('queued','fetched')"),
        dbBytes: store.dbBytes(),
      };
    },
    dbBytes() { try { return path === ':memory:' ? 0 : statSync(path).size; } catch { return 0; } },

    // ------------------------------------------------------------ commands
    createCommand(kind, payload, user, role) {
      const t = now();
      const id = Number(q('INSERT INTO commands(kind, payload, created_by, role, created_at, state, state_at) VALUES(?,?,?,?,?,?,?)').run(kind, JSON.stringify(payload), user, role, t, 'queued', t).lastInsertRowid);
      store.audit(user, role, 'command.create', `#${id} ${kind} ${JSON.stringify(payload).slice(0, 300)}`);
      return id;
    },
    // Commands for the companion. Marks queued ones as fetched.
    pendingCommands(after = 0) {
      const rows = q("SELECT id, kind, payload FROM commands WHERE id > ? AND state IN ('queued','fetched') ORDER BY id LIMIT 50").all(after);
      const t = now();
      for (const r of rows) q("UPDATE commands SET state = 'fetched', state_at = ? WHERE id = ? AND state = 'queued'").run(t, r.id);
      return rows.map((r) => ({ id: r.id, kind: r.kind, ...JSON.parse(r.payload) }));
    },
    listCommands(limit = 50) { return q('SELECT id, kind, payload, created_by, role, created_at, state, state_at, reason FROM commands ORDER BY id DESC LIMIT ?').all(limit); },

    // ------------------------------------------------------------ users, sessions, sources
    addUser(name, role, hash) {
      q('INSERT INTO users(name, role, hash, created_at) VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET role = excluded.role, hash = excluded.hash').run(name, role, hash, now());
    },
    getUser(name) { return q('SELECT * FROM users WHERE name = ? COLLATE NOCASE').get(name) ?? null; },
    listUsers() { return q('SELECT name, role, created_at FROM users ORDER BY role, name COLLATE NOCASE').all(); },
    removeUser(name) { q('DELETE FROM sessions WHERE user = ?').run(name); return q('DELETE FROM users WHERE name = ?').run(name).changes > 0; },
    createSession(user, role, ttl = 12 * 3600) {
      const token = randomBytes(32).toString('hex');
      q('INSERT INTO sessions(token_hash, user, role, expires_at) VALUES(?,?,?,?)').run(sha(token), user, role, now() + ttl);
      return token;
    },
    getSession(token) {
      if (typeof token !== 'string' || token.length !== 64) return null;
      const row = q('SELECT user, role, expires_at FROM sessions WHERE token_hash = ?').get(sha(token));
      if (!row || row.expires_at < now()) return null;
      // A removed user or a changed role takes effect at once.
      const user = q('SELECT role FROM users WHERE name = ?').get(row.user);
      return user ? { user: row.user, role: user.role } : null;
    },
    deleteSession(token) { q('DELETE FROM sessions WHERE token_hash = ?').run(sha(String(token))); },
    purgeSessions() { q('DELETE FROM sessions WHERE expires_at < ?').run(now()); },
    addSource(label) {
      const key = randomBytes(32).toString('hex');
      q('INSERT INTO sources(label, key_hash, created_at) VALUES(?,?,?)').run(label, sha(key), now());
      return key;
    },
    findSource(key) {
      if (typeof key !== 'string' || key.length !== 64) return null;
      const row = q('SELECT id, label FROM sources WHERE key_hash = ?').get(sha(key));
      if (row) q('UPDATE sources SET last_seen = ? WHERE id = ?').run(now(), row.id);
      return row ?? null;
    },
    listSources() { return q('SELECT id, label, created_at, last_seen FROM sources ORDER BY id').all(); },
    removeSource(label) { return q('DELETE FROM sources WHERE label = ?').run(label).changes > 0; },

    // ------------------------------------------------------------ backups
    backup(dir, keep = 7) {
      mkdirSync(dir, { recursive: true });
      const stamp = new Date(now() * 1000).toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const file = join(dir, `pi-hub-${stamp}.sqlite`);
      rmSync(file, { force: true });
      db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      const files = readdirSync(dir).filter((f) => /^pi-hub-.*\.sqlite$/.test(f)).sort();
      for (const old of files.slice(0, Math.max(0, files.length - keep))) rmSync(join(dir, old), { force: true });
      return file;
    },
  };
  return store;
}
