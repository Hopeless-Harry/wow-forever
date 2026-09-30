# Moms Against Magic Chronicles Phase 1 Tester Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a separately installable `MAMChronicles` first-pass addon for Retail and WoW Forever that testers can use to record, browse, search, summarise, and export a persistent personal adventure chronicle.

**Architecture:** The addon uses a versioned SavedVariables database and a validated append-only event store. Focused collectors translate supported WoW events into stable Chronicle records, while query/statistics modules read those records without mutating them. A four-tab Blizzard-style window exposes the timeline, statistics, settings, diagnostics, and copyable exports; the existing diagnostics addon remains separate and installable alongside it.

**Tech Stack:** WoW Lua 5.1-compatible code; interfaces `120100`, `120105`, and `16001`; dependency-free Blizzard UI; Node.js built-in test runner; Fengari; PowerShell 7 packaging and safe installation.

**Spec:** `docs/discovery/2026-09-29-moms-against-magic-chronicles-research.md`

## Global Constraints

- The shipped addon folder and SavedVariables key are `MAMChronicles`; slash commands begin with `/mam`.
- Version the first tester build as `0.2.0-alpha1` and database schema as `1`.
- Support both Retail and Forever from one file list; capability-gate APIs that differ or disappear.
- Do not copy code, art, prose, or data from All Rights Reserved references.
- Do not import GPL code into the addon; GPL references inform independent implementations only.
- Store only gameplay facts needed by the Chronicle. Never store chat, whispers, BattleTags, account-folder paths, IP addresses, gold, mail, trades, or continuous movement trails.
- Exact coordinates may be stored only on a notable event or explicit manual memory.
- Never invent a killer, ability, quest name, item quality, location, or completion state. Store `unknown` or omit the field when the client cannot prove it.
- Every statistic must expose its reporting window and source event count; absent events mean unknown coverage, not zero guild activity.
- Cap raw local history at 10,000 events by default, retaining aggregate counters and pinned manual memories when compacting.
- Packaging must contain an explicit allowlist only. Installation must refuse while `Wow.exe` or `WowB.exe` is running and back up an existing target before replacement.
- No guild sync, live location sharing, Pi upload, raid scoring, or automatic public posting ships in Phase 1.

## File Structure

```text
addons/MAMChronicles/
|-- MAMChronicles.toc      manifest and load order
|-- Core.lua               namespace, safe calls, clock, character/session identity
|-- Database.lua           schema, migration, settings, retention and snapshots
|-- EventStore.lua         event validation, IDs, deduplication and queries
|-- Collectors.lua         WoW event registration and observation adapters
|-- Statistics.lua         deterministic personal aggregates and light-hearted awards
|-- Export.lua             redacted diagnostic and machine-readable copy exports
|-- UI.lua                 Chronicle, Statistics, Settings and Diagnostics tabs
`-- README.md              tester-facing installation and usage

tools/mam-chronicles/
|-- package.json
`-- test/
    |-- harness.js
    |-- manifest.test.js
    |-- database.test.js
    |-- event-store.test.js
    |-- collectors.test.js
    |-- statistics.test.js
    |-- export.test.js
    |-- ui.test.js
    `-- package-install.test.js

scripts/
|-- package-mam-chronicles.ps1
`-- install-mam-chronicles.ps1

docs/testing/
`-- mam-chronicles-phase1-tester-checklist.md
```

## Review Focus

- A malformed, oversized, duplicate, or future-schema event must be rejected without altering the database; Task 2 pins all four cases.
- Missing, throwing, secret, or partially loaded WoW APIs must degrade to truthful unknown fields without breaking other collectors; Task 3 tests each class.
- Repeated zone/profession signals and reload-generated login events must not flood the timeline; Task 3 tests semantic deduplication and snapshot comparison.
- Corrupt legacy SavedVariables must recover into a valid schema while preserving a bounded backup record and without executing stored data; Task 1 tests recovery.
- Search, statistics, exports, and UI must handle 0 and 10,000 events deterministically without leaking injected chat, account-path, or BattleTag markers; Tasks 4–6 pin those boundaries.

---

### Task 1: Scaffold the production addon and persistent database

**Files:**
- Create: `addons/MAMChronicles/MAMChronicles.toc`
- Create: `addons/MAMChronicles/Core.lua`
- Create: `addons/MAMChronicles/Database.lua`
- Create: `tools/mam-chronicles/package.json`
- Create: `tools/mam-chronicles/test/harness.js`
- Create: `tools/mam-chronicles/test/manifest.test.js`
- Create: `tools/mam-chronicles/test/database.test.js`

**Interfaces:**
- Consumes: WoW globals supplied at runtime or by the Fengari harness.
- Produces: global `MAMChronicles`; `MAMChronicles:Boot()`; `MAMChronicles.Database:Open(saved)`; `GetSettings()`; `GetCharacter()`; `BeginSession()`; `EndSession()`; `Compact()`.

- [ ] **Step 1: Write failing manifest and database tests**

Test exact TOC interfaces, SavedVariables name, eight-file load order, version `0.2.0-alpha1`, new-schema defaults, stable character identity from `UnitGUID`, load counting, session creation, settings preservation, schema rejection, corrupt-root recovery, 10,000-event retention, and preservation of pinned manual memories.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm install --prefix tools/mam-chronicles && npm test --prefix tools/mam-chronicles -- --test-name-pattern="manifest|database|session|compact"`

Expected: FAIL because the production addon and harness do not exist.

- [ ] **Step 3: Implement the harness, manifest, core, and database**

Use database shape:

```lua
{
  schemaVersion = 1,
  meta = { createdAt, updatedAt, loadCount, addonVersion, clientBuild },
  settings = {
    enabled = true,
    recordCoordinates = true,
    recordQuestAccepts = true,
    notableQuality = 4,
    maxEvents = 10000,
  },
  characters = {
    [characterKey] = { guid, name, realm, classID, firstSeenAt, lastSeenAt }
  },
  sessions = {},
  events = {},
  eventIds = {},
  questCompletion = {},
  professionSnapshots = {},
  aggregates = {},
  diagnostics = {},
}
```

Generate `characterKey` from the player GUID when available, otherwise a normalised `name-realm` local key. Recovery replaces an invalid root with a clean schema and records only `{recoveredAt, reason}` in diagnostics.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: manifest/database tests PASS; no unrelated test failures.

- [ ] **Step 5: Commit Task 1**

```powershell
git add addons/MAMChronicles tools/mam-chronicles
git commit -m "feat: scaffold persistent Chronicles addon"
```

### Task 2: Add the validated append-only event store

**Files:**
- Create: `addons/MAMChronicles/EventStore.lua`
- Create: `tools/mam-chronicles/test/event-store.test.js`
- Modify: `addons/MAMChronicles/MAMChronicles.toc`

**Interfaces:**
- Consumes: open schema-1 database and current character/session from Task 1.
- Produces: `EventStore:Append(eventType, payload, options)`; `GetById(id)`; `Query(filters)`; `Pin(id, pinned)`; `Count(eventType)`; `BuildSemanticKey(eventType, payload)`.

- [ ] **Step 1: Write failing event-store tests**

Cover the allowlisted types below, stable IDs, duplicate-ID rejection, semantic deduplication windows, payload copying, maximum string lengths, finite numbers, coordinate bounds, unknown-field removal, future schema rejection, query ordering, date/type/text filters, and pinned events.

```text
session.login              session.logout
character.level_up         character.death
character.resurrected      quest.accepted
quest.completed            world.zone_discovered
instance.entered           instance.exited
loot.notable               profession.changed
achievement.earned         memory.manual
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="event store|dedup|query|payload"`

Expected: FAIL because `EventStore.lua` is absent.

- [ ] **Step 3: Implement event validation and indexing**

Every record has exactly:

```lua
{
  id, schemaVersion = 1, type, occurredAt, observedAt,
  characterKey, sessionId, provenance = "self",
  clientBuild, addonVersion, payload, pinned
}
```

Use event-specific payload allowlists. IDs combine character key, event type, server time, and a per-second sequence. Semantic keys suppress duplicate signals for 5 seconds, except manual memories and distinct quest/item IDs.

- [ ] **Step 4: Run event-store and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: all Task 1–2 tests PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add addons/MAMChronicles/EventStore.lua addons/MAMChronicles/MAMChronicles.toc tools/mam-chronicles/test/event-store.test.js
git commit -m "feat: add validated Chronicle event store"
```

### Task 3: Implement truthful gameplay collectors

**Files:**
- Create: `addons/MAMChronicles/Collectors.lua`
- Create: `tools/mam-chronicles/test/collectors.test.js`
- Modify: `addons/MAMChronicles/Core.lua`

**Interfaces:**
- Consumes: `EventStore:Append`, WoW events and capability-gated APIs.
- Produces: `Collectors:Register()`; `HandleEvent(eventName, ...)`; `CaptureLocation()`; `CaptureProfessionSnapshot()`; `RecordManualMemory(text)`; `GetCollectorStatus()`.

- [ ] **Step 1: Write failing collector tests**

Test independent registration and capture for:

```text
PLAYER_LOGIN, PLAYER_LOGOUT, PLAYER_LEVEL_UP,
PLAYER_DEAD, PLAYER_ALIVE, PLAYER_UNGHOST,
QUEST_ACCEPTED, QUEST_TURNED_IN,
ZONE_CHANGED, ZONE_CHANGED_INDOORS, ZONE_CHANGED_NEW_AREA,
PLAYER_ENTERING_WORLD, CHAT_MSG_LOOT, GET_ITEM_INFO_RECEIVED,
SKILL_LINES_CHANGED, TRADE_SKILL_SHOW, ACHIEVEMENT_EARNED
```

Also test one unsupported event, one throwing API, repeated zone signals, environmental death with no guessed killer, unknown quest titles, self-loot deformatting through Blizzard's localised `LOOT_ITEM_SELF`/`LOOT_ITEM_SELF_MULTIPLE` formats, delayed item-quality resolution, Epic/Legendary thresholds, profession snapshot comparison, instance enter/exit transitions, coordinate opt-out, and `/mam remember <text>` length/empty handling.

- [ ] **Step 2: Run the collector tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="collector|death|quest|loot|profession|instance|memory"`

Expected: FAIL because `Collectors.lua` is absent.

- [ ] **Step 3: Implement capability-gated collectors**

Death payloads may contain only proven `zone`, `subzone`, `mapID`, `x`, `y`, `instanceName`, `instanceType`, and `lastHostileTarget`; label the last target as context, never as the killer. Quest completion updates `questCompletion[questID] = occurredAt`. Loot records only self-received items at or above the configured quality after item data resolves. Profession records contain profession/skill identifiers and numeric skill levels, not recipe data yet.

- [ ] **Step 4: Run collectors and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: all Task 1–3 tests PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add addons/MAMChronicles/Collectors.lua addons/MAMChronicles/Core.lua tools/mam-chronicles/test/collectors.test.js
git commit -m "feat: capture personal Chronicle events"
```

### Task 4: Build deterministic search, statistics, and awards

**Files:**
- Create: `addons/MAMChronicles/Statistics.lua`
- Create: `tools/mam-chronicles/test/statistics.test.js`

**Interfaces:**
- Consumes: event arrays returned by `EventStore:Query`.
- Produces: `Statistics:Build(fromTime, toTime, characterKey)` returning totals, breakdowns, coverage, and awards; `FormatDuration(seconds)`.

- [ ] **Step 1: Write failing statistics tests**

Use a fixed synthetic month to test sessions, levels, deaths, resurrections, quests, discoveries, instances, notable loot, achievements, profession changes, manual memories, busiest zones, death zones, date boundaries, empty history, 10,000 events, deterministic tie-breaking, and the source-event count behind every result.

Awards in the first pass:

```text
Gravity's Favourite   most proven falling deaths
Murloc Magnet         most death contexts containing murloc
Explorer              most distinct zones discovered
Quest Machine         most completed quests
Shiny Collector       most Epic/Legendary loot events
Comeback Kid          most observed resurrections
```

Do not grant an award when its required evidence is absent or tied with no deterministic winner.

- [ ] **Step 2: Run the statistics tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="statistics|award|coverage|duration"`

Expected: FAIL because `Statistics.lua` is absent.

- [ ] **Step 3: Implement single-pass aggregation**

Calculate the requested range in one pass over filtered events. Return `{fromTime, toTime, eventCount, sessionCount, totals, byZone, byType, awards}` and never write results back during a read.

- [ ] **Step 4: Run statistics and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: all Task 1–4 tests PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add addons/MAMChronicles/Statistics.lua tools/mam-chronicles/test/statistics.test.js
git commit -m "feat: summarise Chronicle history"
```

### Task 5: Add safe exports and tester diagnostics

**Files:**
- Create: `addons/MAMChronicles/Export.lua`
- Create: `tools/mam-chronicles/test/export.test.js`

**Interfaces:**
- Consumes: database metadata, query results, statistics, and collector status.
- Produces: `Export:BuildDiagnosticReport()`; `BuildHumanSummary(fromTime, toTime)`; `BuildCourierPayload(fromTime, toTime)`.

- [ ] **Step 1: Write failing export/privacy tests**

Test deterministic ordering, zero-event output, line-safe escaping, payload version `MAMCHRONICLES/1`, event IDs, quest IDs, item IDs, coordinates only when enabled, and rejection of unsupported payload fields. Inject BattleTag, whisper, chat text, account paths, mail, trade, and gold markers into untrusted tables and assert none enter any export.

- [ ] **Step 2: Run export tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="export|diagnostic|privacy|courier"`

Expected: FAIL because `Export.lua` is absent.

- [ ] **Step 3: Implement bounded copyable exports**

The Courier payload is a deterministic newline format with a header, one escaped record per line, and a final event count. Limit a single generated view to 2 MiB and tell the user to narrow the date range if exceeded. Diagnostics include addon/client versions, schema, event counts, registered collectors, last collector errors, and no character name by default.

- [ ] **Step 4: Run export and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: all Task 1–5 tests PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add addons/MAMChronicles/Export.lua tools/mam-chronicles/test/export.test.js
git commit -m "feat: export Chronicle records safely"
```

### Task 6: Build the in-game Chronicle window and commands

**Files:**
- Create: `addons/MAMChronicles/UI.lua`
- Create: `tools/mam-chronicles/test/ui.test.js`
- Modify: `addons/MAMChronicles/Core.lua`

**Interfaces:**
- Consumes: query, statistics, settings, exports, and manual-memory functions.
- Produces: `UI:Create()`; `Show()`; `Hide()`; `Refresh()`; slash commands `/mam`, `/mam remember`, `/mam stats`, `/mam export`, `/mam diag`, `/mam help`.

- [ ] **Step 1: Write failing UI-model and slash-command tests**

Test four tabs (`Chronicle`, `Statistics`, `Settings`, `Diagnostics`), newest-first rows, search by quest/item/zone/type text, All/Deaths/Quests/World/Instances/Loot/Memories filters, date range selection, empty state, settings updates, manual memory dispatch, export selection, unknown command help, frame reuse, and rendering 10,000 events through a fixed 30-row pool rather than 10,000 frames.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="UI|timeline|filter|slash|row pool"`

Expected: FAIL because `UI.lua` is absent.

- [ ] **Step 3: Implement a dependency-free Blizzard-style window**

Use one movable/resizable `BackdropTemplate` frame, tab buttons, a search box, filter dropdown, scroll frame with a reusable 30-row pool, a details pane, and copyable multiline export box. Statistics show the current month by default. Settings expose recording enabled, quest accepts, coordinates, notable quality (Epic/Legendary), and maximum history. Diagnostics remain copyable and clearly label unknown capabilities.

- [ ] **Step 4: Run UI and full tests**

Run: `npm test --prefix tools/mam-chronicles`

Expected: all Task 1–6 tests PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add addons/MAMChronicles/UI.lua addons/MAMChronicles/Core.lua tools/mam-chronicles/test/ui.test.js
git commit -m "feat: add Chronicle timeline and statistics UI"
```

### Task 7: Package the tester build and document acceptance

**Files:**
- Create: `addons/MAMChronicles/README.md`
- Create: `scripts/package-mam-chronicles.ps1`
- Create: `scripts/install-mam-chronicles.ps1`
- Create: `tools/mam-chronicles/test/package-install.test.js`
- Create: `docs/testing/mam-chronicles-phase1-tester-checklist.md`
- Modify: `tools/mam-chronicles/package.json`

**Interfaces:**
- Consumes: the complete addon from Tasks 1–6.
- Produces: `dist/MAMChronicles-0.2.0-alpha1.zip`, safe Retail/Forever installation, SHA-256, and a tester checklist/report template.

- [ ] **Step 1: Write failing package/install tests**

Assert the archive contains exactly the TOC, seven Lua files, and README under one `MAMChronicles/` folder. Test Retail and Forever roots, missing/wrong manifests, running-client refusal, timestamped backup, rollback after staged-copy failure, installed/package hash equality, and preservation of unrelated addons.

- [ ] **Step 2: Run package/install tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles -- --test-name-pattern="package|install|archive|backup|rollback"`

Expected: FAIL because the scripts and README are absent.

- [ ] **Step 3: Implement packaging and safe installation**

Adapt the proven diagnostics scripts to the new exact allowlist. Never enumerate one shell and delete in another. Resolve and validate every target under the supplied `_retail_` or `_classic_beta_` root before a replacement; keep the timestamped ZIP backup outside the client directory.

- [ ] **Step 4: Write the tester README and checklist**

The checklist covers clean installation, first launch, reload/restart persistence, level/death/resurrection/quest/zone/instance/loot/profession/manual-memory capture, search/filters, monthly stats, export copying, settings, Lua errors, FPS/memory observations, and attaching `/mam diag` output. Mark Forever-only tests `PENDING` until beta access returns; never claim Retail evidence proves Forever behavior.

- [ ] **Step 5: Run all automated verification**

```powershell
npm test --prefix tools/mam-chronicles
npm test --prefix tools/mam-chronicles-diagnostics
npm test --prefix guild-dashboard
pwsh -NoProfile -File scripts/package-mam-chronicles.ps1
git diff --check
```

Expected: all suites PASS, packaging prints the archive and SHA-256, and `git diff --check` prints nothing.

- [ ] **Step 6: Inspect the archive and run a fake-client install/readback**

Expand the generated ZIP into a temporary directory, compare every allowlisted file hash to source, install into temporary `_retail_` and `_classic_beta_` trees, and verify only `MAMChronicles` changed.

- [ ] **Step 7: Install locally only when WoW is closed**

Use `scripts/install-mam-chronicles.ps1` with the real Retail root, create a timestamped backup if needed, and read back the installed manifest/version/hashes. Do not install into the unavailable Forever beta unless that client exists and is closed.

- [ ] **Step 8: Commit Task 7**

```powershell
git add addons/MAMChronicles scripts/package-mam-chronicles.ps1 scripts/install-mam-chronicles.ps1 tools/mam-chronicles/test/package-install.test.js docs/testing/mam-chronicles-phase1-tester-checklist.md
git commit -m "build: package Chronicles alpha tester build"
```

## Plan self-review

- **Spec coverage:** Persistent event schema, verified local collectors, searchable timeline, local monthly statistics, storage limits, manual memories, export preview, privacy, diagnostics, automated tests, tester packaging, and safe installation are covered by Tasks 1–7.
- **Intentional phase boundary:** Guild sync, Pi ingestion, live map sharing, full recipe enumeration/sharing, and raid-readiness scoring remain later independent systems. The schema, quest index, professions snapshots, and Courier payload provide explicit extension points without pretending those later systems already work.
- **Placeholder scan:** Every implementation step is concrete and fully specified.
- **Type consistency:** All later modules consume the Task 1 database and Task 2 record shape unchanged; collector event types exactly match the Task 2 allowlist.
- **Review focus:** Malformed data, missing APIs, event floods, corrupt persistence, maximum history, and privacy leakage each have an owning automated test.
