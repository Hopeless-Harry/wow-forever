import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan()');return h;}
const DAY=86400, NOW=1790704800;
test('the weekly recap covers the last seven days only',()=>{
  const h=setup();
  h.run(`local E=MAMChronicles.EventStore; E:Append("character.death",{zone="Old",mapID=1},{occurredAt=${NOW-10*DAY}}); E:Append("character.death",{zone="Recent",mapID=2},{occurredAt=${NOW-2*DAY}}); E:Append("quest.completed",{questID=5},{occurredAt=${NOW-1*DAY}}); __r=MAMChronicles.Export:BuildWeeklyRecap()`);
  const r=h.get('__r'); assert.match(r,/Moms Against Magic Chronicles - Week of \d{1,2} \w{3}/); assert.match(r,/recap/i); assert.match(r,/Deaths 1/); assert.match(r,/Quests 1/);
  assert.ok(!/Mumtest|Draenor/.test(r));
});
test('a quiet week says so',()=>{ const h=setup(); h.run('__r=MAMChronicles.Export:BuildWeeklyRecap()'); assert.match(h.get('__r'),/Quiet week/); });
test('/mam recap week shows the weekly text and plain /mam recap stays monthly',()=>{
  const h=setup(); h.slash('recap week'); assert.match(h.get('MAMChronicles.UI.copyText'),/Week of/);
  h.slash('recap'); assert.ok(!/Week of/.test(h.get('MAMChronicles.UI.copyText'))); assert.match(h.get('MAMChronicles.UI.copyText'),/recap/i);
});
test('help mentions the weekly recap',()=>{ const h=setup(); h.slash('help'); assert.ok(h.calls.printed.join('\n').includes('recap week')); });
