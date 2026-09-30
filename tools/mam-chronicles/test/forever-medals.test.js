import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const key='Player-1234-ABCDEF';
const earned=id=>`MAMChroniclesDB.medals["${key}"].earned.${id}`;
const counter=name=>`(MAMChroniclesDB.counters["${key}"] or {}).${name}`;
const tally=name=>`MAMChroniclesDB.medalTallies["${key}"].${name}`;
const base=`
__vals={[201]="1,234"}
__cats={[3]={"Quests",-1}}
__stats={[3]={{201,"Quests completed"}}}
function GetStatisticsCategoryList() return {3} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
__t=100
function GetTime() return __t end
__spells={[1]="Basic Campfire",[2]="Journeyman Campfire",[3]="Expert Campfire",[4]="Sharpening Wheel",[5]="Incense Candle",[6]="Frostbolt",[7]="Mana Well"}
C_Spell={GetSpellName=function(id) return __spells[id] end}
function hooksecurefunc() end
function UnitLevel() return __level or 12 end`;
const forever='function GetBuildInfo() return "1.60.1","70009","Sep 2026",16001 end';
function setup(extra='',{scan=true}={}){const h=createHarness();h.load(files.slice(0,1));h.run(base+'\n'+extra);h.load(files.slice(1));h.run('MAMChronicles:Boot()'+(scan?'; MAMChronicles.AchievementStats:Scan()':''));return h;}
const avail=(h,id)=>h.get(`MAMChronicles.Medals:IsAvailable(MAMChronicles.Medals:GetDefinition("${id}"))`);
const ev=(h,type,payload,now)=>h.run(`MAMChronicles.Now=function() return ${now} end; MAMChronicles.EventStore:Append("${type}",${payload},{occurredAt=${now}})`);
const cast=(h,id)=>h.fire('UNIT_SPELLCAST_SUCCEEDED','player','guid',id);

test('Retail-only medals are hidden on WoW Forever and shown on Retail',()=>{const f=setup(forever);const r=setup();for(const id of ['delver_1','treasure_1','playdate_1','achiever_1']){assert.equal(avail(f,id),false,`${id} on forever`);assert.equal(avail(r,id),true,`${id} on retail`);}});
test('statistic medals only appear when the client reports that statistic',()=>{const f=setup(forever);assert.equal(avail(f,'slayer_1'),false);assert.equal(avail(f,'hearth_1'),false);assert.equal(avail(f,'buyer_1'),false);assert.equal(avail(f,'battlemaster'),false);const g=setup(forever+'\n__vals[301]="5000"; __stats[3][2]={301,"Creatures killed"}');assert.equal(avail(g,'slayer_1'),true);assert.equal(avail(g,'hearth_1'),false);});
test('event-based medals stay available on Forever',()=>{const f=setup(forever);for(const id of ['fresh_start','quest_machine_1','dungeon_regular_1','oops_1','wine_1','hugs_1','sit_1','late_1','streak_1','clean_1','raid_1','gravity','cooking_1','mom_of_many_1'])assert.equal(avail(f,id),true,id);});
test('level medals stop at the Forever cap of 60',()=>{const f=setup(forever);for(const id of ['adventurer_1','adventurer_2','adventurer_3'])assert.equal(avail(f,id),true,id);for(const id of ['adventurer_4','adventurer_5'])assert.equal(avail(f,id),false,id);});
test('camping spells are counted by name and only on Forever',()=>{const f=setup(forever);cast(f,1);cast(f,2);cast(f,3);cast(f,6);assert.equal(f.get(counter('campfires')),3);assert.equal(f.get(counter('campfire_journeyman')),1);assert.equal(f.get(counter('campfire_expert')),1);assert.notEqual(f.get(earned('firestarter_1')+'.at'),null);assert.notEqual(f.get(earned('journeyman_camper')+'.at'),null);assert.notEqual(f.get(earned('expert_camper')+'.at'),null);const r=setup();cast(r,1);assert.equal(avail(r,'firestarter_1'),false);});
test('camp objects are counted and distinct kinds are tracked',()=>{const f=setup(forever);cast(f,4);cast(f,4);cast(f,5);cast(f,7);assert.equal(f.get(counter('camp_objects')),4);assert.equal(f.get(tally('campObjectsCount')),3);assert.equal(f.get('type(MAMChroniclesDB.medalTallies["'+key+'"].sets.campObjects)'),'table');});
test('completing The Great Outdoors earns Happy Camper',()=>{const f=setup(forever);ev(f,'quest.completed','{questID=99,questName="The Great Outdoors"}',1790706000);assert.notEqual(f.get(earned('happy_camper')+'.at'),null);});
test('Forever\'s new dungeons, raids and battleground are recognised by name',()=>{const f=setup(forever);const enter=(name,type,now)=>ev(f,'instance.entered',`{instanceName="${name}",instanceType="${type}"}`,now);enter('Hall of Thanes','party',1790706000);enter('Alcaz Prison','party',1790706100);enter('Ragefire Chasm','party',1790706200);enter('Hall of Thanes','party',1790706300);assert.equal(f.get(tally('newDungeonsCount')),2);assert.notEqual(f.get(earned('unexplored_depths_1')+'.at'),null);assert.equal(f.get(earned('unexplored_depths_2')),null);enter('Hyjal Summit','raid',1790706400);enter('The Barrow Deeps','raid',1790706500);enter('Darkspear Islands','pvp',1790706600);assert.notEqual(f.get(earned('summit_seeker')+'.at'),null);assert.notEqual(f.get(earned('into_the_barrow')+'.at'),null);assert.notEqual(f.get(earned('islander_1')+'.at'),null);});
test('discovering areas in Forever\'s new zones is tallied per zone',()=>{const f=setup(forever);ev(f,'world.zone_discovered','{zone="Zephras Isle",subzone="Landing"}',1790706000);ev(f,'world.zone_discovered','{zone="Zephras Isle",subzone="Shore"}',1790706100);ev(f,'world.zone_discovered','{zone="Mount Hyjal",subzone="Nordrassil"}',1790706200);ev(f,'world.zone_discovered','{zone="Elwynn Forest",subzone="Goldshire"}',1790706300);assert.equal(f.get(tally('newZonesCount')),2);assert.notEqual(f.get(earned('new_horizons_2')+'.at'),null);assert.equal(f.get(earned('new_horizons_3')),null);});
test('Forever\'s new race and class combinations earn Plot Twist',()=>{const f=setup(forever+'\nfunction UnitRace() return "Orc","Orc",2 end\nfunction UnitClass() return "Mage","MAGE",8 end');assert.notEqual(f.get(earned('plot_twist')+'.at'),null);const g=setup(forever+'\nfunction UnitRace() return "Human","Human",1 end\nfunction UnitClass() return "Warrior","WARRIOR",1 end');assert.equal(g.get(earned('plot_twist')),null);});
test('Cooking skill milestones earn the Campfire Chef medals',()=>{const f=setup(forever);ev(f,'profession.changed','{professionName="Cooking",skillLevel=150}',1790706000);assert.notEqual(f.get(earned('campfire_chef_1')+'.at'),null);assert.equal(f.get(earned('campfire_chef_2')),null);});
test('diagnostics list the camp-related spell names seen so detection can be verified',()=>{const f=setup(forever);cast(f,1);cast(f,4);f.run('__d=MAMChronicles.Export:BuildDiagnosticReport()');assert.match(f.get('__d'),/Camp spells seen: .*Basic Campfire/);});
test('every Forever-only medal is hidden on Retail',()=>{const r=setup();for(const id of ['journey_1','ready_for_core','beta_mom','firestarter_1','unexplored_depths_1','summit_seeker','new_horizons_1','plot_twist','happy_camper','campfire_chef_1'])assert.equal(avail(r,id),false,id);});
test('the review left a large but consistent catalogue',()=>{const f=setup(forever);f.run('local M=MAMChronicles.Medals; __n=#M:GetDefinitions(); __ok=true; local seen={}; for _,d in ipairs(M:GetDefinitions()) do if seen[d.id] then __ok=false end seen[d.id]=true end; __s=M:GetSummary("'+key+'")');assert.equal(f.get('__n')>=250,true);assert.equal(f.get('__ok'),true);assert.equal(f.get('__s.possible')<f.get('__n'),true);});
