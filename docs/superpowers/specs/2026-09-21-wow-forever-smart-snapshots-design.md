# WoW Forever Smart Snapshots Design

**Date:** 2026-09-21

## Goal

Extend ForeverBridge and its local MCP server so Codex can read useful, exact character and gameplay snapshots without controlling gameplay, reading process memory, or modifying Auctionator.

## Selected approach

Use event-driven smart snapshots. ForeverBridge refreshes only the section affected by a normal WoW event, keeps combat data as small session totals, and writes its SavedVariables when WoW performs a normal save on `/reload`, logout, or exit.

This is preferred over command-only capture because it stays useful without extra steps, and over full event history because it avoids large files and unnecessary gameplay overhead.

## Snapshot contents

`ForeverBridgeDB.snapshot` will contain exact local details in these sections:

- `character`: name, realm, class, race, faction, level, specialization when available, and timestamp.
- `location`: zone, sub-zone, map identifier when available, and timestamp.
- `money`: exact copper total and timestamp.
- `inventory`: bag identifier, slot, item identifier, item link/name, quantity, quality, and timestamp.
- `quests`: quest identifier, exact title, level, completion state, campaign/header flags when available, and timestamp.
- `professions`: exact profession name, skill level, maximum level, rank/icon identifiers when available, and timestamp.
- `auction`: Auctionator availability plus unit price, data age, and exactness for items present in the inventory snapshot.
- `combat`: session start, encounters observed, player damage, player healing, killing blows, deaths, and last combat timestamp.

Exact character, item, and quest names are intentionally enabled by the user's privacy choice. The data remains on the local PC unless the user deliberately shares it.

## Addon architecture

ForeverBridge will be split into focused Lua modules loaded by `ForeverBridge.toc`:

- `Core.lua`: database version, events, slash commands, refresh scheduling, and status messages.
- `Character.lua`: character, location, and money snapshots.
- `Inventory.lua`: compatibility wrappers for modern and legacy container APIs.
- `Quests.lua`: compatibility wrappers for modern and legacy quest-log APIs.
- `Professions.lua`: profession snapshot with graceful fallback when an API is unavailable.
- `Auction.lua`: read-only use of `Auctionator.API.v1`; Auctionator files and data are never changed.
- `Combat.lua`: aggregate only player-related combat totals from permitted combat-log events.

Every module must tolerate missing APIs and record an `available` flag or short error instead of breaking the addon. Frequent events will be coalesced before refreshing expensive sections.

`/wfmcp` prints a short summary. `/wfmcp capture` refreshes every section immediately. `/wfmcp resetcombat` resets only the session combat totals.

## Data flow

1. Blizzard events update the relevant in-memory snapshot section.
2. WoW writes `ForeverBridgeDB` on `/reload`, logout, or exit.
3. The local MCP server reads only `ForeverBridge.lua` from WoW's SavedVariables folders.
4. A restricted parser converts literal Lua table data to JSON without evaluating Lua code.
5. The `wow_snapshot` tool returns the newest snapshot by default, or a selected redacted SavedVariables path.

Account, realm, and character directory names remain redacted in file paths. Snapshot contents contain the exact names approved by the user.

## Auctionator boundary

ForeverBridge will use Auctionator's public read APIs when present:

- `GetAuctionPriceByItemID` or `GetAuctionPriceByItemLink`
- `GetAuctionAgeByItemID` or `GetAuctionAgeByItemLink`
- `IsAuctionDataExactByItemID` or `IsAuctionDataExactByItemLink`

Prices cover items already present in the inventory snapshot. The feature does not trigger scans, place auctions, buy items, change shopping lists, or claim market-wide sold volume. Missing or stale Auctionator data is labelled explicitly.

## MCP safety

`wow_snapshot` is read-only. It enforces:

- ForeverBridge-only file selection.
- Maximum file and result sizes.
- Literal-data parsing with no Lua execution.
- Clear stale-data timestamps.
- Existing path traversal protection.
- No process memory, packets, simulated input, protected actions, or gameplay control.

## Testing and live verification

Automated tests will verify:

- The manifest loads every module in dependency order.
- Required events, commands, compatibility fallbacks, and snapshot fields exist.
- Forbidden network, input, and process-control hooks remain absent.
- SavedVariables parsing accepts representative WoW tables and rejects executable or oversized input.
- `wow_snapshot` returns structured data and preserves exact approved content while redacting filesystem identities.
- Existing MCP, installation, backup, and Auctionator-protection tests continue to pass.

Live verification will:

1. Back up and reinstall ForeverBridge without changing Auctionator.
2. Ask for one `/reload` after installation.
3. Confirm all snapshot sections through MCP.
4. Confirm missing APIs appear as limited/unavailable rather than Lua errors.

## Success criteria

- The live game loads ForeverBridge with no new Lua or FrameXML errors.
- MCP returns exact character, location, money, inventory, quest, profession, Auctionator-price, and combat-summary sections after a save point.
- Snapshot timestamps make staleness obvious.
- Auctionator remains byte-identical.
- The full test, typecheck, build, packaging, and compiled MCP smoke suites pass.
