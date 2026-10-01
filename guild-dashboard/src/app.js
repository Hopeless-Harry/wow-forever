import Fastify from "fastify";
import { readFileSync } from "node:fs";

import { membersToCsv } from "./domain/export.js";
import { createRateLimiter, isLoopback, limiterKey } from "./rate-limit.js";
import { RAID_SIZES, rulesetOptions } from "./domain/wow-data.js";
import { PUBLIC_FIELDS } from "./domain/normalize.js";
import { renderDashboard, renderMemberChronicle, renderMemberProfile, renderMembers, renderProfessions, renderRaidPlan, renderResponses, renderStatistics } from "./views/render.js";

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

export function buildApp({ dataService, rateLimitPerMinute = 300, logger = true }) {
  const app = Fastify({ logger, bodyLimit: 16 * 1024, trustProxy: false, routerOptions: { ignoreTrailingSlash: true, caseSensitive: false } });

  app.addHook("onRequest", async (request, reply) => {
    reply.headers({
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "cross-origin-opener-policy": "same-origin"
    });
    // Pages and downloads can carry names, so no cache may keep them after a row is removed.
    // The assets route overrides this with its own public cache header.
    if (!request.url.startsWith("/assets/")) reply.header("cache-control", "no-store");
  });

  // X-Forwarded-For is client-controlled, so it cannot key a limiter. Cloudflare sets
  // CF-Connecting-IP itself; the service only listens on loopback, so only the tunnel
  // can reach it. Without the header, fall back to the socket address.
  const clientKey = (request) => {
    const peer = request.socket.remoteAddress || "unknown";
    const header = request.headers["cf-connecting-ip"];
    const fromTunnel = isLoopback(peer) && typeof header === "string" && header.length > 0;
    return limiterKey(fromTunnel ? header.slice(0, 64) : peer);
  };
  const limiter = createRateLimiter({ limit: rateLimitPerMinute });
  app.addHook("onRequest", async (request, reply) => {
    const pathOnly = request.url.split("?")[0];
    if (pathOnly === "/health/live" || pathOnly === "/health/ready") return;
    const { allowed, retryAfter } = limiter.hit(clientKey(request));
    if (!allowed) {
      return reply.code(429).header("retry-after", String(retryAfter)).header("cache-control", "no-store").type("text/plain; charset=utf-8").send("Too many requests. Please slow down.");
    }
  });

  const html = (reply) => reply.type("text/html; charset=utf-8");
  const memberPage = (render) => async (_request, reply) => html(reply).send(render(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [], events: [] }));

  app.get("/members/professions", memberPage(renderProfessions));
  app.get("/raid", async (request, reply) => {
    const requested = Number(request.query?.size);
    const size = RAID_SIZES.includes(requested) ? requested : 40;
    const snapshot = dataService.snapshot();
    const memberData = dataService.memberSnapshot?.() ?? { members: [] };
    const asked = String(request.query?.ruleset ?? "");
    const ruleset = rulesetOptions([...snapshot.records, ...memberData.members]).find((option) => option.toLowerCase() === asked.toLowerCase()) ?? "";
    return html(reply).send(renderRaidPlan(snapshot, size, memberData, ruleset));
  });
  app.get("/members.csv", async (_request, reply) => {
    const members = dataService.memberSnapshot?.().members ?? [];
    return reply.type("text/csv; charset=utf-8").header("content-disposition", 'attachment; filename="guild-roster.csv"').send(membersToCsv(members));
  });
  app.get("/member", async (request, reply) => {
    const name = String(request.query?.name ?? "").slice(0, 200);
    const memberData = dataService.memberSnapshot?.() ?? { members: [], events: [] };
    const found = memberData.members.some((entry) => entry.name.toLowerCase() === name.toLowerCase());
    return html(reply).code(found ? 200 : 404).send(renderMemberProfile(dataService.snapshot(), memberData, name));
  });
  app.get("/members", memberPage(renderMembers));
  app.get("/members/chronicle", memberPage(renderMemberChronicle));

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderDashboard(dataService.snapshot(), dataService.memberSnapshot?.() ?? { events: [] })));
  app.get("/responses", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderResponses(dataService.snapshot())));
  app.get("/statistics", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderStatistics(dataService.snapshot())));
  app.get("/assets/:name", async (request, reply) => {
    const asset = ASSETS.get(String(request.params.name).toLowerCase());
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
