# MAM Chronicles hub companion (owner's Windows PC)

Runs on the same PC as the WoW client the guild gateway uses. It does two things:

1. Reads the addon's SavedVariables file (`WTF/Account/<account>/SavedVariables/MAMChronicles.lua`), takes only the allowlisted `gateway` fields and uploads what changed to the Pi hub.
2. Pulls queued commands from the hub and writes them to `Interface/AddOns/MAMChroniclesInbox/Inbox.lua`, which the addon reads at login or `/reload`.

No dependencies, Node 20 or newer. It never runs the Lua file (it uses a data-only parser), never uploads chat, whispers, BattleTags, item names, gold, events or settings, and talks only to the hub you configure.

## Setup

1. On the Pi: `node src/cli.js add-source "owner pc"` and copy the key it prints.
2. Copy `config.example.json` to `config.json` and fill in `hubUrl`, `key` and your WoW client folders (`wowRoots`). `config.json` holds the key: do not share or commit it.
3. In game on a rank 0 or 1 character: Settings > Guild hub > tick "Act as the guild hub gateway" (or `/mam gateway on`).
4. Start it: `run.cmd` (or `node src/index.js`). To start at every Windows logon, review and run `install-task.ps1`.

Try one pass first: `node src/index.js --once`.

## How data and commands move

- The game only writes SavedVariables when you `/reload`, log out or exit. Click "Sync now" in the Settings tab (or `/mam gateway sync`) to save the latest data; the companion uploads it within a minute.
- Commands from the dashboard wait on the Pi until the companion fetches them and writes the inbox. The addon relays them to the guild at the next `/reload` or login, then records an acknowledgement, which the companion uploads so the dashboard can show "relayed".
- Members are only seen while they are online and the gateway client is online and in the guild.

## Updates

With `"autoUpdate": true` (default) the companion checks the hub every few hours. If the Pi has a newer companion it downloads the files, verifies each SHA-256, replaces its own files and exits with code 75, which `run.cmd` turns into a restart. It never downloads anything from anywhere except your hub. The Pi's copy is refreshed whenever you re-run `scripts/install.sh` from a newer checkout.

## Tests

```bash
npm test
```

The end-to-end tests run the real hub in the same process against a hand-built SavedVariables fixture. They have not been run against a live WoW client.
