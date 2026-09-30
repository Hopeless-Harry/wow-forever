import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil');return h;}
const on=(y,m,d)=>`MAMChronicles.Now=function() return time({year=${y},month=${m},day=${d},hour=12}) end`;
const titles='__q=((MAMChronicles.Toast.current or {}).title or ""); for _,t in ipairs(MAMChronicles.Toast.queue) do __q=__q.." | "..t.title end';

test('the active season follows the calendar, including Winter Veil across New Year',()=>{
  const h=setup();
  const at=(y,m,d)=>{h.run(on(y,m,d)+'; __s=MAMChronicles.Medals:ActiveSeason(); __k=__s and __s.key or ""'); return h.get('__k');};
  assert.equal(at(2026,10,1),'brewfest'); assert.equal(at(2026,10,25),'hallows'); assert.equal(at(2026,12,20),'winter'); assert.equal(at(2027,1,1),'winter');
  assert.equal(at(2027,2,10),'love'); assert.equal(at(2027,6,25),'midsummer'); assert.equal(at(2026,11,10),''); assert.equal(at(2026,12,10),'');
});
test('the season list has six events with dates and labels',()=>{
  const h=setup(); assert.equal(h.get('#MAMChronicles.Medals.seasons'),6);
  h.run('__ok=true; for _,s in ipairs(MAMChronicles.Medals.seasons) do if not (s.key and s.label and s.counters and s.fun) then __ok=false end end'); assert.equal(h.get('__ok'),true);
});
test('season counters only count the events listed, and only during the season',()=>{
  const h=setup();
  h.run(on(2026,10,1)+'; local C=MAMChronicles.Counters; C:Add("ale",3); C:Add("wine",2); C:Add("coffee",4); __n=MAMChroniclesDB.counters[MAMChronicles.characterKey].season_brewfest');
  assert.equal(h.get('__n'),5);
  h.run(on(2026,11,10)+'; MAMChronicles.Counters:Add("ale",9); __m=MAMChroniclesDB.counters[MAMChronicles.characterKey].season_brewfest'); assert.equal(h.get('__m'),5);
});
test('a seasonal medal is earned from seasonal activity',()=>{
  const h=setup(); h.run(on(2026,10,1)+'; MAMChronicles.Counters:Add("ale",5); MAMChronicles.Medals:Evaluate("t"); local row=MAMChroniclesDB.medals[MAMChronicles.characterKey]; __e=row.earned["season_brewfest_fun_1"]~=nil');
  assert.equal(h.get('__e'),true);
});
test('logging in on different days during a season counts towards the regular medal',()=>{
  const h=setup();
  h.run(on(2026,10,1)+'; local M=MAMChronicles.Medals; local c=M:EnsureCounts(); for _,d in ipairs({1,2,3}) do M:CountLogin(c,time({year=2026,month=10,day=d,hour=10})) end; M:CountLogin(c,time({year=2026,month=10,day=3,hour=20})); __n=c.season_brewfest_daysCount');
  assert.equal(h.get('__n'),3);
  h.run('local M=MAMChronicles.Medals; local c=M:EnsureCounts(); M:CountLogin(c,time({year=2026,month=11,day=10,hour=10})); __m=c.season_brewfest_daysCount'); assert.equal(h.get('__m'),3);
});
test('progress for the season medals is reported',()=>{
  const h=setup(); h.run(on(2026,10,1)+'; MAMChronicles.Counters:Add("ale",2); for _,m in ipairs(MAMChronicles.Medals:GetProgress()) do if m.def.id=="season_brewfest_fun_1" then __cur=m.current; __tgt=m.target end end');
  assert.equal(h.get('__cur'),2); assert.equal(h.get('__tgt'),5);
});
test('the start of a season is announced once per year',()=>{
  const h=setup(); h.run(on(2026,10,1)+'; MAMChronicles.Medals:AnnounceSeason(); '+titles); assert.match(h.get('__q'),/Brewfest/);
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChronicles.Medals:AnnounceSeason(); '+titles); assert.equal(h.get('__q'),'');
  h.run(on(2027,9,25)+'; MAMChronicles.Medals:AnnounceSeason(); '+titles); assert.match(h.get('__q'),/Brewfest/);
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; '+on(2026,11,10)+'; MAMChronicles.Medals:AnnounceSeason(); '+titles); assert.equal(h.get('__q'),'');
});
test('seasonal families have unique titles and live in the Holidays category',()=>{
  const h=setup(); h.run('__fam=0; __bad=""; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do if d.family:find("^season_") then __fam=__fam+1; if d.category~="seasonal" then __bad=__bad..d.id.." " end; if not MAMChronicles.Medals.titles[d.family] then __bad=__bad.."title:"..d.family.." " end end end');
  assert.equal(h.get('__bad'),''); assert.equal(h.get('__fam'),36); assert.equal(h.get('MAMChronicles.Medals.categoriesByKey.seasonal.label'),'Holidays');
});
test('season state in settings is validated and bounded',()=>{
  const h=createHarness({savedVariables:{schemaVersion:1,settings:{seasonsSeen:{'brewfest2026':true,'bad':'x',5:true}}}}); h.load(files); h.run('MAMChronicles:Boot()');
  assert.equal(h.get('MAMChroniclesDB.settings.seasonsSeen.brewfest2026'),true); assert.equal(h.get('MAMChroniclesDB.settings.seasonsSeen.bad'),null);
});
