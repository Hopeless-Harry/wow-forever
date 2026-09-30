# Moms Against Magic Chronicles Proper Addon Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `MAMChronicles` version `0.2.0-alpha2` with a native minimap launcher, Retail Addon Compartment entry, Blizzard Settings panel, durable UI state, clearer navigation, original icon, safe reset controls, and updated tester packaging.

**Architecture:** Preserve the schema-1 Chronicle event model and dependency-free Lua 5.1-compatible core. Extend database settings with a validated nested UI state, keep main-window presentation in `UI.lua`, isolate launcher behaviour in `Launcher.lua`, and isolate Blizzard Settings registration in `SettingsPanel.lua`. All modern UI APIs are capability-gated so missing Retail/Forever surfaces cannot stop event collection.

**Tech Stack:** WoW Lua 5.1-compatible code; Blizzard UI APIs; interfaces `120100`, `120105`, and `16001`; Node.js built-in test runner; Fengari; PowerShell 7 packaging and safe installation; original TGA texture.

**Spec:** `docs/superpowers/specs/2026-09-30-mam-chronicles-proper-addon-polish-design.md`

## Global Constraints

- Target version is exactly `0.2.0-alpha2`; database schema remains exactly `1`.
- Do not introduce Ace3, LibDataBroker, LibDBIcon, or another runtime dependency.
- Keep `/mam` and the Addon Compartment usable when the minimap button is hidden.
- Optional Settings, Addon Compartment, menu, tooltip, and Escape surfaces must degrade without stopping collectors.
- Preserve Chronicle settings when erasing history; never silently bypass the confirmation dialog.
- Do not add guild sync, Pi upload, live location sharing, recipes, or readiness scoring.
- Use test-first RED → GREEN for every production behaviour.
- Update `PROJECT-HANDOFF.md` after every completed task, including the exact commit and test result.
- Never claim live behaviour from Fengari tests; live Retail/Forever checks remain separate.

## File Structure

```text
addons/MAMChronicles/
|-- Core.lua                 boot, commands, one-time welcome
|-- Database.lua             settings/UI-state normalisation and history reset
|-- UI.lua                   main window, state persistence, menus, scrolling
|-- Launcher.lua             minimap launcher and Addon Compartment callbacks
|-- SettingsPanel.lua        Blizzard Settings category and shared setting actions
|-- MAMChroniclesIcon.tga    original square icon texture
|-- LICENSE.txt              explicit project licence
|-- MAMChronicles.toc        version, metadata, and module load order
`-- README.md                concise installation and controls

tools/mam-chronicles/test/
|-- harness.js               richer UI and API stubs
|-- database.test.js         nested preference and history-reset tests
|-- ui.test.js               window/menu/scroll/state tests
|-- launcher.test.js         minimap and compartment tests
|-- settings-panel.test.js   Settings registration/reset/welcome tests
|-- manifest.test.js         metadata/load-order tests
`-- package-install.test.js  exact release allowlist tests
```

## Review Focus

- Malformed saved UI state must fall back without erasing events or valid recording settings.
- Hidden minimap recovery must remain possible through `/mam` and Blizzard Settings/Addon Compartment.
- Drag/resize callbacks must save finite, screen-safe values only.
- Missing Settings, tooltip, cursor, minimap, and Addon Compartment surfaces must not break startup.
- The erase action must preserve settings and object identity while clearing all character/session/event indexes and aggregates required for truthful empty statistics.
- UI menus and scroll state must never create more than the fixed 30 timeline rows.
- Package tests must prove the icon, licence, and two new Lua modules are the only newly shipped files.

---

### Task 1: Add validated UI preferences and history reset

**Files:**
- Modify: `addons/MAMChronicles/Database.lua`
- Modify: `tools/mam-chronicles/test/database.test.js`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: existing `Database:Fresh()`, `Database:Open(saved)`, and the live `self.db` table.
- Produces: `settings.showMinimapButton`; `settings.ui`; `settings.welcomeVersion`; `Database:ResetUIState()`; `Database:ClearHistory()`.

- [x] **Step 1: Write failing database tests**

Append focused tests equivalent to:

```javascript
test('database fills and validates nested UI preferences without replacing valid settings',()=>{
  const h=createHarness({savedVariables:{schemaVersion:1,meta:{},settings:{enabled:false,ui:{width:900,activeTab:'Statistics',minimapAngle:725}},characters:{},sessions:{},events:{},eventIds:{},questCompletion:{},professionSnapshots:{},aggregates:{},diagnostics:{}}});
  h.load(files); h.run('MAMChronicles:Boot()');
  assert.equal(h.get('MAMChroniclesDB.settings.enabled'),false);
  assert.equal(h.get('MAMChroniclesDB.settings.showMinimapButton'),true);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.width'),900);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.height'),560);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.activeTab'),'Statistics');
  assert.equal(h.get('MAMChroniclesDB.settings.ui.minimapAngle'),5);
});

test('database replaces malformed UI preferences without erasing Chronicle events',()=>{
  const h=createHarness(); h.load(files);
  h.run('MAMChronicles:Boot(); table.insert(MAMChroniclesDB.events,{id="keep",schemaVersion=1,type="memory.manual",occurredAt=1,observedAt=1,payload={text="keep"}}); MAMChroniclesDB.settings.ui={width=0/0,height="huge",activeTab="Secret"}; MAMChronicles.Database:NormaliseSettings()');
  assert.equal(h.get('#MAMChroniclesDB.events'),1);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.width'),780);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.activeTab'),'Chronicle');
});

test('history reset preserves preferences and live database identity',()=>{
  const h=createHarness(); h.load(files);
  h.run('MAMChronicles:Boot(); local before=MAMChroniclesDB; MAMChroniclesDB.settings.enabled=false; table.insert(MAMChroniclesDB.events,{id="x"}); MAMChroniclesDB.eventIds.x=true; MAMChroniclesDB.questCompletion.a={}; MAMChronicles.Database:ClearHistory(); __same=(before==MAMChroniclesDB)');
  assert.equal(h.get('__same'),true);
  assert.equal(h.get('MAMChroniclesDB.settings.enabled'),false);
  assert.equal(h.get('#MAMChroniclesDB.events'),0);
  assert.equal(h.get('next(MAMChroniclesDB.eventIds)'),null);
  assert.equal(h.get('next(MAMChroniclesDB.questCompletion)'),null);
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="nested UI|malformed UI|history reset"
```

Expected: FAIL because nested defaults, `NormaliseSettings`, and `ClearHistory` do not exist.

- [x] **Step 3: Implement the minimal database behaviour**

Add defaults and functions with these exact public shapes:

```lua
ui = { point="CENTER", x=0, y=0, width=780, height=560, activeTab="Chronicle", minimapAngle=225 }

function Database:NormaliseSettings()
  -- preserve known valid recording settings; fill and validate every nested UI key
  return self.db.settings
end

function Database:ResetUIState()
  self.db.settings.ui = copyTable(self:Fresh().settings.ui)
  return self.db.settings.ui
end

function Database:ClearHistory()
  -- mutate self.db in place; preserve settings/meta while clearing characters,
  -- sessions, events, eventIds, questCompletion, professionSnapshots,
  -- aggregates and history-derived diagnostic counters
  return true
end
```

Use a finite-number helper, the allowed anchors `CENTER`, `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `TOPLEFT`, `TOPRIGHT`, `BOTTOMLEFT`, `BOTTOMRIGHT`, the four known tabs, dimensions `620–1600 × 440–1200`, and angle normalisation `((angle % 360) + 360) % 360`.

- [x] **Step 4: Run focused and full addon tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="database|nested UI|malformed UI|history reset"
npm test --prefix tools/mam-chronicles
```

Expected: all tests PASS.

- [x] **Step 5: Update continuity record and commit**

Mark Task 1 complete in `PROJECT-HANDOFF.md`, record the exact test count, and set Task 2 as the next action.

```powershell
git add addons/MAMChronicles/Database.lua tools/mam-chronicles/test/database.test.js PROJECT-HANDOFF.md
git commit -m "feat: persist validated Chronicles UI preferences"
```

### Task 2: Persist and reset the main Chronicle window

**Files:**
- Modify: `tools/mam-chronicles/test/harness.js`
- Modify: `tools/mam-chronicles/test/ui.test.js`
- Modify: `addons/MAMChronicles/UI.lua`
- Modify: `addons/MAMChronicles/Core.lua`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: `settings.ui` and `Database:ResetUIState()` from Task 1.
- Produces: `UI:Toggle()`; `UI:SaveWindowState()`; `UI:RestoreWindowState()`; `UI:ResetWindow()`; `UI:SetActiveTab(name)`.

- [x] **Step 1: Extend only the test harness capabilities needed by the failing tests**

Make frame stubs retain point/size and support `ClearAllPoints`, `GetPoint`, `GetWidth`, `GetHeight`, `SetUserPlaced`, `SetEnabled`, `LockHighlight`, and `UnlockHighlight`. Define `UIParent={}` and `UISpecialFrames={}` in the harness. Do not add production behaviour here.

- [x] **Step 2: Write failing window-state tests**

Add tests equivalent to:

```javascript
test('UI restores and saves validated window state',()=>{
  const h=setup();
  h.run('MAMChroniclesDB.settings.ui.point="TOPLEFT"; MAMChroniclesDB.settings.ui.x=40; MAMChroniclesDB.settings.ui.y=-30; MAMChroniclesDB.settings.ui.width=900; MAMChroniclesDB.settings.ui.height=650; local f=MAMChronicles.UI:Create(); __point,__relative,__relativePoint,__x,__y=f:GetPoint(); MAMChronicles.UI:SaveWindowState()');
  assert.equal(h.get('__point'),'TOPLEFT');
  assert.equal(h.get('MAMChroniclesDB.settings.ui.width'),900);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.height'),650);
});

test('UI toggles, remembers active tab and registers for Escape',()=>{
  const h=setup(); h.run('MAMChronicles.UI:Show(); MAMChronicles.UI:Toggle(); __hidden=not MAMChronicles.UI.frame:IsShown(); MAMChronicles.UI:Toggle(); MAMChronicles.UI:SetActiveTab("Statistics")');
  assert.equal(h.get('__hidden'),true);
  assert.equal(h.get('MAMChronicles.UI.frame:IsShown()'),true);
  assert.equal(h.get('MAMChroniclesDB.settings.ui.activeTab'),'Statistics');
  assert.equal(h.get('UISpecialFrames[1]'),'MAMChroniclesFrame');
});

test('reset window restores centred defaults',()=>{
  const h=setup(); h.run('local f=MAMChronicles.UI:Create(); f:SetSize(1000,700); f:ClearAllPoints(); f:SetPoint("TOPLEFT",UIParent,"TOPLEFT",50,-50); MAMChronicles.UI:SaveWindowState(); MAMChronicles.UI:ResetWindow()');
  assert.equal(h.get('MAMChroniclesDB.settings.ui.point'),'CENTER');
  assert.equal(h.get('MAMChroniclesDB.settings.ui.width'),780);
});
```

- [x] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="restores and saves|toggles|reset window"
```

Expected: FAIL because the five public UI functions and stateful stubs are missing.

- [x] **Step 4: Implement window state and toggle behaviour**

Use these public entry points:

```lua
function UI:SetActiveTab(name)
  if not validTabs[name] then return false end
  self.activeTab=name; Addon.db.settings.ui.activeTab=name
  self:Refresh(); return true
end

function UI:SaveWindowState()
  -- read one UIParent-relative point and finite frame dimensions, clamp, save
end

function UI:RestoreWindowState()
  -- clear anchors, restore the validated saved state, and clamp to screen
end

function UI:ResetWindow()
  Addon.Database:ResetUIState(); self:RestoreWindowState(); self:SetActiveTab("Chronicle")
end

function UI:Toggle()
  self:Create()
  if self.frame:IsShown() then self:Hide() else self:Show() end
end
```

Save after drag stop and resize mouse-up. Register `MAMChroniclesFrame` in `UISpecialFrames` exactly once. Change the empty `/mam` command and launcher-facing default action to `Toggle()`.

- [x] **Step 5: Run focused and full tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="UI|window|toggle|slash"
npm test --prefix tools/mam-chronicles
```

Expected: all tests PASS and row-pool count remains 30.

- [x] **Step 6: Update handoff and commit**

```powershell
git add addons/MAMChronicles/Core.lua addons/MAMChronicles/UI.lua tools/mam-chronicles/test/harness.js tools/mam-chronicles/test/ui.test.js PROJECT-HANDOFF.md
git commit -m "feat: remember the Chronicles window state"
```

### Task 3: Add the native minimap launcher and Addon Compartment hooks

**Files:**
- Create: `addons/MAMChronicles/Launcher.lua`
- Create: `tools/mam-chronicles/test/launcher.test.js`
- Modify: `addons/MAMChronicles/MAMChronicles.toc`
- Modify: `tools/mam-chronicles/test/harness.js`
- Modify: `addons/MAMChronicles/Core.lua`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: `UI:Toggle()`, `SettingsPanel:Open()` when available, `settings.showMinimapButton`, and `settings.ui.minimapAngle`.
- Produces: `Launcher:Create()`; `Show()`; `Hide()`; `SetAngle(angle)`; `ResetPosition()`; `HandleClick(button)`; `ShowTooltip(owner)`; globals `MAMChronicles_AddonCompartmentClick`, `MAMChronicles_AddonCompartmentEnter`, `MAMChronicles_AddonCompartmentLeave`.

- [x] **Step 1: Add launcher API stubs to the harness and write failing tests**

Stub `Minimap`, `GameTooltip`, `GetCursorPosition`, and `UIParent:GetEffectiveScale()` only as required. Tests must prove:

```javascript
test('launcher honours saved visibility and normalises its angle',()=>{/* create, SetAngle(725), assert angle 5 and button shown */});
test('launcher left click toggles Chronicle and right click opens settings',()=>{/* replace UI.Toggle and SettingsPanel.Open with counters, invoke HandleClick */});
test('launcher drag saves a bounded angle and reset restores 225',()=>{/* invoke drag OnUpdate with cursor position, assert finite 0..359, ResetPosition */});
test('addon compartment callbacks are safe and share launcher actions',()=>{/* invoke all three globals with and without GameTooltip */});
test('hidden minimap setting does not remove slash or compartment entry points',()=>{/* showMinimapButton=false, button hidden, callbacks/functions remain */});
```

- [x] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="launcher|compartment|minimap"
```

Expected: FAIL because `Launcher.lua` and manifest load entry are absent.

- [x] **Step 3: Implement launcher behaviour**

Use a 32-pixel button, original icon path `Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon`, a standard circular border/highlight when those textures exist, and this positioning contract:

```lua
function Launcher:SetAngle(angle)
  angle=((tonumber(angle) or 225)%360+360)%360
  Addon.db.settings.ui.minimapAngle=angle
  local radians=math.rad(angle)
  safeMethod(self.button,"ClearAllPoints")
  safeMethod(self.button,"SetPoint","CENTER",Minimap,"CENTER",math.cos(radians)*80,math.sin(radians)*80)
  return angle
end
```

`HandleClick("LeftButton")` calls `Addon.UI:Toggle()`. `HandleClick("RightButton")` calls `Addon.SettingsPanel:Open()` when available and otherwise opens the Chronicle Settings tab. Drag uses `atan2` or a compatible fallback and never saves a non-finite value.

- [x] **Step 4: Add TOC module and compartment metadata**

Add `Launcher.lua` after `UI.lua`, but do not bump the version until Task 6. Add:

```text
## AddonCompartmentFunc: MAMChronicles_AddonCompartmentClick
## AddonCompartmentFuncOnEnter: MAMChronicles_AddonCompartmentEnter
## AddonCompartmentFuncOnLeave: MAMChronicles_AddonCompartmentLeave
```

- [x] **Step 5: Run launcher and full tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="launcher|compartment|minimap|manifest"
npm test --prefix tools/mam-chronicles
```

Expected: all tests PASS.

- [ ] **Step 6: Update handoff and commit**

```powershell
git add addons/MAMChronicles/Launcher.lua addons/MAMChronicles/MAMChronicles.toc addons/MAMChronicles/Core.lua tools/mam-chronicles/test/harness.js tools/mam-chronicles/test/launcher.test.js tools/mam-chronicles/test/manifest.test.js PROJECT-HANDOFF.md
git commit -m "feat: add Chronicles minimap launcher"
```

### Task 4: Add Blizzard Settings, welcome, and guarded reset actions

**Files:**
- Create: `addons/MAMChronicles/SettingsPanel.lua`
- Create: `tools/mam-chronicles/test/settings-panel.test.js`
- Modify: `addons/MAMChronicles/MAMChronicles.toc`
- Modify: `addons/MAMChronicles/Core.lua`
- Modify: `addons/MAMChronicles/UI.lua`
- Modify: `tools/mam-chronicles/test/harness.js`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: database settings/reset APIs, `UI:ResetWindow()`, `Launcher:ResetPosition()`, `Launcher:Show()/Hide()`.
- Produces: `SettingsPanel:Register()`; `Open()`; `ApplySetting(key,value)`; `ResetWindow()`; `ResetMinimap()`; `RequestEraseHistory()`; `MAMCHRONICLES_ERASE_HISTORY` popup.

- [x] **Step 1: Write failing registration, action, and welcome tests**

Cover these exact cases:

```javascript
test('settings panel prefers modern registration and opens its category',()=>{/* Settings.RegisterCanvasLayoutCategory and RegisterAddOnCategory counters */});
test('settings panel falls back to InterfaceOptions_AddCategory and degrades with neither API',()=>{/* two harnesses */});
test('showMinimapButton setting immediately updates launcher visibility',()=>{/* ApplySetting false then true */});
test('reset actions call the window and launcher reset contracts',()=>{/* counters */});
test('erase request requires popup confirmation and preserves settings',()=>{/* invoke OnAccept, assert empty events and same showMinimapButton */});
test('erase control is disabled when confirmation APIs are absent',()=>{/* RequestEraseHistory returns false and history remains */});
test('first-run local-only welcome prints once',()=>{/* Boot twice against same saved table, assert one matching message and welcomeVersion */});
```

- [x] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="settings panel|erase|welcome"
```

Expected: FAIL because the module, popup, and welcome-version behaviour are absent.

- [x] **Step 3: Implement one shared settings action layer**

Use `Settings.RegisterCanvasLayoutCategory(panel,panel.name)` plus `Settings.RegisterAddOnCategory(category)` when present; otherwise use `InterfaceOptions_AddCategory(panel)` when present. `Open()` uses `Settings.OpenToCategory(category.ID or category:GetID())`, with legacy double-call fallback only where required.

`ApplySetting` must allow only:

```lua
enabled=true,
recordQuestAccepts=true,
recordCoordinates=true,
notableQuality=true,
maxEvents=true,
showMinimapButton=true,
```

Validate the existing numeric settings through `UI:SetSetting`, then synchronise launcher visibility. Build both settings surfaces from the same values.

- [x] **Step 4: Implement guarded history deletion and first-run message**

Register:

```lua
StaticPopupDialogs.MAMCHRONICLES_ERASE_HISTORY = {
  text="Erase all recorded Chronicle history? Your addon settings will be kept. This cannot be undone.",
  button1=YES,
  button2=NO,
  OnAccept=function() Addon.Database:ClearHistory(); Addon.UI:Refresh() end,
  timeout=0,
  whileDead=true,
  hideOnEscape=true,
  preferredIndex=3,
}
```

If `StaticPopup_Show` or `StaticPopupDialogs` is unavailable, return `false`, print a clear message, and do not delete. On first boot where `settings.welcomeVersion ~= "personal-chronicle-v1"`, print the approved local-only welcome and then persist that marker.

- [x] **Step 5: Run focused and full tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="settings panel|erase|welcome|setting"
npm test --prefix tools/mam-chronicles
```

Expected: all tests PASS.

- [x] **Step 6: Update handoff and commit**

```powershell
git add addons/MAMChronicles/SettingsPanel.lua addons/MAMChronicles/MAMChronicles.toc addons/MAMChronicles/Core.lua addons/MAMChronicles/UI.lua tools/mam-chronicles/test/harness.js tools/mam-chronicles/test/settings-panel.test.js tools/mam-chronicles/test/manifest.test.js PROJECT-HANDOFF.md
git commit -m "feat: integrate Chronicles with Blizzard settings"
```

### Task 5: Polish tabs, menus, scrolling, tooltips, and empty states

**Files:**
- Modify: `addons/MAMChronicles/UI.lua`
- Modify: `tools/mam-chronicles/test/ui.test.js`
- Modify: `tools/mam-chronicles/test/harness.js`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: `UI:SetActiveTab`, timeline query/page model, shared settings actions.
- Produces: `UI:OpenFilterMenu(anchor)`; `UI:OpenRangeMenu(anchor)`; `UI:SetTimelineOffset(offset)`; `UI:UpdateNavigation(total)`; selected-tab and tooltip state.

- [ ] **Step 1: Write failing interaction tests**

Add separate tests proving:

```javascript
test('active tab is highlighted and persisted',()=>{/* SetActiveTab, assert LockHighlight/disabled state and saved tab */});
test('filter menu selects an exact option without cycling',()=>{/* OpenFilterMenu and invoke Quests option */});
test('range menu selects an exact option without cycling',()=>{/* choose This Month directly */});
test('timeline offset clamps and navigation disables at each boundary',()=>{/* totals 0, 10, 31, offsets -5 and 999 */});
test('scroll slider and mouse wheel share the same timeline offset',()=>{/* slider SetValue and OnMouseWheel */});
test('polished UI retains exactly thirty reusable timeline rows',()=>{/* assert rowPool and rowButtons lengths */});
test('controls expose concise tooltip titles and instructions',()=>{/* invoke OnEnter and inspect GameTooltip lines */});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="active tab|filter menu|range menu|timeline offset|scroll slider|tooltip"
```

Expected: FAIL because the explicit menu/navigation APIs and visual state do not exist.

- [ ] **Step 3: Implement exact-choice menus and navigation**

Use a small internal anchored menu made of reusable buttons so both clients work even without `MenuUtil`. Each menu closes after a choice and resets timeline offset to zero. Public setters accept only values already present in `UI.filters` and `UI.dateRanges`.

Implement:

```lua
function UI:SetTimelineOffset(offset,total)
  total=math.max(0,tonumber(total) or 0)
  local maximum=math.max(0,total-30)
  self.timelineOffset=math.max(0,math.min(maximum,math.floor(tonumber(offset) or 0)))
  self:UpdateNavigation(total)
  return self.timelineOffset
end
```

Use a vertical `Slider` for timeline position, keep mouse-wheel increments at five records, and disable Previous/Next at boundaries. Do not create timeline rows dynamically.

- [ ] **Step 4: Implement selected states, tooltips, and visual cleanup**

Use `LockHighlight`/`UnlockHighlight` plus enabled state for selected tabs. Add concise tooltip helper text for search, filter, range, export, reset, minimap, and destructive controls. Use dark neutral panels, gold headers, restrained red accents, native readable font objects, and clear empty/no-match/unknown text. Preserve selectable export behaviour.

- [ ] **Step 5: Run focused and full tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="UI|menu|scroll|tooltip|copy"
npm test --prefix tools/mam-chronicles
```

Expected: all tests PASS; row pool remains 30; no copy-selection regression.

- [ ] **Step 6: Update handoff and commit**

```powershell
git add addons/MAMChronicles/UI.lua tools/mam-chronicles/test/ui.test.js tools/mam-chronicles/test/harness.js PROJECT-HANDOFF.md
git commit -m "feat: polish Chronicle navigation and controls"
```

### Task 6: Add original icon, final metadata, licence, and documentation

**Files:**
- Create: `addons/MAMChronicles/MAMChroniclesIcon.tga`
- Create: `addons/MAMChronicles/LICENSE.txt`
- Modify: `addons/MAMChronicles/MAMChronicles.toc`
- Modify: `addons/MAMChronicles/README.md`
- Modify: `docs/manuals/mam-chronicles-user-manual.md`
- Modify: `docs/testing/mam-chronicles-phase1-tester-checklist.md`
- Modify: `tools/mam-chronicles/test/manifest.test.js`
- Modify: `PROJECT-HANDOFF.md`

**Interfaces:**
- Consumes: all user-visible behaviour from Tasks 1–5.
- Produces: package-ready `0.2.0-alpha2` metadata and original texture asset.

- [ ] **Step 1: Write failing manifest/asset tests**

Assert exact version, load order, icon metadata, compartment metadata, non-empty TGA and licence files, and no invented project URL:

```javascript
test('manifest declares alpha2 polish metadata and exact module order',()=>{
  const toc=readAddonFile('MAMChronicles.toc');
  assert.match(toc,/## Version: 0\.2\.0-alpha2/);
  assert.match(toc,/## IconTexture: Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon/);
  assert.match(toc,/## AddonCompartmentFunc: MAMChronicles_AddonCompartmentClick/);
  assert.deepEqual(toc.split(/\r?\n/).filter(x=>x.endsWith('.lua')),['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua','UI.lua','Launcher.lua','SettingsPanel.lua']);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="manifest|alpha2|icon|licence"
```

Expected: FAIL because the version and assets have not been finalised.

- [ ] **Step 3: Create and validate the original icon**

Use the image-generation skill to create an original square icon: an open chronicle/book, restrained dark-red cover, gold edging, and a small crossed-out magical spark, readable at 32 pixels, no text, no copied Warcraft or addon art. Convert/export it to an uncompressed 32-bit TGA with power-of-two dimensions. Inspect both the full-size image and a 32-pixel preview before accepting it.

- [ ] **Step 4: Finalise manifest and licence**

Set version `0.2.0-alpha2`, `IconTexture`, compartment functions, and exact nine-file Lua load order. Add a concise project-owned licence granting guild/private testing use unless the user later chooses a public open-source licence. Do not add a website/source URL that does not exist.

- [ ] **Step 5: Update user documentation and acceptance checks**

Document minimap clicks/drag/hide recovery, Addon Compartment, Blizzard Settings, window persistence/reset, first-run message, menus/scrolling, and erase-history confirmation. Add live checks for `/reload`, full restart, common UI scales, minimum window size, and optional-API fallback evidence.

- [ ] **Step 6: Run focused and full tests**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="manifest|alpha2|icon|licence"
npm test --prefix tools/mam-chronicles
git diff --check
```

Expected: all tests PASS and diff check is silent.

- [ ] **Step 7: Update handoff and commit**

```powershell
git add addons/MAMChronicles/MAMChroniclesIcon.tga addons/MAMChronicles/LICENSE.txt addons/MAMChronicles/MAMChronicles.toc addons/MAMChronicles/README.md docs/manuals/mam-chronicles-user-manual.md docs/testing/mam-chronicles-phase1-tester-checklist.md tools/mam-chronicles/test/manifest.test.js PROJECT-HANDOFF.md
git commit -m "docs: prepare Chronicles alpha2 polish release"
```

### Task 7: Package, inspect, regress, and prepare live acceptance

**Files:**
- Modify: `scripts/package-mam-chronicles.ps1`
- Modify: `tools/mam-chronicles/test/package-install.test.js`
- Modify: `PROJECT-HANDOFF.md`
- Update generated tester release under `C:\Users\44750\Documents\ChatGPT\WoW\tester-releases\MAMChronicles-0.2.0-alpha2\`

**Interfaces:**
- Consumes: completed alpha2 addon, exact package allowlist, three automated suites.
- Produces: inspected alpha2 ZIP, SHA-256, updated tester instructions/checklist/manual, and an exact live-test next action.

- [ ] **Step 1: Write failing package allowlist test**

Change expected archive to `MAMChronicles-0.2.0-alpha2.zip` and exact contents to:

```javascript
[
  'Collectors.lua','Core.lua','Database.lua','EventStore.lua','Export.lua',
  'Launcher.lua','LICENSE.txt','MAMChronicles.toc','MAMChroniclesIcon.tga',
  'README.md','SettingsPanel.lua','Statistics.lua','UI.lua'
]
```

- [ ] **Step 2: Run package test and verify RED**

Run:

```powershell
npm test --prefix tools/mam-chronicles -- --test-name-pattern="package archive"
```

Expected: FAIL because the PowerShell allowlist still omits alpha2 files.

- [ ] **Step 3: Update package allowlist and generate the release**

Add only `Launcher.lua`, `SettingsPanel.lua`, `MAMChroniclesIcon.tga`, and `LICENSE.txt` to the existing allowlist. Generate the ZIP in a temporary output directory first; expand it and compare every packaged file hash with source.

- [ ] **Step 4: Run all automated verification**

Run:

```powershell
npm test --prefix tools/mam-chronicles
npm test --prefix tools/mam-chronicles-diagnostics
npm test --prefix guild-dashboard
pwsh -NoProfile -File scripts/package-mam-chronicles.ps1
git diff --check
```

Expected: all suites PASS, packaging prints a SHA-256, and diff check is silent.

- [ ] **Step 5: Inspect fake-client installs**

Install into temporary `_retail_` and `_classic_beta_` trees, verify the exact file allowlist and source-identical hashes, simulate activation failure to verify rollback, and confirm unrelated addons remain unchanged.

- [ ] **Step 6: Build the tester-release directory**

Create/update:

```text
C:\Users\44750\Documents\ChatGPT\WoW\tester-releases\MAMChronicles-0.2.0-alpha2\
|-- MAMChronicles-0.2.0-alpha2.zip
|-- SEND-TO-TESTERS.txt
|-- TESTER-CHECKLIST.md
`-- USER-MANUAL.md
```

Record the exact new SHA-256 in `PROJECT-HANDOFF.md`. Mark automated/package evidence separately from live acceptance.

- [ ] **Step 7: Install to a real client only when WoW is closed**

Check the process state first. If WoW is running or the user is unavailable for live testing, do not install; record the exact safe command and leave live acceptance as the next action. If closed, use the safe installer, retain its backup, and compare all installed hashes with source.

- [ ] **Step 8: Commit the verified release changes**

```powershell
git add scripts/package-mam-chronicles.ps1 tools/mam-chronicles/test/package-install.test.js PROJECT-HANDOFF.md
git commit -m "build: package Chronicles alpha2 polish build"
```

## Plan self-review

- **Spec coverage:** Every approved design section maps to Tasks 1–7. The original icon is explicitly generated and inspected in Task 6. The handoff continuity rule appears in every task.
- **Scope:** Guild sync, Pi, live map, recipes, and readiness remain excluded.
- **Interface consistency:** Task 1 produces database state/reset APIs used by Tasks 2 and 4. Task 2 produces UI toggle/reset used by Tasks 3 and 4. Task 3 produces launcher reset/visibility used by Task 4. Tasks 1–5 produce the user-visible contract documented and packaged by Tasks 6–7.
- **Failure coverage:** Malformed saved state, missing optional APIs, hidden-launcher recovery, destructive confirmation, fixed row count, package allowlist, rollback, and client separation each have an owning test.
- **Placeholder scan:** No unfinished placeholder or unspecified later implementation remains in the plan.
