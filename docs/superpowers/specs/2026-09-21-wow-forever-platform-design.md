# WoW Forever Platform Design

**Date:** 21 September 2026  
**Status:** Approved in conversation; awaiting review of this written copy

## Goal

Create one simple workspace for:

- Building WoW Forever addons.
- Testing and installing those addons safely.
- Connecting Codex to useful client information through MCP.
- Finding errors quickly while WoW is running.

## Confirmed Client

- Client folder: `C:\Program Files (x86)\World of Warcraft\_classic_beta_`
- Product: `wow_classic_beta`
- Build: `1.60.1.69913`
- Addon interface: `16001`
- Auctionator is the only addon currently installed.

## Project Layout

```text
WoW/
|-- addons/             Addons we create
|-- apps/mcp-server/    MCP connection for Codex
|-- packages/wow-core/  Shared client discovery and parsing
|-- scripts/            Simple build, test, backup and install commands
|-- docs/               Short guides and capability records
|-- tests/              Automated safety and behaviour tests
`-- backups/            Recoverable local backups; never committed
```

## MCP Connection

The MCP server will provide clear resources and tools.

### It can

- Detect whether WoW Forever is running.
- Report the installed client build.
- List installed addons and their versions.
- Read addon errors, FrameXML logs and other useful logs.
- Read permitted saved-variable files after WoW writes them.
- Build, test and package our addons.
- Back up an existing addon before installing an update.
- Install, enable, disable or restore our own addons when explicitly asked.
- Explain failures in plain language.

### It cannot

- Read WoW process memory.
- Inspect or alter network packets.
- Control the character.
- Press gameplay buttons automatically.
- Bypass protected actions or combat restrictions.
- Secretly change Auctionator, bindings, characters or account settings.

## Live Data Flow

```text
WoW process and logs -----> MCP server -----> Codex
SavedVariables after save -> MCP server -----> Codex
Codex-approved build ------> backup ----------> AddOns folder
```

WoW addons run in a sandbox. They cannot maintain a normal network connection to the MCP server. Live monitoring will therefore use process state and Blizzard-generated logs. Addon state stored in SavedVariables becomes available after WoW writes it during reload, logout or exit.

## Addon Development

Each addon will have:

- Its own folder and `.toc` file.
- Small Lua modules with one clear job each.
- A matching test folder.
- A package command.
- A safe install command that always backs up first.
- A short README with install, test and recovery steps.

Auctionator stays installed and is treated as external software. We will not copy, edit or redistribute its source.

## Safety

- Read-only MCP tools are the default.
- Write tools only affect this project or explicitly selected addon folders.
- Every addon replacement creates a timestamped backup first.
- Saved variables and character data are not deleted automatically.
- Account identifiers are removed from MCP responses where they are not needed.
- Large game data archives are detected but never copied into Git.
- The MCP binds locally and does not expose the computer over the network.

## Errors

Every tool returns:

- What worked.
- What failed.
- Which files were affected.
- Where the backup is located.
- The simplest next action.

If the client build or addon interface changes, installation stops until compatibility is checked.

## Testing

Tests will cover:

- Correct detection of the Forever client and build.
- Safe handling when WoW is running or missing.
- Log and SavedVariables parsing.
- Account-path redaction.
- Addon manifest validation.
- Backup-before-install behaviour.
- Refusal to write outside approved folders.
- MCP resource and tool responses.
- A full build, package, install-to-temporary-folder and restore cycle.

## Simple Commands

The finished workspace will expose a small command set:

- `setup` — check required software and project paths.
- `status` — show client, build, running state and addons.
- `test` — run every automated test.
- `build` — build all project addons and the MCP server.
- `install` — back up and install one selected project addon.
- `restore` — restore one selected addon backup.
- `mcp` — start the local MCP server.

## First Delivery

The first delivery includes:

1. The monorepo foundation.
2. Client discovery and status reporting.
3. Log and error inspection.
4. Safe addon scaffolding, testing and installation.
5. The local MCP server.
6. A tiny diagnostic addon used to verify the complete workflow.
7. Short setup and recovery guides.

The old ForeverDeck project is reference material only. It will not be reinstalled automatically.
