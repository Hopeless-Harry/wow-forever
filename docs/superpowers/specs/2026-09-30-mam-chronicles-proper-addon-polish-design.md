# Moms Against Magic Chronicles — Proper Addon Polish Design

**Date:** 30 September 2026  
**Status:** Approved by the user on 30 September 2026
**Target version:** `0.2.0-alpha2`  
**Scope:** Full tester-quality shell and usability pass. No guild sync, Pi upload, live map, shared crafting, or readiness scoring.

## Goal

Make the existing personal Chronicle feel like a complete, discoverable WoW addon without weakening its privacy rules, truthful-data model, Retail/Forever compatibility, or dependency-free packaging.

## Approaches considered

### 1. Native, dependency-free shell — recommended

Build the minimap launcher, Addon Compartment hooks, Blizzard Settings panel, persistence, menus, and reset controls using Blizzard UI APIs with capability-gated fallbacks.

Advantages:

- keeps the package small and self-contained;
- avoids library-version conflicts on a moving Forever client;
- lets the existing harness test the critical state and fallback logic;
- preserves the current addon architecture.

Cost:

- we must implement and maintain a modest amount of launcher/menu code ourselves.

### 2. LibDataBroker and LibDBIcon

Bundle or depend on LibDataBroker/LibDBIcon for the minimap launcher, then keep the rest native.

Advantages:

- familiar behaviour for experienced WoW users;
- easier integration with broker-display addons.

Costs:

- adds dependencies or embedded third-party code;
- creates licence, packaging, and compatibility work;
- does not solve the settings, persistence, onboarding, or UI-polish gaps.

### 3. Ace3-based shell rewrite

Move settings, commands, profiles, and UI support to Ace3.

Advantages:

- mature settings/profile abstractions.

Costs:

- unnecessarily large rewrite for the current addon;
- raises regression and Forever-compatibility risk;
- obscures the deliberately small privacy and persistence surface.

## Decision

Use **Approach 1: native and dependency-free**. Add capability checks around modern Settings and menu APIs, with small local fallbacks. Do not introduce Ace3, LibDataBroker, or LibDBIcon in this pass.

## User experience

### Entry points

The addon will always have three independent ways to open it:

1. `/mam` toggles the main Chronicle window.
2. A draggable minimap button toggles the Chronicle with left-click.
3. Retail's Addon Compartment entry toggles the Chronicle.

If the minimap button is hidden, `/mam` and the Addon Compartment remain available.

### Minimap launcher

- Left-click: toggle the Chronicle window.
- Right-click: open the addon's Blizzard Settings category.
- Drag: move the button around the minimap edge and save its angle.
- Hover: show a tooltip containing the addon name, version, left/right-click help, and local/privacy wording.
- Setting: show or hide the minimap button.
- Reset: restore the default angle.

The position calculation will use the minimap centre and cursor position, store only a bounded angle, and anchor the button to the minimap edge. It will not rely on a third-party library.

### Addon Compartment

The TOC will expose global click/enter/leave functions through `AddonCompartmentFunc`, `AddonCompartmentFuncOnEnter`, and `AddonCompartmentFuncOnLeave` when supported. The entry uses the same toggle action and tooltip copy as the minimap launcher.

These functions must remain harmless when the Addon Compartment APIs or tooltip are absent.

### Main window

- `/mam` becomes a true toggle: hidden to shown, shown to hidden.
- The window saves width, height, and a UIParent-relative anchor when dragging or resizing stops.
- Restore logic validates all saved numbers and clamps the frame to the screen.
- The currently selected tab is remembered.
- Escape closes the window through `UISpecialFrames` where supported.
- Closing and reopening reuses the same frame.
- A Reset Window action restores the centred `780 × 560` default.

### Tabs and controls

- The active tab has an unmistakable selected state and cannot look like an ordinary unselected button.
- Filter and date-range controls open small anchored menus instead of requiring repeated cycling.
- A capability-gated modern menu may be used when present; the addon must retain a simple internal menu fallback.
- The timeline keeps the fixed 30-row pool.
- A visible vertical slider represents the current timeline position; the mouse wheel and Previous/Next controls remain synchronised with it.
- Previous/Next disable correctly at the start/end of results.
- Search, empty, no-match, and unknown-capability states use plain explanatory text.
- Controls receive concise tooltips; native button templates remain keyboard/mouse safe.

### Blizzard Settings category

Create a lightweight `Moms Against Magic Chronicles` settings panel registered through the modern `Settings` API when available, with a legacy `InterfaceOptions_AddCategory` fallback only where present.

The panel will expose:

- recording enabled;
- record quest accepts;
- record event coordinates;
- notable-loot threshold: Epic+ or Legendary only;
- maximum retained events: 1,000, 5,000, or 10,000;
- show minimap button;
- Open Chronicle;
- Reset Window Position;
- Reset Minimap Position.

The in-Chronicle Settings tab and Blizzard Settings panel read and update the same database values. Neither keeps a separate settings copy.

### Destructive data action

The in-Chronicle Settings tab will include **Erase Chronicle Data** below the normal controls, visually separated and labelled as destructive.

Activation opens a named `StaticPopupDialogs` confirmation that:

- explains that recorded Chronicle events and derived local history will be removed;
- does not erase preference settings unless explicitly stated;
- requires the user to confirm;
- cannot fire twice from one click;
- refreshes the UI after completion.

The first implementation should erase Chronicle history while preserving addon settings. A separate “factory reset” is not part of this pass.

### First-run experience

On the first successful boot of this version family, print one concise chat message:

> Moms Against Magic Chronicles is recording locally. Type /mam to open it. Nothing is uploaded or shared yet.

Do not auto-open a large window during login. Store a `welcomeVersion` value so the same welcome is not repeated every session. A later major onboarding change may use a new value.

## Visual direction

Use a restrained Warcraft journal style rather than a generic grey utility panel:

- dark charcoal/brown panel surfaces;
- parchment-gold headings and borders;
- restrained faction-neutral red as the Moms Against Magic accent;
- standard WoW-readable fonts and native highlight colours;
- a simple circular icon combining an open chronicle/book with a crossed-out magical spark.

Readability wins over ornament. No animated background, oversized branding, or texture that makes timeline text harder to scan.

The icon should be created as an original asset and shipped in a WoW-supported texture format. Do not reuse art from another addon.

## Data design and migration

Keep database schema version `1`; these are backward-compatible settings additions, not an event-record migration.

Add or normalise:

```lua
settings = {
  -- existing recording settings remain unchanged
  showMinimapButton = true,
  ui = {
    point = "CENTER",
    x = 0,
    y = 0,
    width = 780,
    height = 560,
    activeTab = "Chronicle",
    minimapAngle = 225,
  },
  welcomeVersion = nil,
}
```

Migration/normalisation rules:

- fill missing nested keys without replacing valid existing settings;
- accept only known anchor points and tabs;
- require finite coordinates and dimensions;
- clamp dimensions to the frame's supported minimum and a reasonable screen-bound maximum;
- normalise the minimap angle to `0–359`;
- ignore malformed saved UI state and use defaults;
- never erase Chronicle events merely because UI preferences are malformed.

## Code organisation

Add two production modules rather than making the already-dense `UI.lua` responsible for everything:

```text
addons/MAMChronicles/
|-- Launcher.lua          minimap button, tooltip, Addon Compartment hooks
|-- SettingsPanel.lua     Blizzard Settings registration and shared actions
|-- MAMChroniclesIcon.tga original addon/minimap icon
`-- UI.lua                main-window persistence and presentation updates
```

Proposed TOC order:

```text
Core.lua
Database.lua
EventStore.lua
Collectors.lua
Statistics.lua
Export.lua
UI.lua
Launcher.lua
SettingsPanel.lua
```

`Core.lua` boots the database and collectors, then initialises UI-adjacent modules only after SavedVariables are open. Launcher or Settings failures must be caught and recorded without stopping data collection.

## Metadata

Update the TOC with:

- version `0.2.0-alpha2`;
- `IconTexture` using the new original asset;
- Addon Compartment function metadata;
- a suitable category value only if supported across the target manifests;
- project/source metadata only when a real stable URL exists;
- an explicit licence file in the package.

Do not invent a CurseForge, GitHub, or website URL.

## Error handling

- Every optional Blizzard surface is capability-gated.
- A launcher/settings error must not disable Chronicle collection.
- Saved frame state is written only from validated frame measurements.
- Tooltip and Settings calls use safe wrappers where the harness or Forever may lack the API.
- Data deletion operates on the existing database object so other modules do not retain stale references.
- Destructive confirmation is never silently skipped when `StaticPopupDialogs` is unavailable; the control becomes unavailable and explains why.

## Testing

Add automated coverage for:

- new TOC metadata and exact load order;
- nested settings migration and malformed-state recovery;
- minimap default state, hide/show, drag-angle normalisation, left-click toggle, right-click settings, and tooltip text;
- Addon Compartment global functions with and without optional APIs;
- window state capture, validated restore, reset, toggle, active tab persistence, and Escape registration;
- menu choices, scroll-slider synchronisation, and paging button state;
- modern Settings registration, legacy fallback, and no-API graceful degradation;
- first-run welcome appearing once;
- erase confirmation and history-only deletion;
- packaging of the new modules, icon, licence, manual, and checklist updates;
- existing 69 addon tests and the diagnostics/dashboard regression suites.

Live acceptance must additionally verify:

- minimap drag and persistence after `/reload` and full restart;
- minimap hide/show recovery through Blizzard Settings;
- Addon Compartment visibility/action on Retail;
- window position/size persistence and reset;
- visual clipping at minimum size and common UI scales;
- tooltip, menus, Escape handling, and confirmation dialog;
- no Lua errors and no interruption to event capture.

## Delivery checkpoints

1. ~~Approve this design.~~ Approved on 30 September 2026.
2. Write a test-driven implementation plan and update `PROJECT-HANDOFF.md`.
3. Implement settings migration and reusable state actions.
4. Implement window persistence and interaction polish.
5. Implement minimap launcher and Addon Compartment support.
6. Implement Blizzard Settings and guarded reset/data controls.
7. Create and validate the original icon.
8. Update metadata, licence, manual, checklist, and package allowlist.
9. Run all automated suites, inspect the archive, and update the handoff with exact evidence.
10. Install only while WoW is closed, then complete live acceptance when the user is available.

## Out of scope

- guild sync and addon-message transport;
- Raspberry Pi upload or web dashboard changes;
- continuous player tracking;
- recipe sharing;
- raid/dungeon readiness scoring;
- localisation beyond keeping user-facing strings easy to extract later;
- profile systems, themes, or a general-purpose framework rewrite.
