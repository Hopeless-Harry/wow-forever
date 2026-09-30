import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const NOW=1790704800;
function setup(theme,pre=''){
  const h=createHarness(theme?{savedVariables:{schemaVersion:1,settings:{theme,themeMigrated:true}}}:{}); h.load(files.slice(0,1));
  h.run(`__t=${NOW}; __sent={}; function IsInGuild() return true end; function IsInInstance() return false,"none" end; function UnitLevel() return 90 end; function UnitClass() return "Priest","PRIEST",5 end
C_ChatInfo={RegisterAddonMessagePrefix=function() return true end,SendAddonMessage=function(p,t,c) table.insert(__sent,t) return 0 end}
C_Map={GetBestMapForUnit=function() return 2022 end,GetPlayerMapPosition=function() return {GetXY=function() return 0.512,0.3 end} end,GetMapInfo=function(id) return {name="Zone "..id} end}
${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __t end; MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}'); return h;
}
const recv=(text,sender)=>`MAMChronicles.Map:OnMessage("${sender}","${text}")`;
const open='local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Map")';

test('Map is the sixth of eight tabs and all tabs still fit the narrowest window',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Create(); __n=#MAMChronicles.UI.tabs; __map=MAMChronicles.UI.tabs[6]; local right=0; for _,b in ipairs(MAMChronicles.UI.tabButtons) do local p=b.point; right=math.max(right,(p[4] or 0)+b.width) end __right=right');
  assert.equal(h.get('__n'),8); assert.equal(h.get('__map'),'Map'); assert.ok(h.get('__right')<=620,`tabs reach ${h.get('__right')}`);
});
test('the Map page shows only on its tab and is remembered',()=>{
  const h=setup(); h.run(open+'; __shown=UI.mapArea.frame.shown; __saved=MAMChroniclesDB.settings.ui.activeTab; UI:SetActiveTab("Home"); __after=UI.mapArea.frame.shown');
  assert.equal(h.get('__shown'),true); assert.equal(h.get('__saved'),'Map'); assert.equal(h.get('__after'),false);
});
test('with nobody sharing the page explains how to get started',()=>{
  const h=setup(); h.run(open+'; __e=UI.mapEmpty.shown; __t=UI.mapEmpty.text'); assert.equal(h.get('__e'),true); assert.match(h.get('__t'),/Share my location/);
});
test('guildmates appear in the right-hand roster with level, zone and age, pinned ones first',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; __t=__t+10; '+recv('L1|2|500|500|60|5|1','Zed-Draenor')+'; MAMChronicles.Map:SetPinned("Zed",true); '+open+'; __n=#UI.mapList; __r1=UI.mapRows[1].name.text; __z=UI.mapRows[1].zone.text; __r2=UI.mapRows[2].name.text; __e=UI.mapEmpty.shown');
  assert.equal(h.get('__n'),2); assert.match(h.get('__r1'),/Zed/); assert.match(h.get('__z'),/Zone 2/); assert.match(h.get('__r2'),/Alice/); assert.equal(h.get('__e'),false);
});
test('clicking a roster row takes you to that guildmate',()=>{
  const h=setup(undefined,'__went=nil'); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; MAMChronicles.Map.GoTo=function(_,name) __went=name return true end; '+open+'; local row=UI.mapRows[1]; row.scripts.OnMouseUp(row,"LeftButton")');
  assert.equal(h.get('__went'),'Alice');
});
test('the star on a roster row pins and unpins without opening the map',()=>{
  const h=setup(undefined,'__went=nil'); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; MAMChronicles.Map.GoTo=function(_,name) __went=name return true end; '+open+'; local star=UI.mapRows[1].star; star.scripts.OnClick(star); __p=MAMChronicles.Map:IsPinned("Alice"); star=UI.mapRows[1].star; star.scripts.OnClick(star); __q=MAMChronicles.Map:IsPinned("Alice")');
  assert.equal(h.get('__p'),true); assert.equal(h.get('__q'),false); assert.equal(h.get('__went'),null);
});
test('the left card shows your own position, where everyone is, and the sharing switches',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; '+recv('L1|1|300|700|42|8|1','Bob-Draenor')+'; '+recv('L1|2|300|700|42|8|1','Cy-Draenor')+'; '+open+'; __me=UI.mapMe.text; __where=UI.mapWhere.text; __count=UI.mapCount.text');
  assert.match(h.get('__me'),/Zone 2022/); assert.match(h.get('__me'),/51\.2/); assert.match(h.get('__where'),/Zone 1 \(2\)/); assert.match(h.get('__where'),/Zone 2 \(1\)/); assert.match(h.get('__count'),/3 guildmates/);
});
test('the sharing checkbox turns location sharing on and off',()=>{
  const h=setup(); h.run(open+'; local c=UI.mapShareCheck; c:SetChecked(true); c.scripts.OnClick(c); __on=MAMChroniclesDB.settings.shareLocation; c:SetChecked(false); c.scripts.OnClick(c); __off=MAMChroniclesDB.settings.shareLocation');
  assert.equal(h.get('__on'),true); assert.equal(h.get('__off'),false);
});
test('the show-on-map checkbox controls receiving',()=>{
  const h=setup(); h.run(open+'; local c=UI.mapShowCheck; c:SetChecked(false); c.scripts.OnClick(c); __v=MAMChroniclesDB.settings.showGuildMap'); assert.equal(h.get('__v'),false);
});
test('the Open world map button opens the game map',()=>{
  const h=setup(undefined,'__opened=nil; function OpenWorldMap(id) __opened=id end'); h.run(open+'; UI.mapOpenButton.scripts.OnClick(UI.mapOpenButton)'); assert.equal(h.get('__opened'),2022);
});
test('incoming locations refresh a visible page but are throttled',()=>{
  const h=setup(undefined,'__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}'); h.run(open+'; __r0=UI.mapRefreshes or 0; '+recv('L1|1|250|750|42|8|1','A-Draenor')+'; '+recv('L1|1|250|750|42|8|1','B-Draenor')+'; '+recv('L1|1|250|750|42|8|1','C-Draenor')+'; __r1=UI.mapRefreshes');
  assert.ok(h.get('__r1')-h.get('__r0')<=2); h.run('local n=#__timers; for i=1,n do __timers[i]() end; __n=#MAMChronicles.UI.mapList'); assert.equal(h.get('__n'),3);
});
test('nothing refreshes while another tab is showing',()=>{
  const h=setup(); h.run(open+'; UI:SetActiveTab("Home"); __before=UI.mapRefreshes; '+recv('L1|1|250|750|42|8|1','A-Draenor')+'; __after=UI.mapRefreshes'); assert.equal(h.get('__after'),h.get('__before'));
});
test('stale guildmates are marked',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; __t=__t+150; '+open+'; __a=UI.mapRows[1].age.text'); assert.match(h.get('__a'),/stale|2m/i);
});
test('the page builds with flat themes and never errors',()=>{
  const h=setup('midnight'); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; '+open); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
  const g=setup(); g.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; '+open+'; MAMChronicles.UI:ApplyLayout(620,440); MAMChronicles.UI:ApplyLayout(1000,700)'); assert.equal(g.get('MAMChronicles.errorStats.count'),0);
});
test('/mam map opens the Map tab and the help lists it',()=>{
  const h=setup(); h.slash('map'); assert.equal(h.get('MAMChronicles.UI.activeTab'),'Map'); h.slash('help'); assert.ok(h.calls.printed.join('\n').includes('/mam map'));
});
test('Settings has a Guild map section with the two sharing options',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __a=UI.settingChecks.shareLocation~=nil; __b=UI.settingChecks.showGuildMap~=nil; __ok=UI:SetSetting("shareLocation",true); __v=MAMChroniclesDB.settings.shareLocation');
  assert.equal(h.get('__a'),true); assert.equal(h.get('__b'),true); assert.equal(h.get('__ok'),true); assert.equal(h.get('__v'),true);
});
