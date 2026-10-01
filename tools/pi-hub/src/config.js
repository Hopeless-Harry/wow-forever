import { resolve } from 'node:path';

// Environment configuration. Defaults suit a home LAN: private networks only, plain HTTP.
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8080,
    host: env.HOST || '0.0.0.0',
    dbPath: resolve(env.DB_PATH || 'data/pi-hub.sqlite'),
    backupDir: resolve(env.BACKUP_DIR || 'data/backups'),
    // Requests from addresses outside private networks are refused unless this is set. Do not set it without approval.
    allowPublic: env.ALLOW_PUBLIC === 'true',
    // Set true only when the hub is served over HTTPS (for example behind Tailscale or a tunnel later).
    secureCookies: env.SECURE_COOKIES === 'true',
  };
}
