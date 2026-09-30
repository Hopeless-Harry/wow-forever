import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs'; import { createHarness, addonPath } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const sheets={Frame:[256,256],Inset:[128,128],ButtonRed:[256,256],ButtonBrown:[256,256],Tab:[256,128],Bar:[256,64],Badge:[256,64],Glow:[128,128],Shadow:[128,128],Divider:[256,16],Checkbox:[128,64],Scroll:[64,64],Toast:[512,128]};
function setup(theme){const h=createHarness(theme?{savedVariables:{schemaVersion:1,settings:{theme,themeMigrated:true}}}:{});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}');return h;}

test('every texture sheet exists as an uncompressed 32-bit TGA with the expected power-of-two size',()=>{
  for (const [name,[w,h]] of Object.entries(sheets)) {
    const path=addonPath('Art',`${name}.tga`); assert.ok(existsSync(path),name); const d=readFileSync(path);
    assert.equal(d[2],2,`${name} type`); assert.equal(d.readUInt16LE(12),w,`${name} width`); assert.equal(d.readUInt16LE(14),h,`${name} height`); assert.equal(d[16],32,`${name} depth`);
    assert.equal(d.length,18+w*h*4,`${name} size`); assert.equal((w&(w-1))===0&&(h&(h-1))===0,true,`${name} power of two`);
    let opaque=0; for(let i=21;i<d.length;i+=4) if(d[i]>0) opaque++; assert.ok(opaque>w*h*0.02,`${name} is not empty`);
  }
});
test('the addon knows every sheet with matching sizes',()=>{
  const h=setup(); for (const [name,[w,ht]] of Object.entries(sheets)) { assert.equal(h.get(`MAMChronicles.Theme.sheets.${name}[1]`),w,name); assert.equal(h.get(`MAMChronicles.Theme.sheets.${name}[2]`),ht,name); }
});
test('Modern is the default theme and uses art; the old themes stay flat',()=>{
  assert.equal(setup().get('MAMChroniclesDB.settings.theme'),'modern'); assert.equal(setup().get('MAMChronicles.Theme.artTheme'),true);
  for (const t of ['midnight','parchment','crimson','slate']) assert.equal(setup(t).get('MAMChronicles.Theme.artTheme'),false,t);
});
test('an old Midnight setting moves to Modern once and a later choice of Midnight sticks',()=>{
  let h=createHarness({savedVariables:{schemaVersion:1,settings:{theme:'midnight'}}}); h.load(files); h.run('MAMChronicles:Boot()'); assert.equal(h.get('MAMChroniclesDB.settings.theme'),'modern'); assert.equal(h.get('MAMChroniclesDB.settings.themeMigrated'),true);
  h=createHarness({savedVariables:{schemaVersion:1,settings:{theme:'midnight',themeMigrated:true}}}); h.load(files); h.run('MAMChronicles:Boot()'); assert.equal(h.get('MAMChroniclesDB.settings.theme'),'midnight');
  h=createHarness({savedVariables:{schemaVersion:1,settings:{theme:'crimson'}}}); h.load(files); h.run('MAMChronicles:Boot()'); assert.equal(h.get('MAMChroniclesDB.settings.theme'),'crimson');
});
test('a nine-slice has four corners, four edges and a centre with the right texture coordinates',()=>{
  const h=setup(); h.run('local f=CreateFrame("Frame"); __g=MAMChronicles.Theme:NineSlice(f,"Frame",{0,0,256,256},18,"BACKGROUND",18,0); __n=#__g.parts; __tl=__g.parts[1].texture.coord; __br=__g.parts[4].texture.coord; __c=__g.parts[9].texture.coord; __path=__g.parts[1].texture.texture; __w=__g.parts[1].texture.width');
  assert.equal(h.get('__n'),9); assert.match(h.get('__path'),/Art\\Frame$/); assert.equal(h.get('__w'),18);
  assert.ok(Math.abs(h.get('__tl[2]')-18/256)<1e-6); assert.ok(Math.abs(h.get('__tl[4]')-18/256)<1e-6); assert.ok(Math.abs(h.get('__br[1]')-(256-18)/256)<1e-6); assert.ok(Math.abs(h.get('__c[1]')-18/256)<1e-6); assert.ok(Math.abs(h.get('__c[2]')-(238/256))<1e-6);
});
test('a nine-slice can switch to another rectangle of the sheet for button states',()=>{
  const h=setup(); h.run('local f=CreateFrame("Frame"); local g=MAMChronicles.Theme:NineSlice(f,"ButtonBrown",{0,0,256,64},14,"BACKGROUND",12); g:SetRect({0,64,256,64}); __tl=g.parts[1].texture.coord');
  assert.ok(Math.abs(h.get('__tl[3]')-64/256)<1e-6); assert.ok(Math.abs(h.get('__tl[4]')-78/256)<1e-6);
});
test('the Modern window is drawn from the shadow and frame art, without the flat fill',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Create(); __f=UI.frame.__slices.sheet; __s=UI.frame.__shadow.sheet; __fill=UI.bgFill; __acc=UI.topAccent');
  assert.equal(h.get('__f'),'Frame'); assert.equal(h.get('__s'),'Shadow'); assert.equal(h.get('__fill'),null); assert.equal(h.get('__acc'),null);
});
test('the window transparency setting fades the art',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Create(); UI:SetSetting("windowAlpha",0.6); __a=UI.frame.__slices.parts[1].texture.alpha'); assert.equal(h.get('__a'),0.6);
});
test('panels use the inset art and react to the mouse with a soft wash',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Theme; local p=CreateFrame("Frame"); T:Panel(p); __s=p.__slices.sheet; T:PanelHover(p,true); __on=p.__hoverWash.shown; T:PanelHover(p,false); __off=p.__hoverWash.shown');
  assert.equal(h.get('__s'),'Inset'); assert.equal(h.get('__on'),true); assert.equal(h.get('__off'),false);
});
test('buttons use the brown art, the red option uses the red art, and the state follows the mouse',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Theme; local b=T:Button(UIParent,"Go",100,24); local r=T:Button(UIParent,"Buy",100,24,{red=true}); __b=b.__slices.sheet; __r=r.__slices.sheet; b.scripts.OnEnter(b); __hover=b.__slices.parts[1].texture.coord[3]; b.scripts.OnMouseDown(b); __down=b.__slices.parts[1].texture.coord[3]; b.scripts.OnLeave(b); __rest=b.__slices.parts[1].texture.coord[3]; T:SetEnabled(b,false); b.scripts.OnLeave(b); __dis=b.__slices.parts[1].texture.coord[3]');
  assert.equal(h.get('__b'),'ButtonBrown'); assert.equal(h.get('__r'),'ButtonRed'); assert.ok(Math.abs(h.get('__hover')-0.25)<1e-6); assert.ok(Math.abs(h.get('__down')-0.5)<1e-6); assert.ok(Math.abs(h.get('__rest')-0)<1e-6); assert.ok(Math.abs(h.get('__dis')-0.75)<1e-6);
});
test('tabs swap between the normal and selected art',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Theme; local t=T:Tab(UIParent,"Home",84,28); __n=t.__slices.parts[1].texture.coord[3]; T:SetSelected(t,true); __s=t.__slices.parts[1].texture.coord[3]; __gold=t.label.textColor[1]; T:SetSelected(t,false); __back=t.__slices.parts[1].texture.coord[3]');
  assert.ok(Math.abs(h.get('__n')-0)<1e-6); assert.ok(Math.abs(h.get('__s')-0.5)<1e-6); assert.ok(Math.abs(h.get('__back')-0)<1e-6); assert.ok(h.get('__gold')>0.9);
});
test('checkboxes show the checked art when ticked',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Theme; local c=T:Check(UIParent,"Hello"); __u=c.__box.coord[1]; c:SetChecked(true); __c=c.__box.coord[1]; __cap=c.caption.text');
  assert.equal(h.get('__u'),0); assert.equal(h.get('__c'),0.5); assert.equal(h.get('__cap'),'Hello');
});
test('scrollbars use the art thumb',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Theme; local s=CreateFrame("Slider"); T:Scrollbar(s); __t=s:GetThumbTexture()'); assert.ok(h.get('__t')!==null);
});
test('the old flat themes still build flat widgets with no art',()=>{
  const h=setup('midnight'); h.run('local T=MAMChronicles.Theme; local p=CreateFrame("Frame"); T:Panel(p); local b=T:Button(UIParent,"x",50,20); __ps=p.__slices; __bs=b.__slices; MAMChronicles.UI:Create(); __fs=MAMChronicles.UI.frame.__slices');
  assert.equal(h.get('__ps'),null); assert.equal(h.get('__bs'),null); assert.equal(h.get('__fs'),null);
});
test('the whole interface builds and every tab opens with the Modern theme',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); for _,t in ipairs(UI.tabs) do UI:SetActiveTab(t) end');
  assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('the theme chooser lists Modern first',()=>{
  const h=setup(); assert.equal(h.get('MAMChronicles.Theme.presetOrder[1]'),'modern'); assert.equal(h.get('MAMChronicles.Theme.presetNames.modern'),'Modern');
});
