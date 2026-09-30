import assert from 'node:assert/strict';
import test from 'node:test';
import { createWowHarness, multi } from './harness.js';

function loadCapabilities(harness) {
  harness.load(['Core.lua', 'Capabilities.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize(); MAMChroniclesDiagnostics.RunCapabilities()');
  return harness.get('MAMChroniclesDiagnosticsDB.capabilities');
}

test('capability probes retain only bounded non-identifying facts', () => {
  const harness = createWowHarness({
    globals: {
      C_Map: {
        GetBestMapForUnit: () => 1411,
        GetPlayerMapPosition: () => ({ GetXY: () => multi(0.25, 0.75) }),
      },
      UnitPosition: () => multi(100, 200, 0, 1),
      GetProfessions: () => multi(1, 2, null, null, null),
      GetProfessionInfo: (index) => multi(`PRIVATE_PROFESSION_${index}`, 1, index * 100, 300),
      C_TradeSkillUI: { GetAllRecipeIDs: () => [101, 102] },
      GetNumGuildMembers: () => 3,
      GetGuildRosterInfo: (index) => multi(
        `PRIVATE_GUILD_MEMBER_${index}`,
        'PRIVATE_RANK',
        1,
        20,
        'Mage',
        'PRIVATE_ZONE',
        '',
        '',
        index !== 2,
      ),
      C_ChatInfo: {
        RegisterAddonMessagePrefix: () => 0,
        AreOutgoingAddonChatMessagesRestricted: () => false,
        InChatMessagingLockdown: () => false,
      },
      Enum: {
        RegisterAddonMessagePrefixResult: { Success: 0, DuplicatePrefix: 1 },
      },
    },
  });

  const capabilities = loadCapabilities(harness);
  assert.deepEqual(capabilities.map, {
    available: true,
    mapID: 1411,
    positionAvailable: true,
    worldPositionAvailable: true,
    x: 0.25,
    y: 0.75,
  });
  assert.deepEqual(capabilities.professions, {
    available: true,
    primaryCount: 2,
    recipeCount: 2,
    skillInfoCount: 2,
  });
  assert.deepEqual(capabilities.guild, { available: true, memberCount: 3, onlineCount: 2 });
  assert.deepEqual(capabilities.messaging, {
    available: true,
    chatLockdown: false,
    chatLockdownAvailable: true,
    outgoingRestricted: false,
    prefixRegistered: true,
    registrationResult: 'success',
  });
  assert.doesNotMatch(JSON.stringify(capabilities), /PRIVATE_/u);
});

test('messaging probe distinguishes outgoing restriction from chat lockdown', () => {
  const harness = createWowHarness({
    globals: {
      C_ChatInfo: {
        RegisterAddonMessagePrefix: () => 0,
        AreOutgoingAddonChatMessagesRestricted: () => true,
        InChatMessagingLockdown: () => false,
      },
      Enum: {
        RegisterAddonMessagePrefixResult: { Success: 0, DuplicatePrefix: 1 },
      },
    },
  });

  harness.load(['Core.lua', 'Capabilities.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');
  assert.deepEqual(harness.get('MAMChroniclesDiagnostics.ProbeMessaging()'), {
    available: true,
    chatLockdown: false,
    chatLockdownAvailable: true,
    outgoingRestricted: true,
    prefixRegistered: true,
    registrationResult: 'success',
  });
});

test('profession probe checks a populated second slot when the first is vacant', () => {
  const queried = [];
  const harness = createWowHarness({
    globals: {
      GetProfessions: () => multi(null, 2, null, null, null),
      GetProfessionInfo: (index) => {
        queried.push(index);
        return multi('PRIVATE_PROFESSION', null, 75, 150);
      },
    },
  });

  harness.load(['Core.lua', 'Capabilities.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');
  assert.deepEqual(harness.get('MAMChroniclesDiagnostics.ProbeProfessions()'), {
    available: true,
    primaryCount: 1,
    recipeCount: 0,
    skillInfoCount: 1,
  });
  assert.deepEqual(queried, [2]);
});

test('profession probe fails closed when the first profession lookup throws', () => {
  const harness = createWowHarness({
    globals: {
      GetProfessions: () => multi(1, 2, null, null, null),
      GetProfessionInfo: () => { throw new Error('PRIVATE_PROFESSION_FAILURE'); },
    },
  });

  harness.load(['Core.lua', 'Capabilities.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  assert.deepEqual(harness.get('MAMChroniclesDiagnostics.ProbeProfessions()'), {
    available: false,
    reason: 'profession-query-error',
  });
});

test('profession probe fails closed when the second profession lookup throws', () => {
  const harness = createWowHarness({
    globals: {
      GetProfessions: () => multi(1, 2, null, null, null),
      GetProfessionInfo: (index) => {
        if (index === 2) throw new Error('PRIVATE_SECOND_PROFESSION_FAILURE');
        return multi('PRIVATE_PROFESSION', null, 75, 150);
      },
    },
  });

  harness.load(['Core.lua', 'Capabilities.lua']);
  harness.call('MAMChroniclesDiagnostics.Initialize()');

  assert.deepEqual(harness.get('MAMChroniclesDiagnostics.ProbeProfessions()'), {
    available: false,
    reason: 'profession-query-error',
  });
});

test('missing capability APIs are reported without throwing', () => {
  const capabilities = loadCapabilities(createWowHarness());
  assert.deepEqual(capabilities.map, { available: false, reason: 'map-api-missing' });
  assert.deepEqual(capabilities.professions, { available: false, reason: 'profession-api-missing' });
  assert.deepEqual(capabilities.guild, { available: false, reason: 'guild-api-missing' });
  assert.deepEqual(capabilities.messaging, { available: false, reason: 'chat-api-missing' });
});

test('throwing capability APIs become unavailable results', () => {
  const explode = () => { throw new Error('PRIVATE_THROW_DETAIL'); };
  const harness = createWowHarness({
    globals: {
      C_Map: { GetBestMapForUnit: explode, GetPlayerMapPosition: explode },
      UnitPosition: explode,
      GetProfessions: explode,
      GetProfessionInfo: explode,
      GetNumGuildMembers: explode,
      GetGuildRosterInfo: explode,
      C_ChatInfo: {
        RegisterAddonMessagePrefix: explode,
        AreOutgoingAddonChatMessagesRestricted: explode,
      },
    },
  });
  const capabilities = loadCapabilities(harness);
  assert.deepEqual(capabilities.map, { available: false, reason: 'map-query-error' });
  assert.deepEqual(capabilities.professions, { available: false, reason: 'profession-query-error' });
  assert.deepEqual(capabilities.guild, { available: false, reason: 'guild-query-error' });
  assert.deepEqual(capabilities.messaging, { available: false, reason: 'chat-query-error' });
  assert.doesNotMatch(JSON.stringify(capabilities), /PRIVATE_THROW_DETAIL/u);
});
