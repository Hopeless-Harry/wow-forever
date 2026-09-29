import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness } from './harness.js';

const expectedEvents = [
  'ADDON_LOADED',
  'PLAYER_LOGIN',
  'PLAYER_LOGOUT',
  'PLAYER_LEVEL_UP',
  'PLAYER_DEAD',
  'PLAYER_ALIVE',
  'PLAYER_UNGHOST',
  'QUEST_ACCEPTED',
  'QUEST_TURNED_IN',
  'ZONE_CHANGED',
  'ZONE_CHANGED_INDOORS',
  'ZONE_CHANGED_NEW_AREA',
  'PLAYER_ENTERING_WORLD',
  'GUILD_ROSTER_UPDATE',
  'SKILL_LINES_CHANGED',
  'TRADE_SKILL_SHOW',
  'CHAT_MSG_ADDON',
];

function loadEvents(harness) {
  harness.load(['Core.lua', 'Capabilities.lua', 'Events.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');
}

test('each diagnostic event registers independently', () => {
  const harness = createWowHarness();
  harness.run('__mamFailEvent = "QUEST_ACCEPTED"');
  loadEvents(harness);

  const registered = Object.values(harness.get('__mamCalls.registered'));
  assert.equal(registered.includes('QUEST_ACCEPTED'), false);
  for (const eventName of expectedEvents.filter((name) => name !== 'QUEST_ACCEPTED')) {
    assert.equal(registered.includes(eventName), true, `${eventName} was not registered`);
  }
  assert.deepEqual(harness.get('MAMChroniclesDiagnosticsDB.eventRegistration.QUEST_ACCEPTED'), {
    available: false,
    reason: 'registration-error',
  });
  assert.equal(harness.get('MAMChroniclesDiagnosticsDB.eventRegistration.PLAYER_DEAD.available'), true);
});

test('events store bounded counts and permitted numeric facts only', () => {
  const harness = createWowHarness();
  loadEvents(harness);

  harness.fireEvent('PLAYER_LEVEL_UP', 21, 0, 0, 0, 0, 0);
  harness.fireEvent('PLAYER_DEAD', 'PRIVATE_DEATH_DETAIL');
  harness.fireEvent('QUEST_TURNED_IN', 98765, 'PRIVATE_QUEST_TITLE');
  harness.fireEvent('ZONE_CHANGED_NEW_AREA', 'PRIVATE_ZONE_NAME');
  harness.fireEvent('SKILL_LINES_CHANGED', 'PRIVATE_PROFESSION_NAME');

  const events = harness.get('MAMChroniclesDiagnosticsDB.events');
  assert.deepEqual(events.PLAYER_LEVEL_UP, { count: 1, lastNumber: 21, lastSeenAt: 1790704800 });
  assert.deepEqual(events.PLAYER_DEAD, { count: 1, lastSeenAt: 1790704800 });
  assert.deepEqual(events.QUEST_TURNED_IN, { count: 1, lastNumber: 98765, lastSeenAt: 1790704800 });
  assert.equal(events.ZONE_CHANGED_NEW_AREA.count, 1);
  assert.equal(events.SKILL_LINES_CHANGED.count, 1);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_/u);
});

test('event history keeps only the current supported event catalogue', () => {
  const harness = createWowHarness({ savedVariables: {
    schemaVersion: 1,
    events: {
      PLAYER_DEAD: { count: 4, lastSeenAt: 10 },
      PRIVATE_UNKNOWN_EVENT: { count: 999, secret: 'PRIVATE_EVENT_MARKER' },
    },
  } });
  loadEvents(harness);
  harness.fireEvent('PLAYER_DEAD');

  const events = harness.get('MAMChroniclesDiagnosticsDB.events');
  assert.equal(events.PLAYER_DEAD.count, 5);
  assert.equal(events.PRIVATE_UNKNOWN_EVENT, undefined);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_EVENT_MARKER/u);
});
