import Fastify from "fastify";

import { renderDashboard, renderResponses, renderStatistics } from "./views/render.js";

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

function publicPayload(snapshot) {
  return {
    records: snapshot.records,
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

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderDashboard(dataService.snapshot())));
  app.get("/responses", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderResponses(dataService.snapshot())));
  app.get("/statistics", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderStatistics(dataService.snapshot())));
  app.get("/api/public-data", async (_request, reply) => reply.header("cache-control", "no-store").send(publicPayload(dataService.snapshot())));
  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async (_request, reply) => {
    const snapshot = dataService.snapshot();
    return reply.code(snapshot.status === "empty" ? 503 : 200).send({ ready: snapshot.status !== "empty", dataStatus: snapshot.status });
  });

  return app;
}
