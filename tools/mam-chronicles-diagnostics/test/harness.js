import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(here, '..', '..', '..');
export const addonRoot = resolve(repositoryRoot, 'addons', 'MAMChroniclesDiagnostics');
export const addonPath = (...parts) => resolve(addonRoot, ...parts);
export const readAddonFile = (name) => readFileSync(addonPath(name), 'utf8');

export function createWowHarness() {
  throw new Error('Lua harness is introduced with the first behavioral test');
}
