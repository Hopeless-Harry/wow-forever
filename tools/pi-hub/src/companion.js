import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Serves the companion app's own files so it can update itself from the hub. Only package.json and src/*.js are offered.
const NAME = /^(package\.json|src\/[a-z0-9_-]+\.js)$/;

export function companionFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  const names = ['package.json', ...(existsSync(join(dir, 'src')) ? readdirSync(join(dir, 'src')).filter((f) => /^[a-z0-9_-]+\.js$/.test(f)).map((f) => `src/${f}`) : [])];
  return names.filter((n) => NAME.test(n) && existsSync(join(dir, n))).sort();
}

export function companionManifest(dir) {
  const files = companionFiles(dir);
  if (!files.includes('package.json')) return null;
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  return { version, files: files.map((name) => { const body = readFileSync(join(dir, name)); return { name, size: body.length, sha256: createHash('sha256').update(body).digest('hex') }; }) };
}

export function companionFile(dir, name) {
  if (typeof name !== 'string' || !NAME.test(name) || !companionFiles(dir).includes(name)) return null;
  return readFileSync(join(dir, name));
}
