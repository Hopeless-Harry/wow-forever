import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files = ['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const NOW = 1790704800;
function setup(pre = '', saved) {
  const h = createHarness({ savedVariables: saved }); h.load(files.slice(0, 1));
  h.run(`__t=${NOW}; __wp={}; __cleared=0; __taxi=false; __dead=false; __falling=false
function IsInGuild() return true end
function UnitLevel() return 90 end
function UnitClass() return "Priest","PRIEST",5 end
function GetTime() return __t end
C_Map={GetBestMapForUnit=function() return 2022 end,GetPlayerMapPosition=function() return {GetXY=function() return 0.5,0.3 end} end,GetMapInfo=function(id) return {name="Zone "..id} end,
  SetUserWaypoint=function(p) table.insert(__wp,p) end,ClearUserWaypoint=function() __cleared=__cleared+1 end}
UiMapPoint={CreateFromCoordinates=function(m,x,y) return {m=m,x=x,y=y} end}
${pre}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChronicles.Now=function() return __t end'); return h;
}

test('follow mode moves the waypoint each time the guildmate reports a new position, until stopped', () => {
  const h = setup();
  h.run('local M=MAMChronicles.Map; M:OnMessage("Alice-Draenor","L1|1|250|750|42|8|1"); __ok=M:Follow("alice"); __n1=#__wp; __t=__t+30; MAMChronicles.Now=function() return __t end; M:OnMessage("Alice-Draenor","L1|1|300|700|42|8|1"); __n2=#__wp; __lastx=__wp[#__wp].x');
  assert.equal(h.get('__ok'), true); assert.equal(h.get('__n1'), 1); assert.equal(h.get('__n2'), 2); assert.equal(h.get('__lastx'), 0.3);
  h.run('__stopped=MAMChronicles.Map:StopFollow(); __t=__t+30; MAMChronicles.Now=function() return __t end; MAMChronicles.Map:OnMessage("Alice-Draenor","L1|1|400|700|42|8|1"); __n3=#__wp');
  assert.equal(h.get('__stopped'), true); assert.equal(h.get('__n3'), 2); assert.equal(h.get('__cleared'), 1);
});

test('following someone who is not sharing fails cleanly and /mam map follow reports it', () => {
  const h = setup();
  h.run('__ok=MAMChronicles.Map:Follow("Nobody")'); assert.equal(h.get('__ok'), false);
  h.slash('map follow Nobody'); assert.ok(h.calls.printed.join('\n').includes('No shared location for Nobody'));
});

test('settings migrations run once and keep a later Midnight choice', () => {
  const old = setup('', { schemaVersion: 1, settings: { theme: 'midnight' } });
  assert.equal(old.get('MAMChroniclesDB.settings.theme'), 'modern'); assert.equal(old.get('MAMChroniclesDB.settings.settingsVersion'), 1);
  const chosen = setup('', { schemaVersion: 1, settings: { theme: 'midnight', settingsVersion: 1 } });
  assert.equal(chosen.get('MAMChroniclesDB.settings.theme'), 'midnight');
  const legacy = setup('', { schemaVersion: 1, settings: { theme: 'midnight', themeMigrated: true } });
  assert.equal(legacy.get('MAMChroniclesDB.settings.theme'), 'midnight');
});

test('a LibDataBroker launcher object is registered when the library exists and nothing breaks without it', () => {
  const h = setup('__ldb={}; LibStub=function(name) if name=="LibDataBroker-1.1" then return {NewDataObject=function(_,n,o) __ldb[n]=o return o end} end end');
  assert.equal(h.get('MAMChronicles.Launcher.broker.type'), 'launcher');
  h.run('__ldb.MAMChronicles.OnClick(nil,"LeftButton"); __shown=MAMChronicles.UI.frame and MAMChronicles.UI.frame.shown'); assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
  const plain = setup(); assert.equal(plain.get('MAMChronicles.Launcher.broker'), null);
});

test('leaving a dungeon gives one wrap-up toast of what was recorded inside', () => {
  const h = setup('__inst=true; function IsInInstance() return __inst,"party" end; function GetInstanceInfo() return "Test Crypt",nil,1,nil,nil,nil,nil,77 end');
  h.fire('PLAYER_ENTERING_WORLD');
  h.run('MAMChronicles.EventStore:Append("character.death",{zone="Z"}); MAMChronicles.EventStore:Append("quest.completed",{questID=5,questName="Q"}); MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; __inst=false');
  h.fire('PLAYER_ENTERING_WORLD');
  h.run('__title=MAMChronicles.Toast.title and MAMChronicles.Toast.title.text or (MAMChronicles.Toast.queue[1] and MAMChronicles.Toast.queue[1].title)');
  assert.match(h.get('__title'), /Out of Test Crypt/);
});

test('an empty dungeon visit gives no wrap-up toast', () => {
  const h = setup('__inst=true; function IsInInstance() return __inst,"party" end; function GetInstanceInfo() return "Quiet Cave",nil,1,nil,nil,nil,nil,78 end');
  h.fire('PLAYER_ENTERING_WORLD');
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; __inst=false'); h.fire('PLAYER_ENTERING_WORLD');
  assert.equal(h.get('#MAMChronicles.Toast.queue'), 0);
});

test('the ground check does nothing while dead or on a taxi and does not read the landing as a jump', () => {
  const h = setup('function IsFalling() return __falling end function UnitIsDeadOrGhost() return __dead end function UnitOnTaxi() return __taxi end');
  h.run('local C=MAMChronicles.Counters; __dead=true; __falling=true; C:CheckGround(); __j1=(MAMChroniclesDB.counters[MAMChronicles.characterKey] or {}).jumps or 0');
  assert.equal(h.get('__j1'), 0);
  h.run('__dead=false; MAMChronicles.Counters:CheckGround(); __j2=(MAMChroniclesDB.counters[MAMChronicles.characterKey] or {}).jumps or 0');
  assert.equal(h.get('__j2'), 1);
});

test('diagnostics report how many guild announcements are queued', () => {
  const h = setup(); h.run('__d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.match(h.get('__d'), /queued 0/);
});

test('a dragged tracker keeps both anchor points and is restored where it was dropped', () => {
  const h = setup();
  h.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Medals:SetPinned("wine_1",true); local T=MAMChronicles.Tracker; T:Refresh(); T.frame:SetPoint("TOPLEFT",UIParent,"BOTTOMLEFT",900,700); T.frame.scripts.OnDragStop(T.frame); __s=MAMChroniclesDB.settings.tracker');
  assert.equal(h.get('__s.point'), 'TOPLEFT'); assert.equal(h.get('__s.relPoint'), 'BOTTOMLEFT'); assert.equal(h.get('__s.x'), 900); assert.equal(h.get('__s.y'), 700);
  const g = setup('', { schemaVersion: 1, settings: { tracker: { point: 'TOPLEFT', relPoint: 'BOTTOMLEFT', x: 900, y: 700 } } });
  g.run('MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Tracker:Refresh(); __pt=MAMChronicles.Tracker.frame.point');
  assert.equal(g.get('__pt[1]'), 'TOPLEFT'); assert.equal(g.get('__pt[3]'), 'BOTTOMLEFT');
});

test('the tracker does not read goals or quests, or prune pins, before the medal baseline exists', () => {
  const h = createHarness({ savedVariables: { schemaVersion: 1, settings: { pinnedMedals: ['wine_1', 'gone_medal'] } } });
  h.load(files.slice(0, 1)); h.run('function UnitLevel() return 90 end'); h.load(files.slice(1));
  h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats.status={state="pending"}; MAMChroniclesDB.medals={}; MAMChroniclesDB.challenges={}; __n=#MAMChronicles.Tracker:Build(); __pins=#MAMChroniclesDB.settings.pinnedMedals; __c=next(MAMChroniclesDB.challenges)');
  assert.equal(h.get('__n'), 0); assert.equal(h.get('__pins'), 2); assert.equal(h.get('__c'), null);
});

// ---- professional-polish pass
import { readFileSync } from 'node:fs';
import { addonPath } from './harness.js';
const ready = 'MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t");';

test('window size has a safe default, is clamped and rounded, and is applied to the window', () => {
  const h = setup('', { schemaVersion: 1, settings: { windowScale: 9 } });
  assert.equal(h.get('MAMChroniclesDB.settings.windowScale'), 1.3);
  assert.equal(setup('', { schemaVersion: 1, settings: { windowScale: 'x' } }).get('MAMChroniclesDB.settings.windowScale'), 1);
  const g = setup();
  g.run('local UI=MAMChronicles.UI; UI:Create(); UI.frame.SetScale=function(f,v) f.scale=v end; UI:SetSetting("windowScale",0.93); __a=MAMChroniclesDB.settings.windowScale; __s=UI.frame.scale; UI:SetSetting("windowScale",0.1); __b=MAMChroniclesDB.settings.windowScale');
  assert.equal(g.get('__a'), 0.95); assert.equal(g.get('__s'), 0.95); assert.equal(g.get('__b'), 0.7);
});

test('Settings has a window size slider and a reset button that restores size and position', () => {
  const h = setup();
  h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __has=UI.scaleSlider~=nil and UI.resetWindowButton~=nil; UI:SetSetting("windowScale",1.2); UI.resetWindowButton.scripts.OnClick(UI.resetWindowButton); __after=MAMChroniclesDB.settings.windowScale');
  assert.equal(h.get('__has'), true); assert.equal(h.get('__after'), 1);
});

test('the minimap tooltip shows Mom Money, medals, quests and the next goal', () => {
  const h = setup();
  h.run(ready + ' MAMChronicles.Medals:SetPinned("wine_1",true); local L=MAMChronicles.Launcher; L:Create(); L:ShowTooltip(L.button); __t=table.concat(GameTooltip.lines," | ")');
  const text = h.get('__t');
  assert.match(text, /Moms Against Magic Chronicles/); assert.match(text, /Mom Money: \d+/); assert.match(text, /Medals: \d+ of \d+/); assert.match(text, /Goal: Wine/); assert.match(text, /Mom Quests this week: \d \/ 3/); assert.match(text, /Left-click/);
});

test('the tooltip still works before medals are ready and never errors', () => {
  const h = setup('', { schemaVersion: 1, settings: {} });
  h.run('MAMChroniclesDB.medals={}; local L=MAMChronicles.Launcher; L:Create(); L:ShowTooltip(L.button); __t=table.concat(GameTooltip.lines," | ")');
  assert.match(h.get('__t'), /Left-click/); assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
});

test('a key binding toggles the Chronicle and is listed in the Key Bindings screen', () => {
  const xml = readFileSync(addonPath('Bindings.xml'), 'utf8');
  assert.match(xml, /name="MAMCHRONICLES_TOGGLE"/); assert.match(xml, /MAMChronicles\.UI:Toggle\(\)/);
  const h = setup();
  assert.equal(h.get('BINDING_NAME_MAMCHRONICLES_TOGGLE'), 'Open or close the Chronicle'); assert.equal(h.get('BINDING_HEADER_MAMCHRONICLES'), 'Moms Against Magic Chronicles');
});

test('/chronicle is an alias for /mam', () => {
  const h = setup(); assert.equal(h.get('SLASH_MAMCHRONICLES1'), '/mam'); assert.equal(h.get('SLASH_MAMCHRONICLES2'), '/chronicle');
});

test('right-clicking a tracker goal unpins it and right-clicking a guildmate unpins them', () => {
  const h = setup();
  h.run(ready + ' MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Map:OnMessage("Alice-Draenor","L1|1|250|750|42|8|1"); MAMChronicles.Map:SetPinned("Alice",true); local T=MAMChronicles.Tracker; T:Refresh(); __kinds=T.rows[1].kind..","..T.rows[#T:Build()].kind');
  assert.match(h.get('__kinds'), /goal,player/);
  h.run('local T=MAMChronicles.Tracker; T.rows[1].scripts.OnClick(T.rows[1],"RightButton"); __goal=MAMChronicles.Medals:IsPinned("wine_1")');
  assert.equal(h.get('__goal'), false);
  h.run('local T=MAMChronicles.Tracker; for _,r in ipairs(T.rows) do if r.kind=="player" and r:IsShown() then r.scripts.OnClick(r,"RightButton") break end end; __p=MAMChronicles.Map:IsPinned("Alice")');
  assert.equal(h.get('__p'), false);
});

test('a locked tracker cannot be dragged and unlocking allows it', () => {
  const h = setup();
  h.run(ready + ' MAMChronicles.Medals:SetPinned("wine_1",true); local T=MAMChronicles.Tracker; T:Refresh(); __moved=0; T.frame.StartMoving=function() __moved=__moved+1 end; MAMChronicles.UI:SetSetting("trackerLocked",true); T.frame.scripts.OnDragStart(T.frame); __locked=__moved; MAMChronicles.UI:SetSetting("trackerLocked",false); T.frame.scripts.OnDragStart(T.frame); __open=__moved');
  assert.equal(h.get('__locked'), 0); assert.equal(h.get('__open'), 1);
});

test('shift-clicking an earned medal puts a line about it in the chat box and plain clicks do not', () => {
  const h = setup('__typed=nil; __shift=false; function IsShiftKeyDown() return __shift end function ChatEdit_InsertLink(t) __typed=t return true end');
  h.run(ready + ' local M=MAMChronicles.Medals; local def=M:GetDefinitions()[1]; MAMChroniclesDB.medals[MAMChronicles.characterKey].earned[def.id]={at=1,points=def.points}; __e={def=def,earned=true}; local UI=MAMChronicles.UI; UI:ToggleGoal({entry=__e},"LeftButton"); __plain=__typed; __shift=true; UI:ToggleGoal({entry=__e},"LeftButton"); __linked=__typed');
  assert.equal(h.get('__plain'), null); assert.match(h.get('__linked'), /^I earned the .+ Mom Medal \(\+\d+ Mom Money\)!$/);
});

test('with no chat edit helper the medal line is opened or printed instead of failing', () => {
  const h = setup('function ChatFrame_OpenChat(t) __opened=t end');
  h.run('__ok=MAMChronicles.UI:LinkMedalToChat({def={name="Test",points=5}})'); assert.equal(h.get('__ok'), true); assert.match(h.get('__opened'), /Test Mom Medal/);
});

test('follow mode only forces the arrow on once, and stopping leaves a waypoint the player placed themselves', () => {
  const h = setup('__super=0; __user=nil; C_SuperTrack={SetSuperTrackedUserWaypoint=function() __super=__super+1 end}; C_Map.GetUserWaypoint=function() return __user end; C_Map.SetUserWaypoint=function(p) __user={uiMapID=p.m,position={x=p.x,y=p.y}} table.insert(__wp,p) end');
  h.run('local M=MAMChronicles.Map; M:OnMessage("Alice-Draenor","L1|1|250|750|42|8|1"); M:Follow("Alice"); __t=__t+30; MAMChronicles.Now=function() return __t end; M:OnMessage("Alice-Draenor","L1|1|300|700|42|8|1"); __s=__super');
  assert.equal(h.get('__s'), 1);
  h.run('__user={uiMapID=5,position={x=0.9,y=0.9}}; MAMChronicles.Map:StopFollow()'); assert.equal(h.get('__cleared'), 0);
  h.run('local M=MAMChronicles.Map; __t=__t+30; MAMChronicles.Now=function() return __t end; M:Follow("Alice"); M:StopFollow()'); assert.equal(h.get('__cleared'), 1);
});

test('the settings version never goes down on a downgrade', () => {
  const h = setup('', { schemaVersion: 1, settings: { settingsVersion: 5, theme: 'modern' } });
  assert.equal(h.get('MAMChroniclesDB.settings.settingsVersion'), 5);
});

test('guild medal totals are rate limited per sender', () => {
  const h = setup();
  for (let i = 0; i < 6; i++) h.fire('CHAT_MSG_ADDON', 'MAMCHR', `T1|${i + 1}|10|1`, 'GUILD', 'Spammy-Draenor');
  assert.equal(h.get('MAMChronicles.Comms:GetRoster()[1].count'), 2);
  assert.equal(h.get('MAMChronicles.Comms.status.dropped') >= 4, true);
});

// ---- Plumber-style Settings: category list, search, info pane
const openSettings = 'UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings");';

test('Settings has a category list, a search box and an info pane, and builds without errors', () => {
  const h = setup();
  h.run(openSettings + ' __secs=#UI.settingSections; __nav=#UI.settingsNav; __first=UI.settingSections[1].label; __side=UI.settingsSide.shown; __search=UI.settingsSearch~=nil');
  assert.equal(h.get('__first'), 'Appearance'); assert.equal(h.get('__nav'), h.get('__secs')); assert.ok(h.get('__secs') >= 6);
  assert.equal(h.get('__side'), true); assert.equal(h.get('__search'), true); assert.equal(h.get('MAMChronicles.errorStats.count'), 0);
});

test('the window widens for Settings so the info pane fits and the pane shows', () => {
  const h = setup();
  h.run(openSettings + ' __w=UI.frame:GetWidth(); __info=UI.settingsInfo.shown; __shown=UI.settingsInfoShown');
  assert.ok(h.get('__w') >= 880); assert.equal(h.get('__info'), true); assert.equal(h.get('__shown'), true);
});

test('hovering an option describes it in the info pane instead of a floating tooltip', () => {
  const h = setup();
  h.run(openSettings + ' GameTooltip.lines={}; local box=UI.settingChecks.trackerEnabled; box.scripts.OnEnter(box); __title=UI.settingsInfoTitle.text; __text=UI.settingsInfoText.text; __tip=#GameTooltip.lines');
  assert.equal(h.get('__title'), 'Show the goal tracker window'); assert.match(h.get('__text'), /movable window/); assert.equal(h.get('__tip'), 0);
  h.run('local box=UI.settingChecks.enabled; box.scripts.OnEnter(box); __t2=UI.settingsInfoTitle.text'); assert.equal(h.get('__t2'), 'Record Chronicle');
});

test('choosing a category scrolls to its section and the list highlights the section being read', () => {
  const h = setup();
  h.run(openSettings + ' local n=#UI.settingSections; UI:GoToSettingsSection(n); __off=UI.settingsArea.offset; __y=UI.settingSections[n].y; __cur=UI.settingsNavCurrent; __n=n');
  assert.ok(h.get('__off') >= 0); assert.equal(h.get('__cur'), h.get('__n'));
  h.run('UI:GoToSettingsSection(1); __cur1=UI.settingsNavCurrent'); assert.equal(h.get('__cur1'), 1);
});

test('searching fades non-matching options, keeps matches, and clearing the search restores everything', () => {
  const h = setup();
  h.run(openSettings + ' UI:FilterSettings("lock the tracker"); local locked=UI.settingChecks.trackerLocked; local other=UI.settingChecks.enabled; __a=locked:GetAlpha(); __b=other:GetAlpha(); UI:FilterSettings(""); __c=other:GetAlpha()');
  assert.equal(h.get('__a'), 1); assert.ok(h.get('__b') < 0.5); assert.equal(h.get('__c'), 1);
});

test('search also looks at the help text of an option', () => {
  const h = setup();
  h.run(openSettings + ' UI:FilterSettings("never saved"); __loc=UI.settingChecks.shareLocation:GetAlpha(); __other=UI.settingChecks.recordQuestAccepts:GetAlpha()');
  assert.equal(h.get('__loc'), 1); assert.ok(h.get('__other') < 0.5);
});

test('leaving Settings hides the side panels', () => {
  const h = setup();
  h.run(openSettings + ' UI:SetActiveTab("Home"); __a=UI.settingsSide.shown; __b=UI.settingsInfo.shown');
  assert.equal(h.get('__a'), false); assert.equal(h.get('__b'), false);
});

test('sending mail and opening the bank are counted once per action and feed new medals with titles and a category', () => {
  const h = setup();
  h.fire('MAIL_SEND_SUCCESS'); h.fire('MAIL_SEND_SUCCESS');
  h.run('__t=__t+5; MAMChronicles.Now=function() return __t end; __row=MAMChroniclesDB.counters[MAMChronicles.characterKey]; __mail=__row.mail');
  assert.equal(h.get('__mail'), 1);
  h.fire('BANKFRAME_OPENED'); assert.equal(h.get('MAMChroniclesDB.counters[MAMChronicles.characterKey].bank') ?? h.get('(function() return MAMChroniclesDB.counters[MAMChronicles.characterKey].bank end)()'), 1);
  h.run('local M=MAMChronicles.Medals; __d=M:GetDefinition("mail_1"); __b=M:GetDefinition("bank_3"); __tm=M.titles.mail; __tb=M.titles.bank; __cat=__d.category');
  assert.equal(h.get('__d.target'), 5); assert.equal(h.get('__b.target'), 200); assert.equal(h.get('__tm'), 'Postmaster Mom'); assert.equal(h.get('__cat'), 'habits');
});

// ---- levelling pace
const pacePrep = `local d=MAMChroniclesDB; local k=MAMChronicles.characterKey
d.sessions={{characterKey=k,startedAt=1000,endedAt=4600},{characterKey=k,startedAt=100000,endedAt=107200},{characterKey="other",startedAt=1,endedAt=999999}}
d.events={}
local function up(level,at) table.insert(d.events,{id="e"..level,schemaVersion=1,type="character.level_up",occurredAt=at,observedAt=at,characterKey=k,payload={level=level}}) end
up(10,1000) up(11,2800) up(12,4600) up(13,102800) up(14,107200)
d.characters[k]=d.characters[k] or {}; d.characters[k].level=14`;

test('levelling pace counts only time actually played, not days away', () => {
  const h = setup();
  h.run(pacePrep + '; __p=MAMChronicles.Statistics:BuildLevelPace()');
  assert.equal(h.get('#__p.levels'), 4);
  assert.equal(h.get('__p.levels[1].seconds'), 1800); assert.equal(h.get('__p.levels[2].seconds'), 1800);
  assert.equal(h.get('__p.levels[3].seconds'), 2800);
  assert.equal(h.get('__p.last.level'), 14); assert.equal(h.get('__p.last.seconds'), 4400);
});

test('the pace text shows recent levels, the average and the time left to the cap', () => {
  const h = setup(); h.run(pacePrep + '; __t=MAMChronicles.Statistics:DescribeLevelPace()');
  const text = h.get('__t');
  assert.match(text, /^Levelling pace/); assert.match(text, /Level 14 took 1h 13m of play/); assert.match(text, /Average of the last 4/); assert.match(text, /to reach level \d+ at this pace/);
});

test('no pace is shown before a level has been measured', () => {
  const h = setup(); h.run('__p=MAMChronicles.Statistics:BuildLevelPace(); __t=MAMChronicles.Statistics:DescribeLevelPace()');
  assert.equal(h.get('__p'), null); assert.equal(h.get('__t'), null);
});

test('the Statistics tab includes the pace and the level-up toast says how long the level took', () => {
  const h = setup();
  h.run(pacePrep + '; local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Statistics"); __c=UI.content.text');
  assert.match(h.get('__c'), /Levelling pace/);
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; MAMChronicles.Toast:OnEvent(MAMChroniclesDB.events[5]); local q=MAMChronicles.Toast.queue[1]; __x=(MAMChronicles.Toast.title and MAMChronicles.Toast.title.text or "")..(q and q.text or "")..(MAMChronicles.Toast.body and MAMChronicles.Toast.body.text or "")');
  assert.match(h.get('__x'), /Level 14|took/);
});

test('the window gets its own width back after leaving Settings and a wide Settings width is never saved', () => {
  const h = setup();
  h.run('UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Home"); UI.frame:SetSize(700,560); __before=UI.frame:GetWidth(); UI:SetActiveTab("Settings"); __wide=UI.frame:GetWidth(); UI:SaveWindowState(); __saved=MAMChroniclesDB.settings.ui.width; UI:SetActiveTab("Home"); __after=UI.frame:GetWidth()');
  assert.equal(h.get('__before'), 700); assert.ok(h.get('__wide') >= 880); assert.equal(h.get('__saved'), 700); assert.equal(h.get('__after'), 700);
});

test('/mam mute holds toasts, keeps them, and unmuting or the timer shows them', () => {
  const h = setup('__timers={}; C_Timer={After=function(d,f) table.insert(__timers,f) end}');
  h.slash('mute 10'); assert.ok(h.calls.printed.join('\n').includes('held for 10 minutes'));
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; __r=MAMChronicles.Toast:Show({title="Hello",text="x",kind="info"}); __q=#MAMChronicles.Toast.queue');
  assert.equal(h.get('__r'), 'queued'); assert.equal(h.get('__q'), 1);
  h.slash('unmute'); h.run('__shown=MAMChronicles.Toast.current~=nil'); assert.equal(h.get('__shown'), true);
  h.slash('mute'); assert.ok(h.calls.printed.join('\n').includes('held for 30 minutes'));
});

test('muting is capped and unmuting when not muted says so', () => {
  const h = setup(); h.run('__m=MAMChronicles.Toast:Mute(99999)'); assert.equal(h.get('__m'), 480);
  h.run('MAMChronicles.Toast:Unmute(); MAMChronicles.UI:HandleSlash("unmute")'); assert.ok(h.calls.printed.join('\n').includes('not muted'));
});
