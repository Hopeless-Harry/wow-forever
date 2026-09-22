import path from "node:path";

export const DEFAULT_CLIENT_ROOT = String.raw`C:\Program Files (x86)\World of Warcraft\_classic_beta_`;

export interface WowPaths {
  clientRoot: string;
  executable: string;
  flavorInfo: string;
  buildInfo: string;
  addons: string;
  logs: string;
  wtf: string;
}

export function resolveWowPaths(
  clientRoot = process.env.WOW_FOREVER_ROOT ?? DEFAULT_CLIENT_ROOT,
): WowPaths {
  const root = path.resolve(clientRoot);
  return {
    clientRoot: root,
    executable: path.join(root, "WowB.exe"),
    flavorInfo: path.join(root, ".flavor.info"),
    buildInfo: path.join(root, "..", ".build.info"),
    addons: path.join(root, "Interface", "AddOns"),
    logs: path.join(root, "Logs"),
    wtf: path.join(root, "WTF"),
  };
}

