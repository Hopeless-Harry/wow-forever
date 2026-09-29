# Moms Against Magic Chronicles — Discovery and Project Framework

**Date:** 29 September 2026  
**Status:** Research complete; no addon implementation started  
**Working addon name:** Moms Against Magic Chronicles  
**Technical ID and addon-message prefix:** `MAMChronicles`

## 1. Recommendation in one sentence

Build Chronicles as a **guild-owned event journal** with two connected but deliberately separate systems: fast, temporary guild sharing inside WoW, and durable historical storage on the Raspberry Pi after the game safely writes addon data to disk.

That is the honest architecture supported by WoW's addon sandbox. A WoW addon cannot open a web connection to the Pi, and SavedVariables are normally written only on `/reload`, logout, disconnect, or exit.

## 2. Product north star

Chronicles should answer:

> “What has our guild been doing together, and what story can we tell about it at the end of the month?”

It is not primarily an officer-control tool or a performance meter. Its first job is to preserve the funny, social history of the guild:

- who levelled and when;
- deaths, streaks, and dangerous places;
- quests, achievements, zones, dungeons, and notable discoveries;
- noteworthy loot and profession milestones;
- who played together;
- monthly totals, records, and light-hearted awards;
- the coverage behind every statistic, so incomplete data is never presented as complete.

Later modules can use the same foundation for live guild locations, professions and recipes, crafting requests, and raid readiness.

## 3. Who this serves

### Guild member

Wants their adventures remembered without doing admin. They should install the addon, choose what they are comfortable sharing, and then mostly forget it is running.

### Guild storyteller or officer

Wants a trustworthy monthly summary without merging screenshots, Discord messages, and spreadsheets by hand.

### Crafter or raid organiser

Later wants quick answers such as “Who can craft this?” and “What are we missing for Friday?” without turning the addon into surveillance.

## 4. What current research shows

### The Forever client is a moving beta target

The locally installed client is currently `1.60.1.70009`; the last saved ForeverBridge snapshot recorded build `69977`. The interface number is still `16001`. Forever uses the modern/Mainline-style addon surface and its newer restrictions, rather than being a simple Classic Era API target.

The beta has already had SavedVariables persistence problems. Therefore the first delivery must be a compatibility spike on the installed build, not a large feature build based only on documentation.

### Similar ideas prove the components are plausible

- **Guild Roster Manager** records joins, leaves, ranks, level-ups, inactivity and other guild history, and syncs a decentralised database.
- **Guildbook** and newer profession addons share talents, gear, professions and recipes between addon users.
- **Deathlog** demonstrates durable, deduplicated death records and peer exchange.
- **Forever Chronicle** records a personal adventure diary containing quests, zones, deaths, discoveries, gathering finds and map locations.
- **Guild Found Forever** is the closest current Forever-specific example: it describes guild addon-message sharing for deaths, positions, professions and recipes. Its own README says much of the project has only simulated test coverage, so it is useful evidence of an approach, not proof that every feature is reliable in the live beta.

Chronicles should not copy these projects. Its distinctive product is the **shared guild story + trustworthy Pi archive + monthly letter**, with privacy and coverage built into the data model.

## 5. Hard platform boundaries

| Desired capability | Feasibility | Honest limitation |
|---|---|---|
| Record the local player's level-ups and deaths | Strong | Only from the time the addon is installed and enabled |
| Observe guild roster levels, online state and last known zone | Strong | Roster refreshes are throttled and do not expose every personal detail |
| Share member-authored events with online guild addon users | Strong | Addon messages are throttled and each recipient must run Chronicles |
| Show guildies on the in-game world map | Feasible spike | Members must actively share their own position; positions are unavailable in restricted instances |
| Track professions and recipes | Feasible spike | A member must run the addon; recipes may only be scannable after that member opens the profession UI |
| Count deaths guild-wide | Feasible | Complete only for members running the addon while the event occurs; cause-of-death detail must be tested on Forever's restricted APIs |
| Build monthly letters on the Pi | Strong | Requires an export/upload path and must show data coverage |
| Let the Pi pull live data directly from a running addon | Not supported | Addons have no normal sockets, HTTP, filesystem I/O, or direct website access |
| Show a truly live web map on the Pi | Not supported by addon alone | Exact live positions can be shared in-game, but cannot stream directly from addon Lua to the Pi |
| Reconstruct events from before installation | Not possible | We can import a starting roster, but not recreate missing historical events |

## 6. Recommended system

```text
Member A's addon <---- Blizzard guild addon messages ----> Member B's addon
       |                                                         |
       | local journal + duplicate-safe guild event cache        |
       v                                                         v
SavedVariables written on reload/logout/exit            SavedVariables written
       |                                                         |
       +---------------- Chronicle Courier -----------------------+
                              |
                           HTTPS upload
                              |
                              v
                Raspberry Pi ingestion service
                              |
                 SQLite event and snapshot store
                              |
            dashboard + monthly letter + backups
```

### A. The WoW addon: `MAMChronicles`

Responsibilities:

- observe supported local events;
- turn observations into versioned journal records;
- show the player's chronicle and guild timeline;
- share compact events with other online guild members;
- retain enough recent guild history for store-and-forward recovery;
- render temporary guild map pins;
- expose a clear privacy/settings page;
- write a safe export queue to SavedVariables.

The addon should be modular from the start:

```text
MAMChronicles/
|-- Core/          boot, clock, IDs, migrations, feature flags
|-- Journal/       event schema, validation, deduplication, retention
|-- Collectors/    levels, deaths, quests, zones, loot, groups
|-- GuildSync/     protocol, queue, throttling, recovery
|-- Map/           ephemeral position sharing and pins
|-- Professions/   profession and recipe snapshots
|-- Readiness/     later raid-readiness snapshots
|-- UI/            timeline, statistics, settings, diagnostics
`-- MAMChronicles.toc
```

### B. Guild sync: resilient, not noisy

Use Blizzard's guild addon-message channel with a registered prefix no longer than 16 characters. Messages are limited to 255 bytes and are rate-limited, so Chronicles needs:

- a small versioned envelope;
- a stable event ID and source character ID;
- deduplication on every receive;
- priority queues, with live notices ahead of background history repair;
- bounded chunking for larger snapshots;
- acknowledgements only where they add value;
- backoff when Blizzard restricts outgoing addon messages;
- periodic summary/digest exchange rather than full-database broadcasts;
- strict payload validation before storing anything received from another player.

Every event should be safe to receive more than once. Recent events can be retained locally for 60–90 days so members who overlap later can repair gaps. This means the Pi can receive a missing event from any member who holds a valid copy, rather than depending on one computer.

### C. The desktop helper: Chronicle Courier

This is an optional, small companion app installed by members who agree to upload. It must remain outside gameplay and must never automate input, inspect process memory, or sniff traffic.

Responsibilities:

- discover only the Chronicles SavedVariables files;
- wait until WoW has actually written a new file;
- parse the narrow export queue defensively;
- upload records to the Pi over HTTPS;
- remember acknowledgements so uploads are idempotent;
- show a simple status: last game save, last successful upload, queued count, and error;
- never edit SavedVariables while WoW is running;
- never collect chat, whispers, BattleTag, account-folder names, or unrelated addon data.

Not every member needs Courier on day one. One or two regular players can act as uploaders because peer-synchronised events are duplicated. However, an event seen only by its originating player cannot reach the Pi until that player later overlaps with another Chronicles user or uploads it themselves.

### D. The Raspberry Pi service

Reuse the lightweight direction already proven in the guild-dashboard work: a small Node service, systemd, a local SQLite database, atomic backups, health checks, and a private/outbound tunnel rather than an open router port.

Suggested services:

```text
chronicles-api       authenticated event ingestion and read API
chronicles-worker    validation, aggregation and monthly snapshots
chronicles-web       guild dashboard and letter preview
chronicles-backup    scheduled encrypted database backups
```

The Pi should be the durable source of truth for reporting, but not a real-time gameplay dependency. If it is offline, the addon continues recording and syncing in-game. Uploads retry later.

## 7. Event model

Use one append-only event shape instead of separate ad-hoc tables for every feature:

```text
eventId          stable duplicate key
schemaVersion    enables migrations
type             e.g. character.level_up
occurredAt       server timestamp where available
observedAt       local receipt timestamp
sourceCharacter  opaque character/GUID key
guildKey         realm/guild key
sessionId        local play session
payload          strictly validated fields for this event type
provenance       self-observed, roster-observed, or peer-received
clientBuild      Forever build used when captured
addonVersion     Chronicles version used when captured
```

The provenance field matters. A self-observed death is stronger evidence than an inference from a roster change. Reports should preserve that distinction.

### First event catalogue

**MVP events — high value and comparatively low risk**

- character login/logout session boundary;
- level-up;
- death and resurrection;
- zone/area transition;
- quest accepted and completed, subject to Forever API validation;
- achievement earned, if exposed;
- dungeon/raid entry and exit;
- group-with-guildmates snapshot;
- selected notable loot categories;
- roster join, leave, rank change, name change and observed level change;
- manual “remember this moment” note with optional map position.

**Later snapshots**

- primary professions and skill levels;
- learned recipes after the profession window exposes them;
- equipment, enchants, consumables and attunement-style flags for raid readiness;
- banked crafting requests and offers;
- attendance and boss-kill summaries where the current API/log source supports them.

**Do not collect by default**

- chat or whispers;
- BattleTags, emails, IP addresses or account folder IDs;
- continuous exact movement history;
- gold, mail or trade history;
- combat-performance rankings;
- anything from process memory or network traffic.

## 8. Live map design

The live guild map belongs inside WoW first.

- A member shares their own normalised map ID, X/Y position, zone, level and class through guild addon messages.
- Send only after meaningful movement, with a low-rate heartbeat while stationary.
- Stop sharing in instances or whenever the position API returns no usable value.
- Expire pins quickly when heartbeats stop.
- Make sharing opt-in and visibly active.
- Do not store the continuous path in the permanent Chronicle.
- Store exact coordinates only when attached to a notable event such as a death or a manual memory.

The Pi can later display **recent zone-level presence** or historical event pins after upload. Calling that a live web map would be misleading unless Blizzard exposes a new supported bridge.

## 9. Monthly letter

The letter should be generated from deterministic aggregates first, with optional editorial wording second.

Example sections:

- This Month in Moms Against Magic;
- levels gained and new max-level characters;
- “Most Dramatic” death count and funniest death locations;
- busiest adventurers by active sessions, not raw hours by default;
- zones most explored;
- quests, dungeons and raids completed;
- rare finds and profession milestones;
- members who most often grouped with guildmates;
- guild records and firsts;
- coverage note: members reporting, reporting days, and known gaps.

Every award needs a rule that can be explained. For example, “Most deaths among 14 reporting characters; data coverage 82% of guild play sessions.” The system must never imply that non-reporting members did nothing.

The final workflow should be:

1. Pi closes the month into an immutable statistics snapshot.
2. It generates a private draft.
3. An officer reviews names, jokes, omissions and sensitive entries.
4. The approved letter is published to the guild site or copied to Discord.

Nothing should auto-post publicly without review.

## 10. Privacy and trust rules

Position, play habits, deaths and readiness can feel invasive even in a friendly guild. Adoption will fail if the addon feels like an officer tracker.

Recommended defaults:

- clear first-run consent;
- local journal on by default;
- guild event sharing clearly explained;
- live exact position off until the member opts in;
- position is ephemeral and not archived as a route;
- profession sharing separately switchable;
- readiness sharing separately switchable and visible to the member;
- private or officer-only server views require authentication;
- each member can inspect exactly what their addon will export;
- each member can stop future uploads and request deletion from the Pi;
- server logs contain IDs and counts, never raw event payloads;
- retention limits exist for raw events, uploads and backups.

## 11. Delivery phases

### Phase 0 — Forever compatibility spike

Goal: prove the risky foundations on local build `70009` before committing to the full product.

- verify SavedVariables now load as well as write;
- verify registered guild addon messages between two clients/accounts if available;
- measure message throttling and restriction behaviour;
- test death, resurrection, level, quest, area and guild-roster events;
- test world-map pin rendering and position availability;
- test profession scan behaviour;
- record actual API gaps in a capability matrix;
- create an in-game diagnostics page that can export a redacted report.

**Exit:** a small test addon passes an in-game checklist with recorded build evidence.

### Phase 1 — Personal Chronicle core

- versioned event schema and migrations;
- local collectors for the verified MVP event set;
- search/filterable personal timeline;
- session and monthly local statistics;
- storage limits, compaction and export preview;
- automated Lua tests plus in-game acceptance scripts.

**Exit:** one character can play for several sessions and retain an accurate, searchable journal across reload and restart.

### Phase 2 — Guild Chronicle sync

- guild-only event sharing;
- duplicate-safe storage;
- missed-event repair;
- guild timeline and coverage indicators;
- version/capability handshake;
- safety limits for malformed or excessive peer data.

**Exit:** two or more clients converge on the same test event set without message spam or duplicates.

### Phase 3 — Pi archive and first monthly letter

- Courier helper;
- authenticated ingestion API;
- SQLite schema and migrations;
- dashboard, coverage page and monthly aggregates;
- draft letter with manual approval;
- backup, restore and service runbook on `janus.local`; re-check its live services before choosing a port (the earlier Guild Ledger deployment used `3210`, while Juice Shop occupied `3000`).

**Exit:** a synthetic month and a small real pilot produce the same repeatable totals, and restore testing recovers them.

### Phase 4 — Live in-game guild map and professions

- opt-in ephemeral position sharing and pins;
- profession/skill snapshots;
- on-demand recipe sharing;
- “who can make this?” search;
- crafting requests.

### Phase 5 — Raid readiness

Define “ready” with the guild before coding. The first version should show facts—level, role, gear slots, enchants, consumables and agreed prerequisites—not a mysterious score.

## 12. Project quality bar

- Git repository with short, reviewable changes.
- No direct development in the live AddOns folder; package and install with timestamped backup.
- Unit tests for schema, dedupe, migrations, aggregation, privacy and protocol parsing.
- Simulated multi-client tests for sync and packet loss.
- In-game acceptance checklist on every supported Forever build.
- Pi integration tests using synthetic identities and events.
- Backup and restore test before real guild history is trusted to the server.
- Compatibility gate that warns when the client build or interface changes.
- A plain-language coverage label on every statistic.

## 13. Biggest risks and cheapest tests

| Risk | Why it matters | Cheapest useful test |
|---|---|---|
| Forever beta changes or blocks an assumed API | Could invalidate collectors or sync | Phase 0 diagnostic addon on build 70009 |
| SavedVariables persistence remains unreliable | Could erase the journal | Write marker, reload, restart, update, then verify exact recovery |
| Guild members do not install or enable sharing | Statistics become misleading | Pilot with 3–5 members and show explicit coverage |
| Addon messages become noisy or throttled | Can harm play and violate policy | Traffic budget test with loss/backoff simulation |
| Exact position tracking feels invasive | Can kill trust and adoption | Opt-in prototype with ephemeral pins and member feedback |
| A single uploader creates data gaps | Monthly archive misses isolated events | Store-and-forward sync plus two pilot uploaders |
| Scope expands into a guild ERP before the Chronicle works | Delays the fun core indefinitely | Freeze Phase 1 event list and defer readiness/crafting UI |

The riskiest product assumption is not technical. It is that members will happily run and share data with the addon. A short pilot with transparent controls is more valuable than building every feature first.

## 14. Alternatives considered

### Big all-in-one addon immediately

Rejected for the first release. It combines five risky systems—event capture, distributed sync, map tracking, professions, and raid readiness—while Forever is still in beta.

### Pi-first website

Rejected as the core. The Pi cannot create trustworthy guild history if the addon has not first captured, identified and synchronised events.

### Addon-only, no Pi

Viable as a prototype, but weak for durable history, backups, cross-month reporting and polished letters.

### Recommended hybrid

Addon-first capture, guild peer sync, then Pi durability and reporting. It works when the internet or Pi is down and does not make gameplay depend on a home server.

## 15. Decisions to make before Phase 1

These do not block Phase 0 research, but should be settled before the permanent data model is frozen:

1. The confirmed guild name is **Moms Against Magic**.
2. Choose identity policy: character names on the private site, pseudonyms on any public page, or private-only everything.
3. Decide whether positions are opt-in per session or a remembered setting.
4. Decide which loot qualities and quest events are interesting enough to keep without creating noise.
5. Choose the pilot group of 3–5 guild members.
6. Decide who reviews and approves the monthly letter.

## 16. Research sources

- [Blizzard WoW UI Add-On Development Policy](https://eu.forums.blizzard.com/en/wow/t/wow-user-interface-add-on-development-policy/1642)
- [Blizzard: World of Warcraft Forever overview](https://worldofwarcraft.blizzard.com/en-gb/news/24302093)
- [Warcraft Wiki: addon messages and limits](https://warcraft.wiki.gg/wiki/API_C_ChatInfo.SendAddonMessage)
- [Warcraft Wiki: SavedVariables write lifecycle](https://warcraft.wiki.gg/wiki/Saving_variables_between_game_sessions)
- [Warcraft Wiki: guild roster fields](https://warcraft.wiki.gg/wiki/API:GetGuildRosterInfo)
- [Warcraft Wiki: UnitPosition restrictions](https://warcraft.wiki.gg/wiki/API:UnitPosition)
- [Warcraft Wiki: PLAYER_DEAD](https://warcraft.wiki.gg/wiki/PLAYER_DEAD)
- [Guild Roster Manager](https://www.guildrostermanager.com/)
- [Guildbook](https://www.curseforge.com/wow/addons/guildbook)
- [Deathlog source and design](https://github.com/aaronma37/Deathlog)
- [Forever Chronicle](https://www.curseforge.com/wow/addons/forever-chronicle)
- [Guild Found Forever source](https://github.com/SvenSonnborn/GuildFoundForever)

## 17. Recommended next action

Start **Phase 0 only**: build the minimal diagnostics addon, install it safely beside the existing addons, and run a short in-game compatibility checklist on build `70009`. Do not start the permanent UI or Pi ingestion service until those results are recorded.
