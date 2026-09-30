# Moms Against Magic Chronicles — Project Handoff

**Last updated:** 30 September 2026  
**Current addon version:** `0.2.0-alpha19`  
**Current status:** alpha11 (recap, goals, safer data) complete in AUTOMATED testing (Chronicles 322/322; alpha10 polish before it) and published to both clients and the CurseForge package. Nothing new has been observed live; Forever and two-player guild sharing are still unproven.
**Authoritative checkout:** `C:\Users\44750\.codex\worktrees\mam-chronicles-phase0\WoW`

This is the first file a new agent should read. Keep it current whenever the version, design, verification status, release location, major decision, or next action changes.

**Standing build rule from the user (30 September 2026): after EVERY change, update the user's installed build on BOTH WoW clients AND the CurseForge package.** Run `pwsh -NoProfile -File scripts/publish-build.ps1` from the repository root. It runs all suites, packages the ZIP into `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-<version>/` together with the tester notes, manual, checklist, medal catalogue and the `curseforge/` material, verifies the ZIP against source, and installs to `_retail_` and `_classic_beta_`. A client whose game process is running is skipped with a message; ask the user to close the game and run it again. Bump the TOC/`Core.lua`/package version for feature changes, keep `addons/MAMChronicles/CHANGELOG.md` current (it ships in the package and feeds CurseForge), and record the new SHA-256 here. Uploading to CurseForge itself stays the owner's action.

**Standing continuity rule from the user:** update this handoff as work progresses, including during a partially completed milestone. If the active agent stops or runs out of usage, another agent must be able to identify the last completed check, the current work in progress, and the exact next action from this file alone.

## 1. Project vision

Moms Against Magic Chronicles is a private World of Warcraft guild-history system for the guild **Moms Against Magic**.

The long-term product should:

- record memorable guild activity such as levels, deaths, quests, discoveries, loot, achievements, professions, dungeons, and raids;
- create fun monthly guild summaries and awards;
- show participating guild members on a live map;
- show professions, recipes, and crafting coverage;
- report dungeon and raid readiness, including whether required quests have been completed;
- use a Raspberry Pi as the guild's always-on archive and dashboard.

The project is intentionally being delivered in safe phases. The current addon is a **personal local Chronicle**, not yet the shared guild/Pi system.

## 2. Non-negotiable product rules

- The public name is **Moms Against Magic Chronicles**. Use “Moms,” not “Mums.”
- Support both current Retail and WoW Forever where the client APIs permit it.
- Capability-gate differences between the clients; never assume Retail evidence proves Forever support.
- Record only facts the client can prove. Do not invent a killer, quest name, completion state, item quality, or location.
- Privacy is the default. Do not collect chat, whispers, BattleTags, account paths, IP addresses, gold, mail, trades, or continuous movement trails.
- Exact coordinates are only for notable events or an explicit manual memory, and can be disabled.
- Guild sharing of non-sensitive data is on by default (user decision, 30 September 2026) but must stay visible, easy to opt out of, rate-limited, and resilient when addon messages are restricted. Sensitive data (gold, chat, location trails) is never shared by default.
- Raspberry Pi integration must eventually use a desktop/out-of-game bridge. WoW addons cannot make arbitrary web requests or upload directly to the Pi.
- Inspect reference addons for patterns and ideas, but check their licences and independently implement anything whose code cannot legally be reused.
- Clearly separate automated simulation from live in-game proof.

## 3. Current delivery phase

### Phase 0 — compatibility discovery

The separate `MAMChroniclesDiagnostics` addon was built and live-tested on Retail. It proved:

- addon loading and allowlisted event registration;
- SavedVariables persistence across `/reload` and full restart;
- map ID, normalised map position, and outdoor world-position APIs;
- Cooking detection and current profession-window recipe enumeration;
- the sampled Retail realm restricts outgoing addon messages even when chat lockdown is off.

It did **not** prove a guild roster because no guilded Retail test character was available. Forever remains pending because the user's beta account is unavailable/banned from beta access.

### Phase 1 — personal Chronicle core

Implemented as `MAMChronicles` version `0.2.0-alpha1`:

- versioned persistent SavedVariables database;
- bounded append-only event history and deduplication;
- separate character quest/profession history;
- collectors for sessions, levels, deaths/returns, quests, zones, instances, notable loot, professions, achievements, and manual memories;
- searchable and filterable Chronicle timeline;
- monthly/preset statistics and evidence-based awards;
- privacy-filtered Courier export and diagnostics;
- four-tab UI: Chronicle, Statistics, Settings, Diagnostics;
- `/mam`, `/mam remember`, `/mam stats`, `/mam export`, `/mam diag`, and `/mam help`;
- safe packaging and installation scripts for `_retail_` and `_classic_beta_`.

This phase is coded and covered by automated tests. Its production UI and collectors still require the tester checklist to be completed in live Retail.

## 4. Current repository map

```text
addons/MAMChronicles/                 production personal-Chronicle addon
addons/MAMChroniclesDiagnostics/      separate Phase 0 capability probe
tools/mam-chronicles/                 Fengari/Node automated addon tests
tools/mam-chronicles-diagnostics/     diagnostics automated tests
scripts/                              safe package/install scripts
docs/discovery/                       product and platform research
docs/manuals/                         user-facing manual
docs/testing/                         live test results and checklists
docs/superpowers/plans/               implementation plans
docs/superpowers/specs/               earlier platform/dashboard designs
guild-dashboard/                      earlier privacy-first Pi dashboard work
```

Important files:

- `addons/MAMChronicles/MAMChronicles.toc` — manifest, interface targets, version, load order.
- `addons/MAMChronicles/Core.lua` — namespace, startup, session lifecycle, commands.
- `addons/MAMChronicles/Database.lua` — schema, recovery, settings, characters, retention.
- `addons/MAMChronicles/EventStore.lua` — validation, IDs, deduplication, query and pinning.
- `addons/MAMChronicles/Collectors.lua` — WoW event adapters and capability-gated capture.
- `addons/MAMChronicles/Statistics.lua` — summaries and awards.
- `addons/MAMChronicles/Export.lua` — diagnostics, summaries, and Courier output.
- `addons/MAMChronicles/UI.lua` — current four-tab UI.
- `docs/manuals/mam-chronicles-user-manual.md` — current user manual.
- `docs/testing/mam-chronicles-phase1-tester-checklist.md` — required live acceptance.
- `docs/discovery/2026-09-29-moms-against-magic-chronicles-research.md` — architecture and research basis.

## 5. Current client and data compatibility

The TOC currently targets:

- Retail interface `120100`;
- Retail interface `120105`;
- WoW Forever interface `16001`.

The current live Retail evidence is from client `12.1.0.69933`, interface `120100`, locale `enUS`.

Forever uses a modern/Mainline-style addon surface but is a moving beta target. Treat every Forever claim as pending until tested on the current build.

Database details:

- SavedVariables key: `MAMChroniclesDB`;
- schema version: `1`;
- default maximum history: `10,000` events;
- manual memories can be pinned and survive compaction;
- quest completions and profession snapshots are character-scoped;
- current notable-loot default: Epic or better.

## 6. Verification status

Last fully recorded automated result:

| Suite | Passed | Failed |
|---|---:|---:|
| Chronicles addon | 69 | 0 |
| Diagnostics addon | 35 | 0 |
| Guild dashboard regressions | 39 | 0 |
| **Total** | **143** | **0** |

The latest source and release copies were also previously checked file-for-file. Re-run all verification after any source change; do not rely only on this historical count.

Required commands from the repository root:

```powershell
npm test --prefix tools/mam-chronicles
npm test --prefix tools/mam-chronicles-diagnostics
npm test --prefix guild-dashboard
pwsh -NoProfile -File scripts/package-mam-chronicles.ps1
git diff --check
```

Before a real installation:

1. Fully exit WoW.
2. Use `scripts/install-mam-chronicles.ps1`; do not replace addon files while the client is running.
3. Keep the timestamped backup produced by the installer.
4. Read back the installed manifest and compare installed file hashes with the tested source.
5. Complete the live checklist and record PASS, FAIL, or NOT TESTED honestly.

## 7. Current release

Previous (alpha1) tester release directory, superseded by the alpha2 directory recorded in section 9:

```text
C:\Users\44750\Documents\ChatGPT\WoW\tester-releases\MAMChronicles-0.2.0-alpha1\
```

Expected contents:

- `MAMChronicles-0.2.0-alpha1.zip`
- `SEND-TO-TESTERS.txt`
- `TESTER-CHECKLIST.md`
- `USER-MANUAL.md`

Last recorded ZIP SHA-256:

```text
5F3F25A78DD62FF20AC829CEC0A8C782823ED82C730926847E64CCAE52542D12
```

This hash is historical. Recalculate and replace it here whenever the package changes.

## 8. What is still unverified

- Full live acceptance of the production `MAMChronicles` addon on Retail.
- Production data persistence across `/reload` and a full client restart.
- Natural level-up, death, resurrection, quest, instance, loot, achievement, and profession-change captures in the production addon.
- Restricted-area/instance map behaviour.
- Guild-roster behaviour on a guilded character.
- All WoW Forever behaviour.
- Performance and memory use during a normal live session.
- Guild sync, Pi ingestion, live guild map, shared professions, recipes, readiness scoring, and monthly-letter generation; these are later phases, not hidden features.

## 9. Immediate product gap: proper-addon polish

The core works, but the outer shell still feels like an alpha. The next design/implementation pass should cover:

### Essential polish

- a custom minimap launcher: left-click toggles the Chronicle, right-click opens settings, drag changes position;
- a setting to hide/show the minimap button;
- modern Retail Addon Compartment support;
- a Blizzard Settings category, with a legacy fallback only where required;
- persistence for the main window position, dimensions, active tab, and minimap angle;
- a Moms Against Magic icon in the AddOns list, minimap button, and relevant UI;
- visible active states for tabs, filters, and selected ranges;
- tooltips for controls whose purpose is not obvious;
- Reset Window and Reset Minimap Position controls;
- a guarded Erase Chronicle Data action with explicit confirmation;
- a concise first-run welcome explaining `/mam` and privacy boundaries;
- Escape-key handling and reliable frame reuse.

### UI tidy-up

- replace cyclic pseudo-dropdown controls with clearer menus where compatible;
- provide a visible, usable scrollbar and consistent paging behaviour;
- improve empty, loading, unknown-capability, and no-results states;
- tidy spacing, typography, button states, focus states, and resizing limits;
- keep export text selectable without timeline rows intercepting the mouse;
- keep the UI dependency-free unless a library provides a clear compatibility benefit.

### Packaging and metadata

- add `IconTexture` and suitable category/project metadata to the TOC;
- add an in-addon About/version area or equivalent discoverable version display;
- add a changelog and explicit licence statement;
- update the manual, tester checklist, package allowlist, and tests for every new shipped file.

The user said to proceed on 30 September 2026. Unless corrected, this is being treated as approval to design the recommended **full tester-quality polish pass**, not a minimap-only patch. Production code must still follow the recorded design and verification checkpoints.

The approved design is recorded in `docs/superpowers/specs/2026-09-30-mam-chronicles-proper-addon-polish-design.md`. It uses a native, dependency-free implementation with two focused new modules (`Launcher.lua` and `SettingsPanel.lua`) plus an original icon.

The executable plan is `docs/superpowers/plans/2026-09-30-mam-chronicles-proper-addon-polish.md`. It has seven test-driven tasks. **Progress: 7/7 tasks complete (automated).**

Completed polish checkpoint:

- Task 1 added `showMinimapButton`, validated nested `settings.ui`, `welcomeVersion` normalisation, `Database:ResetUIState()`, and `Database:ClearHistory()`.
- The RED run failed for all three new behaviours as expected.
- The GREEN full Chronicles suite passed **72/72** on 30 September 2026.
- Task 1 commit is the latest `feat: persist validated Chronicles UI preferences` commit shown by `git log`.
- Task 2 added window restore/save/reset/toggle, active-tab persistence, Escape registration, and stateful UI harness coverage.
- Reset Window deliberately preserves the separately controlled minimap angle.
- The Task 2 RED run failed for all three missing UI behaviours; the GREEN full Chronicles suite passed **75/75**.

Completed Task 3 checkpoint (launcher):

- Added `Launcher.lua`: 32px minimap button, drag-to-angle (saved, normalised 0-359, non-finite ignored), reset to 225, left click toggles Chronicle, right click opens `SettingsPanel:Open()` if present else the Settings tab, tooltip, visibility from `showMinimapButton`.
- Global Addon Compartment callbacks `MAMChronicles_AddonCompartmentClick/Enter/Leave` (nil-safe when `GameTooltip` is absent).
- `Core.lua` initialises the launcher via `SafeCall` at the end of `Boot()`; TOC has the three compartment fields and loads `Launcher.lua` last; package allowlist includes `Launcher.lua`. Version not bumped (Task 6).
- `MAMChroniclesIcon` texture file does not exist yet (Task 5 creates the original icon); until then the button icon is blank.
- Chronicles suite **80/80** passing (75 prior + 5 launcher).
- Task 3 implementation commit: see latest `feat: add Chronicles minimap launcher` in `git log`.
- Progress after Task 3: 3/7.

Completed Task 4 checkpoint (settings/welcome/erase):

- Added `SettingsPanel.lua`: Blizzard `Settings` canvas category (legacy `InterfaceOptions_AddCategory` fallback, else opens the in-addon Settings tab), `ApplySetting` allowlist incl. `showMinimapButton` (syncs launcher), `ResetWindow`, `ResetMinimap`, guarded `RequestEraseHistory` with `MAMCHRONICLES_ERASE_HISTORY` popup (returns false and deletes nothing when popup APIs are absent; settings survive erase).
- `Core.lua`: registers panel in `Boot()` via `SafeCall`; `ShowWelcome()` prints the local-only welcome once (`welcomeVersion="personal-chronicle-v1"`).
- `UI.lua`: Settings tab gains minimap checkbox plus Reset Window / Reset Minimap Button / Erase buttons.
- TOC loads `SettingsPanel.lua` last; package allowlist updated.
- Chronicles suite **87/87** (80 + 7 settings-panel tests; RED run confirmed 9 expected failures first).
- Progress after Task 4: 4/7.

Completed Task 5 checkpoint (navigation/controls polish):

- `UI.lua`: selected tab shows `LockHighlight` + disabled state; filter/range are now anchored exact-choice menus (`OpenFilterMenu/OpenRangeMenu`, `SelectFilter/SelectRange` reject unknown values); `SetTimelineOffset(offset,total)` clamps to `total-30`; `UpdateNavigation` disables Previous/Next at boundaries; vertical `Slider` and mouse wheel (5 records) share one offset; tooltips on search, filter, range, paging, slider, reset and erase controls; distinct empty ("no entries yet") vs no-match messages. Row pool stays fixed at 30.
- Decision: the older page-aligned clamp (offset 30 of 38 showed 8 rows) was replaced by the plan's `total-30` clamp (last window always shows 30 rows). The old test `timeline paging reaches entries beyond the fixed row pool` was updated to the new contract.
- Harness: Slider methods, FontString text capture.
- Suites: Chronicles **95/95**, Diagnostics **35/35**, Guild dashboard **39/39**.
- Progress after Task 5: 5/7.

Completed Task 6 checkpoint (icon, metadata, licence, docs) - also absorbed the plan's Task 7 Steps 1-3:

- Version bumped to `0.2.0-alpha2` (TOC, `Core.lua`, `tools/mam-chronicles/package*.json`).
- Original icon `MAMChroniclesIcon.tga` (64x64 uncompressed 32-bit TGA) generated reproducibly by `tools/mam-chronicles/make-icon.py` (pure Python; open book, dark-red cover, gold edge, crossed-out spark; inspected at full size and 32px). The plan called for an image-generation skill; none was available, so a programmatic original was used. It can be replaced later without code changes.
- TOC now has `IconTexture` and `Category: Chat & Communication`; no invented website/source URL. `LICENSE.txt` is a project-owned private-testing licence (owner may swap in an open-source licence later).
- **Defect found and fixed:** `scripts/install-mam-chronicles.ps1` had its own allowlist that omitted `Launcher.lua`/`SettingsPanel.lua` (an installed addon would have failed to load files listed in the TOC). Installer and packager allowlists now both contain the 13 shipped files; the install test checks the exact file list and hashes for `_retail_` and `_classic_beta_`.
- README, manual (opening methods, window persistence, menus, erase, first-run), and tester checklist (new alpha2 section) updated.
- Suites: Chronicles **98/98**, Diagnostics **35/35**, Guild dashboard **39/39**; `git diff --check` silent.
- Test-package SHA-256 (temp build, not yet a release): `929D6FB02B9A8A0E3ADAD8911C615379412B824D613BF851C9A00B2E9105C7E7`.
- Task 6 implementation commit: `4267990`.
- Progress after Task 6: 6/7.

Completed Task 7 checkpoint (package and release) - AUTOMATED/PACKAGE EVIDENCE ONLY, NOT LIVE ACCEPTANCE:

- Final verification on the Task 6 tree: Chronicles **98/98**, Diagnostics **35/35**, Guild dashboard **39/39** (total **172/172**); `git diff --check` silent.
- Fake-client install tests cover `_retail_` and `_classic_beta_` (exact 13-file list + source-identical hashes), manifest validation, unrelated-addon preservation, backup/rollback on failed activation, and refusal while WoW is running.
- Release directory: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha2/` containing `MAMChronicles-0.2.0-alpha2.zip`, `SEND-TO-TESTERS.txt`, `TESTER-CHECKLIST.md`, `USER-MANUAL.md`. The alpha1 release directory was left untouched.
- Release ZIP SHA-256 (alpha2): `929D6FB02B9A8A0E3ADAD8911C615379412B824D613BF851C9A00B2E9105C7E7`. The expanded ZIP was compared with `addons/MAMChronicles`: 13 files, 0 differences.
- Progress: **7/7 tasks complete** (automated). The old alpha1 hash in section 7 is historical.

Achievement Statistics module (alpha3) - AUTOMATED EVIDENCE ONLY, NOT LIVE-TESTED:

- New `AchievementStats.lua` (loaded after `Statistics.lua`). Reads the game's Statistics tab via `GetStatisticsCategoryList/GetCategoryInfo/GetCategoryNumAchievements/GetAchievementInfo/GetStatistic` (present on Retail and Forever per the Warcraft Wiki), discovered at runtime, capability-gated, skipped in combat (retry after 15s), scheduled once per session 8s after `PLAYER_ENTERING_WORLD`.
- Stored per character in `MAMChroniclesDB.statistics[charKey] = {baseline, latest, months}` plus shared `statisticCatalog`; months pruned to 6. Top changes = latest minus first-scan-of-month. Text shown under the Statistics tab ("Lifetime statistics"); `/mam diag` has a `Statistics: state, N read, M unreadable` line. Erase Chronicle Data clears it.
- Settings `recordStatistics` (default on) and `recordGoldStatistics` (default OFF). Gold/money stats are local-only, purged when the setting is switched off, and not in the Courier export.
- Decision recorded (user asked to proceed): gold = opt-in local setting. Sharing: user wants whole-guild default; not built (no sharing exists). Proposed Phase 2 resolution needing the user's explicit confirmation: non-sensitive categories share by default after a visible first-run notice with one-click opt-out and rate limits; gold never shares by default.
- Comparison/review: `docs/research/2026-09-30-similar-addons-comparison-and-review.md` (Deathlog GPLv3, Guild Chronicle ARR, HazeAltVault ARR, alt trackers; listing pages only, no code read). Key known limitations: English-only category matching, unproven live value formats, synchronous scan cost, SavedVariables growth.
- Version `0.2.0-alpha3`. Chronicles **112/112**, Diagnostics **35/35**, Dashboard **39/39** (total **186/186**); `git diff --check` silent.
- Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha3/` ZIP SHA-256 `9744952724A0CADE0B77BD81E0B88E73EEB02ADFCCD57C70955FEB2B533A68D9`; expanded ZIP matches source (14 files, 0 differences). **Installed and hash-verified (14 files, 0 diffs) on BOTH `_retail_` (12.1.0.69933) and `_classic_beta_` (WowB 1.60.1.70124, WoW Forever) on 30 September 2026**; backups in `C:/Users/44750/Documents/ChatGPT/WoW/addon-backups/`.
- Forever readiness (no live proof yet): TOC lists interface 16001; statistics APIs are listed as available on Forever by the Warcraft Wiki; every optional API (Settings, Addon Compartment, StaticPopup, C_Timer, SetResizeBounds) is capability-gated; fixed `SetMinResize` -> `SetResizeBounds` fallback so the minimum window size is applied on modern clients (2 tests). Forever test needs the user to log in on the Forever client and run the checklist; the Forever install already had an older alpha1 folder, now replaced.
- **DECISION (user, 30 Sep 2026): guild sharing is ON BY DEFAULT for the whole guild** because it is important to the addon feeling alive. This overrides the earlier opt-in rule for non-sensitive data only. Required safeguards for Phase 2 (keep): a visible first-run notice saying what is shared, a one-click opt-out in Settings, per-category toggles, rate limits and sender volume caps, receive-side plausibility checks, graceful stop when addon messages are restricted, and **gold/money, chat, location trails and other sensitive data never shared by default**. Nothing is shared in alpha3 because no sharing code exists.

Live Retail result for statistics (user, 30 Sep 2026, alpha3 build 12.1.0.69933): `Statistics: ok, 414 read, 15 unreadable`; 27 events, 0 collector errors. Groups shown: Deaths and combat 51, Quests 5, Exploration and travel 3, Dungeons and raids 300, Social 2, Player versus player 5, Other 48. **No Professions, Loot and items, or Time played group appeared** - cause unknown (either classified into Other, unreadable formats, or absent on the client). Forever not yet tested live.

Post-result improvement (source only; NOT yet installed because WoW was running): statistics text now shows headline lifetime values per group (top 3 by value, durations as `2d 3h`) instead of "N tracked"; `/mam diag` now also prints up to 5 `Unreadable sample: name = raw text` lines and an `Uncategorised: <root category> (n)` list. Chronicles suite **116/116**. Release ZIP in the alpha3 release folder rebuilt with SHA-256 `BC36D243926078EEAF0C44FB47437D616F5A730A3D315E0D2AFEABE1E9C23B3C`. The installed alpha3 on both clients is the previous build (same version string, older files); reinstall after WoW is closed and ask the user for the new `/mam diag` output to fix grouping and parsing.

Second live Retail diagnostics (user, 30 Sep 2026, build 69933, 30 events): unreadable samples were all `count (label)` formats, e.g. `16025 (Humanoid)` and `9 ()`; uncategorised roots were Legacy (19), Character (17), World Events (9), Pet Battles (3). Headline display worked (e.g. Creatures killed 36,717; Quests completed 2,629; Total 5-player dungeons entered 228).

Fix (source, NOT yet installed because WoW was running again): parser now accepts a count followed by a bracketed label; new groups Character, World events, Pet battles, Legacy. Chronicles suite **118/118**. Release ZIP rebuilt, SHA-256 `16DA6614F0878F1AB3800662CB424CC4602E59E999489D65FC1137F9838B43FE`. Still unexplained: no Professions or Time played group on that character (likely none present for that character, unproven); Consumables-type stats should now appear under Loot and items. Bracketed labels (e.g. the creature type) are discarded; showing them is a possible enhancement. The Forever client has still not been tested live.

Third live Retail result (user, 30 Sep 2026, build 69933, interface 120100, bb4b6e1 installed on BOTH clients, hash-verified): `Statistics: ok, 429 read, 0 unreadable`; no `Uncategorised` line; 33 events, 0 collector errors. Groups displayed with sensible headline values: Deaths and combat, Quests, Exploration and travel, Dungeons and raids, Social, Player versus player, Character, World events, Pet battles, Legacy. Statistics on **Retail: PASS (user-observed)**. No Professions, Loot and items, or Time played group appeared for this character (consumable stats such as Healthstones used sit under Character). **Forever: still NOT tested live** - this screenshot is Retail.

UI redesign (alpha4, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY, visual result NOT yet seen by anyone:

- Inspiration: the installed DialogueUI addon (author Peterodox; no licence file found, treated as all rights reserved - ideas only, no code or art copied). Its approach: own themes (Brown/Dark), custom-art buttons with hover overlays, custom scrollbars. We chose a flat, texture-free style from solid colours on the stock `WHITE8x8` texture so it works on Retail and Forever with no assets.
- New `Theme.lua` (loaded before `UI.lua`): palette (dark panels, crimson accent echoing the icon, gold headings), event-type labels and colours (`DescribeType`), and helpers `Panel`, `Button` (hover/disabled), `Tab` (accent underline), `Check`, `Scrollbar`, `Input`.
- `UI.lua` rebuilt with relative anchors: title bar with icon and flat close button, tab strip, toolbar (search with hint, Filter/Range) shown only on the Chronicle tab, colour-coded rows (stripe, time column, type label, hover and selected highlight, zebra), details panel, flat scrollbar, footer with Previous/Next, page range and version, resizing re-lays rows (13-20px pitch). Settings tab uses themed checkboxes in two columns and a red Erase button; Statistics text is colourised (gold headings, green changes). Tooltips now chain via `HookScript` so hover highlight survives (real defect caught in review).
- Statistics headline separator changed from a pipe to a middle dot (pipes are escape characters in WoW text).
- Known risk: the stubs cannot prove appearance. First live look may show misalignment, clipped text, or wrong colours; user screenshots needed. Blizzard Settings page (`SettingsPanel.lua`) still uses stock templates on purpose.
- Version `0.2.0-alpha4`. Chronicles **127/127**, Diagnostics **35/35**, Dashboard **39/39**. Installed and hash-verified (15 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`; backups in addon-backups. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha4/` ZIP SHA-256 `292049AE52807720664B23F074BB5A7FD53C8EB226E7CF59DE8CE2A019CF586F`.

Home dashboard and scrolling (alpha5, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; layout not yet seen live:

- User feedback on the alpha4 screenshot (Retail): look approved ("good"); Statistics text overflowed the bottom of the window and did not react to resizing; other UI showed faintly through the panel. User asked for a dashboard/home page.
- Fixes: Statistics, Diagnostics, export text and empty states now live in a `ScrollFrame` (`UI.textScroll`/`textChild`/`textSlider`) whose width follows the window (`UI:ApplyLayout`, `UpdateTextScroll`, wheel 28px); the window has a fully opaque fill (`UI.bgFill`, alpha 1) in addition to the backdrop.
- New `Dashboard.lua` and **Home** tab (first tab and new default, `activeTab="Home"`): greeting (realm, level, zone), six headline tiles matched by statistic name (`Creatures killed`, `Quests completed`, `Deaths`, `Dungeons entered`, `Flight paths`, `Delves completed`; dash when absent; "+N this month"), This month card, Recent activity card with View all, quick "Remember this moment" box (uses `/mam remember`). `Dashboard:Build()` is the testable model; `Dashboard:Layout(w,h)` uses 2 columns at width >= 700, else 1.
- Older tests that assumed Chronicle as default were updated (five tabs, default Home). Real defect caught: dashboard/tab layout assumptions around `frame:GetHeight` (now uses the layout height).
- Version `0.2.0-alpha5`. Chronicles **135/135**, Diagnostics **35/35**, Dashboard **39/39**. Installed and hash-verified (16 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha5/` ZIP SHA-256 `810E7642E8ADEB45A6B81E2359E37D628CA4B97C76150562A84CA58D88F168A5`.

Settings, Mom Medals, toasts, guild sharing (alpha6, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; NOTHING here has been observed live and guild sharing has never run between two real players:

- User feedback on alpha5: overflow fixed; background good but wants a transparency option and properly organised settings; Home is a good start. Decisions: build **Mom Medals** (custom guild achievements) earning **Mom Money**, tracked and announced to the guild; toasts on by default, silenced in combat and shown after; multiple themes; bracketed statistic labels; guild sharing on by default (with safeguards); Characters roster tab and Pi export come AFTER (user: "make sure it's working across apps and users first and sending info to the Pi").
- Checkpoint 1 `7771341` settings: scrolling Settings page (Appearance, Alerts, Recording, Statistics, Data, Window, Danger zone); `windowAlpha` (0.3-1, live via `UI:ApplyAppearance`); four themes (`Theme.presets`: midnight, parchment, crimson, slate) applied at Boot; existing frames keep old colours, so **Apply theme calls `ReloadUI()`**; new settings `theme`, `windowAlpha`, `toastsEnabled`, `toastSound`, `announceMedals`, `announceGuildChat` (default OFF), `receiveGuildAlerts`; helpers `Theme:Slider`, `Theme:ScrollArea`.
- Checkpoint 2 `3701b87` medals: `Medals.lua`, ~40 definitions as data (`Medals.version=1`; tiers 10/25/50/100 Mom Money), measured from statistics (via `AchievementStats:FindValue`) and Chronicle event counters; **silent retroactive baseline** on first evaluation (waits until statistics are read or ruled out); later crossings emit a `medal.earned` Chronicle event and notify listeners; `db.medals[charKey]`, `db.guildFeed`; Medals tab (six tabs now); Home month card shows Mom Money; Erase clears medals and re-baselines.
- Checkpoint 3 `8816c87` toasts: `Toast.lua`, queue + `PLAYER_REGEN_ENABLED` flush, merges bursts of medal toasts, optional sound, click opens Medals, level-up toast.
- Checkpoint 4 (this commit) guild sharing: `Comms.lua`, addon-message prefix `MAMCHR`, message `M1|<medalId>|<points>|<version>` only (max 64 chars, GUILD channel), 3s send interval, throttle/restricted handling (10 minute back-off, silent), optional guild chat line (default off, 30s limit), receive validation (known medal, exact points, same version, guild channel, not self, 5 per minute per sender, dedupe, feed capped at 50), `/mam diag` `Guild sharing:` line, Guildmates list on the Medals tab; welcome message v2 states what is shared and where to opt out.
- Also: bracketed statistic labels stored in `latest.labels` and shown (e.g. `(Humanoid)`).
- **Unproven in the real client:** appearance of the new pages and toasts; theme contrast (Parchment especially); whether `C_ChatInfo.SendAddonMessage` to GUILD works on these realms (earlier Retail probing found the sampled realm restricts outgoing addon messages even with chat lockdown off - the code degrades to `restricted` and does nothing); Enum.SendAddonMessageResult values beyond Success/throttle are assumed; CHAT_MSG_ADDON sender format; PlaySound kit availability on Forever; ScrollFrame text height measurement timing.
- Version `0.2.0-alpha6`. Chronicles **192/192**, Diagnostics **35/35**, Dashboard **39/39** (total 266). Installed and hash-verified (19 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha6/` ZIP SHA-256 `A57045173A2220A68893DBE6D1071A919071462BB2102BF5B61C461451E0DD65`.

Silly Mom medals, counters and test toast (alpha7, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY:

- User feedback on alpha6 (Retail screenshot of the Medals tab): looks good, baseline granted many medals from history. Requests: a test-toast debug button, and a large set of Mom-themed / silly guild achievements ("x wine drunk").
- Added `Counters.lua`: privacy-safe integer counters in `db.counters[charKey]` (never item names): consumables classified by whole-word keywords (`wine`, `ale`, `coffee`, `food`, `bandage`, `potion`) from `UseAction` / `C_Container.UseContainerItem` post-hooks, **armed then confirmed by the player's next successful cast within 2s** (so cooldown key-mashing does not count; same item within 1.5s counts once); jumps (`JumpOrAscendStart` hook), mounts, AFK, resting, screenshots via events. Medal checks batched 5s after counting.
- `Medals.lua` now has **131 medals in 46 families, 3,850 Mom Money total** (catalogue generated into `docs/manuals/mom-medals-catalogue.md`): wine, ale, coffee, food, bandages, potions, jumps, mounts, AFK, resting, screenshots, late-night/early-morning logins (local time from `session.login` events), and statistics-driven ones (hugs, waves, cheers, dances, kisses, hearthstones, summons, abandoned quests, dailies, auction purchases, healthstones, vanity pets, pet battles, mislaid curiosities), plus deaths and Cooking/Fishing skill. Statistic-name medals silently stay locked if the client does not report that statistic.
- `Toast:SendTest()` behind Settings > Alerts > "Send a test toast" and `/mam toast` (cycles info, medal, guildmate; prints why when dropped or queued). `/mam` with no argument now keeps the last tab instead of forcing Chronicle.
- Known limits / unproven live: consumable detection relies on cast events after `UseAction`/bag-use hooks (last item of a bag stack may be missed; if the cast event does not fire for some food/drink kinds they will undercount); keyword lists are English-only; `Medals.version` remains 1 so guildmates on older builds drop announcements for medal ids they do not know (counted as `dropped`).
- Version `0.2.0-alpha7`. Chronicles **207/207**, Diagnostics **35/35**, Dashboard **39/39** (total 281). Installed and hash-verified (20 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha7/` ZIP SHA-256 `DE5B03CE10938A67DB198E2EED499410D17DA646251120694B0DB4960F7FD2E1`.

Feasibility check and full medal catalogue (alpha8, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; hooks and detection not yet observed live:

- User asked: check every proposed medal can really be earned, then replace the catalogue with the full list (wacky, interesting, WoW Forever). Result: **235 medals, 83 families, 7,005 Mom Money** (`docs/manuals/mom-medals-catalogue.md`, generated from `Medals.lua`); per-family verdicts and evidence in `docs/research/2026-09-30-medal-feasibility.md`.
- Real defects found by the check and fixed: (1) `deathKind` was never recorded, so Gravity's Favourite could never fire - now set to `falling` when the player was falling within 1.5s (Counters `IsFalling` ticker, live check needed); (2) `session.logout` had no duration, so Marathon Mom could never fire - now recorded; (3) hugs/dances/kisses were statistic-based but the user's Retail Statistics Social group has only Total waves and Total cheers - now emote counters (waves/cheers use max of stat and counter); (4) medal progress was rebuilt from events that compaction deletes - now persisted `db.medalTallies[charKey]` (double-count on first build also fixed); (5) level medals assumed cap 80+ - now hidden when the client's level cap is too low, a level 90 medal added, and Forever cap = 60.
- Splash Landing (drowning) cut (no reliable signal). Guild-wide medals deferred until sharing is proven. First Raid Ever merged into Raid Night; Master Chef/Angler skipped.
- New tracking (Counters.lua): emote hooks on `C_ChatInfo.PerformEmote` and `DoEmote` (deprecated in 12.0; debounced 0.3s; only tracked tokens counted); food/drink categories (cheese, cookie, pie, soup, fish, juice, water added); vendor sales/purchases/repairs hooks; `GROUP_JOINED`/`GROUP_LEFT`; `READY_CHECK_CONFIRM` (own confirm only); `PLAYER_EQUIPMENT_CHANGED` (10s login grace); all guarded by pcall and listed in `/mam diag` (`Medals: client ..., level cap ..., race ..., hooks ...`).
- WoW Forever only (client = interface number < 100000, i.e. 16001): The Journey Matters I-V, Ready for the Core (60), Old World New Tricks, Beta Testing Mom (login before 4 Nov 2026), Day One Mom (login on 4 Nov 2026), One Year Later (365 days since this client's DB was created), Skyborne Landing (race token contains "sky"; token unknown - diag prints it). Launch date and cap come from Blizzard's announcement; interface 16001 from the Warcraft Wiki.
- Version `0.2.0-alpha8`. Chronicles **226/226**, Diagnostics **35/35**, Dashboard **39/39** (total 300). Installed and hash-verified (20 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha8/` ZIP SHA-256 `68EA4989C234C784DA8CF727B0AD7875D50E521499813E4AE7C3C32723D9F75A`.

WoW Forever review and CurseForge package (alpha9, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; campfire and content detection not yet observed live:

- User asked: review every medal so only Forever-doable ones remain (no Mislaid Curiosities etc., level 60 max), research Forever-only features such as campfires and add medals, then prepare a CurseForge package.
- Research (30 Sep 2026): Forever has permanent level cap 60; Normal/PvP/Hardcore rulesets; zones Mount Hyjal, Riverglades, Shen'dralas, Zephras Isle; nine new dungeons; raids Hyjal Summit and The Barrow Deeps; Darkspear Islands battleground; six new race-class combinations plus Skyborne; campfires (Basic/Journeyman/Expert kits unlocked by Cooking 1/140/220, profession camp objects at skill 20/140/300, one-hour buffs, quest The Great Outdoors around level 5); no Delves, Mislaid Curiosities or pet battles. Sources: Blizzard announcement, Warcraft Wiki, Blizzard Watch, ClassicWoW.gg, ForeverChanges (beta guides disagree on some details).
- Review outcome (details in `docs/research/2026-09-30-medal-feasibility.md`, section "WoW Forever review"): Retail-only and hidden on Forever: Delver, Treasure Hunter Mom, Pet Playdate, Achiever, Adventurer IV-V. New availability rule `needsStat`: Slayer, Frequent Flyer, Hearth, Summons, Commitment Issues, Daily Grind, Impulse Buyer, Healthy Snack, Crazy Cat Mom, Auction Goblin, Battlemaster only appear when the client reports the statistic (Forever's Statistics content is unverified). Everything else event/hook/counter based stays.
- Added 29 Forever-only medals: Happy Camper (quest name), Firestarter I-IV, Journeyman/Expert Camper, Camp Decorator, Well Stocked Camp (spell-name detection via `C_Spell.GetSpellName`, keyword and object-name lists in `Medals.campObjects`), Campfire Chef (Cooking 140/220/300), Unexplored Depths I-IV (distinct new dungeons by name), Summit Seeker, Into the Barrow, Islander, New Horizons (new zones), Plot Twist (race-class combos). `/mam diag` prints `Camp spells seen:` so the keyword detection can be verified or corrected.
- Totals: **264 medals, 96 families, 7,985 Mom Money**; a Forever client shows 221 (6,645) with no statistics, up to 250 (7,445) with all statistics; Retail shows 222.
- CurseForge package prepared, NOT uploaded: `LICENSE.txt` changed to All Rights Reserved with personal non-commercial use permitted (**decision for the user to confirm** - the old text forbade public distribution), `CHANGELOG.md` shipped in the addon, `## X-License` added to the TOC, and `docs/release/curseforge/` holds `PROJECT-DESCRIPTION.md`, `SUMMARY.txt`, `CHANGELOG.md` and `UPLOAD-CHECKLIST.md` (also copied to the release folder). Screenshots must be retaken from this build. CurseForge upload, category and game-version choices, and the project ID are the owner's.
- Version `0.2.0-alpha9`. Chronicles **240/240**, Diagnostics **35/35**, Dashboard **39/39** (total 314). Installed and hash-verified (21 files, 0 diffs) on BOTH `_retail_` and `_classic_beta_`. Release: `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha9/` (ZIP 64 KB, one `MAMChronicles` folder, 21 files, verified against source) ZIP SHA-256 `0A85F3F93B26F6A8453F26FD56FDDF67D80F032A90D261D18D271BA5915707A9`.

Tester polish pass (alpha10, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; nothing here has been observed live:

Commits (oldest first): `c601585` handler error count + Copy diagnostics; `aed9f8f` Getting started card, What's new, short welcome; `123b652` Medals filters/search/tooltips/NEW/lazy rows; `c6e9b0f` Forever-first Home and empty states; `e767911` bounded tables + chunked statistics scan; `cc5ada2` combat deferral; `d422682` `C_Item`/`C_ChatInfo` with fallbacks; `a34cc00` Parchment/palette text; `86eeb3d` `/mam help`, `medals`, `settings`, window on screen; `3b2dd80` version, changelog and docs.

- **First run**: `settings.gettingStartedDismissed` (Home card, "Got it"), `settings.whatsNewVersion/whatsNewSeen` with `Addon:GetWhatsNew()/DismissWhatsNew()` (shows after a version change; text lives in `Addon.whatsNewText` in `Core.lua` and must be updated each release). Chat welcome is one line (`WELCOME_VERSION` is now `personal-chronicle-v3`, so everyone sees it once more).
- **Report a problem**: `Addon:Guard(label, fn, ...)` wraps handlers and records `Addon.errorStats` (count, last message <= 80 chars with paths/`#tags` stripped). `Collectors` failures also count. `/mam diag` now has `Handler errors:`, `SavedVariables: events/medals/feed`, `Level cap:`, statistics `scan N ms`. Diagnostics tab has a Copy diagnostics button (selects the text; Ctrl+C is the player's) and a note.
- **Medals tab**: filters All/Earned/In progress/Locked with counts, search, per-medal tooltip (`def.tracking` text derived from counter/statistic/tally tagging), NEW marker (`Medals.newIds`, live awards only, cleared on erase/reload), pooled rows bound while scrolling (about 11 frames instead of 264). `GetSummary` now counts only known definitions, so header counts and Mom Money equal the listed medals even with stale saved entries.
- **Forever-first**: Home tile Campfires lit replaces Delves on Forever; Home shows the real guild sharing state (the old "not available yet" text was stale); statistics empty state says which medals still work. Level 60 cap and Retail-only hiding already existed and are now covered by tests.
- **Robustness**: sessions capped at 500, duplicate-signal table restarted above 300 entries, counters ignore junk and stop at 1e9, statistics scan split into 6 ms slices across frames only when both `debugprofilestop` and `C_Timer.After` exist (otherwise unchanged synchronous path). Tests cover all optional APIs missing, a minimal old SavedVariables file, and a 25,000-event saved history.
- **Combat**: `Addon:AfterCombat` queue run on `PLAYER_REGEN_ENABLED`; window creation/show, `/mam diag`/`export`, the minimap button and resize layout are deferred in combat; closing still works. Counters stop while Record Chronicle is off. Nothing runs per frame except the fall ticker and toast animation; the launcher drag OnUpdate only exists while dragging.
- **APIs**: item lookups go through `Addon:GetItemInfo/GetItemInfoInstant` preferring `C_Item`; guild chat line prefers `C_ChatInfo.SendChatMessage`. Addon messages already used `C_ChatInfo`.
- **Polish**: `Theme:Text` colours every label from the palette (stock fonts were white/grey on the light Parchment panel, a real defect); Parchment gets dark event/tier colours; Midnight accent and Parchment muted adjusted; WCAG contrast test for all four themes (text 7:1, muted and gold 4.5:1, event colours 3.5:1). Saved window size is clamped to the screen. `/mam help` lists every command; new `/mam medals` and `/mam settings`. Escape, scroll-position persistence (Settings and Medals) were already correct and are now tested.
- Docs updated: manual, tester checklist (new alpha10 section), `SEND-TO-TESTERS.template.txt`, CurseForge description and changelog. The medal catalogue was not regenerated because no medal definition changed.
- Suites: Chronicles **300/300**, Diagnostics **35/35**, Dashboard **39/39** (total **374**); `git diff --check` reports no whitespace errors (only the repository's LF/CRLF notices).
- Published with `scripts/publish-build.ps1` on BOTH `_retail_` and `_classic_beta_` (21 files, 0 differences) and the release folder `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha10/`. ZIP SHA-256 `8D995FBF3814CC3D37A62C04581B7C8A958BE9DD010E7CCCB105AF7639F6116C`. Not uploaded to CurseForge; `LICENSE.txt` untouched.
- Tooling note: run the publish script from the PowerShell tool (or set `[Console]::OutputEncoding` to UTF-8) because the script reads the `ℹ pass N` lines from `npm test`; under Git Bash it fails with "Cannot index into a null array".

Decisions and cuts (alpha10):

- **Cut / left as is: SavedVariables corruption recovery.** One invalid event still makes `Database:Open` replace the whole database with a fresh one (`diagnostics.recovery.reason = "corrupt root"`). Existing tests enforce that contract and a salvage path (drop only invalid events) would change it; recommended follow-up, not done.
- **Cut: measuring the scan cost on real hardware.** Only the mechanism exists (`scan N ms` in `/mam diag`, slicing above a 6 ms budget). Real numbers come from the tester's diag line.
- **Cut: per-frame audit of every label for clipping.** Medal descriptions do not wrap (full text is in the tooltip); toasts/timeline rows already disable word wrap. Needs a live visual check.
- **Cut: `Comms.floods` per-sender table is not pruned** (bounded by guild size).
- Did not touch guild-wide medals, Pi export or the Characters roster.

Recap, goals and safer data (alpha11, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; nothing observed live:

Commits: `1e6a54d` salvage + version counters; `ab66cb5` monthly recap; `97a6781` goals + release.

- **Salvage**: `Database:Open` now keeps valid events and drops only invalid, duplicate or future-schema ones; `diagnostics.recovery.reason = "dropped N invalid event(s)"` and `/mam diag` prints it. A damaged root (non-table collections, wrong schema) still starts fresh. The two old database tests were changed to this contract.
- **Guild versions**: `Comms` now counts well-formed medals this build does not know as `status.unknown` and known medals with a different catalogue version as `status.otherVersion` (both flood-limited, neither shown nor dropped); forged points and malformed ids are still `dropped`. `/mam diag` line: `Guild sharing: ..., dropped N, unknown N, other version N`. Still no handshake message; `Medals.version` remains 1.
- **Monthly recap**: `Export:BuildMonthlyRecap(from,to)` (sessions, events, deaths/quests/discoveries/loot, medals earned this month with Mom Money, top 3 statistic changes excluding the gold group, Mom Money total; no name/realm/gold; "Quiet month" when empty). `/mam recap` and a Copy recap button on the Home month card open it in the copy view.
- **Goals**: `settings.pinnedMedals` (max 3, normalised), `Medals:SetPinned/IsPinned/GetGoals`; clicking an unearned medal row toggles the pin (GOAL tag, tooltip hint, limit message); Home month card lists goals with progress or a hint. Earned or unavailable pins drop off.
- Suites: Chronicles **322/322**, Diagnostics **35/35**, Dashboard **39/39** (total **396**).
- Published on BOTH clients (21 files, 0 differences); release folder `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha11/`; ZIP SHA-256 `BF10176851F262DFB9A52807A70BD48FFC5C129D4648012171C764D6DE683C17`. Not uploaded to CurseForge.
- **Cut**: medal description clipping (still single-line, full text in the tooltip); non-English consumable keywords (needs locale word lists); guild medal board (waits for two-player proof); Characters roster tab; Pi export. Goal toasts ("9/10") not built.
- Publish with the PowerShell tool and UTF-8 console encoding (see alpha10 note).

Nearly-there goal toast (alpha12, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY:

- `Medals:CheckGoalProgress(row)` runs at the end of each non-baseline `Evaluate`: for each pinned goal with target >= 5 and progress between 90 and 100 percent it shows one "Nearly there: <medal>" info toast (`row.goalNotified[id]` remembers it, persisted in `db.medals[char]`). Respects the toast setting and combat queue. Commit `c2d501f`.
- Suites: Chronicles **326/326**, Diagnostics **35/35**, Dashboard **39/39** (total **400**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha12/`, ZIP SHA-256 `7ED952EE1006BF08514C82FA05D402F1765A4306B1CEF5AB34273B0A97A87747`. Not uploaded to CurseForge.
- Still cut: medal description wrapping (layout cannot be verified without a live look), non-English consumable keywords, guild medal board, Characters roster, Pi export.

First live look at alpha12 and alpha13 fixes (30 Sep 2026):

- **LIVE RETAIL EVIDENCE (user screenshots, alpha12, build 69933, interface 120100, level 90 character):** Home (Getting started card, What's new line, tiles, goals hint, Copy recap), Medals tab (filters with counts All 222 / Earned 39 / In progress 40 / Locked 143, search box, header `39 of 222`, Mom Money 990), Chronicle timeline, Statistics tab and Diagnostics tab (Copy diagnostics button and note, `Handler errors: 0`, `SavedVariables: events 81, medals 39, feed 0`, `Guild sharing: ready, sent 0, received 0, dropped 0, unknown 0, other version 0`, `Level cap: 90`, hooks installed: UseAction, UseContainerItem, JumpOrAscendStart, PerformEmote, DoEmote, RepairAllItems, BuyMerchantItem, SellAllJunkItems) all render and work on Retail. Settings tab and two-player sharing were not shown.
- **Live finding: the statistics scan took 2747 ms** for 441 statistics (the alpha10 split only paused between categories). Fixed in alpha13: the scan now yields after every single statistic once 6 ms of a frame is used. Needs a live re-check of `Statistics: ok, ... scan N ms` (N is total work across frames now, not one hitch).
- **Live findings fixed in alpha13 (automated tests only):** timeline and Home rows showed raw `session.login`, `session.logout`, `medal.earned` (now "Logged in", "Logged out after 1h 1m", "Reached level N", medal name with Mom Money); Statistics header showed raw timestamps (now dates); count statistics such as "Gold Challenge ratings earned" and "Goldie ... kills" were classified as Gold and money (now only coin-unit values are money).
- Not fixed, cosmetic: Chronicle tab has an empty band between the toolbar and the first row; Home tile numbers look pixelated because `SetTextHeight(22)` scales a bitmap font.
- Commit `cfa9f66`. Suites: Chronicles **330/330**, Diagnostics **35/35**, Dashboard **39/39** (total **404**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha13/`, ZIP SHA-256 `D0CE5A06B92808298C38BE59BC1333D344E32BBEDC6BFF05948FF028D568AE14`. Not uploaded to CurseForge.
- Idea rejected this session: a WoW-free visual preview renderer (layout-solving Lua stub plus HTML). Started and removed; live screenshots from the user are a better check. A future agent can still build one if the user wants layout checks without the game.

Toast sounds and scan pacing (alpha14, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY:

- **Live alpha13 Diagnostics (user screenshot):** `Statistics: ok, 441 read, 0 unreadable, scan 2956 ms`, `Handler errors: 0`, `Collector errors: 0`, sessions 18, events 88. That is total work across slices; after this the scan waits 0.05 s between slices (`SLICE_GAP`) so it adds a few ms every few frames. Live re-check still wanted.
- **Toast sound choices (user request):** `Toast.sounds` (chime, quest, fanfare, loot, ready, raid, ping, whisper, coins), each a stock `SOUNDKIT` name with a numeric fallback id; `settings.toastSoundChoice` (validated, default chime); Settings > Alerts "Toast sound" button cycles and previews; `Toast:PreviewSound`. Sounds still need "Play a sound with toasts" ticked. Unverified live: which kits exist on Forever (the ids are from public sound-kit lists; unknown ids play nothing).
- Commit `993d515`. Suites: Chronicles **340/340**, Diagnostics **35/35**, Dashboard **39/39** (total **414**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha14/`, ZIP SHA-256 `FEA7C5E34D6D19AD73B56A880F2BD22FCE3C5BBB780D356CB64C7E4164F0D83F`. Not uploaded to CurseForge.

Next up, titles, shop, halls, last session, weekly recap (alpha15, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; user asked for these while waiting for WoW Forever / CurseForge approval:

- **Weekly recap:** `Export:BuildRecap(from,to,options)` generalises the monthly recap; `Export:BuildWeeklyRecap()` (last 7 days, no statistic changes, "Quiet week" text); `/mam recap week`. Recaps now start with `Title: ...`.
- **Last session line:** `Statistics:BuildSinceLastLogin()` / `DescribeSinceLastLogin()`. Events only exist while playing, so "since last login" is implemented as "what the previous session of this character did" (levels, quests, discoveries, deaths, notable loot, medals and Mom Money, plus how long ago and how long played). Quick relogs under 5 minutes, other characters and empty sessions give nothing; an unended session ends at its last event. Shown as the first line of the Home month card.
- **Hall of Shame and Fame:** `Statistics:BuildHighlights()` / `DescribeHighlights()` from events still in the journal (most dangerous place, worst day, falls, busiest day, longest session, time played, favourite place, highest level, Chronicle started); shown on the Statistics tab with gold headings. Limit: compacted-away history is not included.
- **Next up filter:** fifth Medals filter, `def.family` added to every medal (series id or single id), first unearned medal per family; filter buttons moved to their own row (list top 124).
- **Mom titles:** `Medals.titles` (family to title, about 60), `GetTitle/GetEarnedTitles/SetTitleChoice`, `settings.titleChoice` (auto or a family). Shown under the Home greeting, on the Medals tab and in recaps. Rookie Mom by default.
- **Mom Money shop:** `Medals.cosmetics` (4 toast colours 50/75/100/150, 3 title flourishes 100/250/500), `Buy/Equip/Unequip/IsOwned/IsEquipped/GetMomMoney/GetToastColour`; per-character `db.medals[char].spent`, account-wide `settings.cosmetics = {unlocked, toastStyle, flourish}` (validated in `Database:NormaliseSettings`). Medals header shows `Mom Money N (M earned)` when something was spent; `GetSummary().total` still means earned. Settings > Mom Money shop has one button per item, a default-colours button and a Title button. Erasing the Chronicle resets spending but keeps bought cosmetics. Cosmetic only; nothing new is sent to the guild.
- Commits: `1e6a54d`..`079f9ea` group (weekly recap + last session, Hall of Fame, Next up, titles/shop/release). Suites: Chronicles **378/378**, Diagnostics **35/35**, Dashboard **39/39** (total **452**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha15/`, ZIP SHA-256 `0BBD65072808686539DBBA2D9F563BE84225E679E8DCD7D800BBE01EE71399E0`. Not uploaded to CurseForge.
- Unverified live: the new Settings section layout (length grew by about 11 buttons), Next up filter row layout, title and flourish wording, Hall of Shame/Fame against real history, toast colours.

alpha16 (30 Sep 2026): the Medals tab now opens on the Next up filter (`UI.medalFilter` default), All is one click away; two older tests now select All first and one new test covers the default. Suites Chronicles 379/379, Diagnostics 35/35, Dashboard 39/39. Published on both clients; ZIP SHA-256 `46C59D229A95621CEE7BD7F77441A08E6371F0A979FD16F913E5B9A0EB65BD99` (release folder `MAMChronicles-0.2.0-alpha16`; commit `10b0788`).

Medal categories and a title per family (alpha17, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY:

- `def.category` for every medal (`Medals.categories`: progress, kitchen, habits, emotes, pattern, forever; forever client medals always go to forever; family mapping in `Medals.familyCategory`). `Medals:GetCategories()` lists categories with earned/total for this client and skips empty ones. Medals tab: `UI.medalCategory`, `SetMedalCategory`, `CycleMedalCategory`, Category button on the search row; it combines with filters, Next up and search, and filter counts follow it.
- Every one of the 96 families now has a unique title (`Medals.titles`); `Medals:GetTitleCounts()`; Medals tab sub line shows `N of M titles`. `Medals:Evaluate` shows a "New title: X" toast the first time a family gets a medal after the baseline (never for the silent baseline).
- Commit `f5062db`. Suites: Chronicles **389/389**, Diagnostics **35/35**, Dashboard **39/39** (total **463**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha17/`, ZIP SHA-256 `757B8F4B4857A47EF1ACF5E404C53D815FFEDB603E4432BEFAA6645D59807592`. Not uploaded to CurseForge.
- Not done: `docs/manuals/mom-medals-catalogue.md` is not grouped by category and was not regenerated (no medal definition changed). Layout of the new Category button on the Medals search row is unverified live.

Weekly Mom Quests, holidays, Characters tab, Memory Book, quiet mode (alpha18, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY. Research before this batch (Forever uses the Midnight addon restrictions; competing guild addons are admin tools; no fun/medal layer exists) is summarised in the chat history, sources: Icy Veins "Addons in WoW Forever", Wowhead "loosen addon API restrictions", Warcraft Wiki C_ChatInfo.SendAddonMessage, CurseForge pages for Alts Forever, Guild Wishlist Tools, Guild Roster Manager, GuildHelper v3, Guild Paragon, RosterForge, Guild Chronicle.

- **Weekly Mom Quests** (Medals.lua): `Medals:GetWeek()` counts 7-day weeks from `Medals.launchEpoch` = 1793750400 (4 Nov 2026 00:00 UTC, week 1 before launch); `GetBand(week)` = 1..6 (changes every 2 weeks, cap at week 12); `GetLevelTarget(week)` table 10,15,20,25,30,36,42,48,54,60 (Forever only). 20 templates in 3 slots (adventure, Mom life, stretch) with per-band targets and minimum bands (dungeons band 2, loot band 4, mounts band 4 ...), choice deterministic from the week number so guildmates see the same quests with no messages; level goals the character already passed are skipped. State in `db.challenges[char] = {week, baselines, done, allDone}`; progress = delta from baseline taken when the week is first seen; rewards 10/15/20 by band (+5 for slot 3) plus 10 for all three go to `db.medals[char].bonus`. `GetEarnedMoney()` = medals + bonus; `GetMomMoney()` = earned - spent. Toasts "Mom Quest done" and "All Mom Quests done"; Home shows "Week N Mom Quests"; `/mam quests`. Week boundaries are fixed by the launch date, not by each player's reset. Known limit: progress made before the first check in a brand-new week (for example right after rollover while offline) is not counted.
- **Quiet mode**: `Toast` hold rule = combat OR (`settings.quietInstances ~= false` and `IsInInstance()` is party/raid/scenario/pvp/arena); flushed on `PLAYER_REGEN_ENABLED` and `PLAYER_ENTERING_WORLD`; new Alerts checkbox, default on.
- **Holidays**: `Medals.seasons` (Brewfest 20 Sep-6 Oct, Hallow's End 18 Oct-1 Nov, Winter Veil 15 Dec-2 Jan, Lunar Festival 21 Jan-4 Feb, Love Is in the Air 5-19 Feb, Midsummer 21 Jun-5 Jul; APPROXIMATE fixed windows, unverified against Forever's calendar). 36 new medals (login days 1/3/7, themed activity 5/25/100, counters `season_<key>` added by `Counters:Add` only while active), new Holidays category and titles, `Medals:ActiveSeason()`, `AnnounceSeason()` (once per holiday per year, stored in bounded `settings.seasonsSeen`) called on `PLAYER_ENTERING_WORLD`. Because the test clock sits inside Brewfest, several older toast tests now pin the date or mark the season as seen.
- **Characters tab** (seventh tab, tabs narrowed to 84 px so all fit 620 px): `Statistics:BuildCharacters/DescribeCharacters` from `db.characters`, `db.medals`, `db.professionSnapshots`; characters now store `level` and `className` (updated on level-up and logout); `Medals:GetTitle(key)` and `GetMoneyFor(key)` work per character. Local only.
- **Memory Book**: `Statistics:BuildMemoryBook/DescribeMemoryBook` (firsts, tens-level milestones, best 5 medals, up to 30 memories newest first, 8 recent deaths with falls); `/mam book` and a Home button.
- Commits `33ae1f1` (release) with the feature commits before it. Suites: Chronicles **441/441**, Diagnostics **35/35**, Dashboard **39/39** (total **515**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha18/`, ZIP SHA-256 `95D913EC81D72F789D370C096D2AFC6663BD378ECCAC40DCE7B27EC939DCFFF0`. Not uploaded to CurseForge.
- Unverified live: whether the weekly quests feel doable at each Forever pace (user wants week one gentle and later weeks harder; targets are estimates), holiday dates on Forever, Home month card length with the quest lines (it grew by about 4 lines), seven-tab layout, Characters and Memory Book wording, quiet mode in real instances, `IsInInstance` types on Forever.
- Still not done from the research list: `/mam selftest` capability report (user chose item 2 = weekly challenges instead of item 1), Guild Today card, leaderboard, Pi ingestion, per-player font size and UI scale, luacheck.

Animations and polish (alpha19, 30 Sep 2026) - AUTOMATED EVIDENCE ONLY; appearance and feel NOT seen live:

- `Theme:CanAnimate/FadeIn/Pulse/StopPulse/GrowBar/Pop` use engine animation groups (`CreateAnimationGroup`), so there is no per-frame Lua; each returns false when `settings.animations == false` (new Appearance checkbox, default on) or the client lacks the API (`SetScaleFrom` is required for Scale animations, otherwise skipped).
- Used for: window fade-in on open (not on refresh), page fade-in on tab change (`UI:FadeActivePage`), Medals progress bars grow from the left (`UI:AnimateMedalBars`, on tab open and filter/category change), toast shimmer (stripe pulse) and icon pop for medal and guild toasts, toast easing (cubic ease-out in, drift up on out), a minimap glow (`Launcher:SetAttention`) while a toast appeared with the window closed (cleared when the window opens), medal row hover highlight, slim accent line along the window top (`UI.topAccent`).
- Test harness gained `CreateAnimationGroup`, `SetAlpha`, `GetAlpha` stubs (`__mamNewGroup` in `harness.js`) so animation calls are recorded and asserted.
- Unverified live: whether Alpha/Scale animation groups behave on Forever, whether fading the window frame interferes with the window transparency setting (transparency is backdrop alpha, frame alpha is animated only during the fade), the look of the glow texture, and any stutter. If something looks wrong, Settings > Appearance > Animations switches all of it off.
- Commit `0677ce8`. Suites: Chronicles **459/459**, Diagnostics **35/35**, Dashboard **39/39** (total **533**). Published on BOTH clients (21 files, 0 differences). Release `C:/Users/44750/Documents/ChatGPT/WoW/tester-releases/MAMChronicles-0.2.0-alpha19/`, ZIP SHA-256 `DA770E4C06548680C36E8986FE0D82FD4DDFB1F0A57F10091612AE8B3AC44FDB`. Not uploaded to CurseForge.

## 10. Later roadmap

1. **Finish live Phase 1 acceptance and UI polish.**
2. **Phase 2: guild Chronicle sync.** Exchange bounded records between participating addon users, with permission/capability reporting and no bypass attempts when messaging is restricted.
3. **Phase 3: Chronicle Courier and Raspberry Pi archive.** Export SavedVariables safely out of game, ingest into the Pi service, deduplicate, and generate the first monthly guild letter.
4. **Phase 4: live guild map and professions.** Share opt-in presence/location snapshots and profession/recipe coverage without continuous tracking.
5. **Phase 5: dungeon and raid readiness.** Evaluate explicit, versioned requirements such as level, quest completion, attunements, professions, and selected preparation data. Report unknown data as unknown, not failed.

## 11. Reference-addon research

References explicitly selected by the user include:

- Deathlog;
- Completetao/Complete-style completion tracking — exact addon title and URL still need to be normalised;
- Forever Chronicle;
- Guild OS;
- Memento (the user initially wrote “Momento”);
- Guild Found Forever;
- Legacy Forever.

The user also selected numbered entries `6–10`, `12`, `15`, `16`, `17`, and `18–25` from an earlier research list. That number-to-addon mapping is not currently preserved in the repository, so a new agent must recover it from the original conversation or ask the user rather than guessing.

Research lessons already adopted:

- Deathlog: durable death records, deduplication, and peer-exchange concepts.
- Forever Chronicle: personal diary/event categories and map-linked memories.
- Guild Found Forever: Forever-specific guild positions, professions, recipes, and addon-message concepts; its own stated simulated coverage is not live proof.
- Modern installed addons: `IconTexture`, Addon Compartment functions, Blizzard Settings registration, and minimap-launcher conventions.

Do not copy reference code until its licence has been checked. “Steal” means learn from patterns and reuse only what the licence actually permits.

## 12. Known risks and traps

- A page, UI, or addon loading is not end-to-end proof. Verify the stored data and the user-visible result.
- Retail addon-message restrictions are realm-controlled. Respect the result; do not attempt a workaround.
- `SKILL_LINES_CHANGED` can be extremely noisy. Snapshot comparison and semantic deduplication are required.
- `GetProfessions()` includes secondary professions in later return positions; preserve nil-separated return values.
- Event registration may occur before SavedVariables are available. Do not reintroduce the earlier loaded-marker bug.
- Never edit SavedVariables while WoW is running. Back up first and read back afterwards.
- Do not bundle GPL or All Rights Reserved source into this addon without a compatible legal basis.
- The repository is currently on a detached `HEAD`. Check status and choose an appropriate `codex/` branch before starting substantial new implementation.
- Preserve unrelated existing work in this shared checkout.

## 13. How to keep this handoff current

Whenever work changes the project, update the relevant sections above in the same change. At minimum:

- change the date and addon version;
- record what was implemented;
- record exact test totals and live-test results;
- move resolved items out of “unverified” or “product gap”;
- record new decisions and compatibility findings;
- update release path and SHA-256 after packaging;
- leave one unambiguous next action below.

Do not write “complete” unless both automated verification and the required live acceptance actually passed.

## 14. Current next action

0. alpha19 is installed on BOTH clients and packaged (SHA-256 in the alpha19 block of section 9). The alpha10 instructions below still apply. If any later change is made, run `scripts/publish-build.ps1` again from the PowerShell tool.
1. **Next action (user):** log in on the WoW Forever client with alpha10 and (a) type `/mam diag`, click Copy diagnostics and send the pasted report (look at `Handler errors:`, `Medals:`, `Camp spells seen:`, `Statistics:` and `scan N ms`); (b) open the Medals tab, try the filters and search, hover a few medals and send a screenshot; (c) do the campfire test: complete The Great Outdoors, craft and light a campfire, place a camp object, then send `/mam diag` again. Continue with the alpha9 confirmations below. Confirm live: The Great Outdoors gives Happy Camper; lighting a campfire and placing an object moves Firestarter / Camp Decorator; entering the new dungeons, raids, Darkspear Islands and new zones moves their medals; Plot Twist for a new race-class combo; which statistic-based medals appear.
2. Fix whatever the live check disproves (exact spell names, instance names, quest name, Statistics availability on Forever).
3. User decides: the licence text, CurseForge project name/category, and then uploads `docs/release/curseforge` material with the ZIP following `UPLOAD-CHECKLIST.md`.
4. Two-player guild test for sharing is still REQUIRED before guild-wide medals or the Pi export.

## 15. Recent history

- alpha11: `1e6a54d`, `ab66cb5`, `97a6781`. alpha10 tester polish: commits `c601585` .. `3b2dd80` (see section 9).
- `0b1263e` — added the Chronicles user manual.
- `d90f2b9` — verified journal retention across sessions in automated coverage.
- `7575439` — restored the persisted loot-threshold label.
- `fc2d8dc` — extended live tester acceptance checks.
- `d548d8c` — isolated character history and hardened tester UI.
- `40d522c` — supported Retail quest-acceptance events.
- `18122bf` — completed Phase 1 acceptance coverage.
- `5071a8a` — hardened full tester-build runtime coverage.
