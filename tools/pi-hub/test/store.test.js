import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.js';
import { validateIngest } from '../src/validate.js';

let clock = 1790700000;
const fresh = () => createStore(':memory:', { now: () => clock });
const upload = (store, patch = {}) => {
  const payload = {
    writtenAt: clock,
    members: { Alice: { lastHeard: clock - 100, level: 60, classID: 5, raceID: 1, title: 'Wine Mom', medals: 12, momMoney: 340, statsAt: clock - 100, stats: { wine: 3, jumps: 90 } } },
    locations: { Zed: { mapID: 2022, x: 0.5, y: 0.4, level: 80, classID: 3, at: clock - 30, zone: 'The Waking Shores' } },
    forget: [], acks: [], catalog: { verified: [], templates: [] }, ...patch,
  };
  const r = validateIngest(payload);
  assert.equal(r.ok, true);
  return store.ingest(r.value);
};

test('ingest stores members, latest stats, a daily snapshot and the latest location', () => {
  clock = 1790700000; const s = fresh(); upload(s);
  const m = s.member('Alice');
  assert.equal(m.level, 60); assert.equal(m.medals, 12); assert.equal(m.title, 'Wine Mom');
  assert.deepEqual(m.stats, { wine: 3, jumps: 90 });
  assert.equal(m.history.length, 2);
  assert.equal(s.locations().length, 1);
});

test('a second upload the same day replaces that day, a later day adds history (kept forever)', () => {
  clock = 1790700000; const s = fresh(); upload(s);
  upload(s, { members: { Alice: { lastHeard: clock, statsAt: clock, stats: { wine: 4 } } } });
  assert.equal(s.member('Alice').history.filter((h) => h.key === 'wine').length, 1);
  assert.equal(s.member('Alice').stats.wine, 4);
  clock += 3 * 86400;
  upload(s, { members: { Alice: { lastHeard: clock, statsAt: clock, stats: { wine: 9 } } } });
  assert.equal(s.member('Alice').history.filter((h) => h.key === 'wine').length, 2);
});

test('locations are only the latest per member and expire after ten minutes', () => {
  clock = 1790700000; const s = fresh(); upload(s);
  upload(s, { locations: { Zed: { mapID: 1, x: 0.1, y: 0.1, at: clock } } });
  assert.equal(s.locations().length, 1); assert.equal(s.locations()[0].map_id, 1);
  clock += 601; assert.equal(s.locations().length, 0);
});

test('forget deletes everything about a member and later stale uploads cannot bring them back', () => {
  clock = 1790700000; const s = fresh(); upload(s);
  upload(s, { members: {}, locations: {}, forget: [{ name: 'Alice', at: clock }] });
  assert.equal(s.member('Alice'), null);
  upload(s, { members: { Alice: { lastHeard: clock - 50, stats: { wine: 1 } } }, locations: { Alice: { mapID: 1, x: 0, y: 0, at: clock - 50 } } });
  assert.equal(s.member('Alice'), null); assert.equal(s.locations().length, 0);
  upload(s, { members: { Alice: { lastHeard: clock + 10, stats: { wine: 1 } } }, locations: {} });
  assert.notEqual(s.member('Alice'), null);
});

test('leaderboard and overview use the stored data', () => {
  clock = 1790700000; const s = fresh(); upload(s, { members: { Alice: { lastHeard: clock, medals: 12, momMoney: 340 }, Bob: { lastHeard: clock - 5 * 86400, medals: 30, momMoney: 100 } } });
  assert.equal(s.leaderboard('mom_money')[0].name, 'Alice'); assert.equal(s.leaderboard('medals')[0].name, 'Bob');
  const o = s.overview(); assert.equal(o.members, 2); assert.equal(o.heard24h, 1); assert.equal(o.heard7d, 2); assert.equal(o.lastUploadAt, clock);
});

test('commands queue, are fetched once, and acks from the gateway update their state', () => {
  clock = 1790700000; const s = fresh();
  const id = s.createCommand('announce', { text: 'Hello' }, 'harry', 'admin');
  const first = s.pendingCommands(0); assert.deepEqual(first, [{ id, kind: 'announce', text: 'Hello' }]);
  assert.equal(s.listCommands()[0].state, 'fetched');
  upload(s, { acks: [{ id, state: 'relayed', at: clock }] });
  assert.equal(s.listCommands()[0].state, 'relayed');
  assert.deepEqual(s.pendingCommands(0), []);
  upload(s, { acks: [{ id, state: 'rejected', reason: 'late', at: clock }] });
  assert.equal(s.listCommands()[0].state, 'relayed');
  assert.ok(s.listAudit().some((a) => a.action === 'command.create'));
});

test('users, sessions and source keys', () => {
  clock = 1790700000; const s = fresh();
  s.addUser('harry', 'admin', 'hash'); s.addUser('mod', 'officer', 'hash');
  assert.equal(s.getUser('HARRY').role, 'admin'); assert.equal(s.listUsers().length, 2);
  const token = s.createSession('mod', 'officer');
  assert.deepEqual(s.getSession(token), { user: 'mod', role: 'officer' });
  clock += 13 * 3600; assert.equal(s.getSession(token), null);
  clock = 1790700000; const t2 = s.createSession('mod', 'officer'); s.removeUser('mod'); assert.equal(s.getSession(t2), null);
  const key = s.addSource('pc'); assert.equal(s.findSource(key).label, 'pc'); assert.equal(s.findSource('0'.repeat(64)), null); assert.equal(s.findSource('short'), null);
});

test('the catalog from the gateway feeds the command composer', () => {
  clock = 1790700000; const s = fresh();
  upload(s, { catalog: { verified: [{ id: 'selfie_squad', name: 'Selfie Squad' }], templates: [{ id: 'wine', slot: 2, text: 'Wine' }] } });
  assert.deepEqual(s.catalog().verified, [{ id: 'selfie_squad', label: 'Selfie Squad' }]);
  assert.equal(s.catalog().templates[0].slot, 2);
});

test('backups are written and only the newest seven are kept', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pihub-'));
  try {
    const s = createStore(join(dir, 'hub.sqlite'), { now: () => clock }); upload(s);
    for (let i = 0; i < 9; i++) { clock += 60; s.backup(join(dir, 'backups'), 7); }
    assert.equal(readdirSync(join(dir, 'backups')).length, 7);
    s.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
