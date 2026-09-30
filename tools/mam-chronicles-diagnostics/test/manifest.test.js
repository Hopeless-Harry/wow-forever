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

test('manifest targets Retail and Forever and loads the four diagnostic modules', () => {
  const toc = readFileSync(addonPath('MAMChroniclesDiagnostics.toc'), 'utf8');
  const interfaceLine = toc.match(/^## Interface:\s*(.+)$/mu)?.[1];
  const interfaces = interfaceLine?.split(',').map((value) => Number.parseInt(value.trim(), 10)).sort((a, b) => a - b);
  assert.deepEqual(interfaces, [16001, 120100, 120105]);
  assert.match(toc, /^## Version: 0\.1\.4-phase0$/mu);
  assert.match(toc, /^## SavedVariables: MAMChroniclesDiagnosticsDB$/mu);
  assert.deepEqual(luaFiles(toc), ['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
});
