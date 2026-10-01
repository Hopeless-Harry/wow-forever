import Fastify from "fastify";
import { readFileSync } from "node:fs";

import { PUBLIC_FIELDS } from "./domain/normalize.js";
import { readCookie } from "./auth.js";
import { renderChronicles, renderDashboard, renderLogin, renderMemberChronicle, renderMembers, renderResponses, renderStatistics } from "./views/render.js";

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const ASSETS = new Map([
  ["styles.css", { type: "text/css; charset=utf-8", body: readFileSync(new URL("../public/styles.css", import.meta.url), "utf8") }],
  ["responses.js", { type: "text/javascript; charset=utf-8", body: readFileSync(new URL("../public/responses.js", import.meta.url), "utf8") }],
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

export function buildApp({ dataService, auth = null, logger = true }) {
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

  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body)));
  });

  const html = (reply) => reply.type("text/html; charset=utf-8");
  const privateHeaders = (reply) => reply.headers({ "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" });
  const signedIn = (request) => Boolean(auth && auth.verify(readCookie(request.headers.cookie, auth.cookieName)));
  const sessionCookie = (request, value, maxAge) => {
    const secure = request.protocol === "https" ? "; Secure" : "";
    return `${auth.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
  };

  // Named data is only ever read here, behind the guild passcode.
  const guarded = (render) => async (request, reply) => {
    privateHeaders(reply);
    if (!auth) return html(reply).code(404).send(renderLogin(dataService.snapshot(), { disabled: true }));
    if (!signedIn(request)) return reply.redirect("/login");
    return html(reply).send(render(dataService.snapshot(), dataService.memberSnapshot?.() ?? { members: [], events: [] }));
  };

  app.get("/members", guarded(renderMembers));
  app.get("/members/chronicle", guarded(renderMemberChronicle));
  app.get("/login", async (request, reply) => {
    privateHeaders(reply);
    if (signedIn(request)) return reply.redirect("/members");
    return html(reply).code(auth ? 200 : 404).send(renderLogin(dataService.snapshot(), { disabled: !auth }));
  });
  app.post("/login", async (request, reply) => {
    privateHeaders(reply);
    if (!auth) return html(reply).code(404).send(renderLogin(dataService.snapshot(), { disabled: true }));
    const token = auth.attempt(request.ip, String(request.body?.passcode ?? ""));
    if (!token) {
      const error = auth.locked(request.ip) ? "Too many attempts. Try again in a few minutes." : "That passcode was not accepted.";
      return html(reply).code(auth.locked(request.ip) ? 429 : 401).send(renderLogin(dataService.snapshot(), { error }));
    }
    return reply.header("set-cookie", sessionCookie(request, token, auth.sessionSeconds)).redirect("/members");
  });
  app.post("/logout", async (request, reply) => {
    privateHeaders(reply);
    if (auth) reply.header("set-cookie", sessionCookie(request, "", 0));
    return reply.redirect("/");
  });

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderDashboard(dataService.snapshot())));
  app.get("/responses", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderResponses(dataService.snapshot())));
  app.get("/chronicles", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderChronicles(dataService.snapshot())));
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
