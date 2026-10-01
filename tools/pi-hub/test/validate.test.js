import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { STAT_KEYS, validateIngest, validateCommand, canSend } from '../src/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const shareLua = readFileSync(resolve(here, '../../../addons/MAMChronicles/Share.lua'), 'utf8');

test('the hub stat allowlist matches the addon Share.lua allowlist exactly', () => {
  const counters = [...shareLua.match(/Share\.counterKeys = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const stats = [...shareLua.matchAll(/\{ key = "(\w+)", patterns/g)].map((m) => m[1]);
  assert.deepEqual([...STAT_KEYS].sort(), [...counters, ...stats].sort());
});

const good = () => ({
  writtenAt: 1790700000,
  members: { Alice: { lastHeard: 1790699000, level: 60, classID: 5, raceID: 1, title: "Wine Mom", medals: 12, momMoney: 340, statsAt: 1790699000, stats: { wine: 3, jumps: 90 } } },
  locations: { Zed: { mapID: 2022, x: 0.5, y: 0.4, level: 80, classID: 3, at: 1790699500, zone: 'The Waking Shores' } },
  forget: [{ name: 'Bob', at: 1790600000 }],
  acks: [{ id: 5, state: 'relayed', at: 1790699900 }],
  catalog: { verified: [{ id: 'selfie_squad', name: 'Selfie Squad' }], templates: [{ id: 'wine', slot: 2, text: 'Enjoy {n} glasses of wine' }] },
});

test('a well formed upload is accepted whole', () => {
  const r = validateIngest(good());
  assert.equal(r.ok, true);
  assert.equal(r.value.members.length, 1);
  assert.deepEqual(r.value.members[0].stats, { wine: 3, jumps: 90 });
  assert.equal(r.value.locations[0].zone, 'The Waking Shores');
  assert.equal(r.value.catalog.verified.length, 1);
});

test('unknown stat keys and extra fields are dropped, never stored', () => {
  const p = good();
  p.members.Alice.stats.gold = 999; p.members.Alice.stats.itemName = 5; p.members.Alice.chat = 'hello'; p.members.Alice.battleTag = 'x#1234';
  const r = validateIngest(p);
  assert.deepEqual(r.value.members[0].stats, { wine: 3, jumps: 90 });
  assert.equal('chat' in r.value.members[0], false);
  assert.equal('battleTag' in r.value.members[0], false);
});

test('bad members, names, numbers and strings are rejected individually', () => {
  const p = good();
  p.members['bad|name'] = { lastHeard: 1 }; p.members.Carol = { lastHeard: 'x' }; p.members.Dave = { lastHeard: 1, level: 9999, title: '<script>' };
  p.locations.Eve = { mapID: 0, x: 2, y: 0, at: 1 };
  const r = validateIngest(p);
  assert.deepEqual(r.value.members.map((m) => m.name).sort(), ['Alice', 'Dave']);
  assert.equal(r.value.members.find((m) => m.name === 'Dave').level, null);
  assert.equal(r.value.members.find((m) => m.name === 'Dave').title, null);
  assert.equal(r.value.locations.length, 1);
  assert.ok(r.errors.length >= 3);
});

test('uploads are bounded', () => {
  const p = good();
  for (let i = 0; i < 400; i++) p.members[`P${i}`] = { lastHeard: 5 };
  assert.equal(validateIngest(p).value.members.length, 300);
  assert.equal(validateIngest(null).ok, false);
  assert.equal(validateIngest({ members: {} }).ok, false);
});

test('commands are validated into the addon inbox shape', () => {
  assert.deepEqual(validateCommand('announce', { text: ' Raid | Friday ' }).command, { kind: 'announce', text: 'Raid / Friday' });
  assert.equal(validateCommand('announce', { text: '' }).ok, false);
  assert.equal(validateCommand('announce', { text: 'x'.repeat(571) }).ok, false);
  assert.equal(validateCommand('announce', { text: 'café' }).ok, false);
  assert.deepEqual(validateCommand('award', { target: 'Alice', medal: 'selfie_squad' }).command, { kind: 'award', target: 'Alice', medal: 'selfie_squad' });
  assert.equal(validateCommand('award', { target: 'bad name', medal: 'x' }).ok, false);
  assert.equal(validateCommand('revoke', { target: 'Alice', medal: 'bad id!' }).ok, false);
  assert.deepEqual(validateCommand('quests', { week: 3, slots: ['-', 'wine', '-'] }).command, { kind: 'quests', week: 3, slots: ['-', 'wine', '-'] });
  assert.equal(validateCommand('quests', { week: 3, slots: ['-', 'wine'] }).ok, false);
  assert.equal(validateCommand('config', { key: 'motd', text: 'Be kind' }).ok, true);
  assert.equal(validateCommand('config', { key: 'gold', text: 'no' }).ok, false);
  assert.equal(validateCommand('nope', {}).ok, false);
});

test('officers can announce, award and revoke; the rest is admin only', () => {
  for (const kind of ['announce', 'award', 'revoke']) assert.equal(canSend('officer', kind), true);
  for (const kind of ['quests', 'config']) { assert.equal(canSend('officer', kind), false); assert.equal(canSend('admin', kind), true); }
  assert.equal(canSend('member', 'announce'), false);
});
