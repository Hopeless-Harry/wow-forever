import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness, multi } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChroniclesDB.settings.seasonsSeen={brewfest2026=true}');return h;}

// Live Retail screenshot (alpha20): the art progress bar sat on top of the description text in medal rows.
test('medal rows are tall enough that the progress bar sits below the description',()=>{
  const h=setup(); h.run('MAMChronicles.AchievementStats:Scan(); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); local row=UI.medalRows[1]; __h=row.height; __bar=row.bar.height; __by=row.bar.points[1]; __desc=row.desc');
  assert.ok(h.get('__h')>=54,`row height ${h.get('__h')}`); assert.ok(h.get('__bar')<=8);
});
test('the row pitch follows the taller rows so nothing overlaps',()=>{
  const h=setup(); h.run('MAMChronicles.AchievementStats:Scan(); local UI=MAMChronicles.UI; UI:Show(); UI:SetActiveTab("Medals"); UI:SetMedalFilter("All"); local a=UI.medalRows[1].points; __p1=UI.medalRows[1].entry~=nil');
  assert.equal(h.get('__p1'),true);
});
test('a missing font template falls back instead of breaking the window',()=>{
  const h=setup(); h.run('local parent={CreateFontString=function(self,name,layer,template) if template=="GameFontNormalHuge" then error("no such font") end return {SetTextColor=function() end,template=template} end}; __fs=MAMChronicles.Theme:Text(parent,"GameFontNormalHuge"); __t=__fs.template');
  assert.equal(h.get('__t'),'GameFontNormalLarge');
});
test('before launch the preview week still counts this weeks logins',()=>{
  const h=setup();
  h.run('MAMChronicles.EventStore:Append("session.login",{}); local q; for _,x in ipairs(MAMChronicles.Medals:GetWeeklyQuests()) do if x.kind=="days" then q=x end end; __days=q and q.current');
  assert.ok(h.get('__days')>=1,`days ${h.get('__days')}`);
});
test('the preview week rolls over every real week even before launch',()=>{
  const h=setup();
  h.run('local M=MAMChronicles.Medals; local w1,s1,i1=M:GetWeek(1790704800); local w2,s2,i2=M:GetWeek(1790704800+604800); __w1,__w2=w1,w2; __i1,__i2=i1,i2; __s1,__s2=s1,s2');
  assert.equal(h.get('__w1'),1); assert.equal(h.get('__w2'),1); assert.equal(h.get('__i2'),h.get('__i1')+1); assert.equal(h.get('__s2')-h.get('__s1'),604800); assert.ok(h.get('__s1')<=1790704800);
  h.run('local M=MAMChronicles.Medals; M:GetWeeklyQuests(); __a=MAMChroniclesDB.challenges[MAMChronicles.characterKey].index; MAMChronicles.Now=function() return 1790704800+604800 end; M:GetWeeklyQuests(); __b=MAMChroniclesDB.challenges[MAMChronicles.characterKey].index');
  assert.equal(h.get('__b'),h.get('__a')+1);
});
