import assert from "node:assert/strict";
import test from "node:test";

import { resolveWowPaths } from "../src/config.js";

test("derives every path from one explicit client root", () => {
  const paths = resolveWowPaths(String.raw`C:\Games\Forever`);

  assert.equal(paths.addons, String.raw`C:\Games\Forever\Interface\AddOns`);
  assert.equal(paths.logs, String.raw`C:\Games\Forever\Logs`);
  assert.equal(paths.wtf, String.raw`C:\Games\Forever\WTF`);
});
