import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createStore } from './store.js';
import { loadConfig } from './config.js';
import { hashPassword, verifyPassword, strongEnough, LoginLimiter, parseCookies, isPrivateAddress } from './auth.js';
import { validateIngest, validateCommand, canSend, ROLE_COMMANDS } from './validate.js';
import * as views from './views.js';
import { companionManifest, companionFile } from './companion.js';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = { '/static/style.css': ['public/style.css', 'text/css; charset=utf-8'], '/static/app.js': ['public/app.js', 'text/javascript; charset=utf-8'] };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const MAX_BODY = 2 * 1024 * 1024;
const COOKIE = 'mam_session';
const withoutKind = ({ kind, ...rest }) => rest;

export function createApp({ store, config = loadConfig(), now = () => Math.floor(Date.now() / 1000), getRemote = (req) => req.socket.remoteAddress } = {}) {
  const limiter = new LoginLimiter({ now });
  const assets = Object.fromEntries(Object.entries(STATIC).map(([url, [file, type]]) => [url, { body: readFileSync(resolve(here, '..', file)), type }]));

  const send = (res, status, body, type = 'text/html; charset=utf-8', headers = {}) => {
    res.writeHead(status, { 'Content-Type': type, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  };
  const json = (res, status, value) => send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
  const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, 'Cache-Control': 'no-store', ...headers }); res.end(); };

  const readBody = (req) => new Promise((ok, fail) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { fail(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
  const readJson = async (req) => { try { return JSON.parse(await readBody(req)); } catch (e) { if (e.status) throw e; return null; } };
  const readForm = async (req) => Object.fromEntries(new URLSearchParams(await readBody(req)));

  const sessionOf = (req) => store.getSession(parseCookies(req.headers.cookie)[COOKIE]);
  const cookie = (token, maxAge) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.secureCookies ? '; Secure' : ''}`;
  const sourceOf = (req) => { const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? ''); return m ? store.findSource(m[1]) : null; };
  // Browser POSTs must carry a custom header (a cross-site form cannot set it) and, when an Origin is sent, match the host.
  const sameSiteAjax = (req) => req.headers['x-requested-with'] === 'mam' && (!req.headers.origin || new URL(req.headers.origin).host === req.headers.host);

  async function handle(req, res) {
    const url = new URL(req.url, 'http://hub');
    const path = url.pathname;
    if (!config.allowPublic && !isPrivateAddress(getRemote(req))) return send(res, 403, 'Forbidden: the hub only answers private networks.', 'text/plain; charset=utf-8');
    if (req.method === 'GET' && assets[path]) return send(res, 200, assets[path].body, assets[path].type, { 'Cache-Control': 'public, max-age=300' });
    if (path === '/healthz') return send(res, 200, 'ok', 'text/plain; charset=utf-8');

    // ---- companion API (source key)
    if (path === '/api/ingest' || path === '/api/commands' || path === '/api/companion/manifest' || path === '/api/companion/file') {
      const source = sourceOf(req);
      if (!source) return json(res, 401, { ok: false, error: 'unauthorised' });
      if (path === '/api/ingest' && req.method === 'POST') {
        const result = validateIngest(await readJson(req));
        if (!result.ok) return json(res, 400, { ok: false, errors: result.errors });
        const summary = store.ingest(result.value, source.label);
        return json(res, 200, { ok: true, ...summary, rejected: result.errors.length });
      }
      if (path === '/api/companion/manifest' && req.method === 'GET') { const m = companionManifest(config.companionDir); return m ? json(res, 200, { ok: true, ...m }) : json(res, 404, { ok: false, error: 'no companion bundle on this hub' }); }
      if (path === '/api/companion/file' && req.method === 'GET') { const body = companionFile(config.companionDir, url.searchParams.get('name')); return body ? send(res, 200, body, 'application/octet-stream') : json(res, 404, { ok: false, error: 'no such file' }); }
      if (path === '/api/commands' && req.method === 'GET') return json(res, 200, { ok: true, commands: store.pendingCommands(Number(url.searchParams.get('after')) || 0) });
      return json(res, 405, { ok: false, error: 'method not allowed' });
    }

    // ---- login
    if (path === '/login') {
      if (req.method === 'GET') return send(res, 200, views.loginPage());
      if (req.method === 'POST') {
        const form = await readForm(req);
        const name = String(form.name ?? '').slice(0, 24);
        const key = `${getRemote(req)}|${name.toLowerCase()}`;
        if (limiter.blocked(key)) { store.audit(name || '?', null, 'login.blocked', 'too many attempts'); return send(res, 429, views.loginPage('Too many attempts. Try again in 15 minutes.')); }
        const user = store.getUser(name);
        const ok = user ? await verifyPassword(form.password, user.hash) : (await verifyPassword(form.password, 'scrypt$00$00'), false);
        if (!ok) { limiter.fail(key); store.audit(name || '?', null, 'login.fail', ''); return send(res, 401, views.loginPage('Wrong name or password.')); }
        limiter.reset(key);
        store.audit(user.name, user.role, 'login.ok', '');
        return redirect(res, '/', { 'Set-Cookie': cookie(store.createSession(user.name, user.role), 43200) });
      }
    }
    if (path === '/logout' && req.method === 'POST') {
      const token = parseCookies(req.headers.cookie)[COOKIE]; if (token) store.deleteSession(token);
      return redirect(res, '/login', { 'Set-Cookie': cookie('', 0) });
    }

    // ---- dashboard (admin and officers only)
    const session = sessionOf(req);
    if (!session) return path.startsWith('/api/') ? json(res, 401, { ok: false, error: 'log in first' }) : redirect(res, '/login');
    const user = { name: session.user, role: session.role };
    const t = now();
    const overview = store.overview();
    const page = (title, body, active) => send(res, 200, views.layout({ title, user, body, banner: views.banner(overview, t), active }));

    if (req.method === 'GET') {
      if (path === '/') return page('Overview', views.overviewPage(overview, store.listMembers().sort((a, b) => b.last_heard - a.last_heard).slice(0, 10), t), 'overview');
      if (path === '/members') return page('Members', `<h2>Members</h2>${views.memberTable(store.listMembers(), t)}`, 'members');
      if (path === '/leaderboard') return page('Leaderboard', views.leaderboardPage(store.leaderboard('mom_money', 20), store.leaderboard('medals', 20), t), 'leaderboard');
      if (path === '/member') return page('Member', views.memberPage(store.member(url.searchParams.get('name') ?? ''), t), 'members');
      if (path === '/map') return page('Map', views.mapPage(store.locations(), t), 'map');
      if (path === '/commands') return page('Commands', views.commandsPage(user, store.catalog(), store.listCommands(50), ROLE_COMMANDS[user.role] ?? [], t), 'commands');
      if (path === '/audit' && user.role === 'admin') return page('Audit', views.auditPage(store.listAudit(300), t), 'audit');
      if (path === '/users' && user.role === 'admin') return page('Logins', views.usersPage(store.listUsers(), store.listSources(), t), 'users');
      return send(res, 404, views.layout({ title: 'Not found', user, body: '<h2>Not found</h2>' }));
    }

    // ---- dashboard actions (JSON, custom header required)
    if (req.method === 'POST' && path.startsWith('/api/ui/')) {
      if (!sameSiteAjax(req)) return json(res, 403, { ok: false, error: 'bad origin' });
      const body = await readJson(req);
      if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: 'bad request' });
      if (path === '/api/ui/commands') {
        if (!canSend(user.role, body.kind)) { store.audit(user.name, user.role, 'command.denied', String(body.kind).slice(0, 20)); return json(res, 403, { ok: false, error: 'your role cannot send that kind of command' }); }
        const checked = validateCommand(body.kind, body);
        if (!checked.ok) return json(res, 400, { ok: false, error: checked.error });
        return json(res, 200, { ok: true, id: store.createCommand(checked.command.kind, withoutKind(checked.command), user.name, user.role) });
      }
      if (path === '/api/ui/users' && user.role === 'admin') {
        const name = String(body.name ?? '');
        if (body.action === 'remove') {
          if (name.toLowerCase() === user.name.toLowerCase()) return json(res, 400, { ok: false, error: 'you cannot remove yourself' });
          const done = store.removeUser(name); store.audit(user.name, user.role, 'user.remove', name); return json(res, 200, { ok: done });
        }
        if (body.action === 'save') {
          if (!/^[A-Za-z0-9_.-]{2,24}$/.test(name)) return json(res, 400, { ok: false, error: 'name must be 2-24 letters, digits, . _ -' });
          if (!['admin', 'officer'].includes(body.role)) return json(res, 400, { ok: false, error: 'role must be admin or officer' });
          if (!strongEnough(body.password)) return json(res, 400, { ok: false, error: 'password must be at least 10 characters' });
          if (name.toLowerCase() === user.name.toLowerCase() && body.role !== 'admin') return json(res, 400, { ok: false, error: 'you cannot demote yourself' });
          store.addUser(name, body.role, hashPassword(body.password)); store.audit(user.name, user.role, 'user.save', `${name} ${body.role}`); return json(res, 200, { ok: true });
        }
      }
      return json(res, 404, { ok: false, error: 'not found' });
    }
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (!res.headersSent) send(res, e.status || 500, e.status === 413 ? 'Too large' : 'Server error', 'text/plain; charset=utf-8');
      if (!e.status) console.error('request failed', e.message);
    });
  });
  return { server, handle, limiter };
}

// Entry point: `node src/server.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const config = loadConfig();
  const store = createStore(config.dbPath);
  const { server } = createApp({ store, config });
  server.listen(config.port, config.host, () => console.log(`pi-hub listening on ${config.host}:${config.port} (private networks only: ${!config.allowPublic})`));
  setInterval(() => { try { store.purgeSessions(); } catch { /* ignore */ } }, 3600_000).unref();
  setInterval(() => { try { store.backup(config.backupDir, 7); } catch (e) { console.error('backup failed', e.message); } }, 24 * 3600_000).unref();
  process.on('SIGTERM', () => { server.close(); store.close(); process.exit(0); });
}
