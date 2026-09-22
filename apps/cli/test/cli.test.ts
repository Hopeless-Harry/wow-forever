import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveWowPaths } from "@wow-forever/core";

import { runCli } from "../src/index.js";

async function fixture(): Promise<{ base: string; repoRoot: string; clientRoot: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "wow-cli-"));
  const repoRoot = path.join(base, "repo");
  const clientRoot = path.join(base, "World of Warcraft", "_classic_beta_");
  await mkdir(path.join(repoRoot, "addons"), { recursive: true });
  await mkdir(path.join(clientRoot, "Interface", "AddOns", "Auctionator"), { recursive: true });
  await mkdir(path.join(clientRoot, "WTF"), { recursive: true });
  await writeFile(path.join(clientRoot, "WowB.exe"), "fixture");
  await writeFile(path.join(clientRoot, ".flavor.info"), "Product Flavor!STRING:0\nwow_classic_beta\n");
  await writeFile(
    path.join(clientRoot, "..", ".build.info"),
    "Branch!STRING:0|Version!STRING:0|Product!STRING:0\nus|1.60.1.69913|wow_classic_beta\n",
  );
  await writeFile(path.join(clientRoot, "WTF", "Config.wtf"), 'SET engineSurveyPatch "16001"\n');
  await writeFile(
    path.join(clientRoot, "Interface", "AddOns", "Auctionator", "Auctionator.toc"),
    "## Interface: 16001\n## Title: Auctionator\n## Version: 338\n",
  );
  return { base, repoRoot, clientRoot };
}

function capture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeOut: (value: string) => stdout.push(value),
    writeError: (value: string) => stderr.push(value),
  };
}

test("status --json reports the Forever build and installed addons", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));
  const output = capture();

  const exitCode = await runCli(["status", "--json"], {
    paths: resolveWowPaths(data.clientRoot),
    repoRoot: data.repoRoot,
    writeOut: output.writeOut,
    writeError: output.writeError,
  });

  assert.equal(exitCode, 0);
  const result = JSON.parse(output.stdout.join("\n")) as { version: string; addons: Array<{ name: string }> };
  assert.equal(result.version, "1.60.1.69913");
  assert.deepEqual(result.addons.map((addon) => addon.name), ["Auctionator"]);
});

test("unknown commands show one short help block", async () => {
  const output = capture();
  const exitCode = await runCli(["unknown"], {
    paths: resolveWowPaths("C:\\missing"),
    repoRoot: process.cwd(),
    writeOut: output.writeOut,
    writeError: output.writeError,
  });

  assert.equal(exitCode, 1);
  assert.match(output.stderr.join("\n"), /Commands: status, install, restore/u);
});

test("install refuses Auctionator", async () => {
  const output = capture();
  const exitCode = await runCli(["install", "Auctionator"], {
    paths: resolveWowPaths("C:\\missing"),
    repoRoot: process.cwd(),
    writeOut: output.writeOut,
    writeError: output.writeError,
  });

  assert.equal(exitCode, 1);
  assert.match(output.stderr.join("\n"), /protected/i);
});
