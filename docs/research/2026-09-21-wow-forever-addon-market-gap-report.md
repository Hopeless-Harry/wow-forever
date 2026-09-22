# WoW Forever Addon Market and Opportunity Report

**Research snapshot:** 21 September 2026  
**Player lens:** Undead Rogue, ADHD-friendly, minimal setup  
**Client checked:** local WoW Forever beta `1.60.1.69913`, interface `16001`

> [!IMPORTANT]
> **Best direction:** build a small companion system called **Forever Compass** rather than another giant UI pack. Its first three modules should be **State Guardian**, **Compatibility Doctor**, and **Adventure Resume**.

## Read this first: the one-minute answer

CurseForge already has **883 projects tagged for WoW Forever**. That number is moving rapidly, and many entries are new ports or very small beta projects. The busy parts of the market are obvious: full UI replacements, bags, quest navigation, meters, gear scoring, nameplates, and generic Rogue combat helpers.

The useful gaps are not “another prettier bar.” They are:

1. **Protect my setup.** Forever beta currently has a SavedVariables restoration problem. An external companion can keep known-good backups, detect resets, and restore safely.
2. **Tell me what really works.** Players need a clear health check for addon versions, Forever TOCs, errors, conflicts, stale data, and managers silently reinstalling addons.
3. **Remind me what I was doing.** An ADHD-friendly “one current mission” view can resume the player’s intention without replacing exploration with an optimal route.

These ideas fit the existing **ForeverBridge + local MCP** foundation because the game addon can collect approved UI/game state while the desktop side can inspect files, keep backups, and explain the result. It must remain read-only during play: no memory reading, packet inspection, automatic inputs, protected-action bypasses, or fake online status.

## Visual opportunity map

```text
                           HIGH PLAYER VALUE
                                  ▲
                                  │
           BUILD FIRST            │             USEFUL, BUT CROWDED
                                  │
     ┌─────────────────────┐      │       ┌──────────────────────┐
     │ State Guardian      │      │       │ Quest arrows/routes  │
     │ Compatibility Doctor│      │       │ Full UI replacements │
     │ Adventure Resume    │      │       │ Bags / gear scoring  │
     └─────────────────────┘      │       └──────────────────────┘
                                  │
 LOW COMPETITION ─────────────────┼────────────────── HIGH COMPETITION
                                  │
     ┌─────────────────────┐      │       ┌──────────────────────┐
     │ Discovery journal   │      │       │ Cosmetic micro-bars  │
     │ Personal sale notes │      │       │ Another damage meter │
     │ Rogue review journal│      │       │ Another rotation HUD │
     └─────────────────────┘      │       └──────────────────────┘
          EXPLORE LATER           │               SKIP
                                  │
                           LOWER PLAYER VALUE
```

## 1. What WoW Forever is optimizing for

WoW Forever is a permanent 1–60 version of Azeroth, not a temporary season. Blizzard is emphasizing deliberate Classic-style combat, class identity, social play, exploration, and a journey that is not fully solved on day one. The announced content includes more than 1,000 new quests, new regions, nine new dungeons, two raids, a battleground, Camping, Legacy progression, new profession recipes, and revised class/race systems. There is no flying or level scaling. Official gamepad support, visual presets, and opt-in transmog broaden accessibility without removing the old-world structure. See Blizzard’s [What’s Next recap](https://worldofwarcraft.blizzard.com/en-us/news/24303862/world-of-warcraft-forever-whats-next-panel-recap) and [Deep Dive recap](https://worldofwarcraft.blizzard.com/en-us/news/24303313).

That product direction matters. The best Forever addons should help a player **understand, remember, and recover**. They should not immediately erase discovery with a giant prescriptive route or play the character for them.

### Undead Rogue implications

For an Undead Rogue, the useful information is broader than a damage rotation:

- whether poisons are applied and whether enough reagents remain;
- weapon skill and weapon upgrades;
- lockpicking and pickpocket opportunities;
- threat, target priority, crowd control, interrupts, and escape tools;
- what a newly found item is for and whether it should be kept, equipped, sold, or auctioned;
- where the player stopped and what they intended to do next.

Forever keeps deliberate 10–15 second ordinary fights, meaningful threat and crowd control, and revised hit/crit itemization. Undead also receive the new Touch of the Grave passive, while Will of the Forsaken remains a control break and Cannibalize is expanded for mana users. These details come from Blizzard’s [Deep Dive](https://worldofwarcraft.blizzard.com/en-us/news/24303313); exact Rogue talent and spell tuning may still change during beta.

## 2. Technical reality: Forever is not simply Classic Era

Forever looks like old Azeroth but uses the modern/mainline UI architecture. Addons need a Forever-specific TOC, currently interface `16001`, and must cope with current protected-data and display restrictions. Several ports report that combat-log-driven behavior is unavailable or limited, so they use Blizzard-provided systems or post-event data instead.

The most important live beta issue is **settings persistence**. Players report that SavedVariables can be written correctly to disk but fail to restore after a cold client start, affecting addon and Blizzard settings. See the official forum reports for [SavedVariables not restored](https://us.forums.blizzard.com/en/wow/t/wowf-beta-addon-savedvariables-appear-to-write-correctly-to-disk-but-are-not-restored-at-startup/2356559) and [settings wiped on restart](https://us.forums.blizzard.com/en/wow/t/uiaddon-settings-wiped-on-client-restart/2353992). A small addon called ForeverLayoutFix addresses a related `/reload` case, but an addon running inside WoW cannot reliably recover data that the client never loaded.

There is also no public Blizzard data API for the beta/PTR at this snapshot, which limits complete external databases for new quests, items, and NPCs. See the [Blizzard developer forum response](https://us.forums.blizzard.com/en/blizzard/t/when-will-we-gain-api-access-to-forever-apis/59595).

### Safe capability boundary

| Safe and useful | Not acceptable / not technically legitimate |
|---|---|
| Read addon folders, TOCs, logs and saved files | Read game process memory |
| Record approved addon events and snapshots | Inspect or alter network packets |
| Back up and restore files while the client is closed | Automate movement, combat or inputs |
| Explain errors and suggest a manual fix | Bypass protected actions or secret values |
| Hide local UI elements | Spoof server presence or deceive other players |

Blizzard requires addons to be free, source-visible, free of in-game ads, and non-disruptive under its [UI Add-On Development Policy](https://us.forums.blizzard.com/en/wow/t/ui-add-on-development-policy/24534).

## 3. What is already on CurseForge

The [Forever-filtered CurseForge catalogue](https://www.curseforge.com/wow/search?class=addons&gameVersionTypeId=88568&page=1&pageSize=50&sortBy=latest+update) showed **883 projects** on 21 September 2026. This is a catalogue count, not 883 proven working addons. Download totals are inherited by multi-version projects, and a Forever tag does not prove the Forever build is mature.

### Market map

| Area | Examples found | Market reading |
|---|---|---|
| Auction/economy | [Auctionator](https://www.curseforge.com/wow/addons/auctionator), Trade Board, GoldWatch, MoneyTips | Strong incumbent; do not rebuild the AH |
| Quest navigation | [Questie Forever](https://www.curseforge.com/wow/addons/questie-forever), RestedXP, Quest Master Forever, QTurnIn | Very crowded; new Forever quest data remains incomplete |
| Full UI suites | Jugo UI, ForeverUI, BazUI, Classic UI Forever, Win95UI, KaosUI | Extremely crowded and conflict-prone |
| Bags/inventory | BetterBags, Baganator/Bagnon ports, Packmaster | Mature solutions exist; semantic decisions remain weaker |
| Combat/meters | DBM, Epic Damage Meter, ForeverMetter, cast bars, nameplates | Crowded and constrained by the modern combat-data model |
| Gear scoring | GearQuest Forever, ForeverGear, Sharpie’s Gear Judge, AtlasLoot ports | Crowded, with beta data-quality risk |
| Guild/social | GuildOS, DragonGuildMaster, SignalFire | Capable projects exist; adoption/network effects matter |
| Rogue helpers | MaxDps Rogue, ConRO Rogue, RogueFlow, poison/combo trackers | Many narrow tools; live rotation is crowded and restricted |
| Diagnostics | BugSack/Grabber, WoW Task Manager, Addon Control Panel | Components exist, but no obvious Forever-focused end-to-end doctor |
| Accessibility/focus | quest TTS projects, ADHD Quest on Retail, Hide Chat | Real demand, fragmented Forever coverage |

### Strong incumbents to complement, not fight

- **Auctionator** is the obvious auction-house foundation. It has enormous adoption, a current Forever build, and APIs for price lookup and related data. Our opportunity is to explain a player’s decisions around items, not replace Auctionator’s buy/sell UI.
- **Questie/RestedXP/Quest Master** own map pins, arrows, and route guidance. Questie Forever says coverage of new Forever quests is still partial. This is a data problem, not an invitation to copy another whole quest database.
- **BetterBags and similar projects** organize inventory well. The unmet layer is “why am I keeping this?” and “what single action should I take?”
- **DBM/meters/nameplates** own combat presentation. The opportunity for a Rogue is reflection after combat, not a second-by-second automation assistant.

## 4. What players are asking for

Community threads are noisy evidence, not market statistics, but repeated requests expose useful gaps:

- a WeakAuras-like display system that survives Forever’s restrictions;
- Quartz-style cast information, EavesDrop-style event history, PlateBuffs and better scrolling combat text;
- Immersion/DialogueUI-style readable quest presentation;
- voice for new quest text;
- familiar unit frames, action bars, maps and chat replacements;
- confidence that settings will persist and that a claimed port actually works.

Examples include the [working-addon discussion](https://www.reddit.com/r/WowUI/comments/1wkfntp/wow_forever_working_addons_addon/), an [Immersion request](https://www.reddit.com/r/wowaddons/comments/1wkqvtd/immerson_wow_addon_for_wow_forever/), and requests for [Glass, Shadowed Unit Frames, Bartender and SexyMap](https://www.reddit.com/r/wowaddons/comments/1wjkvtu/wow_forever_glass_shadowed_unit_frames_bartender/).

The ADHD-specific pattern is more fundamental: too many goals and too much UI create task paralysis. Players describe losing track of what they intended to do, getting overwhelmed by action clutter, and installing so many helpers that the helpers become another problem. A Retail project named [ADHD Quest](https://www.curseforge.com/wow/addons/adhd-quest) simplifies quest prose, but it is not a Forever session-continuity tool. Existing note addons are general text editors; they do not automatically answer “what was I doing when I logged out?”

## 5. Local machine findings

This report also inspected the actual client rather than relying only on web listings.

| Finding | Evidence on this PC | Meaning |
|---|---|---|
| Correct beta client | `wow_classic_beta`, build `1.60.1.69913`, interface `16001` | The local tools are pointed at the right product |
| Game is live-testable | `WowB.exe` was running and responsive | Diagnostics can be tested against a real session |
| Auctionator protected | 696 files, 2.98 MB, version 338 | Keep it as the economy base |
| ForeverBridge installed | 3 files | Approved in-game data can be exported safely |
| Lorewalker returned | 281 files, 9.54 MB, after earlier removal | An addon manager appears able to reintroduce unwanted addons |
| Stale SavedVariables remain | DialogueUI, ForeverDeck, Lorewalker, Midas, ProfitProphet and others | Folder state and saved-data state can diverge |
| Old error evidence exists | stale ForeverDeck entry in `FrameXML.log` | Players need “new vs old” error explanations |

The reappearing Lorewalker folder is especially valuable evidence. A manager, sync process, or reinstall action can undo a clean addon set. The existing `.curseclient` metadata makes CurseForge management the likely explanation, but that is an inference until the process is observed directly. A state guardian should report the change and its likely source instead of silently deleting anything.

## 6. Ranked gaps

Scores are directional: 5 is strongest. **Shelf life** means the idea remains useful after beta defects are fixed.

| Rank | Opportunity | Player value | Low competition | Feasible now | Shelf life | Harry fit | Total / 25 |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | Compatibility Doctor | 5 | 5 | 5 | 5 | 5 | **25** |
| 2 | Adventure Resume | 5 | 4 | 4 | 5 | 5 | **23** |
| 3 | State Guardian | 5 | 5 | 5 | 2 | 5 | **22** |
| 4 | Discovery Field Journal | 4 | 4 | 4 | 5 | 4 | **21** |
| 5 | Rogue Learning Journal | 4 | 4 | 3 | 4 | 5 | **20** |
| 6 | Item Decision Notebook | 4 | 3 | 4 | 4 | 5 | **20** |
| 7 | New-quest voice/readability pack | 5 | 3 | 2 | 4 | 5 | **19** |

### Gap 1 — Compatibility Doctor

**Problem:** “Forever compatible” is currently a label, not a reliable diagnosis. Players must interpret wrong TOCs, missing libraries, stale errors, protected actions, duplicated suites, and manager-created changes.

**Product:** one command and one simple status card:

```text
┌─ FOREVER DOCTOR ────────────────────────────────┐
│ Overall: 1 action needed                        │
│                                                │
│ ✓ Auctionator        Forever build / healthy   │
│ ✓ ForeverBridge      connected / last save 2m  │
│ ! Lorewalker         returned after removal    │
│ · ForeverDeck data   old file only / harmless  │
│                                                │
│ [Explain simply]  [Back up]  [Open folder]     │
└────────────────────────────────────────────────┘
```

It should distinguish:

- installed addon folders from leftover SavedVariables;
- current errors from old log history;
- “TOC says Forever” from “observed working in this build”;
- a harmless mismatch from a real startup failure;
- user-installed changes from manager/sync changes when evidence permits.

**Why it wins:** Addon Control Panel, BugSack, CurseForge warnings and performance monitors each solve a slice. The gap is a plain-language, Forever-specific diagnosis that combines in-game evidence with the filesystem.

### Gap 2 — Adventure Resume

**Problem:** the player returns after a break and sees dozens of quests, bags, map pins and possible goals. The hard part is not finding every objective; it is remembering the one intention that mattered.

**Product:** a calm, one-card assistant:

```text
┌─ WELCOME BACK, HOPELESS ────────────────────────┐
│ You were: questing in Silverpine Forest        │
│ Main goal: finish “The Dead Fields”             │
│ Next tiny step: return to High Executor Hadrec  │
│                                                │
│ Rogue check: poisons ✓   food 3   bags 4 free  │
│                                                │
│ [Continue this]  [Pick something else]          │
└────────────────────────────────────────────────┘
```

Core design rules:

- exactly one pinned goal;
- one tiny next action, written plainly;
- optional automatic breadcrumb: zone, subzone, selected quest, target and notes;
- no forced optimal route;
- no notification pile;
- a “brain dump” inbox that stays hidden until requested;
- optional play/break reminder without guilt or streak pressure.

**Why it wins:** route addons optimize the game; note addons store text. Adventure Resume preserves the player’s own intention. That is useful to ADHD players and anyone returning after work, illness, travel, or a long break.

### Gap 3 — State Guardian

**Problem:** beta settings can reset, managers can re-add projects, and users cannot tell whether their setup is recoverable.

**Product:** a local, recoverable safety layer:

```text
┌─ YOUR WOW SETUP ────────────────────────────────┐
│ Last good snapshot: Today 18:42                 │
│ Game status: running — restore is locked        │
│ Changes since snapshot:                         │
│   + Lorewalker folder                           │
│   ~ Auctionator saved data                      │
│                                                │
│ [View changes]  [Back up now]  [Restore later]  │
└────────────────────────────────────────────────┘
```

Rules:

- snapshot before every install, removal or restore;
- never restore while WoW is running;
- show exact files and time before changing anything;
- use recoverable quarantine rather than deletion;
- never overwrite Auctionator without explicit user action;
- retain a short rollback history;
- stop claiming responsibility once Blizzard fixes the underlying beta issue.

**Why it wins:** in-game profile managers depend on SavedVariables loading. A desktop companion can operate one layer below that failure.

### Gap 4 — Discovery Field Journal

Capture personal discoveries without publishing a solved route: unusual NPCs, camp locations, locked chests, item sources, screenshots, and “come back at level 35.” It fits Forever’s discovery philosophy and can grow as Blizzard adds content.

### Gap 5 — Rogue Learning Journal

Do not build another glowing “press this next” rotation. Build a short after-combat review from data Blizzard permits:

```text
LAST FIGHT
✓ Interrupted the heal
! Pulled a second enemy while Vanish was unavailable
Next practice: save Gouge for the add
```

Other optional modules: poison/reagent readiness, weapon-skill reminders, lockbox service queue, pickpocket session notes, and a personal escape-tool checklist. Pickpocket trackers already exist, so this should unify learning rather than compete on raw counters.

### Gap 6 — Item Decision Notebook

Add a tiny layer over Auctionator and bag addons:

```text
[KEEP] Swiftthistle
Reason: Rogue tea recipe
Plan: keep 20, auction the rest
Price context: Auctionator value available
Evidence: personal note — not market-wide sale volume
```

This must be honest about data. Current listings and price scans are not market-wide sold quantity. Personal posting/sale history can be useful, but it must be labelled as personal observation.

### Gap 7 — Quest voice and readable dialogue

Demand is real because players want lore without stopping to read walls of text. It is also expensive: new quest coverage is incomplete, voice assets are large, permissions/licensing matter, and beta content changes quickly. Start with a readable dialogue mode and operating-system text-to-speech experiment before attempting a shipped voice library.

## 7. What not to build first

| Idea | Why not |
|---|---|
| Another full UI replacement | Extremely crowded, high conflict/support burden, weak differentiation |
| Another quest arrow/database | Questie, RestedXP and Quest Master already compete; new data is incomplete |
| Another damage meter | Multiple current options plus Blizzard’s modern damage model |
| A Rogue rotation oracle | Crowded, restriction-sensitive, and teaches button following rather than play |
| Another bag replacement | BetterBags/Bagnon-class projects already own presentation |
| A replacement auction house | Auctionator is mature and already installed |
| Online-status spoofing | Server presence is not an addon-controlled truth; deception is outside scope |
| Automatic character control | Violates the safe addon/MCP boundary |

## 8. Recommended product: Forever Compass

Instead of seven separate addons, use one small platform with optional modules.

```text
Forever Compass
│
├── In-game addon: ForeverBridge
│   ├── approved snapshots
│   ├── one pinned goal
│   ├── recent breadcrumb
│   └── safe, display-only prompts
│
├── Local companion / MCP
│   ├── Compatibility Doctor
│   ├── State Guardian
│   ├── Adventure Resume reasoning
│   └── simple reports for Codex
│
└── Later modules
    ├── Rogue Learning Journal
    ├── Discovery Field Journal
    └── Item Decision Notebook
```

### Why this architecture is defensible

- The addon sees events the UI is allowed to expose.
- The companion sees files the addon cannot reliably recover.
- MCP gives Codex structured, read-only tools instead of screen guessing.
- Optional modules prevent an ADHD support tool from becoming addon overload.
- The same core benefits ordinary players: returning players, altoholics, UI tweakers, beta testers, addon authors and support volunteers.

## 9. Build order

### Phase 1 — one week: trustworthy foundation

1. Add a read-only `doctor` command to the existing CLI/MCP.
2. Report installed folders, TOCs, interface numbers, versions and file counts.
3. Separate active folders, stale SavedVariables and current log errors.
4. Record a baseline and report later changes without deleting anything.
5. Add a red/yellow/green plain-language result.

**Success test:** it correctly explains the current Auctionator, ForeverBridge, Lorewalker, stale data and old FrameXML evidence on this PC.

### Phase 2 — one week: State Guardian

1. Create timestamped snapshots of relevant WTF and addon metadata.
2. Refuse restoration while `WowB.exe` is running.
3. Show a preview and require a deliberate restore action.
4. Quarantine changed addon folders rather than permanently delete them.
5. Test cold start, `/reload`, logout and manager reinstallation separately.

**Success test:** settings loss or an unwanted reinstall is recoverable without touching Auctionator.

### Phase 3 — one to two weeks: Adventure Resume MVP

1. Manual one-goal pin inside WoW.
2. Save zone, subzone, quest title/ID and a short note on logout/reload.
3. Show one welcome-back card, then get out of the way.
4. Mirror the snapshot through MCP for plain-language summaries.
5. Keep all features optional and default the UI to minimal.

**Success test:** after a two-day break, the player can understand the next action in under ten seconds.

### Phase 4 — learn before expanding

Use real play sessions to choose only one of:

- Rogue Learning Journal;
- Discovery Field Journal;
- Item Decision Notebook.

Do not build all three until repeated play evidence shows a real need.

## 10. Research limits and confidence

### High confidence

- The local build/addon/file findings were observed directly.
- The SavedVariables problem is documented by multiple beta users on Blizzard’s forums.
- CurseForge is crowded in UI, questing, combat, bag and gear categories.
- Forever’s official design prioritizes exploration, Classic-style combat and social play.

### Medium confidence

- Compatibility Doctor and Adventure Resume are underserved. Search cannot prove no small project exists under another name, but no strong direct competitor appeared in the catalogue and targeted searches.
- CurseForge is likely responsible for Lorewalker returning because `.curseclient` metadata is present. This still needs a controlled observation.

### Low confidence / likely to change

- Individual beta addon quality, download counts and compatibility.
- Exact class tuning and API behavior before launch.
- Whether Blizzard fixes SavedVariables tomorrow, making State Guardian less urgent.

## Final recommendation

Build **Forever Compass** in this order:

1. **Compatibility Doctor** — permanent, broadly useful, and immediately testable.
2. **State Guardian** — urgent beta protection and the best use of the external companion.
3. **Adventure Resume** — the clearest personal differentiator and the best ADHD-friendly feature.

Keep Auctionator. Let mature addons handle auction operations, bags, maps and meters. Make this project the calm layer that tells the player: **what changed, what matters, and what to do next.**

## Source index

- Blizzard: [What’s Next panel recap](https://worldofwarcraft.blizzard.com/en-us/news/24303862/world-of-warcraft-forever-whats-next-panel-recap)
- Blizzard: [Deep Dive panel recap](https://worldofwarcraft.blizzard.com/en-us/news/24303313)
- Blizzard forums: [SavedVariables not restored](https://us.forums.blizzard.com/en/wow/t/wowf-beta-addon-savedvariables-appear-to-write-correctly-to-disk-but-are-not-restored-at-startup/2356559)
- Blizzard forums: [UI/addon settings wiped](https://us.forums.blizzard.com/en/wow/t/uiaddon-settings-wiped-on-client-restart/2353992)
- Blizzard forums: [UI Add-On Development Policy](https://us.forums.blizzard.com/en/wow/t/ui-add-on-development-policy/24534)
- Blizzard developer forums: [Forever beta API availability](https://us.forums.blizzard.com/en/blizzard/t/when-will-we-gain-api-access-to-forever-apis/59595)
- CurseForge: [Forever addon catalogue](https://www.curseforge.com/wow/search?class=addons&gameVersionTypeId=88568&page=1&pageSize=50&sortBy=latest+update)
- CurseForge: [Auctionator](https://www.curseforge.com/wow/addons/auctionator)
- CurseForge: [Questie Forever](https://www.curseforge.com/wow/addons/questie-forever)
- CurseForge: [Addon Settings Manager](https://www.curseforge.com/wow/addons/addon-settings-manager)
- CurseForge: [Addon Control Panel](https://www.curseforge.com/wow/addons/acp)
- CurseForge: [ADHD Quest](https://www.curseforge.com/wow/addons/adhd-quest)
- CurseForge: [Rogue Pick Pocket Tracker](https://www.curseforge.com/wow/addons/rogue-pick-pocket-tracker)
- Reddit: [WoW Forever working addons discussion](https://www.reddit.com/r/WowUI/comments/1wkfntp/wow_forever_working_addons_addon/)
- Reddit: [Immersion request](https://www.reddit.com/r/wowaddons/comments/1wkqvtd/immerson_wow_addon_for_wow_forever/)
- Reddit: [familiar UI addon requests](https://www.reddit.com/r/wowaddons/comments/1wjkvtu/wow_forever_glass_shadowed_unit_frames_bartender/)
