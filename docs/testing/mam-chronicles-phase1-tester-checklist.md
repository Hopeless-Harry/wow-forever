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

## New look (alpha4)

- [ ] Window has a flat dark style with the icon and gold title; tabs show an accent underline on the active tab.
- [ ] Timeline rows show a coloured stripe, a time column, and a coloured type label (Death red, Quest gold, Discovery green, Entered/Left blue, Loot purple, Memory teal); hovering a row highlights it and clicking shows details on the right.
- [ ] Enlarging the window makes rows taller (up to 20px); shrinking to the minimum keeps everything readable and inside the window.
- [ ] Every button highlights on hover, including ones with tooltips, and tooltips still appear.
- [ ] Settings tab: checkboxes have a clear checked state, the gold statistics caption fits at minimum width, Erase shows in red.
- [ ] Statistics tab: headings are gold, changes are green, headline values are readable.
- [ ] Note anything that looks misaligned, clipped, too dark, too small, or ugly (screenshot please): __________

## Home and scrolling (alpha5)

- [ ] Home opens by default and shows tiles, This month, Recent activity and the remember box.
- [ ] Enlarging the window widens the cards; shrinking below about 700 wide stacks them in one column without overlap.
- [ ] Tiles show real numbers (or a dash) and "+N this month" after a change.
- [ ] Typing in the remember box and pressing Enter adds a pinned memory and it appears in Recent activity.
- [ ] Statistics text no longer runs outside the window; scrolling works with wheel and scrollbar; resizing re-wraps the text.
- [ ] Diagnostics text scrolls when long.
- [ ] Nothing behind the window shows through its background.
- [ ] Note anything misaligned or unclear (screenshot please): __________

## Settings, medals, toasts and guild sharing (alpha6)

- [ ] Settings is a scrolling page with Appearance, Alerts, Recording, Statistics, Data, Window and Danger zone sections.
- [ ] Window transparency slider changes the background immediately; 0% is fully solid.
- [ ] Each theme button saves; Apply theme reloads the UI with that theme (check all four are readable, especially Parchment).
- [ ] Medals tab: medals listed, earned first, progress bars for the rest, Mom Money total at the top.
- [ ] First run shows one welcome summary of medals counted from history (not a toast per medal) and the welcome message mentions guild announcements and where to opt out.
- [ ] Earning a new medal shows a toast, adds a Medal entry to the Chronicle, and appears on Home.
- [ ] Level up shows a toast. In combat toasts are held and appear after combat ends.
- [ ] Bracketed statistic labels show, for example "(Humanoid)" next to Creature type killed the most.
- [ ] `/mam diag` shows a `Guild sharing:` line. Record the state: __________
- [ ] **Needs two players in the same guild running alpha6:** one earns or is granted a medal; the other sees a toast and a Guildmates line. Record PASS/FAIL and what the diag line said on both: __________
- [ ] If the realm restricts addon messages the diag line says `restricted` and nothing errors.
- [ ] Turning off "Announce my Mom Medals" stops sending; turning off "Show toasts when guildmates earn medals" stops receiving.

## Silly medals and test toast (alpha7)

- [ ] Settings > Alerts > **Send a test toast** (and `/mam toast`) shows an info toast, then a medal toast, then a guildmate toast on repeated clicks.
- [ ] Drink a wine (or any item with "wine" in its name), then check the Medals tab for **Wine O'Clock I**. Repeat with an ale, a coffee or tea, some food, and a bandage. Note any that did not count: __________
- [ ] Mashing a consumable's key while it is on cooldown does not add counts.
- [ ] Jumping, mounting up, going AFK, entering an inn or city, and taking a screenshot each move their medal progress.
- [ ] Social medals (Hugs and Kisses, Friendly Neighbourhood Mom, Kitchen Dance Party) show progress that matches your Statistics tab; note any that never appear: __________
- [ ] `/mam` now reopens on the tab you used last (Home by default), not always Chronicle.

## New medals and Forever (alpha8)

- [ ] `/mam diag` shows `Medals: client ..., level cap ..., race ..., hooks ...`. Record it for each client: __________
- [ ] The hooks list includes `PerformEmote` or `DoEmote`. Type `/sit`, `/dance`, `/hug` (with a target if needed) and check the emote medals move. If not, note which: __________
- [ ] Fall from a height and die: the Chronicle death entry is followed by a Gravity's Favourite medal.
- [ ] Join and leave a group, accept a ready check, swap gear, open a vendor and sell or buy something: the matching medal progress moves.
- [ ] Log out and in again quickly, and stay logged in a long time: Just Five More Minutes and Marathon Mom progress.
- [ ] **Forever:** the Medals tab shows The Journey Matters and Ready for the Core, hides level 80 and 90 medals, and shows Skyborne Landing. Record the race shown in diag: __________
- [ ] **Retail:** the Forever-only medals are not shown.
- [ ] Nothing earned before alpha8 disappeared, and Mom Money total looks sensible.

## Stability

- [ ] No Lua errors during the test.
- [ ] No visible FPS hitch on zone changes or profession updates.
- [ ] Note addon memory before/after a normal session: __________

## Client status

- Retail 12.1: test now.
- WoW Forever beta: **PENDING** until beta access returns. Retail results do not prove Forever behaviour.

Failure notes: ________________________________________________
