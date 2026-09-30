import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(saved,pre='__last=nil; __count=0; SOUNDKIT={IG_QUEST_LIST_COMPLETE=111,ACHIEVEMENT_MENU_OPEN=222,RAID_WARNING=333}; function PlaySound(id) __last=id __count=__count+1 end'){
  const h=createHarness({savedVariables:saved}); h.load(['Core.lua']); h.run(pre); h.load(files.slice(1)); h.run('MAMChronicles:Boot()'); return h;}
const show='MAMChronicles.Toast:Show({title="T",text="x",kind="info"})';
test('several toast sounds are offered, each with a unique key and label',()=>{
  const h=setup(); assert.ok(h.get('#MAMChronicles.Toast.sounds')>=7);
  h.run('__seen={}; __ok=true; for _,s in ipairs(MAMChronicles.Toast.sounds) do if __seen[s.key] or type(s.label)~="string" or type(s.id)~="number" or type(s.kit)~="string" then __ok=false end __seen[s.key]=true end');
  assert.equal(h.get('__ok'),true); assert.equal(h.get('MAMChronicles.Toast.sounds[1].key'),'chime');
});
test('the choice defaults to chime and junk is repaired',()=>{
  assert.equal(setup().get('MAMChroniclesDB.settings.toastSoundChoice'),'chime');
  assert.equal(setup({schemaVersion:1,settings:{toastSoundChoice:'nonsense'}}).get('MAMChroniclesDB.settings.toastSoundChoice'),'chime');
  assert.equal(setup({schemaVersion:1,settings:{toastSoundChoice:5}}).get('MAMChroniclesDB.settings.toastSoundChoice'),'chime');
  assert.equal(setup({schemaVersion:1,settings:{toastSoundChoice:'quest'}}).get('MAMChroniclesDB.settings.toastSoundChoice'),'quest');
});
test('a toast plays the chosen sound when sounds are on',()=>{
  const h=setup({schemaVersion:1,settings:{toastSound:true,toastSoundChoice:'quest'}}); h.run(show); assert.equal(h.get('__last'),111);
});
test('no sound plays when sounds are off',()=>{
  const h=setup({schemaVersion:1,settings:{toastSound:false,toastSoundChoice:'quest'}}); h.run(show); assert.equal(h.get('__count'),0);
});
test('a sound kit missing on this client falls back to its numeric id',()=>{
  const h=setup({schemaVersion:1,settings:{toastSound:true,toastSoundChoice:'ready'}}); h.run(show);
  assert.equal(h.get('__last'),h.get('(function() for _,s in ipairs(MAMChronicles.Toast.sounds) do if s.key=="ready" then return s.id end end end)()'));
});
test('the choice setting accepts only known sounds',()=>{
  const h=setup(); h.run('__a=MAMChronicles.UI:SetSetting("toastSoundChoice","raid"); __b=MAMChronicles.UI:SetSetting("toastSoundChoice","bogus")');
  assert.equal(h.get('__a'),true); assert.equal(h.get('__b'),false); assert.equal(h.get('MAMChroniclesDB.settings.toastSoundChoice'),'raid');
});
test('the settings button cycles the sound and plays a preview even when toast sounds are off',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); local b=UI.soundButton; __first=b.text; b.scripts.OnClick(b); __second=b.text; __choice=MAMChroniclesDB.settings.toastSoundChoice');
  assert.match(h.get('__first'),/^Toast sound: /); assert.notEqual(h.get('__first'),h.get('__second')); assert.notEqual(h.get('__choice'),'chime'); assert.equal(h.get('__count'),1);
});
test('cycling wraps around to the first sound',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); local b=UI.soundButton; for i=1,#MAMChronicles.Toast.sounds do b.scripts.OnClick(b) end');
  assert.equal(h.get('MAMChroniclesDB.settings.toastSoundChoice'),'chime');
});
test('previewing never errors when PlaySound does not exist',()=>{
  const h=setup(undefined,'PlaySound=nil'); h.run('MAMChronicles.Toast:PreviewSound("quest"); '+show); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
