import { ChronicleStore } from "./data/chronicle-store.js";
import { CacheStore } from "./data/cache-store.js";
import { DataService } from "./data/data-service.js";
import { createAccessToken } from "./data/google-auth.js";
import { SheetSource } from "./data/sheet-source.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { normalizeRows } from "./domain/normalize.js";

const config = loadConfig();
const cacheStore = new CacheStore(config.cachePath, config.staleAfterMs);

const fixtureRows = [
  Object.values(config.mapping),
  ["Normal", "Undead", "Priest", "Healer", "Tailoring", "Enchanting"],
  ["Happy with either", "Troll", "Hunter", "DPS", "Skinning", "Leatherworking"],
  ["Normal", "Tauren", "Warrior", "Flexible / happy to fill", "Mining", "Blacksmithing"]
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
  chronicleStore: new ChronicleStore(config.chroniclePath),
  refreshMs: config.refreshMs
});

await dataService.start();
const app = buildApp({ dataService });

const shutdown = async () => {
  dataService.stop();
  await app.close();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: config.host, port: config.port });
