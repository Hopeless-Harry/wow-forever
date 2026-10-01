import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createApp } from '../src/server.js';
import { validateIngest } from '../src/validate.js';
import { hashPassword, isPrivateAddress, LoginLimiter, verifyPassword } from '../src/auth.js';

let clock = 1790700000;
const now = () => clock;

async function start({ remote = '192.168.1.20' } = {}) {
  const store = createStore(':memory:', { now });
  store.addUser('harry', 'admin', hashPassword('correct horse battery'));
  store.addUser('mod', 'officer', hashPassword('officer password 1'));
  const key = store.addSource('pc');
  const app = createApp({ store, now, getRemote: () => remote, config: { allowPublic: false, secureCookies: false } });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { store, key, base, app, close: () => new Promise((ok) => { app.server.close(ok); app.server.closeAllConnections?.(); }) };
}
const login = async (ctx, name, password) => {
  const r = await fetch(`${ctx.base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name, password }) });
  return { status: r.status, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] };
};
const ajax = (ctx, cookie, path, body, extra = {}) => fetch(`${ctx.base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mam', cookie, ...extra }, body: JSON.stringify(body) });
const get = (ctx, cookie, path) => fetch(`${ctx.base}${path}`, { redirect: 'manual', headers: { cookie } });
const ingestBody = () => ({ writtenAt: clock, members: { Alice: { lastHeard: clock - 60, level: 60, classID: 5, medals: 12, momMoney: 340, title: 'Wine Mom', statsAt: clock - 60, stats: { wine: 3 } }, '<b>x</b>': { lastHeard: clock } }, locations: { Alice: { mapID: 2022, x: 0.5, y: 0.4, level: 60, classID: 5, at: clock - 20, zone: 'The Waking Shores' } }, forget: [], acks: [] });

test('address and password helpers', async () => {
  for (const ok of ['10.0.0.5', '192.168.1.9', '172.16.4.4', '127.0.0.1', '::1', '::ffff:192.168.0.2', '100.101.1.1', 'fd12::1', 'fe80::1']) assert.equal(isPrivateAddress(ok), true, ok);
  for (const bad of ['8.8.8.8', '172.32.0.1', '2001:db8::1', '100.128.0.1', '', undefined]) assert.equal(isPrivateAddress(bad), false, String(bad));
  const h = hashPassword('s3cret-password'); assert.equal(await verifyPassword('s3cret-password', h), true); assert.equal(await verifyPassword('wrong', h), false); assert.equal(await verifyPassword('x', 'junk'), false);
  const l = new LoginLimiter({ max: 2, now }); l.fail('a'); assert.equal(l.blocked('a'), false); l.fail('a'); assert.equal(l.blocked('a'), true); clock += 901; assert.equal(l.blocked('a'), false);
});

test('the hub refuses requests from public addresses', async () => {
  const ctx = await start({ remote: '8.8.8.8' });
  try { assert.equal((await fetch(`${ctx.base}/healthz`)).status, 403); assert.equal((await fetch(`${ctx.base}/login`)).status, 403); } finally { await ctx.close(); }
});

test('ingest needs a source key, validates, stores and then serves commands', async () => {
  const ctx = await start();
  try {
    const url = `${ctx.base}/api/ingest`;
    assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${'0'.repeat(64)}` }, body: '{}' })).status, 401);
    const auth = { Authorization: `Bearer ${ctx.key}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(url, { method: 'POST', headers: auth, body: 'not json' })).status, 400);
    assert.equal((await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ members: {} }) })).status, 400);
    const ok = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(ingestBody()) });
    assert.equal(ok.status, 200); const summary = await ok.json(); assert.equal(summary.ok, true); assert.equal(summary.stored, 2);
    assert.equal(ctx.store.member('Alice').level, 60);
    ctx.store.createCommand('announce', { text: 'Hi' }, 'harry', 'admin');
    const cmds = await (await fetch(`${ctx.base}/api/commands?after=0`, { headers: auth })).json();
    assert.deepEqual(cmds.commands.map((c) => c.text), ['Hi']);
    assert.equal((await fetch(`${ctx.base}/api/commands`)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: auth, body: 'x'.repeat(2 * 1024 * 1024 + 10) }).catch(() => ({ status: 413 }))).status, 413);
  } finally { await ctx.close(); }
});

test('login: wrong passwords fail, five failures lock out, success sets a strict cookie', async () => {
  const ctx = await start();
  try {
    assert.equal((await login(ctx, 'harry', 'nope')).status, 401);
    assert.equal((await login(ctx, 'ghost', 'nope')).status, 401);
    const good = await login(ctx, 'harry', 'correct horse battery'); assert.equal(good.status, 303); assert.match(good.cookie, /^mam_session=[0-9a-f]{64}$/);
    const r = await fetch(`${ctx.base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'harry', password: 'x' }) });
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    for (let i = 0; i < 5; i++) await login(ctx, 'mod', 'bad');
    assert.equal((await login(ctx, 'mod', 'officer password 1')).status, 429);
    const cookieHeader = (await fetch(`${ctx.base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'harry', password: 'correct horse battery' }) })).headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Strict/);
    assert.ok(ctx.store.listAudit().some((a) => a.action === 'login.fail'));
  } finally { await ctx.close(); }
});

test('pages need a login and render escaped data without inline scripts', async () => {
  const ctx = await start();
  try {
    assert.equal((await get(ctx, '', '/members')).status, 303);
    assert.equal((await get(ctx, '', '/api/ui/anything')).status, 401);
    ctx.store.ingest(validateIngest(ingestBody()).value);
    const { cookie } = await login(ctx, 'mod', 'officer password 1');
    for (const path of ['/', '/members', '/leaderboard', '/map', '/commands', '/member?name=Alice']) {
      const r = await get(ctx, cookie, path); assert.equal(r.status, 200, path); const html = await r.text();
      assert.doesNotMatch(html, /<script(?![^>]*src=)/i, path); assert.doesNotMatch(html, /<b>x<\/b>/);
    }
    const members = await (await get(ctx, cookie, '/members')).text();
    assert.match(members, /Alice/); assert.match(members, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(await (await get(ctx, cookie, '/map')).text(), /The Waking Shores/);
    assert.equal((await get(ctx, cookie, '/audit')).status, 404); assert.equal((await get(ctx, cookie, '/users')).status, 404);
  } finally { await ctx.close(); }
});

test('zone art is served only after login and drawn behind the dots; unknown art falls back to the grid', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const maps = mkdtempSync(join(tmpdir(), 'maps-')); mkdirSync(join(maps, 'retail'));
  writeFileSync(join(maps, 'retail', '2022.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  writeFileSync(join(maps, 'retail', 'index.json'), '﻿' + JSON.stringify({ 2022: { file: '2022.jpg', w: 1024, h: 683, name: 'The Waking Shores' }, 99: { file: '../../evil.jpg', w: 10, h: 10 } }));
  const store = createStore(':memory:', { now }); store.addUser('harry', 'admin', hashPassword('correct horse battery'));
  const app = createApp({ store, now, getRemote: () => '127.0.0.1', config: { allowPublic: false, secureCookies: false, mapsDir: maps } });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  const ctx = { base: `http://127.0.0.1:${app.server.address().port}` };
  try {
    store.ingest(validateIngest({ writtenAt: clock, client: 'retail', members: {}, locations: { Zed: { mapID: 2022, x: 0.5, y: 0.25, at: clock - 5, zone: 'The Waking Shores' }, Evil: { mapID: 99, x: 0.1, y: 0.1, at: clock - 5, zone: 'Odd' }, Gap: { mapID: 5, x: 0.1, y: 0.1, at: clock - 5, zone: 'Unmapped' } } }).value);
    assert.equal((await fetch(`${ctx.base}/maps/retail/2022.jpg`, { redirect: 'manual' })).status, 303);
    const { cookie } = await login(ctx, 'harry', 'correct horse battery');
    const img = await get(ctx, cookie, '/maps/retail/2022.jpg'); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal((await get(ctx, cookie, '/maps/retail/3.jpg')).status, 404); assert.equal((await get(ctx, cookie, '/maps/retail/..%2Findex.json')).status, 404);
    const html = await (await get(ctx, cookie, '/map')).text();
    assert.match(html, /<image href="\/maps\/retail\/2022\.jpg" width="1024" height="683"/); assert.match(html, /cx="512\.0" cy="170\.8"/);
    assert.doesNotMatch(html, /evil\.jpg/); assert.match(html, /class="field"/);
  } finally { await new Promise((ok) => { app.server.close(ok); app.server.closeAllConnections?.(); }); rmSync(maps, { recursive: true, force: true }); }
});

test('the banner warns when the gateway has not uploaded recently', async () => {
  const ctx = await start();
  try {
    const { cookie } = await login(ctx, 'harry', 'correct horse battery');
    assert.match(await (await get(ctx, cookie, '/')).text(), /No data has reached the hub/);
    ctx.store.ingest(validateIngest(ingestBody()).value);
    clock += 3600; assert.match(await (await get(ctx, cookie, '/')).text(), /has not uploaded for/);
  } finally { await ctx.close(); }
});

test('commands: role limits, validation, csrf protection and the audit trail', async () => {
  const ctx = await start();
  try {
    const mod = (await login(ctx, 'mod', 'officer password 1')).cookie, admin = (await login(ctx, 'harry', 'correct horse battery')).cookie;
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'announce', text: 'Raid at 8' })).status, 200);
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'award', target: 'Alice', medal: 'selfie_squad' })).status, 200);
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'quests', week: 3, slots: ['-', 'wine', '-'] })).status, 403);
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'config', key: 'motd', text: 'x' })).status, 403);
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'announce', text: '' })).status, 400);
    assert.equal((await ajax(ctx, admin, '/api/ui/commands', { kind: 'quests', week: 3, slots: ['-', 'wine', '-'] })).status, 200);
    assert.equal((await ajax(ctx, admin, '/api/ui/commands', { kind: 'config', key: 'motd', text: 'Be kind' })).status, 200);
    assert.equal((await fetch(`${ctx.base}/api/ui/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: mod }, body: JSON.stringify({ kind: 'announce', text: 'x' }) })).status, 403);
    assert.equal((await ajax(ctx, mod, '/api/ui/commands', { kind: 'announce', text: 'x' }, { Origin: 'http://evil.example' })).status, 403);
    assert.equal((await ajax(ctx, '', '/api/ui/commands', { kind: 'announce', text: 'x' })).status, 401);
    const audit = ctx.store.listAudit(50).map((a) => a.action);
    assert.ok(audit.includes('command.create')); assert.ok(audit.includes('command.denied'));
    const html = await (await get(ctx, admin, '/commands')).text(); assert.match(html, /Raid at 8/); assert.match(html, /mod \(officer\)/);
    assert.deepEqual(ctx.store.pendingCommands(0).map((c) => c.kind), ['announce', 'award', 'quests', 'config']);
  } finally { await ctx.close(); }
});

test('admin manages logins and cannot lock themselves out', async () => {
  const ctx = await start();
  try {
    const admin = (await login(ctx, 'harry', 'correct horse battery')).cookie, mod = (await login(ctx, 'mod', 'officer password 1')).cookie;
    assert.equal((await ajax(ctx, mod, '/api/ui/users', { action: 'save', name: 'x', role: 'admin', password: 'longenoughpass' })).status, 404);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'save', name: 'newofficer', role: 'officer', password: 'longenoughpass' })).status, 200);
    assert.equal((await login(ctx, 'newofficer', 'longenoughpass')).status, 303);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'save', name: 'a', role: 'officer', password: 'longenoughpass' })).status, 400);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'save', name: 'bob', role: 'officer', password: 'short' })).status, 400);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'save', name: 'harry', role: 'officer', password: 'longenoughpass' })).status, 400);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'remove', name: 'harry' })).status, 400);
    assert.equal((await ajax(ctx, admin, '/api/ui/users', { action: 'remove', name: 'newofficer' })).status, 200);
    assert.equal(ctx.store.getUser('newofficer'), null);
    assert.equal((await get(ctx, mod, '/members')).status, 200);
    assert.ok(ctx.store.listAudit().some((a) => a.action === 'user.save'));
  } finally { await ctx.close(); }
});

test('logout ends the session', async () => {
  const ctx = await start();
  try {
    const { cookie } = await login(ctx, 'harry', 'correct horse battery');
    assert.equal((await get(ctx, cookie, '/members')).status, 200);
    await fetch(`${ctx.base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie } });
    assert.equal((await get(ctx, cookie, '/members')).status, 303);
  } finally { await ctx.close(); }
});
