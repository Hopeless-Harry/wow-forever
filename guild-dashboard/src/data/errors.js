// Turns a refresh failure into a category an officer can act on. Messages come
// from our own code, never from response bodies, so nothing private can leak.
export function classifyError(error) {
  const message = String(error?.message ?? "");
  if (/Missing required sheet header|Duplicate sheet header|must include a header row/.test(message)) return "mapping";
  if (/Sheets request failed with status (401|403|404)/.test(message)) return "access";
  if (/credentials are incomplete|Sheet ID and range are required|token exchange failed|access token/.test(message)) return "credentials";
  return "unreachable";
}

export const ERROR_COPY = Object.freeze({
  mapping: "The Form's questions changed — showing the last safe copy",
  access: "Google refused access to the Sheet — showing the last safe copy",
  credentials: "Google credentials need attention — showing the last safe copy",
  unreachable: "Google is unreachable — showing the last safe copy"
});
