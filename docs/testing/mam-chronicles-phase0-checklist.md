# Moms Against Magic Chronicles — Phase 0 In-Game Checklist

Record each result as **PASS**, **FAIL**, or **UNAVAILABLE**. Keep the reported build and interface with the results.

## 1. Start and record the build

1. Fully restart WoW Forever after installing the addon.
2. Log into a guild character.
3. Run `/mamdiag run`, then `/mamdiag`.
4. Record the build, interface, and addon version shown.

## 2. Verify persistence

1. Run `/mamdiag mark` and note that a marker is present.
2. Run `/reload`.
3. Reopen `/mamdiag` and confirm **Previous marker loaded: yes**.
4. Exit WoW completely, restart it, and check again.

Passing `/reload` and full restart are separate results. A beta persistence bug may affect one or both.

## 3. Verify event counters

- Change zone or subzone and confirm a zone counter advances.
- If practical, complete a quest and confirm `QUEST_TURNED_IN` advances.
- If practical, gain a level and confirm `PLAYER_LEVEL_UP` advances.
- If practical and safe, die and resurrect and confirm the death/resurrection counters advance.
- Open a profession window and confirm `TRADE_SKILL_SHOW` advances.
- Open or refresh the guild roster and confirm `GUILD_ROSTER_UPDATE` advances.

Do not force a dangerous gameplay situation merely to produce a test event.

## 4. Verify positions

1. Run checks outdoors and record map-position and world-position availability.
2. Enter an instance or another restricted area when naturally available.
3. Run checks again and record whether positions become unavailable cleanly without a Lua error.

## 5. Verify addon messages

1. Run `/mamdiag ping self`; confirm the sent and received counters change.
2. If a second guild member/client has the probe, run `/mamdiag ping guild` on both clients.
3. Confirm each client receives a ping and a pong without visible guild-chat spam.

## 6. Capture the evidence

Take a screenshot or copy the redacted results manually. Confirm it contains no character name, BattleTag, account path, chat text, or sender name. Store the result with:

- client build;
- interface number;
- addon version;
- date;
- PASS/FAIL/UNAVAILABLE for each section;
- the exact Lua error text for any failure.

Do not approve the full Chronicles build until persistence, event registration, and self-message results are known.
