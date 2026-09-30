import test from 'node:test'; import assert from 'node:assert/strict';
import { createHarness, multi } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua','Theme.lua','Dashboard.lua','UI.lua'];

for (const client of [
  {name:'Retail', build:()=>multi('12.1.0','69933','Sep 2026',120100)},
  {name:'Forever', build:()=>multi('1.60.1','70009','Sep 2026',16001)},
]) {
  test(`full ${client.name} startup, login, UI, memory and logout smoke test`,()=>{
    const h=createHarness({globals:{GetBuildInfo:client.build}}); h.load(files);
    h.fire('ADDON_LOADED','MAMChronicles'); h.fire('PLAYER_LOGIN'); h.slash('remember Smoke test'); h.slash(''); h.fire('PLAYER_LOGOUT');
    assert.equal(h.get('MAMChronicles.booted'),true); assert.equal(h.get('MAMChroniclesDB.meta.clientBuild'),client.name==='Retail'?'69933':'70009');
    assert.equal(h.get('MAMChronicles.EventStore:Count("session.login")'),1); assert.equal(h.get('MAMChronicles.EventStore:Count("memory.manual")'),1); assert.equal(h.get('MAMChroniclesDB.sessions[1].endedAt'),1790704800);
    assert.equal(h.get('MAMChronicles.UI.frame:IsShown()'),true); assert.equal(h.get('#MAMChronicles.UI.rowPool'),30);
  });
}

test('a second loaded session retains and searches the first session journal',()=>{
  let now=1790704800; const h=createHarness({globals:{GetServerTime:()=>now}}); h.load(files); h.fire('ADDON_LOADED','MAMChronicles'); h.fire('PLAYER_LOGIN'); h.slash('remember First session tea'); h.fire('PLAYER_LOGOUT');
  now+=10;
  h.run('MAMChronicles=nil'); h.load(files); h.fire('ADDON_LOADED','MAMChronicles'); h.fire('PLAYER_LOGIN');
  h.run('__retained=MAMChronicles.EventStore:Query({text="First session tea"})');
  assert.equal(h.get('MAMChroniclesDB.meta.loadCount'),2); assert.equal(h.get('#MAMChroniclesDB.sessions'),2); assert.equal(h.get('MAMChronicles.EventStore:Count("session.login")'),2);
  assert.equal(h.get('#__retained'),1); assert.equal(h.get('__retained[1].payload.text'),'First session tea'); assert.equal(h.get('__retained[1].pinned'),true);
});

test('10,000-event history remains searchable and uses only 30 UI rows',()=>{
  const h=createHarness(); h.load(files); h.fire('ADDON_LOADED','MAMChronicles');
  h.run('for i=1,10000 do MAMChronicles.EventStore:Append("quest.completed",{questID=i,questName="Quest "..i},{occurredAt=100000+i}) end; __stats=MAMChronicles.Statistics:Build(0,200000); MAMChronicles.UI:Create(); __page=MAMChronicles.UI:GetVisibleTimeline()');
  assert.equal(h.get('#MAMChroniclesDB.events'),10000); assert.equal(h.get('__stats.eventCount'),10000); assert.equal(h.get('__stats.totals.questsCompleted'),10000); assert.equal(h.get('#__page'),30); assert.equal(h.get('#MAMChronicles.UI.rowPool'),30);
});
