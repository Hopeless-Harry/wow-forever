# Moms Against Magic Chronicles

A private, persistent diary of your adventures, plus **Mom Medals**: silly and serious guild achievements that earn you Mom Money. Built for the guild Moms Against Magic and made to work on **WoW Forever** and Retail.

**Status: alpha.** It loads and runs on both clients, but some features still need confirmation in the live game. See "Known limits".

## What you get

- **Home** dashboard: a Getting started card for new installs, your headline numbers, this month at a glance, recent activity, and a "Remember this moment" box.
- **Chronicle** timeline of levels, deaths, quests, discoveries, dungeons, loot, professions and memories. Search and filter it.
- **Medals**: about 260 Mom Medals across serious goals (quests, dungeons, levels) and Mom-themed fun (Wine O'Clock, Trampoline Mom, Mom Stare, Up Past Bedtime, Clean Plate Club and many more). Each is worth 10 to 100 Mom Money. Filter by Earned, In progress or Locked, search by name, and hover a medal to see how it is tracked.
- **WoW Forever medals**: The Journey Matters, Ready for the Core, campfire and camping medals (Firestarter, Camp Decorator, Campfire Chef), Unexplored Depths for the new dungeons, Summit Seeker and Into the Barrow for the new raids, Islander for the Darkspear Islands battleground, New Horizons for the new zones, Plot Twist, Skyborne Landing, and launch-day medals.
- **Monthly recap** (`/mam recap`): a short, shareable summary of your month with no name or gold.
- **Medal goals**: pin up to three medals and follow their progress on Home.
- **Statistics**: your lifetime game statistics with a baseline and monthly changes, where the client provides them.
- **Toasts**: slide-in alerts for new medals and level-ups. On by default, never shown in combat (they wait until combat ends).
- **Guild sharing**: when you earn a medal, guildmates running the addon see a toast. It is on by default and easy to switch off.
- **Themes and transparency**: Midnight, Parchment, Crimson and Slate, and a window transparency slider.
- Minimap button, Addon Compartment entry, and a page in the game's Settings.

## Privacy

- Your history stays on your computer.
- The only thing sent to your guild is the id, points and version of a medal you just earned. Nothing else: no chat, no location, no gold, no history, no statistics.
- No chat, whispers, mail, trades, BattleTags or account paths are collected.
- Gold statistics are off by default and never shared.
- You can turn guild announcements off in Settings > Alerts, and erase your Chronicle from Settings > Danger zone.
- Activity counters (for example wine drunk) store only whole numbers, never item names.

## Commands

- `/mam` opens the window on the tab you used last.
- `/mam remember your text` pins a memory.
- `/mam stats`, `/mam medals`, `/mam settings`, `/mam recap`, `/mam export`, `/mam diag` (diagnostics with a Copy button), `/mam toast` (sends a test toast), `/mam help`.

## Compatibility

- Retail (interface 120100 and 120105) and WoW Forever (interface 16001).
- No libraries or other addons required.
- Level medals respect each client's level cap (60 on Forever). Retail-only medals are hidden on Forever, and medals that need a game statistic only appear when the client reports it.

## Known limits

- Alpha software: back up your WTF folder before installing.
- The window, minimap button and layout changes wait until combat ends.
- Guild sharing has not yet been tested between many real players. On realms that restrict addon messages it stops quietly.
- Campfire and camp-object medals are detected by spell name from public beta information. `/mam diag` lists the camp spell names your client reports so we can fix any mismatch.
- Emote, consumable, vendor, group and ready-check medals rely on game hooks that still need live confirmation.
- English keywords are used to recognise consumables.

## Feedback

Please include the output of `/mam diag` when reporting a problem: open the Diagnostics tab, click **Copy diagnostics**, press Ctrl+C and paste it. It contains no character name, chat or personal data.
