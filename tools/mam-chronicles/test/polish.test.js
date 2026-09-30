import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua'];
function boot(globals){const h=createHarness({globals});h.load(files);h.run('MAMChronicles:Boot()');return h;}

test('Guard records a short sanitised failure count without personal data',()=>{
  const h=boot();
  h.run('MAMChronicles:Guard("Counters",function() error("C:/Users/Harry/Account#1234 boom") end); MAMChronicles:Guard("Comms",function() error("second") end); MAMChronicles:Guard("Ok",function() return 1 end)');
  assert.equal(h.get('MAMChronicles.errorStats.count'),2);
  assert.match(h.get('MAMChronicles.errorStats.last'),/^Comms/);
  h.run('__d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.match(h.get('__d'),/Handler errors: 2, last: Comms/);
  h.run('MAMChronicles:Guard("Counters",function() error("C:/Users/Harry/Account#1234 boom") end); __d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.ok(!h.get('__d').includes('Harry')); assert.ok(!h.get('__d').includes('#1234'));
});
test('Guard bounds the stored message length',()=>{
  const h=boot(); h.run('MAMChronicles:Guard("X",function() error(string.rep("a",500)) end)');
  assert.ok(h.get('#MAMChronicles.errorStats.last')<=80);
});
test('collector handler failures count towards handler errors',()=>{
  const h=boot(); h.run('MAMChronicles.EventStore.Append=function() error("x") end; MAMChronicles:HandleEvent("PLAYER_LEVEL_UP",20)');
  assert.equal(h.get('MAMChronicles.errorStats.count'),1);
});
test('diagnostics list client, level cap and SavedVariables counts',()=>{
  const h=boot(); h.load(['Medals.lua']);
  h.run('MAMChroniclesDB.guildFeed={{},{}}; __d=MAMChronicles.Export:BuildDiagnosticReport()');
  const d=h.get('__d');
  assert.match(d,/Handler errors: 0/);
  assert.match(d,/Level cap: \d+/);
  assert.match(d,/SavedVariables: events \d+, medals \d+, feed 2/);
});

const uiFiles=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua'];
function uiSetup(){const h=createHarness();h.load(uiFiles);h.run('MAMChronicles:Boot()');return h;}

test('Diagnostics tab shows a copy button and a paste-back note only on that tab',()=>{
  const h=uiSetup();
  h.run('MAMChronicles.UI:Create(); MAMChronicles.UI.activeTab="Diagnostics"; MAMChronicles.UI:Show()');
  assert.equal(h.get('MAMChronicles.UI.copyDiagButton.shown'),true);
  assert.match(h.get('MAMChronicles.UI.diagNote.text'),/Copy diagnostics.*Ctrl\+C.*paste/is);
  h.run('MAMChronicles.UI.activeTab="Settings"; MAMChronicles.UI:Refresh()');
  assert.equal(h.get('MAMChronicles.UI.copyDiagButton.shown'),false);
});
test('Copy diagnostics button selects the report text and explains Ctrl+C',()=>{
  const h=uiSetup();
  h.run('MAMChronicles.UI:Create(); MAMChronicles.UI.activeTab="Diagnostics"; MAMChronicles.UI:Show(); local box=MAMChronicles.UI.copyBox; box.HighlightText=function(s) s.allSelected=true end; box.SetFocus=function(s) s.focused=true end; MAMChronicles.UI.copyDiagButton.scripts.OnClick(MAMChronicles.UI.copyDiagButton)');
  assert.equal(h.get('MAMChronicles.UI.copyBox.allSelected'),true);
  assert.equal(h.get('MAMChronicles.UI.copyBox.focused'),true);
  assert.match(h.get('MAMChronicles.UI.lastMessage'),/Ctrl\+C/);
});
test('/mam diag also shows the copy button',()=>{
  const h=uiSetup(); h.slash('diag');
  assert.equal(h.get('MAMChronicles.UI.copyDiagButton.shown'),true);
});

// ---- first-run experience ----
const dashFiles=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function dashSetup(saved){const h=createHarness({savedVariables:saved});h.load(dashFiles);h.run('MAMChronicles:Boot()');return h;}

test('getting started flag defaults to show and is normalised',()=>{
  let h=dashSetup(); assert.equal(h.get('MAMChroniclesDB.settings.gettingStartedDismissed'),false);
  h=dashSetup({schemaVersion:1,settings:{gettingStartedDismissed:'yes'}}); assert.equal(h.get('MAMChroniclesDB.settings.gettingStartedDismissed'),false);
  h=dashSetup({schemaVersion:1,settings:{gettingStartedDismissed:true}}); assert.equal(h.get('MAMChroniclesDB.settings.gettingStartedDismissed'),true);
});
test('whats new appears once after an update and is remembered when dismissed',()=>{
  let h=dashSetup(); assert.equal(h.get('MAMChronicles:GetWhatsNew()'),null);
  const old={schemaVersion:1,meta:{addonVersion:'0.2.0-alpha8'},settings:{}};
  h=dashSetup(old); assert.match(h.get('MAMChronicles:GetWhatsNew()'),/What's new in 0\.2\.0/);
  h.run('__a=MAMChronicles:GetWhatsNew(); MAMChronicles:DismissWhatsNew()'); assert.equal(h.get('MAMChronicles:GetWhatsNew()'),null);
  // simulate /reload with the saved table: still dismissed
  h.run('MAMChronicles.booted=false; MAMChronicles:Boot()'); assert.equal(h.get('MAMChronicles:GetWhatsNew()'),null);
});
test('whats new survives a reload until dismissed',()=>{
  const h=dashSetup({schemaVersion:1,meta:{addonVersion:'0.2.0-alpha8'},settings:{}});
  h.run('MAMChronicles.booted=false; MAMChronicles:Boot()'); assert.ok(h.get('MAMChronicles:GetWhatsNew()'));
});
test('chat welcome is short and points at /mam',()=>{
  const h=createHarness(); h.load(dashFiles); h.run('MAMChronicles:Boot()');
  const msg=h.calls.printed.find(m=>/Welcome/.test(m)); assert.ok(msg); assert.match(msg,/\/mam/); assert.ok(msg.length<140,`welcome too long: ${msg.length}`);
});
test('Home shows a dismissible Getting started card and remembers dismissal',()=>{
  const h=dashSetup(); h.run('local UI=MAMChronicles.UI; UI:Show(); __m=MAMChronicles.Dashboard:Build()');
  assert.equal(h.get('__m.gettingStarted'),true);
  assert.equal(h.get('MAMChronicles.Dashboard.startCard.shown'),true);
  assert.match(h.get('MAMChronicles.Dashboard.startBody.text'),/\/mam/); assert.match(h.get('MAMChronicles.Dashboard.startBody.text'),/Medals/); assert.match(h.get('MAMChronicles.Dashboard.startBody.text'),/guild/i); assert.match(h.get('MAMChronicles.Dashboard.startBody.text'),/Settings/);
  h.run('local D=MAMChronicles.Dashboard; D.startDismiss.scripts.OnClick(D.startDismiss)');
  assert.equal(h.get('MAMChroniclesDB.settings.gettingStartedDismissed'),true);
  assert.equal(h.get('MAMChronicles.Dashboard.startCard.shown'),false);
});
test('Home shows a whats new line after an update',()=>{
  const h=dashSetup({schemaVersion:1,meta:{addonVersion:'0.2.0-alpha8'},settings:{gettingStartedDismissed:true}});
  h.run('MAMChronicles.UI:Show()');
  assert.equal(h.get('MAMChronicles.Dashboard.newsLine.shown'),true);
  assert.match(h.get('MAMChronicles.Dashboard.newsLine.text'),/What's new/);
  h.run('local D=MAMChronicles.Dashboard; D.newsDismiss.scripts.OnClick(D.newsDismiss)');
  assert.equal(h.get('MAMChronicles.Dashboard.newsLine.shown'),false);
});

// ---- Medals tab usability ----
function medalsSetup(){
  const h=dashSetup(); h.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("test")');
  h.run('MAMChronicles.EventStore:Append("memory.manual",{text="hi"},{occurredAt=1790704801}); MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals")');
  return h;
}
test('medal filters split the list into earned, in progress and locked',()=>{
  const h=medalsSetup();
  h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("All"); __all=#UI.medalList; UI:SetMedalFilter("Earned"); __e=#UI.medalList; __eok=true; for _,m in ipairs(UI.medalList) do if not m.earned then __eok=false end end; UI:SetMedalFilter("In progress"); __p=#UI.medalList; __pok=true; for _,m in ipairs(UI.medalList) do if m.earned or m.current<=0 then __pok=false end end; UI:SetMedalFilter("Locked"); __l=#UI.medalList; __lok=true; for _,m in ipairs(UI.medalList) do if m.earned or m.current>0 then __lok=false end end');
  assert.equal(h.get('__eok'),true); assert.equal(h.get('__pok'),true); assert.equal(h.get('__lok'),true);
  assert.ok(h.get('__e')>=1); assert.equal(h.get('__e')+h.get('__p')+h.get('__l'),h.get('__all'));
  h.run('__bad=MAMChronicles.UI:SetMedalFilter("Nonsense")'); assert.equal(h.get('__bad'),false); assert.equal(h.get('MAMChronicles.UI.medalFilter'),'Locked');
});
test('medal filter buttons show which filter is active',()=>{
  const h=medalsSetup(); h.run('MAMChronicles.UI:SetMedalFilter("Earned")');
  assert.equal(h.get('#MAMChronicles.UI.medalFilterButtons'),5);
  assert.equal(h.get('MAMChronicles.UI.medalFilterButtons[2].highlighted'),true);
  assert.equal(h.get('MAMChronicles.UI.medalFilterButtons[1].highlighted'),false);
});
test('medal search matches name or description ignoring case',()=>{
  const h=medalsSetup(); h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("All"); UI:SetMedalSearch("WINE"); __n=#UI.medalList; __ok=true; for _,m in ipairs(UI.medalList) do local t=(m.def.name.." "..m.def.description):lower(); if not t:find("wine",1,true) then __ok=false end end');
  assert.ok(h.get('__n')>=4); assert.equal(h.get('__ok'),true);
  h.run('MAMChronicles.UI:SetMedalSearch("zzzz-no-such"); __none=#MAMChronicles.UI.medalList'); assert.equal(h.get('__none'),0);
  assert.equal(h.get('MAMChronicles.UI.medalEmpty.shown'),true);
  h.run('MAMChronicles.UI:SetMedalSearch("")'); assert.equal(h.get('MAMChronicles.UI.medalEmpty.shown'),false);
});
test('medal rows are created lazily for the visible part only',()=>{
  const h=createHarness(); h.load(dashFiles); h.run('MAMChronicles:Boot(); local n=0; local orig=CreateFrame; function CreateFrame(...) n=n+1; return orig(...) end; __before=n; MAMChronicles.UI:Show(); __afterShow=n; MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:SetMedalFilter("All"); __afterMedals=n');
  assert.ok(h.get('#MAMChronicles.UI.medalRows')>0); assert.ok(h.get('#MAMChronicles.UI.medalRows')<40);
  assert.ok(h.get('#MAMChronicles.UI.medalList')>150);
});
test('scrolling the medal list rebinds the pooled rows',()=>{
  const h=medalsSetup();
  h.run('local UI=MAMChronicles.UI; __rowsBefore=#UI.medalRows; UI.medalsArea:SetOffset(3000); __first=UI.medalFirst; __name=UI.medalRows[1].name.text; __expect=UI.medalList[UI.medalFirst].def.name; __rowsAfter=#UI.medalRows');
  assert.ok(h.get('__first')>10); assert.equal(h.get('__name'),h.get('__expect')); assert.ok(h.get('__rowsAfter')<40);
});
test('medals earned this session carry a New marker',()=>{
  const h=medalsSetup();
  h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("Earned"); __new=UI.medalList[1].isNew; __tag=UI.medalRows[1].newTag.shown');
  assert.equal(h.get('__new'),true); assert.equal(h.get('__tag'),true);
  h.run('MAMChronicles.Medals:Reset(); MAMChronicles.UI:Refresh()'); assert.equal(h.get('next(MAMChronicles.Medals.newIds)'),null);
});
test('baseline medals are not marked New',()=>{
  const h=dashSetup(); h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:SetMedalFilter("Earned"); __n=0; for _,m in ipairs(MAMChronicles.UI.medalList) do if m.isNew then __n=__n+1 end end');
  assert.equal(h.get('__n'),0);
});
test('medal rows show a tooltip with how it is tracked and progress',()=>{
  const h=medalsSetup();
  h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("Locked"); UI:SetMedalSearch("wine"); local row=UI.medalRows[1]; row.scripts.OnEnter(row); __lines=table.concat(GameTooltip.lines," | ")');
  const t=h.get('__lines'); assert.match(t,/Wine O'Clock/); assert.match(t,/Tracked:/); assert.match(t,/Progress: 0 \/ 1/); assert.match(t,/number is kept|Only a number/i);
});
test('every medal has a tracking description',()=>{
  const h=dashSetup(); h.run('__miss=0; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do if type(d.tracking)~="string" or #d.tracking<10 then __miss=__miss+1 end end');
  assert.equal(h.get('__miss'),0);
});
test('summary counts and Mom Money match the listed medals even with stale saved entries',()=>{
  const h=medalsSetup();
  h.run('MAMChroniclesDB.medals[MAMChronicles.characterKey].earned["removed_medal"]={at=1,points=100}; local s=MAMChronicles.Medals:GetSummary(); local list=MAMChronicles.Medals:GetProgress(); local c,p=0,0; for _,m in ipairs(list) do if m.earned then c=c+1; p=p+m.earned.points end end; __s=s; __c=c; __p=p; __n=#list');
  assert.equal(h.get('__s.count'),h.get('__c')); assert.equal(h.get('__s.total'),h.get('__p')); assert.equal(h.get('__s.possible'),h.get('__n'));
});

// ---- Forever-first wording and empty states ----
import { multi } from './harness.js';
function foreverSetup(){const h=createHarness({globals:{GetBuildInfo:()=>multi('1.60.1','70124','Sep 2026',16001)}});h.load(dashFiles);h.run('MAMChronicles:Boot()');return h;}
test('Home tiles have no Retail-only Delves tile on Forever but keep it on Retail',()=>{
  let h=foreverSetup(); h.run('__m=MAMChronicles.Dashboard:Build(); __labels=""; for _,t in ipairs(__m.tiles) do __labels=__labels..t.label.."|" end');
  assert.ok(!/Delves/.test(h.get('__labels'))); assert.match(h.get('__labels'),/Campfires lit/); assert.equal(h.get('#__m.tiles'),6);
  h=dashSetup(); h.run('__m=MAMChronicles.Dashboard:Build(); __labels=""; for _,t in ipairs(__m.tiles) do __labels=__labels..t.label.."|" end');
  assert.match(h.get('__labels'),/Delves/); assert.ok(!/Campfires/.test(h.get('__labels'))); assert.equal(h.get('#__m.tiles'),6);
});
test('the Campfires lit tile reads the campfire counter',()=>{
  const h=foreverSetup(); h.run('MAMChronicles.Counters:Add("campfires",3); __m=MAMChronicles.Dashboard:Build(); __v=nil; for _,t in ipairs(__m.tiles) do if t.label=="Campfires lit" then __v=t.value end end');
  assert.equal(h.get('__v'),'3');
});
test('Home no longer claims guild sharing is unavailable',()=>{
  const h=dashSetup(); h.run('MAMChronicles.UI:Show()');
  const body=h.get('MAMChronicles.Dashboard.monthBody.text'); assert.match(body,/Guild sharing: /); assert.ok(!/not available yet/.test(body));
});
test('statistics empty states explain what still works',()=>{
  const h=dashSetup(); h.run('MAMChronicles.AchievementStats:Scan(); __t=MAMChronicles.AchievementStats:BuildText(MAMChronicles.characterKey)');
  assert.match(h.get('__t'),/does not expose statistics/); assert.match(h.get('__t'),/other medals|still work/i);
  h.run('MAMChronicles.UI:Show(); __body=MAMChronicles.Dashboard.monthBody.text'); assert.match(h.get('__body'),/Statistics: not reported by this client/);
});
test('Forever shows level 60 as the cap in the medal header wording and no Retail-only medals',()=>{
  const h=foreverSetup(); h.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); __bad=0; for _,m in ipairs(MAMChronicles.Medals:GetProgress()) do if m.def.client=="retail" or (m.def.minCap and m.def.minCap>60) then __bad=__bad+1 end end');
  assert.equal(h.get('__bad'),0); assert.equal(h.get('MAMChronicles.Medals:LevelCap()'),60);
});

// ---- robustness ----
const statApi=`
__cats={[2]={"Deaths",-1},[3]={"Quests",-1},[5]={"Dungeons & Raids",-1},[6]={"Social",-1}}
__stats={[2]={{101,"Total deaths"},{102,"Falls"}},[3]={{201,"Quests completed"}},[5]={{501,"Total 5-player dungeons entered"}},[6]={{601,"Total waves"}}}
__vals={[101]="12",[102]="3",[201]="1,234",[501]="30",[601]="5"}
function GetStatisticsCategoryList() return {2,3,5,6} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end`;
function statHarness(timerCode=''){const h=createHarness();h.load(['Core.lua']);h.run(statApi+"\n"+timerCode);h.load(dashFiles.slice(1));h.run('MAMChronicles:Boot()');return h;}

test('the statistics scan is split across frames when it is slow and timers exist',()=>{
  const h=statHarness('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}; __clock=0; function debugprofilestop() __clock=__clock+10 return __clock end');
  h.run('MAMChronicles.AchievementStats:Scan(); __first=MAMChronicles.AchievementStats.status.state; __queued=#__timers');
  assert.equal(h.get('__first'),'pending'); assert.ok(h.get('__queued')>=1);
  h.run('__n=0; while #__timers>0 and __n<100 do __n=__n+1; table.remove(__timers,1)() end');
  assert.equal(h.get('MAMChronicles.AchievementStats.status.state'),'ok'); assert.equal(h.get('MAMChronicles.AchievementStats.status.statCount'),5);
  assert.ok(h.get('__n')>1); assert.ok(h.get('MAMChronicles.AchievementStats.status.scanMs')>0);
});
test('the statistics scan stays synchronous and identical without timers',()=>{
  const h=statHarness(); h.run('MAMChronicles.AchievementStats:Scan()');
  assert.equal(h.get('MAMChronicles.AchievementStats.status.state'),'ok'); assert.equal(h.get('MAMChronicles.AchievementStats.status.statCount'),5);
});
test('a fast statistics scan finishes in one go even when timers exist',()=>{
  const h=statHarness('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}; function debugprofilestop() return 0 end');
  h.run('MAMChronicles.AchievementStats:Scan()'); assert.equal(h.get('MAMChronicles.AchievementStats.status.state'),'ok');
});
test('diagnostics report how long the statistics scan took',()=>{
  const h=statHarness('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}; __clock=0; function debugprofilestop() __clock=__clock+10 return __clock end');
  h.run('MAMChronicles.AchievementStats:Scan(); while #__timers>0 do table.remove(__timers,1)() end; __d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.match(h.get('__d'),/Statistics: ok, 5 read, 0 unreadable, scan \d+ ms/);
});
test('the session list is bounded',()=>{
  const h=dashSetup(); h.run('for i=1,650 do MAMChronicles.Database.currentSession=nil; MAMChronicles.Database:BeginSession() end');
  assert.ok(h.get('#MAMChroniclesDB.sessions')<=500);
});
test('the short-term duplicate filter does not grow without bound',()=>{
  const h=dashSetup(); h.run('for i=1,1500 do MAMChronicles.EventStore:Append("quest.completed",{questID=i},{occurredAt=1790704800+i}) end; local n=0; for _ in pairs(MAMChronicles.EventStore.recentSemantic) do n=n+1 end; __n=n');
  assert.ok(h.get('__n')<=400,`recentSemantic size ${h.get('__n')}`);
});
test('counters ignore junk amounts and stop at a sane ceiling',()=>{
  const h=dashSetup(); h.run('local C=MAMChronicles.Counters; C:Add("jumps",-5); C:Add("jumps",0/0); C:Add("jumps","x"); C:Add("jumps",5e12); __v=MAMChroniclesDB.counters[MAMChronicles.characterKey].jumps');
  assert.ok(h.get('__v')<=1e9); assert.ok(h.get('__v')>=1);
});
test('optional APIs may all be missing without a single handler error',()=>{
  const h=createHarness(); h.load(dashFiles);
  h.run('Settings=nil; C_Timer=nil; C_Spell=nil; hooksecurefunc=nil; C_ChatInfo=nil; AddonCompartmentFrame=nil; StaticPopupDialogs=nil; GameTooltip=nil; InCombatLockdown=nil; MAMChronicles:Boot()');
  for (const e of ['PLAYER_LOGIN','PLAYER_ENTERING_WORLD','ZONE_CHANGED_NEW_AREA','PLAYER_LEVEL_UP','PLAYER_DEAD','PLAYER_ALIVE','QUEST_TURNED_IN','CHAT_MSG_LOOT','SKILL_LINES_CHANGED','PLAYER_REGEN_ENABLED','UNIT_SPELLCAST_SUCCEEDED','CHAT_MSG_ADDON','PLAYER_LOGOUT']) h.fire(e,20);
  h.run('local UI=MAMChronicles.UI; for _,t in ipairs(UI.tabs) do UI:SetActiveTab(t) end; for _,c in ipairs({"","stats","diag","export","toast","help","remember x","bogus"}) do SlashCmdList.MAMCHRONICLES(c) end; MAMChronicles.Toast:SendTest()');
  assert.equal(h.get('MAMChronicles.errorStats.count'),0,h.get('MAMChronicles.errorStats.last'));
});
test('a minimal old SavedVariables file boots cleanly and gains every new table',()=>{
  const h=dashSetup({schemaVersion:1}); h.run('MAMChronicles.UI:Show(); for _,t in ipairs(MAMChronicles.UI.tabs) do MAMChronicles.UI:SetActiveTab(t) end');
  assert.equal(h.get('type(MAMChroniclesDB.guildFeed)'),'table'); assert.equal(h.get('type(MAMChroniclesDB.medalTallies)'),'table'); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('a very large saved history boots, compacts on the next event and stays searchable',()=>{
  const events=[]; for(let i=1;i<=25000;i++)events.push({id:`c:quest.completed:${1700000000+i}:1`,schemaVersion:1,type:'quest.completed',occurredAt:1700000000+i,observedAt:1700000000+i,characterKey:'c',payload:{questID:i}});
  const h=dashSetup({schemaVersion:1,meta:{},settings:{},events});
  assert.equal(h.get('#MAMChroniclesDB.events'),25000);
  h.run('MAMChronicles.EventStore:Append("memory.manual",{text="after"},{occurredAt=1790704801}); __n=#MAMChroniclesDB.events; MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Chronicle"); __rows=#MAMChronicles.UI.rowPool');
  assert.ok(h.get('__n')<=10001); assert.equal(h.get('__rows'),30);
});

// ---- combat safety ----
function combatSetup(){const h=createHarness();h.load(dashFiles);h.run('MAMChronicles:Boot()');return h;}
const countFrames='__frames=0; local orig=CreateFrame; function CreateFrame(...) __frames=__frames+1; return orig(...) end';
test('AfterCombat runs work immediately out of combat and queues it in combat',()=>{
  const h=combatSetup(); h.run('__ran=0; MAMChronicles:AfterCombat(function() __ran=__ran+1 end)'); assert.equal(h.get('__ran'),1);
  h.run('function InCombatLockdown() return true end; MAMChronicles:AfterCombat(function() __ran=__ran+10 end)'); assert.equal(h.get('__ran'),1);
  h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED'); assert.equal(h.get('__ran'),11);
  h.fire('PLAYER_REGEN_ENABLED'); assert.equal(h.get('__ran'),11);
});
test('a failing after-combat job is counted and does not stop the others',()=>{
  const h=combatSetup(); h.run('function InCombatLockdown() return true end; __ok=0; MAMChronicles:AfterCombat(function() error("x") end); MAMChronicles:AfterCombat(function() __ok=1 end); function InCombatLockdown() return false end');
  h.fire('PLAYER_REGEN_ENABLED'); assert.equal(h.get('__ok'),1); assert.equal(h.get('MAMChronicles.errorStats.count'),1);
});
test('opening the window in combat creates no frames until combat ends',()=>{
  const h=combatSetup(); h.run(countFrames+'; function InCombatLockdown() return true end; SlashCmdList.MAMCHRONICLES("")');
  assert.equal(h.get('__frames'),0); assert.equal(h.get('MAMChronicles.UI.frame'),null);
  assert.ok(h.calls.printed.some(m=>/combat/i.test(m)));
  h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED');
  assert.equal(h.get('MAMChronicles.UI.frame.shown'),true);
});
test('/mam diag in combat waits and then opens the diagnostics',()=>{
  const h=combatSetup(); h.run('function InCombatLockdown() return true end; SlashCmdList.MAMCHRONICLES("diag")'); assert.equal(h.get('MAMChronicles.UI.frame'),null);
  h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED');
  assert.match(h.get('MAMChronicles.UI.copyText'),/Diagnostics/); assert.equal(h.get('MAMChronicles.UI.frame.shown'),true);
});
test('the window can still be closed in combat',()=>{
  const h=combatSetup(); h.run('MAMChronicles.UI:Show(); function InCombatLockdown() return true end; MAMChronicles.UI:Toggle()');
  assert.equal(h.get('MAMChronicles.UI.frame.shown'),false);
});
test('the minimap button is not created during combat',()=>{
  const h=createHarness(); h.load(dashFiles); h.run('function InCombatLockdown() return true end; '+countFrames+'; MAMChronicles:Boot(); __during=__frames');
  const during=h.get('__during'); h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED');
  assert.ok(h.get('__frames')>during); assert.ok(h.get('MAMChronicles.Launcher.button'));
});
test('counters stop counting while recording is switched off',()=>{
  const h=combatSetup(); h.run('MAMChroniclesDB.settings.enabled=false'); h.fire('SCREENSHOT_SUCCEEDED');
  assert.equal(h.get('(MAMChroniclesDB.counters[MAMChronicles.characterKey] or {}).shots'),null);
  h.run('MAMChroniclesDB.settings.enabled=true'); h.fire('SCREENSHOT_SUCCEEDED');
  assert.equal(h.get('MAMChroniclesDB.counters[MAMChronicles.characterKey].shots'),1);
});
test('resizing the window in combat postpones the layout until combat ends',()=>{
  const h=combatSetup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:ApplyLayout(780,560); __w0=UI.textWidth; function InCombatLockdown() return true end; UI.frame.scripts.OnSizeChanged(UI.frame,900,600); __w1=UI.textWidth');
  assert.equal(h.get('__w1'),h.get('__w0'));
  h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED'); assert.equal(h.get('MAMChronicles.UI.textWidth'),850);
});

// ---- namespaced APIs ----
test('item lookups prefer C_Item and fall back to the old globals',()=>{
  let h=createHarness(); h.load(dashFiles);
  h.run('C_Item={GetItemInfo=function() __used="C_Item" return "Fancy Hat","|cffa335ee|Hitem:99:::::::|h[Fancy Hat]|h|r",4 end, GetItemInfoInstant=function() return 99 end}; MAMChronicles:Boot(); __ok=MAMChronicles.Collectors:ResolveItem(99,nil,1)');
  assert.equal(h.get('__ok'),true); assert.equal(h.get('__used'),'C_Item');
  h=createHarness(); h.load(dashFiles);
  h.run('function GetItemInfo() __used="global" return "Old Hat","l",4 end; MAMChronicles:Boot(); __ok=MAMChronicles.Collectors:ResolveItem(98,nil,1)');
  assert.equal(h.get('__ok'),true); assert.equal(h.get('__used'),'global');
});
test('item lookups degrade quietly when neither API exists',()=>{
  const h=createHarness(); h.load(dashFiles); h.run('MAMChronicles:Boot(); __ok=MAMChronicles.Collectors:ResolveItem(5,nil,1)'); assert.equal(h.get('__ok'),false);
});
test('the source no longer calls deprecated item globals directly',async()=>{
  const { readAddonFile } = await import('./harness.js');
  for (const f of ['Collectors.lua','Counters.lua']) { const t=readAddonFile(f); assert.ok(!/safe\(GetItemInfo[,)]/.test(t),`${f} calls GetItemInfo directly`); assert.ok(!/safe\(GetItemInfoInstant/.test(t),`${f} calls GetItemInfoInstant directly`); }
});

// ---- theme contrast (WCAG) ----
function lum(c){const f=v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);}
function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function palette(h,name){h.run(`MAMChronicles.Theme:ApplyPreset("${name}")`);return {c:h.get('MAMChronicles.Theme.colors'),k:h.get('MAMChronicles.Theme.kindColors'),t:h.get('MAMChronicles.Medals and MAMChronicles.Medals.tierColours or {}')};}
const arr=o=>[o['1'],o['2'],o['3']];
for (const name of ['midnight','parchment','crimson','slate']) {
  test(`theme ${name} meets contrast targets for text, accents and event colours`,()=>{
    const h=dashSetup(); const {c,k,t}=palette(h,name); const grounds=['bg','panel','raised'];
    const fails=[];
    const check=(label,fg,bg,min)=>{const r=ratio(arr(fg),arr(c[bg]));if(r<min)fails.push(`${label} on ${bg}: ${r.toFixed(2)} < ${min}`);};
    for(const g of grounds){check('text',c.text,g,7);check('muted',c.muted,g,4.5);check('gold',c.gold,g,4.5);check('danger',c.danger,g,3.5);check('accent',c.accent,g,3);}
    check('text on hover',c.text,'hover',4.5);
    check('disabled',c.disabled,'panel',2.2);
    for(const [kind,col] of Object.entries(k)) for(const g of ['bg','panel']) check(`kind ${kind}`,col,g,3.5);
    for(const [tier,col] of Object.entries(t)) check(`tier ${tier}`,col,'panel',3);
    assert.deepEqual(fails,[]);
  });
}

test('on Parchment every stock-font label gets a readable palette colour',()=>{
  const h=dashSetup({schemaVersion:1,settings:{theme:'parchment',gettingStartedDismissed:false}});
  h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); MAMChronicles.Toast:Show({title="Medal",text="x",kind="medal",points=10}); UI:SetActiveTab("Home")');
  const fields=['MAMChronicles.Dashboard.monthBody','MAMChronicles.Dashboard.recentRows[1]','MAMChronicles.Dashboard.startBody','MAMChronicles.Dashboard.subtitle','MAMChronicles.UI.content','MAMChronicles.UI.details','MAMChronicles.UI.pageLabel','MAMChronicles.UI.medalSub','MAMChronicles.UI.medalEmpty','MAMChronicles.UI.guildLines[1]','MAMChronicles.UI.medalRows[1].desc','MAMChronicles.UI.diagNote','MAMChronicles.UI.versionText','MAMChronicles.Toast.body'];
  const c=h.get('MAMChronicles.Theme.colors'); const fails=[];
  for(const f of fields){const col=h.get(`${f}.textColor`); if(!col){fails.push(`${f}: no colour`);continue;} const r=ratio(arr(col),arr(c.panel)); if(r<4.5)fails.push(`${f}: ${r.toFixed(2)}`);}
  assert.deepEqual(fails,[]);
});

// ---- commands and polish ----
test('/mam help lists every command and unknown commands point to it',()=>{
  const h=combatSetup(); h.slash('help'); const all=h.calls.printed.join('\n');
  for (const cmd of ['/mam','remember','stats','medals','settings','export','diag','toast','help']) assert.ok(all.includes(cmd),`help misses ${cmd}`);
  h.calls.printed.length=0; h.slash('bogus'); assert.match(h.calls.printed.join('\n'),/Unknown command "bogus"/); assert.match(h.calls.printed.join('\n'),/\/mam help/);
});
test('/mam medals and /mam settings open their tabs',()=>{
  const h=combatSetup(); h.slash('medals'); assert.equal(h.get('MAMChronicles.UI.activeTab'),'Medals'); assert.equal(h.get('MAMChronicles.UI.frame.shown'),true);
  h.slash('settings'); assert.equal(h.get('MAMChronicles.UI.activeTab'),'Settings');
});
test('every slash verb in the handler is listed in the help text',async()=>{
  const { readAddonFile } = await import('./harness.js'); const src=readAddonFile('UI.lua');
  const verbs=[...src.matchAll(/verb=="(\w+)"/g)].map(m=>m[1]); assert.ok(verbs.length>=7);
  const h=combatSetup(); h.slash('help'); const all=h.calls.printed.join('\n'); for(const v of verbs) assert.ok(all.includes(v),`help misses ${v}`);
});
test('the saved window never starts larger than the screen',()=>{
  const h=createHarness({savedVariables:{schemaVersion:1,settings:{ui:{width:1500,height:1100}}}}); h.load(dashFiles);
  h.run('UIParent.GetWidth=function() return 1024 end; UIParent.GetHeight=function() return 600 end; MAMChronicles:Boot(); MAMChronicles.UI:Create()');
  assert.ok(h.get('MAMChronicles.UI.frame.width')<=1024); assert.ok(h.get('MAMChronicles.UI.frame.height')<=600); assert.ok(h.get('MAMChronicles.UI.frame.width')>=620); assert.ok(h.get('MAMChronicles.UI.frame.height')>=440);
});
test('the settings page keeps its scroll position across tab changes',()=>{
  const h=combatSetup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); UI:ApplyLayout(780,300); UI.settingsArea:SetOffset(120); UI:SetActiveTab("Home"); UI:SetActiveTab("Settings"); __off=UI.settingsArea.offset');
  assert.equal(h.get('__off'),120);
});
test('the medals page keeps its scroll position across tab changes',()=>{
  const h=medalsSetup(); h.run('local UI=MAMChronicles.UI; UI.medalsArea:SetOffset(800); UI:SetActiveTab("Home"); UI:SetActiveTab("Medals"); __off=UI.medalsArea.offset');
  assert.equal(h.get('__off'),800);
});
