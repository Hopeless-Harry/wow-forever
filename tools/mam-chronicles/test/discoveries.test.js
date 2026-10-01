import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files = ['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function boot(place, saved) {
  const h = createHarness({ savedVariables: saved, globals: { GetZoneText: () => place.zone, GetSubZoneText: () => place.sub, C_Map: { GetBestMapForUnit: () => place.map ?? 84 } } });
  h.load(files); h.run('MAMChronicles:Boot()'); return h;
}
const count = 'MAMChronicles.EventStore:Count("world.zone_discovered")';

test('walking back into a place you have already been does not count as a new discovery', () => {
  const place = { zone: 'Stormwind City', sub: 'Trade District', map: 84 };
  const h = boot(place);
  h.fire('ZONE_CHANGED'); assert.equal(h.get(count), 1);
  h.run('__t=1'); for (let i = 0; i < 5; i++) { h.fire('ZONE_CHANGED'); h.fire('ZONE_CHANGED_INDOORS'); }
  assert.equal(h.get(count), 1);
  place.sub = 'Old Town'; h.run('MAMChronicles.Now=function() return 1790800000 end'); h.fire('ZONE_CHANGED'); assert.equal(h.get(count), 2);
  place.sub = 'Trade District'; h.run('MAMChronicles.Now=function() return 1790800100 end'); h.fire('ZONE_CHANGED'); assert.equal(h.get(count), 2);
  place.zone = 'Darkshore'; place.sub = 'Auberdine'; place.map = 62; h.run('MAMChronicles.Now=function() return 1790800200 end'); h.fire('ZONE_CHANGED_NEW_AREA'); assert.equal(h.get(count), 3);
});

test('discoveries are remembered between sessions', () => {
  const saved = { schemaVersion: 1, meta: { discoveriesDeduped: true }, events: [], discoveries: { 'Player-1234-ABCDEF': { count: 1, '62|darkshore|': true } } };
  const h = boot({ zone: 'Darkshore', sub: '', map: 62 }, saved);
  h.fire('ZONE_CHANGED'); assert.equal(h.get(count), 0);
  const other = boot({ zone: 'Ashenvale', sub: '', map: 63 }, { schemaVersion: 1, meta: { discoveriesDeduped: true }, events: [], discoveries: { 'Player-1234-ABCDEF': { count: 1, '62|darkshore|': true } } });
  other.fire('ZONE_CHANGED'); assert.equal(other.get(count), 1);
});

test('each character discovers places for themselves', () => {
  const place = { zone: 'Elwynn Forest', sub: 'Goldshire', map: 37 };
  const h = boot(place);
  h.fire('ZONE_CHANGED'); h.run('MAMChronicles.characterKey="Player-2"; MAMChronicles.Now=function() return 1790800000 end'); h.fire('ZONE_CHANGED');
  assert.equal(h.get(count), 2);
});

test('a place with no name is not recorded', () => {
  const h = boot({ zone: '', sub: '', map: 84 });
  h.fire('ZONE_CHANGED'); assert.equal(h.get(count), 0);
});

test('Explorer medal progress counts each place once', () => {
  const place = { zone: 'Westfall', sub: 'Sentinel Hill', map: 52 };
  const h = boot(place);
  h.fire('ZONE_CHANGED'); for (let i = 0; i < 10; i++) h.fire('ZONE_CHANGED');
  h.run('__v=MAMChronicles.Medals:GetDefinition("explorer_1").value(MAMChronicles.Medals:BuildContext())'); assert.equal(h.get('__v'), 1);
});

test('an old Chronicle full of repeat discoveries is cleaned once, keeping the first visit to each place', () => {
  const ev = (id, zone, sub, at) => ({ id, schemaVersion: 1, type: 'world.zone_discovered', occurredAt: at, observedAt: at, characterKey: 'Player-1', payload: { zone, subzone: sub, mapID: 1 } });
  const saved = { schemaVersion: 1, meta: {}, events: [ev('a', 'Darkshore', '', 1), ev('b', 'Darkshore', '', 100), ev('c', 'Stormwind City', '', 200), ev('d', 'Darkshore', '', 300), ev('e', 'Stormwind City', '', 400), ev('f', 'Darkshore', 'Auberdine', 500)],
    medalTallies: { 'Player-1': { total: 6, signals: {}, professions: {}, built: true, 'world.zone_discovered': 6 } } };
  const h = boot({ zone: 'Elsewhere', sub: '', map: 5 }, saved);
  assert.equal(h.get('#MAMChroniclesDB.events'), 3);
  assert.equal(h.get('MAMChroniclesDB.medalTallies["Player-1"]["world.zone_discovered"]'), 3);
  assert.equal(h.get('MAMChroniclesDB.diagnostics.discoveryCleanup.removed'), 3);
  assert.equal(h.get('MAMChroniclesDB.meta.discoveriesDeduped'), true);
  h.run('__again=MAMChronicles.Database:DedupeDiscoveries(MAMChroniclesDB); __known=MAMChroniclesDB.discoveries["Player-1"]["1|darkshore|"]');
  assert.equal(h.get('__again'), 0); assert.equal(h.get('__known'), true);
});

test('erasing the Chronicle forgets discovered places so they can be discovered again', () => {
  const place = { zone: 'Teldrassil', sub: '', map: 57 };
  const h = boot(place);
  h.fire('ZONE_CHANGED'); h.run('MAMChronicles.Database:ClearHistory(); MAMChronicles.Now=function() return 1790800000 end'); h.fire('ZONE_CHANGED');
  assert.equal(h.get(count), 1);
});
