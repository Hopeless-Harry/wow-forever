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
