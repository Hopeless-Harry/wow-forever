import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files = ['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Tutorial.lua','Launcher.lua','SettingsPanel.lua'];
function setup() {
  const h = createHarness(); h.load(files.slice(0, 1));
  h.run('__t=1790704800; function IsInGuild() return true end function UnitLevel() return 90 end function UnitClass() return "Priest","PRIEST",5 end');
  h.load(files.slice(1)); h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")'); return h;
}
const plain = (text) => String(text).replace(/\|c\w{8}|\|r/g, '');
const NL = 'string.char(10)', DOT = 'string.char(194,183)';

test('Statistics shows one statistic per line with a blank line before each heading', () => {
  const h = setup();
  h.run(`UI=MAMChronicles.UI; local nl,dot=${NL},${DOT}; __o=UI:ColouriseStatistics("Hall of Fame"..nl.."  Busiest day: today"..nl.."Quests"..nl.."  Quests completed 2,629  "..dot.."  Quests abandoned 436  "..dot.."  Daily quests 64")`);
  const lines = plain(h.get('__o')).split('\n');
  assert.ok(lines.some(l => /Quests completed/.test(l) && !/Quests abandoned/.test(l)));
  assert.ok(lines.some(l => /Quests abandoned/.test(l) && !/Daily quests/.test(l)));
  assert.ok(lines.some(l => /Daily quests/.test(l)));
  const headingAt = lines.findIndex(l => l === 'Quests');
  assert.ok(headingAt > 0 && lines[headingAt - 1] === '');
});

test('Characters puts a blank line between characters', () => {
  const h = setup();
  h.run(`UI=MAMChronicles.UI; local nl=${NL}; __o=UI:ColouriseCharacters("Characters on this account (2)"..nl.."Alpha - Realm  (this character)"..nl.."  Level 90 Rogue"..nl.."Beta - Realm"..nl.."  Level 10 Mage"..nl.."  Last played yesterday")`);
  assert.match(plain(h.get('__o')), /Level 90 Rogue\n\nBeta - Realm/);
});

test('the Home month card is split into labelled sections with spacing between them', () => {
  const h = setup();
  h.run('MAMChronicles.Medals:SetPinned("wine_1",true); UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Home"); MAMChronicles.Dashboard:Refresh(); __b=MAMChronicles.Dashboard.monthBody.text');
  const body = plain(h.get('__b'));
  assert.match(body, /This month +\d+ events in \d+ sessions/); assert.match(body, /Deaths \d+ +Quests \d+ +Discoveries \d+ +Loot \d+/);
  assert.match(body, /\n\nGoals\n +Wine O'Clock I +0 \/ 1/); assert.match(body, /Mom Money \d+ +\d+ of \d+ medals/);
  assert.ok((body.match(/\n\n/g) || []).length >= 3);
});

test('the tutorial sits beside the window, never over the action bars, and uses larger text', () => {
  const h = setup();
  h.run('UI=MAMChronicles.UI; UI:Show(); T=MAMChronicles.Tutorial; UIParent.GetWidth=function() return 1920 end; UI.frame.GetRight=function() return 1000 end; UI.frame.GetLeft=function() return 100 end; T:Open(1); __p=T.frame.point; __w=T.frame:GetWidth(); __h=T.frame:GetHeight(); __head=T.frame.heading.text');
  assert.equal(h.get('__p[1]'), 'TOPLEFT'); assert.equal(h.get('__p[3]'), 'TOPRIGHT'); assert.ok(h.get('__w') >= 500); assert.ok(h.get('__h') >= 300); assert.equal(h.get('__head'), 'Welcome to Chronicles');
  h.run('UI.frame.GetRight=function() return 1900 end; UI.frame.GetLeft=function() return 700 end; T:Go(1); __q=T.frame.point'); assert.equal(h.get('__q[1]'), 'TOPRIGHT'); assert.equal(h.get('__q[3]'), 'TOPLEFT');
  h.run('UI.frame.GetLeft=function() return 10 end; T:Go(1); __r=T.frame.point'); assert.equal(h.get('__r[1]'), 'TOP'); assert.equal(h.get('__r[3]'), 'BOTTOM');
});

test('a discovery shows its subzone so two places in one zone do not look like a repeat', () => {
  const h = setup();
  h.run('UI=MAMChronicles.UI; __a=UI.EventLabel({type="world.zone_discovered",payload={zone="Dalaran",subzone="Krasus Landing"}}); __b=UI.EventLabel({type="world.zone_discovered",payload={zone="Dalaran"}}); __c=UI.EventLabel({type="world.zone_discovered",payload={subzone="The Mill"}}); __d=UI.EventLabel({type="world.zone_discovered",payload={zone="Dalaran",subzone="Dalaran"}})');
  assert.equal(h.get('__a'), 'Dalaran: Krasus Landing'); assert.equal(h.get('__b'), 'Dalaran'); assert.equal(h.get('__c'), 'The Mill'); assert.equal(h.get('__d'), 'Dalaran');
});

test('a Medals search is cleared when you leave the tab', () => {
  const h = setup();
  h.run('UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI.medalSearchBox:SetText("guild"); UI:SetMedalSearch("guild"); __a=UI.medalSearch; UI:SetActiveTab("Home"); __b=UI.medalSearch; __box=UI.medalSearchBox:GetText(); UI:SetActiveTab("Medals"); __all=#UI.medalList');
  assert.equal(h.get('__a'), 'guild'); assert.equal(h.get('__b'), ''); assert.equal(h.get('__box'), ''); assert.ok(h.get('__all') > 21);
});

test('hub owner settings stay hidden outside a guild even if the gateway switch was left on', () => {
  const h = setup();
  h.run('function IsInGuild() return false end; MAMChroniclesDB.settings.gatewayMode=true; UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __a=UI.settingChecks.gatewayMode~=nil');
  assert.equal(h.get('__a'), false);
  const g = setup();
  g.run('MAMChroniclesDB.settings.gatewayMode=true; UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __a=UI.settingChecks.gatewayMode~=nil');
  assert.equal(g.get('__a'), true);
});

test('the More menu opens beside its tab so it does not cover the page toolbar', () => {
  const h = setup();
  h.run('UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Chronicle"); UI:OpenMoreMenu(); __p=UI.menu.point; __rel=UI.moreButton');
  assert.equal(h.get('__p[1]'), 'TOPLEFT'); assert.equal(h.get('__p[3]'), 'TOPRIGHT');
  h.run('UI:OpenFilterMenu(UI.filterButton); __f=UI.menu.point'); assert.equal(h.get('__f[3]'), 'BOTTOMLEFT');
});
