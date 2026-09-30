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
