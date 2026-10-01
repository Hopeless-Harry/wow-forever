import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(pre=''){
  const h=createHarness({}); h.load(files.slice(0,1));
  h.run(`function IsInGuild() return true end; C_Map={GetBestMapForUnit=function() return 2022 end,GetPlayerMapPosition=function() return {GetXY=function() return 0.5,0.3 end} end,GetMapInfo=function(id) return {name="Zone "..id} end}\n${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}'); return h;
}
test('/mam map fake adds pretend guildmates that show, never expire, and can be removed',()=>{
  const h=setup(); h.slash('map fake'); h.run('__n=#MAMChronicles.Map:GetList(); __t=MAMChronicles.UI.activeTab; __found=MAMChronicles.Map:Find("testmom")~=nil');
  assert.equal(h.get('__n'),3); assert.equal(h.get('__t'),'Map'); assert.equal(h.get('__found'),true);
  h.run('__t0=MAMChronicles.Now; MAMChronicles.Now=function() return __t0(MAMChronicles)+100000 end; __late=#MAMChronicles.Map:GetList(); MAMChronicles.Now=__t0'); assert.equal(h.get('__late'),3);
  h.slash('map fake off'); h.run('__n2=#MAMChronicles.Map:GetList()'); assert.equal(h.get('__n2'),0); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('the medals list redraws when a counter changes while it is open',()=>{
  const h=setup('__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}'); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); __n=0; local orig=UI.RefreshMedals; UI.RefreshMedals=function(s) __n=__n+1; return orig(s) end; MAMChronicles.Counters:Add("jumps",1); for i=1,#__timers do __timers[i]() end');
  assert.ok(h.get('__n')>=1);
});
