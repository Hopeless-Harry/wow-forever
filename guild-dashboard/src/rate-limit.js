const MAX_TRACKED = 10_000;

// Fixed-window per-key counter. Memory is bounded: expired windows are pruned
// once the table grows, so a flood of distinct addresses cannot exhaust RAM.
export function createRateLimiter({ limit, windowMs = 60_000, now = () => Date.now() }) {
  const windows = new Map();

  function prune(current) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= current) windows.delete(key);
    }
    if (windows.size >= MAX_TRACKED) windows.clear();
  }

  return {
    hit(key) {
      if (!limit) return { allowed: true, retryAfter: 0 };
      const current = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= current) {
        if (windows.size >= MAX_TRACKED) prune(current);
        entry = { count: 0, resetAt: current + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)) };
    },
    size: () => windows.size
  };
}
