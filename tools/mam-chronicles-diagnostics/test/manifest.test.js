import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addonPath } from './harness.js';

function luaFiles(toc) {
  return toc
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.lua'));
}

test('manifest targets Forever and loads the four diagnostic modules', () => {
  const toc = readFileSync(addonPath('MAMChroniclesDiagnostics.toc'), 'utf8');
  assert.match(toc, /^## Interface: 16001$/mu);
  assert.match(toc, /^## SavedVariables: MAMChroniclesDiagnosticsDB$/mu);
  assert.deepEqual(luaFiles(toc), ['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
});
