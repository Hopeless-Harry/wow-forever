import { MemberStore } from "./data/member-store.js";
import { CacheStore } from "./data/cache-store.js";
import { DataService } from "./data/data-service.js";
import { createAccessToken } from "./data/google-auth.js";
import { SheetSource } from "./data/sheet-source.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { normalizeMembers } from "./domain/members.js";
import { normalizeRows } from "./domain/normalize.js";

const config = loadConfig();
const cacheStore = new CacheStore(config.cachePath, config.staleAfterMs);

const fixtureRows = [
  [config.nameHeader, ...Object.values(config.mapping)],
  ["Fixture Priest", "Normal", "Undead", "Priest", "Healer", "Tailoring", "Enchanting"],
  ["Fixture Hunter", "Happy with either", "Troll", "Hunter", "DPS", "Skinning", "Leatherworking"],
  ["Fixture Warrior", "Normal", "Tauren", "Warrior", "Flexible / happy to fill", "Mining", "Blacksmithing"]
];

const source = config.useFixture
  ? { fetchRows: async () => fixtureRows }
  : new SheetSource({
      sheetId: config.sheetId,
      sheetRange: config.sheetRange,
      tokenProvider: () => createAccessToken(config)
    });

const dataService = new DataService({
  source,
  normalize: normalizeRows,
  mapping: config.mapping,
  cacheStore,
  memberStore: new MemberStore(config.memberPath),
  normalizeMembers,
  nameHeader: config.nameHeader,
  refreshMs: config.refreshMs
});

await dataService.start();
const app = buildApp({ dataService, rateLimitPerMinute: config.rateLimitPerMinute, formUrl: config.formUrl });

const shutdown = async () => {
  dataService.stop();
  await app.close();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: config.host, port: config.port });
