# MAM Chronicles guild hub: design

Status: approved plan, build in progress. Nothing here has run between two real players. Automated tests use stubs and are labelled as such.

## 1. Constraints

- Members install only the CurseForge addon. No companion, no codes.
- WoW addons cannot open network connections. Data leaves a client only as guild/whisper addon messages (prefix `MAMCHR`, 255 bytes, throttled) or via SavedVariables, which the game writes only at `/reload`, logout or exit.
- `ReloadUI()` needs a key or mouse press, so a reload cannot be timer-driven. Hence "Sync now" (one click or keybind) on the gateway.
- Home network first. No router ports. No public exposure without explicit approval. Tailscale or Cloudflare Tunnel are later and not implemented.

## 2. Architecture

```text
 member client (addon)                     owner PC                          Raspberry Pi
 ----------------------                    --------                          ------------
 S1/C1/F1 guild (hidden) -> gateway client
 L1 guild (existing) ---> (addon, gateway   SavedVariables  --companion-->    pi-hub (Node + SQLite)
                           mode, rank 0/1)  MAMChronicles.lua  upload deltas  ingest API
 N1/Q1/K1/A1/R1 <------- relays commands <-- Inbox.lua  <------ pulls cmds <-- command API
 guild channel            at login/reload   (separate addon)                  dashboard (admin, officers)
```

Transport rule (owner decision): hidden GUILD addon messages only. No whispers of any kind and no visible chat lines are used by any new code; a test asserts the new code never calls `SendChatMessage` or uses the `WHISPER` channel. The only visible chat line in the addon is the existing optional "post my medals in guild chat" setting, off by default, which this work does not touch.

Gateway = whichever of the owner's clients is online and the character is rank 0 or 1 on the guild roster.

## 3. Message formats (prefix `MAMCHR`)

Every message: `<type>|<version>|...`, `|` delimiter, no control characters, validated by whitelist, flood-limited per sender, per-type max length (the old 64 byte cap becomes per type, hard max 255).

| Type | From to | Channel | Body | Max |
|---|---|---|---|---|
| `G1\|1\|<name>` | gateway to guild | GUILD | beacon; accepted only from roster rank <= 1; resent every 10 min | 40 |
| `C1\|1\|<level>\|<classID>\|<raceID>\|<titleKey>\|<medals>\|<momMoney>` | member to guild | GUILD | roster summary | 80 |
| `S1\|1\|<seq>\|<part>/<parts>\|k=v,k=v` | member to guild | GUILD | allowlisted counter and statistic keys, integers only | 240 |
| `F1\|1` | member to guild | GUILD | forget me | 8 |
| `L1` | member to guild | GUILD | location, unchanged | 64 |
| `A1/R1` | rank 0/1 to guild | GUILD | award or revoke verified medal, unchanged | 64 |
| `N1\|1\|<id>\|<part>/<parts>\|<text>` | gateway to guild | GUILD | announcement shown as a toast and kept in the guild feed | 240 |
| `Q1\|1\|<id>\|<week>\|<slot>:<template>,...` | gateway to guild | GUILD | weekly quest override | 120 |
| `K1\|1\|<id>\|<key>=<value>` | gateway to guild | GUILD | allowlisted guild config (for example toast and feed switches) | 80 |

Receivers accept `N1/Q1/K1` only from roster rank <= 1, the same `IsAwarder` check as awards, and fail closed with an empty roster.

Budget: one outgoing message per 3 s per client (existing pump), `S1/C1` at most once per 30 min with random jitter, only when values changed, and only while a `G1` beacon was heard in the last 15 min (no gateway, no stats traffic), nothing in instances or lockdown (`Comms:Availability`). Receive side: per-sender flood limit, <= 300 tracked members, <= 40 stat keys each, parts reassembled in a bounded table with a 60 s expiry.

## 4. Gateway SavedVariables (what the companion reads)

`MAMChroniclesDB.gateway`:

```text
enabled, version, writtenAt
members[name] = { lastHeard, level, classID, raceID, title, medals, momMoney, seq, stats{key=int} }
locations[name] = { mapID, x, y, level, classID, at }   -- snapshot of Map.members, latest only
forget = { { name, at }, ... }
ack = { lastCommandId, relayed = { id, ... } }
```

Caps: 300 members, 40 stat keys, 50 forget entries, 50 acks. The companion copies only these allowlisted fields and ignores everything else in the file.

## 5. Command flow

1. Admin or officer composes a command in the dashboard.
2. Pi checks role, writes an audit row, queues the command.
3. Companion polls, writes `Interface/AddOns/MAMChroniclesInbox/Inbox.lua` with command ids and an HMAC.
4. Gateway client reads it at login or `/reload`, verifies the HMAC, relays the commands as rank-gated guild messages, records acks.
5. Next companion upload sends acks. Dashboard shows "relayed to guild channel", never "received by members".

`MAMChroniclesInbox` is a separate tiny addon installed only on the owner's PC. It is not in the CurseForge package.

Permissions: admin can do everything. Officers (manual login list) can send announcements and award or revoke medals. Settings and weekly quest overrides, forget purges and user management are admin only.

## 6. Consent and privacy

- Existing medal messages and location sharing keep their current behaviour (location default on, user decision alpha24).
- New stats and roster sharing needs consent: first time it would send, a modal lists exactly what is sent, with Share and Do not share. Persisted in `settings.shareStats` (nil means not asked, no `S1/C1` sent).
- Settings checkbox, `/mam share on|off|forget`. Forget sends `F1`; the gateway deletes the member and tombstones them; the Pi purges them.
- Never collected: chat, whispers, BattleTags, account paths, item names, gold. Gold stays local-only.
- Honest limit: opt-out and forget are honoured by software the owner runs.
- What is sent is documented in the manual, the CurseForge description and the first-run text.

## 7. Data model (SQLite)

`members(name PK, first_seen, last_heard, level, class_id, race_id, title, medals, mom_money)`,
`stats_daily(name, day, key, value, PRIMARY KEY(name, day, key))` (kept forever, daily snapshot only),
`locations(name PK, map_id, x, y, level, class_id, at)` (overwritten, expires about 10 min),
`commands(id PK, kind, payload, created_by, created_at, state, relayed_at)`,
`audit(id PK, at, actor, role, action, detail)` (kept forever),
`users(name PK, role, password_hash, salt)`, `sources(id PK, key_hash, label, created_at, last_seen)`, `forgotten(name PK, at)`.

Retention is forever for daily stats and the audit log, with a database size warning on the dashboard and nightly SQLite backups (7 kept).

## 8. API

Ingest (source key in header, TLS not required on LAN): `POST /api/ingest` with members, locations, forget and acks. `GET /api/commands?after=<id>` returns pending commands. Dashboard (session cookie, role-gated): overview, members, leaderboard, member detail, map, command composer, audit. Per-route role checks, rate limits and body size caps. Passwords scrypt-hashed. Cookies HttpOnly, SameSite=Strict.

## 9. Failure modes

- Gateway offline: no new data, dashboard shows last heard and marks stale data.
- Pi offline: companion queues uploads with a cap.
- Companion offline: no sync and no commands delivered.
- Reload not done after the companion wrote the inbox: commands wait. The dashboard says so.
- Addon messages restricted by the realm or instances: sharing degrades silently, as today.
- Roster not loaded: commands and beacons fail closed.

## 10. Reconciliation with existing work

Reused: `Comms:IsAwarder`, `A1/R1`, `L1` and `Map.members`, flood and drop counters, `Availability()`. `guild-dashboard/` is the earlier public Google-Form census and stays untouched. Only its systemd and setup script style is reused.

## 11. What is live

Nothing yet. Every part is an automated test with stubs until two real players and a real gateway have run it.
