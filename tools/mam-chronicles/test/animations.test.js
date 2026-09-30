import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(saved){const h=createHarness({savedVariables:saved});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}');return h;}
const T='MAMChronicles.Theme';

test('animations are on by default, can be switched off, and the setting is validated',()=>{
  assert.equal(setup().get('MAMChroniclesDB.settings.animations'),true);
  assert.equal(setup({schemaVersion:1,settings:{animations:'no'}}).get('MAMChroniclesDB.settings.animations'),true);
  const h=setup(); h.run('__ok=MAMChronicles.UI:SetSetting("animations",false)'); assert.equal(h.get('__ok'),true); assert.equal(h.get('MAMChroniclesDB.settings.animations'),false); assert.equal(h.get(`${T}:CanAnimate()`),false);
});
test('FadeIn builds one alpha group per frame and replays it',()=>{
  const h=setup(); h.run(`local f=CreateFrame("Frame"); __a=${T}:FadeIn(f,0.2); __b=${T}:FadeIn(f,0.2); __g=f.__fadeGroup; __plays=__g.plays; __n=#__g.anims; __kind=__g.anims[1].kind; __dur=__g.anims[1].duration; __fin=__g.toFinal`);
  assert.equal(h.get('__a'),true); assert.equal(h.get('__b'),true); assert.equal(h.get('__plays'),2); assert.equal(h.get('__n'),1); assert.equal(h.get('__kind'),'Alpha'); assert.equal(h.get('__dur'),0.2); assert.equal(h.get('__fin'),true);
});
test('nothing animates when animations are off',()=>{
  const h=setup({schemaVersion:1,settings:{animations:false}}); h.run(`local f=CreateFrame("Frame"); __a=${T}:FadeIn(f); __b=${T}:Pulse(f); __g=f.__fadeGroup`);
  assert.equal(h.get('__a'),false); assert.equal(h.get('__b'),false); assert.equal(h.get('__g'),null);
});
test('a client without animation groups is handled quietly',()=>{
  const h=setup(); h.run(`local plain={}; __a=${T}:FadeIn(plain); __b=${T}:Pulse(plain); __c=${T}:GrowBar(plain); __d=${T}:Pop(plain)`);
  for (const k of ['__a','__b','__c','__d']) assert.equal(h.get(k),false); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('Pulse loops back and forth and can be stopped',()=>{
  const h=setup(); h.run(`local f=CreateFrame("Frame"); ${T}:Pulse(f,0.4,1,0.8); __g=f.__pulseGroup; __loop=__g.looping; __playing=__g.playing; ${T}:StopPulse(f); __after=__g.playing`);
  assert.equal(h.get('__loop'),'BOUNCE'); assert.equal(h.get('__playing'),true); assert.equal(h.get('__after'),false);
});
test('GrowBar scales a bar out from its left edge',()=>{
  const h=setup(); h.run(`local t=CreateFrame("Frame"):CreateTexture(); __ok=${T}:GrowBar(t,0.4); local a=t.__growGroup.anims[1]; __kind=a.kind; __origin=a.origin; __from=a.scaleFromX`);
  assert.equal(h.get('__ok'),true); assert.equal(h.get('__kind'),'Scale'); assert.equal(h.get('__origin'),'LEFT'); assert.ok(h.get('__from')<0.1);
});
test('Pop makes a small scale bounce',()=>{
  const h=setup(); h.run(`local f=CreateFrame("Frame"); __ok=${T}:Pop(f); __n=#f.__popGroup.anims; __k=f.__popGroup.anims[1].kind`); assert.equal(h.get('__ok'),true); assert.ok(h.get('__n')>=1); assert.equal(h.get('__k'),'Scale');
});
test('the window fades in when it opens but not on every refresh',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); __p1=UI.frame.__fadeGroup.plays; UI:Refresh(); UI:Show(); __p2=UI.frame.__fadeGroup.plays; UI:Hide(); UI:Show(); __p3=UI.frame.__fadeGroup.plays');
  assert.equal(h.get('__p1'),1); assert.equal(h.get('__p2'),1); assert.equal(h.get('__p3'),2);
});
test('the page fades in when the tab changes',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); __m=UI.medalsArea.scroll.__fadeGroup.plays; UI:SetActiveTab("Settings"); __s=UI.settingsArea.scroll.__fadeGroup.plays; UI:SetActiveTab("Home"); __h=UI.dashboard.frame.__fadeGroup.plays; UI:SetActiveTab("Statistics"); __t=UI.textScroll.__fadeGroup.plays');
  for (const k of ['__m','__s','__h','__t']) assert.ok(h.get(k)>=1,k);
});
test('no animation runs for the window when animations are off',()=>{
  const h=setup({schemaVersion:1,settings:{animations:false}}); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); __g=UI.frame.__fadeGroup'); assert.equal(h.get('__g'),null); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('opening the Medals tab grows the progress bars',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); __n=0; for _,r in ipairs(UI.medalRows) do if r.bar.__growGroup and r.bar.__growGroup.plays>=1 then __n=__n+1 end end');
  assert.ok(h.get('__n')>=5);
});
test('toasts ease in and out: fast start, soft landing',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Toast; T:Show({title="a",text="b",kind="info"}); T:Advance(T.durations["in"]/2); __mid=T.frame.alpha; T:Advance(T.durations["in"]/2); T:Advance(T.durations.hold); T:Advance(T.durations.out/2); __out=T.frame.alpha');
  assert.ok(h.get('__mid')>0.6,`in-phase alpha ${h.get('__mid')}`); assert.ok(h.get('__out')<0.6);
});
test('medal toasts shimmer and pop the icon, plain toasts stay calm, finishing stops the shimmer',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Toast; T:Show({title="m",text="b",kind="medal",points=10}); __pulse=T.stripe.__pulseGroup and T.stripe.__pulseGroup.playing; __pop=T.icon.__popGroup and T.icon.__popGroup.plays; T:Finish(); __stopped=T.stripe.__pulseGroup.playing');
  assert.equal(h.get('__pulse'),true); assert.ok(h.get('__pop')>=1); assert.equal(h.get('__stopped'),false);
  const c=setup(); c.run('local T=MAMChronicles.Toast; T:Show({title="i",text="b",kind="info"}); __calm=T.stripe.__pulseGroup and T.stripe.__pulseGroup.playing'); assert.ok(!c.get('__calm'));
});
test('the minimap button pulses for a toast while the window is closed and calms down when it opens',()=>{
  const h=setup(); h.run('MAMChronicles.Toast:Show({title="m",text="b",kind="medal",points=10}); local L=MAMChronicles.Launcher; __on=L.glow.__pulseGroup.playing; __shown=L.glow.shown; MAMChronicles.UI:Show(); __off=L.glow.__pulseGroup.playing; __hidden=L.glow.shown');
  assert.equal(h.get('__on'),true); assert.equal(h.get('__shown'),true); assert.equal(h.get('__off'),false); assert.equal(h.get('__hidden'),false);
});
test('no attention pulse while the window is open or animations are off',()=>{
  let h=setup(); h.run('MAMChronicles.UI:Show(); MAMChronicles.Toast:Show({title="m",text="b",kind="medal",points=10}); __g=(MAMChronicles.Launcher.glow or {}).shown'); assert.ok(!h.get('__g'));
  h=setup({schemaVersion:1,settings:{animations:false}}); h.run('MAMChronicles.Toast:Show({title="m",text="b",kind="medal",points=10}); __g=MAMChronicles.Launcher.glow and MAMChronicles.Launcher.glow.shown'); assert.ok(!h.get('__g'));
});
test('the Appearance page has an animations checkbox',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __has=UI.settingChecks.animations~=nil'); assert.equal(h.get('__has'),true);
});
test('the window has a slim accent line along its top edge',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Create(); __l=MAMChronicles.UI.topAccent'); assert.ok(h.get('__l.color')); assert.ok(Math.abs(h.get('__l.color[1]')-h.get('MAMChronicles.Theme.colors.accent[1]'))<0.001);
});
test('medal rows light up under the mouse and return to normal',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); local row=UI.medalRows[1]; row.scripts.OnEnter(row); __on=row.backdropColor; row.scripts.OnLeave(row); __off=row.backdropColor');
  const hover=h.get('MAMChronicles.Theme.colors.hover'), panel=h.get('MAMChronicles.Theme.colors.panel');
  assert.ok(Math.abs(h.get('__on[1]')-hover['1'])<0.001); assert.ok(Math.abs(h.get('__off[1]')-panel['1'])<0.001);
});
