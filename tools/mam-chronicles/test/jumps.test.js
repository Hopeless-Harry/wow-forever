import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
// Live Retail (alpha12-alpha20): the jump hook installed but the jump key never reached it, so jumps stayed at 0.
function setup(extra=''){
  const h=createHarness(); h.load(files.slice(0,1));
  h.run(`__t=100; __falling=false; __flying=false; __swimming=false; __taxi=false; __hooks={}
function GetTime() return __t end
function IsFalling() return __falling end function IsFlying() return __flying end function IsSwimming() return __swimming end function UnitOnTaxi() return __taxi end
function hooksecurefunc(a,b,c) if type(a)=="table" then __hooks[b]=c else __hooks[a]=b end end
function JumpOrAscendStart() end
${extra}`);
  h.load(files.slice(1)); h.run('MAMChronicles:Boot()'); return h;
}
const tick='MAMChronicles.Counters.ticker.scripts.OnUpdate(MAMChronicles.Counters.ticker,0.11)';
const jumps='(MAMChroniclesDB.counters[MAMChronicles.characterKey] or {}).jumps';
test('a jump is counted when the character leaves the ground, even if the jump key never calls the hook',()=>{
  const h=setup(); h.run(`__falling=true; ${tick}`); assert.equal(h.get(jumps),1);
});
test('staying in the air counts once and the next jump counts again',()=>{
  const h=setup(); h.run(`__falling=true; ${tick}; __t=__t+0.5; ${tick}; __t=__t+0.5; ${tick}`); assert.equal(h.get(jumps),1);
  h.run(`__falling=false; __t=__t+0.3; ${tick}; __falling=true; __t=__t+0.3; ${tick}`); assert.equal(h.get(jumps),2);
});
test('flying, swimming and taxi rides are not jumps',()=>{
  for (const flag of ['__flying','__swimming','__taxi']) { const h=setup(); h.run(`${flag}=true; __falling=true; ${tick}`); assert.equal(h.get(jumps),null,flag); }
});
test('a jump seen by both the hook and the ticker is counted once',()=>{
  const h=setup(); h.run(`__hooks.JumpOrAscendStart(); __t=__t+0.1; __falling=true; ${tick}`); assert.equal(h.get(jumps),1);
});
test('the hook alone still counts on clients where it fires',()=>{
  const h=setup(); h.run('__hooks.JumpOrAscendStart(); __t=__t+5; __hooks.JumpOrAscendStart()'); assert.equal(h.get(jumps),2);
});
test('diagnostics say which method counted the jumps',()=>{
  const h=setup(); h.run(`__falling=true; ${tick}; __falling=false; __t=__t+5; ${tick}; __hooks.JumpOrAscendStart(); __d=MAMChronicles.Export:BuildDiagnosticReport()`);
  assert.match(h.get('__d'),/Jumps counted: 1 by the hook, 1 by the ground check/);
});
test('a missing IsFalling API does not break startup and the hook path still works',()=>{
  const h=setup('IsFalling=nil'); h.run('__hooks.JumpOrAscendStart()'); assert.equal(h.get(jumps),1); assert.equal(h.get('MAMChronicles.errorStats.count'),0);
});
test('the Trampoline Mom medal progresses from ground-check jumps',()=>{
  const h=setup(); h.run(`MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); for i=1,100 do __falling=true; __t=__t+1; ${tick}; __falling=false; __t=__t+1; ${tick} end; MAMChronicles.Medals:Evaluate("t"); __e=MAMChroniclesDB.medals[MAMChronicles.characterKey].earned["jumps_1"]~=nil`);
  assert.equal(h.get('__e'),true);
});
