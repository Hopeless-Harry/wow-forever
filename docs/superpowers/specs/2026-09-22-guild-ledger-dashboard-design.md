# Guild Ledger Dashboard Design

## Purpose

Build a small public website for Moms Against Magic that turns the guild's Google Form responses into an anonymous, useful guild census. It must run continuously on a Raspberry Pi 3 with 1 GB RAM, refresh without rebuilding, remain useful during Google outages, and feel like an original Classic World of Warcraft guild interface rather than a modern SaaS dashboard.

## Verified source data

The live form, **Moms Against Magic — WoW Forever Main Roster**, was inspected on 22 September 2026. It is published, has 10 responses, does not collect email addresses, and is not yet linked to a response spreadsheet.

| Field | Form type | Public handling |
| --- | --- | --- |
| What is your BattleTag and name? | Required short answer | Always excluded as identifying data |
| What server should Moms be on? | Required single choice | Public aggregate and anonymous row |
| What race will your main be? | Required single choice | Public aggregate and anonymous row |
| What class will your main be? | Required single choice | Public aggregate and anonymous row |
| What will your main role be? | Required single choice | Public aggregate and anonymous row |
| Profession 1 | Required dropdown | Public aggregate and anonymous row |
| Profession 2 | Required dropdown | Public aggregate and anonymous row |
| Comments, ideas, or anything you want from the guild? | Optional paragraph | Excluded in version one because unstructured text can identify respondents or other members |

Unknown columns, timestamps, email addresses, Google metadata, response IDs, and hidden spreadsheet columns are excluded by allowlist. They must never be included in browser payloads, logs, or cache files.

## Product experience

The first viewport opens directly on the Guild Ledger dashboard. A compact navigation rail links to Dashboard, Guild Census, and Statistics. The dashboard shows total anonymous responses, the leading server preference, the largest class and role groups, profession coverage, recent anonymous roster entries, and lightweight bar charts for server, class, role, and race.

Guild Census is a searchable, sortable, filterable anonymous table. Each row is labelled `Response #N` and contains only server, race, class, role, profession 1, and profession 2. On narrow screens the table scrolls horizontally inside its frame without widening the page.

Statistics shows fuller distributions and combined profession demand. Empty, initial-configuration, stale-cache, and Google-unavailable states use clear in-world language while remaining explicit about whether data is current.

## Visual thesis

The site is a custom **Guild Ledger**: dark iron framing, aged brass and gold trim, muted Horde red, ink-dark parchment, ornamental corner treatments, restrained class colours, and fantasy-serif headings. Panels resemble quest logs, guild windows, and tooltips without copying Blizzard artwork or shipping game assets. CSS gradients and small geometric decorations create the material treatment; data, typography, and layout remain readable at 200% text enlargement. Motion is subtle and disabled under reduced-motion preferences.

## Architecture

The application uses Node.js 20, Fastify, server-rendered HTML, static CSS, and small vanilla JavaScript modules. It uses no frontend framework, database, container, or client charting library.

`SheetSource` fetches a configured range from the Google Sheets API with a service-account JWT. `normalizeRows` maps only explicitly configured public headers into a fixed internal record. `DataStore` keeps the latest sanitized snapshot in memory and writes only that snapshot to `data/cache.json` using an atomic temporary-file rename. It refreshes on a two-minute interval and uses stale-while-revalidate behavior on requests. If Google fails, the last valid sanitized cache remains available.

Routes render from the sanitized snapshot only. `/api/public-data` exposes the same safe structure for optional client refreshes and never receives the raw spreadsheet rows. Content Security Policy, no-store handling for errors, HTML escaping, request limits, and conservative security headers are enabled.

## Google setup

The form owner must first link the Form to a response Sheet. A Google Cloud service account with read-only Sheets access is then shared onto that specific Sheet. Credentials remain on the Pi and are supplied through environment variables or a root-readable credential file; they are never placed in `public/`, committed, rendered, or returned by an endpoint.

The application uses an explicit sheet name/range and configurable header aliases. Startup fails closed when required mapping is ambiguous. Development mode may load a synthetic fixture that contains no real names or comments.

## Reliability and deployment

Fastify binds to `127.0.0.1` by default. A systemd service starts it after networking, restarts on failure, uses a dedicated unprivileged user, and applies basic hardening. Cloudflare Tunnel connects outward to the local HTTP service, so no router port is opened. `scripts/setup.sh` installs production dependencies and the systemd unit; `scripts/update.sh` pulls or accepts the deployed files, installs locked dependencies, runs tests, and restarts only after checks pass.

Logs contain operational events, row counts, cache age, and error categories, never row content or credentials. Health endpoints distinguish process health from data freshness.

## Testing and acceptance

Automated tests cover header mapping, exclusion of identifying/unknown fields, HTML escaping, aggregate calculations, malformed and empty rows, cache fallback, stale status, Google failure, and public API payloads. A privacy regression test searches serialized browser responses for all private fixture markers.

Acceptance requires:

- all tests passing on Node.js 20;
- no private fixture markers in rendered pages, API responses, logs, or cache;
- useful pages with empty, fresh, and stale data;
- responsive behavior at phone and desktop widths;
- successful local startup and health check;
- production dependency and bundle footprint suitable for a Pi 3;
- complete README steps for Google Sheets, Pi, systemd, Cloudflare Tunnel, updates, and troubleshooting.

## Non-goals

Version one has no accounts, Discord integration, administration UI, response editing, authentication, complex permissions, comment moderation, or database.
