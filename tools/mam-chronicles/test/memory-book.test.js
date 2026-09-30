import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
const T0=1788000000, DAY=86400;
const seed=`
local E=MAMChronicles.EventStore
E:Append("quest.completed",{questID=2,questName="Second Quest"},{occurredAt=${T0}+2*${DAY}})
E:Append("quest.completed",{questID=1,questName="First Quest"},{occurredAt=${T0}+1*${DAY}})
E:Append("character.death",{zone="Dalaran",mapID=1},{occurredAt=${T0}+3*${DAY}})
E:Append("character.death",{zone="Hyjal",mapID=2,deathKind="falling"},{occurredAt=${T0}+4*${DAY}})
E:Append("instance.entered",{instanceName="Hall of Thanes",instanceType="party",mapID=9},{occurredAt=${T0}+5*${DAY}})
E:Append("character.level_up",{level=10},{occurredAt=${T0}+6*${DAY}}); E:Append("character.level_up",{level=11},{occurredAt=${T0}+6*${DAY}+1000}); E:Append("character.level_up",{level=20},{occurredAt=${T0}+9*${DAY}})
E:Append("memory.manual",{text="Killed the boss",zone="Hyjal"},{occurredAt=${T0}+7*${DAY},pinned=true}); E:Append("memory.manual",{text="Tea time"},{occurredAt=${T0}+8*${DAY},pinned=true})
MAMChroniclesDB.events[#MAMChroniclesDB.events+1]={id="other",schemaVersion=1,type="quest.completed",occurredAt=${T0},observedAt=${T0},characterKey="someone-else",payload={questName="Not Mine"}}
__b=MAMChronicles.Statistics:BuildMemoryBook(); __t=MAMChronicles.Statistics:DescribeMemoryBook(__b)`;
test('firsts use the oldest matching entry',()=>{
  const h=setup(); h.run(seed);
  assert.equal(h.get('__b.firsts.quest.text'),'First Quest'); assert.equal(h.get('__b.firsts.death.text'),'Dalaran'); assert.equal(h.get('__b.firsts.dungeon.text'),'Hall of Thanes');
  assert.equal(h.get('__b.firsts.quest.at'),1788000000+86400);
});
test('level milestones record the first time each tens level was reached',()=>{
  const h=setup(); h.run(seed); assert.equal(h.get('#__b.levels'),2); assert.equal(h.get('__b.levels[1].level'),10); assert.equal(h.get('__b.levels[2].level'),20);
});
test('memories are listed newest first with their place',()=>{
  const h=setup(); h.run(seed); assert.equal(h.get('#__b.memories'),2); assert.equal(h.get('__b.memories[1].text'),'Tea time'); assert.equal(h.get('__b.memories[2].zone'),'Hyjal');
});
test('close calls list recent deaths newest first and flag falls',()=>{
  const h=setup(); h.run(seed); assert.equal(h.get('#__b.deaths'),2); assert.equal(h.get('__b.deaths[1].zone'),'Hyjal'); assert.equal(h.get('__b.deaths[1].fell'),true); assert.equal(h.get('__b.deaths[2].fell'),false);
});
test('the book never includes other characters',()=>{
  const h=setup(); h.run(seed); assert.ok(!/Not Mine/.test(h.get('__t')));
});
test('the text has chapters in a friendly order',()=>{
  const h=setup(); h.run(seed); const t=h.get('__t');
  assert.match(t,/^Memory Book/); assert.ok(t.indexOf('Firsts')<t.indexOf('Milestones')); assert.ok(t.indexOf('Milestones')<t.indexOf('Memories')); assert.ok(t.indexOf('Memories')<t.indexOf('Close calls'));
  assert.match(t,/First quest: First Quest/); assert.match(t,/First death: Dalaran/); assert.match(t,/First dungeon: Hall of Thanes/); assert.match(t,/Reached level 10/); assert.match(t,/Killed the boss/); assert.match(t,/Hyjal \(fell\)/);
});
test('the strongest earned medals are listed',()=>{
  const h=setup(); h.run(seed+'; local row=MAMChroniclesDB.medals[MAMChronicles.characterKey]; row.earned["adventurer_3"]={at=1,points=50}; row.earned["quest_machine_4"]={at=2,points=100}; __b=MAMChronicles.Statistics:BuildMemoryBook(); __t=MAMChronicles.Statistics:DescribeMemoryBook(__b)');
  assert.equal(h.get('__b.medals[1].points'),100); assert.match(h.get('__t'),/Best medals/); assert.match(h.get('__t'),/\+100/);
});
test('memories are capped so the book stays short',()=>{
  const h=setup(); h.run(`for i=1,45 do MAMChronicles.EventStore:Append("memory.manual",{text="m"..i},{occurredAt=${T0}+i,pinned=true}) end; __b=MAMChronicles.Statistics:BuildMemoryBook()`);
  assert.equal(h.get('#__b.memories'),30); assert.equal(h.get('__b.memoryCount'),45);
});
test('an empty Chronicle says so kindly',()=>{
  const h=setup(); h.run('MAMChronicles.Database:ClearHistory(); __t=MAMChronicles.Statistics:DescribeMemoryBook(MAMChronicles.Statistics:BuildMemoryBook())');
  assert.match(h.get('__t'),/Nothing in the book yet/);
});
test('/mam book and the Home button open the book to read or copy',()=>{
  const h=setup(); h.run(seed); h.slash('book'); assert.match(h.get('MAMChronicles.UI.copyText'),/^Memory Book/);
  h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Home"); MAMChronicles.UI.copyText=""; local d=MAMChronicles.Dashboard; d.bookButton.scripts.OnClick(d.bookButton)'); assert.match(h.get('MAMChronicles.UI.copyText'),/^Memory Book/);
});
test('the book has no realm, GUID or character name',()=>{
  const h=setup(); h.run(seed); assert.ok(!/Mumtest|Draenor|Player-/.test(h.get('__t')));
});
test('help lists the book command',()=>{ const h=setup(); h.slash('help'); assert.ok(h.calls.printed.join('\n').includes('/mam book')); });
