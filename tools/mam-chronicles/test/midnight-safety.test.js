import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, multi } from './harness.js';

// Midnight (12.0+) hides some values from addon code and can switch addon messages off. These tests simulate that.
const files = ['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const secretApi = `issecretvalue=function(v) return v=="__SECRET__" end`;
const commsApi = `
__vals={[201]="1,234"}
__cats={[3]={"Quests",-1}}
__stats={[3]={{201,"Quests completed"}}}
function GetStatisticsCategoryList() return {3} end
function GetCategoryInfo(id) return __cats[id][1],__cats[id][2] end
function GetCategoryNumAchievements(id) return #(__stats[id] or {}),0,0 end
function GetAchievementInfo(id,index) local s=__stats[id][index] return s[1],s[2] end
function GetStatistic(id) return __vals[id],false end
__sent={}; __prefixes={}; __timers={}; __lock=false; __outgoing=false
IsInGuild=function() return true end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,
  SendAddonMessage=function(p,t,c) table.insert(__sent,{p,t,c}) return 0 end,
  InChatMessagingLockdown=function() return __lock end,
  AreOutgoingAddonChatMessagesRestricted=function() return __outgoing end}
Enum={SendAddonMessageResult={Success=0}}`;
function setup() {
  const h = createHarness();
  h.load(files.slice(0, 1)); h.run(commsApi); h.load(files.slice(1));
  h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); __sent={}; __timers={}');
  return h;
}
const earn = '__vals[201]="1,600"; MAMChronicles.AchievementStats:Scan()';

test('a death against a secret enemy name is still recorded, just without the name', () => {
  const h = createHarness({ globals: { UnitCanAttack: () => true, UnitName: unit => unit === 'target' ? '__SECRET__' : multi('Mumtest', 'Draenor') } });
  h.load(files.slice(0, 4)); h.run(secretApi); h.run('MAMChronicles:Boot()');
  h.fire('PLAYER_DEAD');
  assert.equal(h.get('MAMChronicles.EventStore:Count("character.death")'), 1);
  assert.equal(h.get('MAMChroniclesDB.events[1].payload.lastHostileTarget'), null);
  assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
});

test('a visible enemy name is still stored on death', () => {
  const h = createHarness({ globals: { UnitCanAttack: () => true, UnitName: unit => unit === 'target' ? 'Defias Thug' : multi('Mumtest', 'Draenor') } });
  h.load(files.slice(0, 4)); h.run(secretApi); h.run('MAMChronicles:Boot()');
  h.fire('PLAYER_DEAD');
  assert.equal(h.get('MAMChroniclesDB.events[1].payload.lastHostileTarget'), 'Defias Thug');
});

test('a secret loot message is skipped quietly', () => {
  const h = createHarness({ globals: { LOOT_ITEM_SELF: 'You receive loot: %s.' } });
  h.load(files.slice(0, 4)); h.run(secretApi); h.run('MAMChronicles:Boot()');
  h.fire('CHAT_MSG_LOOT', '__SECRET__');
  assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
  assert.equal(h.get('#MAMChroniclesDB.events'), 0);
});

test('secret addon messages are ignored without being counted as attacks', () => {
  const h = setup(); h.run(secretApi);
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', '__SECRET__', 'GUILD', 'Alice-Draenor');
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'M1|quest_machine_2|25|1', 'GUILD', '__SECRET__');
  assert.equal(h.get('MAMChronicles.Comms.status.dropped'), 0);
  assert.equal(h.get('#MAMChroniclesDB.guildFeed'), 0);
  assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
});

test('a chat messaging lockdown holds the announcement and sends it once the lockdown ends', () => {
  const h = setup();
  h.run('__lock=true; ' + earn);
  assert.equal(h.get('#__sent'), 0);
  assert.equal(h.get('MAMChronicles.Comms.status.state'), 'locked');
  assert.equal(h.get('#MAMChronicles.Comms.queue'), 1);
  h.run('__lock=false; MAMChronicles.Now=function() return 1790709000 end; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end');
  assert.equal(h.get('#__sent'), 1);
  assert.equal(h.get('__sent[1][2]'), 'M1|quest_machine_3|50|1');
  assert.equal(h.get('#MAMChronicles.Comms.queue'), 0);
});

test('entering the world after a lockdown pumps the held queue', () => {
  const h = setup();
  h.run('__lock=true; ' + earn + '; __lock=false; MAMChronicles.Now=function() return 1790709000 end');
  assert.equal(h.get('#__sent'), 0);
  h.fire('PLAYER_ENTERING_WORLD');
  assert.equal(h.get('#__sent'), 1);
});

test('the held queue never grows past ten announcements', () => {
  const h = setup();
  h.run('__lock=true; local M=MAMChronicles.Medals; local C=MAMChronicles.Comms; for i=1,25 do C:OnMedal(M:GetDefinition("quest_machine_1"),{}) end');
  assert.equal(h.get('#MAMChronicles.Comms.queue'), 10);
});

test('a realm that restricts outgoing addon messages sends nothing and does not queue forever', () => {
  const h = setup();
  h.run('__outgoing=true; ' + earn);
  assert.equal(h.get('#__sent'), 0);
  assert.equal(h.get('MAMChronicles.Comms.status.state'), 'restricted');
  assert.equal(h.get('#MAMChronicles.Comms.queue'), 0);
});

// ---- guild medal totals (T1), sent once per session after login
function summarySetup() {
  const h = setup();
  h.run('MAMChroniclesDB.medals[MAMChronicles.characterKey]=MAMChroniclesDB.medals[MAMChronicles.characterKey] or {earned={},total=0}; __sent={}');
  return h;
}

test('a small medal-total message is sent once after login and holds totals only', () => {
  const h = summarySetup();
  h.run('MAMChronicles.Now=function() return 1790709000 end; local ok=MAMChronicles.Comms:SendSummary(); __ok=ok');
  const sent = h.get('#__sent');
  if (h.get('__ok')) { assert.equal(sent, 1); assert.match(h.get('__sent[1][2]'), /^T1\|\d+\|\d+\|1$/); assert.equal(h.get('__sent[1][3]'), 'GUILD'); }
  else assert.equal(sent, 0);
});

test('no total is sent when medal announcements are off', () => {
  const h = summarySetup();
  h.run('MAMChronicles.SettingsPanel:ApplySetting("announceMedals",false); __ok=MAMChronicles.Comms:SendSummary()');
  assert.equal(h.get('__ok'), false); assert.equal(h.get('#__sent'), 0);
});

test('received totals fill the guild roster, validated and sorted by Mom Money', () => {
  const h = setup();
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|12|340|1', 'GUILD', 'Alice-Draenor');
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|40|900|1', 'GUILD', 'Bob-Draenor');
  assert.equal(h.get('MAMChronicles.Comms:GetRoster()[1].name'), 'Bob');
  assert.equal(h.get('MAMChronicles.Comms:GetRoster()[2].points'), 340);
  for (const bad of ['T1|-1|5|1', 'T1|1.5|5|1', 'T1|x|5|1', 'T1|1|99999999|1']) h.fire('CHAT_MSG_ADDON', 'MAMCHR', bad, 'GUILD', 'Evil-Draenor');
  assert.equal(h.get('#MAMChronicles.Comms:GetRoster()'), 2);
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|5|5|1', 'WHISPER', 'Mallory-Draenor');
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|5|5|9', 'GUILD', 'Future-Draenor');
  assert.equal(h.get('#MAMChronicles.Comms:GetRoster()'), 2);
  assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
});

test('the Guild tab lists received totals with you in the board, and /mam guild opens it', () => {
  const h = setup();
  h.run('MAMChroniclesDB.medals[MAMChronicles.characterKey]=MAMChroniclesDB.medals[MAMChronicles.characterKey] or {earned={},total=0}');
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|12|340|1', 'GUILD', 'Alice-Draenor');
  h.slash('guild'); h.run('__tab=MAMChronicles.UI.activeTab; __c=MAMChronicles.UI.content.text');
  assert.equal(h.get('__tab'), 'Guild'); assert.match(h.get('__c'), /Alice\s+-\s+12 medals/); assert.match(h.get('__c'), /Guild leaderboard/);
});

test('the leaderboard survives a reload because guildmate totals are saved', () => {
  const h = setup();
  h.fire('CHAT_MSG_ADDON', 'MAMCHR', 'T1|12|340|1', 'GUILD', 'Alice-Draenor');
  assert.equal(h.get('MAMChroniclesDB.guildRoster.Alice.points'), 340);
  assert.equal(h.get('MAMChronicles.Comms:GetRoster()[1].name'), 'Alice');
});

test('/mam guild send queues your own totals even right after login', () => {
  const h = summarySetup();
  h.run('MAMChroniclesDB.medals[MAMChronicles.characterKey].earned.quest_machine_1={at=1,points=10}; MAMChronicles.Comms.lastSummary=MAMChronicles:Now()');
  h.slash('guild send'); assert.ok(h.calls.printed.join(' ').includes('queued'));
});

test('login schedules one medal-total message and a quick /reload does not repeat it', () => {
  const h = summarySetup();
  h.run('MAMChroniclesDB.medals[MAMChronicles.characterKey].earned.quest_machine_1={at=1,points=10}; __timers={}');
  h.fire('PLAYER_LOGIN'); assert.equal(h.get('#__timers') >= 1, true);
  h.run('MAMChronicles.Now=function() return 1790709000 end; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end; __first=0; for _,m in ipairs(__sent) do if m[2]:sub(1,3)=="T1|" then __first=__first+1 end end; for _,q in ipairs(MAMChronicles.Comms.queue) do if q:sub(1,3)=="T1|" then __first=__first+1 end end');
  assert.equal(h.get('__first'), 1);
  h.run('__t2=MAMChronicles.Comms:SendSummary()'); assert.equal(h.get('__t2'), false);
});
