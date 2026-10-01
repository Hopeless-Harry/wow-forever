import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("uses safe Pi-friendly defaults", () => {
  const config = loadConfig({ NODE_ENV: "test" });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3000);
  assert.equal(config.refreshMs, 120_000);
  assert.equal(config.sheetRange, "Form Responses 1!A:Z");
});

test("normalizes escaped newlines in service account keys", () => {
  const config = loadConfig({ GOOGLE_PRIVATE_KEY: "line1\\nline2" });
  assert.equal(config.googlePrivateKey, "line1\nline2");
});

test("rejects invalid numeric settings", () => {
  assert.throws(() => loadConfig({ PORT: "invalid" }), /PORT must be an integer/);
  assert.throws(() => loadConfig({ REFRESH_SECONDS: "0" }), /REFRESH_SECONDS/);
});

test("members passcode is optional but must be long enough", () => {
  assert.equal(loadConfig({}).guildPasscode, "");
  assert.equal(loadConfig({ GUILD_PASSCODE: "long enough" }).guildPasscode, "long enough");
  assert.throws(() => loadConfig({ GUILD_PASSCODE: "short" }), /GUILD_PASSCODE/);
});
