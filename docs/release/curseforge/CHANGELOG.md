# Changelog

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
