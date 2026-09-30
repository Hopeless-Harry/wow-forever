import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(saved){const h=createHarness({savedVariables:saved});h.load(files);h.run('MAMChronicles:Boot(); MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}; MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil');return h;}
const spec='{title="T",text="x",kind="info"}';
const inside=(kind)=>`function IsInInstance() return true,"${kind}" end`;
const outside='function IsInInstance() return false,"none" end';
test('toasts are held in dungeons, raids, scenarios and battlegrounds',()=>{
  for (const kind of ['party','raid','scenario','pvp','arena']) {
    const h=setup(); h.run(inside(kind)+`; __r=MAMChronicles.Toast:Show(${spec})`);
    assert.equal(h.get('__r'),'queued',kind); assert.equal(h.get('MAMChronicles.Toast.current'),null);
  }
});
test('toasts show normally outside instances and in the open world',()=>{
  let h=setup(); h.run(outside+`; __r=MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('__r'),'shown');
  h=setup(); h.run(`__r=MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('__r'),'shown');
  h=setup(); h.run(inside('none')+`; __r=MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('__r'),'shown');
});
test('held toasts appear after leaving the instance',()=>{
  const h=setup(); h.run(inside('party')+`; MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('#MAMChronicles.Toast.queue'),1);
  h.run(outside); h.fire('PLAYER_ENTERING_WORLD'); assert.equal(h.get('MAMChronicles.Toast.current.title'),'T'); assert.equal(h.get('#MAMChronicles.Toast.queue'),0);
});
test('staying inside keeps them held when the world loads again',()=>{
  const h=setup(); h.run(inside('raid')+`; MAMChronicles.Toast:Show(${spec})`); h.fire('PLAYER_ENTERING_WORLD'); assert.equal(h.get('MAMChronicles.Toast.current'),null); assert.ok(h.get('#MAMChronicles.Toast.queue')>=1);
});
test('the next queued toast also waits inside an instance',()=>{
  const h=setup(); h.run(outside+`; MAMChronicles.Toast:Show(${spec}); MAMChronicles.Toast:Show({title="Second",text="y",kind="info"}); `+inside('party')+'; MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60)');
  assert.equal(h.get('MAMChronicles.Toast.current'),null); assert.equal(h.get('#MAMChronicles.Toast.queue'),1);
});
test('the setting can switch quiet mode off',()=>{
  const h=setup({schemaVersion:1,settings:{quietInstances:false}}); h.run(inside('party')+`; __r=MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('__r'),'shown');
});
test('quiet mode is on by default and junk values are repaired',()=>{
  assert.equal(setup().get('MAMChroniclesDB.settings.quietInstances'),true);
  assert.equal(setup({schemaVersion:1,settings:{quietInstances:'no'}}).get('MAMChroniclesDB.settings.quietInstances'),true);
});
test('the Alerts page has a checkbox for it and it saves',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __has=UI.settingChecks.quietInstances~=nil; __ok=UI:SetSetting("quietInstances",false); __v=MAMChroniclesDB.settings.quietInstances');
  assert.equal(h.get('__has'),true); assert.equal(h.get('__ok'),true); assert.equal(h.get('__v'),false);
});
test('a missing IsInInstance API never breaks toasts',()=>{
  const h=setup(); h.run(`IsInInstance=nil; __r=MAMChronicles.Toast:Show(${spec})`); assert.equal(h.get('__r'),'shown'); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
