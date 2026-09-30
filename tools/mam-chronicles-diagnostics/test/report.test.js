import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness, multi } from './harness.js';

function reportHarness() {
  const harness = createWowHarness({
    savedVariables: {
      schemaVersion: 1,
      loadCount: 2,
      persistence: { marker: '1790704800-1', privatePath: 'C:\\PRIVATE_ACCOUNT\\SavedVariables' },
      events: { PLAYER_DEAD: { count: 3, lastSeenAt: 1790704800, private: 'PRIVATE_EVENT' } },
      capabilities: {
        private: 'PRIVATE_CAPABILITY',
        professions: {
          available: true,
          archaeologyLearned: false,
          cookingLearned: true,
          fishingLearned: false,
          primaryCount: 0,
          recipeEnumerationAvailable: false,
          secondaryCount: 1,
          skillInfoCount: 1,
        },
        messaging: {
          available: true,
          prefixRegistered: true,
          registrationResult: 'success',
          outgoingRestricted: true,
          chatLockdownAvailable: true,
          chatLockdown: false,
        },
      },
      messages: { sent: 1, privateSender: 'PRIVATE_SENDER' },
    },
  });
  harness.load(['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');
  return harness;
}

test('report contains deterministic diagnostic sections and no private markers', () => {
  const harness = reportHarness();
  const report = harness.get('MAMChroniclesDiagnostics.BuildReportText()');
  for (const heading of ['Runtime', 'Persistence', 'Events', 'Map', 'Guild', 'Professions', 'Messaging', 'Next Actions']) {
    assert.match(report, new RegExp(`(^|\\n)${heading}($|\\n)`, 'u'));
  }
  assert.match(report, /Build: 70009/u);
  assert.match(report, /Addon version: 0\.1\.6-phase0/u);
  assert.match(report, /Client version: 1\.60\.1/u);
  assert.match(report, /Current marker: 1790704800-1/u);
  assert.match(report, /Loaded marker: 1790704800-1/u);
  assert.match(report, /Outgoing restricted: yes/u);
  assert.match(report, /Chat lockdown: no/u);
  assert.match(report, /PLAYER_DEAD: 3/u);
  assert.match(report, /Secondary professions visible: 1/u);
  assert.match(report, /Cooking learned: yes/u);
  assert.match(report, /Recipe enumeration available: no/u);
  assert.doesNotMatch(report, /Recipes visible in current window: 0/u);
  assert.doesNotMatch(report, /PRIVATE_|SavedVariables|C:\\/u);
});

test('report separates registration status from observed event counts', () => {
  const harness = createWowHarness();
  harness.run('__mamFailEvent = "QUEST_ACCEPTED"');
  harness.load(['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  const report = harness.get('MAMChroniclesDiagnostics.BuildReportText()');
  assert.match(report, /Event registration/u);
  assert.match(report, /QUEST_ACCEPTED: unavailable \(registration-error\)/u);
  assert.match(report, /PLAYER_DEAD: available; observed 0/u);
});

test('slash commands dispatch only the named diagnostic actions', () => {
  const harness = reportHarness();
  harness.run(`
    __mamActions = { run = 0, mark = 0, selfPing = 0, guildPing = 0, reset = 0, toggle = 0 }
    MAMChroniclesDiagnostics.RunAndRefresh = function() __mamActions.run = __mamActions.run + 1 end
    MAMChroniclesDiagnostics.MarkAndRefresh = function() __mamActions.mark = __mamActions.mark + 1 end
    MAMChroniclesDiagnostics.SendPing = function(scope)
      if scope == "self" then __mamActions.selfPing = __mamActions.selfPing + 1 end
      if scope == "guild" then __mamActions.guildPing = __mamActions.guildPing + 1 end
      return true
    end
    MAMChroniclesDiagnostics.ResetDiagnostics = function() __mamActions.reset = __mamActions.reset + 1 end
    MAMChroniclesDiagnostics.ToggleReport = function() __mamActions.toggle = __mamActions.toggle + 1 end
  `);

  harness.runSlash('run');
  harness.runSlash('mark');
  harness.runSlash('ping self');
  harness.runSlash('ping guild');
  harness.runSlash('reset');
  harness.runSlash('');
  assert.deepEqual(harness.get('__mamActions'), {
    guildPing: 1,
    mark: 1,
    reset: 1,
    run: 1,
    selfPing: 1,
    toggle: 1,
  });
});

test('restricted self ping reports that no message was sent', () => {
  const harness = createWowHarness({
    globals: {
      UnitFullName: () => multi('PRIVATE_CHARACTER', 'PRIVATE_REALM'),
      C_ChatInfo: {
        RegisterAddonMessagePrefix: () => 0,
        AreOutgoingAddonChatMessagesRestricted: () => true,
        InChatMessagingLockdown: () => false,
        SendAddonMessage: () => { throw new Error('send must not be attempted while restricted'); },
      },
      Enum: {
        RegisterAddonMessagePrefixResult: { Success: 0, DuplicatePrefix: 1 },
      },
    },
  });
  harness.load(['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  harness.runSlash('ping self');

  assert.equal(harness.calls.printed.length, 1);
  assert.match(harness.calls.printed[0], /self ping was not sent/u);
  assert.match(harness.calls.printed[0], /Messaging status/u);
});

test('unknown slash commands print concise help without echoing input', () => {
  const harness = reportHarness();
  harness.runSlash('PRIVATE_UNKNOWN_INPUT');
  assert.equal(harness.calls.printed.length, 1);
  assert.match(harness.calls.printed[0], /\/mamdiag run/u);
  assert.doesNotMatch(harness.calls.printed[0], /PRIVATE_UNKNOWN_INPUT/u);
});
