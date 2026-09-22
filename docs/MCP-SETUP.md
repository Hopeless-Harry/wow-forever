# MCP Setup

The project includes a project-scoped Codex configuration at `.codex/config.toml`.

## Connect

1. Build the project:

   ```powershell
   npm run build
   ```

2. Restart Codex from this trusted project.
3. Open `/mcp` and confirm `wow_forever` is connected.

## Connection

- Transport: local stdio.
- Network port: none.
- Server: `apps\mcp-server\dist\src\index.js`.
- Read tools run normally.
- Install and restore tools request approval because they write files.

## Quick check

Ask Codex:

```text
Check my WoW Forever status and list my installed addons.
```

## Limits

- Live process and log state can be read while WoW is open.
- ForeverBridge state updates on `/reload`, logout or exit.
- The MCP does not control gameplay or read hidden game state.

