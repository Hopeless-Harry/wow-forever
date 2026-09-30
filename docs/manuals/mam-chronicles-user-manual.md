# Moms Against Magic Chronicles — User Manual

- **Version:** `0.2.0-alpha19`
- **Primary test target:** WoW Forever (interface 16001, level cap 60)
- **Secondary test target:** World of Warcraft Retail 12.1
- **Live evidence:** Retail has been observed live for the window and statistics. Forever, guild sharing between two real players, and most detection (campfires, emotes, consumables, vendor, group, ready checks, fall deaths) are not yet proven live.

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

The Chronicle window opens on the **Home** tab. New installs show a **Getting started** card there that explains `/mam`, where Medals and Settings are, what is shared with your guild and how to opt out. Click **Got it** to hide it for good. After an update Home shows a one-line **What's new** note with an x button to dismiss it.

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

The window has six tabs: **Home** (opens by default), **Chronicle**, **Medals**, **Statistics**, **Settings** and **Diagnostics**.

### Medals and Mom Money

**Mom Medals** are the guild's own achievements, and each one is worth **Mom Money** by tier: bronze 10, silver 25, gold 50, platinum 100. There are hundreds, for things like completing quests and dungeons, exploring, keeping memories, levelling, and a lot of jokes (dying from a fall, being defeated by a murloc, wine drunk).

- The **Medals** tab lists every medal, earned ones first, with a progress bar and count for the rest, and your Mom Money total at the top.
- Use the **All / Earned / In progress / Locked / Next up** buttons (each shows its count) and the **search box** to narrow the list. The Medals tab **opens on Next up**; click **All** for the full list. **Next up** shows one medal per family: the next tier you have not earned, which turns the long list into a short to-do list. Search matches a medal's name or description.
- The **Category** button cycles through Progress, Kitchen & Bar, Mom Habits, Emotes, Play Pattern and WoW Forever (categories with nothing for your client are skipped). It combines with the filters and search, and its tooltip text shows how many medals you have earned in it.
- Hover a medal for a tooltip: what it asks for, **how it is tracked** (game statistics, addon counters that store only numbers, or your Chronicle) and your progress.
- **Click an unearned medal to pin it as a goal** (up to three, marked GOAL). Goals and their progress appear on Home, and a goal drops off when you earn it. Click again to unpin. Each goal gives one **Nearly there** toast when you reach 90 percent of its target (targets of 5 or more).
- Medals you earn during the current session carry a **NEW** marker. Medals the client cannot support (for example Retail-only medals on Forever) are hidden, and the counts and Mom Money total only include medals that are listed.
- The first time the addon runs it counts your existing history and statistics as a **silent baseline**: those medals are marked "Earned before tracking began" and you see one welcome message, not a toast per medal.
- After that, each new medal appears as a **toast**, is added to your Chronicle as a Medal entry, and is announced to your guild (see below).
- Clicking a toast opens the Medals tab. Below the medal list, **Guildmates** shows medals other players have earned recently.

There are **264 medals in 96 families worth 7,985 Mom Money** across both clients. On WoW Forever you will see 221 of them (6,645 Mom Money), rising to at most 250 if the client reports every statistic the statistic-based medals need. The full list is in `mom-medals-catalogue.md`, and `docs/research/2026-09-30-medal-feasibility.md` records how each one is tracked and what still needs a live check. Besides the serious ones (quests, delves, dungeons, levels) there is a large Mom-themed and silly set, for example:

- **Kitchen and bar:** Wine O'Clock, Pint of Courage, Second Coffee, Clean Plate Club, Cheese Please, Cookie Monster, Pie in the Sky, Soup of the Day, Fishy Business, Juice Box, Stay Hydrated, Boo-Boo Fixer, Medicine Cabinet.
- **Mom habits:** Trampoline Mom (jumps), School Run (mounting), Mom Needs Five Minutes (AFK), Weekend Getaway (inns), Say Cheese (screenshots), Outfit Change Number Nine, Sewing Circle (repairs), Decluttered (vendor sales), Bargain Hunter, Team Mom (groups joined), Left on Read (groups left), Yes I'm Ready Mom (ready checks).
- **Emotes:** Sit Down Everyone, Nap Time, Mom Stare, Are You Serious?, Because I Said So, Thank-You Note, Hugs and Kisses, Kitchen Dance Party, Smooches, Friendly Neighbourhood Mom, Cheerleader Mom.
- **Play-pattern:** Up Past Bedtime, Early Bird Special, Marathon Mom, Just Five More Minutes, Regular Regular (login streaks), Weekend Warrior, Clean Run, Learning Experience, Raid Night, Mom of Many, Long Haul, Jack of All Trades.
- **WoW Forever camping and content:** Happy Camper (complete The Great Outdoors), Firestarter (light campfires), Journeyman Camper and Expert Camper, Camp Decorator and Well Stocked Camp (camp objects), Campfire Chef (Cooking skill), Unexplored Depths (Forever's nine new dungeons), Summit Seeker (Hyjal Summit), Into the Barrow (The Barrow Deeps), Islander (Darkspear Islands battleground), New Horizons (the four new zones) and Plot Twist (the new race and class combinations). Campfires and camp objects are recognised by spell name, and `/mam diag` lists the camp-related spell names your client reports.
- **WoW Forever only:** The Journey Matters, Ready for the Core (level 60), Old World New Tricks, Beta Testing Mom, Day One Mom (4 November 2026), One Year Later, Skyborne Landing. Level medals only show when the client's level cap allows them, and Forever medals are hidden on Retail.

#### How the silly ones are tracked

A small counter module watches what you do and stores **only whole numbers per category on this computer**: never item names, chat, or locations. Consumables (wine, ale, coffee and tea, food, bandages, potions) are counted when you press an item **and** the game confirms a successful cast within two seconds, so mashing a key while an item is on cooldown does not count. Item names are matched against keywords as whole words, so a "Whale" item is not an ale. Emotes, jumps, mounting, going AFK, resting, screenshots, groups, ready checks, vendor sales and purchases, repairs and equipment changes are counted the same way: only the number is kept. Death by falling is detected by remembering when you were last falling. One known limit: using the very last item of a stack from your bags may not be counted. Counters are cleared by Erase Chronicle Data.

### Weekly Mom Quests

Every week the addon sets **three Mom Quests** that pay extra Mom Money: one adventure (complete quests, discover areas, reach a level, enter dungeons), one piece of Mom life (eat meals, drink coffee or wine, jump, hug, take screenshots, sell to vendors) and one stretch goal (light campfires on Forever, log in on several days, dance, join groups). Finishing one pays 10 to 25 Mom Money and finishing all three pays a further 10. They appear on Home and `/mam quests` lists them with your progress.

Weeks count from the WoW Forever launch on 4 November 2026 (before that you see week one). Week one is deliberately easy: a handful of quests, a few meals, level 10 at most. The targets step up every two weeks until about week twelve, and level goals follow a normal Forever levelling pace and never go past 60. The quests depend only on the week number and your client, so guildmates on the same version see the same ones without any messages. Progress is counted from when a week first starts for that character, and a new week starts fresh.

### Holiday medals

Brewfest, Hallow's End, Winter Veil, Lunar Festival, Love Is in the Air and Midsummer each have two medal series (log in on different days during the holiday, and a themed activity such as drinking at Brewfest or dancing at Midsummer) in the **Holidays** category. The activity only counts while the holiday runs, and a toast tells you when one starts. The dates are approximate fixed windows and may not match Forever's own calendar.

### Mom titles and the Mom Money shop

Every medal family has its own title (about 96 in all), and the Medals tab shows how many you have earned. The first medal you earn in a family unlocks its title with a **New title** toast. Your **Mom title** comes from the medal family you have earned the most Mom Money in: Wine Mom, Pint Mom, Trampoline Mom, Night Owl Mom, Quest Mom and so on, or **Rookie Mom** at the start. It shows under the greeting on Home, on the Medals tab and in recaps. In **Settings > Mom Money shop** the **Title** button cycles through every title you have earned (Auto picks the best).

The same section is a small shop. **Mom Money** you have earned can be spent on cosmetics: toast colours (Rose 50, Teal 75, Violet 100, Sunset 150) and title flourishes (the Great 100, Supreme 250, of Legend 500). Click an item to buy it (it equips automatically), click again to equip or unequip later. The Medals tab shows what is left and what you earned, for example `Mom Money 890 (990 earned)`. Purchases are cosmetic and local: only medal ids, points and the addon version are ever sent to the guild. Erasing your Chronicle resets spending but keeps what you bought.

### Alerts (toasts)

Toasts are also held in dungeons, raids, scenarios and battlegrounds and shown when you are back in the open world (Settings > Alerts > **Hold toasts in dungeons, raids and battlegrounds**, on by default).

Pick the toast sound in **Settings > Alerts > Toast sound**: each click plays the next of nine stock game sounds (Chime, Quest complete, Fanfare, Loot toast, Ready check, Raid warning, Map ping, Whisper, Coins) and keeps it. It only plays with toasts when **Play a sound with toasts** is ticked. A sound the client does not have plays nothing.

Toasts slide in near the top of the screen for new medals, guildmates' medals, and level-ups. They are **on by default** and **never appear during combat**: they wait and appear when combat ends. If several medals arrive together they merge into one summary. A sound is optional and off by default. Everything is under Settings > Alerts, including **Send a test toast** (also `/mam toast`), which cycles through the three looks so you can check they show.

### Guild sharing

When you earn a new medal, the addon sends one tiny hidden message to your guild containing only the **medal id, its points and the definition version**. Guildmates running the addon see a toast and a line in their Guildmates list. Nothing else is sent: no chat, location, gold, history or statistics.

Safeguards: it is on by default but has a one-click opt-out (Settings > Alerts), a first-run notice explains it, messages are rate limited, senders are capped at five a minute, incoming messages are validated (unknown medals or wrong points are ignored), and it stops quietly if the realm restricts addon messages. Optionally you can also post a line in guild chat, which everyone can read, off by default. `/mam diag` shows the state, for example `Guild sharing: ready, sent 1, received 3, dropped 0`.

### Animations

The window and each page fade in softly, medal progress bars grow out from the left when you open the Medals tab or change a filter, medal and guildmate toasts shimmer and their icon pops, and the minimap button glows gently while something new is waiting (a toast appeared while the window was closed) until you open the window. Medal rows also light up under the mouse. The animations use the game's own animation system, so they add no per-frame work. Turn them all off with **Settings > Appearance > Animations**; on a client without animation support they simply do not run.

### Themes and transparency

Settings > Appearance has four themes (Midnight, Parchment, Crimson, Slate). Choosing one saves it; press **Apply theme** to reload the interface with it. **Window transparency** makes the window background see-through and applies immediately.

### Home

A dashboard for the current character:

- a greeting with realm, level and zone;
- six headline tiles (creatures killed, quests completed, deaths, dungeons entered, flight paths, and **Delves completed** on Retail or **Campfires lit** on Forever, which has no Delves), each with "+N this month" when it has changed;
- a **Last session** line (what you did last time you played and how long ago), your Mom title under the greeting, and a **Copy recap** button on the This month card (same as `/mam recap`) and your pinned medal goals;
- a **Getting started** card for new installs and a **What's new** line after updates, both dismissible;
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

The Statistics tab also has a **Hall of Shame** and **Hall of Fame** section above the lifetime statistics: your most dangerous place and worst day, falls, busiest day, longest session, time played, favourite place and highest level. They are worked out from the events still in your journal, so very old history that was compacted away is not included.

### Characters

The **Characters** tab lists every character of your account that has used the addon: name, realm, level and class, Mom title, medals, Mom Money, professions and when you last played. It is built from the addon's own saved data, so a character appears after you have logged in on it once. Nothing on this tab is shared.

### Memory Book

`/mam book` (or **Memory Book** on Home) opens a scrapbook of your character: firsts (first quest, death, dungeon, notable loot, medal), level milestones, your best medals, your pinned memories (newest first) and recent close calls, with a mark for falls. It is text you can select and copy.

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

- addon version, WoW build and interface, client type and level cap;
- database schema and **SavedVariables counts** (events, medals, guild feed entries);
- **handler errors**: how many times an addon handler failed and the last short message (no personal data);
- registered or unavailable collectors and safe collector-error summaries;
- statistics status, including how long the scan took;
- the Guild sharing state and the Medals line (hooks installed, camp spell names seen), which is the evidence for detection that is not yet proven live.

Click **Copy diagnostics**, press `Ctrl+C`, and paste the report into your message (WoW addons cannot write to the clipboard themselves, so the button selects the text for you). The report deliberately omits the character name, chat, gold and item names. `/mam diag` opens it directly.

## Slash commands

| Command | What it does |
|---|---|
| `/mam` | Opens or closes the window on the tab you used last. |
| `/mam remember your text` | Creates a pinned manual memory at the current place when location information is available. |
| `/mam stats` | Opens this month's Statistics tab. |
| `/mam medals` | Opens the Medals tab. |
| `/mam settings` | Opens the Settings tab. |
| `/mam recap` | Shows a short summary of this month to copy and share: your title, sessions, deaths, quests, medals earned, top statistic changes and Mom Money. It has no character name, realm or gold. |
| `/mam quests` | Lists this week's Mom Quests with your progress. |
| `/mam book` | Opens your Memory Book. |
| `/mam recap week` | The same for the last seven days (without statistic changes, which are tracked monthly). |
| `/mam toast` | Shows a sample toast so you can check alerts (click again for the medal and guildmate looks). |
| `/mam export` | Opens and selects the copyable Courier export. Press `Ctrl+C` to copy it. |
| `/mam diag` | Opens and selects the redacted diagnostic report. Press `Ctrl+C` to copy it. |
| `/mam help` | Prints every command in chat. An unknown command points here. |

Example:

```text
/mam remember First guild clear of the dungeon — nobody fell off the bridge!
```

Manual memories are limited to 500 characters and are pinned so normal history compaction does not remove them.

## Damaged saved data

If the saved file contains a broken event, the addon keeps every valid event and drops only the broken ones. `/mam diag` then shows a `Recovery: dropped N invalid events` line. A file that is damaged at the top level still starts fresh, and the diagnostics say so.

## Combat

The addon stays out of the way in combat. If you type `/mam` or click the minimap button during combat, the window opens when combat ends (chat tells you so). Toasts wait until combat ends. Resizing the window in combat is applied afterwards. You can still close the window in combat. Nothing the addon does touches secure buttons.

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
4. The diagnostics: type `/mam diag`, click **Copy diagnostics**, press `Ctrl+C` and paste it into your message. Add a screenshot of any Lua error.

Do not send private SavedVariables publicly. Share them only through an agreed private route if they are genuinely required for diagnosis.
