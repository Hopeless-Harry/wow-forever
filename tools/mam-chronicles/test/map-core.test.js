import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const NOW=1790704800;
function setup(pre='',saved){
  const h=createHarness({savedVariables:saved}); h.load(files.slice(0,1));
  h.run(`__sent={}; __guild=true; __inst=false; __pos={0.512,0.3}; __map=2022; __t=${NOW}
function IsInGuild() return __guild end
function IsInInstance() return __inst,"none" end
function UnitLevel() return 90 end
function UnitClass() return "Priest","PRIEST",5 end
C_ChatInfo={RegisterAddonMessagePrefix=function() return true end,SendAddonMessage=function(prefix,text,channel) table.insert(__sent,{prefix,text,channel}) return 0 end}
C_Map={GetBestMapForUnit=function() return __map end,GetPlayerMapPosition=function() if not __pos then return nil end return {GetXY=function() return __pos[1],__pos[2] end} end,GetMapInfo=function(id) return {name="Zone "..id} end}
${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __t end'); return h;
}
const recv=(text,sender='Alice-Draenor',channel='GUILD')=>`MAMChronicles.Comms:OnAddonMessage("MAMCHR","${text}","${channel}","${sender}")`;
const share='MAMChroniclesDB.settings.shareLocation=true';

test('sharing is on by default and the settings are validated',()=>{
  const h=setup(); assert.equal(h.get('MAMChroniclesDB.settings.shareLocation'),true); assert.equal(h.get('MAMChroniclesDB.settings.showGuildMap'),true); assert.equal(h.get('#MAMChroniclesDB.settings.pinnedPlayers'),0);
  const g=setup('',{schemaVersion:1,settings:{shareLocation:'yes',showGuildMap:5,pinnedPlayers:['Alice','Alice',3,'Bob','C','D','E','F']}});
  assert.equal(g.get('MAMChroniclesDB.settings.shareLocation'),true); assert.equal(g.get('MAMChroniclesDB.settings.showGuildMap'),true); assert.equal(g.get('#MAMChroniclesDB.settings.pinnedPlayers'),5); assert.equal(g.get('MAMChroniclesDB.settings.pinnedPlayers[2]'),'Bob');
});
test('the location message is small and carries only map, position, level, class and version',()=>{
  const h=setup(); h.run('__m=MAMChronicles.Map:BuildMessage()'); assert.equal(h.get('__m'),'L1|2022|512|300|90|5|1'); assert.ok(h.get('#__m')<=64);
});
test('no message is built without a map position',()=>{
  const h=setup('__pos=nil'); h.run('__m=MAMChronicles.Map:BuildMessage()'); assert.equal(h.get('__m'),null);
});
test('sending needs the setting, a guild and the open world',()=>{
  let h=setup(); h.run('MAMChroniclesDB.settings.shareLocation=false; __r=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'sharing is off'); assert.equal(h.get('#__sent'),0);
  h=setup(); h.run(share+'; __guild=false; __r=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'not in guild');
  h=setup(); h.run(share+'; __inst=true; __r=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'in an instance');
  h=setup(); h.run(share+'; __pos=nil; __r=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'no position');
});
test('a location is sent to the guild channel with the addon prefix',()=>{
  const h=setup(); h.run(share+'; __r=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'sent'); assert.equal(h.get('__sent[1][1]'),'MAMCHR'); assert.equal(h.get('__sent[1][2]'),'L1|2022|512|300|90|5|1'); assert.equal(h.get('__sent[1][3]'),'GUILD'); assert.equal(h.get('MAMChronicles.Map.status.sent'),1);
});
test('locations are rate limited and an unchanged position is resent only occasionally',()=>{
  const h=setup(); h.run(share+'; MAMChronicles.Map:Send(true); __r1=MAMChronicles.Map:Send(); __t=__t+25; __r2=MAMChronicles.Map:Send(); __pos={0.6,0.3}; __t=__t+25; __r3=MAMChronicles.Map:Send(); __t=__t+70; __r4=MAMChronicles.Map:Send()');
  assert.equal(h.get('__r1'),'too soon'); assert.equal(h.get('__r2'),'unchanged'); assert.equal(h.get('__r3'),'sent'); assert.equal(h.get('__r4'),'sent'); assert.equal(h.get('#__sent'),3);
});
test('a restricted realm stops location sending quietly',()=>{
  const h=setup('C_ChatInfo.SendAddonMessage=function() error("restricted") end'); h.run(share+'; __r=MAMChronicles.Map:Send(true); __r2=MAMChronicles.Map:Send(true)'); assert.equal(h.get('__r'),'restricted'); assert.equal(h.get('__r2'),'restricted'); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('a guildmate location is stored, shown in the list and never saved to disk',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1')+'; __l=MAMChronicles.Map:GetList()');
  assert.equal(h.get('#__l'),1); assert.equal(h.get('__l[1].name'),'Alice'); assert.equal(h.get('__l[1].mapID'),1); assert.equal(h.get('__l[1].zone'),'Zone 1'); assert.equal(h.get('__l[1].level'),42); assert.ok(Math.abs(h.get('__l[1].x')-0.25)<1e-6); assert.ok(Math.abs(h.get('__l[1].y')-0.75)<1e-6);
  h.run('__json=""; local function walk(t,seen) seen=seen or {} if seen[t] then return end seen[t]=true for k,v in pairs(t) do __json=__json..tostring(k) if type(v)=="table" then walk(v,seen) else __json=__json..tostring(v) end end end walk(MAMChroniclesDB)'); assert.ok(!/Alice/.test(h.get('__json')));
  assert.equal(h.get('MAMChronicles.Comms.status.dropped'),0);
});
test('own, malformed, wrong-channel and other-version location messages are ignored',()=>{
  const h=setup();
  for (const [text,ch,who] of [['L1|1|250|750|42|8|1','GUILD','Mumtest-Draenor'],['L1|0|250|750|42|8|1','GUILD','Bob-Draenor'],['L1|1|2500|750|42|8|1','GUILD','Bob-Draenor'],['L1|1|250|750|420|8|1','GUILD','Bob-Draenor'],['L1|x|250|750|42|8|1','GUILD','Bob-Draenor'],['L1|1|250|750|42|8','GUILD','Bob-Draenor'],['L1|1|250|750|42|8|1','SAY','Bob-Draenor'],['L1|1|250|750|42|8|9','GUILD','Bob-Draenor']]) h.run(recv(text,who,ch));
  assert.equal(h.get('#MAMChronicles.Map:GetList()'),0);
});
test('a flooding sender is limited to one update every few seconds',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1')+'; __t=__t+2; '+recv('L1|1|300|750|42|8|1')+'; __a=MAMChronicles.Map:GetList()[1].x; __t=__t+10; '+recv('L1|1|400|750|42|8|1')+'; __b=MAMChronicles.Map:GetList()[1].x');
  assert.ok(Math.abs(h.get('__a')-0.25)<1e-6); assert.ok(Math.abs(h.get('__b')-0.4)<1e-6);
});
test('old locations turn stale and then disappear',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1')+'; __t=__t+130; __s=MAMChronicles.Map:GetList()[1].stale; __t=__t+200; __n=#MAMChronicles.Map:GetList()');
  assert.equal(h.get('__s'),true); assert.equal(h.get('__n'),0);
});
test('the member table is bounded',()=>{
  const h=setup(); h.run('for i=1,260 do MAMChronicles.Map:OnMessage("P"..i.."-Realm","L1|1|250|750|42|8|1") end; __n=0; for _ in pairs(MAMChronicles.Map.members) do __n=__n+1 end'); assert.ok(h.get('__n')<=200);
});
test('the guild map can be switched off on the receiving side',()=>{
  const h=setup('',{schemaVersion:1,settings:{showGuildMap:false}}); h.run(recv('L1|1|250|750|42|8|1')); assert.equal(h.get('#MAMChronicles.Map:GetList()'),0);
});
test('players can be pinned up to five and the pins survive as names only',()=>{
  const h=setup(); h.run('local M=MAMChronicles.Map; for _,n in ipairs({"A","B","C","D","E","F"}) do M:SetPinned(n,true) end; __n=#MAMChroniclesDB.settings.pinnedPlayers; __is=M:IsPinned("A"); M:SetPinned("A",false); __was=M:IsPinned("A"); __bad=M:SetPinned("x|y",true)');
  assert.equal(h.get('__n'),5); assert.equal(h.get('__is'),true); assert.equal(h.get('__was'),false); assert.equal(h.get('__bad'),false);
});
test('the roster list puts pinned players first and carries class and age',()=>{
  const h=setup(); h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; __t=__t+10; '+recv('L1|2|250|750|50|5|1','Zed-Draenor')+'; MAMChronicles.Map:SetPinned("Zed",true); __l=MAMChronicles.Map:GetList()');
  assert.equal(h.get('__l[1].name'),'Zed'); assert.equal(h.get('__l[1].pinned'),true); assert.ok(h.get('__l[2].age')>=10);
});
test('going to a guildmate sets a map waypoint and opens the world map there',()=>{
  const h=setup(`__calls={}; UiMapPoint={CreateFromCoordinates=function(m,x,y) return {m=m,x=x,y=y} end}
C_Map.SetUserWaypoint=function(p) __calls.wp=p end
C_SuperTrack={SetSuperTrackedUserWaypoint=function(v) __calls.track=v end}
function OpenWorldMap(id) __calls.open=id end`);
  h.run(recv('L1|1|250|750|42|8|1')+'; __ok=MAMChronicles.Map:GoTo("Alice")'); assert.equal(h.get('__ok'),true);
  assert.equal(h.get('__calls.wp.m'),1); assert.ok(Math.abs(h.get('__calls.wp.x')-0.25)<1e-6); assert.equal(h.get('__calls.track'),true); assert.equal(h.get('__calls.open'),1);
});
test('going to a guildmate falls back to the world map frame and reports unknown names',()=>{
  const h=setup(`__calls={}; WorldMapFrame={SetMapID=function(_,id) __calls.set=id end,Show=function() __calls.shown=true end,GetCanvas=function() return nil end}`);
  h.run(recv('L1|3|250|750|42|8|1')+'; __ok=MAMChronicles.Map:GoTo("Alice"); __no=MAMChronicles.Map:GoTo("Nobody")'); assert.equal(h.get('__ok'),true); assert.equal(h.get('__calls.set'),3); assert.equal(h.get('__no'),false);
});
test('map pins are placed on the world map canvas for players on the shown map',()=>{
  const h=setup(`__canvas=CreateFrame("Frame"); __canvas:SetSize(1000,500)
WorldMapFrame={GetMapID=function() return 1 end,GetCanvas=function() return __canvas end,SetMapID=function() end,Show=function() end}`);
  h.run(recv('L1|1|250|750|42|8|1','Alice-Draenor')+'; '+recv('L1|2|500|500|42|8|1','Bob-Draenor')+'; MAMChronicles.Map:ShowPins(); __n=0; for _,p in ipairs(MAMChronicles.Map.pins) do if p.shown then __n=__n+1 end end; __p=MAMChronicles.Map.pins[1].point');
  assert.equal(h.get('__n'),1); assert.equal(h.get('__p[1]'),'TOPLEFT'); assert.ok(Math.abs(h.get('__p[4]')-250)<1e-6); assert.ok(Math.abs(h.get('__p[5]')+375)<1e-6);
});
test('pins are not created during combat and a missing world map frame is harmless',()=>{
  const h=setup('function InCombatLockdown() return true end'); h.run(recv('L1|1|250|750|42|8|1')+'; MAMChronicles.Map:ShowPins()'); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
  const g=setup(); g.run(recv('L1|1|250|750|42|8|1')+'; MAMChronicles.Map:ShowPins()'); assert.equal(g.get('MAMChronicles.errorStats.count'),0);
});
test('the sending loop only runs while sharing is on',()=>{
  const h=setup('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}'); h.run('MAMChroniclesDB.settings.shareLocation=false; MAMChronicles.Map.loopRunning=false; __timers={}; MAMChronicles.Map:Start(); __n0=#__timers'); assert.equal(h.get('__n0'),0);
  h.run(share+'; __timers={}; MAMChronicles.Map.loopRunning=false; MAMChronicles.Map:Start(); __n1=#__timers; table.remove(__timers,1)(); __n2=#__timers; MAMChroniclesDB.settings.shareLocation=false; table.remove(__timers,1)(); __n3=#__timers'); assert.equal(h.get('__n1'),1); assert.ok(h.get('__sent')!==null); assert.equal(h.get('__n2'),1); assert.equal(h.get('__n3'),0);
});
test('diagnostics report location sharing without positions',()=>{
  const h=setup(); h.run(share+'; MAMChronicles.Map:Send(true); '+recv('L1|1|250|750|42|8|1')+'; __d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.match(h.get('__d'),/Location sharing: on, sent 1, received 1/); assert.ok(!/512|Alice/.test(h.get('__d').split('Location sharing')[1].split('\n')[0]));
});
