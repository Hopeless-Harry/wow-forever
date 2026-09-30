# Moms Against Magic Chronicles

Version `0.2.0-alpha16` is the polished personal-Chronicle tester build for Retail and WoW Forever.

## Install

1. Fully exit World of Warcraft.
2. Copy the `MAMChronicles` folder into the client's `Interface/AddOns` folder, or use the supplied safe installer.
3. Enable **Moms Against Magic Chronicles** on the character-select AddOns screen.
4. Log in and type `/mam`.

The installer accepts `_retail_` and `_classic_beta_` client roots, refuses to run while WoW is open, and backs up an existing Chronicles folder outside the game directory.

## Opening the Chronicle

- Click the minimap button (left-click opens or closes the Chronicle, right-click opens settings, drag moves it).
- Use the Addon Compartment entry on Retail, or type `/mam`.
- Settings are also in the game's Settings > AddOns list. If the minimap button is hidden, `/mam` and the Addon Compartment still work; re-enable it in settings.

## Commands

- `/mam` — open the Chronicle.
- `/mam remember your text` — pin a manual memory with the current place, if available.
- `/mam stats` — show this month's personal summary.
- `/mam export` — show a copyable, private Courier export.
- `/mam diag` — show redacted diagnostics for bug reports.
- `/mam help` — list commands.

## Achievement statistics

About eight seconds after login the addon reads the game's own Statistics tab (deaths, quests, travel, dungeons and so on) to keep a per-character baseline and monthly changes. Gold and money statistics are off by default and stay local. Both are controlled in Settings.

## What this alpha records

Login sessions, levels, deaths and returns, quest accepts/completions, zone discoveries, instance entry/exit, Epic-or-better loot, profession skill changes, achievements, and manual memories. It starts from installation; it cannot recreate earlier history.

It does **not** upload to a Raspberry Pi, synchronise guild data, share live positions, score raid readiness, record chat/whispers, or collect account paths, BattleTags, gold, mail, or trades. Those larger systems remain later phases.

Retail is the current live-test target. Forever support is capability-gated but remains pending an in-game beta retest.
