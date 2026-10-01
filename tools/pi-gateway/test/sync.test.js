import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync as read } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStore } from '../../pi-hub/src/store.js';
import { createApp } from '../../pi-hub/src/server.js';
import { STAT_KEYS as HUB_KEYS } from '../../pi-hub/src/validate.js';
import { parseLuaFile, toLua } from '../src/lua.js';
import { buildPayload, selectDelta, STAT_KEYS } from '../src/payload.js';
import { syncOnce, loadState, saveState, findSavedVariables, writeInbox } from '../src/sync.js';

// Companion tests. The end-to-end test runs the real hub in-process. Everything here is an AUTOMATED test with a
// hand-built SavedVariables fixture; it has not run against a real WoW client.
const NOW = 1790700000;
const gatewayTable = (patch = {}) => ({
  MAMChroniclesDB: {
    events: [{ id: 'secret-chat-like', payload: { text: 'whisper from a friend' } }],
    settings: { shareStats: true, bnetTag: 'x#1234' },
    gateway: {
      enabled: true, version: 1,
      meta: { writtenAt: NOW - 60, version: 1 },
      members: {
        Alice: { lastHeard: NOW - 100, level: 60, classID: 5, raceID: 1, title: 'Wine Mom', medals: 12, momMoney: 340, statsAt: NOW - 100, seq: 3, stats: { wine: 3, jumps: 90, gold: 99999, itemName: 4 }, chat: 'hello', bnet: 'a#1' },
      },
      locations: { Zed: { mapID: 2022, x: 0.5, y: 0.4, level: 80, classID: 3, at: NOW - 30, zone: 'The Waking Shores' } },
      forget: [], ack: { lastCommandId: 0, results: [] },
      catalog: { verified: [{ id: 'selfie_squad', name: 'Selfie Squad' }], templates: [{ id: 'wine', slot: 2, text: 'Enjoy {n} glasses of wine' }] },
      ...patch,
    },
  },
});

function wowRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'wow-'));
  mkdirSync(join(dir, 'WTF', 'Account', 'ACCT', 'SavedVariables'), { recursive: true });
  mkdirSync(join(dir, 'Interface', 'AddOns'), { recursive: true });
  return dir;
}
const writeSaved = (root, data, ageSeconds = 600) => {
  const file = join(root, 'WTF', 'Account', 'ACCT', 'SavedVariables', 'MAMChronicles.lua');
  writeFileSync(file, `MAMChroniclesDB = ${toLua(data.MAMChroniclesDB)}\n`);
  const t = (Date.now() - ageSeconds * 1000) / 1000; utimesSync(file, t, t);
  return file;
};

test('the companion stat allowlist matches the hub and the addon', () => {
  assert.deepEqual([...STAT_KEYS].sort(), [...HUB_KEYS].sort());
  const lua = read(fileURLToPath(new URL('../../../addons/MAMChronicles/Share.lua', import.meta.url)), 'utf8');
  const counters = [...lua.match(/Share\.counterKeys = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const stats = [...lua.matchAll(/\{ key = "(\w+)", patterns/g)].map((m) => m[1]);
  assert.deepEqual([...STAT_KEYS].sort(), [...counters, ...stats].sort());
});

test('the payload contains only allowlisted fields, never chat, gold, events or settings', () => {
  const payload = buildPayload(parseLuaFile(`MAMChroniclesDB = ${toLua(gatewayTable().MAMChroniclesDB)}`));
  const text = JSON.stringify(payload);
  for (const forbidden of ['whisper', 'hello', 'x#1234', 'a#1', 'gold', 'itemName', 'secret-chat-like', 'bnet', 'shareStats']) assert.equal(text.includes(forbidden), false, forbidden);
  assert.deepEqual(payload.members.Alice.stats, { wine: 3, jumps: 90 });
  assert.deepEqual(Object.keys(payload.members.Alice).sort(), ['classID', 'lastHeard', 'level', 'medals', 'momMoney', 'raceID', 'stats', 'statsAt', 'title']);
  assert.equal(buildPayload({ MAMChroniclesDB: {} }), null);
  assert.equal(buildPayload({}), null);
});

test('only changed members are uploaded again; locations are always sent in full', () => {
  const payload = buildPayload(parseLuaFile(`MAMChroniclesDB = ${toLua(gatewayTable().MAMChroniclesDB)}`));
  const first = selectDelta(payload, {});
  assert.equal(first.changed, 1);
  const second = selectDelta(payload, { memberHashes: first.hashes });
  assert.equal(second.changed, 0); assert.deepEqual(second.body.members, {}); assert.equal(Object.keys(second.body.locations).length, 1);
  payload.members.Alice.medals = 13;
  assert.equal(selectDelta(payload, { memberHashes: first.hashes }).changed, 1);
});

async function withHub(fn) {
  const store = createStore(':memory:', { now: () => Math.floor(Date.now() / 1000) });
  const key = store.addSource('pc');
  const app = createApp({ store, now: () => Math.floor(Date.now() / 1000), getRemote: () => '127.0.0.1', config: { allowPublic: false, secureCookies: false } });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  try { return await fn({ store, key, hubUrl: `http://127.0.0.1:${app.server.address().port}` }); }
  finally { await new Promise((ok) => { app.server.close(ok); app.server.closeAllConnections?.(); }); }
}

test('end to end: upload to the real hub, deliver a command into the inbox, then see the ack', async () => {
  const root = wowRoot();
  try {
    await withHub(async ({ store, key, hubUrl }) => {
      const config = { hubUrl, key, wowRoots: [root], settleMs: 1000 };
      const state = loadState(join(root, 'state.json'));
      writeSaved(root, gatewayTable());
      let r = await syncOnce({ config, state });
      assert.equal(r.uploaded, 1); assert.equal(r.members, 1);
      assert.equal(store.member('Alice').level, 60); assert.deepEqual(store.member('Alice').stats, { wine: 3, jumps: 90 });
      assert.equal(store.locations(10 ** 9).length, 1); assert.equal(store.catalog().verified[0].id, 'selfie_squad');

      const id = store.createCommand('announce', { text: 'Raid at 8' }, 'harry', 'admin');
      store.createCommand('award', { target: 'Alice', medal: 'selfie_squad' }, 'mod', 'officer');
      r = await syncOnce({ config, state });
      assert.equal(r.uploaded, 0); assert.equal(r.commands, 2); assert.equal(r.inbox, true);
      const inbox = parseLuaFile(readFileSync(join(root, 'Interface', 'AddOns', 'MAMChroniclesInbox', 'Inbox.lua'), 'utf8')).MAMChroniclesInbox;
      assert.deepEqual(inbox.commands.map((c) => c.kind), ['announce', 'award']);
      assert.equal(inbox.commands[0].text, 'Raid at 8'); assert.equal(inbox.commands[1].target, 'Alice');
      assert.ok(existsSync(join(root, 'Interface', 'AddOns', 'MAMChroniclesInbox', 'MAMChroniclesInbox.toc')));
      assert.equal((await syncOnce({ config, state })).inbox, false);

      writeSaved(root, gatewayTable({ meta: { writtenAt: NOW, version: 1 }, ack: { lastCommandId: id + 1, results: [{ id, state: 'relayed', at: NOW }, { id: id + 1, state: 'rejected', reason: 'not verified', at: NOW }] } }));
      r = await syncOnce({ config, state });
      assert.equal(r.uploaded, 1);
      const states = Object.fromEntries(store.listCommands().map((c) => [c.id, c.state]));
      assert.deepEqual(states, { [id]: 'relayed', [id + 1]: 'rejected' });
      assert.equal(r.commands, 0); assert.equal(r.inbox, true);
      saveState(join(root, 'state.json'), state);
      assert.equal(loadState(join(root, 'state.json')).lastWrittenAt, NOW);
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a file that was just written is left alone, a missing gateway table is explained, a dead hub throws without losing state', async () => {
  const root = wowRoot();
  try {
    const dead = { hubUrl: 'http://127.0.0.1:9', key: '0'.repeat(64), wowRoots: [root], settleMs: 5000 };
    const state = loadState(join(root, 'state.json'));
    assert.match((await syncOnce({ config: { ...dead }, state, fetchImpl: async () => ({ ok: true, json: async () => ({ commands: [] }) }) })).note, /no MAMChronicles SavedVariables/);
    writeSaved(root, gatewayTable(), 0);
    assert.match((await syncOnce({ config: dead, state, fetchImpl: async () => ({ ok: true, json: async () => ({ commands: [] }) }) })).note, /just written/);
    writeSaved(root, { MAMChroniclesDB: { settings: {} } });
    assert.match((await syncOnce({ config: dead, state, fetchImpl: async () => ({ ok: true, json: async () => ({ commands: [] }) }) })).note, /no gateway data/);
    writeSaved(root, gatewayTable());
    await assert.rejects(syncOnce({ config: dead, state, fetchImpl: async () => { throw new Error('connect ECONNREFUSED'); } }));
    assert.equal(state.lastWrittenAt, 0);
    await assert.rejects(syncOnce({ config: dead, state, fetchImpl: async () => ({ ok: false, status: 500 }) }), /hub rejected/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the newest SavedVariables across clients wins and the inbox is only written where an AddOns folder exists', () => {
  const a = wowRoot(), b = wowRoot();
  try {
    writeSaved(a, gatewayTable(), 900); writeSaved(b, gatewayTable(), 100);
    assert.equal(findSavedVariables([a, b])[0].root, b);
    rmSync(join(b, 'Interface'), { recursive: true });
    assert.equal(writeInbox(b, [], Date.now()), false);
    assert.equal(writeInbox(a, [{ id: 1, kind: 'announce', text: 'x' }], Date.now()), true);
    assert.equal(writeInbox(a, [{ id: 1, kind: 'announce', text: 'x' }], Date.now() + 5000), false);
  } finally { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); }
});
