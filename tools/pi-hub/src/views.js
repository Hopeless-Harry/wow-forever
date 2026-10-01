// Server-rendered pages. No inline scripts or styles (the Content-Security-Policy forbids them): behaviour lives in /static/app.js.
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CLASSES = { 1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk', 11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker' };
export const className = (id) => CLASSES[id] ?? '-';
const STALE_MEMBER = 7 * 86400;
const STALE_UPLOAD = 15 * 60;
const STATS_LABELS = {
  wine: 'Wine', ale: 'Ale', coffee: 'Coffee', food: 'Food', cheese: 'Cheese', cookie: 'Cookies', pie: 'Pies', soup: 'Soup', fish: 'Fish', juice: 'Juice', water: 'Water', bandage: 'Bandages', potion: 'Potions',
  jumps: 'Jumps', kills: 'Creatures killed', quests: 'Quests completed', deaths: 'Deaths', dungeons: 'Dungeons entered', flights: 'Flight paths',
};

export function ago(ts, now) {
  if (!ts) return 'never';
  const s = Math.max(0, now - ts);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function layout({ title, user, body, banner = '', active = '' }) {
  const link = (href, label, key, adminOnly = false) => (adminOnly && user?.role !== 'admin' ? '' : `<a href="${href}"${active === key ? ' class="on"' : ''}>${label}</a>`);
  const nav = user ? `<nav>${link('/', 'Overview', 'overview')}${link('/members', 'Members', 'members')}${link('/leaderboard', 'Leaderboard', 'leaderboard')}${link('/map', 'Map', 'map')}${link('/commands', 'Commands', 'commands')}${link('/audit', 'Audit', 'audit', true)}${link('/users', 'Logins', 'users', true)}
    <span class="who">${esc(user.name)} (${esc(user.role)})</span><form method="post" action="/logout"><button class="link">Log out</button></form></nav>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} - Moms Against Magic hub</title><link rel="stylesheet" href="/static/style.css"></head>
<body><header><h1>Moms Against Magic Chronicles <small>guild hub</small></h1>${nav}</header>${banner}<main>${body}</main><script src="/static/app.js" defer></script></body></html>`;
}

export function loginPage(error = '') {
  return layout({ title: 'Log in', user: null, body: `<section class="card narrow"><h2>Log in</h2>${error ? `<p class="bad">${esc(error)}</p>` : ''}
    <form method="post" action="/login"><label>Name<input name="name" autocomplete="username" required maxlength="24"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label><button>Log in</button></form>
    <p class="muted">For the guild admin and officers only.</p></section>` });
}

export function banner(overview, now) {
  const parts = [];
  if (!overview.lastUploadAt) parts.push('No data has reached the hub yet. Start the gateway client and the companion app.');
  else if (now - overview.lastUploadAt > STALE_UPLOAD) parts.push(`The gateway has not uploaded for ${ago(overview.lastUploadAt, now).replace(' ago', '')}. Everything below is as of then.`);
  if (overview.dbBytes > 500 * 1024 * 1024) parts.push(`The database is ${(overview.dbBytes / 1048576).toFixed(0)} MB. History is kept forever, so check free space on the Pi.`);
  return parts.length ? `<div class="banner">${parts.map(esc).join('<br>')}</div>` : '';
}

export function overviewPage(o, recent, now) {
  const tile = (label, value, hint = '') => `<div class="tile"><b>${esc(value)}</b><span>${esc(label)}</span>${hint ? `<em>${esc(hint)}</em>` : ''}</div>`;
  return `<h2>Guild overview</h2><div class="tiles">${tile('Members known', o.members)}${tile('Heard in 24 h', o.heard24h)}${tile('Heard in 7 days', o.heard7d)}${tile('Medals earned', o.medals)}${tile('Commands waiting', o.pendingCommands)}${tile('Last upload', ago(o.lastUploadAt, now))}</div>
  <section class="card"><h3>Most recently heard</h3>${memberTable(recent, now, false)}</section>
  <p class="muted">The hub only sees members who are online while the gateway client is online and in the guild. "Last heard" is when the gateway last received something from them.</p>`;
}

export function memberTable(rows, now, filter = true) {
  const body = rows.map((m) => `<tr${now - m.last_heard > STALE_MEMBER ? ' class="stale"' : ''}><td><a href="/member?name=${encodeURIComponent(m.name)}">${esc(m.name)}</a></td><td>${esc(m.level ?? '-')}</td><td>${esc(className(m.class_id))}</td><td>${esc(m.title ?? '')}</td><td>${esc(m.medals ?? '-')}</td><td>${esc(m.mom_money ?? '-')}</td><td>${esc(ago(m.last_heard, now))}${now - m.last_heard > STALE_MEMBER ? ' <span class="badge">stale</span>' : ''}</td></tr>`).join('');
  return `${filter ? '<input id="filter" placeholder="Filter members" aria-label="Filter members">' : ''}<table id="members"><thead><tr><th>Name</th><th>Level</th><th>Class</th><th>Title</th><th>Medals</th><th>Mom Money</th><th>Last heard</th></tr></thead><tbody>${body || '<tr><td colspan="7" class="muted">Nobody yet.</td></tr>'}</tbody></table>`;
}

export function leaderboardPage(byMoney, byMedals, now) {
  const table = (rows, key) => `<table><thead><tr><th>#</th><th>Name</th><th>${key === 'mom_money' ? 'Mom Money' : 'Medals'}</th><th>Title</th><th>Last heard</th></tr></thead><tbody>${rows.map((m, i) => `<tr><td>${i + 1}</td><td><a href="/member?name=${encodeURIComponent(m.name)}">${esc(m.name)}</a></td><td>${esc(m[key] ?? 0)}</td><td>${esc(m.title ?? '')}</td><td>${esc(ago(m.last_heard, now))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nobody yet.</td></tr>'}</tbody></table>`;
  return `<h2>Leaderboard</h2><div class="cols"><section class="card"><h3>Mom Money</h3>${table(byMoney, 'mom_money')}</section><section class="card"><h3>Medals</h3>${table(byMedals, 'medals')}</section></div>`;
}

export function memberPage(m, now) {
  if (!m) return '<h2>Member not found</h2><p><a href="/members">Back to members</a></p>';
  const stats = Object.entries(m.stats).map(([k, v]) => `<tr><td>${esc(STATS_LABELS[k] ?? k)}</td><td>${esc(v)}</td></tr>`).join('');
  const days = [...new Set(m.history.map((h) => h.day))].slice(0, 30);
  const keys = [...new Set(m.history.map((h) => h.key))];
  const grid = days.map((d) => `<tr><td>${esc(d)}</td>${keys.map((k) => `<td>${esc(m.history.find((h) => h.day === d && h.key === k)?.value ?? '')}</td>`).join('')}</tr>`).join('');
  return `<h2>${esc(m.name)}</h2><div class="tiles"><div class="tile"><b>${esc(m.level ?? '-')}</b><span>${esc(className(m.class_id))}</span></div><div class="tile"><b>${esc(m.medals ?? '-')}</b><span>Medals</span></div><div class="tile"><b>${esc(m.mom_money ?? '-')}</b><span>Mom Money</span></div><div class="tile"><b>${esc(ago(m.last_heard, now))}</b><span>Last heard</span></div></div>
  <p>${esc(m.title ?? '')}</p><div class="cols"><section class="card"><h3>Latest numbers</h3><table><tbody>${stats || '<tr><td class="muted">No stats shared (they may not have agreed to share).</td></tr>'}</tbody></table></section>
  <section class="card"><h3>Daily history</h3><div class="scroll"><table><thead><tr><th>Day</th>${keys.map((k) => `<th>${esc(STATS_LABELS[k] ?? k)}</th>`).join('')}</tr></thead><tbody>${grid || '<tr><td class="muted">No history yet.</td></tr>'}</tbody></table></div></section></div>`;
}

export function mapPage(locations, now) {
  const zones = new Map();
  for (const l of locations) { const key = `${l.map_id}|${l.zone ?? `Zone ${l.map_id}`}`; (zones.get(key) ?? zones.set(key, []).get(key)).push(l); }
  const panels = [...zones.entries()].map(([key, list]) => {
    const name = key.split('|').slice(1).join('|');
    const dots = list.map((l) => `<circle cx="${(l.x * 100).toFixed(1)}" cy="${(l.y * 100).toFixed(1)}" r="1.8" class="dot${now - l.at > 120 ? ' old' : ''}"><title>${esc(l.name)} (level ${esc(l.level ?? '?')} ${esc(className(l.class_id))}) ${esc(ago(l.at, now))}</title></circle>`).join('');
    return `<section class="card zone"><h3>${esc(name)}</h3><svg viewBox="0 0 100 100" role="img" aria-label="${esc(name)}"><rect width="100" height="100" class="field"/>${dots}</svg><ul>${list.map((l) => `<li>${esc(l.name)} <span class="muted">${esc(ago(l.at, now))}</span></li>`).join('')}</ul></section>`;
  }).join('');
  return `<h2>Live map</h2><p class="muted">Latest known position per member, shown inside each zone. Only members who share their location, in the open world, while the gateway is online. Positions expire after 10 minutes. The data is only as fresh as the gateway's last reload.</p><div class="cols zones">${panels || '<p class="muted">Nobody is sharing a position right now.</p>'}</div>`;
}

const STATE_LABEL = { queued: 'Waiting for the companion', fetched: 'Picked up by the companion', relayed: 'Relayed to the guild channel', rejected: 'Rejected by the addon' };
export function commandsPage(user, catalog, commands, canKinds, now) {
  const kinds = [['announce', 'Announcement'], ['award', 'Award medal'], ['revoke', 'Revoke medal'], ['quests', 'Weekly quest override'], ['config', 'Guild message']].filter(([k]) => canKinds.includes(k));
  const medalOptions = catalog.verified.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('');
  const templateOptions = (slot) => `<option value="-">(keep default)</option>${catalog.templates.filter((t) => t.slot === slot).map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}`;
  const rows = commands.map((c) => {
    let detail = ''; try { detail = Object.entries(JSON.parse(c.payload)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join('; '); } catch { /* ignore */ }
    return `<tr><td>#${c.id}</td><td>${esc(c.kind)}</td><td>${esc(detail)}</td><td>${esc(c.created_by)} (${esc(c.role)})</td><td>${esc(ago(c.created_at, now))}</td><td><span class="badge ${esc(c.state)}">${esc(STATE_LABEL[c.state] ?? c.state)}</span>${c.reason ? ` ${esc(c.reason)}` : ''}</td></tr>`;
  }).join('');
  return `<h2>Commands</h2><p class="notice">Commands only reach the guild when your gateway client is online (a rank 0 or 1 character) <b>and</b> it has reloaded the interface after the companion wrote the inbox. "Relayed" means the gateway sent it to the guild channel, not that every member received it.</p>
  <section class="card"><h3>Send a command</h3><form id="composer"><label>Kind<select name="kind">${kinds.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
  <div data-kind="announce"><label>Text (max 570 characters, plain English letters and symbols)<textarea name="text" maxlength="570" rows="3"></textarea></label></div>
  <div data-kind="award revoke" hidden><label>Character name<input name="target" maxlength="24" placeholder="Name only, no realm"></label><label>Medal<select name="medal">${medalOptions || '<option value="">(no guild-verified medals reported yet)</option>'}</select></label></div>
  <div data-kind="quests" hidden><label>Week number<input name="week" type="number" min="1"></label><label>Adventure<select name="slot1">${templateOptions(1)}</select></label><label>Mom life<select name="slot2">${templateOptions(2)}</select></label><label>Stretch<select name="slot3">${templateOptions(3)}</select></label></div>
  <div data-kind="config" hidden><label>Guild message (max 100 characters)<input name="motd" maxlength="100"></label></div>
  <button>Queue command</button> <span id="result" class="muted"></span></form></section>
  <section class="card"><h3>What was sent, and by whom</h3><div class="scroll"><table><thead><tr><th>ID</th><th>Kind</th><th>Detail</th><th>By</th><th>When</th><th>State</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">No commands yet.</td></tr>'}</tbody></table></div></section>`;
}

export function auditPage(rows, now) {
  return `<h2>Audit log</h2><div class="scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${esc(new Date(a.at * 1000).toISOString().replace('T', ' ').slice(0, 19))} <span class="muted">${esc(ago(a.at, now))}</span></td><td>${esc(a.actor)}${a.role ? ` (${esc(a.role)})` : ''}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function usersPage(users, sources, now) {
  return `<h2>Logins</h2><section class="card"><h3>Admin and officers</h3><table><thead><tr><th>Name</th><th>Role</th><th>Created</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(ago(u.created_at, now))}</td><td><button class="link" data-remove="${esc(u.name)}">Remove</button></td></tr>`).join('')}</tbody></table></section>
  <section class="card"><h3>Add or update a login</h3><form id="userform"><label>Name (letters, digits, . _ -)<input name="name" maxlength="24" required></label><label>Role<select name="role"><option value="officer">Officer</option><option value="admin">Admin</option></select></label><label>Password (10+ characters)<input name="password" type="password" minlength="10" required></label><button>Save login</button> <span id="result" class="muted"></span></form></section>
  <section class="card"><h3>Gateway sources</h3><table><thead><tr><th>Label</th><th>Created</th><th>Last seen</th></tr></thead><tbody>${sources.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(ago(s.created_at, now))}</td><td>${esc(ago(s.last_seen, now))}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">None. Add one with <code>node src/cli.js add-source &lt;label&gt;</code> on the Pi.</td></tr>'}</tbody></table></section>`;
}
