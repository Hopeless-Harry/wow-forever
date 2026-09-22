import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("environment template binds locally and documents the two-minute refresh", async () => {
  const env = await read(".env.example");
  assert.match(env, /^HOST=127\.0\.0\.1$/m);
  assert.match(env, /^REFRESH_SECONDS=120$/m);
  assert.match(env, /^GOOGLE_SHEET_ID=$/m);
  assert.match(env, /^GOOGLE_PRIVATE_KEY=$/m);
  assert.doesNotMatch(env, /BEGIN PRIVATE KEY/);
});

test("systemd service is unprivileged, restartable, and hardened", async () => {
  const unit = await read("config/guild-ledger.service");
  assert.match(unit, /^User=guild-ledger$/m);
  assert.match(unit, /^Restart=on-failure$/m);
  assert.match(unit, /^NoNewPrivileges=true$/m);
  assert.match(unit, /^ProtectSystem=strict$/m);
  assert.match(unit, /^ReadWritePaths=\/var\/lib\/guild-ledger$/m);
  assert.doesNotMatch(unit, /^User=root$/m);
});

test("setup and update scripts use locked installs and verify before restart", async () => {
  const setup = await read("scripts/setup.sh");
  const update = await read("scripts/update.sh");
  assert.match(setup, /npm ci --omit=dev/);
  assert.match(setup, /systemctl enable --now guild-ledger/);
  assert.match(update, /npm ci --omit=dev/);
  assert.ok(update.indexOf("npm test") < update.indexOf("systemctl restart guild-ledger"));
  assert.match(update, /^set -euo pipefail$/m);
});

test("README contains every requested operating section", async () => {
  const readme = await read("README.md");
  for (const heading of [
    "What it does", "Architecture", "Raspberry Pi requirements", "Installation",
    "Google authentication setup", "Connecting the Form response Sheet", "Environment variables",
    "Running locally", "Running on Raspberry Pi", "systemd setup", "Cloudflare Tunnel setup",
    "Updating the application", "Troubleshooting", "Privacy behaviour"
  ]) assert.match(readme, new RegExp(`^## ${heading}$`, "m"), heading);
});

test("Cloudflare example proxies only the local guild service", async () => {
  const config = await read("config/cloudflared.yml.example");
  assert.match(config, /service: http:\/\/127\.0\.0\.1:3000/);
  assert.match(config, /service: http_status:404/);
});
