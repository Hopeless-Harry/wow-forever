# Prompt: final quality-of-life and polish pass for the WoW Forever tester build

Paste everything below the line into a new agent session opened in `C:\Users\44750\.codex\worktrees\mam-chronicles-phase0\WoW`.

---

You are finishing the **Moms Against Magic Chronicles** WoW addon for a first group of testers on **WoW Forever** (client interface 16001, level cap 60). Retail is a secondary test client. Your job is a careful quality-of-life, robustness and polish pass. Do **not** start new big systems.

## Read first, in this order

1. `PROJECT-HANDOFF.md` completely. It is the authoritative status file. Keep it updated as you work (after every checkpoint: what changed, exact commits, test totals, decisions, next action).
2. `docs/research/2026-09-30-medal-feasibility.md` (what is verified and what still needs a live check).
3. `docs/manuals/mam-chronicles-user-manual.md` and `docs/testing/mam-chronicles-phase1-tester-checklist.md`.
4. The source under `addons/MAMChronicles/` and the tests under `tools/mam-chronicles/test/` for whatever you touch.

## Standing rules (from the user)

- **After every change, update the user's installed build on BOTH clients and the CurseForge package** by running `pwsh -NoProfile -File scripts/publish-build.ps1` from the repository root. If a game process is running the script skips that client; ask the user to close WoW and run it again. Bump the version for feature changes, keep `addons/MAMChronicles/CHANGELOG.md` current, and record the new SHA-256 in the handoff.
- Follow test-driven development: write the failing test, watch it fail for the right reason, implement, watch it pass. Commit each completed task. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Do not discard, reset or rewrite existing work. The checkout is a detached HEAD in a managed worktree.
- Do **not** upload to CurseForge, and do not change `LICENSE.txt` (the user still has to confirm the licence).
- Do not implement guild-wide medals, the Raspberry Pi export, or the Characters roster tab. Those come after cross-player guild sharing is proven.
- Privacy first: never collect chat, whispers, BattleTags, account paths, gold by default, or item names. Guild sharing sends only medal id, points and version.
- Be honest about evidence: separate automated tests from live in-game proof. Never call something verified that only has a stubbed test.

## WoW addon rules to audit against

- No deprecated APIs where a namespaced replacement exists (for example `C_Spell`, `C_Item`, `C_Container`, `C_ChatInfo`). Keep capability checks so Retail and Forever both work.
- Combat safety: avoid frame creation and layout recalculation in combat. Guard UI creation and updates with `InCombatLockdown()`; queue work and run it on `PLAYER_REGEN_ENABLED`. Do not hook or modify secure buttons.
- Register events only when needed; unregister or short-circuit handlers that are not needed while hidden. Nothing should run per frame except the small fall-detection ticker and the toast animation while a toast is showing.
- Cache frequently called Blizzard APIs in local references at the top of a file where it helps; prefix private functions with an underscore where the file style allows (match the surrounding code, do not churn working code).
- Wrap handlers so one failure never breaks the addon, and make failures visible in `/mam diag` (a count and the last short message, no personal data).

## Scope: what to do

Work through these in priority order, with a test for each behaviour change. Cut anything that turns out large or risky and record it in the handoff instead.

1. **First-run experience for testers.** A short "Getting started" card on Home for the first launches (what `/mam` does, where Medals and Settings are, what is shared with the guild and how to opt out), dismissible and remembered. A "What's new" line after an update. Keep the chat welcome message short.
2. **Report-a-problem flow.** A **Copy diagnostics** button on the Diagnostics tab and a clear note telling testers what to paste back. Add to the diagnostics report: addon version, client build and interface, level cap, SavedVariables counts (events, medals, feed entries), handler error count with the last short message, and the existing Medals and Guild sharing lines.
3. **Medals tab usability.** Filter buttons (All, Earned, In progress, Locked), a search box, a tooltip on each medal with how it is tracked and its progress, a "New" marker for medals earned this session, and lazy row creation so opening the tab with about 260 medals does not hitch. Hide medals the client cannot support (already implemented) and make sure the counts and Mom Money totals stay consistent.
4. **Forever-first defaults and text.** Make sure nothing shows Retail-only wording or medals on Forever, level 60 is treated as the cap everywhere, and empty states explain themselves when the client reports no statistics.
5. **Robustness.** Verify behaviour with missing optional APIs (Settings, Addon Compartment, C_Timer, C_Spell, hooks that do not exist), a corrupt or old SavedVariables file, and a very large history. Bound every growing table (guild feed, counters, camp spell names, tallies). Measure the cost of the 8-second statistics scan and split it across frames if it is large.
6. **Combat safety audit** against the rules above, fixing anything that creates frames or re-lays out UI during combat.
7. **Polish.** Window minimum size and scaling at common UI scales, long text clipping, tooltip wording, consistent colours across all four themes (check Parchment contrast), Escape closes the window, and the Settings page keeps scroll position. Fix typos and unclear copy in the UI and docs. Update `/mam help` so it lists every command.
8. **Docs and package.** Update the manual, tester checklist, `SEND-TO-TESTERS.template.txt`, the CurseForge description and changelog to match what you changed. Regenerate `docs/manuals/mom-medals-catalogue.md` if medals changed.

## Things you must not assume

- The guild-sharing path has never run between two real players. Do not claim it works.
- Campfire, emote, consumable, vendor, group, ready-check and fall-death detection are untested in the live game. Keep the `/mam diag` evidence lines and make them easy to read.
- Forever's Statistics availability is unknown; statistic-based medals must continue to appear only when the client reports the statistic.

## Definition of done

- All suites green (`npm test --prefix tools/mam-chronicles`, `tools/mam-chronicles-diagnostics`, `guild-dashboard`) and `git diff --check` silent.
- `scripts/publish-build.ps1` run successfully with both clients installed (or the skipped client clearly reported).
- `PROJECT-HANDOFF.md` updated with: exact commits, test totals, the new version and SHA-256, every decision, what is still unverified live, and one unambiguous next action.
- A final message to the user that lists what changed, what was cut and why, and exactly what they should test on WoW Forever next (send `/mam diag`, the Medals tab, and a campfire test).
