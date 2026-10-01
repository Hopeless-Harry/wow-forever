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

test("every data path the service writes lives inside the one writable directory", async () => {
  const unit = await read("config/guild-ledger.service");
  const writable = unit.match(/^ReadWritePaths=(\S+)$/m)[1];
  const paths = [...unit.matchAll(/^Environment=([A-Z_]+_PATH)=(\S+)$/gm)];
  const names = paths.map((match) => match[1]);
  assert.ok(names.includes("CACHE_PATH") && names.includes("MEMBER_PATH"), `unit sets ${names.join(", ")}`);
  for (const [, name, value] of paths) assert.ok(value.startsWith(`${writable}/`), `${name}=${value} is outside ${writable}`);

  const env = await read(".env.example");
  for (const [, name, value] of env.matchAll(/^([A-Z_]+_PATH)=(\S+)$/gm)) assert.ok(value.startsWith(`${writable}/`), `.env.example ${name}=${value}`);
});

test("setup and update both deploy the scripts folder, and update reinstalls a changed service file before restarting", async () => {
  const setup = await read("scripts/setup.sh");
  const update = await read("scripts/update.sh");
  assert.match(setup, /"\$\{PROJECT_DIR\}\/scripts"/);
  assert.match(update, /cp -R src public config test scripts/);

  const compare = update.indexOf("cmp -s");
  assert.ok(compare > 0, "update compares the installed unit with the repository copy");
  assert.ok(update.indexOf("install -o root -g root -m 0644", compare) > compare);
  assert.ok(update.indexOf("systemctl daemon-reload", compare) > compare);
  assert.ok(update.indexOf("daemon-reload") < update.indexOf("systemctl restart guild-ledger"), "reload happens before the restart");
});

test("the erase-member command in the README points at a script the installers actually deploy", async () => {
  const readme = await read("README.md");
  const command = readme.match(/node (\/opt\/guild-ledger\/app\/scripts\/forget-member\.mjs)/);
  assert.ok(command, "README documents the production command");
  const setup = await read("scripts/setup.sh");
  assert.match(setup, /scripts/);
  await readFile(path.join(root, "scripts/forget-member.mjs"), "utf8");
});
