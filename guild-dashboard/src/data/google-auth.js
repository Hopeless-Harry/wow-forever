import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function createAccessToken(config, fetchFn = fetch, now = () => new Date(), timeoutMs = 15_000) {
  if (!config.googleClientEmail || !config.googlePrivateKey) {
    throw new Error("Google service account credentials are incomplete");
  }
  const issuedAt = Math.floor(now().getTime() / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const payload = encodeJson({
    iss: config.googleClientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(config.googlePrivateKey).toString("base64url")}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Google token exchange failed with status ${response.status}`);
  const result = await response.json();
  if (!result.access_token) throw new Error("Google token response did not contain an access token");
  return result.access_token;
}
