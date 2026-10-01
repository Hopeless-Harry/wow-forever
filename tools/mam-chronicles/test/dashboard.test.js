import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__vals={[101]="12",[201]="1,234",[501]="7"}
__cats={[2]={"Deaths",-1},[3]={"Quests",-1},[5]={"Dungeons & Raids",-1}}
__stats={[2]={{101,"Total deaths"}},[3]={{201,"Quests completed"}},[5]={{501,"Total 5-player dungeons entered"}}}
function GetStatisticsCategoryList() return {2,3,5} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
function UnitLevel() return 42 end
function GetZoneText() return "Dornogal" end`;
function setup(withStats=true){const h=createHarness();h.load(files.slice(0,1));if(withStats)h.run(api);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.EventStore:Append("character.death",{zone="Cave"},{occurredAt=1}); MAMChronicles.EventStore:Append("quest.completed",{questID=2,questName="Find Mum"},{occurredAt=2}); MAMChronicles.EventStore:Append("memory.manual",{text="Tea time"},{occurredAt=3})'+(withStats?'; MAMChronicles.AchievementStats:Scan()':''));return h;}

test('dashboard model reads headline statistics, month numbers, recent events and status',()=>{const h=setup();h.run('__m=MAMChronicles.Dashboard:Build(); __by={}; for _,t in ipairs(__m.tiles) do __by[t.label]=t.value end');assert.equal(h.get('__by["Quests completed"]'),'1,234');assert.equal(h.get('__by["Deaths"]'),'12');assert.equal(h.get('__by["Dungeons entered"]'),'7');assert.equal(h.get('__by["Creatures killed"]'),'—');assert.equal(h.get('__m.month.events>=0'),true);assert.equal(h.get('__m.recent[1].kind'),'Memory');assert.equal(h.get('#__m.recent<=6'),true);assert.equal(h.get('__m.status.statistics'),'ok');assert.equal(h.get('__m.character.level'),42);assert.equal(h.get('__m.character.zone'),'Dornogal');});
test('dashboard model degrades without statistics',()=>{const h=setup(false);h.run('__m=MAMChronicles.Dashboard:Build(); __by={}; for _,t in ipairs(__m.tiles) do __by[t.label]=t.value end');assert.equal(h.get('__by["Deaths"]'),'—');assert.equal(h.get('__m.recent[1].kind'),'Memory');assert.notEqual(h.get('__m.status.statistics'),'ok');});
test('Home is the first tab and the default, and the dashboard only shows there',()=>{const h=setup();assert.equal(h.get('#MAMChronicles.UI.tabs'),9);assert.equal(h.get('MAMChronicles.UI.tabs[1]'),'Home');assert.equal(h.get('MAMChroniclesDB.settings.ui.activeTab'),'Home');h.run('MAMChronicles.UI:Show()');assert.equal(h.get('MAMChronicles.UI.dashboard.frame.shown'),true);h.run('MAMChronicles.UI:SetActiveTab("Statistics")');assert.equal(h.get('MAMChronicles.UI.dashboard.frame.shown'),false);h.run('MAMChronicles.UI:SetActiveTab("Home")');assert.equal(h.get('MAMChronicles.UI.dashboard.frame.shown'),true);});
test('quick memory box on Home pins a manual memory and clears itself',()=>{const h=setup();h.run('local UI=MAMChronicles.UI; UI:Show(); local d=UI.dashboard; d.memoryBox:SetText("Killed the boss"); d.memoryButton.scripts.OnClick(d.memoryButton)');assert.equal(h.get('MAMChronicles.EventStore:Count("memory.manual")'),2);assert.equal(h.get('MAMChronicles.UI.dashboard.memoryBox:GetText()'),'');});
test('dashboard layout uses two columns on wide windows and one on narrow ones',()=>{const h=setup();h.run('local D=MAMChronicles.Dashboard; MAMChronicles.UI:Create(); __wide=D:Layout(900,560); __narrow=D:Layout(560,440)');assert.equal(h.get('__wide'),2);assert.equal(h.get('__narrow'),1);});
test('text tabs sit in a scroll area whose width follows the window',()=>{const h=setup();h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Statistics"); UI:ApplyLayout(900,600); __w1=UI.content.width; UI:ApplyLayout(700,500); __w2=UI.content.width');assert.equal(h.get('__w1'),850);assert.equal(h.get('__w2'),650);});
test('long statistics text can be scrolled with the wheel and the scrollbar follows',()=>{const h=setup();h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Statistics"); UI:ApplyLayout(620,300); __range=UI.textSlider.maxValue; UI.textScroll.scripts.OnMouseWheel(UI.textScroll,-1); __scroll=UI.textScroll:GetVerticalScroll(); __slider=UI.textSlider.value');assert.equal(h.get('__range')>0,true);assert.equal(h.get('__scroll')>0,true);assert.equal(h.get('__scroll')<=h.get('__range'),true);assert.equal(h.get('__slider'),h.get('__scroll'));});
test('window background is fully opaque so nothing shows through',()=>{const h=setup();h.run('MAMChronicles.Theme:ApplyPreset("midnight"); MAMChronicles.UI:Create()');assert.equal(h.get('MAMChronicles.UI.bgFill.color[4]'),1);});
