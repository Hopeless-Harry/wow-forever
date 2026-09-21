import { randomUUID } from "node:crypto";
import { access, cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import type { WowPaths } from "./config.js";

export interface AddonOperationResult {
  action: "installed" | "restored";
  addonName: string;
  targetPath: string;
  backupPath: string | null;
  affectedPaths: string[];
}

interface InstallRequest {
  repoRoot: string;
  paths: WowPaths;
  addonName: string;
  backupRoot?: string;
  timestamp?: string;
}

interface RestoreRequest {
  paths: WowPaths;
  addonName: string;
  backupPath: string;
  backupRoot: string;
  timestamp?: string;
}

function validateAddonName(addonName: string): void {
  if (!/^[A-Za-z0-9_-]+$/u.test(addonName)) throw new Error(`Invalid addon name: ${addonName}`);
  if (addonName.toLowerCase() === "auctionator") throw new Error("Auctionator is protected and cannot be changed");
}

function assertInside(root: string, candidate: string, label: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) return;
  throw new Error(`${label} escapes its approved root`);
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function safeTimestamp(value = new Date().toISOString()): string {
  return value.replace(/[^0-9A-Za-z-]/gu, "-");
}

async function replaceFromSource(source: string, target: string, backupPath: string | null): Promise<void> {
  const staging = path.join(path.dirname(target), `.${path.basename(target)}.installing-${randomUUID()}`);
  await cp(source, staging, { recursive: true, errorOnExist: true });
  try {
    if (await exists(target)) await rm(target, { recursive: true, force: false });
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (!(await exists(target)) && backupPath) await cp(backupPath, target, { recursive: true });
    throw error;
  }
}

export async function installProjectAddon(request: InstallRequest): Promise<AddonOperationResult> {
  validateAddonName(request.addonName);
  const projectAddons = path.resolve(request.repoRoot, "addons");
  const source = path.resolve(projectAddons, request.addonName);
  assertInside(projectAddons, source, "Addon source");
  const toc = path.join(source, `${request.addonName}.toc`);
  if (!(await exists(toc))) throw new Error(`Addon source requires a matching TOC: ${toc}`);

  await mkdir(request.paths.addons, { recursive: true });
  const target = path.resolve(request.paths.addons, request.addonName);
  assertInside(request.paths.addons, target, "Addon target");
  const backupRoot = path.resolve(request.backupRoot ?? path.join(request.repoRoot, "backups", "addons"));
  await mkdir(backupRoot, { recursive: true });

  let backupPath: string | null = null;
  if (await exists(target)) {
    backupPath = path.join(backupRoot, `${safeTimestamp(request.timestamp)}-${request.addonName}`);
    assertInside(backupRoot, backupPath, "Backup");
    if (await exists(backupPath)) throw new Error(`Backup already exists: ${backupPath}`);
    await cp(target, backupPath, { recursive: true, errorOnExist: true });
  }
  await replaceFromSource(source, target, backupPath);
  return {
    action: "installed",
    addonName: request.addonName,
    targetPath: target,
    backupPath,
    affectedPaths: backupPath ? [backupPath, target] : [target],
  };
}

export async function restoreAddonBackup(request: RestoreRequest): Promise<AddonOperationResult> {
  validateAddonName(request.addonName);
  const backupRoot = path.resolve(request.backupRoot);
  const sourceBackup = path.resolve(request.backupPath);
  assertInside(backupRoot, sourceBackup, "Selected backup");
  if (!(await exists(sourceBackup))) throw new Error(`Backup does not exist: ${sourceBackup}`);
  const target = path.resolve(request.paths.addons, request.addonName);
  assertInside(request.paths.addons, target, "Addon target");
  await mkdir(request.paths.addons, { recursive: true });

  let currentBackup: string | null = null;
  if (await exists(target)) {
    currentBackup = path.join(
      backupRoot,
      `${safeTimestamp(request.timestamp)}-${request.addonName}-before-restore`,
    );
    if (await exists(currentBackup)) throw new Error(`Backup already exists: ${currentBackup}`);
    await cp(target, currentBackup, { recursive: true, errorOnExist: true });
  }
  await replaceFromSource(sourceBackup, target, currentBackup);
  return {
    action: "restored",
    addonName: request.addonName,
    targetPath: target,
    backupPath: currentBackup,
    affectedPaths: currentBackup ? [currentBackup, target] : [target],
  };
}

