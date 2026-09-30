# Moms Against Magic Chronicles Phase 1 Tester Checklist

Tester: __________  Date: __________  Client/build: __________

Use `PASS`, `FAIL`, or `NOT TESTED`. If anything fails, copy `/mam diag` and describe exactly what you did.

## Install and persistence

- [ ] Addon installs with no extra files and appears on character select.
- [ ] `/mam` opens one reusable window without a Lua error.
- [ ] The Chronicle window moves and resizes from its bottom-right handle.
- [ ] A `/mam remember test` entry survives `/reload`.
- [ ] The same entry survives fully exiting and restarting WoW.

## Capture

- [ ] Login/session appears.
- [ ] Level-up appears (only if naturally available).
- [ ] Death appears without claiming an unproven killer.
- [ ] Resurrection/return appears.
- [ ] Quest accepted appears when enabled.
- [ ] Quest completion has the correct quest ID/name when available.
- [ ] Changing zone records one entry rather than a flood.
- [ ] Dungeon/raid entry and exit appear.
- [ ] Epic or Legendary self-loot appears; lower quality does not.
- [ ] A profession skill change appears.
- [ ] If testing two characters, their quest completions and profession snapshots remain separate.
- [ ] `/mam remember <text>` creates a pinned memory.

## Browse and report

- [ ] Search finds quest, item, zone, type, and memory text.
- [ ] Deaths, Quests, World, Instances, Loot, and Memories filters work.
- [ ] Statistics clearly state their window and source-event coverage.
- [ ] `/mam export` is copyable and contains no chat, BattleTag, or account path.
- [ ] Export text can be selected without timeline rows intercepting the mouse.
- [ ] Coordinates disappear from export when coordinate recording is disabled.
- [ ] `/mam diag` is copyable and omits the character name.

## Launcher, window, and settings (alpha2)

- [ ] The AddOns list shows the Moms Against Magic icon.
- [ ] Minimap button: left-click toggles the Chronicle, right-click opens settings, dragging moves it and the position survives `/reload`.
- [ ] Hiding the minimap button leaves `/mam` and the Addon Compartment entry working; Show minimap button / Reset Minimap Button brings it back.
- [ ] Settings > AddOns lists the addon and its controls match the in-window Settings tab.
- [ ] Window position, size, and active tab survive `/reload` and a full restart; Reset Window recentres it.
- [ ] Escape closes the window; it opens normally afterwards.
- [ ] Filter and Range menus choose the exact option clicked; the active tab is highlighted; tooltips appear.
- [ ] Mouse wheel, scrollbar, and Previous/Next agree and stop at the ends.
- [ ] Erase Chronicle Data asks for confirmation, clearing keeps settings, and cancelling deletes nothing.
- [ ] First-run welcome prints once and not again after `/reload`.
- [ ] Checked at two UI scales and at the minimum window size (layout readable, no overlap).
- [ ] Note any optional API that was missing (Addon Compartment, Settings panel, popup): __________

## Achievement statistics (alpha3)

- [ ] Wait about ten seconds after login, open `/mam`, Statistics tab: a "Lifetime statistics" section lists groups with counts.
- [ ] `/mam diag` shows `Statistics: ok, N read, M unreadable`. Record N and M: __________
- [ ] Note any group that looks wrong or sits in "Other": __________
- [ ] Die or complete a quest, `/reload`, wait ten seconds: a "+1 ..." change appears.
- [ ] No visible hitch when the scan runs (about ten seconds after login). Note any freeze: __________
- [ ] Gold statistics are absent by default; turning on "Include gold statistics" and waiting for the next scan (or `/reload`) adds a Gold and money group; turning it off removes it.
- [ ] Note the size of `WTF\Account\<account>\SavedVariables\MAMChronicles.lua` before and after: __________
- [ ] Switching "Collect achievement statistics" off stops new readings.

## Stability

- [ ] No Lua errors during the test.
- [ ] No visible FPS hitch on zone changes or profession updates.
- [ ] Note addon memory before/after a normal session: __________

## Client status

- Retail 12.1: test now.
- WoW Forever beta: **PENDING** until beta access returns. Retail results do not prove Forever behaviour.

Failure notes: ________________________________________________
