# Changelog

## 0.2.0-alpha19

- **Animations:** the window and each page fade in softly, medal progress bars grow out from the left when you open the Medals tab or change a filter, medal and guildmate toasts shimmer and pop their icon, toasts ease in and drift out, and the minimap button glows gently while something new is waiting (a toast appeared while the window was closed) until you open the window. They use the game's own animation system, so they cost nothing per frame, and **Settings > Appearance > Animations** turns them all off.
- Medal rows light up when you hover them, and the window has a slim accent line along the top.

## 0.2.0-alpha18

- **Weekly Mom Quests:** three small tasks a week (adventure, Mom life and a stretch goal) that pay extra Mom Money, plus a bonus for finishing all three. Week one counts from the WoW Forever launch (4 November 2026) and is gentle: a few quests, a few meals, a level 10 goal. Difficulty ramps up every two weeks to about week twelve (level goals follow the usual Forever pace and never pass 60). Every guildmate on the same version gets the same quests without any messages. They show on Home and with `/mam quests`.
- **Holiday medals:** Brewfest, Hallow's End, Winter Veil, Lunar Festival, Love Is in the Air and Midsummer each have a "log in on days" series and a themed activity series that only counts while the holiday runs, plus a toast when a holiday starts. Holiday dates are approximate and may differ on Forever. New Holidays category.
- **Characters tab:** all your characters on the account with level, class, title, medals, Mom Money, professions and when you last played. Local only.
- **Memory Book:** `/mam book` or the Memory Book button on Home: your firsts (quest, death, dungeon, loot, medal), level milestones, best medals, pinned memories and close calls.
- **Quiet mode:** toasts are held in dungeons, raids, scenarios and battlegrounds and shown when you are back in the open world (Settings > Alerts, on by default).
- Mom Money now includes quest rewards; the Medals tab shows what you have earned and what is left.

## 0.2.0-alpha17

- **Medal categories:** every medal is now in one of Progress, Kitchen & Bar, Mom Habits, Emotes, Play Pattern or WoW Forever. A **Category** button on the Medals tab cycles through them and works together with the filters, Next up and search. Empty categories (for example WoW Forever on Retail) are skipped.
- **A title for every medal family:** all 96 families now have their own Mom title (Stare Mom, Facepalm Mom, Camp Decorator Mom and so on). The Medals tab shows how many titles you have earned.
- **New title toast:** the first medal you earn in a family unlocks its title and shows a "New title" toast. Titles from your starting history are not announced.

## 0.2.0-alpha16

- The Medals tab now opens on **Next up** (one medal per family, the next tier to aim for). Click All to see every medal.

## 0.2.0-alpha15

- **Next up** filter on the Medals tab: one medal per family, the next tier to aim for, so the long list becomes short. The filter buttons now sit on their own row.
- **Mom titles:** you get a title from the medal family you have earned the most Mom Money in (Wine Mom, Trampoline Mom, Night Owl Mom and more), shown on Home, the Medals tab and recaps. Settings has a button to pick any title you have earned.
- **Mom Money shop** (Settings): spend Mom Money on toast colours (Rose, Teal, Violet, Sunset) and title flourishes (the Great, Supreme, of Legend). Purely cosmetic and local; nothing is sent to the guild. Your Mom Money total shows what is left and what you earned.
- **Hall of Shame and Fame** on the Statistics tab: most dangerous place, worst day, falls, busiest day, longest session, time played, favourite place and highest level, worked out from your recorded events.
- **Last session** line on Home: levels, quests, discoveries, deaths and medals from your previous session and how long ago it was.
- **Weekly recap:** `/mam recap week` for the last seven days. Recaps now include your title.

## 0.2.0-alpha14

- **Toast sound choices:** nine stock game sounds (Chime, Quest complete, Fanfare, Loot toast, Ready check, Raid warning, Map ping, Whisper, Coins). Settings > Alerts > "Toast sound" plays each one as you click through and keeps your choice. Sounds still only play when "Play a sound with toasts" is ticked.
- The statistics scan now waits 0.05 seconds between slices, so its roughly 3 seconds of total work is spread thinly instead of adding a few milliseconds to every frame.

## 0.2.0-alpha13

Fixes from the first live Retail screenshots of alpha12.

- The statistics scan is now split after every single statistic. It took 2.7 seconds for 441 statistics on Retail, and the previous split only paused between categories, so one large category could still cause a hitch.
- Chronicle and Home rows show readable text: "Logged in", "Logged out after 1h 1m", "Reached level N" and medal names with their Mom Money, instead of raw event names.
- The Statistics tab shows the reporting window as dates instead of raw numbers.
- Statistics that only mention "gold" in their name (for example Gold Challenge ratings) are no longer treated as money.

## 0.2.0-alpha12

- A pinned medal goal now shows one "Nearly there" toast when you reach 90 percent of its target (targets of 5 or more). It follows your toast settings and waits for combat to end.

## 0.2.0-alpha11

- **Monthly recap:** `/mam recap` or the Copy recap button on Home gives a short, shareable summary of the month (sessions, deaths, quests, medals earned with their Mom Money, top statistic changes). It never includes your character name, realm or gold.
- **Medal goals:** click an unearned medal on the Medals tab to pin it as a goal (up to three). Goals and their progress show on Home. A pinned medal drops off the list when you earn it.
- **Safer saved data:** one damaged event no longer erases your history. Valid events are kept, the broken ones are dropped, and `/mam diag` shows a `Recovery:` line saying how many.
- **Guild sharing versions:** medals sent by a newer or older build are counted quietly as "unknown" or "other version" in `/mam diag` instead of being treated as dropped or forged messages.

## 0.2.0-alpha10

- Getting started card on Home for new testers (dismissible and remembered) and a "What's new" line after an update. The chat welcome is one short line.
- Diagnostics tab has a **Copy diagnostics** button and a note on what to paste back. The report now includes the level cap, SavedVariables counts (events, medals, guild feed entries) and a handler error count with the last short message.
- Medals tab: All / Earned / In progress / Locked filters, a search box, a tooltip on every medal saying how it is tracked and how far along you are, a NEW marker for medals earned this session, and rows created only for what is on screen.
- Forever-first: Home shows Campfires lit instead of the Retail-only Delves tile, the guild sharing line shows its real state, and empty statistics explain which medals still work.
- Stability: every growing table is bounded (sessions, duplicate filter, counters); the statistics scan is split across frames on slow machines and reports its cost in `/mam diag`; a failure in one handler no longer affects the others and is counted.
- Combat safety: the window, minimap button and layout changes wait until combat ends. Counters stop while recording is switched off.
- Item lookups use the modern `C_Item` API where it exists.
- Parchment theme: readable labels, event colours and medal tiers.
- New commands `/mam medals` and `/mam settings`; `/mam help` lists every command. The window never starts larger than the screen.

## 0.2.0-alpha9

- Reviewed every medal for WoW Forever. Retail-only medals (Delver, Treasure Hunter Mom, Pet Playdate, Achiever, level 80 and 90) are hidden on Forever. Medals that depend on a game statistic only appear when the client reports that statistic. Level medals stop at Forever's level 60 cap.
- New WoW Forever medals: camping (Happy Camper, Firestarter, Journeyman Camper, Expert Camper, Camp Decorator, Well Stocked Camp, Campfire Chef), new content (Unexplored Depths, Summit Seeker, Into the Barrow, Islander, New Horizons) and Plot Twist for the new race and class combinations.
- `/mam diag` lists camp-related spell names the client reports so campfire detection can be verified.
- Package is ready for CurseForge: licence, changelog and description added.

## 0.2.0-alpha8

- 235 Mom Medals, including the WoW Forever set (The Journey Matters, Ready for the Core, Beta Testing Mom, Day One Mom, One Year Later, Skyborne Landing).
- Emote, vendor, group, ready-check and equipment counters. Fall deaths are detected. Session length is recorded. Medal progress is stored permanently.

## 0.2.0-alpha7

- Mom-themed medals and activity counters. Send a test toast from Settings or `/mam toast`.

## 0.2.0-alpha6

- Mom Medals and Mom Money, combat-safe toast alerts, opt-out guild announcements of new medals, themes and window transparency, organised Settings.

## 0.2.0-alpha5

- Home dashboard, scrolling text areas, opaque window background.

## 0.2.0-alpha4

- Flat themed window, colour-coded timeline, tooltips.

## 0.2.0-alpha3

- Achievement statistics baseline and monthly changes (gold statistics off by default).

## 0.2.0-alpha2

- Minimap button, Addon Compartment, Blizzard Settings page, remembered window, erase confirmation.

## 0.2.0-alpha1

- Personal Chronicle: sessions, levels, deaths, quests, zones, instances, loot, professions, achievements and memories.
