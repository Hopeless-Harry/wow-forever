import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness, multi } from './harness.js';

function messagingHarness({ restricted = false, inGuild = true } = {}) {
  const sent = [];
  const harness = createWowHarness({
    globals: {
      UnitFullName: () => multi('PRIVATE_CHARACTER', 'PRIVATE_REALM'),
      IsInGuild: () => inGuild,
      C_ChatInfo: {
        RegisterAddonMessagePrefix: () => true,
        AreOutgoingAddonChatMessagesRestricted: () => restricted,
        SendAddonMessage: (prefix, payload, channel, target) => {
          sent.push({ prefix, payload, channel, target });
          return 0;
        },
      },
    },
  });
  harness.load(['Core.lua', 'Capabilities.lua', 'Events.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize(); MAMChroniclesDiagnostics.RunCapabilities()');
  return { harness, sent };
}

test('self and guild pings use the registered bounded protocol', () => {
  const { harness, sent } = messagingHarness();
  harness.call('assert(MAMChroniclesDiagnostics.SendPing("self")); assert(MAMChroniclesDiagnostics.SendPing("guild"))');

  assert.equal(sent.length, 2);
  assert.equal(sent[0].prefix, 'MAMChronDiag');
  assert.match(sent[0].payload, /^PING\|1\|[A-Za-z0-9_-]{1,32}$/u);
  assert.deepEqual(sent[0], {
    prefix: 'MAMChronDiag',
    payload: sent[0].payload,
    channel: 'WHISPER',
    target: 'PRIVATE_CHARACTER-PRIVATE_REALM',
  });
  assert.equal(sent[1].channel, 'GUILD');
  assert.equal(sent[1].target, null);

  const messages = harness.get('MAMChroniclesDiagnosticsDB.messages');
  assert.equal(messages.sent, 2);
  assert.equal(messages.lastScope, 'guild');
  assert.doesNotMatch(JSON.stringify(messages), /PRIVATE_/u);
});

test('restricted or unavailable messaging refuses to send', () => {
  const restricted = messagingHarness({ restricted: true });
  restricted.harness.call('assert(not MAMChroniclesDiagnostics.SendPing("self"))');
  assert.equal(restricted.sent.length, 0);

  const noGuild = messagingHarness({ inGuild: false });
  noGuild.harness.call('assert(not MAMChroniclesDiagnostics.SendPing("guild"))');
  assert.equal(noGuild.sent.length, 0);
});

test('valid pings receive one response while malformed payloads are ignored', () => {
  const { harness, sent } = messagingHarness();
  harness.call(`
    assert(MAMChroniclesDiagnostics.HandleAddonMessage("OtherPrefix", "PING|1|abc", "GUILD", "PRIVATE_SENDER") == false)
    assert(MAMChroniclesDiagnostics.HandleAddonMessage("MAMChronDiag", "PING|1|bad space", "GUILD", "PRIVATE_SENDER") == false)
    assert(MAMChroniclesDiagnostics.HandleAddonMessage("MAMChronDiag", "PING|1|abcdefghijklmnopqrstuvwxyz1234567", "GUILD", "PRIVATE_SENDER") == false)
    assert(MAMChroniclesDiagnostics.HandleAddonMessage("MAMChronDiag", "PING|1|abc_123", "GUILD", "PRIVATE_SENDER") == true)
    assert(MAMChroniclesDiagnostics.HandleAddonMessage("MAMChronDiag", "PONG|1|abc_123", "GUILD", "PRIVATE_SENDER") == true)
  `);

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    prefix: 'MAMChronDiag',
    payload: 'PONG|1|abc_123',
    channel: 'GUILD',
    target: null,
  });
  const messages = harness.get('MAMChroniclesDiagnosticsDB.messages');
  assert.equal(messages.receivedPing, 1);
  assert.equal(messages.receivedPong, 1);
  assert.doesNotMatch(JSON.stringify(messages), /PRIVATE_SENDER/u);
});
