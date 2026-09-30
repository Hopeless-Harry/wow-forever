import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__hooks={}
function hooksecurefunc(a,b,c) if type(a)=="table" then __hooks[b]=c else __hooks[a]=b end end
function DoEmote() end
__t=100
function GetTime() return __t end
__units={target={name="Alice",guild="Moms",player=true}}
__myGuild="Moms"
function UnitName(u) if u=="player" then return "Mumtest","Draenor" end local x=__units[u] return x and x.name end
function UnitExists(u) return __units[u]~=nil end
function UnitIsPlayer(u) return __units[u]~=nil and __units[u].player==true end
function GetGuildInfo(u) if u=="player" then return __myGuild end local x=__units[u] return x and x.guild end
__roster={{"Mumtest-Draenor","Member",3},{"Alice-Draenor","Member",3},{"Boss-Draenor","Guild Master",0},{"Officer-Draenor","Officer",1}}
function GetNumGuildMembers() return #__roster end
function GetGuildRosterInfo(i) local r=__roster[i] return r[1],r[2],r[3] end
__isLead=false
function IsGuildLeader() return __isLead end
__sent={}; __prefixes={}; __guild=true; __timers={}
IsInGuild=function() return __guild end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c,tgt) table.insert(__sent,{p,t,c,tgt}) return 0 end}
Enum={SendAddonMessageResult={Success=0}}
function __emote(token,target) __t=__t+1; MAMChronicles.Counters:OnEmote(token,target) end`;
function setup(extra=''){const h=createHarness();h.load(files.slice(0,1));h.run(api+'\n'+extra);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); __sent={}');return h;}
const key='Player-1234-ABCDEF';
const targets=(token)=>`MAMChroniclesDB.emoteTargets["${key}"].${token}`;

test('roster helpers read rank by short name and fail closed',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Boss-Draenor")'),0);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("boss")'),0);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Alice")'),3);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Nobody")'),null);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Boss")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Alice")'),false);
  assert.equal(h.get('MAMChronicles.Comms:IsAwarder("Boss")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsAwarder("Officer")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsAwarder("Alice")'),false);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildmate("Alice")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildmate("Nobody")'),false);
  h.run('__roster={}');
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Boss")'),false);
});

test('an emote at a guildmate records their name and still counts the emote',()=>{
  const h=setup();
  h.run('__emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),1);
  h.run('__emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),2);
});

test('a double-fired emote is counted once',()=>{
  const h=setup();
  h.run('MAMChronicles.Counters:OnEmote("WAVE","target"); MAMChronicles.Counters:OnEmote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),1);
});

test('non-guild players, NPCs, yourself and empty targets are not recorded but the emote still counts',()=>{
  const h=setup();
  h.run('__units.target={name="Zed",guild="Other",player=true}; __emote("WAVE","target")');
  h.run('__units.target={name="Guard",guild="Moms",player=false}; __emote("WAVE","target")');
  h.run('__units.target={name="Mumtest",guild="Moms",player=true}; __emote("WAVE","target")');
  h.run('__units.target=nil; __emote("WAVE")');
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),4);
  assert.equal(h.get(`MAMChroniclesDB.emoteTargets["${key}"]`),null);
});

test('an emote aimed at a character name is recorded only when they are on the guild roster',()=>{
  const h=setup();
  h.run('__units.target=nil; __emote("WAVE","Alice"); __emote("WAVE","Nobody")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
});

test('the DoEmote hook passes the target through and SPIT is tracked',()=>{
  const h=setup();
  h.run('__t=__t+1; __hooks.DoEmote("SPIT","target")');
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_spit`),1);
  assert.equal(h.get(targets('SPIT')+'.names.alice'),1);
});

test('the per-emote name list stops growing at 1000 names',()=>{
  const h=setup();
  h.run(`MAMChroniclesDB.emoteTargets={["${key}"]={WAVE={distinct=1000,names={}}}}`);
  h.run('__units.target={name="Newbie",guild="Moms",player=true}; __emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1000);
  assert.equal(h.get(targets('WAVE')+'.names.newbie'),null);
});

test('emote targets are cleared with the Chronicle and always a table',()=>{
  const h=setup();
  h.run('__emote("WAVE","target"); MAMChronicles.Database:ClearHistory()');
  assert.equal(h.get('type(MAMChroniclesDB.emoteTargets)'),'table');
  assert.equal(h.get('next(MAMChroniclesDB.emoteTargets)'),null);
});

const visit=(names,token)=>`for _,n in ipairs({${names.map(n=>`"${n}"`).join(',')}}) do __units.target={name=n,guild="Moms",player=true}; __emote("${token}","target") end`;

test('waving at different guildies climbs the variety medal and repeats do not',()=>{
  const h=setup();
  h.run(visit(['Alice','Bea','Cat','Dee','Eve'],'WAVE')+'; __emote("WAVE","target"); MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),5);
  assert.ok(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_1`));
  assert.equal(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_2`),null);
});

test('the same person waved at fifteen times gives no second tier',()=>{
  const h=setup();
  h.run('for i=1,15 do __emote("WAVE","target") end; MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_1`),null);
});

test('a named medal counts emotes at that character only, ignoring case',()=>{
  const h=setup();
  h.run('__units.target={name="Hopeless",guild="Moms",player=true}; for i=1,10 do __emote("SPIT","target") end; __units.target={name="Alice",guild="Moms",player=true}; for i=1,50 do __emote("SPIT","target") end; MAMChronicles.Medals:Evaluate("t")');
  const earned=(id)=>h.get(`MAMChroniclesDB.medals["${key}"].earned.${id}`);
  assert.ok(earned('hopeless_spit_1')); assert.ok(earned('hopeless_spit_2')); assert.equal(earned('hopeless_spit_3'),null);
});

test('variety and named medals sit in the guild category and explain how they are tracked',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("wave_people_1").category'),'guild');
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("hopeless_spit_1").category'),'guild');
  assert.match(h.get('MAMChronicles.Medals:GetDefinition("wave_people_1").tracking'),/guildmates/);
  assert.match(h.get('MAMChronicles.Medals:GetDefinition("hopeless_spit_1").description'),/Spit at Hopeless/);
});

const earnedRow=(id)=>`MAMChroniclesDB.medals["${key}"].earned.${id}`;

test('a verified medal exists, is never earned by play and lists as locked',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("selfie_squad").verified'),true);
  h.run('MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:SetMedalFilter("Locked"); MAMChronicles.UI:SetMedalSearch("selfie squad"); __row=MAMChronicles.UI.medalRows[1]');
  assert.match(h.get('__row.progress.text'),/See Guild Lead to unlock \/ award points!/);
  assert.equal(h.get('__row.points.text'),'Guild Lead');
});

test('a verified medal cannot be pinned as a goal',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:SetPinned("selfie_squad",true)'),false);
});

test('a real grant pays Mom Money once, a test grant pays nothing',()=>{
  const h=setup();
  h.run('__before=MAMChronicles.Medals:GetEarnedMoney()');
  assert.equal(h.get('MAMChronicles.Medals:GrantVerified("selfie_squad")'),true);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before')+25);
  assert.equal(h.get('MAMChronicles.Medals:GrantVerified("selfie_squad")'),false);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before')+25);
  const t=setup();
  t.run('__before=MAMChronicles.Medals:GetEarnedMoney()');
  assert.equal(t.get('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true})'),true);
  assert.equal(t.get(earnedRow('selfie_squad')+'.test'),true);
  assert.equal(t.get('MAMChronicles.Medals:GetEarnedMoney()'),t.get('__before'));
});

test('only verified medals can be granted and unknown ones are refused',()=>{
  const h=setup();
  assert.equal(h.get('select(1,MAMChronicles.Medals:GrantVerified("wine_1"))'),false);
  assert.equal(h.get('select(2,MAMChronicles.Medals:GrantVerified("nope"))'),'unknown');
  assert.equal(h.get(earnedRow('wine_1')),null);
});

test('revoke removes a verified award and its Mom Money, and clearing removes only test grants',()=>{
  const h=setup();
  h.run('__before=MAMChronicles.Medals:GetEarnedMoney(); MAMChronicles.Medals:GrantVerified("selfie_squad")');
  assert.equal(h.get('MAMChronicles.Medals:RevokeVerified("selfie_squad")'),true);
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before'));
  assert.equal(h.get('select(2,MAMChronicles.Medals:RevokeVerified("selfie_squad"))'),'not earned');
  h.run('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true}); __n=MAMChronicles.Medals:ClearTestGrants()');
  assert.equal(h.get('__n'),1); assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('a real grant toasts and announces to the guild, a test grant stays quiet',()=>{
  const h=setup();
  h.run('MAMChronicles.Medals:GrantVerified("selfie_squad")');
  assert.equal(h.get('__sent[1][2]'),'M1|selfie_squad|25|1');
  const t=setup(); t.run('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true})');
  assert.equal(t.get('#__sent'),0);
});

const msg=(h,text,channel,sender)=>h.fire('CHAT_MSG_ADDON','MAMCHR',text,channel,sender);

test('an award from rank 1 over the guild channel is granted too',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Officer-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
});

test('an award from the Guild Master over the guild channel is granted',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),null);
  assert.equal(h.get('MAMChronicles.Comms.status.awards'),1);
});

test('awards from anyone below rank 1 are refused and counted',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Stranger-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get('MAMChronicles.Comms.status.unverified'),2);
});

test('an empty roster fails closed',()=>{
  const h=setup(); h.run('__roster={}');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('awards for someone else, unknown or unverified medals, bad versions and wrong channels are ignored',()=>{
  const h=setup();
  msg(h,'A1|Someone|selfie_squad|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|nope|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|wine_1|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|9','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','SAY','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1|extra','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get(earnedRow('wine_1')),null);
});

test('with test mode on a whispered award is accepted as a test grant, otherwise not',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
});

test('test mode does not let a non-lead guild message through',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('an award addressed to Name-Realm reaches the recipient',()=>{
  const h=setup();
  msg(h,'A1|Mumtest-Draenor|selfie_squad|1','GUILD','Boss-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
});

test('a whispered revoke in test mode leaves a real grant alone',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  const money=h.get('MAMChronicles.Medals:GetEarnedMoney()');
  msg(h,'R1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),money);
});

test('a whispered revoke in test mode removes a test grant',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
  msg(h,'R1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('a local test-mode revoke removes a test grant but not a real one',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("R1","Mumtest","selfie_squad")'),true);
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.equal(h.get('select(1,MAMChronicles.Comms:SendAward("R1","Mumtest","selfie_squad"))'),false);
  assert.ok(h.get(earnedRow('selfie_squad')));
});

test('a revoke from rank 0 or 1 removes the award',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  msg(h,'R1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
  msg(h,'R1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('existing medal announcements still work next to awards',()=>{
  const h=setup();
  msg(h,'M1|quest_machine_2|25|1','GUILD','Alice-Draenor');
  assert.equal(h.get('MAMChronicles.Comms.status.received'),1);
});

test('only rank 0 or 1 can send an award, as one guild message',()=>{
  const h=setup();
  let r=h.get('select(2,MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad"))');
  assert.match(r,/Guild Master/); assert.equal(h.get('#__sent'),0);
  h.run('__roster[1][3]=1');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad")'),true);
  assert.equal(h.get('__sent[1][2]'),'A1|Alice|selfie_squad|1'); assert.equal(h.get('__sent[1][3]'),'GUILD');
  assert.equal(h.get('select(1,MAMChronicles.Comms:SendAward("A1","Alice","wine_1"))'),false);
  assert.equal(h.get('#__sent'),1);
});

test('in test mode an award is whispered, or applied locally when aimed at yourself',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad")'),true);
  assert.equal(h.get('__sent[1][3]'),'WHISPER'); assert.equal(h.get('__sent[1][4]'),'Alice');
  h.run('__sent={}');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Mumtest","selfie_squad")'),true);
  assert.equal(h.get('#__sent'),0);
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
});

test('a test grant does not block a later real grant, and a test grant never overwrites a real one',()=>{
  const h=setup();
  h.run('__before=MAMChronicles.Medals:GetEarnedMoney(); MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true})');
  assert.equal(h.get('select(1,MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true}))'),false);
  assert.equal(h.get('MAMChronicles.Medals:GrantVerified("selfie_squad")'),true);
  assert.ok(h.get(earnedRow('selfie_squad')));
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),null);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before')+h.get('MAMChronicles.Medals:GetDefinition("selfie_squad").points'));
});

test('a test grant after a real grant is refused',()=>{
  const h=setup();
  h.run('MAMChronicles.Medals:GrantVerified("selfie_squad")');
  assert.equal(h.get('select(1,MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true}))'),false);
  assert.equal(h.get('select(2,MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true}))'),'already');
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),null);
});
