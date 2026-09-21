import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";

import type { WowPaths } from "./config.js";

const execFileAsync = promisify(execFile);

export interface ClientStatus {
  installed: boolean;
  running: boolean;
  product: string | null;
  version: string | null;
  interfaceVersion: number | null;
  gameMode: number | null;
  clientRoot: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseFlavor(text: string): string | null {
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines[1] ?? null;
}

function parseBuildVersion(text: string, product: string): string | null {
  const lines = text.split(/\r?\n/u).filter(Boolean);
  const header = lines[0]?.split("|").map((column) => column.split("!")[0]) ?? [];
  const productIndex = header.indexOf("Product");
  const versionIndex = header.indexOf("Version");
  if (productIndex < 0 || versionIndex < 0) return null;
  for (const line of lines.slice(1)) {
    const values = line.split("|");
    if (values[productIndex] === product) return values[versionIndex] ?? null;
  }
  return null;
}

function readWtfNumber(text: string, key: string): number | null {
  const match = text.match(new RegExp(`^SET\\s+${key}\\s+"(\\d+)"`, "mu"));
  return match?.[1] ? Number(match[1]) : null;
}

async function isWowRunning(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await execFileAsync("tasklist", ["/FI", "IMAGENAME eq WowB.exe", "/FO", "CSV", "/NH"], {
      windowsHide: true,
    });
    return stdout.toLowerCase().includes("wowb.exe");
  } catch {
    return false;
  }
}

export async function inspectClient(paths: WowPaths): Promise<ClientStatus> {
  const installed = await exists(paths.executable);
  if (!installed) {
    return {
      installed: false,
      running: false,
      product: null,
      version: null,
      interfaceVersion: null,
      gameMode: null,
      clientRoot: paths.clientRoot,
    };
  }

  const [flavorText, buildText, configText, running] = await Promise.all([
    readFile(paths.flavorInfo, "utf8").catch(() => ""),
    readFile(paths.buildInfo, "utf8").catch(() => ""),
    readFile(`${paths.wtf}\\Config.wtf`, "utf8").catch(() => ""),
    isWowRunning(),
  ]);
  const product = parseFlavor(flavorText);
  return {
    installed: true,
    running,
    product,
    version: product ? parseBuildVersion(buildText, product) : null,
    interfaceVersion: readWtfNumber(configText, "engineSurveyPatch"),
    gameMode: readWtfNumber(configText, "currentGameMode"),
    clientRoot: paths.clientRoot,
  };
}

