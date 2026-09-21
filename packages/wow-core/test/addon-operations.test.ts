import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  installProjectAddon,
  resolveWowPaths,
  restoreAddonBackup,
} from "../src/index.js";

async function fixture(): Promise<{
  base: string;
  repoRoot: string;
  clientRoot: string;
  backupRoot: string;
}> {
  const base = await mkdtemp(path.join(os.tmpdir(), "wow-addon-operation-"));
  const repoRoot = path.join(base, "repo");
  const clientRoot = path.join(base, "client");
  const backupRoot = path.join(repoRoot, "backups", "addons");
  await mkdir(path.join(repoRoot, "addons", "ForeverBridge"), { recursive: true });
  await mkdir(path.join(clientRoot, "Interface", "AddOns", "ForeverBridge"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "addons", "ForeverBridge", "ForeverBridge.toc"),
    "## Interface: 16001\nCore.lua\n",
  );
  await writeFile(path.join(repoRoot, "addons", "ForeverBridge", "Core.lua"), "new-version\n");
  await writeFile(path.join(clientRoot, "Interface", "AddOns", "ForeverBridge", "Core.lua"), "old-version\n");
  return { base, repoRoot, clientRoot, backupRoot };
}

test("backs up the installed addon before replacing it", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));

  const result = await installProjectAddon({
    repoRoot: data.repoRoot,
    paths: resolveWowPaths(data.clientRoot),
    addonName: "ForeverBridge",
    backupRoot: data.backupRoot,
    timestamp: "2026-09-21T10-20-30-000Z",
  });

  assert.equal(result.action, "installed");
  assert.ok(result.backupPath);
  assert.equal(await readFile(path.join(result.backupPath, "Core.lua"), "utf8"), "old-version\n");
  assert.equal(
    await readFile(path.join(data.clientRoot, "Interface", "AddOns", "ForeverBridge", "Core.lua"), "utf8"),
    "new-version\n",
  );
});

test("restores a selected backup and preserves the current addon", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));
  const paths = resolveWowPaths(data.clientRoot);
  const installed = await installProjectAddon({
    repoRoot: data.repoRoot,
    paths,
    addonName: "ForeverBridge",
    backupRoot: data.backupRoot,
    timestamp: "2026-09-21T10-20-30-000Z",
  });

  const restored = await restoreAddonBackup({
    paths,
    addonName: "ForeverBridge",
    backupPath: installed.backupPath!,
    backupRoot: data.backupRoot,
    timestamp: "2026-09-21T10-30-00-000Z",
  });

  assert.equal(restored.action, "restored");
  assert.ok(restored.backupPath);
  assert.equal(
    await readFile(path.join(paths.addons, "ForeverBridge", "Core.lua"), "utf8"),
    "old-version\n",
  );
  assert.equal(await readFile(path.join(restored.backupPath, "Core.lua"), "utf8"), "new-version\n");
});

test("refuses protected names, traversal and sources without a matching TOC", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));
  const paths = resolveWowPaths(data.clientRoot);

  await assert.rejects(
    () => installProjectAddon({ repoRoot: data.repoRoot, paths, addonName: "Auctionator", backupRoot: data.backupRoot }),
    /protected/i,
  );
  await assert.rejects(
    () => installProjectAddon({ repoRoot: data.repoRoot, paths, addonName: "../Escape", backupRoot: data.backupRoot }),
    /invalid addon/i,
  );
  await mkdir(path.join(data.repoRoot, "addons", "NoManifest"), { recursive: true });
  await assert.rejects(
    () => installProjectAddon({ repoRoot: data.repoRoot, paths, addonName: "NoManifest", backupRoot: data.backupRoot }),
    /matching toc/i,
  );
});
