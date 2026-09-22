# Guild Ledger Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a privacy-first Classic WoW guild census that automatically refreshes from Google Sheets and runs reliably on a Raspberry Pi 3.

**Architecture:** A small Fastify server fetches Sheets data, immediately reduces it through an allowlist normalizer, caches only sanitized records, and server-renders three public pages. Vanilla browser code handles table filtering and periodic refresh while CSS/SVG-free data bars keep the client lightweight.

**Tech Stack:** Node.js 20, Fastify, native `fetch` and `crypto`, HTML/CSS, vanilla JavaScript, Node test runner, systemd, Cloudflare Tunnel.

**Spec:** `docs/superpowers/specs/2026-09-22-guild-ledger-dashboard-design.md`

## Global Constraints

- Run on Raspberry Pi 3 with 1 GB RAM and Raspberry Pi OS.
- Bind to `127.0.0.1` by default and expose publicly through Cloudflare Tunnel.
- Refresh Google data every 120 seconds; continue serving the last sanitized cache on failures.
- Never send, cache, or log names, BattleTags, emails, response IDs, timestamps, comments, unknown columns, or hidden columns.
- Browser-visible records contain only anonymous ID, server, race, class, role, profession 1, and profession 2.
- Use no Docker, database, frontend framework, or client chart library.
- Use original CSS treatments rather than copyrighted Blizzard assets.

---

### Task 1: Project shell and privacy normalizer

**Files:**
- Create: `guild-dashboard/package.json`
- Create: `guild-dashboard/src/config.js`
- Create: `guild-dashboard/src/domain/normalize.js`
- Create: `guild-dashboard/test/normalize.test.js`
- Create: `guild-dashboard/test/fixtures/sheet-rows.js`
- Create: `guild-dashboard/.gitignore`

**Interfaces:**
- Consumes: Google Sheets-style `unknown[][]` rows.
- Produces: `normalizeRows(rows, mapping)` returning `{ records, rejectedRows, sourceRowCount }`; `PUBLIC_FIELDS`; `loadConfig(env)`.

- [ ] Write failing tests for explicit header mapping, unknown-column removal, private-marker removal, malformed rows, and deterministic anonymous IDs.
- [ ] Run `npm test -- test/normalize.test.js` and confirm the missing module failure.
- [ ] Implement the fixed public record schema and fail-closed header validation.
- [ ] Run the normalizer tests and confirm they pass.
- [ ] Commit only Task 1 files.

### Task 2: Aggregates and sanitized cache

**Files:**
- Create: `guild-dashboard/src/domain/stats.js`
- Create: `guild-dashboard/src/data/cache-store.js`
- Create: `guild-dashboard/test/stats.test.js`
- Create: `guild-dashboard/test/cache-store.test.js`

**Interfaces:**
- Consumes: normalized records from Task 1.
- Produces: `buildStats(records)` and `CacheStore` with `read()`, `write(snapshot)`, and `getStatus(now)`.

- [ ] Write failing tests for categorical counts, combined professions, leaders, empty data, atomic sanitized writes, and stale-cache status.
- [ ] Run the two test files and confirm missing implementation failures.
- [ ] Implement pure statistics and an atomic JSON cache that validates its schema on read.
- [ ] Run both test files and confirm they pass.
- [ ] Commit only Task 2 files.

### Task 3: Google Sheets source and refresh service

**Files:**
- Create: `guild-dashboard/src/data/google-auth.js`
- Create: `guild-dashboard/src/data/sheet-source.js`
- Create: `guild-dashboard/src/data/data-service.js`
- Create: `guild-dashboard/test/google-auth.test.js`
- Create: `guild-dashboard/test/data-service.test.js`

**Interfaces:**
- Consumes: service-account email/private key, Sheet ID/range, normalizer, cache.
- Produces: `createAccessToken(config, fetchFn)`, `SheetSource.fetchRows()`, and `DataService` with `start()`, `stop()`, `refresh()`, `snapshot()`.

- [ ] Write failing tests for JWT claims, token exchange errors, refresh coalescing, good refresh, malformed refresh rejection, and cached fallback.
- [ ] Run the task tests and confirm missing implementation failures.
- [ ] Implement RS256 JWT exchange with native crypto/fetch, Sheets values fetch, and a single-flight two-minute refresh loop.
- [ ] Run the task tests and confirm they pass.
- [ ] Commit only Task 3 files.

### Task 4: Server routes and privacy boundary

**Files:**
- Create: `guild-dashboard/src/app.js`
- Create: `guild-dashboard/src/server.js`
- Create: `guild-dashboard/src/views/render.js`
- Create: `guild-dashboard/src/views/escape.js`
- Create: `guild-dashboard/test/routes.test.js`
- Create: `guild-dashboard/test/privacy.test.js`

**Interfaces:**
- Consumes: `DataService.snapshot()` containing sanitized records and stats.
- Produces: `buildApp({ dataService, logger })`, `/`, `/responses`, `/statistics`, `/api/public-data`, `/health/live`, `/health/ready`.

- [ ] Write failing route tests for all pages, health states, safe JSON shape, HTML escaping, security headers, and private-marker absence across every public response.
- [ ] Run route/privacy tests and confirm missing implementation failures.
- [ ] Implement reusable shell/page renderers and Fastify routes with a restrictive CSP.
- [ ] Run route/privacy tests and confirm they pass.
- [ ] Commit only Task 4 files.

### Task 5: Guild Ledger visual system and interactions

**Files:**
- Create: `guild-dashboard/public/styles.css`
- Create: `guild-dashboard/public/responses.js`
- Create: `guild-dashboard/public/live-refresh.js`
- Modify: `guild-dashboard/src/views/render.js`
- Create: `guild-dashboard/test/static-assets.test.js`

**Interfaces:**
- Consumes: semantic markup and `/api/public-data`.
- Produces: responsive Guild Ledger presentation, filter/sort controls, and status refresh.

- [ ] Write failing static checks for accessible landmarks, labels, focus styles, reduced motion, horizontal table overflow, and no external asset dependency.
- [ ] Run the static tests and confirm they fail.
- [ ] Implement the iron/parchment/gold design, CSS data bars, class-colour accents, mobile navigation, search, filters, and sorting.
- [ ] Run static and full tests and confirm they pass.
- [ ] Commit only Task 5 files.

### Task 6: Pi operations and documentation

**Files:**
- Create: `guild-dashboard/.env.example`
- Create: `guild-dashboard/config/guild-ledger.service`
- Create: `guild-dashboard/config/cloudflared.yml.example`
- Create: `guild-dashboard/scripts/setup.sh`
- Create: `guild-dashboard/scripts/update.sh`
- Create: `guild-dashboard/README.md`
- Create: `guild-dashboard/test/operations.test.js`

**Interfaces:**
- Consumes: built application and environment configuration.
- Produces: repeatable Raspberry Pi setup, update, boot, restart, tunnel, and troubleshooting workflow.

- [ ] Write failing operations tests for safe bind defaults, locked production install, unprivileged systemd configuration, restart policy, cache directory permissions, and executable scripts.
- [ ] Run the operations tests and confirm they fail.
- [ ] Implement scripts, service unit, tunnel example, environment template, and all 14 requested README sections.
- [ ] Run operations and full tests and confirm they pass.
- [ ] Commit only Task 6 files.

### Task 7: End-to-end verification and handoff

**Files:**
- Modify only files required by verified defects.

**Interfaces:**
- Consumes: complete application.
- Produces: verified local build, privacy report, responsive screenshots, and deployment-ready repository.

- [ ] Run `npm ci --omit=dev` followed by `npm test` and record pass/fail totals.
- [ ] Start the app with the synthetic safe fixture and verify health, dashboard, census, statistics, API, and stale-data behavior.
- [ ] Search rendered pages, API output, cache, and captured logs for every private fixture marker; require zero matches.
- [ ] Inspect desktop and 390px mobile layouts for clipping, readability, filtering, focus visibility, and horizontal table containment.
- [ ] Measure production dependency size and idle process memory; document observed values without inventing Pi performance.
- [ ] Run `npm audit --omit=dev` and address actionable production findings.
- [ ] Commit verification-driven fixes and provide the exact remaining Google Sheet/service-account setup action.
