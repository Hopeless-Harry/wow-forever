import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../pi-hub/src/store.js';
import { createApp } from '../../pi-hub/src/server.js';
import { updateFromHub, isNewer } from '../src/updater.js';

const bundle = (version) => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }));
  writeFileSync(join(dir, 'src', 'sync.js'), `export const v = '${version}';\n`);
  writeFileSync(join(dir, 'src', 'notes.txt'), 'not served');
  return dir;
};

async function withHub(companionDir, fn) {
  const store = createStore(':memory:');
  const key = store.addSource('pc');
  const app = createApp({ store, getRemote: () => '127.0.0.1', config: { allowPublic: false, secureCookies: false, companionDir } });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  try { return await fn({ key, hubUrl: `http://127.0.0.1:${app.server.address().port}` }); }
  finally { await new Promise((ok) => { app.server.close(ok); app.server.closeAllConnections?.(); }); }
}

test('version comparison', () => {
  assert.equal(isNewer('0.2.0', '0.1.9'), true); assert.equal(isNewer('0.1.0', '0.1.0'), false);
  assert.equal(isNewer('0.1.0', '0.1.1'), false); assert.equal(isNewer('1', '0.9.9'), true);
});

test('the companion updates itself from the hub, verifying every checksum', async () => {
  const hubCopy = bundle('0.2.0'), mine = bundle('0.1.0'), other = bundle('0.1.0');
  try {
    await withHub(hubCopy, async ({ key, hubUrl }) => {
      const r = await updateFromHub({ hubUrl, key, appDir: mine });
      assert.deepEqual(r, { updated: true, version: '0.2.0' });
      assert.equal(readFileSync(join(mine, 'src', 'sync.js'), 'utf8'), "export const v = '0.2.0';\n");
      assert.equal(JSON.parse(readFileSync(join(mine, 'package.json'), 'utf8')).version, '0.2.0');
      assert.deepEqual(await updateFromHub({ hubUrl, key, appDir: mine }), { updated: false, version: '0.2.0' });
      await assert.rejects(updateFromHub({ hubUrl, key: '0'.repeat(64), appDir: other }), /manifest request failed/);
    });
  } finally { for (const d of [hubCopy, mine, other]) rmSync(d, { recursive: true, force: true }); }
});

test('a tampered download or a bad manifest replaces nothing', async () => {
  const mine = bundle('0.1.0');
  const respond = (value) => async () => ({ ok: true, status: 200, json: async () => value });
  try {
    const manifest = { version: '0.2.0', files: [{ name: 'package.json', size: 1, sha256: 'a'.repeat(64) }] };
    const fetchBad = async (url) => (url.includes('manifest') ? { ok: true, status: 200, json: async () => manifest } : { ok: true, status: 200, arrayBuffer: async () => Buffer.from('evil') });
    await assert.rejects(updateFromHub({ hubUrl: 'http://x', key: 'k', appDir: mine, fetchImpl: fetchBad }), /checksum mismatch/);
    assert.equal(JSON.parse(readFileSync(join(mine, 'package.json'), 'utf8')).version, '0.1.0');
    const traversal = { version: '0.3.0', files: [{ name: 'package.json', sha256: 'a'.repeat(64) }, { name: '../../evil.js', sha256: 'a'.repeat(64) }] };
    await assert.rejects(updateFromHub({ hubUrl: 'http://x', key: 'k', appDir: mine, fetchImpl: respond(traversal) }), /refusing file/);
    await assert.rejects(updateFromHub({ hubUrl: 'http://x', key: 'k', appDir: mine, fetchImpl: respond({ version: '9.0.0', files: [] }) }), /bad manifest/);
    assert.deepEqual(await updateFromHub({ hubUrl: 'http://x', key: 'k', appDir: mine, fetchImpl: async () => ({ ok: false, status: 404 }) }), { updated: false, version: '0.1.0' });
  } finally { rmSync(mine, { recursive: true, force: true }); }
});
