import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarness, addonPath } from './harness.js';

// Guild orders: announcements (N1), weekly quest overrides (Q1), guild message (K1) and the gateway inbox that relays them.
// AUTOMATED STUB TESTS ONLY: nothing here has run between two real players.
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Share.lua','Map.lua','Gateway.lua','Orders.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__now=1790700000
function UnitName(u) if u=="player" then return "Mumtest","Draenor" end end
function UnitLevel() return 42 end
function UnitClass() return "Mage","MAGE",8 end
function UnitRace() return "Human","Human",1 end
__roster={{"Mumtest-Draenor","Guild Master",0},{"Alice-Draenor","Member",3},{"Boss-Draenor","Guild Master",0},{"Officer-Draenor","Officer",1}}
function GetNumGuildMembers() return #__roster end
function GetGuildRosterInfo(i) local r=__roster[i] return r[1],r[2],r[3] end
__sent={}; __prefixes={}; __guild=true; __timers={}
IsInGuild=function() return __guild end
IsInInstance=function() return false end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c,tgt) table.insert(__sent,{p,t,c,tgt}) return 0 end}
Enum={SendAddonMessageResult={Success=0}}`;
function setup(gateway=false){
  const h=createHarness();h.load(files.slice(0,1));h.run(api);h.load(files.slice(1));
  h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __now end; MAMChronicles.Toast:Advance(60); __sent={}');
  if(gateway)h.run('MAMChroniclesDB.settings.gatewayMode=true');
  return h;
}
const say=(h,text,sender='Boss-Draenor',channel='GUILD')=>h.fire('CHAT_MSG_ADDON','MAMCHR',text,channel,sender);
const drain=(h)=>h.run('for i=1,15 do __now=__now+5; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end end');
const sentTexts=(h)=>Array.from({length:h.get('#__sent')},(_,i)=>h.get(`__sent[${i+1}][2]`));
const inbox=(h,commands)=>{h.run('MAMChroniclesInbox={version=1,writtenAt=1,commands={}}');for(const c of commands)h.run(`table.insert(MAMChroniclesInbox.commands,${c})`);};

test('an announcement from rank 0 or 1 shows a toast and is kept (bounded)',()=>{
  const h=setup();say(h,'N1|1|5|1/1|Raid night is Friday at 8pm');
  assert.equal(h.get('MAMChroniclesDB.announcements[1].text'),'Raid night is Friday at 8pm');assert.equal(h.get('MAMChroniclesDB.announcements[1].id'),5);
  assert.match(h.get('MAMChronicles.Toast.title.text'),/announcement/i);
  say(h,'N1|1|5|1/1|Raid night is Friday at 8pm');assert.equal(h.get('#MAMChroniclesDB.announcements'),1);
  for(let i=6;i<40;i++){h.run('__now=__now+61');say(h,`N1|1|${i}|1/1|msg ${i}`,'Officer-Draenor');}
  assert.equal(h.get('#MAMChroniclesDB.announcements')<=20,true);
});

test('multi-part announcements are reassembled in order',()=>{
  const h=setup();say(h,'N1|1|9|2/2|second half');say(h,'N1|1|9|1/2|first half, ');
  assert.equal(h.get('MAMChroniclesDB.announcements[1].text'),'first half, second half');
});

test('announcements from ordinary members, other channels or with bad text are ignored',()=>{
  const h=setup();
  say(h,'N1|1|1|1/1|hi','Alice-Draenor');say(h,'N1|1|2|1/1|hi','Boss-Draenor','WHISPER');say(h,'N1|1|3|1/1|a|b');say(h,'N1|2|4|1/1|hi');say(h,'N1|1|5|4/3|hi');say(h,'N1|1|6|1/1|\u0001ctl');say(h,'N1|1|7|1/1|'+'x'.repeat(230));
  assert.equal(h.get('#(MAMChroniclesDB.announcements or {})'),0);
});

test('a weekly quest override from rank 0 or 1 replaces the picks for that week only',()=>{
  const h=setup();
  h.run('__w=MAMChronicles.Medals:GetWeek()');
  const before=h.get('MAMChronicles.Medals:GetWeeklyQuests()[2].key');const pick=before==='wine'?'coffee':'wine';
  say(h,'Q1|1|3|'+h.get('__w')+'|-,'+pick+',-');
  assert.equal(h.get('MAMChronicles.Medals:GetWeeklyQuests()[2].key'),pick);
  assert.notEqual(h.get('MAMChronicles.Medals:GetWeeklyQuests(__w+1)[2].key'),null);
  assert.equal(h.get('MAMChronicles.Medals:GetWeeklyQuests(__w+1)[2].key')===pick&&before!==pick&&h.get('MAMChronicles.Medals:SelectQuests(__w+1)[2].id')!==pick,false);
});

test('invalid quest overrides are ignored',()=>{
  const h=setup();h.run('__w=MAMChronicles.Medals:GetWeek()');
  say(h,'Q1|1|1|'+h.get('__w')+'|-,nonsense,-');say(h,'Q1|1|2|'+h.get('__w')+'|wine,-,-');say(h,'Q1|1|3|'+h.get('__w')+'|-,wine,-','Alice-Draenor');say(h,'Q1|1|4|abc|-,wine,-');
  assert.equal(h.get('MAMChroniclesDB.questOverride'),null);
});

test('a guild message (K1 motd) is stored for the Home page',()=>{
  const h=setup();say(h,'K1|1|2|motd|Welcome to week 3');assert.equal(h.get('MAMChroniclesDB.guildConfig.motd'),'Welcome to week 3');
  say(h,'K1|1|3|other|nope');assert.equal(h.get('MAMChroniclesDB.guildConfig.motd'),'Welcome to week 3');
});

test('the gateway relays inbox commands as GUILD messages, applies them itself and records acks',()=>{
  const h=setup(true);
  inbox(h,["{id=11,kind='announce',text='Hello guild'}","{id=12,kind='quests',week=MAMChronicles.Medals:GetWeek(),slots={'-','wine','-'}}","{id=13,kind='config',key='motd',text='Be kind'}"]);
  h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);
  const texts=sentTexts(h);
  assert.equal(texts.some(t=>t.startsWith('N1|1|11|1/1|Hello guild')),true);assert.equal(texts.some(t=>t.startsWith('Q1|1|12|')),true);assert.equal(texts.some(t=>t.startsWith('K1|1|13|motd|Be kind')),true);
  for(let i=1;i<=h.get('#__sent');i++){assert.equal(h.get(`__sent[${i}][3]`),'GUILD');assert.equal(h.get(`__sent[${i}][4]`),null);}
  assert.equal(h.get('MAMChroniclesDB.announcements[1].text'),'Hello guild');assert.equal(h.get('MAMChroniclesDB.guildConfig.motd'),'Be kind');
  assert.equal(h.get('MAMChroniclesDB.gateway.ack.lastCommandId'),13);assert.equal(h.get('MAMChroniclesDB.gateway.ack.results[1].state')!==null,true);
  const before=h.get('#__sent');h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);assert.equal(h.get('#__sent'),before);
});

test('award and revoke commands use the existing rank-gated A1 and R1 messages',()=>{
  const h=setup(true);
  inbox(h,["{id=21,kind='award',target='Alice',medal='selfie_squad'}","{id=22,kind='revoke',target='Alice',medal='selfie_squad'}","{id=23,kind='award',target='Alice',medal='quest_machine_1'}"]);
  h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);
  const texts=sentTexts(h);
  assert.equal(texts.includes('A1|Alice|selfie_squad|1'),true);assert.equal(texts.includes('R1|Alice|selfie_squad|1'),true);
  assert.equal(texts.some(t=>t.includes('quest_machine_1')),false);
  assert.equal(h.get('MAMChroniclesDB.gateway.ack.results[3].state'),'rejected');
});

test('malformed commands are rejected with an ack and never sent',()=>{
  const h=setup(true);
  inbox(h,["{id=31,kind='announce',text=''}","{id=32,kind='bogus'}","{id=33,kind='award',target='bad name',medal='x'}","{id='x',kind='announce',text='hi'}","{id=35,kind='config',key='gold',text='no'}"]);
  h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);
  assert.equal(sentTexts(h).length,0);assert.equal(h.get('MAMChroniclesDB.gateway.ack.lastCommandId'),35);
});

test('nothing is relayed when this client is not a ready gateway',()=>{
  let h=setup(false);inbox(h,["{id=41,kind='announce',text='hi'}"]);h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);assert.equal(sentTexts(h).length,0);
  h=setup(true);h.run('__roster[1][3]=3; MAMChronicles.Gateway.readyAt=nil');inbox(h,["{id=42,kind='announce',text='hi'}"]);h.run('MAMChronicles.Orders:ProcessInbox()');drain(h);assert.equal(sentTexts(h).length,0);
  assert.equal(h.get('MAMChroniclesDB.gateway and MAMChroniclesDB.gateway.ack and MAMChroniclesDB.gateway.ack.lastCommandId'),null);
});

test('only twenty inbox commands are handled per pass',()=>{
  const h=setup(true);inbox(h,Array.from({length:30},(_,i)=>`{id=${100+i},kind='config',key='motd',text='m${i}'}`));
  h.run('MAMChronicles.Orders:ProcessInbox()');assert.equal(h.get('MAMChroniclesDB.gateway.ack.lastCommandId')<=119,true);
  for(let i=0;i<12;i++){drain(h);h.run('MAMChronicles.Orders:ProcessInbox()');}
  assert.equal(h.get('MAMChroniclesDB.gateway.ack.lastCommandId'),129);
});

test('the orders code never whispers and never posts to chat',()=>{
  const text=readFileSync(addonPath('Orders.lua'),'utf8');
  assert.doesNotMatch(text,/SendChatMessage/);assert.doesNotMatch(text,/"WHISPER"/);
});
