import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

// Gateway mode: the owner's client listens for C1/S1/F1, stores them in SavedVariables for the companion.
// AUTOMATED STUB TESTS ONLY: nothing here has run between two real players.
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Share.lua','Map.lua','Gateway.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__now=1790700000
function UnitName(u) if u=="player" then return "Mumtest","Draenor" end end
function UnitLevel() return 42 end
function UnitClass() return "Mage","MAGE",8 end
function UnitRace() return "Human","Human",1 end
__rank=0
__roster={{"Mumtest-Draenor","Guild Master",0},{"Alice-Draenor","Member",3},{"Bob-Draenor","Member",3}}
function GetNumGuildMembers() return #__roster end
function GetGuildRosterInfo(i) local r=__roster[i] return r[1],r[2],r[3] end
__sent={}; __chat={}; __prefixes={}; __guild=true; __timers={}; __reloaded=0
IsInGuild=function() return __guild end
IsInInstance=function() return false end
function ReloadUI() __reloaded=__reloaded+1 end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c,tgt) table.insert(__sent,{p,t,c,tgt}) return 0 end}
Enum={SendAddonMessageResult={Success=0}}`;
function setup(extra='',gateway=true){
  const h=createHarness();h.load(files.slice(0,1));h.run(api+(extra?'\n'+extra:''));h.load(files.slice(1));
  h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __now end; MAMChronicles.Share.randomDelay=function() return 0 end; MAMChronicles.Toast:Advance(60); __sent={}');
  if(gateway)h.run('MAMChroniclesDB.settings.gatewayMode=true');
  return h;
}
const say=(h,text,sender='Alice-Draenor',channel='GUILD')=>h.fire('CHAT_MSG_ADDON','MAMCHR',text,channel,sender);
const drain=(h)=>h.run('for i=1,12 do __now=__now+5; local t=__timers; __timers={}; for _,f in ipairs(t) do f() end end');
const sentTexts=(h)=>Array.from({length:h.get('#__sent')},(_,i)=>h.get(`__sent[${i+1}][2]`));
const C1='C1|1|60|5|1|Wine Mom|12|340';

test('with gateway mode off every hub message is ignored',()=>{
  const h=setup('',false);say(h,C1);assert.equal(h.get('MAMChroniclesDB.gateway'),null);
});

test('a rank 0 gateway announces itself with a G1 beacon on the guild channel only',()=>{
  const h=setup();h.run('MAMChronicles.Gateway:Tick()');drain(h);
  const beacons=sentTexts(h).filter(t=>t.startsWith('G1|'));
  assert.equal(beacons.length>=1,true);assert.equal(beacons[0],'G1|1|Mumtest');assert.equal(h.get('__sent[1][3]'),'GUILD');assert.equal(h.get('__sent[1][4]'),null);
});

test('a gateway without rank 0 or 1 does not beacon and says why',()=>{
  const h=setup('',false);h.run('__roster[1][3]=3; MAMChroniclesDB.settings.gatewayMode=true; MAMChronicles.Gateway:Tick()');drain(h);
  assert.equal(sentTexts(h).filter(t=>t.startsWith('G1|')).length,0);assert.match(h.get('MAMChronicles.Gateway:Describe()'),/rank/i);
});

test('a roster summary is stored with last heard',()=>{
  const h=setup();say(h,C1);
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.level'),60);
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.classID'),5);
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.title'),'Wine Mom');
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.medals'),12);
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.momMoney'),340);
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.lastHeard'),1790700000);
});

test('malformed or out of range summaries are dropped',()=>{
  const h=setup();
  for(const bad of ['C1|1|999|5|1|Mom|1|1','C1|1|60|5|1|Bad|Title|1|1','C1|2|60|5|1|Mom|1|1','C1|1|60|5|1|<b>x</b>|1|1','C1|1|-4|5|1|Mom|1|1','C1|1|60|5|1|Mom|1','C1|1|60|5|1|Mom|1|1|extra'])say(h,bad);
  assert.equal(h.get('MAMChroniclesDB.gateway and MAMChroniclesDB.gateway.members.Alice'),null);assert.equal(h.get('MAMChronicles.Gateway.status.dropped')>=7,true);
});

test('hub messages from outside the guild channel are dropped',()=>{
  const h=setup();say(h,C1,'Alice-Draenor','WHISPER');say(h,C1,'Alice-Draenor','SAY');assert.equal(h.get('MAMChroniclesDB.gateway and MAMChroniclesDB.gateway.members.Alice'),null);
});

test('stats parts are reassembled and only allowlisted keys are accepted',()=>{
  const h=setup();
  say(h,'S1|1|7|1/2|wine=3,ale=2');assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.stats.wine'),null);
  say(h,'S1|1|7|2/2|jumps=90,kills=1234');
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.stats.wine'),3);assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.stats.kills'),1234);assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.seq'),7);
  say(h,'S1|1|8|1/1|gold=999999');say(h,'S1|1|8|1/1|wine=abc');say(h,'S1|1|8|1/1|wine=-1');say(h,'S1|1|8|1/1|a=1,b=2,c=3');
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.stats.gold'),null);assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice.stats.wine'),3);
});

test('a forget request deletes the member and leaves a tombstone',()=>{
  const h=setup();say(h,C1);h.run('MAMChroniclesDB.gateway.locations.Alice={mapID=1,x=0.1,y=0.2,level=60,classID=5,at=1}');
  say(h,'F1|1');
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Alice'),null);assert.equal(h.get('MAMChroniclesDB.gateway.locations.Alice'),null);
  assert.equal(h.get('MAMChroniclesDB.gateway.forget[1].name'),'Alice');
});

test('a flooding sender is limited and the member table stays bounded',()=>{
  const h=setup();for(let i=0;i<30;i++)say(h,C1);assert.equal(h.get('MAMChronicles.Gateway.status.dropped')>=20,true);
  h.run('for i=1,320 do MAMChronicles.Gateway:StoreRoster("P"..i,{level=1,classID=1,raceID=1,title="x",medals=0,momMoney=0}) end');
  let n=0;h.run('__n=0; for _ in pairs(MAMChroniclesDB.gateway.members) do __n=__n+1 end');assert.equal(h.get('__n')<=300,true);
});

test('the snapshot copies live locations, skips pretend guildmates and stays bounded',()=>{
  const h=setup();
  h.run('MAMChronicles.Map.members={Zed={mapID=2022,x=0.5,y=0.4,level=80,classID=3,at=__now},Fake={mapID=1,x=0.1,y=0.1,level=1,classID=1,at=__now,fake=true}}; MAMChronicles.Gateway:Snapshot()');
  assert.equal(h.get('MAMChroniclesDB.gateway.locations.Zed.mapID'),2022);assert.equal(h.get('MAMChroniclesDB.gateway.locations.Fake'),null);
  assert.equal(h.get('MAMChroniclesDB.gateway.meta.writtenAt'),1790700000);assert.equal(h.get('MAMChroniclesDB.gateway.meta.version'),1);
});

test('the snapshot lists guild-verified medals, quest templates and zone names for the dashboard',()=>{
  const h=setup();
  h.run('MAMChronicles.Map.members={Zed={mapID=2022,x=0.5,y=0.4,level=80,classID=3,at=__now}}; C_Map={GetMapInfo=function(id) return {name="The Waking Shores"} end}; MAMChronicles.Gateway:Snapshot()');
  assert.equal(h.get('MAMChroniclesDB.gateway.locations.Zed.zone'),'The Waking Shores');
  assert.equal(h.get('MAMChroniclesDB.gateway.catalog.verified[1].id'),'selfie_squad');
  assert.equal(h.get('MAMChroniclesDB.gateway.catalog.verified[1].name'),'Selfie Squad');
  assert.equal(h.get('MAMChroniclesDB.gateway.catalog.templates[1].slot')>=1,true);
  assert.equal(h.get('#MAMChroniclesDB.gateway.catalog.templates')<=80,true);
});

test('the gateway records its own character when sharing is consented',()=>{
  const h=setup('',true);h.run('MAMChroniclesDB.settings.shareStats=true; MAMChronicles.Gateway:Snapshot()');
  assert.equal(h.get('MAMChroniclesDB.gateway.members.Mumtest.level'),42);
});

test('Sync now writes the snapshot then reloads the interface',()=>{
  const h=setup();assert.equal(h.get('MAMChronicles.Gateway:SyncNow()'),true);assert.equal(h.get('__reloaded'),1);assert.equal(h.get('MAMChroniclesDB.gateway.meta.writtenAt'),1790700000);
});

test('/mam gateway on and off toggles gateway mode',()=>{
  const h=setup('',false);h.slash('gateway on');assert.equal(h.get('MAMChroniclesDB.settings.gatewayMode'),true);h.slash('gateway off');assert.equal(h.get('MAMChroniclesDB.settings.gatewayMode'),false);
});
