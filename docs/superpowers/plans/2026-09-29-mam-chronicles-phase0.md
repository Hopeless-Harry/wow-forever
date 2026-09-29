# Moms Against Magic Chronicles Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and safely install a minimal WoW Forever diagnostics addon that proves or disproves the APIs and persistence assumptions required by Moms Against Magic Chronicles.

**Architecture:** `MAMChroniclesDiagnostics` is a dependency-free WoW addon containing a small saved-data core, defensive event registration, capability probes, guild/self messaging checks, and a redacted in-game report. A separate Node/Fengari harness executes the Lua outside WoW with stubbed APIs, while PowerShell scripts package and install only an explicit allowlist of addon files.

**Tech Stack:** WoW Lua compatible with interface `16001`; Node.js built-in test runner; Fengari Lua runtime for automated tests; PowerShell 7 packaging/install scripts; Markdown operating guide.

**Spec:** `docs/discovery/2026-09-29-moms-against-magic-chronicles-research.md`

## Global Constraints

- Target the locally installed WoW Forever beta interface `16001`; record the runtime build rather than assuming it remains `1.60.1.70009`.
- The addon technical folder is `MAMChroniclesDiagnostics`; the registered message prefix is `MAMChronDiag` and remains below Blizzard's 16-character limit.
- Collect diagnostic counts and capability results only; do not persist character names, BattleTags, chat, whispers, account paths, gold, mail, trades, or continuous positions.
- Use only documented WoW addon APIs and addon messages; never inspect process memory, network traffic, or automate gameplay.
- Every API/event probe must fail closed and record an unavailable result instead of breaking addon loading.
- Do not write into the live AddOns directory unless `WowB.exe` is stopped; back up an existing diagnostic addon before replacement.
- Package only `.toc`, `.lua`, and addon README files explicitly named by the packaging script.
- A stored diagnostic result is evidence from a named client build, not proof that future Forever builds behave the same way.

## Review Focus

- Missing or restricted WoW APIs must produce a redacted `unavailable` capability result without a Lua error; Task 2 tests the no-API and throwing-API cases.
- One invalid/unknown event must not prevent other supported events from registering; Task 2 tests partial registration failure.
- A received addon message from an unexpected prefix or malformed payload must be ignored without changing counters; Task 3 tests both inputs.
- Report generation must never expose sender names or account paths even when the event callback receives them; Task 3 tests marker absence.
- Packaging/install must not include Node dependencies or overwrite a live addon without backup; Task 4 tests the archive allowlist and replacement backup.

---

### Task 1: Add the Lua test harness and addon manifest

**Files:**
- Create: `tools/mam-chronicles-diagnostics/package.json`
- Create: `tools/mam-chronicles-diagnostics/test/harness.js`
- Create: `tools/mam-chronicles-diagnostics/test/manifest.test.js`
- Create: `addons/MAMChroniclesDiagnostics/MAMChroniclesDiagnostics.toc`

**Interfaces:**
- Consumes: Node.js and PowerShell already present in the workspace.
- Produces: `createWowHarness(overrides)` returning `{ lua, calls, fireEvent, runSlash }`, plus an interface-`16001` manifest whose load order is `Core.lua`, `Capabilities.lua`, `Events.lua`, `UI.lua`.

- [ ] **Step 1: Write the failing manifest test**

```js
test('manifest targets Forever and loads the four diagnostic modules', () => {
  const toc = readFileSync(addonPath('MAMChroniclesDiagnostics.toc'), 'utf8');
  assert.match(toc, /^## Interface: 16001$/m);
  assert.match(toc, /^## SavedVariables: MAMChroniclesDiagnosticsDB$/m);
  assert.deepEqual(luaFiles(toc), ['Core.lua', 'Capabilities.lua', 'Events.lua', 'UI.lua']);
});
```

- [ ] **Step 2: Run the manifest test and verify RED**

Run: `npm install --prefix tools/mam-chronicles-diagnostics && npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="manifest targets"`

Expected: FAIL because `MAMChroniclesDiagnostics.toc` does not exist.

- [ ] **Step 3: Add the package, harness shell, and minimal manifest**

The package uses scripts `test: node --test --test-concurrency=1` and dependency `fengari`. The manifest contains title, notes, author, version `0.1.0-phase0`, SavedVariables, and the exact four Lua filenames in load order.

- [ ] **Step 4: Run the manifest test and verify GREEN**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="manifest targets"`

Expected: PASS with one matching test and zero failures.

- [ ] **Step 5: Commit Task 1**

```powershell
git add addons/MAMChroniclesDiagnostics/MAMChroniclesDiagnostics.toc tools/mam-chronicles-diagnostics
git commit -m "test: scaffold Chronicles diagnostic harness"
```

### Task 2: Implement persistence, defensive event capture, and capability probes

**Files:**
- Create: `addons/MAMChroniclesDiagnostics/Core.lua`
- Create: `addons/MAMChroniclesDiagnostics/Capabilities.lua`
- Create: `addons/MAMChroniclesDiagnostics/Events.lua`
- Create: `tools/mam-chronicles-diagnostics/test/core.test.js`
- Create: `tools/mam-chronicles-diagnostics/test/capabilities.test.js`
- Create: `tools/mam-chronicles-diagnostics/test/events.test.js`

**Interfaces:**
- Consumes: WoW globals supplied at runtime and harness callbacks from Task 1.
- Produces: global table `MAMChroniclesDiagnostics` with `Initialize()`, `RecordEvent(eventName, ...)`, `RunCapabilities()`, `GetReportLines()`, `MarkPersistence()`, and `SafeRegisterEvents(frame, eventNames)`.

- [ ] **Step 1: Write failing core persistence tests**

Test that a new database is schema version `1`, increments `loadCount`, retains an existing marker, records runtime build/interface, and never stores a character name returned by `UnitName`.

- [ ] **Step 2: Run core tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="database|persistence|runtime build"`

Expected: FAIL because `Core.lua` is missing.

- [ ] **Step 3: Implement the minimal database core**

`Initialize()` creates or migrates a bounded table with `schemaVersion`, `loadCount`, `firstSeenAt`, `lastSeenAt`, `persistence`, `runtime`, `capabilities`, `events`, and `messages`. `MarkPersistence()` writes a timestamp/counter marker for a later reload check. Use `GetServerTime()` with `time()` fallback and store only build/version/interface/locale/game-mode facts.

- [ ] **Step 4: Run core tests and verify GREEN**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="database|persistence|runtime build"`

Expected: PASS.

- [ ] **Step 5: Write failing capability tests**

Test `RunCapabilities()` with working, missing, and throwing implementations of `C_Map.GetBestMapForUnit`, `C_Map.GetPlayerMapPosition`, `UnitPosition`, `GetProfessions`, `GetProfessionInfo`, `C_TradeSkillUI.GetAllRecipeIDs`, `GetNumGuildMembers`, and `C_ChatInfo` registration/restriction APIs. Assert all failures become `{ available = false, reason = <short code> }` and no identifying values enter the report.

- [ ] **Step 6: Run capability tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="capabilit"`

Expected: FAIL because `Capabilities.lua` is missing.

- [ ] **Step 7: Implement minimal defensive probes**

Each probe uses `pcall`, validates result types, and stores only booleans/counts/map IDs or rounded test coordinates. Profession output is count/skill availability only. Guild output is member/online counts only. Message output records registration and restriction state only.

- [ ] **Step 8: Run capability tests and verify GREEN**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="capabilit"`

Expected: PASS.

- [ ] **Step 9: Write failing event tests**

Test registration for `PLAYER_LOGIN`, `PLAYER_LOGOUT`, `PLAYER_LEVEL_UP`, `PLAYER_DEAD`, `PLAYER_ALIVE`, `PLAYER_UNGHOST`, `QUEST_ACCEPTED`, `QUEST_TURNED_IN`, `ZONE_CHANGED`, `ZONE_CHANGED_INDOORS`, `ZONE_CHANGED_NEW_AREA`, `PLAYER_ENTERING_WORLD`, `GUILD_ROSTER_UPDATE`, `SKILL_LINES_CHANGED`, `TRADE_SKILL_SHOW`, and `CHAT_MSG_ADDON`. Make one registration throw and assert the remaining events still register. Fire level, death, quest, zone, and profession events and assert only count/last-seen metadata is stored.

- [ ] **Step 10: Run event tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="event"`

Expected: FAIL because `Events.lua` is missing.

- [ ] **Step 11: Implement minimal event capture**

Register every event independently through `pcall`. `RecordEvent` increments a bounded per-event counter, records last timestamp, and triggers only the related capability probe. Never retain callback arguments except numeric level/quest IDs where the test confirms they are non-secret plain numbers.

- [ ] **Step 12: Run event tests and the full addon suite**

Run: `npm test --prefix tools/mam-chronicles-diagnostics`

Expected: all Task 1–2 tests PASS with zero warnings or failures.

- [ ] **Step 13: Commit Task 2**

```powershell
git add addons/MAMChroniclesDiagnostics tools/mam-chronicles-diagnostics/test
git commit -m "feat: probe Chronicles runtime capabilities"
```

### Task 3: Add safe addon-message diagnostics and the in-game report

**Files:**
- Modify: `addons/MAMChroniclesDiagnostics/Core.lua`
- Modify: `addons/MAMChroniclesDiagnostics/Events.lua`
- Create: `addons/MAMChroniclesDiagnostics/UI.lua`
- Create: `tools/mam-chronicles-diagnostics/test/messages.test.js`
- Create: `tools/mam-chronicles-diagnostics/test/report.test.js`

**Interfaces:**
- Consumes: `MAMChroniclesDiagnostics` APIs from Task 2 and `C_ChatInfo` when available.
- Produces: `SendPing(scope)`, `HandleAddonMessage(prefix, payload, channel, sender)`, `BuildReportText()`, `/mamdiag`, `/mamdiag run`, `/mamdiag mark`, `/mamdiag ping self`, `/mamdiag ping guild`, and a basic read-only report frame.

- [ ] **Step 1: Write failing message tests**

Test that self/guild ping uses prefix `MAMChronDiag`, rejects an unavailable/restricted sender path, responds once to valid `PING|1|nonce`, accepts `PONG|1|nonce`, ignores other prefixes/malformed payloads, bounds nonces to safe characters/length, and stores counters/timestamps without sender names.

- [ ] **Step 2: Run message tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="message|ping"`

Expected: FAIL because messaging methods are absent.

- [ ] **Step 3: Implement minimal message diagnostics**

Use `C_ChatInfo.SendAddonMessage` only after prefix registration and restriction checks. Self scope whispers the current full player name but does not store it. Guild scope requires `IsInGuild()`. Payload parsing accepts only exact version-1 `PING`/`PONG` messages and alphanumeric nonce punctuation `[A-Za-z0-9_-]` up to 32 characters.

- [ ] **Step 4: Run message tests and verify GREEN**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="message|ping"`

Expected: PASS.

- [ ] **Step 5: Write failing report/UI tests**

Test deterministic report sections for Runtime, Persistence, Events, Map, Guild, Professions, Messaging, and Next Actions. Inject unique character, sender, account-path, and chat markers and assert none appear. Test slash dispatch calls the correct action and unknown input prints the short help text.

- [ ] **Step 6: Run report tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="report|slash"`

Expected: FAIL because `UI.lua` is missing.

- [ ] **Step 7: Implement the read-only diagnostics UI**

Create a small movable `BackdropTemplate` frame containing a title, refresh button, scrollable read-only multi-line edit box, and close button. Build the report exclusively from allowlisted database fields. `/mamdiag` toggles it; subcommands run probes, mark persistence, send pings, reset only diagnostic results, or print help.

- [ ] **Step 8: Run report tests and full addon suite**

Run: `npm test --prefix tools/mam-chronicles-diagnostics`

Expected: all Task 1–3 tests PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add addons/MAMChroniclesDiagnostics tools/mam-chronicles-diagnostics/test
git commit -m "feat: add in-game Chronicles diagnostic report"
```

### Task 4: Package, safely install, and document the in-game acceptance run

**Files:**
- Create: `scripts/package-mam-chronicles-diagnostics.ps1`
- Create: `scripts/install-mam-chronicles-diagnostics.ps1`
- Create: `addons/MAMChroniclesDiagnostics/README.md`
- Create: `docs/testing/mam-chronicles-phase0-checklist.md`
- Create: `tools/mam-chronicles-diagnostics/test/package-install.test.js`
- Modify: `tools/mam-chronicles-diagnostics/package.json`

**Interfaces:**
- Consumes: completed addon files from Tasks 1–3.
- Produces: `dist/MAMChroniclesDiagnostics-0.1.0-phase0.zip`, a safe installer accepting `-ClientRoot` and `-BackupRoot`, and a short manual checklist that records client build plus PASS/FAIL/UNAVAILABLE for every Phase 0 assumption.

- [ ] **Step 1: Write failing package/install tests**

Create a temporary fake `_classic_beta_` tree. Assert packaging produces exactly the `.toc`, four Lua modules, and README inside one `MAMChroniclesDiagnostics/` folder. Assert install rejects a missing manifest, rejects an interface other than `16001`, refuses when a supplied running-process probe reports WoW active, backs up an existing addon before replacement, and leaves unrelated addons untouched.

- [ ] **Step 2: Run package/install tests and verify RED**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="package|install"`

Expected: FAIL because the scripts are missing.

- [ ] **Step 3: Implement the packaging script**

Resolve the repository root, validate the source manifest, copy only the seven allowlisted addon files to a temporary staging directory, create the versioned ZIP, print its SHA-256, and remove staging in `finally`.

- [ ] **Step 4: Implement the installer**

Resolve literal absolute paths, require `_classic_beta_`, require interface `16001`, check `WowB.exe` through `Get-Process`, create a timestamped ZIP backup if the target exists, stage the new addon beside the target, then replace only `Interface/AddOns/MAMChroniclesDiagnostics`. Print target and backup paths.

- [ ] **Step 5: Run package/install tests and verify GREEN**

Run: `npm test --prefix tools/mam-chronicles-diagnostics -- --test-name-pattern="package|install"`

Expected: PASS.

- [ ] **Step 6: Write member-facing README and acceptance checklist**

README commands:

```text
/mamdiag
/mamdiag run
/mamdiag mark
/mamdiag ping self
/mamdiag ping guild
/mamdiag reset
```

Checklist sequence:

1. Record build/interface from `/mamdiag run`.
2. Mark persistence, `/reload`, confirm marker survived.
3. Fully exit and restart WoW, confirm marker survived again.
4. Trigger one level/quest/zone/profession event where practical and record counter changes.
5. Run self ping; run guild ping with a second client if available.
6. Check outdoor map position and an instance/restricted state.
7. Export or screenshot the redacted report and mark each capability PASS, FAIL, or UNAVAILABLE.

- [ ] **Step 7: Run all verification commands**

```powershell
npm test --prefix tools/mam-chronicles-diagnostics
npm test --prefix guild-dashboard
pwsh -NoProfile -File scripts/package-mam-chronicles-diagnostics.ps1
git diff --check
```

Expected: both test suites pass, packaging exits `0` and prints a SHA-256, and `git diff --check` prints nothing.

- [ ] **Step 8: Safely install into the local Forever beta**

Run only after verifying `WowB.exe` is stopped:

```powershell
pwsh -NoProfile -File scripts/install-mam-chronicles-diagnostics.ps1 `
  -ClientRoot 'C:\Program Files (x86)\World of Warcraft\_classic_beta_' `
  -BackupRoot 'C:\Users\44750\Documents\ChatGPT\WoW\backups\client-addons'
```

Expected: installer reports the exact addon target and either a timestamped backup path or `no existing addon`.

- [ ] **Step 9: Read back the installed manifest and hash the installed files**

Run: `Get-FileHash` over the packaged and installed allowlisted files, compare names/hashes, and confirm unrelated addon directories remain present.

- [ ] **Step 10: Commit Task 4**

```powershell
git add addons/MAMChroniclesDiagnostics scripts docs/testing tools/mam-chronicles-diagnostics
git commit -m "build: package Chronicles Phase 0 diagnostics"
```

## Plan self-review

- Spec coverage: Phase 0 persistence, messages, events, map, professions, guild roster, diagnostics, privacy, packaging, safe install, and acceptance evidence each map to Tasks 1–4.
- Scope held: no permanent Chronicle UI, Pi ingestion, continuous location sharing, monthly letter, recipe sync, or raid readiness is implemented.
- Placeholder scan: no placeholder text, deferred implementation instruction, or undefined task interface remains.
- Type consistency: the single global addon table and method names are introduced in Task 2 and consumed unchanged in Tasks 3–4.
- Review focus: all five high-risk failure classes have explicit automated tests in their owning task.
