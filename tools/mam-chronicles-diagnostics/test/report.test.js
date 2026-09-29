import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness } from './harness.js';

function reportHarness() {
  const harness = createWowHarness({
    savedVariables: {
      schemaVersion: 1,
      loadCount: 2,
      persistence: { marker: '1790704800-1', privatePath: 'C:\\PRIVATE_ACCOUNT\\SavedVariables' },
      events: { PLAYER_DEAD: { count: 3, lastSeenAt: 1790704800, private: 'PRIVATE_EVENT' } },
      capabilities: { private: 'PRIVATE_CAPABILITY' },
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
  assert.match(report, /Addon version: 0\.1\.2-phase0/u);
  assert.match(report, /Client version: 1\.60\.1/u);
  assert.match(report, /Current marker: 1790704800-1/u);
  assert.match(report, /Loaded marker: 1790704800-1/u);
  assert.match(report, /PLAYER_DEAD: 3/u);
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

test('unknown slash commands print concise help without echoing input', () => {
  const harness = reportHarness();
  harness.runSlash('PRIVATE_UNKNOWN_INPUT');
  assert.equal(harness.calls.printed.length, 1);
  assert.match(harness.calls.printed[0], /\/mamdiag run/u);
  assert.doesNotMatch(harness.calls.printed[0], /PRIVATE_UNKNOWN_INPUT/u);
});
