# Task 4 report
Implemented per brief: Comms status awards/unverified, HandleAward, rewritten OnAddonMessage, CanAward/ApplyLocal/SendAward; 13 new tests; plus Medals:GrantVerified change (test grant no longer blocks real grant; real/test over existing real/test stays "already").
NOTE: Comms.lua edits were swept into another writer's commit 31859e5 (jumps fix) because it staged the whole working tree. My commit therefore contains only Medals.lua + guild-medals.test.js.
RED: Comms.lua from HEAD~1 + new tests: `node --test test/guild-medals.test.js` -> tests 31, pass 23, fail 8. Medals test failed alone before the Medals change (1 fail).
GREEN: guild-medals 31/31; npm test 541 pass, 0 fail.
Files: addons/MAMChronicles/Comms.lua (in 31859e5), addons/MAMChronicles/Medals.lua, tools/mam-chronicles/test/guild-medals.test.js.
Untracked test/guild-dungeons.test.js belongs to someone else, untouched.

## Review fixes (Name-Realm recipient, test-only revokes)
- RED: `node --test test/guild-medals.test.js` -> 3 fail (Name-Realm award, WHISPER R1 removes real grant, local R1 removes real grant); test-grant removal test already passed.
- GREEN: same file 35 pass / 0 fail; `npm test` 566 pass / 0 fail (one earlier run showed 3 transient failures while the other writer's edits were mid-flight; rerun clean).
- Changes: `Comms:HandleAward` compares `shortName(parts[2])`; WHISPER revoke and `Comms:ApplyLocal` R1 pass `{ testOnly = true }`; `Medals:RevokeVerified(id, opts)` returns `false, "not a test grant"` for real grants under testOnly; 4 new tests in guild-medals.test.js.
- Note: the Comms.lua edits were swept into the other writer's commit d79c723 (they committed the file with my working-tree edits); my commit contains Medals.lua, the tests and this report.
