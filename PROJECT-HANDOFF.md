# Moms Against Magic Chronicles — Project Handoff

**Last updated:** 30 September 2026  
**Current addon version:** `0.2.0-alpha2`  
**Current status:** In progress. Proper-addon polish All 7 tasks are complete in automated testing (Chronicles 98/98); live acceptance pending. Live acceptance of the production addon is still required.
**Authoritative checkout:** `C:\Users\44750\.codex\worktrees\mam-chronicles-phase0\WoW`

This is the first file a new agent should read. Keep it current whenever the version, design, verification status, release location, major decision, or next action changes.

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
- Guild sharing must be opt-in, visible, rate-limited, and resilient when addon messages are restricted.
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

Live acceptance of alpha2 on Retail (needs the user): fully exit WoW, run `scripts/install-mam-chronicles.ps1` against the `_retail_` client, read back the installed manifest and file hashes, then work through the "Launcher, window, and settings (alpha2)" section and the rest of `docs/testing/mam-chronicles-phase1-tester-checklist.md`, recording PASS/FAIL/NOT TESTED honestly. Do not start Phase 2 (guild sync) until live Phase 1 acceptance is recorded or the user decides otherwise. Remaining decision for the user: whether to swap the private-testing `LICENSE.txt` for an open-source licence.

## 15. Recent history

- `0b1263e` — added the Chronicles user manual.
- `d90f2b9` — verified journal retention across sessions in automated coverage.
- `7575439` — restored the persisted loot-threshold label.
- `fc2d8dc` — extended live tester acceptance checks.
- `d548d8c` — isolated character history and hardened tester UI.
- `40d522c` — supported Retail quest-acceptance events.
- `18122bf` — completed Phase 1 acceptance coverage.
- `5071a8a` — hardened full tester-build runtime coverage.
