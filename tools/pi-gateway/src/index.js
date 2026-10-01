import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { syncOnce, loadState, saveState } from './sync.js';
import { updateFromHub } from './updater.js';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESTART_CODE = 75; // run.cmd starts the companion again after an update

export function loadConfig(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const problems = [];
  if (!/^https?:\/\/[^\s/]+/.test(raw.hubUrl ?? '')) problems.push('hubUrl must look like http://192.168.1.50:8080');
  if (!/^[0-9a-f]{64}$/.test(raw.key ?? '')) problems.push('key must be the 64 character upload key from "add-source" on the Pi');
  if (!Array.isArray(raw.wowRoots) || !raw.wowRoots.length) problems.push('wowRoots must list at least one WoW client folder, for example "C:/Program Files (x86)/World of Warcraft/_retail_"');
  if (problems.length) throw new Error(`Bad config:\n- ${problems.join('\n- ')}`);
  return { pollSeconds: 60, settleMs: 3000, autoUpdate: true, updateEveryHours: 6, ...raw };
}

async function main() {
  const args = process.argv.slice(2);
  const once = args.includes('--once');
  const configPath = resolve(args.find((a) => !a.startsWith('--')) ?? resolve(appDir, 'config.json'));
  const config = loadConfig(configPath);
  const statePath = resolve(appDir, 'state.json');
  const state = loadState(statePath);
  const log = (message) => console.log(`${new Date().toISOString()} ${message}`);
  let lastUpdateCheck = 0;
  log(`companion started, hub ${config.hubUrl}, watching ${config.wowRoots.length} client folder(s)`);

  for (;;) {
    try {
      const result = await syncOnce({ config, state, log });
      if (result.note) log(result.note);
      saveState(statePath, state);
    } catch (error) {
      log(`sync failed: ${error.message}. Will retry.`);
    }
    if (config.autoUpdate && Date.now() - lastUpdateCheck > config.updateEveryHours * 3600_000) {
      lastUpdateCheck = Date.now();
      try {
        const update = await updateFromHub({ hubUrl: config.hubUrl, key: config.key, appDir });
        if (update.updated) { log(`updated to ${update.version}, restarting`); process.exit(RESTART_CODE); }
      } catch (error) { log(`update check failed: ${error.message}`); }
    }
    if (once) return;
    await new Promise((ok) => setTimeout(ok, config.pollSeconds * 1000));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
