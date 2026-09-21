import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findSavedVariables,
  inspectClient,
  listAddons,
  readLogTail,
  redactWowPath,
  resolveWowPaths,
} from "../src/index.js";

async function makeFixture(): Promise<{ base: string; clientRoot: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "wow-forever-core-"));
  const clientRoot = path.join(base, "World of Warcraft", "_classic_beta_");
  await mkdir(path.join(clientRoot, "Interface", "AddOns", "ExampleAddon"), { recursive: true });
  await mkdir(path.join(clientRoot, "Logs"), { recursive: true });
  await mkdir(
    path.join(clientRoot, "WTF", "Account", "123456#1", "Forever Realm", "Hero", "SavedVariables"),
    { recursive: true },
  );
  await writeFile(path.join(clientRoot, "WowB.exe"), "fixture");
  await writeFile(
    path.join(clientRoot, ".flavor.info"),
    "Product Flavor!STRING:0\r\nwow_classic_beta\r\n",
  );
  await writeFile(
    path.join(clientRoot, "..", ".build.info"),
    "Branch!STRING:0|Version!STRING:0|Product!STRING:0\r\nus|1.60.1.69913|wow_classic_beta\r\n",
  );
  await writeFile(
    path.join(clientRoot, "WTF", "Config.wtf"),
    'SET engineSurveyPatch "16001"\r\nSET currentGameMode "15"\r\n',
  );
  await writeFile(
    path.join(clientRoot, "Interface", "AddOns", "ExampleAddon", "ExampleAddon.toc"),
    "## Interface: 16001\r\n## Title: Example Addon\r\n## Version: 2.3.4\r\nCore.lua\r\n",
  );
  await writeFile(path.join(clientRoot, "Logs", "FrameXML.log"), "first\nsecond\nthird\n");
  await writeFile(
    path.join(
      clientRoot,
      "WTF",
      "Account",
      "123456#1",
      "Forever Realm",
      "Hero",
      "SavedVariables",
      "ExampleAddon.lua",
    ),
    "ExampleAddonDB = {}\n",
  );
  return { base, clientRoot };
}

test("inspects the Forever product, build and interface", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.base, { recursive: true, force: true }));

  const status = await inspectClient(resolveWowPaths(fixture.clientRoot));

  assert.equal(status.installed, true);
  assert.equal(status.product, "wow_classic_beta");
  assert.equal(status.version, "1.60.1.69913");
  assert.equal(status.interfaceVersion, 16001);
  assert.equal(status.gameMode, 15);
});

test("lists addon metadata from its matching TOC", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.base, { recursive: true, force: true }));

  const addons = await listAddons(resolveWowPaths(fixture.clientRoot));

  assert.deepEqual(addons, [
    {
      name: "ExampleAddon",
      title: "Example Addon",
      version: "2.3.4",
      interfaceVersion: "16001",
    },
  ]);
});

test("returns only the requested final log lines and rejects unknown logs", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.base, { recursive: true, force: true }));
  const paths = resolveWowPaths(fixture.clientRoot);

  const result = await readLogTail(paths, "FrameXML.log", 2);

  assert.equal(result.name, "FrameXML.log");
  assert.deepEqual(result.lines, ["second", "third"]);
  await assert.rejects(() => readLogTail(paths, "../../secret.txt"), /not allowed/i);
});

test("redacts account, realm and character names from SavedVariables paths", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.base, { recursive: true, force: true }));
  const paths = resolveWowPaths(fixture.clientRoot);

  const results = await findSavedVariables(paths, "ExampleAddon");

  assert.equal(results.length, 1);
  assert.match(results[0]!.path, /<account>.*<realm>.*<character>/);
  assert.doesNotMatch(results[0]!.path, /123456|Forever Realm|Hero/);
  assert.equal(
    redactWowPath(
      path.join(paths.wtf, "Account", "123456#1", "Forever Realm", "Hero", "SavedVariables", "A.lua"),
      paths.wtf,
    ).includes("123456"),
    false,
  );
  await assert.rejects(() => findSavedVariables(paths, "../ExampleAddon"), /invalid addon/i);
});
