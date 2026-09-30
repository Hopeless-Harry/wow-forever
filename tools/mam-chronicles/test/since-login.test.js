import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const NOW=1790704800, DAY=86400;
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan()');return h;}
// The previous session ran from NOW-ago-3600 to NOW-ago. Events happen only while playing, so "since last login" means "what you did last session".
const prev=(ago,key='MAMChronicles.characterKey')=>`table.insert(MAMChroniclesDB.sessions,{id="old",characterKey=${key},startedAt=${NOW-ago-3600},endedAt=${NOW-ago}})`;
const at=(ago)=>NOW-ago-1800;
test('last session: levels, quests, deaths, discoveries and medals are counted',()=>{
  const h=setup();
  h.run(`${prev(2*DAY)}; local E=MAMChronicles.EventStore; E:Append("character.level_up",{level=11},{occurredAt=${at(2*DAY)}}); E:Append("character.level_up",{level=12},{occurredAt=${at(2*DAY)+60}}); E:Append("quest.completed",{questID=1},{occurredAt=${at(2*DAY)}}); E:Append("quest.completed",{questID=2},{occurredAt=${at(2*DAY)+10}}); E:Append("character.death",{zone="Z",mapID=3},{occurredAt=${at(2*DAY)}}); E:Append("world.zone_discovered",{zone="Y",mapID=4},{occurredAt=${at(2*DAY)}}); E:Append("medal.earned",{medalId="x",medalName="X",points=25},{occurredAt=${at(2*DAY)}}); E:Append("quest.completed",{questID=3},{occurredAt=${at(5*DAY)}}); __s=MAMChronicles.Statistics:BuildSinceLastLogin()`);
  assert.equal(h.get('__s.levels'),2); assert.equal(h.get('__s.quests'),2); assert.equal(h.get('__s.deaths'),1); assert.equal(h.get('__s.discoveries'),1); assert.equal(h.get('__s.medals'),1); assert.equal(h.get('__s.points'),25);
  assert.ok(h.get('__s.away')>=2*DAY-10); assert.equal(h.get('__s.played'),3600);
});
test('a quick relog, no earlier session or another character produce no summary',()=>{
  let h=setup(); assert.equal(h.get('MAMChronicles.Statistics:BuildSinceLastLogin()'),null);
  h=setup(); h.run(prev(120)+`; MAMChronicles.EventStore:Append("quest.completed",{questID=1},{occurredAt=${at(120)}})`); assert.equal(h.get('MAMChronicles.Statistics:BuildSinceLastLogin()'),null);
  h=setup(); h.run(prev(2*DAY,'"someone-else"')+`; MAMChronicles.EventStore:Append("quest.completed",{questID=1},{occurredAt=${at(2*DAY)}})`); assert.equal(h.get('MAMChronicles.Statistics:BuildSinceLastLogin()'),null);
});
test('a previous session that recorded nothing gives no summary',()=>{ const h=setup(); h.run(prev(2*DAY)); assert.equal(h.get('MAMChronicles.Statistics:BuildSinceLastLogin()'),null); });
test('a session that never ended cleanly still counts up to the next session',()=>{
  const h=setup(); h.run(`table.insert(MAMChroniclesDB.sessions,{id="crashed",characterKey=MAMChronicles.characterKey,startedAt=${NOW-2*DAY-3600}}); MAMChronicles.EventStore:Append("quest.completed",{questID=1},{occurredAt=${NOW-2*DAY-1800}}); __s=MAMChronicles.Statistics:BuildSinceLastLogin()`);
  assert.equal(h.get('__s.quests'),1);
});
test('the summary sentence is short and readable',()=>{
  const h=setup(); h.run(`${prev(2*DAY)}; MAMChronicles.EventStore:Append("character.level_up",{level=11},{occurredAt=${at(2*DAY)}}); MAMChronicles.EventStore:Append("quest.completed",{questID=1},{occurredAt=${at(2*DAY)}}); __t=MAMChronicles.Statistics:DescribeSinceLastLogin(MAMChronicles.Statistics:BuildSinceLastLogin())`);
  const t=h.get('__t'); assert.match(t,/Last session \(2 days ago, 1h 0m played\)/); assert.match(t,/\+1 level/); assert.match(t,/1 quest/);
});
test('Home shows the last-session line',()=>{
  const h=setup(); h.run(`${prev(3*3600)}; MAMChronicles.EventStore:Append("quest.completed",{questID=1},{occurredAt=${at(3*3600)}}); MAMChronicles.UI:Show()`);
  assert.match(h.get('MAMChronicles.Dashboard.monthBody.text'),/Last session \(3 hours ago/);
});
