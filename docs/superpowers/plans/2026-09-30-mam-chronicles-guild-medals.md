# Variety, Named and Guild-Verified Medals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "wave at N different guildies" variety medals, named-target medals ("Spit at Hopeless x times"), and guild-verified medals that only the Guild Master can award in person, with a test mode for use outside a guild.

**Architecture:** `Counters.lua` records which guildmate each emote was aimed at (local only). `Medals.lua` turns that into variety and named medals and adds a `verified` medal kind that tracking never earns. `Comms.lua` gains `A1`/`R1` award messages: a receiver accepts one only from the GUILD channel when the sender is rank 0 in its roster, or over WHISPER when its session-only test mode is on. `UI.lua` shows verified medals as locked and gives the Guild Master slash commands plus a click-to-award action.

**Tech Stack:** Lua 5.1 WoW addon (`addons/MAMChronicles`), tested with Node 18+ `node:test` and `fengari` (`tools/mam-chronicles`). Run all tests from `tools/mam-chronicles` with `npm test` (baseline: 482 pass).

**Spec:** `docs/superpowers/specs/2026-09-30-mam-chronicles-guild-medals-design.md`

## Global Constraints

- No new Lua files (TOC, `scripts/*.ps1` allowlists and every test's `files` list stay unchanged).
- `Medals.version` stays `1`. New medal ids are new; old builds count them as "unknown".
- Addon messages stay at most 64 characters (`MAX_LENGTH`) and use the existing prefix `MAMCHR`.
- Only a medal id, a character short name and the version are ever sent. Never chat, location, gold or history.
- Emote target names stay local in `db.emoteTargets[characterKey][EMOTE]`; never exported, never sent.
- Every medal needs: a category key in `Medals.categories`, a unique title in `Medals.titles`, `points` in {10,25,50,100}, a positive numeric `target`, a function `value`, a `tracking` string of 10+ characters. Existing tests enforce this.
- Authority check on receipt: channel `GUILD` and `Comms:RosterRank(sender) == 0`, or channel `WHISPER` with `Comms.testMode == true`. Fail closed.
- Test mode is session-only (`Comms.testMode`, not saved). Test grants are stored with `test = true` and `points = 0`.
- Deviations from the spec, chosen to keep the change small: the target store is per character; it stops adding new names at 1000 per emote instead of evicting old ones; no roster auto-complete (WoW slash commands cannot do it); test mode resets to off on reload.

## File Structure

- Modify `addons/MAMChronicles/Counters.lua`: track SPIT, resolve and record emote targets.
- Modify `addons/MAMChronicles/Database.lua`: `emoteTargets` key (fresh, open guard, ClearHistory).
- Modify `addons/MAMChronicles/Comms.lua`: roster helpers, award send/receive, test mode.
- Modify `addons/MAMChronicles/Medals.lua`: context functions, variety/named/verified registration, grant/revoke, config tables.
- Modify `addons/MAMChronicles/UI.lua`: locked display, tooltip, click-to-award, slash commands, TEST MODE tag, help.
- Modify `addons/MAMChronicles/Export.lua`: one diagnostics line.
- Create `tools/mam-chronicles/test/guild-medals.test.js`: all new tests (grown task by task).
- Modify `addons/MAMChronicles/CHANGELOG.md`, `README.md`, `PROJECT-HANDOFF.md`.

Shared test scaffold (created in Task 1, reused by later tasks):

```js
const key = 'Player-1234-ABCDEF';
```

---

### Task 1: Guild roster helpers and emote target capture

**Files:**
- Modify: `addons/MAMChronicles/Comms.lua` (insert after `shortName`, line 99)
- Modify: `addons/MAMChronicles/Counters.lua:21`, `:78-86`, `:120-124`, header comment at `:5-6`
- Modify: `addons/MAMChronicles/Database.lua:34`, `:46`, `:61`, `:148`
- Create: `tools/mam-chronicles/test/guild-medals.test.js`

**Interfaces:**
- Produces: `Comms:RosterRank(name) -> number|nil` (0 = Guild Master), `Comms:IsGuildmate(name) -> bool`, `Comms:IsGuildLead(name) -> bool`, `Comms:RequestRoster()`.
- Produces: `Counters:ResolveEmoteTarget(target) -> lowercase short name|nil`, `Counters:RecordEmoteTarget(token, target) -> bool`, `Counters:AddOnce(name, window, before)` (new optional `before` callback).
- Produces: `db.emoteTargets[characterKey][TOKEN] = { distinct = n, names = { lowername = count } }`.

- [ ] **Step 1: Write the failing tests**

Create `tools/mam-chronicles/test/guild-medals.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.js';

const files=['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua'];
const api=`
__hooks={}
function hooksecurefunc(a,b,c) if type(a)=="table" then __hooks[b]=c else __hooks[a]=b end end
function DoEmote() end
__t=100
function GetTime() return __t end
__units={target={name="Alice",guild="Moms",player=true}}
__myGuild="Moms"
function UnitName(u) if u=="player" then return "Mumtest","Draenor" end local x=__units[u] return x and x.name end
function UnitExists(u) return __units[u]~=nil end
function UnitIsPlayer(u) return __units[u]~=nil and __units[u].player==true end
function GetGuildInfo(u) if u=="player" then return __myGuild end local x=__units[u] return x and x.guild end
__roster={{"Mumtest-Draenor","Member",3},{"Alice-Draenor","Member",3},{"Boss-Draenor","Guild Master",0}}
function GetNumGuildMembers() return #__roster end
function GetGuildRosterInfo(i) local r=__roster[i] return r[1],r[2],r[3] end
__isLead=false
function IsGuildLeader() return __isLead end
__sent={}; __prefixes={}; __guild=true; __timers={}
IsInGuild=function() return __guild end
C_Timer={After=function(d,f) table.insert(__timers,f) end}
C_ChatInfo={RegisterAddonMessagePrefix=function(p) table.insert(__prefixes,p) return true end,SendAddonMessage=function(p,t,c,tgt) table.insert(__sent,{p,t,c,tgt}) return 0 end}
Enum={SendAddonMessageResult={Success=0}}
function __emote(token,target) __t=__t+1; MAMChronicles.Counters:OnEmote(token,target) end`;
function setup(extra=''){const h=createHarness();h.load(files.slice(0,1));h.run(api+'\n'+extra);h.load(files.slice(1));h.run('MAMChronicles:Boot(); MAMChronicles.AchievementStats:Scan(); MAMChronicles.Medals:Evaluate("t"); MAMChronicles.Toast:Advance(60); MAMChronicles.Toast:Advance(60); __sent={}');return h;}
const key='Player-1234-ABCDEF';
const targets=(token)=>`MAMChroniclesDB.emoteTargets["${key}"].${token}`;

test('roster helpers read rank by short name and fail closed',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Boss-Draenor")'),0);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("boss")'),0);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Alice")'),3);
  assert.equal(h.get('MAMChronicles.Comms:RosterRank("Nobody")'),null);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Boss")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Alice")'),false);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildmate("Alice")'),true);
  assert.equal(h.get('MAMChronicles.Comms:IsGuildmate("Nobody")'),false);
  h.run('__roster={}');
  assert.equal(h.get('MAMChronicles.Comms:IsGuildLead("Boss")'),false);
});

test('an emote at a guildmate records their name and still counts the emote',()=>{
  const h=setup();
  h.run('__emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),1);
  h.run('__emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),2);
});

test('a double-fired emote is counted once',()=>{
  const h=setup();
  h.run('MAMChronicles.Counters:OnEmote("WAVE","target"); MAMChronicles.Counters:OnEmote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),1);
});

test('non-guild players, NPCs, yourself and empty targets are not recorded but the emote still counts',()=>{
  const h=setup();
  h.run('__units.target={name="Zed",guild="Other",player=true}; __emote("WAVE","target")');
  h.run('__units.target={name="Guard",guild="Moms",player=false}; __emote("WAVE","target")');
  h.run('__units.target={name="Mumtest",guild="Moms",player=true}; __emote("WAVE","target")');
  h.run('__units.target=nil; __emote("WAVE")');
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_wave`),4);
  assert.equal(h.get(`MAMChroniclesDB.emoteTargets["${key}"]`),null);
});

test('an emote aimed at a character name is recorded only when they are on the guild roster',()=>{
  const h=setup();
  h.run('__units.target=nil; __emote("WAVE","Alice"); __emote("WAVE","Nobody")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1);
  assert.equal(h.get(targets('WAVE')+'.names.alice'),1);
});

test('the DoEmote hook passes the target through and SPIT is tracked',()=>{
  const h=setup();
  h.run('__t=__t+1; __hooks.DoEmote("SPIT","target")');
  assert.equal(h.get(`MAMChroniclesDB.counters["${key}"].emote_spit`),1);
  assert.equal(h.get(targets('SPIT')+'.names.alice'),1);
});

test('the per-emote name list stops growing at 1000 names',()=>{
  const h=setup();
  h.run(`MAMChroniclesDB.emoteTargets={["${key}"]={WAVE={distinct=1000,names={}}}}`);
  h.run('__units.target={name="Newbie",guild="Moms",player=true}; __emote("WAVE","target")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),1000);
  assert.equal(h.get(targets('WAVE')+'.names.newbie'),null);
});

test('emote targets are cleared with the Chronicle and always a table',()=>{
  const h=setup();
  h.run('__emote("WAVE","target"); MAMChronicles.Database:ClearHistory()');
  assert.equal(h.get('type(MAMChroniclesDB.emoteTargets)'),'table');
  assert.equal(h.get('next(MAMChroniclesDB.emoteTargets)'),null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `tools/mam-chronicles`): `node --test test/guild-medals.test.js`
Expected: FAIL (`attempt to call a nil value (method 'RosterRank')` and missing `emoteTargets`).

- [ ] **Step 3: Implement the roster helpers in `Comms.lua`**

Insert directly after `local function shortName(sender) ... end` (line 99):

```lua
-- Guild roster helpers. The rank comes from the roster the client has cached; an empty or stale roster fails closed.
function Comms:RequestRoster()
  if C_GuildInfo and C_GuildInfo.GuildRoster then pcall(C_GuildInfo.GuildRoster)
  elseif GuildRoster then pcall(GuildRoster) end
end

-- Rank index of a character on the cached roster (0 is the Guild Master), or nil when they are not on it.
function Comms:RosterRank(name)
  if not (GetNumGuildMembers and GetGuildRosterInfo) then return nil end
  local wanted = string.lower(shortName(name))
  local total = tonumber(Addon:SafeCall(GetNumGuildMembers)) or 0
  for index = 1, total do
    local member, _, rank = Addon:SafeCall(GetGuildRosterInfo, index)
    if member and string.lower(shortName(member)) == wanted then return tonumber(rank) end
  end
  return nil
end

function Comms:IsGuildmate(name) return self:RosterRank(name) ~= nil end
function Comms:IsGuildLead(name) return self:RosterRank(name) == 0 end
```

Also add `self:RequestRoster()` as the last line of `Comms:Initialise()` (before `end`).

- [ ] **Step 4: Implement emote target capture in `Counters.lua`**

Update the header comment (lines 5-6) to: `-- Privacy-safe activity counters for the silly Mom Medals. Counters are integers per category. Emote targets keep only a guildmate's lowercase first name and a count. Everything stays on this computer and is never sent or exported.`

Add `SPIT = true` to `trackedEmotes` (line 21) and add a constant after line 12: `local MAX_EMOTE_TARGETS = 1000`.

Replace `Counters:AddOnce` (lines 78-86) with:

```lua
-- Some sources fire twice for one real action; count each key at most once per window.
-- `before` runs only when the action is counted and before medals are re-evaluated.
function Counters:AddOnce(name, window, before)
  local now = clock()
  self.lastAdd = self.lastAdd or {}
  if self.lastAdd[name] and now - self.lastAdd[name] < window then return false end
  self.lastAdd[name] = now
  if before then before() end
  self:Add(name, 1)
  return true
end
```

Replace `Counters:OnEmote` (lines 120-124) with:

```lua
local function shortName(name) return (tostring(name or ""):match("^[^-]+")) or "" end

-- Who an emote was aimed at: a unit token ("target", "party1") or a character name. Only guildmates count.
function Counters:ResolveEmoteTarget(target)
  target = (type(target) == "string" and target ~= "") and target or "target"
  local name
  if safe(UnitExists, target) then
    if not safe(UnitIsPlayer, target) then return nil end
    local theirs, mine = safe(GetGuildInfo, target), safe(GetGuildInfo, "player")
    if not (theirs and mine and theirs == mine) then return nil end
    name = safe(UnitName, target)
  elseif Addon.Comms and Addon.Comms:IsGuildmate(target) then
    name = target
  end
  name = shortName(name)
  if name == "" or string.lower(name) == string.lower(shortName(safe(UnitName, "player"))) then return nil end
  return string.lower(name)
end

function Counters:RecordEmoteTarget(token, target)
  local database = Addon.db
  if not (database and Addon.characterKey) then return false end
  local name = self:ResolveEmoteTarget(target)
  if not name then return false end
  database.emoteTargets = type(database.emoteTargets) == "table" and database.emoteTargets or {}
  local character = database.emoteTargets[Addon.characterKey] or {}
  database.emoteTargets[Addon.characterKey] = character
  local row = type(character[token]) == "table" and character[token] or { distinct = 0, names = {} }
  character[token] = row
  row.names = type(row.names) == "table" and row.names or {}
  if not row.names[name] then
    if (tonumber(row.distinct) or 0) >= MAX_EMOTE_TARGETS then return false end
    row.distinct = (tonumber(row.distinct) or 0) + 1
  end
  row.names[name] = math.min(1000000, (row.names[name] or 0) + 1)
  return true
end

function Counters:OnEmote(token, target)
  token = string.upper(tostring(token or "")):gsub("^/", "")
  if not trackedEmotes[token] then return end
  self:AddOnce("emote_" .. string.lower(token), EMOTE_DEBOUNCE, function() self:RecordEmoteTarget(token, target) end)
end
```

Update both emote hooks in `Counters:Initialise` so the second argument is forwarded:
`function(token, target) Counters:OnEmote(token, target) end` (for `PerformEmote` at line 233 and `DoEmote` at line 234).

- [ ] **Step 5: Add `emoteTargets` to `Database.lua`**

- Line 34: change `challenges = {},` to `challenges = {}, emoteTargets = {},`.
- Line 46 and line 61: in each key list change `"challenges"}` to `"challenges","emoteTargets"}` (use two separate edits with surrounding context so each match is unique).
- Line 148: after `self.db.challenges = {}` add `self.db.emoteTargets = {}`.

- [ ] **Step 6: Run the new tests, then the whole suite**

Run: `node --test test/guild-medals.test.js` then `npm test`
Expected: new file PASS; full suite 482 + new tests, 0 fail. If `DoEmote` hook test fails because `__hooks.DoEmote` is nil, confirm `function DoEmote() end` precedes `Counters:Initialise` (it is in the `api` block, loaded before the addon files).

- [ ] **Step 7: Commit**

```bash
git add addons/MAMChronicles/Comms.lua addons/MAMChronicles/Counters.lua addons/MAMChronicles/Database.lua tools/mam-chronicles/test/guild-medals.test.js
git commit -m "feat: record which guildmate an emote was aimed at

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Variety and named medals

**Files:**
- Modify: `addons/MAMChronicles/Medals.lua` (context at `:427-467`; category/title blocks at `:545-610`; tracking text at `:26-31`)
- Test: `tools/mam-chronicles/test/guild-medals.test.js`

**Interfaces:**
- Consumes: `db.emoteTargets` from Task 1.
- Produces: `Medals:EmoteRow(token) -> row|nil`, context functions `ctx.distinctTargets(token)` and `ctx.targetCount(token, name)`, `Medals.namedMedals` (config table), category key `guild`, families `wave_people hug_people kiss_people cheer_people` plus one per named entry.

- [ ] **Step 1: Write the failing tests** (append to `guild-medals.test.js`)

```js
const visit=(names,token)=>`for _,n in ipairs({${names.map(n=>`"${n}"`).join(',')}}) do __units.target={name=n,guild="Moms",player=true}; __emote("${token}","target") end`;

test('waving at different guildies climbs the variety medal and repeats do not',()=>{
  const h=setup();
  h.run(visit(['Alice','Bea','Cat','Dee','Eve'],'WAVE')+'; __emote("WAVE","target"); MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(targets('WAVE')+'.distinct'),5);
  assert.ok(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_1`));
  assert.equal(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_2`),null);
});

test('the same person waved at fifteen times gives no second tier',()=>{
  const h=setup();
  h.run('for i=1,15 do __emote("WAVE","target") end; MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(`MAMChroniclesDB.medals["${key}"].earned.wave_people_1`),null);
});

test('a named medal counts emotes at that character only, ignoring case',()=>{
  const h=setup();
  h.run('__units.target={name="Hopeless",guild="Moms",player=true}; for i=1,10 do __emote("SPIT","target") end; __units.target={name="Alice",guild="Moms",player=true}; for i=1,50 do __emote("SPIT","target") end; MAMChronicles.Medals:Evaluate("t")');
  const earned=(id)=>h.get(`MAMChroniclesDB.medals["${key}"].earned.${id}`);
  assert.ok(earned('hopeless_spit_1')); assert.ok(earned('hopeless_spit_2')); assert.equal(earned('hopeless_spit_3'),null);
});

test('variety and named medals sit in the guild category and explain how they are tracked',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("wave_people_1").category'),'guild');
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("hopeless_spit_1").category'),'guild');
  assert.match(h.get('MAMChronicles.Medals:GetDefinition("wave_people_1").tracking'),/guildmates/);
  assert.match(h.get('MAMChronicles.Medals:GetDefinition("hopeless_spit_1").description'),/Spit at Hopeless/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/guild-medals.test.js`
Expected: the four new tests FAIL (`wave_people_1` is nil).

- [ ] **Step 3: Add the tracking text and context functions in `Medals.lua`**

In `trackingText` (line 26) add a key:
```lua
  targets = "Counted by the addon when you emote at guildmates. Only their first names and counts stay on this computer, never shared.",
  verified = "Confirmed by the Guild Lead. The addon cannot track this one, so it is awarded by hand.",
```

Add a method next to `Medals:BuildContext`:
```lua
function Medals:EmoteRow(token)
  local all = Addon.db and Addon.db.emoteTargets
  local character = all and all[Addon.characterKey]
  local row = character and character[token]
  if type(row) == "table" and type(row.names) == "table" then return row end
  return nil
end
```
And in the table returned by `BuildContext` (after `counter = ...`, before `characters`) add:
```lua
    distinctTargets = function(token) local row = Medals:EmoteRow(token); return row and tonumber(row.distinct) or 0 end,
    targetCount = function(token, name) local row = Medals:EmoteRow(token); return row and tonumber(row.names[string.lower(name)]) or 0 end,
```

- [ ] **Step 4: Register the medals**

Add a `guild` category to `Medals.categories` (insert before `seasonal`): `{ key = "guild", label = "Guild" },`.

Insert this block immediately before the line `for _, def in ipairs(definitions) do` that assigns `def.category` (line 566), so `Medals.familyCategory` already exists:

```lua
-- ---------------------------------------------------------------- guild medals (variety, named, verified)
-- Edit these two tables to add named-target and guild-verified medals, then release a new build.
-- Named: an emote aimed at one guild character. `targets` are the tier counts (up to 4); `title` is optional.
Medals.namedMedals = {
  { id = "hopeless_spit", name = "Hopeless Case", emote = "SPIT", target = "Hopeless", verb = "Spit at", targets = { 1, 10, 50 }, title = "Hopeless Mom" },
}
do
  local function distinct(token) return tagged("targets", function(ctx) return ctx.distinctTargets(token) end) end
  local function named(token, name) return tagged("targets", function(ctx) return ctx.targetCount(token, name) end) end
  series("wave_people", "Hello, Neighbours", "Wave at {n} different guildies.", { 5, 15, 40 }, bts, distinct("WAVE"))
  series("hug_people", "Group Hug", "Hug {n} different guildies.", { 5, 15, 40 }, bts, distinct("HUG"))
  series("kiss_people", "Smooch Squad", "Blow kisses at {n} different guildies.", { 5, 15, 40 }, bts, distinct("KISS"))
  series("cheer_people", "Pep Rally", "Cheer for {n} different guildies.", { 5, 15, 40 }, bts, distinct("CHEER"))
  for _, entry in ipairs(Medals.namedMedals) do
    series(entry.id, entry.name, entry.verb .. " " .. entry.target .. " {n} times.", entry.targets, #entry.targets > 3 and btsp or bts, named(entry.emote, entry.target))
  end
end
assignCategory("guild", "wave_people hug_people kiss_people cheer_people")
for _, entry in ipairs(Medals.namedMedals) do Medals.familyCategory[entry.id] = "guild" end

```

Add titles in the "remaining family" area: directly after the `for family, title in pairs({ ... }) do ... end` loop that follows `Medals.titles = {...}`, add:
```lua
for family, title in pairs({ wave_people = "Welcome Wagon Mom", hug_people = "Group Hug Mom", kiss_people = "Smooch Squad Mom", cheer_people = "Pep Rally Mom" }) do Medals.titles[family] = title end
for _, entry in ipairs(Medals.namedMedals) do Medals.titles[entry.id] = entry.title or (entry.name .. " Mom") end
```
(If the `pairs` loop's closing `end` is followed by other code, put these two loops right after it, before anything that reads `Medals.titles`.)

- [ ] **Step 5: Run the tests**

Run: `node --test test/guild-medals.test.js` then `npm test`
Expected: PASS. If Lua errors with "too many local variables", move the `local function distinct/named` helpers into the existing `do ... end` (already the case) and do not add any new file-level `local`.

- [ ] **Step 6: Commit**

```bash
git add addons/MAMChronicles/Medals.lua tools/mam-chronicles/test/guild-medals.test.js
git commit -m "feat: variety and named emote medals

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Guild-verified medals (definitions, locked display, grant and revoke)

**Files:**
- Modify: `addons/MAMChronicles/Medals.lua` (config block from Task 2; `Evaluate` at `:491-492`; `SetPinned` at `:961`; new methods at end of file)
- Modify: `addons/MAMChronicles/UI.lua` (`ToggleGoal` `:758`, `ShowMedalTooltip` `:767`, `BindMedalRow` `:784`, `RefreshMedals` `:914`)
- Test: `tools/mam-chronicles/test/guild-medals.test.js`

**Interfaces:**
- Produces: `Medals.verifiedMedals` config; defs with `verified = true`; `Medals:GrantVerified(id, opts) -> ok, reason` (`opts.test`), `Medals:RevokeVerified(id) -> ok, reason`, `Medals:ClearTestGrants() -> count`, `Medals:ListVerifiedIds() -> "a, b"`.
- Reasons: `"unknown"`, `"not ready"`, `"already"`, `"not earned"`.

- [ ] **Step 1: Write the failing tests** (append)

```js
const earnedRow=(id)=>`MAMChroniclesDB.medals["${key}"].earned.${id}`;

test('a verified medal exists, is never earned by play and lists as locked',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:GetDefinition("selfie_squad").verified'),true);
  h.run('MAMChronicles.Medals:Evaluate("t")');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:SetMedalSearch("selfie squad"); __row=MAMChronicles.UI.medalRows[1]');
  assert.match(h.get('__row.progress.text'),/See Guild Lead to unlock \/ award points!/);
  assert.equal(h.get('__row.points.text'),'Guild Lead');
});

test('a verified medal cannot be pinned as a goal',()=>{
  const h=setup();
  assert.equal(h.get('MAMChronicles.Medals:SetPinned("selfie_squad",true)'),false);
});

test('a real grant pays Mom Money once, a test grant pays nothing',()=>{
  const h=setup();
  h.run('__before=MAMChronicles.Medals:GetEarnedMoney()');
  assert.equal(h.get('MAMChronicles.Medals:GrantVerified("selfie_squad")'),true);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before')+25);
  assert.equal(h.get('MAMChronicles.Medals:GrantVerified("selfie_squad")'),false);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before')+25);
  const t=setup();
  t.run('__before=MAMChronicles.Medals:GetEarnedMoney()');
  assert.equal(t.get('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true})'),true);
  assert.equal(t.get(earnedRow('selfie_squad')+'.test'),true);
  assert.equal(t.get('MAMChronicles.Medals:GetEarnedMoney()'),t.get('__before'));
});

test('only verified medals can be granted and unknown ones are refused',()=>{
  const h=setup();
  assert.equal(h.get('select(1,MAMChronicles.Medals:GrantVerified("wine_1"))'),false);
  assert.equal(h.get('select(2,MAMChronicles.Medals:GrantVerified("nope"))'),'unknown');
  assert.equal(h.get(earnedRow('wine_1')),null);
});

test('revoke removes a verified award and its Mom Money, and clearing removes only test grants',()=>{
  const h=setup();
  h.run('__before=MAMChronicles.Medals:GetEarnedMoney(); MAMChronicles.Medals:GrantVerified("selfie_squad")');
  assert.equal(h.get('MAMChronicles.Medals:RevokeVerified("selfie_squad")'),true);
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get('MAMChronicles.Medals:GetEarnedMoney()'),h.get('__before'));
  assert.equal(h.get('select(2,MAMChronicles.Medals:RevokeVerified("selfie_squad"))'),'not earned');
  h.run('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true}); __n=MAMChronicles.Medals:ClearTestGrants()');
  assert.equal(h.get('__n'),1); assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('a real grant toasts and announces to the guild, a test grant stays quiet',()=>{
  const h=setup();
  h.run('MAMChronicles.Medals:GrantVerified("selfie_squad")');
  assert.equal(h.get('__sent[1][2]'),'M1|selfie_squad|25|1');
  const t=setup(); t.run('MAMChronicles.Medals:GrantVerified("selfie_squad",{test=true})');
  assert.equal(t.get('#__sent'),0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/guild-medals.test.js`
Expected: the six new tests FAIL (`selfie_squad` is nil).

- [ ] **Step 3: Register verified medals in `Medals.lua`**

Directly after `Medals.namedMedals = {...}` (added in Task 2) add the config:
```lua
-- Verified: things the addon cannot observe (for example Discord posts). The Guild Master awards them by hand.
Medals.verifiedMedals = {
  { id = "selfie_squad", name = "Selfie Squad", tier = "silver", description = "Post 10 selfies in the Moms Discord.", title = "Selfie Mom" },
}
```
Inside the existing `do ... end` block from Task 2, after the `namedMedals` loop, add:
```lua
  for _, entry in ipairs(Medals.verifiedMedals) do
    register({ id = entry.id, family = entry.id, name = entry.name, tier = entry.tier, target = 1, description = entry.description,
      value = tagged("verified", function() return 0 end), verified = true })
  end
```
After the `namedMedals` family/category loop add: `for _, entry in ipairs(Medals.verifiedMedals) do Medals.familyCategory[entry.id] = "guild" end`.
After the titles loops add: `for _, entry in ipairs(Medals.verifiedMedals) do Medals.titles[entry.id] = entry.title or (entry.name .. " Mom") end`.

- [ ] **Step 4: Guard play-based earning and pinning**

In `Medals:Evaluate` change line 492 to:
`if not def.verified and not row.earned[def.id] and self:IsAvailable(def) and def.value(ctx) >= def.target then`

In `Medals:SetPinned` change `if not def or not self:IsAvailable(def) then return false end` to `if not def or def.verified or not self:IsAvailable(def) then return false end`.

- [ ] **Step 5: Add grant, revoke and helpers at the end of `Medals.lua`**

```lua
-- ---------------------------------------------------------------- guild-verified awards
-- Granted by the Guild Master's award message (or a local test grant), never by tracking.
function Medals:ListVerifiedIds()
  local ids = {}
  for _, def in ipairs(definitions) do if def.verified then ids[#ids + 1] = def.id end end
  return table.concat(ids, ", ")
end

function Medals:GrantVerified(id, opts)
  local def = definitionsById[id]
  local database, key = Addon.db, Addon.characterKey
  if not (def and def.verified and database and key) then return false, "unknown" end
  local row = database.medals and database.medals[key]
  if not row then return false, "not ready" end
  if row.earned[id] then return false, "already" end
  local test = opts and opts.test == true
  row.earned[id] = { at = Addon:Now(), points = test and 0 or def.points, verified = true, test = test or nil }
  self.newIds[id] = true
  if test then
    if Addon.Toast then Addon:Guard("Verified", Addon.Toast.Show, Addon.Toast, { kind = "medal", title = "[TEST] " .. def.name, text = def.description, points = 0, action = "Medals" }) end
    return true
  end
  row.total = (tonumber(row.total) or 0) + def.points
  if Addon.EventStore then Addon.EventStore:Append("medal.earned", { medalId = def.id, medalName = def.name, points = def.points }) end
  notify(def, { retro = false, reason = "award" })
  return true
end

function Medals:RevokeVerified(id)
  local def = definitionsById[id]
  local row = Addon.db and Addon.db.medals and Addon.db.medals[Addon.characterKey]
  if not (def and def.verified and row) then return false, "unknown" end
  local earned = row.earned[id]
  if not earned then return false, "not earned" end
  if not earned.test then row.total = math.max(0, (tonumber(row.total) or 0) - (tonumber(earned.points) or def.points)) end
  row.earned[id] = nil
  return true
end

function Medals:ClearTestGrants()
  local row = Addon.db and Addon.db.medals and Addon.db.medals[Addon.characterKey]
  local removed = 0
  if not row then return 0 end
  for _, def in ipairs(definitions) do
    local earned = row.earned[def.id]
    if def.verified and earned and earned.test then row.earned[def.id] = nil; removed = removed + 1 end
  end
  return removed
end
```

- [ ] **Step 6: Locked display in `UI.lua`**

`UI:BindMedalRow`: after the existing `safeMethod(row.points, "SetText", "+" .. tostring(def.points))` line add:
```lua
  local lockedVerified = def.verified and not entry.earned
  if lockedVerified then safeMethod(row.points, "SetText", "Guild Lead") end
```
Replace the not-earned branch of the progress text (the `else` block that builds `tostring(current) .. " / " .. tostring(entry.target)`) with:
```lua
  elseif lockedVerified then
    safeMethod(row.progress, "SetText", "See Guild Lead to unlock / award points!")
    paint(C.accent[1], C.accent[2], C.accent[3], 0)
  else
```
(keep the original two lines inside the final `else`).

`UI:ShowMedalTooltip`: in the `else` (not earned) branch, replace the progress and pin lines with a verified-aware version:
```lua
    if def.verified then
      safeMethod(GameTooltip, "AddLine", "See Guild Lead to unlock / award points!", 0.9, 0.8, 0.3, true)
    else
      safeMethod(GameTooltip, "AddLine", "Progress: " .. tostring(math.floor(math.min(entry.current, entry.target))) .. " / " .. tostring(entry.target), 0.9, 0.8, 0.3, true)
      safeMethod(GameTooltip, "AddLine", Addon.Medals:IsPinned(def.id) and "Click to unpin this goal." or "Click to pin as a goal.", 0.6, 0.8, 1, true)
    end
```

`UI:ToggleGoal`: replace the first guard with:
```lua
  local entry = row and row.entry
  if button ~= "LeftButton" or not entry then return end
  if entry.def.verified then self:AwardFromRow(entry); return end
  if entry.earned then return end
```
Add a stub so this task's code is complete (Task 5 fills it in):
```lua
function UI:AwardFromRow(entry) end
```

`UI:RefreshMedals`: change `if not entry.earned and not familySeen[entry.def.family] then` to `if not entry.earned and not entry.def.verified and not familySeen[entry.def.family] then`.

- [ ] **Step 7: Run the tests**

Run: `node --test test/guild-medals.test.js` then `npm test`
Expected: PASS. If `__row.progress.text` is nil, `UI:SetMedalSearch` did not bind rows: call `MAMChronicles.UI:RefreshMedals()` after it in the test.

- [ ] **Step 8: Commit**

```bash
git add addons/MAMChronicles/Medals.lua addons/MAMChronicles/UI.lua tools/mam-chronicles/test/guild-medals.test.js
git commit -m "feat: guild-verified medals with grant and revoke

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Award messages, authority check and test mode (`Comms.lua`)

**Files:**
- Modify: `addons/MAMChronicles/Comms.lua` (`status` at `:19`, `OnAddonMessage` at `:114-141`, new functions)
- Test: `tools/mam-chronicles/test/guild-medals.test.js`

**Interfaces:**
- Consumes: `Comms:RosterRank`, `Medals:GrantVerified`, `Medals:RevokeVerified`.
- Produces: `Comms.testMode` (session flag), `Comms:CanAward() -> bool`, `Comms:SendAward(kind, recipient, medalId) -> ok, reason` with `kind` `"A1"` (award) or `"R1"` (revoke), `Comms.status.awards`, `Comms.status.unverified`.

- [ ] **Step 1: Write the failing tests** (append)

```js
const msg=(h,text,channel,sender)=>h.fire('CHAT_MSG_ADDON','MAMCHR',text,channel,sender);

test('an award from the Guild Master over the guild channel is granted',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),null);
  assert.equal(h.get('MAMChronicles.Comms.status.awards'),1);
});

test('awards from anyone but the Guild Master are refused and counted',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Stranger-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get('MAMChronicles.Comms.status.unverified'),2);
});

test('an empty roster fails closed',()=>{
  const h=setup(); h.run('__roster={}');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('awards for someone else, unknown or unverified medals, bad versions and wrong channels are ignored',()=>{
  const h=setup();
  msg(h,'A1|Someone|selfie_squad|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|nope|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|wine_1|1','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|9','GUILD','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','SAY','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Boss-Draenor');
  msg(h,'A1|Mumtest|selfie_squad|1|extra','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  assert.equal(h.get(earnedRow('wine_1')),null);
});

test('with test mode on a whispered award is accepted as a test grant, otherwise not',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
  h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','WHISPER','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
});

test('test mode does not let a non-lead guild message through',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('a revoke from the Guild Master removes the award',()=>{
  const h=setup();
  msg(h,'A1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  msg(h,'R1|Mumtest|selfie_squad|1','GUILD','Alice-Draenor');
  assert.ok(h.get(earnedRow('selfie_squad')));
  msg(h,'R1|Mumtest|selfie_squad|1','GUILD','Boss-Draenor');
  assert.equal(h.get(earnedRow('selfie_squad')),null);
});

test('existing medal announcements still work next to awards',()=>{
  const h=setup();
  msg(h,'M1|quest_machine_2|25|1','GUILD','Alice-Draenor');
  assert.equal(h.get('MAMChronicles.Comms.status.received'),1);
});

test('only the Guild Master can send an award, as one guild message',()=>{
  const h=setup();
  let r=h.get('select(2,MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad"))');
  assert.match(r,/Guild Master/); assert.equal(h.get('#__sent'),0);
  h.run('__roster[1][3]=0');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad")'),true);
  assert.equal(h.get('__sent[1][2]'),'A1|Alice|selfie_squad|1'); assert.equal(h.get('__sent[1][3]'),'GUILD');
  assert.equal(h.get('select(1,MAMChronicles.Comms:SendAward("A1","Alice","wine_1"))'),false);
  assert.equal(h.get('#__sent'),1);
});

test('in test mode an award is whispered, or applied locally when aimed at yourself',()=>{
  const h=setup(); h.run('MAMChronicles.Comms.testMode=true');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Alice","selfie_squad")'),true);
  assert.equal(h.get('__sent[1][3]'),'WHISPER'); assert.equal(h.get('__sent[1][4]'),'Alice');
  h.run('__sent={}');
  assert.equal(h.get('MAMChronicles.Comms:SendAward("A1","Mumtest","selfie_squad")'),true);
  assert.equal(h.get('#__sent'),0);
  assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/guild-medals.test.js`
Expected: the new tests FAIL (awards ignored / `SendAward` nil).

- [ ] **Step 3: Extend status and rewrite `OnAddonMessage`**

Line 19: change status to `{ state = "starting", sent = 0, received = 0, dropped = 0, unknown = 0, otherVersion = 0, awards = 0, unverified = 0 }`.

Replace `Comms:OnAddonMessage` (lines 114-141) with:

```lua
-- Award (A1) and revoke (R1) messages: `<type>|<recipient>|<medalId>|<version>`.
-- Real ones need the sender to be the Guild Master on the guild channel. Test mode also accepts whispers.
function Comms:HandleAward(kind, channel, sender, parts)
  local test = false
  if channel == "GUILD" then
    if self:RosterRank(sender) ~= 0 then self.status.unverified = self.status.unverified + 1; self:RequestRoster(); return end
  elseif channel == "WHISPER" and self.testMode == true then
    test = true
  else
    drop(self); return
  end
  local player = Addon:SafeCall(UnitName, "player")
  if not player or string.lower(parts[2]) ~= string.lower(player) then return end
  local def = Addon.Medals and Addon.Medals:GetDefinition(parts[3])
  if not (def and def.verified) or tonumber(parts[4]) ~= Addon.Medals.version then drop(self); return end
  local ok
  if kind == "A1" then ok = Addon.Medals:GrantVerified(def.id, { test = test }) else ok = Addon.Medals:RevokeVerified(def.id) end
  if ok then self.status.awards = self.status.awards + 1 end
end

function Comms:OnAddonMessage(prefix, text, channel, sender)
  if prefix ~= PREFIX then return end
  if channel ~= "GUILD" and channel ~= "WHISPER" then drop(self); return end
  sender = tostring(sender or "")
  if #sender == 0 or #sender > 60 or sender:find("[%c|]") then drop(self); return end
  local player = Addon:SafeCall(UnitName, "player")
  if player and shortName(sender) == player then return end
  if type(text) ~= "string" or #text > MAX_LENGTH then drop(self); return end
  local parts = {}
  for piece in (text .. "|"):gmatch("([^|]*)|") do table.insert(parts, piece) end
  if #parts ~= 4 then drop(self); return end
  if parts[1] == "A1" or parts[1] == "R1" then
    if not (parts[2]:match("^[^%s%c|]+$") and #parts[2] <= 24 and parts[3]:match("^[%w_]+$") and #parts[3] <= 40) then drop(self); return end
    self:HandleAward(parts[1], channel, sender, parts)
    return
  end
  if parts[1] ~= "M1" or channel ~= "GUILD" then drop(self); return end
  if settings().receiveGuildAlerts == false then return end
  if not parts[2]:match("^[%w_]+$") or #parts[2] > 40 then drop(self); return end
  local def = Addon.Medals and Addon.Medals:GetDefinition(parts[2])
  -- A newer or older build may know medals this one does not: count them quietly instead of treating them as attacks.
  local kind
  if not def then kind = "unknown"
  elseif tonumber(parts[4]) ~= Addon.Medals.version then kind = "otherVersion"
  elseif tonumber(parts[3]) ~= def.points then drop(self); return end
  local stamps = self.floods[sender] or {}
  local kept, current = {}, now()
  for _, stamp in ipairs(stamps) do if current - stamp < FLOOD_WINDOW then table.insert(kept, stamp) end end
  if #kept >= FLOOD_LIMIT then self.floods[sender] = kept; drop(self); return end
  table.insert(kept, current); self.floods[sender] = kept
  if kind then self.status[kind] = self.status[kind] + 1; return end
  self.status.received = self.status.received + 1
  self:Record(sender, def)
end
```

- [ ] **Step 4: Add sending**

Append to `Comms.lua`:

```lua
-- The UI shows award actions to the Guild Master (or in test mode). The real check is on every receiver.
function Comms:CanAward()
  return self.testMode == true or Addon:SafeCall(IsGuildLeader) == true
end

function Comms:ApplyLocal(kind, medalId)
  if kind == "A1" then return Addon.Medals:GrantVerified(medalId, { test = true }) end
  return Addon.Medals:RevokeVerified(medalId)
end

-- kind is "A1" (award) or "R1" (revoke). Returns ok, reason.
function Comms:SendAward(kind, recipient, medalId)
  local def = Addon.Medals and Addon.Medals:GetDefinition(medalId)
  if not (def and def.verified) then return false, "not a verified medal" end
  recipient = tostring(recipient or "")
  if not (recipient:match("^[^%s%c|]+$") and #recipient <= 24) then return false, "bad character name" end
  local text = string.format("%s|%s|%s|%d", kind, recipient, medalId, Addon.Medals.version)
  if #text > MAX_LENGTH then return false, "message too long" end
  local player = Addon:SafeCall(UnitName, "player")
  if self.testMode == true then
    if player and string.lower(shortName(recipient)) == string.lower(player) then return self:ApplyLocal(kind, medalId) end
    local send = sendFunction()
    if not send then return false, "unavailable" end
    local outcome = classify(pcall(send, PREFIX, text, "WHISPER", recipient))
    return outcome == "sent", outcome
  end
  self:RequestRoster()
  if not (player and self:IsGuildLead(player)) then return false, "only the Guild Master can award medals (guild roster may still be loading)" end
  local reason = self:Availability()
  if reason then return false, reason end
  local outcome = classify(pcall(sendFunction(), PREFIX, text, "GUILD"))
  return outcome == "sent", outcome
end
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/guild-medals.test.js` then `npm test`
Expected: PASS, including the unchanged `comms.test.js` and `comms-versions.test.js` (their invalid-message cases still count as dropped/unknown/otherVersion). If a `comms*` test fails, check that the `receiveGuildAlerts == false` check still returns before any counter is touched.

- [ ] **Step 6: Commit**

```bash
git add addons/MAMChronicles/Comms.lua tools/mam-chronicles/test/guild-medals.test.js
git commit -m "feat: Guild Master award messages with roster authority and test mode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Slash commands, click-to-award, test-mode tag and diagnostics

**Files:**
- Modify: `addons/MAMChronicles/UI.lua` (`AwardFromRow` stub from Task 3, `RefreshMedals` `:937`, `ShowMedalTooltip`, `helpLines` `:1235`, `HandleSlash` `:1256`)
- Modify: `addons/MAMChronicles/Export.lua:104`
- Test: `tools/mam-chronicles/test/guild-medals.test.js`

**Interfaces:**
- Consumes: `Comms:SendAward`, `Comms:CanAward`, `Comms.testMode`, `Medals:ClearTestGrants`, `Medals:ListVerifiedIds`.
- Produces: `/mam award <character> <medal id>`, `/mam revoke <character> <medal id>`, `/mam testmode on|off|clear`, `UI:AwardFromRow(entry)`, `UI:HandleAward(kind, rest)`, `UI:HandleTestMode(arg)`.

- [ ] **Step 1: Write the failing tests** (append)

```js
const said=(h)=>h.calls.printed.join('\n');

test('/mam award sends for the Guild Master and explains usage and refusals',()=>{
  const h=setup();
  h.slash('award'); assert.match(said(h),/selfie_squad/);
  h.calls.printed.length=0; h.slash('award Alice selfie_squad'); assert.match(said(h),/Could not send/);
  h.run('__roster[1][3]=0'); h.calls.printed.length=0; h.slash('award Alice selfie_squad');
  assert.match(said(h),/Award sent to Alice/); assert.equal(h.get('__sent[1][2]'),'A1|Alice|selfie_squad|1');
  h.slash('revoke Alice selfie_squad'); assert.equal(h.get('__sent[2][2]'),'R1|Alice|selfie_squad|1');
});

test('/mam testmode toggles the session flag, shows the tag and clears test grants',()=>{
  const h=setup();
  h.slash('testmode on'); assert.equal(h.get('MAMChronicles.Comms.testMode'),true);
  h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:RefreshMedals()');
  assert.match(h.get('MAMChronicles.UI.medalSub.text'),/TEST MODE/);
  h.slash('award Mumtest selfie_squad'); assert.equal(h.get(earnedRow('selfie_squad')+'.test'),true);
  h.slash('testmode clear'); assert.equal(h.get(earnedRow('selfie_squad')),null);
  h.slash('testmode off'); assert.equal(h.get('MAMChronicles.Comms.testMode'),false);
  h.run('MAMChronicles.UI:RefreshMedals()'); assert.doesNotMatch(h.get('MAMChronicles.UI.medalSub.text'),/TEST MODE/);
});

test('clicking a verified medal awards the targeted player, only for the Guild Master',()=>{
  const h=setup();
  h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:SetActiveTab("Medals"); MAMChronicles.UI:SetMedalSearch("selfie squad"); MAMChronicles.UI:RefreshMedals(); __row=MAMChronicles.UI.medalRows[1]');
  h.run('__row.scripts.OnMouseUp(__row,"LeftButton")'); assert.equal(h.get('#__sent'),0);
  h.run('__isLead=true; __roster[1][3]=0; __row.scripts.OnMouseUp(__row,"LeftButton")');
  assert.equal(h.get('__sent[1][2]'),'A1|Alice|selfie_squad|1');
  h.run('__units.target=nil; __sent={}; __row.scripts.OnMouseUp(__row,"LeftButton")');
  assert.equal(h.get('#__sent'),0); assert.match(said(h),/Target a player/);
});

test('help lists the new commands and diagnostics report awards',()=>{
  const h=setup(); h.slash('help');
  for(const c of ['/mam award','/mam revoke','/mam testmode']) assert.ok(said(h).includes(c),c);
  h.run('__d=MAMChronicles.Export:BuildDiagnosticReport()');
  assert.match(h.get('__d'),/Awards: accepted 0, unverified 0, test mode off/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/guild-medals.test.js`
Expected: the four new tests FAIL (`Unknown command "award"`).

- [ ] **Step 3: Implement in `UI.lua`**

Replace the `UI:AwardFromRow` stub with:

```lua
function UI:AwardFromRow(entry)
  if not (Addon.Comms and Addon.Comms:CanAward()) then return end
  local target = Addon:SafeCall(UnitName, "target")
  if not (target and Addon:SafeCall(UnitIsPlayer, "target")) then Addon:Print("Target a player, then click the medal to award it."); return end
  local ok, why = Addon.Comms:SendAward("A1", target, entry.def.id)
  Addon:Print(ok and ("Awarded " .. entry.def.name .. " to " .. target .. ".") or ("Could not award: " .. tostring(why)))
end

function UI:HandleAward(kind, rest)
  local name, id = (rest or ""):match("^(%S+)%s+(%S+)$")
  local verb = kind == "A1" and "award" or "revoke"
  if not name then
    Addon:Print("Usage: /mam " .. verb .. " <character> <medal id>. Verified medals: " .. Addon.Medals:ListVerifiedIds())
    return
  end
  local ok, why = Addon.Comms:SendAward(kind, name, id)
  Addon:Print(ok and ((kind == "A1" and "Award" or "Revoke") .. " sent to " .. name .. ".") or ("Could not send: " .. tostring(why)))
end

function UI:HandleTestMode(arg)
  arg = string.lower(arg or "")
  if arg == "on" then Addon.Comms.testMode = true; Addon:Print("Test mode ON for this session. Awards go by whisper or to yourself and count as test awards.")
  elseif arg == "off" then Addon.Comms.testMode = false; Addon:Print("Test mode off.")
  elseif arg == "clear" then Addon:Print("Removed " .. tostring(Addon.Medals:ClearTestGrants()) .. " test awards.")
  else Addon:Print("Test mode is " .. (Addon.Comms.testMode and "ON" or "off") .. ". Use /mam testmode on, off or clear."); return end
  if self.medalsArea then self:RefreshMedals() end
end
```

`HandleSlash`: add before the `elseif verb=="help"` branch:
```lua
  elseif verb=="award" then self:HandleAward("A1",rest)
  elseif verb=="revoke" then self:HandleAward("R1",rest)
  elseif verb=="testmode" then self:HandleTestMode(rest)
```

`helpLines`: add before the `/mam help` line:
```lua
  "/mam award <character> <medal id> - Guild Master only: award a guild-verified medal",
  "/mam revoke <character> <medal id> - Guild Master only: take a verified medal back",
  "/mam testmode on|off|clear - try awards without a guild (session only, test awards pay nothing)",
```

`RefreshMedals` (line 937): change the start `safeMethod(self.medalSub, "SetText", tostring(summary.count)` to `local subText = tostring(summary.count)`, change the line's ending `or ""))` to `or "")`, and on the next line add:
```lua
  if Addon.Comms and Addon.Comms.testMode then subText = subText .. "  \194\183  TEST MODE" end
  safeMethod(self.medalSub, "SetText", subText)
```

`ShowMedalTooltip`: inside the `if def.verified then` branch from Task 3 add one more line after the "See Guild Lead" line:
```lua
      if Addon.Comms and Addon.Comms:CanAward() then safeMethod(GameTooltip, "AddLine", "Guild Master: target a player and click to award.", 0.6, 0.8, 1, true) end
```

- [ ] **Step 4: Add the diagnostics line in `Export.lua`**

After line 104 (the `Guild sharing:` line) add:
```lua
  if Addon.Comms then local cs=Addon.Comms.status; table.insert(lines,"Awards: accepted "..tostring(cs.awards or 0)..", unverified "..tostring(cs.unverified or 0)..", test mode "..(Addon.Comms.testMode and "on" or "off")) end
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/guild-medals.test.js` then `npm test`
Expected: PASS. Existing help and diagnostics tests only match substrings, so the extra lines are safe.

- [ ] **Step 6: Commit**

```bash
git add addons/MAMChronicles/UI.lua addons/MAMChronicles/Export.lua tools/mam-chronicles/test/guild-medals.test.js
git commit -m "feat: award and revoke commands, test mode, click-to-award

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documentation and final verification

**Files:**
- Modify: `addons/MAMChronicles/CHANGELOG.md`, `addons/MAMChronicles/README.md`, `PROJECT-HANDOFF.md`
- Verify: whole suite and packaging script dry check

- [ ] **Step 1: Changelog and README**

At the top of `CHANGELOG.md` (above `## 0.2.0-alpha20`) add:

```markdown
## Unreleased

- **Variety medals:** wave, hug, kiss or cheer at 5, 15 or 40 different guildies. The addon keeps each guildmate's lowercase first name and a count per emote on this computer only (never sent or exported; cleared with the Chronicle).
- **Named medals:** for example "Hopeless Case": spit at a named guild character 1, 10 or 50 times. The list is a table in `Medals.lua` (`Medals.namedMedals`).
- **Guild-verified medals:** things the addon cannot see (for example "Selfie Squad"). They show as locked, "See Guild Lead to unlock / award points!". Only the Guild Master can award them: `/mam award <character> <medal id>`, `/mam revoke <character> <medal id>`, or target a player and click the medal. Receivers accept an award only from the guild channel when the sender is Guild Master on their own roster.
- **Test mode:** `/mam testmode on|off|clear` lets you try awards outside a guild by whisper or on yourself. Session only; test awards pay no Mom Money.
- `/mam diag` has an `Awards:` line.
```

In `README.md` add the three commands to the command list (same wording as the help lines) and one privacy sentence: "Variety and named medals keep guildmates' lowercase first names and counts on your computer only."

- [ ] **Step 2: Handoff note**

Append a short section to `PROJECT-HANDOFF.md` headed `Guild medals (30 Sep 2026) - AUTOMATED EVIDENCE ONLY` listing: what was added, the three deviations from the spec (per-character store, 1000-name cap, session-only test mode, no auto-complete), and the unverified-live items: `IsGuildLeader`/roster rank on Forever vs Retail, whether `/wave` with no argument passes the target to the emote hook, whether `GetGuildRosterInfo` has data right after login (the addon requests a roster refresh at start and before sending), and that awards only reach players who are online when sent.

- [ ] **Step 3: Full verification**

Run (from `tools/mam-chronicles`): `npm test`
Expected: all tests pass (482 baseline + the new file), 0 fail.

Run (from the repository root): `git status --short`
Expected: only the files listed in this plan changed.

- [ ] **Step 4: Commit**

```bash
git add addons/MAMChronicles/CHANGELOG.md addons/MAMChronicles/README.md PROJECT-HANDOFF.md
git commit -m "docs: changelog, readme and handoff for guild medals

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** emote target capture (Task 1); variety and named medals from a config table (Task 2); verified medals with locked text (Task 3); `A1`/`R1`, rank-0 authority, sender and recipient checks (Task 4); test mode and WHISPER path, `clear` (Tasks 4-5); award buttons visible only to the Guild Master via `IsGuildLeader()` and real authority on receivers (Tasks 4-5); roster reads (Task 1). Spec item "roster auto-complete" is dropped deliberately (see Global Constraints).
- **Type consistency:** `GrantVerified(id, opts)`, `RevokeVerified(id)`, `SendAward(kind, recipient, medalId)`, `RosterRank(name)`, `OnEmote(token, target)` are used with the same signatures in every task.
- **Known risk:** the main chunk of `Medals.lua` may hit Lua's 200-locals limit; all new helpers live inside a `do ... end` block or are methods. Task 2 step 5 says what to do if it fails.
