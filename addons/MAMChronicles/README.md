# Moms Against Magic Chronicles

Version `0.2.0-alpha25` is the tester build for Retail (Midnight) and WoW Forever. It keeps a private, persistent chronicle of your adventures, turns play into silly "Mom Medals", and shows what your guildmates are up to.

## Install

1. Fully exit World of Warcraft.
2. Copy the `MAMChronicles` folder into the client's `Interface/AddOns` folder, or use the supplied safe installer.
3. Enable **Moms Against Magic Chronicles** on the character-select AddOns screen.
4. Log in and type `/mam`.

The installer accepts `_retail_` and `_classic_beta_` client roots, refuses to run while WoW is open, and backs up an existing Chronicles folder outside the game directory.

## Opening the Chronicle

- Click the minimap button (left-click opens or closes the Chronicle, right-click opens settings, drag moves it). Its tooltip shows your Mom Money, medals, next goal and weekly quest progress.
- Use the Addon Compartment entry on Retail, or type `/mam` (or `/chronicle`).
- Bind a key under Key Bindings > AddOns > Moms Against Magic Chronicles.
- Titan Panel, ElvUI, Bazooka and other data-broker displays can open it too, if you use one.

## Tabs

Home, Chronicle (your timeline), Medals, Statistics (including levelling pace), Characters, Map, Guild, Settings and Diagnostics. Settings has a category list, a search box and an info pane that explains whatever option you point at.

## Commands

- `/mam` — open or close the Chronicle.
- `/mam remember <text>` — pin a manual memory with the current place, if available.
- `/mam stats`, `/mam medals`, `/mam settings` — open that tab.
- `/mam recap` — a shareable summary of this month (`/mam recap week` for the last 7 days).
- `/mam book` — your Memory Book of firsts, milestones and close calls.
- `/mam quests` — this week's Mom Quests.
- `/mam tracker` — show or hide the goal tracker window.
- `/mam mute [minutes]` and `/mam unmute` — hold all toasts for a while.
- `/mam guild` — the Guild tab; `/mam guild send` shares your totals now.
- `/mam map` — the live guild map; `/mam map follow <name>` moves your waypoint with a guildmate.
- `/mam export` — a copyable, private Courier export.
- `/mam diag` — redacted diagnostics for bug reports.
- `/mam share`, `/mam gateway` — the optional guild hub (see below).
- `/mam help` — list commands.

## What it records on your computer

Login sessions, levels, deaths and returns, quest accepts and completions, zone discoveries, instance entry and exit, Epic-or-better loot, profession skill changes, achievements, achievement statistics (gold statistics are off by default), medal progress counters, and manual memories. It starts from installation; it cannot recreate earlier history. Nothing here records chat or whispers, and it does not collect account paths, BattleTags, mail or trades.

## What it shares with your guild

All of this uses hidden addon messages on the guild channel, only reaches guildmates who run the addon, and can be switched off in Settings:

- **Medal announcements:** when you earn a medal, plus your medal count and Mom Money once per login ("Announce my Mom Medals to the guild"). Optionally one chat line (off by default).
- **Live location:** zone, position, level and class about every 20 seconds in the open world, never inside instances and never saved to disk ("Share my location with the guild", on by default).
- **Guild hub:** an optional hub for guilds that run one. Sharing with it is opt-in and explained in game; `/mam share off` stops it and `/mam share forget` asks it to forget you.

Midnight can block addon messages (inside instances, during boss fights, or on some realms). The addon waits or stays quiet in those cases and never tries to work around the restriction.

## Notes

Retail is the live-test target. Forever support is capability-gated and still needs an in-game retest. See `CHANGELOG.md` for what changed in each build.
