# Moms Against Magic Chronicles — Retail Phase 0 Results

**Date:** 29 September 2026  
**Client:** WoW Retail `12.1.0.69933`  
**Interface:** `120100`  
**Locale:** `enUS`  
**Diagnostic version exercised:** `0.1.1-phase0`  
**Fixed diagnostic installed for next run:** `0.1.4-phase0`

Retail is a shared-behaviour smoke test. These results do not establish WoW Forever compatibility.

## Result summary

| Area | Result | Evidence |
|---|---|---|
| Addon loading | PASS | The report opened and identified build `69933`, client `12.1.0`, and interface `120100`. |
| Event registration | PASS | Every allowlisted diagnostic event reported `available`. |
| Event observation | PASS (sampled) | Login, alive, new-area, entering-world, and skill-line events were observed. |
| SavedVariables persistence | PASS | The exact current marker remained present across `/reload` and a full client restart. |
| Loaded-marker diagnostic | FIX PENDING RETEST | Version `0.1.1-phase0` displayed `Loaded marker: none` even though the current marker persisted. A load-order regression reproduced the issue; the installed `0.1.4-phase0` build contains the correction. |
| Map APIs | PARTIAL | Map ID and outdoor world position were available; normalised map position was unavailable in the sampled state. |
| Guild roster | INCONCLUSIVE | The API was available, but the sampled character exposed zero members and zero online members. |
| Professions | INCONCLUSIVE | The API was available, but no primary professions or recipes were visible in the sampled state. |
| Addon messaging | UNAVAILABLE IN SAMPLE | Prefix registration succeeded with `duplicate-prefix`, but Retail reported outgoing addon messages restricted. No ping was sent. |
| Privacy | PASS | The copied report contained no character name, sender name, BattleTag, account path, or chat content. |

## Observed counters

- `PLAYER_LOGIN`: 1
- `PLAYER_ALIVE`: 1
- `ZONE_CHANGED_NEW_AREA`: 1
- `PLAYER_ENTERING_WORLD`: 1
- `SKILL_LINES_CHANGED`: 2

## Persistence defect and correction

### Observed on Retail

The persisted marker `1790707868-3` appeared as the current marker after restart while the report displayed `Loaded marker: none`. This directly establishes that the marker survived, but the diagnostic did not capture it as the loaded-session marker.

### Inference from code and reproduction

Code inspection showed that event registration could call database initialization while addon files were loading. The automated harness reproduced the live symptom by loading the Lua files before making the SavedVariables table available and then firing `ADDON_LOADED`.

### Automated correction; live retest pending

When the SavedVariables global is not yet available, versions `0.1.2-phase0` and later keep pre-load event-registration results in temporary memory and merge them during database initialization. Automated coverage requires the loaded marker to match the restored marker after `ADDON_LOADED`. Live Retail confirmation remains pending.

## Build and installation evidence

- Diagnostic tests: 32/32 passed.
- Guild Ledger regression tests: 39/39 passed.
- Installed Retail addon files matched the tested source: 6/6.
- Installed diagnostic: `0.1.4-phase0`
- Package: `MAMChroniclesDiagnostics-0.1.4-phase0.zip`
- Package SHA-256: `F3C6990A3E1CD0DF02EA6B1FB2F7423856CBBD7111501829B48008DB7F1B83D5`

## Messaging research note

Blizzard's generated API documentation treats outgoing-addon-message restriction and chat messaging lockdown as separate states. The Retail report captured only the former, so the cause of the sampled restriction is not yet established. Tomorrow's test should not infer that all Retail or Forever addon messaging is unavailable from this single result.

- [Generated ChatInfo API documentation](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/ChatInfoDocumentation.lua)
- [Generated CVar resource entry for `addonChatRestrictionsForced`](https://github.com/Ketho/BlizzardInterfaceResources/blob/live/Resources/CVars.lua)

## Next live check

1. Launch Retail with `0.1.4-phase0`.
2. Open `/mamdiag` without creating a new marker.
3. Confirm **Current marker** and **Loaded marker** are identical.
4. Record both **Outgoing restricted** and **Chat lockdown**.
5. Continue with an outdoor map check, a guilded character if available, and a character with primary professions.
