import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarness, addonPath } from './harness.js';

// Member side of the guild hub: consent, beacon, roster (C1) and stats (S1) messages.
// AUTOMATED STUB TESTS ONLY: nothing here has run between two real players.
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Share.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__now=1790700000
function UnitName(u) if u=="player" then return "Mumtest","Draenor" end end
function UnitLevel() return 42 end
function UnitClass() return "Mage","MAGE",8 end
function UnitRace() return "Human","Human",1 end
__roster={{"Mumtest-Draenor","Member",3},{"Alice-Draenor","Member",3},{"Boss-Draenor","Guild Master",0},{"Officer-Draenor","Officer",1}}
function GetNumGuildMembers() return #__roster end
function GetGuildRosterInfo(i) local r=__roster[i] return r[1],r[2],r[3] end
__sent={}; __chat={}; __prefixes={}; __guild=true; __timers={}; __popup=nil; __instance=false
IsInGuild=function() return __guild end
IsInInstance=function() return __instance end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c,tgt) table.insert(__sent,{p,t,c,tgt}) return 0 end}
Enum={SendAddonMessageResult={Success=0}}
SendChatMessage=function(t,c) table.insert(__chat,{t,c}) end
StaticPopupDialogs={}
StaticPopup_Show=function(name) __popup=name end`;
function setup(settings=''){
  const h=createHarness();h.load(files.slice(0,1));h.run(api);h.load(files.slice(1));
  h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __now end; MAMChronicles.Share.randomDelay=function() return 0 end; MAMChronicles.Toast:Advance(60); __sent={}; __chat={}; __popup=nil; MAMChronicles.AfterCombat=function(self,fn) fn() return true end'+(settings?'; '+settings:''));
  return h;
}
const beacon=(h,sender='Boss-Draenor')=>h.fire('CHAT_MSG_ADDON','MAMCHR','G1|1|Boss','GUILD',sender);
const drain=(h)=>h.run('for i=1,12 do __now=__now+5; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end; MAMChronicles.Share:Tick() end');
const sentTexts=(h)=>{const n=h.get('#__sent');return Array.from({length:n},(_,i)=>h.get(`__sent[${i+1}][2]`));};

test('a beacon from rank 0 or 1 marks the gateway as online, others are ignored',()=>{
  const h=setup();
  beacon(h,'Alice-Draenor');assert.equal(h.get('MAMChronicles.Share:GatewayOnline()'),false);
  h.fire('CHAT_MSG_ADDON','MAMCHR','G1|1|Boss','WHISPER','Boss-Draenor');assert.equal(h.get('MAMChronicles.Share:GatewayOnline()'),false);
  beacon(h,'Officer-Draenor');assert.equal(h.get('MAMChronicles.Share:GatewayOnline()'),true);
  h.run('__now=__now+901');assert.equal(h.get('MAMChronicles.Share:GatewayOnline()'),false);
});

test('first beacon asks for consent once and nothing is sent before the answer',()=>{
  const h=setup();
  beacon(h);assert.equal(h.get('__popup'),'MAMCHRONICLES_SHARE_STATS');
  assert.match(h.get('StaticPopupDialogs.MAMCHRONICLES_SHARE_STATS.text'),/level/i);
  assert.match(h.get('StaticPopupDialogs.MAMCHRONICLES_SHARE_STATS.text'),/never/i);
  drain(h);assert.equal(h.get('#__sent'),0);
  h.run('__popup=nil');beacon(h);assert.equal(h.get('__popup'),null);
  h.run('StaticPopupDialogs.MAMCHRONICLES_SHARE_STATS.OnAccept()');assert.equal(h.get('MAMChroniclesDB.settings.shareStats'),true);
});

test('declining is remembered and nothing is sent',()=>{
  const h=setup();beacon(h);
  h.run('StaticPopupDialogs.MAMCHRONICLES_SHARE_STATS.OnCancel()');
  assert.equal(h.get('MAMChroniclesDB.settings.shareStats'),false);
  beacon(h);drain(h);assert.equal(h.get('#__sent'),0);
});

test('with consent and a beacon the roster and stats go out as hidden GUILD messages only',()=>{
  const h=setup('MAMChroniclesDB.settings.shareStats=true; MAMChronicles.Counters:Add("wine",3); MAMChronicles.Counters:Add("jumps",9)');
  beacon(h);drain(h);
  const texts=sentTexts(h);
  assert.equal(texts.some(t=>t.startsWith('C1|1|42|8|1|')),true);
  const stats=texts.filter(t=>t.startsWith('S1|1|'));
  assert.equal(stats.length>=1,true);
  assert.match(stats.join(','),/wine=3/);assert.match(stats.join(','),/jumps=9/);
  for(let i=1;i<=h.get('#__sent');i++){assert.equal(h.get(`__sent[${i}][1]`),'MAMCHR');assert.equal(h.get(`__sent[${i}][3]`),'GUILD');assert.ok(texts[i-1].length<=255);}
  assert.equal(h.get('#__chat'),0);
});

test('nothing is sent without a beacon, without consent, outside a guild or in an instance',()=>{
  let h=setup('MAMChroniclesDB.settings.shareStats=true');drain(h);assert.equal(h.get('#__sent'),0);
  h=setup();beacon(h);h.run('MAMChroniclesDB.settings.shareStats=nil');drain(h);assert.equal(h.get('#__sent'),0);
  h=setup('MAMChroniclesDB.settings.shareStats=true');beacon(h);h.run('__guild=false');drain(h);assert.equal(h.get('#__sent'),0);
  h=setup('MAMChroniclesDB.settings.shareStats=true');beacon(h);h.run('__instance=true');drain(h);assert.equal(h.get('#__sent'),0);
});

test('unchanged numbers are not resent and changed ones wait for the interval',()=>{
  const h=setup('MAMChroniclesDB.settings.shareStats=true; MAMChronicles.Counters:Add("wine",1)');
  beacon(h);drain(h);const first=h.get('#__sent');assert.ok(first>=2);
  h.run('__now=__now+1900; MAMChronicles.Share.lastBeacon=__now');drain(h);assert.equal(h.get('#__sent'),first);
  h.run('MAMChronicles.Counters:Add("wine",1); MAMChronicles.Share.lastBeacon=__now; MAMChronicles.Share.nextAt=0');
  h.run('__now=__now+10; MAMChronicles.Share.lastBeacon=__now');drain(h);assert.ok(h.get('#__sent')>first);
});

test('only allowlisted keys are shared, never gold or names',()=>{
  const h=setup('MAMChroniclesDB.settings.shareStats=true; MAMChronicles.Counters:Add("wine",1); MAMChroniclesDB.counters[MAMChronicles.characterKey].secretgold=999; MAMChroniclesDB.counters[MAMChronicles.characterKey].emote_target_alice=4');
  beacon(h);drain(h);
  const all=sentTexts(h).join(' ');
  assert.doesNotMatch(all,/gold/i);assert.doesNotMatch(all,/alice/i);assert.match(all,/wine=1/);
});

test('/mam share off stops sending and forget sends one F1 request',()=>{
  const h=setup('MAMChroniclesDB.settings.shareStats=true');
  beacon(h);h.slash('share off');assert.equal(h.get('MAMChroniclesDB.settings.shareStats'),false);
  drain(h);assert.equal(sentTexts(h).filter(t=>t.startsWith('S1|')||t.startsWith('C1|')).length,0);
  h.slash('share forget');drain(h);
  assert.deepEqual(sentTexts(h).filter(t=>t.startsWith('F1|')),['F1|1']);
  assert.equal(h.get('MAMChroniclesDB.settings.shareStats'),false);
});

test('the Settings tab has a stats sharing checkbox',()=>{
  const h=setup();h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Settings")');
  assert.notEqual(h.get('MAMChronicles.UI.settingChecks.shareStats'),null);
});

test('new transport code never whispers and never posts to chat',()=>{
  for(const name of ['Share.lua','Gateway.lua']){
    let text;try{text=readFileSync(addonPath(name),'utf8');}catch{continue;}
    assert.doesNotMatch(text,/SendChatMessage/);assert.doesNotMatch(text,/"WHISPER"/);assert.doesNotMatch(text,/"SAY"|"PARTY"|"YELL"/);
  }
});
