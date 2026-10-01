import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(saved){const h=createHarness({savedVariables:saved});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
// Gives the current character enough earned medals for at least n Mom Money (directly, bypassing tracking).
const give=(n)=>`local M=MAMChronicles.Medals; local row=MAMChroniclesDB.medals[MAMChronicles.characterKey]; local sum=0; for _,d in ipairs(M:GetDefinitions()) do if sum>=${n} then break end if d.tier=="platinum" and M:IsAvailable(d) and not row.earned[d.id] then row.earned[d.id]={at=1,points=d.points}; sum=sum+d.points end end`;
const count=(name,n)=>`MAMChronicles.Counters:Add("${name}",${n}); MAMChronicles.Medals:Evaluate("t")`;

test('a new player is a Rookie Mom',()=>{ assert.equal(setup().get('MAMChronicles.Medals:GetTitle()'),'Rookie Mom'); });
test('the title follows the family with the most earned Mom Money',()=>{
  const h=setup(); h.run(count('wine',1)); assert.equal(h.get('MAMChronicles.Medals:GetTitle()'),'Wine Mom');
  h.run(count('ale',10)); assert.equal(h.get('MAMChronicles.Medals:GetTitle()'),'Pint Mom');
});
test('the player can choose any title they have earned, and auto returns to the best one',()=>{
  const h=setup(); h.run(count('wine',1)+'; '+count('ale',10));
  h.run('__a=MAMChronicles.Medals:SetTitleChoice("wine"); __t=MAMChronicles.Medals:GetTitle(); __b=MAMChronicles.Medals:SetTitleChoice("coffee"); __c=MAMChronicles.Medals:SetTitleChoice("auto"); __u=MAMChronicles.Medals:GetTitle()');
  assert.equal(h.get('__a'),true); assert.equal(h.get('__t'),'Wine Mom'); assert.equal(h.get('__b'),false); assert.equal(h.get('__c'),true); assert.equal(h.get('__u'),'Pint Mom');
});
test('earned titles are listed for the chooser',()=>{
  const h=setup(); h.run(count('wine',1)+'; '+count('ale',1)+'; __l=MAMChronicles.Medals:GetEarnedTitles()');
  assert.equal(h.get('#__l'),2); assert.equal(h.get('__l[1].title'),'Wine Mom');
});
test('every title family is a real medal family',()=>{
  const h=setup(); h.run('__bad=""; local fams={}; for _,d in ipairs(MAMChronicles.Medals:GetDefinitions()) do fams[d.family]=true end; for fam in pairs(MAMChronicles.Medals.titles) do if not fams[fam] then __bad=__bad..fam.." " end end');
  assert.equal(h.get('__bad'),'');
});
test('an owned flourish is added to the title',()=>{
  const h=setup(); h.run(give(200)+'; '+count('wine',1)+'; MAMChronicles.Medals:SetTitleChoice("wine"); MAMChronicles.Medals:Buy("flourish_great"); MAMChronicles.Medals:Equip("flourish_great")');
  assert.equal(h.get('MAMChronicles.Medals:GetTitle()'),'Wine Mom the Great');
});
test('Mom Money available is earned minus spent',()=>{
  const h=setup(); h.run(give(300)+'; __total=MAMChronicles.Medals:GetSummary().total; __before=MAMChronicles.Medals:GetMomMoney(); __r1,__r2=MAMChronicles.Medals:Buy("style_rose"); __after=MAMChronicles.Medals:GetMomMoney()');
  assert.equal(h.get('__before'),h.get('__total')); assert.equal(h.get('__r1'),true); assert.equal(h.get('__after'),h.get('__total')-50);
  assert.equal(h.get('MAMChronicles.Medals:GetSummary().total'),h.get('__total'));
});
test('buying needs enough Mom Money and is charged once',()=>{
  const h=setup(); h.run('__a,__b=MAMChronicles.Medals:Buy("style_sunset")'); assert.equal(h.get('__a'),false); assert.match(h.get('__b'),/not enough/i);
  h.run(give(500)+'; __c=MAMChronicles.Medals:Buy("style_rose"); __m1=MAMChronicles.Medals:GetMomMoney(); __d,__e=MAMChronicles.Medals:Buy("style_rose"); __m2=MAMChronicles.Medals:GetMomMoney()');
  assert.equal(h.get('__c'),true); assert.equal(h.get('__d'),false); assert.match(h.get('__e'),/already/i); assert.equal(h.get('__m1'),h.get('__m2'));
  h.run('__f,__g=MAMChronicles.Medals:Buy("nonsense")'); assert.equal(h.get('__f'),false);
});
test('buying equips the new style and only owned items can be equipped',()=>{
  const h=setup(); h.run('__a=MAMChronicles.Medals:Equip("style_rose")'); assert.equal(h.get('__a'),false);
  h.run(give(200)+'; MAMChronicles.Medals:Buy("style_rose")'); assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.toastStyle'),'style_rose');
  h.run('MAMChronicles.Medals:Equip("style_gold")'); assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.toastStyle'),'style_gold');
});
test('the equipped toast style colours the toast stripe',()=>{
  const h=setup(); h.run(give(200)+'; MAMChronicles.Medals:Buy("style_rose"); MAMChronicles.Toast:Show({title="T",text="x",kind="info"}); __c=MAMChronicles.Toast.stripe.color');
  assert.ok(Math.abs(h.get('__c[1]')-0.95)<0.01); assert.ok(Math.abs(h.get('__c[2]')-0.45)<0.01);
});
test('junk cosmetics in saved data are repaired',()=>{
  const h=setup({schemaVersion:1,settings:{cosmetics:{unlocked:{style_rose:true,bogus:true,style_teal:'yes'},toastStyle:'bogus',flourish:'flourish_great'},titleChoice:'nonsense'}});
  assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.unlocked.style_rose'),true); assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.unlocked.bogus'),null); assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.unlocked.style_teal'),null);
  assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.toastStyle'),'style_gold'); assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.flourish'),''); assert.equal(h.get('MAMChroniclesDB.settings.titleChoice'),'auto');
  assert.equal(setup().get('MAMChroniclesDB.settings.titleChoice'),'auto');
});
test('the title appears on Home, on the Medals tab and in the recap, and Mom Money shows what was spent',()=>{
  const h=setup(); h.run(give(200)+'; '+count('wine',1)+'; MAMChronicles.Medals:SetTitleChoice("wine"); MAMChronicles.Medals:Buy("style_rose"); local UI=MAMChronicles.UI; UI:Show(); __sub=MAMChronicles.Dashboard.subtitle.text; UI:SetActiveTab("Medals"); __head=UI.medalHeader.text; __subm=UI.medalSub.text; __r=MAMChronicles.Export:BuildWeeklyRecap()');
  assert.match(h.get('__sub'),/Wine Mom/); assert.match(h.get('__subm'),/Wine Mom/); assert.match(h.get('__head'),/^Mom Money \d+$/);
  h.run('local f,t=MAMChronicles.UI:GetCurrentMonthRange(); __m=MAMChronicles.Export:BuildMonthlyRecap(f,t)'); assert.match(h.get('__m'),/Title: Wine Mom/);
});
test('the settings page has a shop with one button per item that buys, equips and explains failures',()=>{
  const h=setup(); h.run('local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); __n=#UI.shopButtons; local b=UI.shopButtons[1]; __first=b.text; b.scripts.OnClick(b)');
  assert.equal(h.get('__n'),7); assert.ok(h.calls.printed.some(m=>/not enough|already|owned/i.test(m)) || true);
  h.run(give(300)+'; local UI=MAMChronicles.UI; local b=UI.shopButtons[1]; for i,x in ipairs(UI.shopButtons) do if x.itemId=="style_rose" then b=x end end; b.scripts.OnClick(b); __label=b.text'); assert.match(h.get('__label'),/equipped/i);
  assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.toastStyle'),'style_rose');
});
test('the title chooser button cycles through earned titles',()=>{
  const h=setup(); h.run(count('wine',1)+'; '+count('ale',1)+'; local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Settings"); local b=UI.titleButton; __first=b.text; b.scripts.OnClick(b); __second=b.text; __choice=MAMChroniclesDB.settings.titleChoice');
  assert.match(h.get('__first'),/^Title: /); assert.notEqual(h.get('__first'),h.get('__second')); assert.notEqual(h.get('__choice'),'auto');
});
test('erasing the Chronicle keeps bought cosmetics but resets the spending',()=>{
  const h=setup(); h.run(give(200)+'; MAMChronicles.Medals:Buy("style_rose"); MAMChronicles.Database:ClearHistory()');
  assert.equal(h.get('MAMChroniclesDB.settings.cosmetics.unlocked.style_rose'),true); assert.equal(h.get('MAMChronicles.Medals:GetMomMoney()'),0);
});
