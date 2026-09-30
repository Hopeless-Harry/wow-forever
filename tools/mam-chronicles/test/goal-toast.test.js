import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
function setup(){const h=createHarness();h.load(files);h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t")');return h;}
const memories=(n,from=0)=>`for i=${from+1},${from+n} do MAMChronicles.EventStore:Append("memory.manual",{text="m"..i}) end`;
test('a pinned medal at 90 percent shows one nearly-there toast',()=>{
  const h=setup(); h.run('MAMChronicles.Medals:SetPinned("memory_keeper_2",true); '+memories(8));
  h.run('__t=(MAMChronicles.Toast.current or {}).title or ""'); assert.ok(!/Nearly/.test(h.get('__t')));
  h.run(memories(1,8)+'; __all=""; for _,q in ipairs(MAMChronicles.Toast.queue) do __all=__all..q.title.." "..q.text.." | " end'); assert.match(h.get('__all'),/Nearly there: Memory Keeper II/); assert.match(h.get('__all'),/9 \/ 10/);
});
test('the nearly-there toast is shown only once per medal',()=>{
  const h=setup(); h.run('MAMChronicles.Medals:SetPinned("memory_keeper_2",true); '+memories(9)); h.run('MAMChronicles.Toast.current=nil; MAMChronicles.Toast.queue={}; MAMChronicles.Medals:Evaluate("again")');
  assert.equal(h.get('MAMChronicles.Toast.current'),null); assert.equal(h.get('#MAMChronicles.Toast.queue'),0);
});
test('unpinned medals and tiny targets never trigger it',()=>{
  const h=setup(); h.run(memories(9)+'; __t=(MAMChronicles.Toast.current or {}).title or ""; for _,q in ipairs(MAMChronicles.Toast.queue) do __t=__t..(q.title or "") end'); assert.ok(!/Nearly/.test(h.get('__t')));
});
test('the toast respects the toast setting',()=>{
  const h=setup(); h.run('MAMChroniclesDB.settings.toastsEnabled=false; MAMChronicles.Medals:SetPinned("memory_keeper_2",true); '+memories(9)); assert.equal(h.get('MAMChronicles.Toast.current'),null);
});
