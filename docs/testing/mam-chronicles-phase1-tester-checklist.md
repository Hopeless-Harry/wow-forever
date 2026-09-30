# Moms Against Magic Chronicles Phase 1 Tester Checklist

Tester: __________  Date: __________  Client/build: __________

Use `PASS`, `FAIL`, or `NOT TESTED`. If anything fails, copy `/mam diag` and describe exactly what you did.

## Install and persistence

- [ ] Addon installs with no extra files and appears on character select.
- [ ] `/mam` opens one reusable window without a Lua error.
- [ ] A `/mam remember test` entry survives `/reload`.
- [ ] The same entry survives fully exiting and restarting WoW.

## Capture

- [ ] Login/session appears.
- [ ] Level-up appears (only if naturally available).
- [ ] Death appears without claiming an unproven killer.
- [ ] Resurrection/return appears.
- [ ] Quest accepted appears when enabled.
- [ ] Quest completion has the correct quest ID/name when available.
- [ ] Changing zone records one entry rather than a flood.
- [ ] Dungeon/raid entry and exit appear.
- [ ] Epic or Legendary self-loot appears; lower quality does not.
- [ ] A profession skill change appears.
- [ ] `/mam remember <text>` creates a pinned memory.

## Browse and report

- [ ] Search finds quest, item, zone, type, and memory text.
- [ ] Deaths, Quests, World, Instances, Loot, and Memories filters work.
- [ ] Statistics clearly state their window and source-event coverage.
- [ ] `/mam export` is copyable and contains no chat, BattleTag, or account path.
- [ ] Coordinates disappear from export when coordinate recording is disabled.
- [ ] `/mam diag` is copyable and omits the character name.

## Stability

- [ ] No Lua errors during the test.
- [ ] No visible FPS hitch on zone changes or profession updates.
- [ ] Note addon memory before/after a normal session: __________

## Client status

- Retail 12.1: test now.
- WoW Forever beta: **PENDING** until beta access returns. Retail results do not prove Forever behaviour.

Failure notes: ________________________________________________
