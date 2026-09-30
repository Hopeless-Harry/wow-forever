import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__vals={[201]="1,234"}
__cats={[3]={"Quests",-1}}
__stats={[3]={{201,"Quests completed"}}}
function GetStatisticsCategoryList() return {3} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
function InCombatLockdown() return __combat==true end
__sounds=0; SOUNDKIT={ACHIEVEMENT_MENU_OPEN=1234}; function PlaySound() __sounds=__sounds+1 end`;
function setup(extra=''){const h=createHarness();h.load(files.slice(0,1));h.run(api+extra);h.load(files.slice(1));h.run('MAMChronicles:Boot()');return h;}
const spec='{title="Hello",text="World",kind="info"}';

test('a toast shows immediately outside combat with its text',()=>{const h=setup();h.run(`__r=MAMChronicles.Toast:Show(${spec})`);assert.equal(h.get('__r'),'shown');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);assert.equal(h.get('MAMChronicles.Toast.title.text'),'Hello');assert.equal(h.get('MAMChronicles.Toast.body.text'),'World');});
test('toasts are held during combat and appear when combat ends',()=>{const h=setup();h.run(`__combat=true; __r=MAMChronicles.Toast:Show(${spec})`);assert.equal(h.get('__r'),'queued');assert.notEqual(h.get('MAMChronicles.Toast.frame.shown'),true);assert.equal(h.get('#MAMChronicles.Toast.queue'),1);h.run('__combat=false');h.fire('PLAYER_REGEN_ENABLED');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);assert.equal(h.get('MAMChronicles.Toast.title.text'),'Hello');assert.equal(h.get('#MAMChronicles.Toast.queue'),0);});
test('toasts are dropped entirely when switched off',()=>{const h=setup();h.run(`MAMChronicles.SettingsPanel:ApplySetting("toastsEnabled",false); __r=MAMChronicles.Toast:Show(${spec})`);assert.equal(h.get('__r'),'dropped');assert.equal(h.get('#MAMChronicles.Toast.queue'),0);assert.notEqual(h.get('MAMChronicles.Toast.frame.shown'),true);});
test('toasts play through in order and hide themselves after their time',()=>{const h=setup();h.run('local T=MAMChronicles.Toast; T:Show({title="One",text="a",kind="info"}); __second=T:Show({title="Two",text="b",kind="info"}); T:Advance(0.5); __holding=T.phase; T:Advance(30)');assert.equal(h.get('__second'),'queued');assert.equal(h.get('__holding'),'hold');assert.equal(h.get('MAMChronicles.Toast.title.text'),'Two');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);h.run('MAMChronicles.Toast:Advance(30); MAMChronicles.Toast:Advance(30)');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),false);});
test('a burst of medal toasts is merged into one summary',()=>{const h=setup();h.run('local T=MAMChronicles.Toast; __combat=true; for i=1,6 do T:Show({title="Medal "..i,text="x",kind="medal",points=10}) end; __combat=false; __queued=#T.queue');assert.equal(h.get('__queued')<=2,true);h.fire('PLAYER_REGEN_ENABLED');assert.match(h.get('MAMChronicles.Toast.title.text'),/6 new medals/);});
test('the sound only plays when enabled',()=>{const h=setup();h.run(`MAMChronicles.Toast:Show(${spec}); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60)`);assert.equal(h.get('__sounds'),0);h.run(`MAMChronicles.SettingsPanel:ApplySetting("toastSound",true); MAMChronicles.Toast:Show(${spec})`);assert.equal(h.get('__sounds'),1);});
test('earning a medal shows a toast with its name and Mom Money',()=>{const h=setup();h.run('local M=MAMChronicles.Medals; MAMChronicles.AchievementStats:Scan(); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); __vals[201]="1,600"; MAMChronicles.AchievementStats:Scan()');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);assert.match(h.get('MAMChronicles.Toast.title.text'),/Quest Machine III/);assert.match(h.get('MAMChronicles.Toast.points.text'),/\+50/);});
test('the first baseline shows one welcome summary, not a toast per medal',()=>{const h=setup();h.run('MAMChronicles.AchievementStats:Scan()');assert.equal(h.get('#MAMChronicles.Toast.queue'),0);assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);assert.match(h.get('MAMChronicles.Toast.title.text'),/Mom Medals/);});
test('clicking a toast opens the Medals tab and dismisses it',()=>{const h=setup();h.run('local T=MAMChronicles.Toast; T:Show({title="Medal",text="x",kind="medal",points=10}); T.frame.scripts.OnMouseUp(T.frame,"LeftButton")');assert.equal(h.get('MAMChronicles.UI.activeTab'),'Medals');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),false);});
test('levelling up shows a toast',()=>{const h=setup();h.run('MAMChronicles.EventStore:Append("character.level_up",{level=13},{occurredAt=5})');assert.equal(h.get('MAMChronicles.Toast.frame.shown'),true);assert.match(h.get('MAMChronicles.Toast.title.text'),/Level 13/);});
