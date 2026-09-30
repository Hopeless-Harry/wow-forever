import test from 'node:test'; import assert from 'node:assert/strict'; import { createHarness } from './harness.js';
const files=['Core.lua','Database.lua','EventStore.lua','Statistics.lua'];
function setup(){const h=createHarness();h.load(files);h.run(`MAMChronicles:Boot(); MAMChronicles.Database:BeginSession()
local S=MAMChronicles.EventStore
S:Append("session.login",{},{occurredAt=100}); S:Append("character.death",{zone="A",deathKind="falling"},{occurredAt=110})
S:Append("character.resurrected",{zone="A"},{occurredAt=120}); S:Append("quest.completed",{questID=1,questName="One"},{occurredAt=130})
S:Append("world.zone_discovered",{mapID=7,zone="B"},{occurredAt=140}); S:Append("loot.notable",{itemID=9,itemName="Epic",quality=4},{occurredAt=150})
S:Append("achievement.earned",{achievementID=3,achievementName="Win"},{occurredAt=160}); S:Append("memory.manual",{text="Hello"},{occurredAt=170})`);return h;}
test('statistics aggregate a fixed range with coverage',()=>{const h=setup();h.run('__stats=MAMChronicles.Statistics:Build(100,160)');assert.equal(h.get('__stats.eventCount'),7);assert.equal(h.get('__stats.totals.deaths'),1);assert.equal(h.get('__stats.totals.questsCompleted'),1);assert.equal(h.get('__stats.byZone.A'),2);assert.equal(h.get('__stats.coverage.sourceEventCount'),7);});
test('statistics use inclusive boundaries and deterministic awards',()=>{const h=setup();h.run('__stats=MAMChronicles.Statistics:Build(110,150)');assert.equal(h.get('__stats.eventCount'),5);assert.equal(h.get('__stats.awards[1].name'),"Gravity's Favourite");assert.equal(h.get('__stats.awards[2].name'),'Explorer');});
test('statistics handle empty history and format durations',()=>{const h=setup();h.run('__stats=MAMChronicles.Statistics:Build(1000,2000)');assert.equal(h.get('__stats.eventCount'),0);assert.equal(h.get('#__stats.awards'),0);assert.equal(h.get('MAMChronicles.Statistics:FormatDuration(3661)'),'1h 1m');});
