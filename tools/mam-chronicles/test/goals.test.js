import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(saved){const h=createHarness({savedVariables:saved});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
test('pinned medal settings are normalised',()=>{
  const h=setup({schemaVersion:1,settings:{pinnedMedals:['wine_1','wine_1',5,'ale_1','coffee_1','food_1','cheese_1','cookie_1','pie_1']}});
  assert.equal(h.get('#MAMChroniclesDB.settings.pinnedMedals'),6); assert.equal(h.get('MAMChroniclesDB.settings.pinnedMedals[1]'),'wine_1'); assert.equal(h.get('MAMChroniclesDB.settings.pinnedMedals[2]'),'ale_1');
});
test('junk pinned settings become an empty list',()=>{
  const h=setup({schemaVersion:1,settings:{pinnedMedals:'nope'}}); assert.equal(h.get('#MAMChroniclesDB.settings.pinnedMedals'),0);
});
test('medals can be pinned up to six and unpinned',()=>{
  const h=setup();
  h.run('local M=MAMChronicles.Medals; __a=M:SetPinned("wine_1",true); __b=M:SetPinned("ale_1",true); __c=M:SetPinned("coffee_1",true); __d=M:SetPinned("food_1",true); M:SetPinned("cheese_1",true); M:SetPinned("cookie_1",true); __g=M:SetPinned("pie_1",true); __n=#MAMChroniclesDB.settings.pinnedMedals; M:SetPinned("ale_1",false); __m=#MAMChroniclesDB.settings.pinnedMedals');
  assert.equal(h.get('__a'),true); assert.equal(h.get('__c'),true); assert.equal(h.get('__d'),true); assert.equal(h.get('__g'),false); assert.equal(h.get('__n'),6); assert.equal(h.get('__m'),5);
});
test('unknown, unavailable and earned medals cannot be pinned',()=>{
  const h=setup(); h.run('local M=MAMChronicles.Medals; __u=M:SetPinned("no_such",true); __e=M:SetPinned("fresh_start",true)');
  h.run('MAMChronicles.EventStore:Append("memory.manual",{text="x"}); __e2=MAMChronicles.Medals:SetPinned("fresh_start",true)');
  assert.equal(h.get('__u'),false); assert.equal(h.get('__e2'),false);
});
test('goals list progress and drop medals once earned',()=>{
  const h=setup(); h.run('local M=MAMChronicles.Medals; M:SetPinned("memory_keeper_1",true); M:SetPinned("wine_1",true); __g=M:GetGoals(); __n=#__g; __name=__g[1].def.name');
  assert.equal(h.get('__n'),2);
  h.run('MAMChronicles.EventStore:Append("memory.manual",{text="pin me"}); __g2=MAMChronicles.Medals:GetGoals(); __n2=#__g2; __left=MAMChroniclesDB.settings.pinnedMedals[1]');
  assert.equal(h.get('__n2'),1); assert.equal(h.get('__left'),'wine_1');
});
test('Home shows goals and a hint when none are pinned',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Show()'); assert.match(h.get('MAMChronicles.Dashboard.monthBody.text'),/Pin up to 6 medals/);
  h.run('MAMChronicles.Medals:SetPinned("wine_1",true); MAMChronicles.Dashboard:Refresh()'); const t=h.get('MAMChronicles.Dashboard.monthBody.text'); assert.match(t,/Goal/); assert.match(t,/Wine O'Clock I/); assert.match(t,/0 \/ 1/);
});
test('clicking a medal row pins it, shows GOAL and clicking again unpins',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI:SetMedalFilter("Locked"); UI:SetMedalSearch("Wine O"); local row=UI.medalRows[1]; __name=row.name.text; row.scripts.OnMouseUp(row,"LeftButton"); __pinned=MAMChroniclesDB.settings.pinnedMedals[1]; __tag=UI.medalRows[1].goalTag.shown');
  assert.match(h.get('__name'),/Wine/); assert.equal(h.get('__tag'),true); assert.ok(h.get('__pinned'));
  h.run('local row=MAMChronicles.UI.medalRows[1]; row.scripts.OnMouseUp(row,"LeftButton"); __after=#MAMChroniclesDB.settings.pinnedMedals; __tag=MAMChronicles.UI.medalRows[1].goalTag.shown');
  assert.equal(h.get('__after'),0); assert.equal(h.get('__tag'),false);
});
test('a seventh pin tells the player the limit',()=>{
  const h=setup(); h.run('local M=MAMChronicles.Medals; M:SetPinned("wine_1",true); M:SetPinned("ale_1",true); M:SetPinned("coffee_1",true); M:SetPinned("food_1",true); M:SetPinned("cheese_1",true); M:SetPinned("cookie_1",true); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI:SetMedalSearch("Pie"); local row=UI.medalRows[1]; row.scripts.OnMouseUp(row,"LeftButton")');
  assert.ok(h.calls.printed.some(m=>/6 goals/i.test(m))); assert.equal(h.get('#MAMChroniclesDB.settings.pinnedMedals'),6);
});
test('the tooltip explains how to pin',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI:SetMedalFilter("Locked"); local row=UI.medalRows[1]; row.scripts.OnEnter(row); __t=table.concat(GameTooltip.lines," | ")');
  assert.match(h.get('__t'),/Click to pin as a goal/);
});
