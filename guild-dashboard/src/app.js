import Fastify from "fastify";
import { readFileSync } from "node:fs";

import { membersToCsv } from "./domain/export.js";
import { buildSummary } from "./domain/summary.js";
import { createRateLimiter, isLoopback, limiterKey } from "./rate-limit.js";
import { RAID_SIZES, rulesetOptions } from "./domain/wow-data.js";
import { PUBLIC_FIELDS } from "./domain/normalize.js";
import { renderDashboard, renderErrorPage, renderMemberChronicle, renderMemberProfile, renderMembers, renderProfessions, renderRaidPlan, renderResponses, renderStatistics } from "./views/render.js";

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const ASSETS = new Map([
  ["styles.css", { type: "text/css; charset=utf-8", body: readFileSync(new URL("../public/styles.css", import.meta.url), "utf8") }],
  ["table-filters.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/table-filters.js", import.meta.url), "utf8") }],
  ["countdown.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/countdown.js", import.meta.url), "utf8") }],
  ["copy-summary.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/copy-summary.js", import.meta.url), "utf8") }],
  ["sync-time.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/sync-time.js", import.meta.url), "utf8") }],
  ["local-time.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/local-time.js", import.meta.url), "utf8") }],
  ["live-refresh.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/live-refresh.js", import.meta.url), "utf8") }]
]);

const SECURITY_HEADERS = {
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin"
};

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

export function buildApp({ dataService: source, rateLimitPerMinute = 300, formUrl = "", logger = true }) {
  // Pages see the sign-up Form address as part of the snapshot; the public API payload picks its own fields.
  const dataService = { snapshot: () => ({ ...source.snapshot(), formUrl }), memberSnapshot: source.memberSnapshot ? () => source.memberSnapshot() : undefined };
  const app = Fastify({
    logger,
    bodyLimit: 16 * 1024,
    trustProxy: false,
    routerOptions: { ignoreTrailingSlash: true, caseSensitive: false },
    // Errors Fastify raises before routing (such as a malformed address) skip hooks, so answer them here.
    frameworkErrors: (error, request, reply) => sendError(request, reply, error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 400)
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.headers(SECURITY_HEADERS);
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

  // Page routes get an in-app error page; data and asset routes keep short JSON. Neither repeats the
  // requested address or any error detail.
  function sendError(request, reply, status) {
    reply.headers({ ...SECURITY_HEADERS, "cache-control": "no-store" });
    const path = request.url.split("?")[0].toLowerCase();
    const wantsPage = (request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/") && !path.startsWith("/assets/");
    if (!wantsPage) return reply.code(status).send({ error: status === 404 ? "Not found" : "Request failed" });
    let snapshot = null;
    try { snapshot = dataService.snapshot(); } catch { snapshot = null; }
    try {
      return html(reply).code(status).send(renderErrorPage(snapshot, status));
    } catch {
      return reply.code(status).type("text/plain; charset=utf-8").send("Something went wrong.");
    }
  }
  app.setNotFoundHandler((request, reply) => sendError(request, reply, 404));
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (status >= 500) request.log.error({ errorType: error.name }, "Request failed");
    return sendError(request, reply, status);
  });
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
  app.get("/summary.txt", async (_request, reply) => reply.type("text/plain; charset=utf-8").send(buildSummary(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [] })));
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
  app.get("/members/chronicle", async (request, reply) => {
    const filter = typeof request.query?.type === "string" ? request.query.type : "all";
    return html(reply).send(renderMemberChronicle(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [], events: [] }, filter));
  });

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderDashboard(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [], events: [] })));
  app.get("/responses", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderResponses(dataService.snapshot())));
  app.get("/statistics", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderStatistics(dataService.snapshot())));
  app.get("/assets/:name", async (request, reply) => {
    const asset = ASSETS.get(String(request.params.name).toLowerCase());
    if (!asset) return reply.code(404).header("cache-control", "no-store").send({ error: "Not found" });
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
