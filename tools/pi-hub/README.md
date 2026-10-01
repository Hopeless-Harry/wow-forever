# MAM Chronicles guild hub (Raspberry Pi)

A small web service that stores what the owner's gateway client hears from guild members running the addon, shows it to the admin and officers, and queues commands (announcements, medal awards, weekly quests, a guild message) for the companion app to deliver.

No dependencies. Node 22.5 or newer, built-in `node:sqlite`, `node:http` and `node:crypto` only. Nothing to compile on the Pi.

## What it stores

Members (level, class, race, title, medal count, Mom Money), a handful of allowlisted activity counts, daily snapshots of those counts (kept forever), the latest location per member (overwritten, expires after 10 minutes), commands, an audit log (kept forever), logins and upload keys. It never stores chat, whispers, BattleTags, account paths, item names or gold. Anything else in an upload is dropped.

## Install on the Pi (home network only)

```bash
cd tools/pi-hub
sudo ./scripts/install.sh
```

Then create your login and the companion's upload key (see the end of the install output). Open `http://<pi-address>:8080` from the home network. **Do not forward this port on your router.** The hub refuses requests from public addresses unless `ALLOW_PUBLIC=true` is set, which should not be done without a deliberate decision (a Tailscale or Cloudflare Tunnel setup comes later and needs its own review).

## Roles

- **admin**: everything, plus the audit log, logins and weekly quest or guild message commands.
- **officer**: view everything, send announcements and award or revoke guild-verified medals.

Logins are a manual list: add them on the Logins page (admin) or with `node src/cli.js add-user`.

## Backups

A database backup is written daily to `/var/lib/mam-pi-hub/backups` (newest 7 kept). `node src/cli.js backup` writes one now. History is kept forever, so watch free space; the dashboard warns above 500 MB.

## API (companion only)

`POST /api/ingest` with `Authorization: Bearer <source key>` and a JSON body, `GET /api/commands?after=<id>` returns queued commands in the addon inbox format.

## Limits

The hub only knows what the gateway client heard while it was online and in the guild. Commands only reach the guild when the gateway client is online and has reloaded the interface after the companion wrote the inbox. Nothing here has been proven between two real players yet; the tests are automated.

## Tests

```bash
npm test
```
