import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness } from './harness.js';

test('database initializes with a versioned privacy-safe shape', () => {
  const harness = createWowHarness();
  harness.load(['Core.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  const database = harness.get('MAMChroniclesDiagnosticsDB');
  assert.equal(database.schemaVersion, 1);
  assert.equal(database.loadCount, 1);
  assert.deepEqual(database.events, {});
  assert.deepEqual(database.capabilities, {});
  assert.doesNotMatch(JSON.stringify(database), /PRIVATE_CHARACTER|PRIVATE_REALM/u);
});

test('persistence marker survives initialization and advances explicitly', () => {
  const harness = createWowHarness({
    savedVariables: {
      schemaVersion: 1,
      loadCount: 4,
      persistence: { marker: 'kept-marker', markerCount: 2 },
    },
  });
  harness.load(['Core.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize(); MAMChroniclesDiagnostics.MarkPersistence()');

  const database = harness.get('MAMChroniclesDiagnosticsDB');
  assert.equal(database.loadCount, 5);
  assert.equal(database.persistence.previousMarker, 'kept-marker');
  assert.equal(database.persistence.loadedMarker, 'kept-marker');
  assert.equal(database.persistence.markerCount, 3);
  assert.match(database.persistence.marker, /^1790704800-3$/u);
  assert.equal(database.persistence.loadedMarker, 'kept-marker');
});

test('runtime build facts are recorded without identity data', () => {
  const harness = createWowHarness();
  harness.load(['Core.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  const runtime = harness.get('MAMChroniclesDiagnosticsDB.runtime');
  assert.deepEqual(runtime, {
    build: '70009',
    buildDate: 'Sep 25 2026',
    gameMode: 15,
    interface: 16001,
    locale: 'enGB',
    version: '1.60.1',
  });
});
