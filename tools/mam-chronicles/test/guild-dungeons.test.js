import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(pre=''){
  const h=createHarness(); h.load(files.slice(0,1));
  h.run(`__guild={}; __raid=false; __members=0; __inst=false; __kind="none"
function IsInInstance() return __inst,__kind end
function IsInRaid() return __raid end
function GetNumGroupMembers() return __members end
function UnitIsUnit(a,b) return a==b end
function UnitIsInMyGuild(unit) return __guild[unit]==true end
function GetInstanceInfo() return "Hall of Thanes",__kind,1,"",5,0,false,9 end
${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}'); return h;
}
const enter=(kind,guild,raid=false,members=5)=>`__inst=true; __kind="${kind}"; __raid=${raid}; __members=${members}; __guild={${guild.map(u=>`["${u}"]=true`).join(',')}}; MAMChronicles.Collectors.inInstance=false; MAMChronicles.Collectors:CaptureInstance()`;
const c=(name)=>`(MAMChroniclesDB.counters[MAMChronicles.characterKey] or {}).${name}`;

test('a dungeon with a guildmate counts as a squad run',()=>{
  const h=setup(); h.run(enter('party',['party1','party3'])); assert.equal(h.get(c('dungeon_guild')),1); assert.equal(h.get(c('dungeon_guild_full')),null);
});
test('a dungeon with no guildmates counts nothing extra',()=>{
  const h=setup(); h.run(enter('party',[])); assert.equal(h.get(c('dungeon_guild')),null);
});
test('a full guild group of five counts as a full party',()=>{
  const h=setup(); h.run(enter('party',['party1','party2','party3','party4'])); assert.equal(h.get(c('dungeon_guild')),1); assert.equal(h.get(c('dungeon_guild_full')),1);
});
test('a raid with five or more guildmates counts as a raid crew run',()=>{
  const h=setup(); h.run(enter('raid',['raid2','raid3','raid4','raid5','raid6'],true,10)); assert.equal(h.get(c('raid_guild')),1); assert.equal(h.get(c('dungeon_guild')),null);
  const g=setup(); g.run(enter('raid',['raid2','raid3'],true,10)); assert.equal(g.get(c('raid_guild')),null);
});
test('battlegrounds and open world never count',()=>{
  const h=setup(); h.run(enter('pvp',['party1','party2'])); assert.equal(h.get(c('dungeon_guild')),null);
});
test('the check runs once per entry and waits for the group to settle when timers exist',()=>{
  const h=setup('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}');
  h.run(enter('party',['party1'])); assert.equal(h.get(c('dungeon_guild')),null); assert.equal(h.get('#__timers'),1);
  h.run('__guild={["party1"]=true,["party2"]=true}; table.remove(__timers,1)()'); assert.equal(h.get(c('dungeon_guild')),1);
  h.run('__timers={}; MAMChronicles.Collectors:CaptureInstance()'); assert.equal(h.get(c('dungeon_guild')),1);
});
test('a missing guild API never breaks entering a dungeon',()=>{
  const h=setup('UnitIsInMyGuild=nil'); h.run(enter('party',['party1'])); assert.equal(h.get(c('dungeon_guild')),null); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('the guild dungeon medals exist, have titles and unlock from the counters',()=>{
  const h=setup(); h.run('__d=""; for _,id in ipairs({"squad_1","squad_3","full_party_1","raid_crew_1"}) do if not MAMChronicles.Medals:GetDefinition(id) then __d=__d..id.." " end end; __t1=MAMChronicles.Medals.titles.squad; __t2=MAMChronicles.Medals.titles.full_party; __t3=MAMChronicles.Medals.titles.raid_crew');
  assert.equal(h.get('__d'),''); assert.ok(h.get('__t1')); assert.ok(h.get('__t2')); assert.ok(h.get('__t3'));
  h.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); '+enter('party',['party1'])+'; MAMChronicles.Medals:Evaluate("t"); __e=MAMChroniclesDB.medals[MAMChronicles.characterKey].earned["squad_1"]~=nil');
  assert.equal(h.get('__e'),true);
});
test('a weekly quest can ask for a dungeon with a guildmate',()=>{
  const h=setup(); h.run('__f=false; for _,t in ipairs(MAMChronicles.Medals:GetQuestTemplates()) do if t.counter=="dungeon_guild" then __f=true end end'); assert.equal(h.get('__f'),true);
});
