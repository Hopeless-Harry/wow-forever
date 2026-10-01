import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const NOW=1790704800;
function setup(theme,pre='',saved){
  const settings={...(theme?{theme,themeMigrated:true}:{}),...(saved||{})};
  const h=createHarness({savedVariables:Object.keys(settings).length?{schemaVersion:1,settings}:undefined}); h.load(files.slice(0,1));
  h.run(`__t=${NOW}; function IsInGuild() return true end; function UnitLevel() return 90 end; function UnitClass() return "Priest","PRIEST",5 end
C_Map={GetBestMapForUnit=function() return 2022 end,GetPlayerMapPosition=function() return {GetXY=function() return 0.5,0.3 end} end,GetMapInfo=function(id) return {name="Zone "..id} end}
${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Now=function() return __t end; MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}'); return h;
}
const text='__txt=""; for _,l in ipairs(MAMChronicles.Tracker:Build()) do __txt=__txt..l.kind..":"..l.text.."\\n" end';

test('the tracker settings have safe defaults',()=>{
  const h=setup(); assert.equal(h.get('MAMChroniclesDB.settings.trackerEnabled'),true); assert.equal(h.get('MAMChroniclesDB.settings.trackerQuests'),true);
  const g=setup(undefined,'',{trackerEnabled:'x',trackerQuests:5}); assert.equal(g.get('MAMChroniclesDB.settings.trackerEnabled'),true); assert.equal(g.get('MAMChroniclesDB.settings.trackerQuests'),true);
});
test('up to six medal goals can be pinned now',()=>{
  const h=setup(); h.run('local M=MAMChronicles.Medals; __ok=0; for _,id in ipairs({"wine_1","ale_1","coffee_1","food_1","cheese_1","cookie_1","pie_1"}) do if M:SetPinned(id,true) then __ok=__ok+1 end end; __n=#MAMChroniclesDB.settings.pinnedMedals');
  assert.equal(h.get('__ok'),6); assert.equal(h.get('__n'),6);
});
test('the tracker lists pinned goals, weekly quests and pinned guildmates',()=>{
  const h=setup(); h.run('MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Map:OnMessage("Alice-Draenor","L1|1|250|750|42|8|1"); MAMChronicles.Map:SetPinned("Alice",true); MAMChronicles.Map:SetPinned("Ghost",true); '+text);
  const t=h.get('__txt'); assert.match(t,/goal:Wine O'Clock I/); assert.match(t,/quest:.* \d+ \/ \d+/); assert.match(t,/player:Alice - Zone 1/); assert.match(t,/player:Ghost - not sharing/);
});
test('weekly quests can be hidden from the tracker',()=>{
  const h=setup(undefined,'',{trackerQuests:false}); h.run(text); assert.ok(!/quest:/.test(h.get('__txt')));
});
test('the tracker window shows when there is something to track and hides when switched off',()=>{
  const h=setup(); h.run('MAMChronicles.Tracker:Refresh(); __on=MAMChronicles.Tracker.frame.shown'); assert.equal(h.get('__on'),true);
  h.run('MAMChronicles.UI:SetSetting("trackerEnabled",false); __off=MAMChronicles.Tracker.frame.shown'); assert.equal(h.get('__off'),false);
  h.run('MAMChronicles.UI:SetSetting("trackerEnabled",true); __back=MAMChronicles.Tracker.frame.shown'); assert.equal(h.get('__back'),true);
});
test('with quests hidden and nothing pinned the tracker stays away',()=>{
  const h=setup(undefined,'',{trackerQuests:false}); h.run('MAMChronicles.Tracker:Refresh(); __f=MAMChronicles.Tracker.frame'); assert.ok(!h.get('__f') || h.get('MAMChronicles.Tracker.frame.shown')===false);
});
test('clicking a goal or quest opens the Medals tab and clicking a guildmate goes to them',()=>{
  const h=setup(undefined,'__went=nil'); h.run('MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Map:OnMessage("Alice-Draenor","L1|1|250|750|42|8|1"); MAMChronicles.Map:SetPinned("Alice",true); MAMChronicles.Map.GoTo=function(_,n) __went=n return true end; local T=MAMChronicles.Tracker; T:Refresh(); __first=T.rows[1].kind; T.rows[1].scripts.OnClick(T.rows[1]); __tab=MAMChronicles.UI.activeTab; for _,r in ipairs(T.rows) do if r.kind=="player" and r:IsShown() then r.scripts.OnClick(r) end end');
  assert.equal(h.get('__first'),'goal'); assert.equal(h.get('__tab'),'Medals'); assert.equal(h.get('__went'),'Alice');
});
test('the tracker can be dragged and remembers where it was put',()=>{
  const h=setup(); h.run('local T=MAMChronicles.Tracker; T:Refresh(); T.frame:SetPoint("TOPLEFT",UIParent,"TOPLEFT",120,-200); T.frame.scripts.OnDragStop(T.frame); __p=MAMChroniclesDB.settings.tracker');
  assert.equal(h.get('__p.point'),'TOPLEFT'); assert.equal(h.get('__p.x'),120); assert.equal(h.get('__p.y'),-200);
  const g=setup(undefined,'',{tracker:{point:'BOTTOMRIGHT',x:-30,y:90}}); g.run('MAMChronicles.Tracker:Refresh(); __pt=MAMChronicles.Tracker.frame.point'); assert.equal(g.get('__pt[1]'),'BOTTOMRIGHT'); assert.equal(g.get('__pt[4]'),-30);
});
test('a corrupt saved position falls back to the default',()=>{
  const h=setup(undefined,'',{tracker:{point:'NOWHERE',x:'a',y:1e9}}); assert.equal(h.get('MAMChroniclesDB.settings.tracker.point'),'TOPRIGHT'); assert.ok(Math.abs(h.get('MAMChroniclesDB.settings.tracker.y'))<=10000);
});
test('nothing is built during combat and the tracker appears when combat ends',()=>{
  const h=setup(undefined,'function InCombatLockdown() return true end'); h.run('MAMChronicles.Tracker:Refresh(); __f=MAMChronicles.Tracker.frame'); assert.equal(h.get('__f'),null);
  h.run('function InCombatLockdown() return false end'); h.fire('PLAYER_REGEN_ENABLED'); assert.ok(h.get('MAMChronicles.Tracker.frame')!==null);
});
test('refresh requests are batched when timers exist',()=>{
  const h=setup(undefined,'__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}'); h.run('local T=MAMChronicles.Tracker; __timers={}; T:Request(); T:Request(); T:Request(); __n=#__timers'); assert.equal(h.get('__n'),1);
  h.run('__timers[1](); __shown=MAMChronicles.Tracker.frame.shown'); assert.equal(h.get('__shown'),true);
});
test('pinning a goal or earning progress updates the tracker',()=>{
  const h=setup(); h.run('MAMChronicles.Tracker:Refresh(); __before=#MAMChronicles.Tracker:Build(); MAMChronicles.Medals:SetPinned("wine_1",true); __after=#MAMChronicles.Tracker:Build(); __rows=0; for _,r in ipairs(MAMChronicles.Tracker.rows) do if r:IsShown() then __rows=__rows+1 end end');
  assert.equal(h.get('__after'),h.get('__before')+1); assert.equal(h.get('__rows'),h.get('__after'));
});
test('the row count is bounded',()=>{
  const h=setup(); h.run('for i=1,5 do MAMChronicles.Map:OnMessage("P"..i.."-R","L1|1|250|750|42|8|1"); MAMChronicles.Map:SetPinned("P"..i,true) end; local M=MAMChronicles.Medals; for _,id in ipairs({"wine_1","ale_1","coffee_1","food_1","cheese_1","cookie_1"}) do M:SetPinned(id,true) end; __n=#MAMChronicles.Tracker:Build()');
  assert.ok(h.get('__n')<=14);
});
test('the tracker builds with every theme and never errors',()=>{
  for (const t of [undefined,'midnight','parchment']) { const h=setup(t); h.run('MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Tracker:Refresh()'); assert.equal(h.get('MAMChronicles.errorStats.count'),0,String(t)); }
});
test('Settings has tracker options and /mam tracker toggles it',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __a=UI.settingChecks.trackerEnabled~=nil; __b=UI.settingChecks.trackerQuests~=nil'); assert.equal(h.get('__a'),true); assert.equal(h.get('__b'),true);
  h.slash('tracker'); assert.equal(h.get('MAMChroniclesDB.settings.trackerEnabled'),false); h.slash('tracker'); assert.equal(h.get('MAMChroniclesDB.settings.trackerEnabled'),true);
  h.slash('help'); assert.ok(h.calls.printed.join('\n').includes('/mam tracker'));
});
