# Moms Against Magic Chronicles — Retail Phase 0 Results

**Dates tested:** 29–30 September 2026  
**Client:** WoW Retail `12.1.0.69933`  
**Interface:** `120100`  
**Locale:** `enUS`  
**Diagnostic versions exercised:** `0.1.1-phase0`, `0.1.4-phase0`, `0.1.5-phase0`  
**Latest diagnostic installed:** `0.1.6-phase0`

Retail is a shared-behaviour smoke test. These results do not establish WoW Forever compatibility.

## Result summary

| Area | Result | Evidence |
|---|---|---|
| Addon loading | PASS | The report opened and identified build `69933`, client `12.1.0`, and interface `120100`. |
| Event registration | PASS | Every allowlisted diagnostic event reported `available`. |
| Event observation | PASS (sampled) | Login, logout, alive, zone, new-area, entering-world, and skill-line events were observed. |
| SavedVariables persistence | PASS | The exact current marker remained present across `/reload` and a full client restart. |
| Loaded-marker diagnostic | PASS | On `0.1.4-phase0`, Current marker and Loaded marker both reported the exact value `1790708096-4` at load count 7. |
| Map APIs | PASS (outdoors) | Map ID, normalised map position, and outdoor world position were all available in the sampled outdoor state. Restricted-instance behaviour remains untested. |
| Guild roster | INCONCLUSIVE | The API was available, but the sampled character exposed zero members and zero online members. |
| Professions | RETEST REQUIRED | Learning Cooking raised `SKILL_LINES_CHANGED`, but `0.1.5-phase0` ignored WoW's secondary-profession return slots. The corrected `0.1.6-phase0` package is ready for a live retest. |
| Addon messaging | RESTRICTED (confirmed) | Prefix registration succeeded with `duplicate-prefix`; outgoing addon messages were restricted while chat lockdown was not active. Version `0.1.5-phase0` visibly reported that the self ping was not sent, and all ping counters correctly remained zero. |
| Privacy | PASS | The copied report contained no character name, sender name, BattleTag, account path, or chat content. |

## Observed counters

- `PLAYER_LOGIN`: 8
- `PLAYER_LOGOUT`: 7
- `PLAYER_ALIVE`: 7
- `ZONE_CHANGED`: 3
- `ZONE_CHANGED_NEW_AREA`: 7
- `PLAYER_ENTERING_WORLD`: 8
- `SKILL_LINES_CHANGED`: 583

## Persistence defect and correction

### Observed on Retail

The persisted marker `1790707868-3` appeared as the current marker after restart while the report displayed `Loaded marker: none`. This directly establishes that the marker survived, but the diagnostic did not capture it as the loaded-session marker.

### Inference from code and reproduction

Code inspection showed that event registration could call database initialization while addon files were loading. The automated harness reproduced the live symptom by loading the Lua files before making the SavedVariables table available and then firing `ADDON_LOADED`.

### Automated correction; live retest passed

When the SavedVariables global is not yet available, versions `0.1.2-phase0` and later keep pre-load event-registration results in temporary memory and merge them during database initialization. Automated coverage requires the loaded marker to match the restored marker after `ADDON_LOADED`. Retail `0.1.4-phase0` then confirmed the exact marker `1790708096-4` in both report fields.

## Build and installation evidence

- Diagnostic tests: 32/32 passed.
- Guild Ledger regression tests: 39/39 passed.
- Installed Retail addon files matched the tested source: 6/6.
- Installed diagnostic: `0.1.4-phase0`
- Package: `MAMChroniclesDiagnostics-0.1.4-phase0.zip`
- Package SHA-256: `F3C6990A3E1CD0DF02EA6B1FB2F7423856CBBD7111501829B48008DB7F1B83D5`

### Prepared feedback fix

On `0.1.4-phase0`, `/mamdiag ping self` produced no visible response when the realm restriction prevented sending. The command did run, but the slash handler discarded the failed result. Version `0.1.5-phase0` now prints whether a self or guild ping was sent and refreshes an open report after the attempt.

The live `0.1.5-phase0` retest displayed the refusal and directed the member to the Messaging section. That section confirmed the restriction, with sent, received-ping, and received-pong counters all remaining zero. The restricted path is therefore complete on this Retail realm and does not need repeated testing.

- Diagnostic tests: 33/33 passed.
- Package: `MAMChroniclesDiagnostics-0.1.5-phase0.zip`
- Package SHA-256: `C4A51EDD0BE30907D919612F412AD4B3E6828433680A0B8A7A688A7547DC9635`
- Installation: installed into Retail after `Wow.exe` stopped; installed files matched tested source 6/6.
- Previous addon backup: `MAMChroniclesDiagnostics-20260930-095449.zip`

### Prepared Cooking and secondary-profession correction

After the character learned Cooking, `SKILL_LINES_CHANGED` advanced from 583 to 588 while the report still showed zero primary professions. Code inspection found that `0.1.5-phase0` retained only the first two values returned by `GetProfessions`; Cooking is returned in the fifth slot. The shared safe-call wrapper also discarded return values following nil slots.

Version `0.1.6-phase0` preserves all API return positions, checks primary professions plus Archaeology, Fishing, and Cooking, and reports secondary professions explicitly. It also distinguishes an unavailable recipe-enumeration API from a genuine zero recipe count.

- Diagnostic tests: 35/35 passed.
- Guild Ledger regression tests: 39/39 passed.
- Package: `MAMChroniclesDiagnostics-0.1.6-phase0.zip`
- Package SHA-256: `EE737387B9AC6B44CF2A345E76EFD8E9039FD3A9CE814D895F34CB05FD842931`
- Installation: installed into Retail after `Wow.exe` stopped; installed files matched tested source 6/6.
- Previous addon backup: `MAMChroniclesDiagnostics-20260930-104726.zip`

## Messaging research note

Blizzard's generated API documentation treats outgoing-addon-message restriction and chat messaging lockdown as separate states. It describes outgoing permission as realm-controlled and receiving permission as separate. Retail `0.1.4-phase0` confirmed `Outgoing restricted: yes` and `Chat lockdown: no`. This rules out chat lockdown as the sampled cause; the addon must respect the realm result rather than try to bypass it, and Forever still needs its own test.

- [Generated ChatInfo API documentation](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/ChatInfoDocumentation.lua)
- [Generated CVar resource entry for `addonChatRestrictionsForced`](https://github.com/Ketho/BlizzardInterfaceResources/blob/live/Resources/CVars.lua)

## Next live check

1. Fully close Retail, install `0.1.6-phase0`, log back into the character that learned Cooking, and use `/mamdiag run`.
2. Confirm `Secondary professions visible: 1` and `Cooking learned: yes`.
3. Use a guilded Retail character, if available, and refresh the guild roster.
4. Check map capability inside an instance or another naturally restricted area.
5. Leave quest, level, death, resurrection, and trade-skill event checks until they occur naturally.
