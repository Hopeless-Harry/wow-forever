import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "guild_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

const digest = (value) => createHash("sha256").update(String(value)).digest();

export function createAuth({ passcode, now = () => Date.now() }) {
  const secret = randomBytes(32);
  const failures = new Map();
  const sign = (payload) => createHmac("sha256", secret).update(payload).digest("hex");

  function locked(ip) {
    const entry = failures.get(ip);
    return Boolean(entry && entry.until > now());
  }

  return {
    cookieName: COOKIE,
    sessionSeconds: SESSION_MS / 1000,
    locked,
    attempt(ip, candidate) {
      if (locked(ip)) return null;
      if (timingSafeEqual(digest(candidate), digest(passcode))) {
        failures.delete(ip);
        const expires = String(now() + SESSION_MS);
        return `${expires}.${sign(expires)}`;
      }
      const entry = failures.get(ip) || { count: 0, until: 0 };
      entry.count += 1;
      if (entry.count >= MAX_FAILURES) Object.assign(entry, { count: 0, until: now() + LOCK_MS });
      failures.set(ip, entry);
      return null;
    },
    verify(token) {
      if (typeof token !== "string") return false;
      const [expires, signature] = token.split(".");
      if (!expires || !signature || Number(expires) <= now()) return false;
      const expected = Buffer.from(sign(expires));
      const given = Buffer.from(signature);
      return expected.length === given.length && timingSafeEqual(expected, given);
    }
  };
}

export function readCookie(header, name) {
  for (const part of String(header || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
