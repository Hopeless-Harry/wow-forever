import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness, multi } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const LAUNCH=1793750400, WEEK=604800;
const forever={GetBuildInfo:()=>multi('1.60.1','70124','Sep 2026',16001)};
function setup(globals){const h=createHarness({globals});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
const atWeek=(n)=>`MAMChronicles.Now=function() return ${LAUNCH+(n-1)*WEEK+3600} end`;
const ids=(h,expr)=>{h.run(`__i=""; for _,q in ipairs(${expr}) do __i=__i..q.id.."," end`);return h.get('__i');};

test('the week number counts from the Forever launch and never drops below one',()=>{
  const h=setup(); assert.equal(h.get('MAMChronicles.Medals:GetWeek()'),1);
  h.run(atWeek(1)); assert.equal(h.get('MAMChronicles.Medals:GetWeek()'),1); h.run(atWeek(2)); assert.equal(h.get('MAMChronicles.Medals:GetWeek()'),2); h.run(atWeek(10)); assert.equal(h.get('MAMChronicles.Medals:GetWeek()'),10);
});
test('difficulty bands ramp up with the weeks and stop at six',()=>{
  const h=setup(); h.run('__b={}; for w=1,14 do __b[w]=MAMChronicles.Medals:GetBand(w) end');
  assert.equal(h.get('__b[1]'),1); assert.equal(h.get('__b[2]'),1); assert.equal(h.get('__b[3]'),2); assert.equal(h.get('__b[12]'),6); assert.equal(h.get('__b[14]'),6);
  h.run('__mono=true; for w=2,14 do if __b[w]<__b[w-1] then __mono=false end end'); assert.equal(h.get('__mono'),true);
});
test('every week has three quests and they are the same every time for the same week',()=>{
  const h=setup(forever); h.run(atWeek(3)); const a=ids(h,'MAMChronicles.Medals:GetWeeklyQuests()'); const b=ids(h,'MAMChronicles.Medals:GetWeeklyQuests()');
  assert.equal(h.get('#MAMChronicles.Medals:GetWeeklyQuests()'),3); assert.equal(a,b);
  h.run(atWeek(4)); assert.notEqual(ids(h,'MAMChronicles.Medals:GetWeeklyQuests()'),a);
});
test('week one is gentle: small targets, no dungeons, low level goal',()=>{
  const h=setup(forever); h.run(atWeek(1)+'; __q=MAMChronicles.Medals:GetWeeklyQuests()');
  h.run('__max=0; __bad=""; for _,q in ipairs(__q) do if q.kind=="level" and q.target>10 then __bad=__bad.."level " end if q.metric=="instance.entered" then __bad=__bad.."dungeon " end if q.metric=="loot.notable" then __bad=__bad.."loot " end end');
  assert.equal(h.get('__bad'),''); assert.ok(h.get('__q[1].target')<=10);
});
test('quests get harder in later weeks',()=>{
  const h=setup(forever);
  // same template at a low and high band must have a bigger target at the high band
  h.run('__t=MAMChronicles.Medals:GetQuestTemplates(); __ok=true; for _,t in ipairs(__t) do if t.targets and t.targets[6]<t.targets[1] then __ok=false end if t.targets then for i=2,6 do if t.targets[i]<t.targets[i-1] then __ok=false end end end end');
  assert.equal(h.get('__ok'),true);
  h.run(atWeek(12)+'; __lvl=MAMChronicles.Medals:GetLevelTarget(12); __early=MAMChronicles.Medals:GetLevelTarget(1)'); assert.ok(h.get('__lvl')>h.get('__early')); assert.ok(h.get('__lvl')<=60); assert.ok(h.get('__early')<=10);
});
test('no quest at any week asks for more than the Forever cap of level',()=>{
  const h=setup(forever); h.run('__hi=0; for w=1,30 do local n=MAMChronicles.Medals:GetLevelTarget(w); if n>__hi then __hi=n end end'); assert.equal(h.get('__hi'),60);
});
test('Forever-only quests do not appear on Retail',()=>{
  const h=setup(); h.run('__bad=0; for w=1,30 do for _,q in ipairs(MAMChronicles.Medals:GetWeeklyQuests(w)) do if q.forever then __bad=__bad+1 end end end'); assert.equal(h.get('__bad'),0);
});
test('quest progress is measured from the start of the week and finishing one pays Mom Money once',()=>{
  const h=setup(forever); h.run(atWeek(2)+'; MAMChronicles.Counters:Add("food",100); MAMChronicles.Medals:Evaluate("t"); __q=MAMChronicles.Medals:GetWeeklyQuests(); __before=MAMChronicles.Medals:GetEarnedMoney()');
  // find a counter quest in the week and push it over the target
  h.run('__target=nil; for _,q in ipairs(__q) do if q.counter then __target=q end end');
  assert.ok(h.get('__target'),'week 2 has a counter quest');
  h.run('local q=__target; MAMChronicles.Counters:Add(q.counter,q.target); MAMChronicles.Medals:Evaluate("t"); __after=MAMChronicles.Medals:GetEarnedMoney(); __done=false; for _,x in ipairs(MAMChronicles.Medals:GetWeeklyQuests()) do if x.id==q.id then __done=x.done end end');
  assert.equal(h.get('__done'),true); assert.ok(h.get('__after')>h.get('__before'));
  h.run('MAMChronicles.Counters:Add(__target.counter,5); MAMChronicles.Medals:Evaluate("t"); __again=MAMChronicles.Medals:GetEarnedMoney()'); assert.equal(h.get('__again'),h.get('__after'));
});
test('a quest completion shows a toast',()=>{
  const h=setup(forever); h.run(atWeek(2)+'; MAMChronicles.Medals:GetWeeklyQuests(); __target=nil; for _,q in ipairs(MAMChronicles.Medals:GetWeeklyQuests()) do if q.counter then __target=q end end; MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChronicles.Counters:Add(__target.counter,__target.target); MAMChronicles.Medals:Evaluate("t"); __all=((MAMChronicles.Toast.current or {}).title or ""); for _,t in ipairs(MAMChronicles.Toast.queue) do __all=__all.." | "..t.title end');
  assert.match(h.get('__all'),/Mom Quest done/);
});
test('finishing all three adds a bonus and a new week starts fresh',()=>{
  const h=setup(forever);
  h.run(atWeek(2)+'; local M=MAMChronicles.Medals; __qs=M:GetWeeklyQuests(); __n=0; for _,q in ipairs(__qs) do if q.counter then MAMChronicles.Counters:Add(q.counter,q.target); __n=__n+1 end end; M:Evaluate("t")');
  h.run(atWeek(3)+'; MAMChronicles.Medals:Evaluate("t"); __done=0; for _,q in ipairs(MAMChronicles.Medals:GetWeeklyQuests()) do if q.done then __done=__done+1 end end'); assert.equal(h.get('__done'),0);
});
test('Mom Money available includes quest rewards and stays consistent with spending',()=>{
  const h=setup(forever); h.run(atWeek(2)+'; local M=MAMChronicles.Medals; for _,q in ipairs(M:GetWeeklyQuests()) do if q.counter then MAMChronicles.Counters:Add(q.counter,q.target) end end M:Evaluate("t"); __earned=M:GetEarnedMoney(); __avail=M:GetMomMoney(); __total=M:GetSummary().total; __bonus=MAMChroniclesDB.medals[MAMChronicles.characterKey].bonus or 0');
  assert.equal(h.get('__earned'),h.get('__total')+h.get('__bonus')); assert.equal(h.get('__avail'),h.get('__earned'));
});
test('Home lists this weeks quests and /mam quests prints them',()=>{
  const h=setup(forever); h.run(atWeek(2)+'; MAMChronicles.UI:Show()');
  const body=h.get('MAMChronicles.Dashboard.monthBody.text'); assert.match(body,/Week 2 Mom Quests/); assert.match(body,/\d+ \/ \d+/);
  h.calls.printed.length=0; h.slash('quests'); const all=h.calls.printed.join('\n'); assert.match(all,/Week 2/); assert.match(all,/\d+ \/ \d+/);
});
test('weekly quest state is cleared with the Chronicle and bounded',()=>{
  const h=setup(forever); h.run(atWeek(2)+'; MAMChronicles.Medals:GetWeeklyQuests(); MAMChronicles.Database:ClearHistory(); __c=MAMChroniclesDB.challenges[MAMChronicles.characterKey]'); assert.equal(h.get('__c'),null);
  assert.equal(h.get('type(MAMChroniclesDB.challenges)'),'table');
});
test('help lists the quests command',()=>{ const h=setup(); h.slash('help'); assert.ok(h.calls.printed.join('\n').includes('/mam quests')); });
