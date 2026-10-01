import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/index.js';

const write = (value) => { const dir = mkdtempSync(join(tmpdir(), 'cfg-')); const file = join(dir, 'config.json'); writeFileSync(file, JSON.stringify(value)); return { dir, file }; };

test('a good config gets defaults', () => {
  const { dir, file } = write({ hubUrl: 'http://192.168.1.50:8080', key: 'a'.repeat(64), wowRoots: ['C:/WoW/_retail_'] });
  try { const c = loadConfig(file); assert.equal(c.pollSeconds, 60); assert.equal(c.autoUpdate, true); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a bad config explains every problem', () => {
  const { dir, file } = write({ hubUrl: 'nope', key: 'short', wowRoots: [] });
  try { assert.throws(() => loadConfig(file), (e) => /hubUrl/.test(e.message) && /key/.test(e.message) && /wowRoots/.test(e.message)); } finally { rmSync(dir, { recursive: true, force: true }); }
});
