const DEFAULT_MAPPING = Object.freeze({
  server: "What server should Moms be on?",
  race: "What race will your main be?",
  characterClass: "What class will your main be?",
  role: "What will your main role be?",
  profession1: "Profession 1",
  profession2: "Profession 2"
});

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
    host: env.HOST || "127.0.0.1",
    port: integerSetting(env.PORT, 3000, "PORT"),
    refreshMs: integerSetting(env.REFRESH_SECONDS, 120, "REFRESH_SECONDS") * 1000,
    staleAfterMs: integerSetting(env.STALE_AFTER_SECONDS, 600, "STALE_AFTER_SECONDS") * 1000,
    sheetId: env.GOOGLE_SHEET_ID || "",
    sheetRange: env.GOOGLE_SHEET_RANGE || "Form Responses 1!A:Z",
    googleClientEmail: env.GOOGLE_CLIENT_EMAIL || "",
    googlePrivateKey: (env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    cachePath: env.CACHE_PATH || new URL("../data/cache.json", import.meta.url).pathname,
    chroniclePath: env.CHRONICLE_PATH || new URL("../data/chronicle.json", import.meta.url).pathname,
    mapping: { ...DEFAULT_MAPPING },
    useFixture: env.USE_FIXTURE === "true" || env.NODE_ENV === "test"
  };
}
