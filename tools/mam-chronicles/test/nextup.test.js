import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals")');return h;}
test('every medal belongs to a family and tiers of one series share it',()=>{
  const h=setup(); h.run('__bad=0; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do if type(d.family)~="string" then __bad=__bad+1 end end; __a=MAMChronicles.Medals:GetDefinition("wine_1").family; __b=MAMChronicles.Medals:GetDefinition("wine_4").family; __c=MAMChronicles.Medals:GetDefinition("fresh_start").family');
  assert.equal(h.get('__bad'),0); assert.equal(h.get('__a'),'wine'); assert.equal(h.get('__b'),'wine'); assert.equal(h.get('__c'),'fresh_start');
});
test('Next up is the fifth filter',()=>{
  const h=setup(); assert.equal(h.get('MAMChronicles.UI.medalFilters[5]'),'Next up'); assert.equal(h.get('#MAMChronicles.UI.medalFilterButtons'),5);
});
test('Next up lists one unearned medal per family',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("Next up"); __n=#UI.medalList; local seen,dup,earned={},0,0; for _,m in ipairs(UI.medalList) do if seen[m.def.family] then dup=dup+1 end seen[m.def.family]=true; if m.earned then earned=earned+1 end end; __dup=dup; __earned=earned; local all=0; local fam={}; for _,m in ipairs(MAMChronicles.Medals:GetProgress()) do if not m.earned and not fam[m.def.family] then fam[m.def.family]=true; all=all+1 end end; __expect=all');
  assert.equal(h.get('__dup'),0); assert.equal(h.get('__earned'),0); assert.equal(h.get('__n'),h.get('__expect')); assert.ok(h.get('__n')>30);
});
test('earning a tier moves the family on to its next tier',()=>{
  const h=setup();
  h.run('MAMChronicles.EventStore:Append("memory.manual",{text="one"}); local UI=MAMChronicles.UI; UI:SetMedalFilter("Next up"); UI:SetMedalSearch("Memory Keeper"); __names=""; for _,m in ipairs(UI.medalList) do __names=__names..m.def.id.." " end');
  assert.match(h.get('__names'),/memory_keeper_2/); assert.ok(!/memory_keeper_1/.test(h.get('__names'))); assert.ok(!/memory_keeper_3/.test(h.get('__names')));
});
test('the Next up button shows its count and is highlighted when chosen',()=>{
  const h=setup(); h.run('MAMChronicles.UI:SetMedalFilter("Next up")');
  assert.match(h.get('MAMChronicles.UI.medalFilterButtons[5].text'),/^Next up \(\d+\)$/); assert.equal(h.get('MAMChronicles.UI.medalFilterButtons[5].highlighted'),true); assert.equal(h.get('MAMChronicles.UI.medalFilterButtons[1].highlighted'),false);
});
test('the filter buttons fit in the narrowest window',()=>{
  const h=setup(); h.run('__w=0; for _,b in ipairs(MAMChronicles.UI.medalFilterButtons) do __w=__w+b.width+6 end');
  assert.ok(h.get('__w')<=560,`buttons need ${h.get('__w')}px`);
});
