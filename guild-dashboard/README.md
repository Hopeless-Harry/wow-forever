# Moms Against Magic Guild Ledger

A lightweight, privacy-first guild census for the **Moms Against Magic — WoW Forever Main Roster** Google Form. It turns roster plans into a Classic WoW-inspired public dashboard without publishing names, BattleTags, emails, comments, timestamps, response IDs, or unknown spreadsheet columns.

## What it does

- Shows anonymous class, role, race, realm, and profession summaries.
- Provides a searchable and filterable Guild Census.
- Refreshes from Google Sheets every two minutes without rebuilding.
- Continues serving the last safe cache if Google is unavailable.
- Runs as a small Node.js service on a Raspberry Pi 3.
- Uses original CSS rather than Blizzard artwork or a large charting library.

The live Form was inspected on 22 September 2026. It had 10 responses and was published, but it did not yet have a linked response Sheet. Linking that Sheet is the first deployment action.

## Architecture

```text
Google Form
    ↓
Private response Sheet
    ↓ read-only, server-side service account
SheetSource → allowlist normalizer → memory + sanitized disk cache
                                      ↓
                         server-rendered pages and safe JSON
```

The browser never contacts Google. Raw Sheet rows exist only long enough to map the six allowed answer columns. The cache contains anonymous public records only. Fastify renders HTML; two small scripts handle census filtering and two-minute page refresh checks.

## Raspberry Pi requirements

- Raspberry Pi 3 with 1 GB RAM
- Raspberry Pi OS 64-bit or 32-bit
- Node.js 20 or newer
- Git for updates
- `cloudflared` only when making the site public
- Outbound HTTPS access to Google and Cloudflare

Docker, a database, nginx, and open router ports are not required.

## Installation

On the Pi, clone or copy this `guild-dashboard` folder, then run:

```bash
cd guild-dashboard
npm ci
npm test
USE_FIXTURE=true NODE_ENV=development npm start
```

Open `http://127.0.0.1:3000`. Fixture mode contains invented test records only; it is for checking the interface and must remain disabled on the public service.

For the managed Pi installation:

```bash
sudo ./scripts/setup.sh
```

The script installs application files under `/opt/guild-ledger/app`, creates an unprivileged `guild-ledger` user, creates `/var/lib/guild-ledger`, and installs the systemd unit.

## Google authentication setup

1. Open Google Cloud Console and create or select a small project.
2. Enable **Google Sheets API** for that project.
3. Create a service account used only for this ledger.
4. Create one JSON key for that service account and download it directly to a trusted computer.
5. Copy `client_email` into `GOOGLE_CLIENT_EMAIL` in `/etc/guild-ledger.env`.
6. Copy `private_key` into `GOOGLE_PRIVATE_KEY`, keeping it on one line and replacing real line breaks with literal `\n` characters.
7. Set ownership and permissions:

```bash
sudo chown root:guild-ledger /etc/guild-ledger.env
sudo chmod 640 /etc/guild-ledger.env
```

Never place the JSON key in this repository, `public/`, the browser, a screenshot, or a shared chat. The service account needs read access to one response Sheet only; it does not need Drive-wide access.

## Connecting the Form response Sheet

The current Form has no linked Sheet yet.

1. Open the Form editor.
2. Choose **Responses**.
3. Select **Link to Sheets** and create a response spreadsheet.
4. Open the new Sheet and copy its ID from the URL between `/d/` and `/edit`.
5. Share the Sheet with the service account's `client_email` as **Viewer**.
6. Confirm the response tab name. Google normally uses `Form Responses 1`.
7. Put the Sheet ID and range into `/etc/guild-ledger.env`.

Do not publish the Sheet to the web. Publishing it could reveal the excluded name column outside this application's privacy layer.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Safe local bind address |
| `PORT` | `3000` | HTTP port |
| `REFRESH_SECONDS` | `120` | Google refresh interval |
| `STALE_AFTER_SECONDS` | `600` | Age at which the UI labels cached data stale |
| `CACHE_PATH` | project `data/cache.json` | Sanitized cache location |
| `GOOGLE_SHEET_ID` | empty | ID from the response Sheet URL |
| `GOOGLE_SHEET_RANGE` | `Form Responses 1!A:Z` | Response tab and columns |
| `GOOGLE_CLIENT_EMAIL` | empty | Read-only service account email |
| `GOOGLE_PRIVATE_KEY` | empty | RSA private key with literal `\n` line breaks |
| `USE_FIXTURE` | `false` | Local visual testing only |

After editing production values:

```bash
sudo systemctl restart guild-ledger
```

## Running locally

```bash
npm ci
npm test
USE_FIXTURE=true NODE_ENV=development npm start
```

On PowerShell:

```powershell
$env:USE_FIXTURE='true'
$env:NODE_ENV='development'
npm start
```

Health checks:

```bash
curl http://127.0.0.1:3000/health/live
curl http://127.0.0.1:3000/health/ready
```

`live` proves the process is running. `ready` returns HTTP 503 until at least one valid sanitized snapshot exists.

## Running on Raspberry Pi

Edit the installed environment file, disable fixture mode, then restart:

```bash
sudo nano /etc/guild-ledger.env
sudo systemctl restart guild-ledger
curl -i http://127.0.0.1:3000/health/ready
```

Keep `HOST=127.0.0.1`. Cloudflare Tunnel connects to that loopback address, so the application does not listen on the LAN or internet directly.

## systemd setup

`scripts/setup.sh` installs `config/guild-ledger.service`. Useful commands:

```bash
sudo systemctl status guild-ledger
sudo systemctl restart guild-ledger
sudo systemctl stop guild-ledger
sudo journalctl -u guild-ledger -n 100 --no-pager
sudo journalctl -u guild-ledger -f
```

The unit starts at boot, restarts after failures, runs without login access, protects the wider filesystem, and writes only to `/var/lib/guild-ledger`.

## Cloudflare Tunnel setup

For the first version without a domain, use a Cloudflare Quick Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

It prints a random `https://...trycloudflare.com` address. Share only that HTTPS address. Quick Tunnels are suitable for an initial generated URL, but the hostname can change when the tunnel restarts and Cloudflare does not give them a production SLA.

For a permanent hostname later, add a domain to Cloudflare, create a named tunnel, copy `config/cloudflared.yml.example` to `/etc/cloudflared/config.yml`, replace the UUID and hostname, then install Cloudflare's service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Do not forward port 3000 on the router. Do not change the app bind address to `0.0.0.0` merely to make the tunnel work.

## Updating the application

Update the checked-out source, then run:

```bash
git pull --ff-only
sudo ./scripts/update.sh
```

The update script performs a locked install, runs the complete test suite, copies the verified source, installs production dependencies, and only then restarts the service. If tests fail, the running service is left untouched.

## Troubleshooting

**The dashboard says it is waiting for a sync**

- Check `/health/ready` and `journalctl`.
- Confirm the Form is linked to a Sheet.
- Confirm `GOOGLE_SHEET_ID` and the tab name in `GOOGLE_SHEET_RANGE`.
- Confirm the Sheet is shared with the service-account email as Viewer.

**Google refresh fails but the pages still work**

This is expected fallback behavior. The status line says an older safe copy is being served. Fix Google access without deleting the cache.

**Missing required sheet header**

The privacy mapper fails closed if a public question heading changes. Compare the Sheet headers with `src/config.js`, update the explicit mapping, run `npm test`, then deploy.

**The Quick Tunnel URL changed**

Quick Tunnel hostnames are temporary. Keep the process running, or move to a named tunnel and domain for a stable address.

**Service will not start**

```bash
sudo systemctl status guild-ledger
sudo journalctl -u guild-ledger -n 100 --no-pager
node --version
```

Node must be version 20 or newer. Do not paste environment-file contents into support messages because they contain the private key.

## Privacy behaviour

The privacy rule is an allowlist, not a visual hide:

- Allowed: anonymous response number, server preference, race, class, role, profession 1, profession 2.
- Excluded: name, BattleTag, email, Google identity, timestamp, response ID, comments, hidden columns, and every unknown column.
- Excluded fields are removed before cache writing, statistics, HTML, or JSON.
- Free-text comments remain excluded because current answers can indirectly identify members.
- The browser receives only `/api/public-data`, which is generated from the sanitized snapshot.
- Logs contain row counts and error categories, never response content or credentials.

Run the privacy regression suite at any time:

```bash
npm test -- test/privacy.test.js test/normalize.test.js test/cache-store.test.js
```

If you later want comments visible, add a separate moderation workflow. Do not simply add the comment column to the public mapping.
