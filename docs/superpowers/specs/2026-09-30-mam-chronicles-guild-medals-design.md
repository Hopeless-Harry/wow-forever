# MAM Chronicles: variety, named and guild-verified medals (design)

Date: 2026-09-30. Status: awaiting user review. Addon: `addons/MAMChronicles`.

## Goals

1. **Variety medals**: "Wave at N different guildies" (also hug, kiss, cheer, spit, dance and other tracked emotes).
2. **Named medals**: "Spit at Hopeless x times". Targets come from a shipped config table that the guild lead edits and releases. Later weekly quests can draw from the same table.
3. **Guild-verified medals**: things the addon cannot observe (for example "post 10 selfies in the Moms Discord"). Shown in Mom Medals as locked with the text "See Guild Lead to unlock / award points!". Only the Guild Master can grant them.

## Non-goals

- No account-level awards: an award applies to one character.
- No free-text challenges; counters and events are limited to what the addon already tracks.
- No pinned character name. Authority is the Guild Master rank.

## 1. Emote target capture (`Counters.lua`)

- `OnEmote(token, unit)` also reads the target: the `unit` argument when given, else `"target"`.
- Only player units (`UnitIsPlayer`) that are in the player's guild count. Guild check: `GetGuildInfo(unit)` equals the player's own guild name. Name is stored without the realm.
- New local store `db.emoteTargets[emoteToken][name] = count`, capped at 500 names per emote (oldest-by-first-seen dropped). It never leaves the client; it is not exported or sent.
- Existing `emote_<token>` counters are unchanged.
- The 0.3s debounce (`EMOTE_DEBOUNCE`) also covers the target counters, so a DoEmote plus PerformEmote double-fire counts once.

## 2. Variety and named medals (`Medals.lua`, new `GuildMedals.lua` config)

- Variety value function: `ctx.distinctTargets(token)` = number of names in `db.emoteTargets[token]`. Registered via the existing `series(...)` helper with tiers such as 5, 15, 40.
- Named medals come from a shipped table, for example:
  `{ id = "hopeless_spit", name = "Hopeless Case", emote = "SPIT", target = "Hopeless", tiers = { 1, 10, 50 } }`
  Value = `db.emoteTargets[emote][target] or 0`. Match is case-insensitive on the short name. The table sits in its own file so the guild lead edits one place.
- Medal announcements keep the existing `M1|id|points|version` message; no new fields.

## 3. Guild-verified medals

- Defined in the same config file: `{ id, name, description, points }`, flagged `verified = true`.
- `Medals:IsAvailable` stays true so they list; the progress and points cells render the locked text instead of `n / target`. They are never earned by `CheckAll`.
- **Award message** (new, in `Comms.lua`): `A1|<recipientShortName>|<medalId>|<version>`, max 64 characters like today.
- **Sending** (Guild Master only). `/mam award <name> <medalId>` and an Award button in the Medals tab. Both show only when `IsGuildLeader()` is true (local UI convenience, not a security control). Channel GUILD; WHISPER in test mode.
- **Receiving checks, all must pass or the message is dropped and counted in `Comms.status.dropped`:**
  1. Channel is GUILD, and the sender's rank index in the roster is 0 (Guild Master). The sender name is server-supplied, so it cannot be forged.
  2. Recipient short name equals this character's name.
  3. Medal exists, is `verified`, and the version matches.
  4. Not already earned.
  Then the medal is granted, Mom Money added, toast shown.
- `/mam revoke <name> <medalId>` sends `R1|...` with the same checks and removes the award.
- Guild roster is requested with `C_GuildInfo.GuildRoster()` and cached; a rank check against a stale roster fails closed (drop).

## 4. Test mode (not in a guild)

- `/mam testmode on|off|clear`. Local only, default off, UI shows a "TEST MODE" tag.
- While on, a client accepts `A1` and `R1` over **WHISPER** from any sender, so two clients can be tested without a guild. Self-award (loopback) also works.
- Test grants are stored with `test = true`, never add to real Mom Money, and `clear` removes them. Receiving a test award while test mode is off does nothing.
- Real (non-test) grants still require the Guild Master check above. Test mode never relaxes that.

## 5. Guild names

- Roster names are cached on `GUILD_ROSTER_UPDATE` into a session table.
- Used for: `/mam award` name completion, and validating config `target` names (a warning line in `/mam` status when a named medal's target is not on the roster).
- Cache is session-only; nothing persisted or sent.

## Data and compatibility

- New SavedVariables key `emoteTargets` (added to `Database.lua` defaults, `tableOr` guards, `ClearHistory`).
- Older alpha builds drop `A1`/`R1` as malformed (current parser rejects anything not `M1`); they do not error.
- Privacy unchanged: no names, chat, locations or history are sent. Only medal ids and the award message.

## Testing (`tools/mam-chronicles/test`)

- Emote with guild target counts once; non-guild or non-player target ignored; cap of 500 holds.
- Variety medal tiers; named medal match is case-insensitive.
- Award accepted: GUILD, rank 0 sender, right recipient. Rejected: wrong rank, wrong channel, wrong recipient, unknown or non-verified medal, wrong version, already earned, stale roster.
- Test mode: WHISPER accepted only when on; test grants excluded from real points; `clear` removes them; off means ignored.
- Verified medal UI shows the locked text and never auto-earns.
- Buttons hidden when not guild leader.

## Open items for the live build

- `IsGuildLeader` and roster rank behaviour on Forever versus Retail need an in-game check.
- Whether `/wave` with no argument passes the target to the `DoEmote` hook.
