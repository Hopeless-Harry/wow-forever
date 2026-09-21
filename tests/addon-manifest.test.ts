import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const addonRoot = path.resolve("addons", "ForeverBridge");

test("ForeverBridge manifest targets Forever and loads only the passive core", async () => {
  const toc = await readFile(path.join(addonRoot, "ForeverBridge.toc"), "utf8");

  assert.match(toc, /^## Interface: 16001$/mu);
  assert.match(toc, /^## SavedVariables: ForeverBridgeDB$/mu);
  assert.deepEqual(
    toc.split(/\r?\n/u).filter((line) => line && !line.startsWith("##")),
    ["Core.lua"],
  );
});

test("ForeverBridge source is visible and contains no external-control hooks", async () => {
  const source = await readFile(path.join(addonRoot, "Core.lua"), "utf8");

  assert.match(source, /SLASH_WOWFOREVERMCP1 = "\/wfmcp"/u);
  assert.match(source, /PLAYER_LOGIN/u);
  assert.match(source, /PLAYER_LOGOUT/u);
  assert.doesNotMatch(
    source,
    /SendInput|RunMacro|UseAction|SendAddonMessage|SetOverrideBinding|socket|ReadProcessMemory/iu,
  );
});
