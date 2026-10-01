import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt password hashes: "scrypt$<salt hex>$<hash hex>". No password is ever stored or logged in clear text.
const KEYLEN = 32;
const COST = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, KEYLEN, COST);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return Promise.resolve(false);
  const salt = Buffer.from(parts[1], 'hex'), expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== KEYLEN) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(String(password), salt, KEYLEN, COST, (error, derived) => resolve(!error && timingSafeEqual(derived, expected)));
  });
}

export const strongEnough = (password) => typeof password === 'string' && password.length >= 10 && password.length <= 200;

// Locks a login key (address plus name) out after repeated failures.
export class LoginLimiter {
  constructor({ max = 5, windowSec = 900, now = () => Math.floor(Date.now() / 1000) } = {}) { this.max = max; this.windowSec = windowSec; this.now = now; this.fails = new Map(); }
  recent(key) { const t = this.now(); const list = (this.fails.get(key) ?? []).filter((s) => t - s < this.windowSec); this.fails.set(key, list); return list; }
  blocked(key) { return this.recent(key).length >= this.max; }
  fail(key) {
    this.recent(key).push(this.now());
    if (this.fails.size > 2000) for (const k of this.fails.keys()) { if (!this.recent(k).length) this.fails.delete(k); }
  }
  reset(key) { this.fails.delete(key); }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// Private networks only (home LAN, loopback, link-local, Tailscale CGNAT). The hub is never meant to face the open internet.
export function isPrivateAddress(address) {
  let a = String(address ?? '').toLowerCase();
  if (a.startsWith('::ffff:')) a = a.slice(7);
  if (a === '::1' || a === 'localhost') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(a) || /^fe[89ab][0-9a-f]:/.test(a)) return true;
  const m = a.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [x, y] = [Number(m[1]), Number(m[2])];
  return x === 10 || x === 127 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 169 && y === 254) || (x === 100 && y >= 64 && y <= 127);
}
