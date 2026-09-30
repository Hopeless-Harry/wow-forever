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
  assert.equal(h.get('#MAMChronicles.UI.medalFilterButtons'),4);
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
  const h=createHarness(); h.load(dashFiles); h.run('MAMChronicles:Boot(); local n=0; local orig=CreateFrame; function CreateFrame(...) n=n+1; return orig(...) end; __before=n; MAMChronicles.UI:Show(); __afterShow=n; MAMChronicles.UI:SetActiveTab("Medals"); __afterMedals=n');
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
