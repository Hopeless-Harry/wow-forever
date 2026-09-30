# Similar addons: comparison, ideas, and self-review

Date: 30 September 2026. Scope: the achievement-statistics module in `0.2.0-alpha3`, plus what comparable addons suggest for later phases.

## How thorough this is

Desktop research used public CurseForge pages and the Warcraft Wiki API pages only. **No source code was read and no addon was installed or run.** Everything below about other addons is what their listing pages claim. Treat it as a prompt for ideas, not as verified behaviour. Each licence matters: none of the four can be reused as code in this project.

## API facts used (Warcraft Wiki)

- `GetStatisticsCategoryList()`, `GetCategoryInfo(id)`, `GetCategoryNumAchievements`, `GetAchievementInfo` and `GetStatistic(id)` exist on Retail, WoW Forever, Mists, TBC, and Vanilla clients.
- `GetStatistic` returns a **string** as displayed in game, so numbers must be parsed. `--` means no data.
- No `C_` replacement or deprecation is listed.
- Not yet proven in this project: what a live Retail client returns. The alpha3 checklist and the `/mam diag` "Statistics:" line exist to settle that.

## Comparison

| Addon | Licence (per listing) | What it does that matters to us | Where we differ on purpose |
|---|---|---|---|
| Deathlog | GPLv3 | Automatic peer exchange of death records, sender volume caps and junk-record rejection, peer attribution on each entry, optional privacy opt-out for playtime, local "hide this entry", zone/instance statistics and heatmaps, alerts | We do not bundle GPL code. Sharing will be opt-in per category, not automatic |
| Guild Chronicle | All Rights Reserved | Guild death memorial in a book-style UI, popup notifications with sound, statistics by zone/level/class, milestones and titles, calendar view, world-map markers, export, automatic plus manual (`/gdl sync`) sync with duplicate protection | It stores the last chat message before death; we never collect chat |
| HazeAltVault | All rights reserved | Tabbed Summary / Characters / Search, cross-character search, tooltips with per-character counts, colour customisation | It tracks gold, mail and auctions; we default to excluding gold and never collect mail or trades |
| Altoholic and other alt trackers | Not checked | Roster-wide view of every character's progress; each character must log in once | We keep per-character history separate and do not track inventories |

## Ideas worth taking (independently implemented)

1. **Sender caps and plausibility checks for guild sync** (Deathlog). Do this before any receive path exists: per-sender rate and volume limits, reject impossible values, show who relayed a record.
2. **Manual plus automatic sync** (Guild Chronicle). A visible "sync now" command also gives a clear fallback when a realm restricts addon messages.
3. **Local hide of an entry without deleting others' data** (Deathlog). Cheap and respects privacy.
4. **Roster tab** (alt trackers). Because statistics are now stored per character, a "Characters" summary with cross-character search is a natural next view.
5. **Milestones and titles** (Guild Chronicle) driven by statistic thresholds and monthly deltas. The stored month-start snapshot is enough to compute "most quests this month".
6. **Opt-in popups** (Deathlog, Guild Chronicle). You asked for these after the foundation. Keep them off by default, with a per-type toggle, no sound by default, and never during combat.
7. **Calendar and by-zone statistics** once event volume justifies them.
8. **Tooltips that show per-character breakdowns** on minimap hover (alt trackers).

## Things to avoid

- Last chat message, gold totals by default, mail, auctions, or trades.
- Automatic broadcasting of anything to strangers on the realm.
- Copying code from GPLv3 or All Rights Reserved projects. Reimplement the idea only.

## Decisions recorded for gold and sharing

- **Gold:** statistics classed as gold and money are **off by default** and are only stored when the player turns on "Include gold statistics". They stay on this computer. Turning the setting off purges stored gold values. They are not in the Courier export.
- **Sharing:** you asked for whole-guild sharing by default. Sharing does not exist yet, so nothing changed in code. Proposed resolution to settle in Phase 2 design: non-sensitive categories share to the guild by default after a visible first-run notice with a one-click opt-out, with rate limits; **gold and money never share by default**. This needs your explicit confirmation before it is built, because it reverses the recorded "opt-in" rule.

## Self-review of the statistics module

What is sound, with evidence from the 112 automated tests:

- Missing APIs, combat, a disabled setting, and unreadable values all degrade without errors.
- Gold is excluded, purged on opt-out, and cleared on Erase.
- Baseline is never overwritten; months are pruned to six.
- Diagnostics report state, count read, and count unreadable.

Known limitations and risks, in order of importance:

1. **English-only grouping.** Groups are chosen by matching English category titles. On another language client most statistics would land in "Other". Fix after the live run by keying on category IDs discovered live.
2. **Unproven live formats.** The value parser handles counts, money and durations. Distances or other units (for example "yards") are counted as unreadable and skipped. The diagnostics line will show how many.
3. **Scan cost.** The scan is synchronous, runs once per session 8 seconds after entering the world, and retries after combat. Hundreds to a couple of thousand `GetStatistic` calls may be a visible hitch on a slow machine. Check in the live run; if needed, split the scan across frames.
4. **SavedVariables growth.** Each character stores a baseline, a latest snapshot and up to six month snapshots. Check the file size after a session with several characters.
5. **"Baseline" is the statistic's lifetime value at first scan, not zero**, and "changes since" starts from the first scan each month, so a mid-month install under-reports that month. The text states the start date.
6. **Statistics are not in the Courier export yet.** Deliberate until the sharing decision is made.
7. **Awards do not use statistics yet.** The data is stored so awards can use it in a later task.
