import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function boot(pre=''){const h=createHarness();h.load(['Core.lua']);if(pre)h.run(pre);h.load(files.slice(1));h.run('MAMChronicles:Boot()');return h;}

// Live Retail result (alpha12): 441 statistics took 2747 ms, dominated by a few huge categories.
const big=`
__cats={[5]={"Dungeons & Raids",-1}}
__stats={[5]={}}
__vals={}
for i=1,12 do __stats[5][i]={1000+i,"Stat "..i}; __vals[1000+i]=tostring(i*10) end
function GetStatisticsCategoryList() return {5} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
__timers={}; C_Timer={After=function(d,fn) table.insert(__timers,fn) end}; __clock=0; function debugprofilestop() __clock=__clock+10 return __clock end`;
test('one huge statistics category is split across several frames',()=>{
  const h=boot(big); h.run('MAMChronicles.AchievementStats:Scan(); __queued=#__timers; __state=MAMChronicles.AchievementStats.status.state');
  assert.equal(h.get('__state'),'pending'); assert.ok(h.get('__queued')>=1);
  h.run('__n=0; while #__timers>0 and __n<100 do __n=__n+1; table.remove(__timers,1)() end');
  assert.ok(h.get('__n')>=5,`only ${h.get('__n')} slices`); assert.equal(h.get('MAMChronicles.AchievementStats.status.state'),'ok'); assert.equal(h.get('MAMChronicles.AchievementStats.status.statCount'),12);
});
test('the reporting window is shown as dates, not raw timestamps',()=>{
  const h=boot(); h.run('__s=MAMChronicles.Export:BuildHumanSummary(1788217200,1790795805)');
  assert.ok(!/17882\d+/.test(h.get('__s'))); assert.match(h.get('__s'),/Reporting window: \d{1,2} \w{3} \d{4} to \d{1,2} \w{3} \d{4}/);
});
test('timeline rows use readable text for sessions, medals and level ups',()=>{
  const h=boot();
  h.run('local L=MAMChronicles.UI.EventLabel; __a=L({type="session.login",payload={}}); __b=L({type="session.logout",payload={duration=3700}}); __c=L({type="medal.earned",payload={medalName="Fresh Start",points=10}}); __d=L({type="character.level_up",payload={level=12}}); __e=L({type="weird.thing",payload={}})');
  assert.equal(h.get('__a'),'Logged in'); assert.match(h.get('__b'),/^Logged out/); assert.match(h.get('__b'),/1h 1m/); assert.equal(h.get('__c'),'Fresh Start (+10 Mom Money)'); assert.equal(h.get('__d'),'Reached level 12');
  assert.equal(h.get('__e'),'weird thing');
});
test('count statistics that merely mention gold are not treated as money',()=>{
  const h=boot(); h.run('local A=MAMChronicles.AchievementStats; __a=A:Classify("Legacy","Gold Challenge ratings earned","count"); __b=A:Classify("Dungeons","Goldie Baronbottom kills (Normal Cinderbrew Meadery)","count"); __c=A:Classify("Character","Total gold looted","money"); __d=A:Classify("Character","Total money received","money")');
  assert.notEqual(h.get('__a'),'Gold and money'); assert.notEqual(h.get('__b'),'Gold and money'); assert.equal(h.get('__c'),'Gold and money'); assert.equal(h.get('__d'),'Gold and money');
});
test('statistics slices are spaced out by a short delay',()=>{
  const h=boot(big.replace('C_Timer={After=function(d,fn) table.insert(__timers,fn) end}','__delays={}; C_Timer={After=function(d,fn) table.insert(__delays,d); table.insert(__timers,fn) end}'));
  h.run('MAMChronicles.AchievementStats:Scan(); __d=__delays[#__delays]');
  assert.ok(h.get('__d')>=0.03,`delay ${h.get('__d')}`);
});
