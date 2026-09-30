# Changelog

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
