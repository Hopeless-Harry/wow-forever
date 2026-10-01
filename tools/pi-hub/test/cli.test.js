import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { run } from '../src/cli.js';
import { verifyPassword } from '../src/auth.js';

const setup = () => { const lines = []; return { store: createStore(':memory:'), lines, out: (t) => lines.push(t) }; };

test('add-user creates a hashed login and prints a generated password once', async () => {
  const { store, lines, out } = setup();
  assert.equal(run(['add-user', 'harry', 'admin'], store, {}, out), 0);
  const password = /Password: (\S+)/.exec(lines[0])[1];
  assert.ok(password.length >= 10);
  assert.equal(await verifyPassword(password, store.getUser('harry').hash), true);
  assert.doesNotMatch(store.getUser('harry').hash, new RegExp(password));
  assert.equal(run(['add-user', 'mod', 'officer', 'my own passphrase'], store, {}, out), 0);
  assert.doesNotMatch(lines[1], /passphrase/);
});

test('bad input is refused', () => {
  const { store, lines, out } = setup();
  assert.equal(run(['add-user', 'x', 'admin'], store, {}, out), 1);
  assert.equal(run(['add-user', 'harry', 'king'], store, {}, out), 1);
  assert.equal(run(['add-user', 'harry', 'admin', 'short'], store, {}, out), 1);
  assert.equal(run(['bogus'], store, {}, out), 1);
  assert.equal(store.listUsers().length, 0);
  assert.ok(lines.length >= 4);
});

test('sources: the key is shown once and works for ingest lookups', () => {
  const { store, lines, out } = setup();
  assert.equal(run(['add-source', 'owner pc'], store, {}, out), 0);
  const key = /\n([0-9a-f]{64})/.exec(lines[0])[1];
  assert.equal(store.findSource(key).label, 'owner pc');
  assert.equal(run(['remove-source', 'owner pc'], store, {}, out), 0);
  assert.equal(store.findSource(key), null);
});
