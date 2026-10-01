import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files = ['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
let clock;
function boot(saved) {
  clock = { now: 1790800000 };
  const h = createHarness({ savedVariables: saved, globals: { GetServerTime: () => clock.now } });
  h.load(files); h.run('MAMChronicles:Boot()'); return h;
}
const login = (h, reload = false) => { h.fire('PLAYER_LOGIN'); h.fire('PLAYER_ENTERING_WORLD', !reload, reload); };
const count = (type) => `MAMChronicles.EventStore:Count("${type}")`;

test('a first login writes one login event and a logout waits until the next real login', () => {
  const h = boot(); login(h);
  assert.equal(h.get(count('session.login')), 1);
  clock.now += 600; h.fire('PLAYER_LOGOUT');
  assert.equal(h.get(count('session.logout')), 0);
  assert.equal(h.get('MAMChroniclesDB.meta.pendingLogout.duration'), 600);
  clock.now += 3600; login(h);
  assert.equal(h.get(count('session.logout')), 1); assert.equal(h.get(count('session.login')), 2);
  h.run('__lo=MAMChronicles.EventStore:Query({type="session.logout"})[1]; __at=__lo.occurredAt; __dur=__lo.payload.duration');
  assert.equal(h.get('__at'), 1790800600); assert.equal(h.get('__dur'), 600);
});

test('a reload keeps the same session and writes neither a logout nor a login', () => {
  const h = boot(); login(h);
  h.run('__id=MAMChronicles.Database.currentSession.id');
  for (let i = 0; i < 5; i++) { clock.now += 20; h.fire('PLAYER_LOGOUT'); clock.now += 5; login(h, true); }
  assert.equal(h.get(count('session.login')), 1); assert.equal(h.get(count('session.logout')), 0);
  assert.equal(h.get('#MAMChroniclesDB.sessions'), 1); assert.equal(h.get('MAMChronicles.Database.currentSession.id'), h.get('__id'));
  assert.equal(h.get('MAMChroniclesDB.sessions[1].endedAt'), null); assert.equal(h.get('MAMChroniclesDB.meta.pendingLogout'), null);
});

test('reloading over and over cannot farm the quick-relog medals, but a real quick relog still counts', () => {
  const h = boot(); login(h);
  for (let i = 0; i < 6; i++) { clock.now += 10; h.fire('PLAYER_LOGOUT'); clock.now += 5; login(h, true); }
  h.run('__q=(MAMChronicles.Medals:EnsureCounts().quickRelogs or 0)'); assert.equal(h.get('__q'), 0);
  clock.now += 30; h.fire('PLAYER_LOGOUT'); clock.now += 20; login(h, false);
  h.run('__q2=(MAMChronicles.Medals:EnsureCounts().quickRelogs or 0)'); assert.equal(h.get('__q2'), 1);
});

test('time played and the session count follow real sessions, not reloads', () => {
  const h = boot(); login(h);
  clock.now += 300; h.fire('PLAYER_LOGOUT'); clock.now += 5; login(h, true);
  clock.now += 300; h.fire('PLAYER_LOGOUT'); clock.now += 4000; login(h);
  h.run('__n=#MAMChroniclesDB.sessions; __d=MAMChroniclesDB.sessions[1].endedAt-MAMChroniclesDB.sessions[1].startedAt');
  assert.equal(h.get('__n'), 2); assert.equal(h.get('__d'), 605);
});

test('Chronicle All hides logins and logouts, the Sessions filter shows them', () => {
  const h = boot(); login(h);
  h.run('MAMChronicles.EventStore:Append("quest.completed",{questID=1,questName="Q"})');
  clock.now += 100; h.fire('PLAYER_LOGOUT'); clock.now += 4000; login(h);
  h.run('UI=MAMChronicles.UI; __sessionsInAll=0; for _,e in ipairs(UI:BuildTimeline({filter="All"})) do if e.type:find("^session") then __sessionsInAll=__sessionsInAll+1 end end; __ses=#UI:BuildTimeline({filter="Sessions"}); __quest=#UI:BuildTimeline({filter="Quests"}); __last=UI.filters[#UI.filters]');
  assert.equal(h.get('__sessionsInAll'), 0); assert.equal(h.get('__ses'), 3); assert.equal(h.get('__quest'), 1); assert.equal(h.get('__last'), 'Sessions');
});

test('old Chronicles are cleaned once: reload pairs vanish, real sessions stay, sessions are joined', () => {
  const ev = (id, type, at, extra = {}) => ({ id, schemaVersion: 1, type, occurredAt: at, observedAt: at, characterKey: 'Player-1', payload: extra });
  const saved = { schemaVersion: 1, meta: {},
    events: [ev('a', 'session.login', 1000), ev('b', 'session.logout', 1500, { duration: 500 }), ev('c', 'session.login', 1510), ev('d', 'session.logout', 1600, { duration: 90 }), ev('e', 'session.login', 1608),
             ev('f', 'session.logout', 2000, { duration: 392 }), ev('g', 'session.login', 9000)],
    sessions: [{ id: 's1', characterKey: 'Player-1', startedAt: 1000, endedAt: 1500 }, { id: 's2', characterKey: 'Player-1', startedAt: 1510, endedAt: 1600 }, { id: 's3', characterKey: 'Player-1', startedAt: 1608, endedAt: 2000 }, { id: 's4', characterKey: 'Player-1', startedAt: 9000 }],
    medalTallies: { 'Player-1': { total: 7, signals: {}, professions: {}, built: true, 'session.login': 4, 'session.logout': 3 } } };
  const h = boot(saved);
  assert.equal(h.get('#MAMChroniclesDB.events'), 3);
  assert.equal(h.get('MAMChroniclesDB.events[1].id'), 'a'); assert.equal(h.get('MAMChroniclesDB.events[2].id'), 'f'); assert.equal(h.get('MAMChroniclesDB.events[3].id'), 'g');
  assert.equal(h.get('#MAMChroniclesDB.sessions'), 2); assert.equal(h.get('MAMChroniclesDB.sessions[1].endedAt'), 2000); assert.equal(h.get('MAMChroniclesDB.sessions[1].id'), 's1');
  assert.equal(h.get('MAMChroniclesDB.medalTallies["Player-1"]["session.login"]'), 2); assert.equal(h.get('MAMChroniclesDB.medalTallies["Player-1"]["session.logout"]'), 1);
  assert.equal(h.get('MAMChroniclesDB.diagnostics.reloadCleanup.removed'), 2); assert.equal(h.get('MAMChroniclesDB.meta.sessionsDeduped'), true);
  h.run('__again=MAMChronicles.Database:DedupeSessions(MAMChroniclesDB)'); assert.equal(h.get('__again'), 0);
});
