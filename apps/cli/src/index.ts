#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectClient,
  installProjectAddon,
  listAddons,
  resolveWowPaths,
  restoreAddonBackup,
  type WowPaths,
} from "@wow-forever/core";

interface CliOptions {
  paths: WowPaths;
  repoRoot: string;
  backupRoot?: string;
  writeOut: (value: string) => void;
  writeError: (value: string) => void;
}

const HELP = "Commands: status, install, restore\nUsage: install <addon> | restore <addon> <backup-path>";

export async function runCli(args: string[], options: CliOptions): Promise<number> {
  const [command, ...rest] = args;
  const backupRoot = path.resolve(options.backupRoot ?? path.join(options.repoRoot, "backups", "addons"));
  try {
    if (command === "status") {
      const [status, addons] = await Promise.all([inspectClient(options.paths), listAddons(options.paths)]);
      const output = { ...status, addons };
      if (rest.includes("--json")) options.writeOut(JSON.stringify(output, null, 2));
      else {
        options.writeOut([
          "WoW Forever",
          `Installed: ${status.installed ? "yes" : "no"}`,
          `Running: ${status.running ? "yes" : "no"}`,
          `Build: ${status.version ?? "unknown"}`,
          `Interface: ${status.interfaceVersion ?? "unknown"}`,
          `Addons: ${addons.map((addon) => addon.name).join(", ") || "none"}`,
        ].join("\n"));
      }
      return status.installed ? 0 : 1;
    }

    if (command === "install") {
      const addonName = rest[0];
      if (!addonName) throw new Error("Install needs an addon name");
      const result = await installProjectAddon({
        repoRoot: options.repoRoot,
        paths: options.paths,
        addonName,
        backupRoot,
      });
      options.writeOut(`Installed ${result.addonName}. Backup: ${result.backupPath ?? "not needed"}`);
      return 0;
    }

    if (command === "restore") {
      const [addonName, backupPath] = rest;
      if (!addonName || !backupPath) throw new Error("Restore needs an addon name and backup path");
      const result = await restoreAddonBackup({
        paths: options.paths,
        addonName,
        backupPath,
        backupRoot,
      });
      options.writeOut(`Restored ${result.addonName}. Previous copy: ${result.backupPath ?? "not present"}`);
      return 0;
    }

    options.writeError(HELP);
    return 1;
  } catch (error) {
    options.writeError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
  const exitCode = await runCli(process.argv.slice(2), {
    paths: resolveWowPaths(),
    repoRoot,
    writeOut: console.log,
    writeError: console.error,
  });
  process.exitCode = exitCode;
}
