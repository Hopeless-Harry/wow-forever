import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseLuaFile, toLua } from './lua.js';
import { buildPayload, selectDelta } from './payload.js';

const MAX_FILE = 64 * 1024 * 1024;
const INBOX_TOC = `## Interface: 120100, 120105, 16001
## Title: Moms Against Magic Chronicles Inbox
## Notes: Commands from the guild hub for the Chronicles gateway. Written by the companion app; do not edit.
## Author: Moms Against Magic
## Version: 1
Inbox.lua
`;

// <wowRoot> is a client folder such as ".../World of Warcraft/_retail_".
export function findSavedVariables(roots) {
  const found = [];
  for (const root of roots) {
    const accounts = join(root, 'WTF', 'Account');
    if (!existsSync(accounts)) continue;
    for (const account of readdirSync(accounts)) {
      const file = join(accounts, account, 'SavedVariables', 'MAMChronicles.lua');
      if (existsSync(file)) found.push({ file, root, mtimeMs: statSync(file).mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function loadState(path) {
  try { const s = JSON.parse(readFileSync(path, 'utf8')); return { lastWrittenAt: 0, memberHashes: {}, inboxes: {}, ...s }; } catch { return { lastWrittenAt: 0, memberHashes: {}, inboxes: {} }; }
}
export function saveState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`; writeFileSync(tmp, JSON.stringify(state, null, 1)); renameSync(tmp, path);
}

// Writes MAMChroniclesInbox/Inbox.lua (and its TOC) only when the content changed. Returns true when it wrote.
export function writeInbox(root, commands, now) {
  const addons = join(root, 'Interface', 'AddOns');
  if (!existsSync(addons)) return false;
  const dir = join(addons, 'MAMChroniclesInbox');
  mkdirSync(dir, { recursive: true });
  const body = `-- Written by the Moms Against Magic hub companion. Do not edit.\nMAMChroniclesInbox = ${toLua({ version: 1, writtenAt: Math.floor(now / 1000), commands })}\n`;
  const file = join(dir, 'Inbox.lua');
  // writtenAt changes every time, so compare without it.
  const stable = (text) => text.replace(/writtenAt = \d+,/, '');
  let old = ''; try { old = readFileSync(file, 'utf8'); } catch { /* new file */ }
  if (stable(old) === stable(body)) return false;
  const toc = join(dir, 'MAMChroniclesInbox.toc');
  if (!existsSync(toc)) writeFileSync(toc, INBOX_TOC);
  const tmp = `${file}.tmp`; writeFileSync(tmp, body); renameSync(tmp, file);
  return true;
}

// One pass: read the newest SavedVariables, upload what changed, fetch commands, write the inbox.
export async function syncOnce({ config, state, fetchImpl = fetch, now = Date.now(), log = () => {} }) {
  const result = { uploaded: 0, members: 0, commands: 0, inbox: false, note: '' };
  const hub = config.hubUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${config.key}` };
  let lastCommandId = state.lastCommandId ?? 0;

  const files = findSavedVariables(config.wowRoots);
  if (!files.length) result.note = 'no MAMChronicles SavedVariables file found';
  else {
    const newest = files[0];
    if (now - newest.mtimeMs < (config.settleMs ?? 3000)) { result.note = 'the file was just written, waiting'; }
    else if (statSync(newest.file).size > MAX_FILE) result.note = 'SavedVariables file is too large';
    else {
      const payload = buildPayload(parseLuaFile(readFileSync(newest.file, 'utf8'), ['MAMChroniclesDB']));
      if (!payload) result.note = 'no gateway data yet (turn on gateway mode and use Sync now in game)';
      else {
        lastCommandId = payload.lastCommandId;
        const delta = selectDelta(payload, state);
        if (payload.writtenAt !== state.lastWrittenAt || delta.changed > 0) {
          const response = await fetchImpl(`${hub}/api/ingest`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(delta.body) });
          if (!response.ok) throw new Error(`hub rejected the upload (${response.status})`);
          state.lastWrittenAt = payload.writtenAt; state.memberHashes = delta.hashes;
          result.uploaded = 1; result.members = delta.changed;
          log(`uploaded ${delta.changed} changed members, ${Object.keys(delta.body.locations).length} locations`);
        } else result.note = 'nothing new to upload';
      }
    }
  }

  const response = await fetchImpl(`${hub}/api/commands?after=${lastCommandId}`, { headers });
  if (!response.ok) throw new Error(`hub refused the command request (${response.status})`);
  const { commands } = await response.json();
  if (Array.isArray(commands)) {
    result.commands = commands.length;
    for (const root of config.wowRoots) { if (writeInbox(root, commands, now)) { result.inbox = true; log(`inbox updated in ${root} (${commands.length} commands)`); } }
  }
  state.lastCommandId = lastCommandId;
  return result;
}
