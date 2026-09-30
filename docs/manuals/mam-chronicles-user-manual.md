# Moms Against Magic Chronicles — User Manual

- **Version:** `0.2.0-alpha5`
- **Current test target:** World of Warcraft Retail 12.1
- **WoW Forever:** Built with compatibility checks, but live beta testing is still pending.

## What the addon does

Moms Against Magic Chronicles creates a private journal of your character's adventures.

It automatically remembers supported events such as levels, deaths, quests, places, instances, important loot, profession changes, and achievements. You can browse the journal in-game, add your own memories, view monthly statistics, and copy a privacy-limited export.

This first version stores everything locally on your computer. It does not yet send information to the guild or Raspberry Pi.

## Quick start

1. Fully close World of Warcraft.
2. Extract the supplied ZIP.
3. Copy the `MAMChronicles` folder into:

   ```text
   World of Warcraft\_retail_\Interface\AddOns\
   ```

4. Start WoW and enable **Moms Against Magic Chronicles** on the character-select AddOns screen.
5. Log in and type:

   ```text
   /mam
   ```

The Chronicle window should open.

## Opening the Chronicle

- **Minimap button:** left-click opens or closes the Chronicle, right-click opens Settings, and dragging moves the button around the minimap.
- **Addon Compartment (Retail):** click the addon list button beside the minimap and choose Moms Against Magic Chronicles.
- **Blizzard Settings:** the addon has its own page under Settings > AddOns.
- **Slash command:** `/mam` always works, even if the minimap button is hidden. To bring a hidden button back, tick **Show minimap button** in Settings, or use **Reset Minimap Button** to put it back in its default place.
- **First run:** the first time you log in with this version a short message explains `/mam` and says that everything stays on your computer. It appears once.

## The Chronicle window

- Drag the window from its main background to move it.
- Drag the bottom-right handle to resize it.
- Use the **X** in the top-right corner to close it.
- Type `/mam` again whenever you want to reopen it.
- Press **Escape** to close it.
- Its position, size, and last-used tab are remembered across `/reload` and restarts. **Reset Window** in Settings puts it back in the centre at its default size.
- Filter and Range open small menus: pick the exact option you want. The active tab is highlighted, and hovering a control shows a short tooltip.
- Use the mouse wheel, the scrollbar on the right, or Previous/Next to move through the timeline. Previous and Next grey out at the ends.

The window has five tabs. **Home** is the first tab and opens by default.

### Home

A dashboard for the current character:

- a greeting with realm, level and zone;
- six headline tiles from the game's own statistics (creatures killed, quests completed, deaths, dungeons entered, flight paths, delves completed), each with "+N this month" when it has changed;
- **This month**: events, sessions, deaths, quests, discoveries, loot, awards and statistics status;
- **Recent activity**: the latest entries, colour-coded by type, with **View all** to open the full Chronicle;
- a **Remember this moment** box at the bottom that pins a manual memory (press Enter or click Remember).

The layout uses two columns on wide windows and one on narrow ones. A tile shows a dash when the client does not report that statistic.

Statistics and Diagnostics text now sits in a scroll area: it follows the window size and scrolls with the mouse wheel or the scrollbar.

### 1. Chronicle

This is the searchable event timeline.

Controls:

- **Search box:** Find text in quest names, item names, zones, event types, achievements, professions, and manual memories.
- **Filter button:** Click repeatedly to cycle through All, Deaths, Quests, World, Instances, Loot, and Memories.
- **Range button:** Click repeatedly to cycle through All, 30 Days, and This Month.
- **Previous / Next:** Move through the timeline in pages of 30 entries.
- **Mouse wheel:** Move through the timeline more quickly.
- **Click an entry:** Show its available details on the right, such as quest ID, item ID, zone, level, profession skill, or coordinates.

The newest events appear first.

### 2. Statistics

This tab shows the current calendar month's personal summary.

It visibly summarises:

- sessions;
- deaths;
- completed quests;
- zone discoveries;
- Epic or Legendary loot.

It can also show light-hearted awards when there is enough evidence, including Explorer, Quest Machine, Shiny Collector, Comeback Kid, Gravity's Favourite, and Murloc Magnet.

Below the summary is a **Lifetime statistics** section. It is built from the game's own Statistics tab in the Achievements window, which the game has counted for the character's whole life, not only since this addon was installed. The addon reads it shortly after you log in (about eight seconds, and not during combat) and keeps:

- a **baseline** from the first time it read your statistics;
- the **latest** reading;
- one starting reading per month, so it can show what changed since then (for example "+3 Total deaths").

Statistics are grouped into Deaths and combat, Quests, Exploration and travel, Dungeons and raids, Professions and crafting, Social, Loot and items, Time played, Player versus player, and Other. **Gold and money statistics are off by default.** Turn on *Include gold statistics* in Settings to store them; they stay on this computer and are not included in the export. Turning it off again deletes the stored gold values. *Collect achievement statistics* switches the whole feature off.

If a statistic comes back in a format the addon cannot read (for example a distance with units), it is skipped and counted. `/mam diag` shows a line such as "Statistics: ok, 312 read, 4 unreadable".

Every summary states its date window and source-event coverage. A missing event means the addon did not observe it; it does not prove that nothing happened.

### 3. Settings

The settings apply to the local Chronicle database.

- **Record Chronicle:** Master switch for automatic event recording.
- **Record quest accepts:** Records quests when accepted. Quest completions are still retained for future readiness checks.
- **Attach coordinates to events:** Adds coordinates when WoW makes a valid position available.
- **Loot: Epic and above / Legendary only:** Selects which self-looted items count as notable.
- **History:** Cycles the raw-history limit through 1,000, 5,000, and 10,000 events.
- **Show minimap button:** Shows or hides the minimap button.
- **Collect achievement statistics:** Reads the game's Statistics tab after login (on by default).
- **Include gold statistics:** Also stores gold and money statistics locally (off by default).
- **Reset Window / Reset Minimap Button:** Restore the default window and button positions.
- **Erase Chronicle Data...:** Permanently deletes recorded history after a confirmation pop-up. Your settings are kept. If the client cannot show the confirmation, nothing is deleted.

When the history limit is reached, older raw events are compacted into monthly totals. Pinned manual memories are preserved. A report covering only part of compacted history is labelled as incomplete rather than pretending it is exact.

### 4. Diagnostics

This tab produces a copyable technical report containing:

- addon version;
- WoW build and interface;
- database schema;
- event and session counts;
- registered or unavailable collectors;
- safe collector-error summaries.

The diagnostic report deliberately omits the character name. Use it when reporting a problem.

## Slash commands

| Command | What it does |
|---|---|
| `/mam` | Opens the Chronicle tab. |
| `/mam remember your text` | Creates a pinned manual memory at the current place when location information is available. |
| `/mam stats` | Opens this month's Statistics tab. |
| `/mam export` | Opens and selects the copyable Courier export. Press `Ctrl+C` to copy it. |
| `/mam diag` | Opens and selects the redacted diagnostic report. Press `Ctrl+C` to copy it. |
| `/mam help` | Prints the available commands in chat. |

Example:

```text
/mam remember First guild clear of the dungeon — nobody fell off the bridge!
```

Manual memories are limited to 500 characters and are pinned so normal history compaction does not remove them.

## What is recorded automatically

The addon starts recording only after installation. It cannot reconstruct older adventures.

### Sessions

- login/load sessions;
- logout/session endings.

Very close duplicate login signals caused by a reload are suppressed to avoid timeline spam.

### Character events

- level increases;
- deaths;
- observed resurrection or return after a recorded death.

The addon does not claim to know the killer unless the game provides proof. A hostile target may appear only as context, not as a confirmed killer.

### Quests

- accepted quests, when enabled;
- completed/turned-in quests;
- quest ID;
- quest name when WoW provides it.

Quest completion indexes are kept separately for each character so future readiness tools do not confuse one alt's progress with another's.

### World and instances

- zone and subzone changes;
- map ID;
- coordinates when enabled and available;
- dungeon or raid entry and exit;
- instance name, type, map, and difficulty when available.

WoW may hide coordinates in restricted places. Missing coordinates are treated as unknown, not invented.

### Loot

- items looted by your own character;
- Epic and Legendary quality by default;
- item ID, name, link, quality, and quantity when proven by the client.

Uncommon and Rare loot is deliberately ignored in this version. Delayed item information is recorded after WoW finishes loading it.

### Professions

- profession name and identifier;
- skill level and maximum skill level;
- a new event only when the snapshot changes.

Profession snapshots are separate for each character. Recipe collection and guild recipe sharing are not part of this version.

### Achievements

- achievement ID;
- achievement name;
- achievement points when provided by WoW.

## Saved data and persistence

The addon uses WoW's normal SavedVariables system under the key:

```text
MAMChroniclesDB
```

WoW normally writes SavedVariables during `/reload`, logout, or a normal full exit. A computer, client, or connection failure can lose the newest unsaved activity.

For a safe persistence check:

1. Type `/mam remember persistence test`.
2. Type `/reload`.
3. Open `/mam` and search for `persistence test`.
4. Fully exit WoW normally.
5. Restart WoW and check again.

Do not delete the account's WoW `WTF` folder if you want to keep the journal. Back up that folder before major testing or reinstalling WoW.

## Multiple characters

Characters on the same WoW account can use the same local database, but each event records its own character identity.

The following are kept character-specific:

- timeline events;
- quest completion readiness;
- profession snapshots;
- duplicate-event protection.

The current interface is primarily a personal timeline and does not yet provide a guild-wide character selector.

## Export and privacy

`/mam export` creates a deterministic text export intended for the later desktop courier and Raspberry Pi system.

The export may contain:

- event IDs and types;
- timestamps;
- the internal character key;
- safe gameplay fields such as quest ID, item ID, profession values, zone, and manual-memory text;
- coordinates only when coordinate recording is currently enabled.

The addon does not collect or export:

- chat or whispers;
- BattleTags;
- account-folder paths;
- IP addresses;
- gold;
- mail;
- trades.

Manual memories are included in exports. Do not write private real-world information in a manual memory, and do not post your full SavedVariables file publicly.

## What this version does not do yet

This alpha does not yet provide:

- guild-to-guild or player-to-player synchronisation;
- live guild-member map positions;
- Raspberry Pi uploading;
- recipe scanning or guild recipe search;
- crafting requests;
- dungeon or raid readiness scoring;
- automatic monthly-letter generation;
- automatic Discord or public posting.

Those are later phases built on this journal foundation.

## Quick tester route

For the shortest useful test:

1. Type `/mam` and move/resize the window.
2. Type `/mam remember tester check`.
3. Search for `tester check` in Chronicle.
4. Type `/reload` and confirm the memory remains.
5. Accept and complete a simple quest.
6. Change zone and, if practical, enter and leave an instance.
7. Open Statistics and Settings.
8. Type `/mam export`, press `Ctrl+C`, and paste it into a temporary private text file.
9. Type `/mam diag` and confirm the report is copyable.
10. Fully exit and restart WoW, then confirm the manual memory still exists.

Use the separate `TESTER-CHECKLIST.md` for the full acceptance pass.

## Troubleshooting

### The addon does not appear at character select

- Confirm the final folder is `Interface\AddOns\MAMChronicles\`.
- Confirm `MAMChronicles.toc` is directly inside that folder.
- Make sure there is not an accidental double folder such as `MAMChronicles\MAMChronicles\`.
- Restart WoW after installing.

### `/mam` does nothing

- Confirm the addon is enabled for that character.
- Check whether WoW displayed a Lua error.
- Disable other addons temporarily only if necessary to check for a conflict.
- Report the exact client build and what happened.

### A quest has an ID but no name

WoW did not make the title available at the time of observation. The addon keeps the proven ID and leaves the name unknown rather than guessing.

### Coordinates are missing

Coordinates may be disabled in Settings or unavailable in the current map, transport, scenario, dungeon, raid, or restricted area.

### Loot was not recorded

- The item must have been looted by your character.
- The quality must meet the current Epic/Legendary setting.
- WoW must provide valid item information.

### A profession change was not recorded

The addon records a new profession event only when its observed skill snapshot changes. Open the relevant profession window and gain or change a skill before checking again.

### The journal disappeared

- Stop testing and avoid more `/reload` commands until the files are inspected.
- Do not overwrite the `WTF` folder.
- Record whether this followed a crash, reinstall, account change, or manual file cleanup.
- Send the problem details before sharing any SavedVariables file.

## Reporting a problem

Send all four of these:

1. What you clicked or typed.
2. What you expected.
3. What happened instead.
4. The copied `/mam diag` report or a screenshot of the Lua error.

Do not send private SavedVariables publicly. Share them only through an agreed private route if they are genuinely required for diagnosis.
