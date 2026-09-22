import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { packageAddons } from "../scripts/package-addons.js";

test("packages ForeverBridge deterministically with one addon root", async (context) => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "wow-addon-package-"));
  context.after(() => rm(outputRoot, { recursive: true, force: true }));

  const first = await packageAddons({ repoRoot: process.cwd(), outputRoot });
  const firstBytes = await readFile(first[0]!.archivePath);
  const second = await packageAddons({ repoRoot: process.cwd(), outputRoot });
  const secondBytes = await readFile(second[0]!.archivePath);

  assert.deepEqual(first[0]!.entries, [
    "ForeverBridge/Core.lua",
    "ForeverBridge/ForeverBridge.toc",
    "ForeverBridge/README.md",
  ]);
  assert.deepEqual(firstBytes, secondBytes);
  assert.ok(firstBytes.byteLength > 100);
});
