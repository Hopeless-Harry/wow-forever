import { escapeHtml } from "./escape.js";

const CLASS_NAMES = new Set(["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid"]);

function classToken(value) {
  return CLASS_NAMES.has(value) ? ` class-${value.toLowerCase()}` : "";
}

function statusCopy(snapshot) {
  if (snapshot.status === "empty") return "Awaiting the first guild census sync";
  if (snapshot.lastRefreshFailed) return "Google is unreachable — showing the last safe copy";
  if (snapshot.status === "stale") return "Showing an older safe copy while the ledger reconnects";
  return "Guild census synced";
}

function navLink(href, label, active) {
  const current = active === href ? ' aria-current="page"' : "";
  return `<a href="${href}"${current}>${label}</a>`;
}

function shell({ title, active, snapshot, content, scripts = [] }) {
  const scriptTags = scripts.map((source) => `<script src="${source}" defer></script>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#120f0b">
  <title>${escapeHtml(title)} · Moms Against Magic</title>
  <link rel="stylesheet" href="/assets/styles.css">
  ${scriptTags}
</head>
<body data-sync-status="${escapeHtml(snapshot.status)}" data-fetched-at="${escapeHtml(snapshot.fetchedAt || "")}">
  <a class="skip-link" href="#main-content">Skip to ledger</a>
  <div class="ledger-shell">
    <aside class="guild-rail" aria-label="Guild Ledger navigation">
      <a class="guild-seal" href="/" aria-label="Moms Against Magic Guild Ledger"><span>M</span></a>
      <div class="guild-name"><strong>Moms Against Magic</strong><span>Guild Ledger</span></div>
      <nav>${navLink("/", "Dashboard", active)}${navLink("/responses", "Guild Census", active)}${navLink("/chronicles", "Chronicles", active)}${navLink("/statistics", "Statistics", active)}</nav>
      <p class="privacy-mark">Anonymous by design<br>Names never leave the vault</p>
    </aside>
    <main id="main-content" class="ledger-main">
      <header class="ledger-topbar">
        <div><span class="realm-mark">WoW Forever</span><h1>${escapeHtml(title)}</h1></div>
        <div class="sync-rune" role="status"><span aria-hidden="true"></span>${escapeHtml(statusCopy(snapshot))}</div>
      </header>
      ${content}
      <footer>Names, BattleTags, emails, comments and response metadata are excluded before this ledger is rendered.</footer>
    </main>
  </div>
</body>
</html>`;
}

function emptyPanel() {
  return `<section class="parchment-panel empty-ledger"><h2>The ledger is ready</h2><p>Link the Form to a Google Sheet and add the read-only credentials on the Pi. The first anonymous census will appear automatically.</p></section>`;
}

function leaderCard(label, leader, tone = "") {
  return `<article class="ledger-stat ${tone}"><span>${escapeHtml(label)}</span><strong>${leader ? escapeHtml(leader.label) : "—"}</strong><small>${leader ? `${leader.count} ${leader.count === 1 ? "response" : "responses"}` : "No responses yet"}</small></article>`;
}

function bars(title, values, tone = "") {
  if (!values.length) return `<section class="chart-panel ${tone}"><h2>${escapeHtml(title)}</h2><p class="quiet">No answers recorded yet.</p></section>`;
  const rows = values.map((item) => `<li><div><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong></div><span class="bar-track"><span class="bar-fill" style="--value:${Math.max(0, Math.min(100, item.percent))}%"></span></span></li>`).join("");
  return `<section class="chart-panel ${tone}"><h2>${escapeHtml(title)}</h2><ol class="distribution-bars">${rows}</ol></section>`;
}

function recentRows(records) {
  return records.slice(-5).reverse().map((record) => `<tr><th scope="row">${escapeHtml(record.anonymousId)}</th><td><span class="class-chip${classToken(record.characterClass)}">${escapeHtml(record.characterClass)}</span></td><td>${escapeHtml(record.role)}</td><td>${escapeHtml(record.race)}</td><td>${escapeHtml(record.profession1)} <span aria-hidden="true">+</span> ${escapeHtml(record.profession2)}</td></tr>`).join("");
}

export function renderDashboard(snapshot) {
  if (!snapshot.records.length) return shell({ title: "Guild Ledger", active: "/", snapshot, content: emptyPanel(), scripts: ["/assets/live-refresh.js"] });
  const { leaders, distributions, totalResponses } = snapshot.stats;
  const content = `<section class="ledger-overview" aria-labelledby="muster-heading">
    <div class="muster-count"><span>Names sealed</span><strong>${totalResponses}</strong><h2 id="muster-heading">Adventurers mustered</h2></div>
    <div class="stat-rack">${leaderCard("Favoured realm", leaders.server)}${leaderCard("Largest class", leaders.characterClass, "class-ledger")}${leaderCard("Main calling", leaders.role)}${leaderCard("Top profession", leaders.professions)}</div>
  </section>
  <section class="dashboard-grid">${bars("Class muster", distributions.characterClass, "wide")}${bars("Role balance", distributions.role)}${bars("Realm preference", distributions.server)}</section>
  <section class="parchment-panel recent-panel"><div class="panel-heading"><div><span>Latest entries</span><h2>Recent anonymous roster</h2></div><a class="wow-button" href="/responses">Open full census</a></div><div class="table-scroll"><table><thead><tr><th>Entry</th><th>Class</th><th>Role</th><th>Race</th><th>Professions</th></tr></thead><tbody>${recentRows(snapshot.records)}</tbody></table></div></section>`;
  return shell({ title: "Guild Ledger", active: "/", snapshot, content, scripts: ["/assets/live-refresh.js"] });
}

export function renderResponses(snapshot) {
  const rows = snapshot.records.map((record) => `<tr data-search="${escapeHtml(Object.values(record).join(" ").toLowerCase())}" data-class="${escapeHtml(record.characterClass)}" data-role="${escapeHtml(record.role)}" data-server="${escapeHtml(record.server)}"><th scope="row">${escapeHtml(record.anonymousId)}</th><td><span class="class-chip${classToken(record.characterClass)}">${escapeHtml(record.characterClass)}</span></td><td>${escapeHtml(record.role)}</td><td>${escapeHtml(record.race)}</td><td>${escapeHtml(record.server)}</td><td>${escapeHtml(record.profession1)}</td><td>${escapeHtml(record.profession2)}</td></tr>`).join("");
  const content = `<section class="parchment-panel census-panel"><div class="panel-heading"><div><span>Roster vault</span><h2>Guild Census</h2><p>Browse plans without revealing who submitted them.</p></div><strong id="visible-count">${snapshot.records.length} entries</strong></div>
    <form class="census-tools" data-census-filters><label>Search the census<input type="search" name="search" placeholder="Class, role, race or profession"></label><label>Class<select name="class"><option value="">All classes</option></select></label><label>Role<select name="role"><option value="">All roles</option></select></label><label>Realm<select name="server"><option value="">All preferences</option></select></label><label>Sort<select name="sort"><option value="number">Response number</option><option value="class">Class</option><option value="role">Role</option></select></label></form>
    <div class="table-scroll"><table id="census-table"><thead><tr><th>Entry</th><th>Class</th><th>Role</th><th>Race</th><th>Realm</th><th>Profession 1</th><th>Profession 2</th></tr></thead><tbody>${rows}</tbody></table></div><p class="no-results" hidden>No roster entries match those filters.</p>
  </section>`;
  return shell({ title: "Guild Census", active: "/responses", snapshot, content, scripts: ["/assets/responses.js", "/assets/live-refresh.js"] });
}

export function renderStatistics(snapshot) {
  const d = snapshot.stats.distributions;
  const content = snapshot.records.length ? `<section class="statistics-intro"><p>${snapshot.stats.totalResponses} anonymous plans, counted exactly as submitted.</p></section><section class="statistics-grid">${bars("Class distribution", d.characterClass)}${bars("Role distribution", d.role)}${bars("Race distribution", d.race)}${bars("Realm preference", d.server)}${bars("Profession demand", d.professions, "wide")}</section>` : emptyPanel();
  return shell({ title: "Guild Statistics", active: "/statistics", snapshot, content, scripts: ["/assets/live-refresh.js"] });
}

function chronicleText(event) {
  const plural = (count) => `${count} ${count === 1 ? "adventurer" : "adventurers"}`;
  switch (event.type) {
    case "census-opened": return `The census was opened with ${plural(event.count)} on the muster roll.`;
    case "joined": return `A new ${event.entry.race} ${event.entry.characterClass} (${event.entry.role}) joined, bringing ${event.entry.profession1} and ${event.entry.profession2}. Realm preference: ${event.entry.server}.`;
    case "departed": return `${plural(event.count)} withdrew or changed their plans.`;
    case "milestone": return `The guild reached ${event.count} sealed names.`;
    case "leader-change": return `The leading ${event.category} changed from ${event.from} to ${event.to}.`;
    default: return "";
  }
}

export function renderChronicles(snapshot) {
  const events = [...(snapshot.chronicle || [])].reverse();
  const items = events.map((event) => `<li class="chronicle-entry chronicle-${escapeHtml(event.type)}"><time datetime="${escapeHtml(event.at)}">${escapeHtml(event.at.slice(0, 16).replace("T", " "))} UTC</time><p>${escapeHtml(chronicleText(event))}</p></li>`).join("");
  const content = events.length
    ? `<section class="parchment-panel chronicle-panel"><div class="panel-heading"><div><span>Guild history</span><h2>The Chronicle</h2><p>Every change to the roster, recorded anonymously as it happens.</p></div><strong>${events.length} ${events.length === 1 ? "entry" : "entries"}</strong></div><ol class="chronicle-list">${items}</ol></section>`
    : `<section class="parchment-panel empty-ledger"><h2>The Chronicle awaits its first page</h2><p>Roster changes will be recorded here after the next successful census sync.</p></section>`;
  return shell({ title: "Guild Chronicles", active: "/chronicles", snapshot, content, scripts: ["/assets/live-refresh.js"] });
}
