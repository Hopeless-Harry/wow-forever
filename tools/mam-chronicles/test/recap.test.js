import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__cats={[2]={"Deaths",-1},[3]={"Quests",-1},[5]={"Dungeons & Raids",-1}}
__stats={[2]={{101,"Total deaths"}},[3]={{201,"Quests completed"}},[5]={{501,"Total 5-player dungeons entered"}}}
__vals={[101]="12",[201]="1,234",[501]="30"}
function GetStatisticsCategoryList() return {2,3,5} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end`;
function setup(){const h=createHarness();h.load(['Core.lua']);h.run(api);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan()');return h;}
test('the monthly recap summarises the month without names or gold',()=>{
  const h=setup();
  h.run('__vals[201]="1,244"; __vals[101]="15"; MAMChronicles.AchievementStats:Scan(); MAMChronicles.EventStore:Append("quest.completed",{questID=1,questName="Find Mum"}); MAMChronicles.EventStore:Append("character.death",{zone="Cave"}); MAMChronicles.EventStore:Append("memory.manual",{text="Tea"}); MAMChronicles.EventStore:Append("medal.earned",{medalId="fresh_start",medalName="Fresh Start",points=10});'
   +'local row=MAMChroniclesDB.statistics[MAMChronicles.characterKey]; MAMChroniclesDB.statisticCatalog[999]={name="Gold looted",group="Gold and money",kind="money"}; row.latest.values[999]=900; for _,m in pairs(row.months) do m.values[999]=100 end;'
   +'local from,to=MAMChronicles.UI:GetCurrentMonthRange(); __r=MAMChronicles.Export:BuildMonthlyRecap(from,to)');
  const r=h.get('__r');
  assert.match(r,/Moms Against Magic Chronicles/); assert.match(r,/recap/i);
  assert.match(r,/Deaths 1/); assert.match(r,/Quests 1/);
  assert.match(r,/Medals earned: \d+ \(\+\d+ Mom Money\)/); assert.match(r,/Fresh Start/);
  assert.match(r,/Quests completed \+10/); assert.match(r,/Total deaths \+3/);
  assert.ok(!/Gold looted/.test(r)); assert.ok(!/Mumtest/.test(r)); assert.ok(!/Draenor/.test(r));
});
test('the recap lists at most three top changes and five medals',()=>{
  const h=setup();
  h.run('for i=1,8 do MAMChronicles.EventStore:Append("medal.earned",{medalId="m"..i,medalName="Medal "..i,points=10}) end; local from,to=MAMChronicles.UI:GetCurrentMonthRange(); __r=MAMChronicles.Export:BuildMonthlyRecap(from,to)');
  const r=h.get('__r'); assert.match(r,/Medals earned: \d+/); assert.match(r,/and 3 more/); assert.ok((r.match(/Medal \d/g)||[]).length<=5);
});
test('a quiet month says so',()=>{
  const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); __r=MAMChronicles.Export:BuildMonthlyRecap(0,100)');
  assert.match(h.get('__r'),/Quiet month/);
});
test('/mam recap opens the recap text to copy',()=>{
  const h=setup(); h.slash('recap'); assert.match(h.get('MAMChronicles.UI.copyText'),/recap/i); assert.equal(h.get('MAMChronicles.UI.frame.shown'),true);
});
test('Home has a Copy recap button that opens the same text',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Show(); local d=MAMChronicles.Dashboard; d.recapButton.scripts.OnClick(d.recapButton)');
  assert.match(h.get('MAMChronicles.UI.copyText'),/recap/i);
});
