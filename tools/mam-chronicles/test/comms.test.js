import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__vals={[201]="1,234"}
__cats={[3]={"Quests",-1}}
__stats={[3]={{201,"Quests completed"}}}
function GetStatisticsCategoryList() return {3} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
__sent={}; __chat={}; __prefixes={}; __guild=true; __sendResult=0; __timers={}
IsInGuild=function() return __guild end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c) table.insert(__sent,{p,t,c}) return __sendResult end}
Enum={SendAddonMessageResult={Success=0}}
SendChatMessage=function(t,c) table.insert(__chat,{t,c}) end`;
function setup(extra=''){const h=createHarness();h.load(files.slice(0,1));h.run(api+'\n'+extra);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); __sent={}; __chat={}');return h;}
const earn='__vals[201]="1,600"; MAMChronicles.AchievementStats:Scan()';

test('comms registers its prefix once and listens for guild addon messages',()=>{const h=setup();assert.equal(h.get('#__prefixes'),1);assert.equal(h.get('__prefixes[1]'),'MAMCHR');assert.equal(h.get('MAMChronicles.Comms.status.state'),'ready');});
test('a live medal is announced to the guild as one small addon message',()=>{const h=setup();h.run(earn);assert.equal(h.get('#__sent'),1);assert.equal(h.get('__sent[1][1]'),'MAMCHR');assert.equal(h.get('__sent[1][2]'),'M1|quest_machine_3|50|1');assert.equal(h.get('__sent[1][3]'),'GUILD');assert.equal(h.get('MAMChronicles.Comms.status.sent'),1);assert.equal(h.get('#__chat'),0);});
test('baseline medals from history are never announced',()=>{const h=createHarness();h.load(files.slice(0,1));h.run(api);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan()');assert.equal(h.get('#__sent'),0);});
test('nothing is sent when the player switched announcements off',()=>{const h=setup();h.run('MAMChronicles.SettingsPanel:ApplySetting("announceMedals",false); '+earn);assert.equal(h.get('#__sent'),0);});
test('nothing is sent outside a guild',()=>{const h=setup();h.run('__guild=false; '+earn);assert.equal(h.get('#__sent'),0);assert.equal(h.get('MAMChronicles.Comms.status.state'),'not in guild');});
test('a restricted realm stops sending gracefully without errors',()=>{const h=setup('__sendResult=11');h.run(earn);assert.equal(h.get('MAMChronicles.Comms.status.state'),'restricted');const before=h.get('#__sent');h.run('__vals[201]="3,100"; MAMChronicles.AchievementStats:Scan()');assert.equal(h.get('#__sent'),before);});
test('several medals at once are rate limited and drained over time',()=>{const h=setup();h.run('__vals[201]="3,100"; MAMChronicles.AchievementStats:Scan()');assert.equal(h.get('#__sent'),1);assert.equal(h.get('#MAMChronicles.Comms.queue')>=1,true);h.run('MAMChronicles.Now=function() return 1790705000 end; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end');assert.equal(h.get('#__sent'),2);});
test('guild chat is only used when the player opted in',()=>{const h=setup();h.run('MAMChronicles.SettingsPanel:ApplySetting("announceGuildChat",true); '+earn);assert.equal(h.get('#__chat'),1);assert.equal(h.get('__chat[1][2]'),'GUILD');assert.match(h.get('__chat[1][1]'),/Quest Machine III/);});
test('a valid guild message shows a toast and lands in the guild feed',()=>{const h=setup();h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|25|1','GUILD','Alice-Draenor');assert.equal(h.get('MAMChroniclesDB.guildFeed[1].sender'),'Alice-Draenor');assert.equal(h.get('MAMChroniclesDB.guildFeed[1].id'),'quest_machine_2');assert.match(h.get('MAMChronicles.Toast.title.text'),/Alice/);assert.match(h.get('MAMChronicles.Toast.title.text'),/Quest Machine II/);assert.equal(h.get('MAMChronicles.Comms.status.received'),1);});
test('invalid, forged, wrong-channel and own messages are ignored',()=>{const h=setup();for(const [text,channel,sender] of [['M1|not_a_medal|25|1','GUILD','Bob-Draenor'],['M1|quest_machine_2|9999|1','GUILD','Bob-Draenor'],['M1|quest_machine_2|25|1','SAY','Bob-Draenor'],['M1|quest_machine_2|25|1','GUILD','Mumtest-Draenor'],['garbage','GUILD','Bob-Draenor'],['M1|quest_machine_2|25|1|extra|fields|here','GUILD','Bob-Draenor'],['M1|'+'x'.repeat(500)+'|25|1','GUILD','Bob-Draenor'],['M1|quest_machine_2|25|9','GUILD','Bob-Draenor']])h.fire('CHAT_MSG_ADDON','MAMCHR',text,channel,sender);assert.equal(h.get('#MAMChroniclesDB.guildFeed'),0);assert.equal(h.get('MAMChronicles.Comms.status.dropped')+h.get('MAMChronicles.Comms.status.unknown')+h.get('MAMChronicles.Comms.status.otherVersion')>=7,true);});
test('a foreign prefix is ignored entirely',()=>{const h=setup();h.fire('CHAT_MSG_ADDON','OTHER','M1|quest_machine_2|25|1','GUILD','Bob-Draenor');assert.equal(h.get('#MAMChroniclesDB.guildFeed'),0);assert.equal(h.get('MAMChronicles.Comms.status.received'),0);});
test('the same medal from the same player is only recorded once',()=>{const h=setup();for(let i=0;i<3;i++)h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|25|1','GUILD','Alice-Draenor');assert.equal(h.get('#MAMChroniclesDB.guildFeed'),1);});
test('a flooding sender is capped per minute',()=>{const h=setup();const ids=['quest_machine_1|10','quest_machine_2|25','quest_machine_3|50','quest_machine_4|100','delver_1|10','delver_2|25','delver_3|50'];for(const id of ids)h.fire('CHAT_MSG_ADDON','MAMCHR',`M1|${id}|1`,'GUILD','Spammy-Draenor');assert.equal(h.get('#MAMChroniclesDB.guildFeed'),5);});
test('guild alerts can be switched off and then nothing is recorded or shown',()=>{const h=setup();h.run('MAMChronicles.SettingsPanel:ApplySetting("receiveGuildAlerts",false)');h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|25|1','GUILD','Alice-Draenor');assert.equal(h.get('#MAMChroniclesDB.guildFeed'),0);});
test('the guild feed keeps only the newest fifty entries',()=>{const h=setup();h.run('local C=MAMChronicles.Comms; for i=1,60 do C:Record("Person"..i.."-Realm",MAMChronicles.Medals:GetDefinition("quest_machine_1")) end');assert.equal(h.get('#MAMChroniclesDB.guildFeed'),50);assert.equal(h.get('MAMChroniclesDB.guildFeed[1].sender'),'Person60-Realm');});
test('diagnostics report guild sharing state and counts',()=>{const h=setup();h.run(earn+'; __d=MAMChronicles.Export:BuildDiagnosticReport()');assert.match(h.get('__d'),/Guild sharing: ready, sent 1, received 0, dropped 0/);});
test('the welcome message tells the player what is shared and where to opt out',()=>{const h=createHarness();h.load(files);h.run('MAMChronicles:Boot()');const messages=h.calls.printed.filter(m=>/Welcome/.test(m));assert.equal(messages.length,1);assert.match(messages[0],/Medals/);assert.match(messages[0],/guild/);assert.match(messages[0],/Settings/);assert.equal(h.get('MAMChroniclesDB.settings.welcomeVersion'),'personal-chronicle-v3');});
test('the Medals tab lists guildmate medals and shows an empty hint otherwise',()=>{const h=setup();h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); __empty=MAMChronicles.UI.guildEmpty.shown');assert.equal(h.get('__empty'),true);h.fire('CHAT_MSG_ADDON','MAMCHR','M1|quest_machine_2|25|1','GUILD','Alice-Draenor');h.run('MAMChronicles.UI:RefreshMedals(); __line=MAMChronicles.UI.guildLines[1].text; __empty=MAMChronicles.UI.guildEmpty.shown');assert.match(h.get('__line'),/Alice/);assert.equal(h.get('__empty'),false);});
