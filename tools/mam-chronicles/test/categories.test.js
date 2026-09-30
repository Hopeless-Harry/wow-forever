import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness, multi } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(globals){const h=createHarness({globals});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals")');return h;}
const forever={GetBuildInfo:()=>multi('1.60.1','70124','Sep 2026',16001)};
const count=(name,n)=>`MAMChronicles.Counters:Add("${name}",${n}); MAMChronicles.Medals:Evaluate("t")`;

test('every medal belongs to a known category and the obvious ones land where expected',()=>{
  const h=setup();
  h.run('__bad=0; local keys={}; for _,c in ipairs(MAMChronicles.Medals.categories) do keys[c.key]=true end; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do if not keys[d.category] then __bad=__bad+1 end end; local M=MAMChronicles.Medals; __a=M:GetDefinition("wine_1").category; __b=M:GetDefinition("stare_1").category; __c=M:GetDefinition("quest_machine_1").category; __d=M:GetDefinition("jumps_1").category; __e=M:GetDefinition("late_1").category; __f=M:GetDefinition("firestarter_1").category; __g=M:GetDefinition("campfire_chef_1").category');
  assert.equal(h.get('__bad'),0); assert.equal(h.get('__a'),'kitchen'); assert.equal(h.get('__b'),'emotes'); assert.equal(h.get('__c'),'progress'); assert.equal(h.get('__d'),'habits'); assert.equal(h.get('__e'),'pattern'); assert.equal(h.get('__f'),'forever'); assert.equal(h.get('__g'),'forever');
});
test('the category list reports earned and total per category and hides empty ones',()=>{
  let h=setup(); h.run('__l=MAMChronicles.Medals:GetCategories(); __keys=""; for _,c in ipairs(__l) do __keys=__keys..c.key.." " end');
  assert.ok(!/forever/.test(h.get('__keys'))); assert.match(h.get('__keys'),/kitchen/); assert.equal(h.get('__l[1].key'),'progress'); assert.ok(h.get('__l[1].total')>5); assert.equal(h.get('__l[1].earned')>=0,true);
  h=setup(forever); h.run('__keys=""; for _,c in ipairs(MAMChronicles.Medals:GetCategories()) do __keys=__keys..c.key.." " end'); assert.match(h.get('__keys'),/forever/);
});
test('choosing a category narrows the medal list',()=>{
  const h=setup();
  h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("All"); __all=#UI.medalList; __ok=UI:SetMedalCategory("kitchen"); __n=#UI.medalList; __only=true; for _,m in ipairs(UI.medalList) do if m.def.category~="kitchen" then __only=false end end; __bad=UI:SetMedalCategory("nonsense"); __still=UI.medalCategory');
  assert.equal(h.get('__ok'),true); assert.equal(h.get('__only'),true); assert.ok(h.get('__n')>=30); assert.ok(h.get('__n')<h.get('__all')); assert.equal(h.get('__bad'),false); assert.equal(h.get('__still'),'kitchen');
});
test('the category button cycles, shows the category and wraps to all',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; __first=UI.medalCategoryButton.text; local b=UI.medalCategoryButton; b.scripts.OnClick(b); __second=b.text; __cat=UI.medalCategory');
  assert.equal(h.get('__first'),'Category: All'); assert.match(h.get('__second'),/^Category: /); assert.notEqual(h.get('__cat'),'all');
  h.run('local UI=MAMChronicles.UI; local b=UI.medalCategoryButton; for i=1,#MAMChronicles.Medals:GetCategories() do b.scripts.OnClick(b) end; __end=UI.medalCategory'); assert.equal(h.get('__end'),'all');
});
test('filter counts follow the chosen category',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:SetMedalFilter("All"); __allText=UI.medalFilterButtons[1].text; UI:SetMedalCategory("emotes"); __emoText=UI.medalFilterButtons[1].text');
  const a=parseInt(h.get('__allText').match(/\((\d+)\)/)[1]); const e=parseInt(h.get('__emoText').match(/\((\d+)\)/)[1]); assert.ok(e<a); assert.ok(e>=11);
});
test('the category button explains progress in its tooltip text',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:SetMedalCategory("kitchen"); __t=UI:DescribeCategory("kitchen")'); assert.match(h.get('__t'),/Kitchen & Bar: \d+ of \d+ medals earned/);
});

test('every medal family has a unique title',()=>{
  const h=setup(); h.run('__missing=""; local fams={}; local titles={}; __dup=""; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do if not fams[d.family] then fams[d.family]=true; local t=MAMChronicles.Medals.titles[d.family]; if not t then __missing=__missing..d.family.." " elseif titles[t] then __dup=__dup..t.." " else titles[t]=true end end end');
  assert.equal(h.get('__missing'),''); assert.equal(h.get('__dup'),'');
});
test('the first medal of a family unlocks a title with a toast, later tiers do not',()=>{
  const h=setup(); h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; '+count('wine',1)+'; __q=""; for _,q in ipairs(MAMChronicles.Toast.queue) do __q=__q..q.title.." | " end; __q=__q..((MAMChronicles.Toast.current or {}).title or "")');
  assert.match(h.get('__q'),/New title: Wine Mom/);
  h.run('MAMChronicles.Toast.queue={}; MAMChronicles.Toast.current=nil; '+count('wine',9)+'; __q2=""; for _,q in ipairs(MAMChronicles.Toast.queue) do __q2=__q2..q.title.." | " end; __q2=__q2..((MAMChronicles.Toast.current or {}).title or "")');
  assert.ok(!/New title/.test(h.get('__q2')));
});
test('the baseline never announces titles',()=>{
  const h=createHarness(); h.load(files); h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); __q=""; for _,q in ipairs(MAMChronicles.Toast.queue) do __q=__q..q.title end; __q=__q..((MAMChronicles.Toast.current or {}).title or "")');
  assert.ok(!/New title/.test(h.get('__q')));
});
test('the Medals tab counts earned titles',()=>{
  const h=setup(); h.run(count('wine',1)+'; __c=MAMChronicles.Medals:GetTitleCounts(); __sub=MAMChronicles.UI.medalSub.text; MAMChronicles.UI:RefreshMedals(); __sub=MAMChronicles.UI.medalSub.text');
  assert.ok(h.get('__c.earned')>=1); assert.ok(h.get('__c.total')>60); assert.match(h.get('__sub'),/\d+ of \d+ titles/);
});
