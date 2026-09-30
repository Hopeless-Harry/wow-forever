import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan()');return h;}
const T0=1788000000, DAY=86400;
const seed=`
local E=MAMChronicles.EventStore
local function death(day,zone,id,kind) E:Append("character.death",{zone=zone,mapID=id,deathKind=kind},{occurredAt=${T0}+day*${DAY}+id}) end
death(1,"Dalaran",1); death(1,"Dalaran",2); death(1,"Dalaran",3); death(2,"Stormwind",4); death(3,"Dalaran",5,"falling"); death(3,"Dalaran",6,"falling")
E:Append("world.zone_discovered",{zone="Hyjal",mapID=10},{occurredAt=${T0}+5*${DAY}}); E:Append("world.zone_discovered",{zone="Hyjal",mapID=11},{occurredAt=${T0}+5*${DAY}+1}); E:Append("world.zone_discovered",{zone="Tirisfal",mapID=12},{occurredAt=${T0}+6*${DAY}})
E:Append("session.logout",{duration=14400},{occurredAt=${T0}+8*${DAY}})
E:Append("character.level_up",{level=30},{occurredAt=${T0}+9*${DAY}})
__h=MAMChronicles.Statistics:BuildHighlights()`;
test('highlights find the most dangerous place, worst day and falls',()=>{
  const h=setup(); h.run(seed);
  assert.equal(h.get('__h.deathZone'),'Dalaran'); assert.equal(h.get('__h.deathZoneCount'),5); assert.equal(h.get('__h.deaths'),6);
  assert.equal(h.get('__h.worstDayDeaths'),3); assert.equal(h.get('__h.falls'),2);
});
test('highlights find favourite place, longest session, time played and top level',()=>{
  const h=setup(); h.run(seed);
  assert.equal(h.get('__h.favouriteZone'),'Hyjal'); assert.equal(h.get('__h.favouriteZoneCount'),2); assert.equal(h.get('__h.longestSession'),14400); assert.equal(h.get('__h.timePlayed'),14400); assert.equal(h.get('__h.highestLevel'),30);
  assert.ok(h.get('__h.busiestDayEvents')>=3); assert.ok(h.get('__h.firstAt')>0);
});
test('the description has a shame and a fame section with readable values',()=>{
  const h=setup(); h.run(seed+'; __t=MAMChronicles.Statistics:DescribeHighlights(__h)');
  const t=h.get('__t'); assert.match(t,/Hall of Shame/); assert.match(t,/Hall of Fame/); assert.match(t,/Most dangerous place: Dalaran \(5 deaths\)/); assert.match(t,/Worst day: .* \(3 deaths\)/);
  assert.match(t,/Falls: 2/); assert.match(t,/Longest session: 4h 0m/); assert.match(t,/Time played: 4h 0m/); assert.match(t,/Favourite place: Hyjal \(2 discoveries\)/); assert.match(t,/Highest level: 30/);
});
test('an empty Chronicle produces no sections',()=>{
  const h=setup(); h.run('__t=MAMChronicles.Statistics:DescribeHighlights(MAMChronicles.Statistics:BuildHighlights())'); assert.equal(h.get('__t'),null);
});
test('highlights only use the current character',()=>{
  const h=setup(); h.run(`MAMChronicles.EventStore:Append("character.death",{zone="Elsewhere",mapID=9},{occurredAt=${T0}}); for _,e in ipairs(MAMChroniclesDB.events) do if e.type=="character.death" then e.characterKey="other" end end; __h=MAMChronicles.Statistics:BuildHighlights()`);
  assert.equal(h.get('__h.deaths'),0);
});
test('the Statistics tab shows the halls with coloured headings',()=>{
  const h=setup(); h.run(seed+'; local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Statistics"); __c=UI.content.text');
  const c=h.get('__c'); assert.match(c,/Hall of Shame/); assert.match(c,/Most dangerous place/); assert.match(c,/\|cff[0-9a-f]{6}Hall of Shame\|r/);
});
test('the highlights are built from recorded events only and never include names',()=>{
  const h=setup(); h.run(seed+'; __t=MAMChronicles.Statistics:DescribeHighlights(MAMChronicles.Statistics:BuildHighlights())');
  assert.ok(!/Mumtest|Draenor/.test(h.get('__t')));
});
