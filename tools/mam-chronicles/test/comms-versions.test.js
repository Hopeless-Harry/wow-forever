import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot()');return h;}
test('a medal this build does not know is counted as unknown, not dropped',()=>{
  const h=setup(); h.fire('CHAT_MSG_ADDON','MAMCHR','M1|brand_new_medal_3|25|1','GUILD','Bob-Draenor');
  assert.equal(h.get('MAMChronicles.Comms.status.unknown'),1); assert.equal(h.get('MAMChronicles.Comms.status.dropped'),0); assert.equal(h.get('#MAMChroniclesDB.guildFeed'),0);
});
test('a known medal from another catalogue version is counted separately',()=>{
  const h=setup(); h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|25|2','GUILD','Bob-Draenor');
  assert.equal(h.get('MAMChronicles.Comms.status.otherVersion'),1); assert.equal(h.get('MAMChronicles.Comms.status.dropped'),0); assert.equal(h.get('#MAMChroniclesDB.guildFeed'),0);
});
test('forged points are still dropped',()=>{
  const h=setup(); h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|9999|1','GUILD','Bob-Draenor');
  assert.equal(h.get('MAMChronicles.Comms.status.dropped'),1);
});
test('unknown and other-version counts are flood limited and shown in diagnostics',()=>{
  const h=setup(); for(let i=0;i<30;i++) h.fire('CHAT_MSG_ADDON','MAMCHR',`M1|future_${i}|25|1`,'GUILD','Spammy-Draenor');
  assert.ok(h.get('MAMChronicles.Comms.status.unknown')<=10);
  h.run('__d=MAMChronicles.Export:BuildDiagnosticReport()'); assert.match(h.get('__d'),/Guild sharing: .*dropped \d+, unknown \d+, other version \d+/);
});
