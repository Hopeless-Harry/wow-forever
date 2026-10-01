const MAX_TRACKED = 10_000;

export function isLoopback(address) {
  return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
}

function expandIpv6(address) {
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = address.includes("::") ? Array(Math.max(0, 8 - left.length - right.length)).fill("0") : [];
  return [...left, ...fill, ...right].map((group) => group.padStart(4, "0"));
}

// IPv6 users control a whole /64, so they are counted as one client.
export function limiterKey(address) {
  const value = String(address).trim().toLowerCase();
  if (value.startsWith("::ffff:") && value.includes(".")) return value.slice(7);
  if (!value.includes(":")) return value;
  return `${expandIpv6(value.split("%")[0]).slice(0, 4).join(":")}::/64`;
}

// Fixed-window per-key counter. The table is bounded: expired windows go first,
// then the oldest windows, so a flood of distinct keys cannot reset everyone else's count.
export function createRateLimiter({ limit, windowMs = 60_000, now = () => Date.now() }) {
  const windows = new Map();

  function makeRoom(current) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= current) windows.delete(key);
    }
    let excess = windows.size - MAX_TRACKED + Math.ceil(MAX_TRACKED / 10);
    for (const key of windows.keys()) {
      if (excess <= 0) break;
      windows.delete(key);
      excess -= 1;
    }
  }

  return {
    hit(key) {
      if (!limit) return { allowed: true, retryAfter: 0 };
      const current = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= current) {
        if (!entry && windows.size >= MAX_TRACKED) makeRoom(current);
        windows.delete(key);
        entry = { count: 0, resetAt: current + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)) };
    },
    size: () => windows.size
  };
}
