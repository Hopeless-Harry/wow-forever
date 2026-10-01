# Moms Against Magic Guild Ledger

A lightweight, privacy-first guild census for the **Moms Against Magic — WoW Forever Main Roster** Google Form. It turns roster plans into a Classic WoW-inspired public dashboard without publishing names, BattleTags, emails, comments, timestamps, response IDs, or unknown spreadsheet columns.

## What it does

- Shows anonymous class, role, race, ruleset, and profession summaries.
- Provides a searchable and filterable Guild Census.
- Raid Planner (`/raid?size=10|20|40`): per-faction role balance against rough community targets (about 4 tanks, 11 healers, 25 DPS for 40 players) and class coverage (Warrior tank, Druid, Hunter, Paladin, Shaman, Priest, Mage, Warlock). Factions are planned separately because they cannot group together.
- "Can we raid?" on the dashboard, placed right under the headline numbers so it is the first thing an officer sees: for each faction and raid size (10, 20, 40), either Ready or exactly what is missing (for example "Needs 3 healers, 7 DPS"), using the same rough role targets as the raid planner. Flexible players are not counted, so it is a cautious answer. Players can only group within one ruleset, so when a faction's members chose several rulesets it gets one row per ruleset (players happy with either count toward each) instead of pooling people who can never group.
- Discord summary on the dashboard (and as plain text at `/summary.txt`): totals, faction split, roles per faction, raid readiness (the biggest raid size each faction or ruleset group is ready for, or exactly what it needs), top classes, ruleset preferences, professions nobody has and days to launch, as counts only with no names, with a one-click Copy for Discord button.
- "Answers to double-check" on the roster: a short list at the top of members whose race/class or role/class answer looks impossible (for example a Mage tank), each linked to their profile. Only clear impossibilities are listed, and nothing is changed automatically.
- Every page's status line says when the data was last updated ("updated 3 min ago"), kept current in the browser and shown outside the screen-reader announcement so it does not keep interrupting.
- On phones, wide tables (roster, census, recent entries) scroll sideways with the name column pinned, so you can always see whose row you are reading.
- Roster filters: search, class, role, **faction**, ruleset and sort. The choices are remembered across the automatic refresh.
- "Raid groups for Discord" on `/raid`: the suggested groups as paste-ready text (names and classes per group, then the bench) with a Copy button. It follows the chosen raid size and ruleset, and warns when the text is over Discord's 2,000-character limit.
- "Who could fill the gaps" on `/raid`: for each short role (tank, healer, damage), the players who answered flexible and whose class can play it, linked to their profiles. A Mage is never offered as a tank; hybrids are not ruled out. Respects the ruleset filter.
- Ruleset filter on `/raid` (`?ruleset=PvP`): tabs appear when members chose more than one ruleset. Choosing one plans only the players who picked it plus anyone "happy with either", so a suggested group never mixes rulesets. In the all-rulesets view a highlighted note warns that the role totals pool players who cannot group together. Answers are matched to the Form's wording; ruleset names are unverified third-party information.
- Suggested raid groups on `/raid`: names placed into groups of five per faction (a tank per group, healers spread out), with overflow benched and a ruleset breakdown, because players can only group within one faction and one ruleset.
- Every page prints cleanly (black on white, no navigation or controls, cards kept whole), so a raid leader can print the suggested groups with the browser's Print or Save as PDF.
- Profession Directory (`/members/professions`): who can craft or gather each profession, most-covered first, plus the professions nobody has yet.
- Member profile pages (`/member?name=...`), a roster CSV download (`/members.csv`, formula-safe) and a recent-activity feed on the dashboard.
- Soft sanity flags for impossible race/class and role/class answers (for example a Mage tank).
- Launch countdown on the dashboard (reported launch: 4 November 2026, 3 PM PST).
- Roster shows each member's faction and flags race/class combinations that are not in the known WoW Forever list.
- Shows a public named Guild Roster and Guild Chronicle: everyone's current plans, plus who joined, left or changed class, role, race, ruleset or professions.
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
| `MEMBER_PATH` | project `data/members.json` | Named roster and history file (mode 0600) |
| `GOOGLE_SHEET_ID` | empty | ID from the response Sheet URL |
| `GOOGLE_SHEET_RANGE` | `Form Responses 1!A:Z` | Response tab and columns |
| `GOOGLE_CLIENT_EMAIL` | empty | Read-only service account email |
| `GOOGLE_PRIVATE_KEY` | empty | RSA private key with literal `\n` line breaks |
| `RATE_LIMIT_PER_MINUTE` | `300` | Per-IP request limit; over it the site answers 429 with `Retry-After`. `0` disables. The two health routes are exempt. Clients are keyed on Cloudflare's `CF-Connecting-IP` (only trusted from the local tunnel), IPv6 by /64 |
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

The update script also reinstalls the systemd service file when it changed (and reloads systemd), so new data paths such as `MEMBER_PATH` reach existing installs. The service file sets safe defaults for `CACHE_PATH` and `MEMBER_PATH` inside `/var/lib/guild-ledger`, the only writable directory, so an older `/etc/guild-ledger.env` without those lines still works. The update script performs a locked install, runs the complete test suite, copies the verified source, installs production dependencies, and only then restarts the service. If tests fail, the running service is left untouched.

## Troubleshooting

The status line in the page header says what went wrong. In every case the site keeps serving the last safe copy.

| Status message | Meaning | Fix |
| --- | --- | --- |
| The Form's questions changed | A question heading no longer matches `src/config.js` | Compare the Sheet headers with the mapping, update it, run `npm test`, deploy |
| Google refused access to the Sheet | HTTP 401/403/404 from Sheets | Share the Sheet with the service-account email as Viewer; check `GOOGLE_SHEET_ID` and the tab name |
| Google credentials need attention | Token exchange failed or credentials missing | Re-check `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `/etc/guild-ledger.env` |
| Google is unreachable | Network error or a Google 5xx | Usually temporary; check the Pi's internet if it persists |
| Names could not be refreshed (roster page) | The name question changed, so only the roster is affected | Update `nameHeader` in `src/config.js`; the census keeps working meanwhile |

"No responses yet" means the sync works but nobody has answered the Form. A footer note says how many incomplete responses were skipped.

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

## Game data notes

`src/domain/wow-data.js` holds the race/class matrix and factions. It is the Classic matrix plus the six new combinations reported by third-party guides (Human Hunter, Dwarf Shaman, Gnome Priest, Orc Mage, Troll Warlock, Undead Paladin). Skyborne class lists were not verified, so Skyborne races are never flagged. Verify the matrix against official Blizzard information before relying on a flag, and edit that one file if it changes. Raid targets in `src/domain/raid.js` are a rough guide, not game rules. WoW Forever has no realm list (it uses four shared rulesets), so the Form's "server" answer is shown as a **ruleset** preference exactly as given. Reported rulesets are Normal, PvP and Roleplay at launch, with Hardcore planned for winter 2026/27. The launch date and ruleset names come from third-party coverage and are not verified against Blizzard; edit `LAUNCH_AT` in `src/domain/wow-data.js` if the date changes.

## Privacy behaviour

Member names are public by the guild's decision. Anyone with the site link can see the roster and chronicle, so only people who are happy to be listed should fill in the Form.

- Shown publicly: the name or BattleTag typed into the Form, server preference, race, class, role, profession 1 and profession 2, and the history of changes to those answers.
- Never read or shown: email, Google identity, timestamp, response ID, comments, hidden columns and every unknown column.
- Names are matched case-insensitively across syncs. A later submission with the same name replaces the earlier one and is recorded in the Chronicle as a change.
- Roster history is stored in `MEMBER_PATH` (mode 0600 inside a 0700 directory, capped at 500 events), flushed to disk and written atomically. If the file ever becomes unreadable it is kept as `members.json.corrupt-<time>` rather than overwritten.
- Logs contain row counts and error categories, never response content or credentials.
- Do not publish the response Sheet itself; it contains the excluded columns.
- Emails and phone numbers typed into the name field are replaced with `[removed]` before anything is stored or shown.
- Named pages, the CSV and the profile pages are sent `Cache-Control: no-store`, so Cloudflare and browsers should not keep a copy after someone is removed.
- To remove someone: delete their row from the response Sheet **and** erase their history, because the Chronicle keeps earlier answers and a "left" event:

  ```bash
  sudo -u guild-ledger MEMBER_PATH=/var/lib/guild-ledger/members.json node /opt/guild-ledger/app/scripts/forget-member.mjs "Name#1234"
  sudo systemctl restart guild-ledger
  ```

- The anonymous `/responses` entries use the same answers as the named roster, so an anonymous row can be matched to a named one. Anyone who filled in the Form while it was described as anonymous should be told that names are now public.
- The `/responses` Guild Census and `/statistics` pages remain aggregate views with numbered entries.

Run the privacy regression suite at any time:

```bash
npm test -- test/privacy.test.js test/normalize.test.js test/cache-store.test.js test/members.test.js
```

If you later want comments visible, add a separate moderation workflow. Do not simply add the comment column to the public mapping.
