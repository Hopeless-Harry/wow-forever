import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(globals){const h=createHarness({globals});h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
const NOW=1790704800, DAY=86400;
const seedAlt=`MAMChroniclesDB.characters["alt-1"]={name="Altmom",realm="Draenor",classID=5,className="Priest",level=37,firstSeenAt=${NOW-30*DAY},lastSeenAt=${NOW-2*DAY},guid="Player-9999-SECRET"}
MAMChroniclesDB.medals["alt-1"]={earned={wine_1={at=1,points=10},wine_2={at=2,points=25}},total=35,spent=5,bonus=15}
MAMChroniclesDB.professionSnapshots["alt-1"]={a={professionName="Cooking",skillLevel=120,maxSkillLevel=150},b={professionName="Fishing",skillLevel=60,maxSkillLevel=75}}`;

test('the current character stores its level and class name when registered',()=>{
  const h=setup({UnitLevel:()=>42}); assert.equal(h.get('MAMChroniclesDB.characters[MAMChronicles.characterKey].level'),42); assert.equal(h.get('MAMChroniclesDB.characters[MAMChronicles.characterKey].className'),'Mage');
});
test('levelling up and logging out update the saved character',()=>{
  const h=setup({UnitLevel:()=>42}); h.run('MAMChronicles.Collectors:HandleEvent("PLAYER_LEVEL_UP",43); __l=MAMChroniclesDB.characters[MAMChronicles.characterKey].level');
  assert.equal(h.get('__l'),43);
  h.run('MAMChroniclesDB.characters[MAMChronicles.characterKey].lastSeenAt=1; MAMChronicles.Collectors:HandleEvent("PLAYER_LOGOUT"); __s=MAMChroniclesDB.characters[MAMChronicles.characterKey].lastSeenAt'); assert.ok(h.get('__s')>1);
});
test('the character list covers every character, newest first, with the current one marked',()=>{
  const h=setup(); h.run(seedAlt+'; __l=MAMChronicles.Statistics:BuildCharacters()');
  assert.equal(h.get('#__l'),2); assert.equal(h.get('__l[1].isCurrent'),true); assert.equal(h.get('__l[2].name'),'Altmom'); assert.equal(h.get('__l[2].level'),37); assert.equal(h.get('__l[2].className'),'Priest');
});
test('each character shows its own title, medals, Mom Money and professions',()=>{
  const h=setup(); h.run(seedAlt+'; __l=MAMChronicles.Statistics:BuildCharacters(); __alt=__l[2]');
  assert.equal(h.get('__alt.title'),'Wine Mom'); assert.equal(h.get('__alt.medals'),2); assert.equal(h.get('__alt.money'),35+15-5); assert.equal(h.get('#__alt.professions'),2);
  assert.equal(h.get('__alt.professions[1].name'),'Cooking');
});
test('the description lists names, levels, titles and how long ago, and never the GUID',()=>{
  const h=setup(); h.run(seedAlt+'; __t=MAMChronicles.Statistics:DescribeCharacters(MAMChronicles.Statistics:BuildCharacters())');
  const t=h.get('__t'); assert.match(t,/Altmom/); assert.match(t,/Level 37 Priest/); assert.match(t,/Wine Mom/); assert.match(t,/Cooking 120/); assert.match(t,/2 days ago/); assert.match(t,/this character/); assert.ok(!/SECRET|Player-/.test(t));
});
test('Characters is the fifth of seven tabs and all tabs fit the narrowest window',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Create(); __n=#MAMChronicles.UI.tabs; __five=MAMChronicles.UI.tabs[5]; __last=MAMChronicles.UI.tabs[7]; local right=0; for i,b in ipairs(MAMChronicles.UI.tabButtons) do local p=b.point; right=math.max(right,(p[4] or 0)+b.width) end __right=right');
  assert.equal(h.get('__n'),7); assert.equal(h.get('__five'),'Characters'); assert.equal(h.get('__last'),'Diagnostics'); assert.ok(h.get('__right')<=620,`tabs reach ${h.get('__right')}`);
});
test('the Characters tab shows the list in a scrolling text view and is remembered',()=>{
  const h=setup(); h.run(seedAlt+'; local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Characters"); __c=UI.content.text; __saved=MAMChroniclesDB.settings.ui.activeTab');
  assert.match(h.get('__c'),/Altmom/); assert.equal(h.get('__saved'),'Characters'); assert.equal(h.get('MAMChronicles.UI.textVisible'),true);
});
test('a corrupt character record never breaks the tab',()=>{
  const h=setup(); h.run('MAMChroniclesDB.characters["bad"]="nonsense"; MAMChroniclesDB.characters["odd"]={}; local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Characters")');
  assert.equal(h.get('MAMChronicles.errorStats.count'),0); assert.ok(h.get('MAMChronicles.UI.content.text').length>0);
});
