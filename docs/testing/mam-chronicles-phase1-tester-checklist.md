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

## WoW Forever review and camping (alpha9)

- [ ] On Forever the Medals tab does not show Delver, Treasure Hunter Mom, Pet Playdate, Achiever, or level 80 and 90 medals.
- [ ] Statistic-based medals (Slayer, Frequent Flyer, Home Is Where the Heart Is and so on) appear on Forever only if the Statistics tab shows the matching statistic. Record which appear: __________
- [ ] Complete The Great Outdoors (around level 5): Happy Camper is earned.
- [ ] Craft and light a campfire, then place a profession object: Firestarter and Camp Decorator progress. `/mam diag` shows `Camp spells seen:`. Record the exact names shown: __________
- [ ] Enter one of the new dungeons (for example Hall of Thanes), Hyjal Summit, The Barrow Deeps or the Darkspear Islands: the matching medal progresses. Note the exact instance names the client uses: __________
- [ ] Discover an area in a new zone (Mount Hyjal, Riverglades, Shen'dralas, Zephras Isle): New Horizons progresses.
- [ ] Play an Orc Mage, Human Hunter, Gnome Priest, Dwarf Shaman, Troll Warlock or Undead Paladin: Plot Twist is earned.

## Tester polish (alpha10)

- [ ] First launch: Home shows the Getting started card; Got it hides it and it stays hidden after `/reload`.
- [ ] After updating from alpha9 a "What's new" line appears on Home and its x button dismisses it.
- [ ] The chat welcome is a single short line.
- [ ] `/mam diag`: click Copy diagnostics, press Ctrl+C, paste into a text editor. The report shows `Level cap: 60` on Forever, `SavedVariables: events N, medals N, feed N`, `Handler errors: 0` and the `Medals:` and `Guild sharing:` lines. Record any handler error text: __________
- [ ] Medals tab: the four filter buttons change the list and their counts add up; searching `wine` shows the wine medals; hovering a medal shows how it is tracked and your progress; a medal earned now shows NEW.
- [ ] Opening the Medals tab and scrolling the whole list has no hitch or freeze.
- [ ] On Forever: Home shows Campfires lit (no Delves tile) and no Retail-only medals appear. If Statistics are missing the Statistics tab says so and explains which medals still work.
- [ ] Type `/mam` during combat: nothing opens until combat ends, then the window appears.
- [ ] `/mam help` lists every command; `/mam medals` and `/mam settings` open those tabs.
- [ ] Try the Parchment theme (Settings, Apply theme): all text, event labels and medal points are readable.
- [ ] Shrink and enlarge the window and use Escape: it closes. The Settings page keeps its scroll position when you switch tabs.
- [ ] `/mam diag` shows `Statistics: ok, ... scan N ms`. Record the ms: __________

## Recap, goals and safer data (alpha11)

- [ ] `/mam recap` shows a short summary of the month with no character name, realm or gold. Home has a Copy recap button that shows the same text.
- [ ] Click an unearned medal on the Medals tab: it shows GOAL and appears on Home with its progress. Click again to unpin. A fourth pin says you can pin 3 goals.
- [ ] Earn a pinned medal: it leaves the goals list. Pin a medal with a target of 5 or more and get it to 90 percent: one "Nearly there" toast appears, only once.
- [ ] Two players in one guild: earn a medal on one, confirm the other sees a toast. Then check `/mam diag` on both for `Guild sharing: ... unknown N, other version N`. Record: __________

## Toast sounds (alpha14)

- [ ] Settings > Alerts: click Toast sound repeatedly; each click plays a different sound and the label changes. Note any that are silent on your client: __________
- [ ] Tick Play a sound with toasts, pick Quest complete, then /mam toast: the chosen sound plays with the toast.

## Titles, shop, halls and recaps (alpha15)

- [ ] Medals tab: the Next up button shows one medal per family and its count is sensible. All five filter buttons fit in the window at its smallest size.
- [ ] Home shows your Mom title after your zone. Settings > Mom Money shop: the Title button cycles through titles you have earned.
- [ ] With enough Mom Money, buy a toast colour: it equips, your total on the Medals tab shows the spending, and a toast (`/mam toast`) uses the colour. Buying twice does not charge twice.
- [ ] Statistics tab shows Hall of Shame and Hall of Fame with believable numbers for your character.
- [ ] After a previous session with activity, Home shows a Last session line; logging straight back in within five minutes does not.
- [ ] `/mam recap week` shows a weekly summary with your title and no character name.

## Categories and titles (alpha17)

- [ ] Medals tab: the Category button cycles through the categories; the list, the filter counts and the search all respect it. WoW Forever appears only on Forever.
- [ ] The line under Mom Money shows a title count such as `3 of 90 titles`.
- [ ] Earn the first medal of a new family (for example your first wine): a "New title" toast appears once. Later medals of that family do not repeat it.

## Quests, holidays, characters, book and quiet mode (alpha18)

- [ ] Home shows "Week N Mom Quests" with three lines and progress; `/mam quests` prints the same. Complete one (for example eat the requested meals): a "Mom Quest done" toast appears and your Mom Money rises once.
- [ ] The three quests look doable for where your character is. Note any that are too hard or impossible: __________
- [ ] During a holiday window (or by changing the date) a "<holiday> is on!" toast appears once and Holidays medals show progress.
- [ ] Characters tab lists your alts with level, class and title; a character you have never logged in on after updating is missing until you log in on it.
- [ ] `/mam book` and the Memory Book button open a readable book with your firsts and memories.
- [ ] Zone into a dungeon and earn something (or use `/mam toast`): no toast shows until you leave; with the setting off it shows at once.
- [ ] All seven tabs fit in the window at its smallest size.

## Stability

- [ ] No Lua errors during the test.
- [ ] No visible FPS hitch on zone changes or profession updates.
- [ ] Note addon memory before/after a normal session: __________

## Client status

- Retail 12.1: test now.
- WoW Forever beta: **PENDING** until beta access returns. Retail results do not prove Forever behaviour.

Failure notes: ________________________________________________
