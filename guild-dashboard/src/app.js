import Fastify from "fastify";
import { readFileSync } from "node:fs";

import { RAID_SIZES } from "./domain/wow-data.js";
import { PUBLIC_FIELDS } from "./domain/normalize.js";
import { renderDashboard, renderMemberChronicle, renderMembers, renderProfessions, renderRaidPlan, renderResponses, renderStatistics } from "./views/render.js";

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const ASSETS = new Map([
  ["styles.css", { type: "text/css; charset=utf-8", body: readFileSync(new URL("../public/styles.css", import.meta.url), "utf8") }],
  ["table-filters.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/table-filters.js", import.meta.url), "utf8") }],
  ["countdown.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/countdown.js", import.meta.url), "utf8") }],
  ["live-refresh.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/live-refresh.js", import.meta.url), "utf8") }]
]);

function publicPayload(snapshot) {
  return {
    records: snapshot.records.map((record) => Object.fromEntries(
      PUBLIC_FIELDS.map((field) => [field, record[field]])
    )),
    stats: snapshot.stats,
    fetchedAt: snapshot.fetchedAt,
    status: snapshot.status,
    lastRefreshFailed: snapshot.lastRefreshFailed
  };
}

export function buildApp({ dataService, logger = true }) {
  const app = Fastify({ logger, bodyLimit: 16 * 1024, trustProxy: true });

  app.addHook("onRequest", async (_request, reply) => {
    reply.headers({
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "cross-origin-opener-policy": "same-origin"
    });
  });

  const html = (reply) => reply.type("text/html; charset=utf-8");
  const memberPage = (render) => async (_request, reply) => html(reply).send(render(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [], events: [] }));

  app.get("/members/professions", memberPage(renderProfessions));
  app.get("/raid", async (request, reply) => {
    const requested = Number(request.query?.size);
    const size = RAID_SIZES.includes(requested) ? requested : 40;
    return html(reply).send(renderRaidPlan(dataService.snapshot(), size, dataService.memberSnapshot?.() ?? { members: [] }));
  });
  app.get("/members", memberPage(renderMembers));
  app.get("/members/chronicle", memberPage(renderMemberChronicle));

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderDashboard(dataService.snapshot())));
  app.get("/responses", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderResponses(dataService.snapshot())));
  app.get("/statistics", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderStatistics(dataService.snapshot())));
  app.get("/assets/:name", async (request, reply) => {
    const asset = ASSETS.get(request.params.name);
    if (!asset) return reply.code(404).send({ error: "Not found" });
    return reply.header("cache-control", "public, max-age=3600").type(asset.type).send(asset.body);
  });
  app.get("/api/public-data", async (_request, reply) => reply.header("cache-control", "no-store").send(publicPayload(dataService.snapshot())));
  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async (_request, reply) => {
    const snapshot = dataService.snapshot();
    return reply.code(snapshot.status === "empty" ? 503 : 200).send({ ready: snapshot.status !== "empty", dataStatus: snapshot.status });
  });

  return app;
}
