# Moms Against Magic Chronicles Diagnostics

This is the Phase 0 compatibility probe for WoW Retail and WoW Forever. It records only capability results, event counts, timestamps, build information, and test-message counters. It does not record names, chat, BattleTags, account paths, gold, mail, trades, or continuous movement.

## Commands

- `/mamdiag` — open or close the redacted report.
- `/mamdiag run` — refresh map, guild, profession, and addon-message checks.
- `/mamdiag mark` — write a persistence marker; copy **Current marker**, then confirm the next session's **Loaded marker** matches it exactly.
- `/mamdiag ping self` — send a test addon message to your own character.
- `/mamdiag ping guild` — send a test ping to online guild members running this probe.
- `/mamdiag reset` — clear diagnostic results while preserving the persistence marker.

## Important

Retail is useful for smoke-testing the shared addon behavior, but it does not prove that a feature works in Forever. A result from one client or beta build does not automatically apply to another.

Fully exit both WoW clients before installing or replacing the addon. After installation, enable **Moms Against Magic Chronicles Diagnostics** in the addon list, log in, and follow the Phase 0 checklist in the project documentation.

The report lists event registration separately from observed event counts. A registered event with an observed count of zero has not yet been exercised; an unavailable event could not be registered on that client build.
