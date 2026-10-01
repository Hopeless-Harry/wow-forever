import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Self-update from the hub only (never from the internet). The hub lists the companion's files with SHA-256 sums; the
// companion downloads every file first, verifies each sum, and only then replaces its own files.
const NAME = /^(package\.json|src\/[a-z0-9_-]+\.js)$/;

const parts = (v) => String(v).split('.').map((n) => Number.parseInt(n, 10) || 0);
export function isNewer(candidate, current) {
  const a = parts(candidate), b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); }
  return false;
}

// Returns { updated, version }. Throws when a download fails or a checksum does not match; nothing is replaced then.
export async function updateFromHub({ hubUrl, key, appDir, fetchImpl = fetch }) {
  const hub = hubUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${key}` };
  const current = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')).version;
  const response = await fetchImpl(`${hub}/api/companion/manifest`, { headers });
  if (response.status === 404) return { updated: false, version: current };
  if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
  const manifest = await response.json();
  if (!manifest || !isNewer(manifest.version, current)) return { updated: false, version: current };
  if (!Array.isArray(manifest.files) || manifest.files.length > 40 || !manifest.files.some((f) => f.name === 'package.json')) throw new Error('bad manifest');
  // Validate every entry before downloading anything.
  for (const file of manifest.files) {
    if (!file || !NAME.test(String(file.name)) || !/^[0-9a-f]{64}$/.test(String(file.sha256))) throw new Error(`refusing file ${String(file?.name).slice(0, 40)}`);
  }
  const staged = [];
  for (const file of manifest.files) {
    const r = await fetchImpl(`${hub}/api/companion/file?name=${encodeURIComponent(file.name)}`, { headers });
    if (!r.ok) throw new Error(`download of ${file.name} failed (${r.status})`);
    const body = Buffer.from(await r.arrayBuffer());
    if (createHash('sha256').update(body).digest('hex') !== file.sha256) throw new Error(`checksum mismatch for ${file.name}`);
    staged.push({ name: file.name, body });
  }
  for (const { name, body } of staged) {
    const target = join(appDir, name);
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.new`; writeFileSync(tmp, body); renameSync(tmp, target);
  }
  return { updated: true, version: manifest.version };
}
