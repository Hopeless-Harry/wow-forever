import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { createAccessToken } from "../src/data/google-auth.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });

test("exchanges a short-lived read-only Sheets JWT", async () => {
  let request;
  const token = await createAccessToken(
    { googleClientEmail: "reader@example.test", googlePrivateKey: privateKeyPem },
    async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ access_token: "access-token", expires_in: 3600 }) };
    },
    () => new Date("2026-09-22T12:00:00.000Z")
  );

  assert.equal(token, "access-token");
  assert.equal(request.url, "https://oauth2.googleapis.com/token");
  const assertion = new URLSearchParams(request.options.body).get("assertion");
  const payload = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));
  assert.equal(payload.iss, "reader@example.test");
  assert.equal(payload.scope, "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.equal(payload.exp - payload.iat, 3600);
});

test("rejects missing credentials before making a request", async () => {
  await assert.rejects(createAccessToken({}, async () => assert.fail("fetch called")), /credentials are incomplete/i);
});

test("reports token exchange failure without response secrets", async () => {
  await assert.rejects(
    createAccessToken(
      { googleClientEmail: "reader@example.test", googlePrivateKey: privateKeyPem },
      async () => ({ ok: false, status: 401, json: async () => ({ error_description: "private upstream detail" }) })
    ),
    (error) => error.message === "Google token exchange failed with status 401"
  );
});
