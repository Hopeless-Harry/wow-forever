import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(theme){const h=createHarness(theme?{savedVariables:{schemaVersion:1,settings:{theme,themeMigrated:true}}}:{});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}');return h;}

test('Modern medal rows show a tier badge and an art progress bar instead of the flat stripe',()=>{
  const h=setup(); h.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI:SetMedalFilter("All"); local row=UI.medalRows[1]; __badge=row.badge.texture; __coord=row.badge.coord; __tier=row.entry.def.tier; __bar=row.bar.texture; __track=row.barTrack.texture; __stripe=row.stripe.shown');
  assert.match(h.get('__badge'),/Art\\Badge$/); assert.match(h.get('__bar'),/Art\\Bar$/); assert.match(h.get('__track'),/Art\\Bar$/); assert.ok(!h.get('__stripe'));
  const index={bronze:0,silver:1,gold:2,platinum:3}[h.get('__tier')]; assert.ok(Math.abs(h.get('__coord[1]')-index*0.25)<1e-6); assert.ok(Math.abs(h.get('__coord[2]')-(index+1)*0.25)<1e-6);
});
test('flat themes keep the stripe and have no badge',()=>{
  const h=setup('midnight'); h.run('MAMChronicles.AchievementStats:Scan(); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); local row=UI.medalRows[1]; __badge=row.badge; __stripe=row.stripe~=nil'); assert.equal(h.get('__badge'),null); assert.equal(h.get('__stripe'),true);
});
test('medal tooltips and hover still work with the art rows',()=>{
  const h=setup(); h.run('MAMChronicles.AchievementStats:Scan(); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); local row=UI.medalRows[1]; row.scripts.OnEnter(row); __hover=row.__hoverWash.shown; row.scripts.OnLeave(row); __off=row.__hoverWash.shown');
  assert.equal(h.get('__hover'),true); assert.equal(h.get('__off'),false);
});
test('Modern toasts use the toast frame art and a tinted glow behind the icon',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Toast; T:Show({title="m",text="b",kind="medal",points=10}); __sheet=T.frame.__slices.sheet; __glow=T.stripe.texture; __col=T.stripe.color');
  assert.equal(h.get('__sheet'),'Toast'); assert.match(h.get('__glow'),/Art\\Glow$/); assert.ok(h.get('__col[1]')>0.9);
});
test('the minimap attention glow uses the glow art in Modern',()=>{
  const h=setup(); h.run('MAMChronicles.Toast:Show({title="m",text="b",kind="medal",points=10}); __g=MAMChronicles.Launcher.glow.texture'); assert.match(h.get('__g'),/Art\\Glow$/);
});
test('Settings headings get an ornate divider in Modern only',()=>{
  const count='local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __n=0; for _,c in ipairs(UI.settingControls) do if c.texture and tostring(c.texture):find("Divider") then __n=__n+1 end end';
  const h=setup(); h.run(count); assert.ok(h.get('__n')>=5);
  const f=setup('midnight'); f.run(count); assert.equal(f.get('__n'),0);
});
