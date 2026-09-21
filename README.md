# WoW Forever Workspace

One local workspace for WoW Forever addons and the safe MCP connection.

## Five commands

```powershell
npm run setup
npm run status
npm test
npm run install:addon -- ForeverBridge
npm run mcp
```

## What each command does

- `setup` installs locked developer packages, tests everything and builds it. It does not install an addon unless `scripts\Setup.ps1 -InstallBridge` is used.
- `status` shows the Forever build, running state and installed addons.
- `test` checks path safety, backups, inspection, the addon, CLI and MCP.
- `install:addon` backs up an existing copy before installing a project addon.
- `mcp` starts the local stdio MCP server. It opens no network port.

## In WoW

Type `/wfmcp` after ForeverBridge loads. It prints the detected build and interface. Saved data becomes readable after `/reload`, logout or exit.

Auctionator is protected. Project tools refuse to replace it.

