import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua'];
const good=(i)=>({id:`c:quest.completed:${1700000000+i}:1`,schemaVersion:1,type:'quest.completed',occurredAt:1700000000+i,observedAt:1700000000+i,characterKey:'c',payload:{questID:i}});
function boot(events,extra={}){const h=createHarness({savedVariables:{schemaVersion:1,meta:{},settings:{},events,...extra}});h.load(files);h.run('MAMChronicles:Boot()');return h;}
test('one invalid event no longer wipes the valid history',()=>{
  const h=boot([good(1),{id:'bad',type:'quest.completed',payload:{}},good(2),{nonsense:true},good(3)]);
  assert.equal(h.get('#MAMChroniclesDB.events'),3);
  assert.match(h.get('MAMChroniclesDB.diagnostics.recovery.reason'),/dropped 2 invalid events/);
  assert.equal(h.get('MAMChroniclesDB.eventIds["c:quest.completed:1700000002:1"]'),true);
});
test('a clean history reports no recovery',()=>{const h=boot([good(1),good(2)]);assert.equal(h.get('MAMChroniclesDB.diagnostics.recovery'),null);});
test('a corrupt root still starts fresh',()=>{const h=boot([good(1)],{sessions:'bad'});assert.equal(h.get('#MAMChroniclesDB.events'),0);assert.equal(h.get('MAMChroniclesDB.diagnostics.recovery.reason'),'corrupt root');});
test('diagnostics show the salvage note',()=>{const h=boot([good(1),{id:'bad'}]);h.load(['Export.lua']);h.run('__d=MAMChronicles.Export:BuildDiagnosticReport()');assert.match(h.get('__d'),/Recovery: dropped 1 invalid event/);});
