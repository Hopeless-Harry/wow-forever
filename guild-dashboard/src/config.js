const DEFAULT_NAME_HEADER = "What is your BattleTag and name?";

const DEFAULT_MAPPING = Object.freeze({
  server: "What server should Moms be on?",
  race: "What race will your main be?",
  characterClass: "What class will your main be?",
  role: "What will your main role be?",
  profession1: "Profession 1",
  profession2: "Profession 2"
});

// The public sign-up Form address, shown as an "Add yourself" button. Optional; https only.
function formUrlSetting(value) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FORM_URL must be a full https:// address");
  }
  if (url.protocol !== "https:" || value.length > 300) throw new Error("FORM_URL must be a full https:// address");
  return url.toString();
}

function integerSetting(value, fallback, name, minimum = 1) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  if (parsed < minimum) throw new Error(`${name} must be at least ${minimum}`);
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || "production",
    formUrl: formUrlSetting(env.FORM_URL),
    host: env.HOST || "127.0.0.1",
    port: integerSetting(env.PORT, 3000, "PORT"),
    refreshMs: integerSetting(env.REFRESH_SECONDS, 120, "REFRESH_SECONDS") * 1000,
    staleAfterMs: integerSetting(env.STALE_AFTER_SECONDS, 600, "STALE_AFTER_SECONDS") * 1000,
    sheetId: env.GOOGLE_SHEET_ID || "",
    sheetRange: env.GOOGLE_SHEET_RANGE || "Form Responses 1!A:Z",
    googleClientEmail: env.GOOGLE_CLIENT_EMAIL || "",
    googlePrivateKey: (env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    cachePath: env.CACHE_PATH || new URL("../data/cache.json", import.meta.url).pathname,
    memberPath: env.MEMBER_PATH || new URL("../data/members.json", import.meta.url).pathname,
    nameHeader: DEFAULT_NAME_HEADER,
    rateLimitPerMinute: integerSetting(env.RATE_LIMIT_PER_MINUTE, 300, "RATE_LIMIT_PER_MINUTE", 0),
    mapping: { ...DEFAULT_MAPPING },
    useFixture: env.USE_FIXTURE === "true" || env.NODE_ENV === "test"
  };
}
