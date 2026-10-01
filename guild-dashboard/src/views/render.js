import { buildRaidPlan, professionDirectory } from "../domain/raid.js";
import { RAID_SIZES, comboWarning, factionOf } from "../domain/wow-data.js";
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
      <nav>${navLink("/", "Dashboard", active)}${navLink("/responses", "Guild Census", active)}${navLink("/statistics", "Statistics", active)}${navLink("/raid", "Raid Planner", active)}${navLink("/members", "Roster", active)}${navLink("/members/professions", "Professions", active)}${navLink("/members/chronicle", "Chronicle", active)}</nav>
      <p class="privacy-mark">Every adventurer<br>on the roll</p>
    </aside>
    <main id="main-content" class="ledger-main">
      <header class="ledger-topbar">
        <div><span class="realm-mark">WoW Forever</span><h1>${escapeHtml(title)}</h1></div>
        <div class="sync-rune" role="status"><span aria-hidden="true"></span>${escapeHtml(statusCopy(snapshot))}</div>
      </header>
      ${content}
      <footer>Emails, comments and response metadata are never read by this ledger.</footer>
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

function lastChange(events, name) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.name !== name) continue;
    const day = event.at.slice(0, 10);
    if (event.type === "changed") return `${day}: ${event.field} ${event.from} → ${event.to}`;
    if (event.type === "joined") return `${day}: joined`;
  }
  return "—";
}

export function renderMembers(snapshot, memberData) {
  const members = [...memberData.members].sort((a, b) => a.name.localeCompare(b.name));
  const rows = members.map((member) => `<tr><th scope="row">${escapeHtml(member.name)}</th><td><span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span></td><td>${escapeHtml(member.role)}</td><td>${escapeHtml(member.race)}</td><td>${escapeHtml(factionOf(member.race))}</td><td>${escapeHtml(member.server)}</td><td>${escapeHtml(member.profession1)}</td><td>${escapeHtml(member.profession2)}</td><td>${escapeHtml(lastChange(memberData.events, member.name))}${comboWarning(member.race, member.characterClass) ? `<br><small class="combo-flag">⚠ ${escapeHtml(comboWarning(member.race, member.characterClass))} — check the form answer</small>` : ""}</td></tr>`).join("");
  const content = `${members.length ? `<section class="parchment-panel census-panel"><div class="panel-heading"><div><span>Named roster</span><h2>Guild Roster</h2><p>Everyone's current plans, with their latest change.</p></div><strong>${members.length} ${members.length === 1 ? "member" : "members"}</strong></div><div class="table-scroll"><table><thead><tr><th>Name</th><th>Class</th><th>Role</th><th>Race</th><th>Faction</th><th>Realm</th><th>Profession 1</th><th>Profession 2</th><th>Latest change</th></tr></thead><tbody>${rows}</tbody></table></div></section>` : `<section class="parchment-panel empty-ledger"><h2>No members on the roll yet</h2><p>Members appear after the next successful census sync.</p></section>`}`;
  return shell({ title: "Guild Roster", active: "/members", snapshot, content });
}

function memberEventText(event) {
  const name = escapeHtml(event.name);
  switch (event.type) {
    case "baseline": return `The members' roll opened with ${escapeHtml(event.name)} on the muster.`;
    case "joined": return `<strong>${name}</strong> joined as a ${escapeHtml(event.entry.race)} ${escapeHtml(event.entry.characterClass)} (${escapeHtml(event.entry.role)}) with ${escapeHtml(event.entry.profession1)} and ${escapeHtml(event.entry.profession2)}.`;
    case "left": return `<strong>${name}</strong> left the roll.`;
    case "changed": return `<strong>${name}</strong> changed ${escapeHtml(event.field)} from ${escapeHtml(event.from)} to ${escapeHtml(event.to)}.`;
    default: return "";
  }
}

export function renderMemberChronicle(snapshot, memberData) {
  const events = [...memberData.events].reverse();
  const items = events.map((event) => `<li class="chronicle-entry chronicle-${escapeHtml(event.type)}"><time datetime="${escapeHtml(event.at)}">${escapeHtml(event.at.slice(0, 16).replace("T", " "))} UTC</time><p>${memberEventText(event)}</p></li>`).join("");
  const content = `${events.length ? `<section class="parchment-panel chronicle-panel"><div class="panel-heading"><div><span>Guild history</span><h2>Guild Chronicle</h2><p>Who joined, who left and who changed their plans.</p></div><strong>${events.length} ${events.length === 1 ? "entry" : "entries"}</strong></div><ol class="chronicle-list">${items}</ol></section>` : `<section class="parchment-panel empty-ledger"><h2>The Chronicle awaits its first page</h2><p>Changes are recorded after the next successful census sync.</p></section>`}`;
  return shell({ title: "Guild Chronicle", active: "/members/chronicle", snapshot, content });
}

const ROLE_LABELS = { tank: "Tanks", healer: "Healers", dps: "Damage dealers" };
const STATUS_LABELS = { ready: "Covered", short: "Short", missing: "Missing" };

function planRow(label, note, have, need, state) {
  return `<tr class="plan-${escapeHtml(state)}"><th scope="row">${escapeHtml(label)}${note ? `<small>${escapeHtml(note)}</small>` : ""}</th><td>${have} / ${need}</td><td><span class="plan-badge">${STATUS_LABELS[state]}</span></td></tr>`;
}

export function renderRaidPlan(snapshot, size = 40) {
  const sizeTabs = `<nav class="member-tabs" aria-label="Raid size">${RAID_SIZES.map((option) => `<a href="/raid?size=${option}"${option === size ? ' aria-current="page"' : ""}>${option}-player</a>`).join("")}</nav>`;
  const plan = buildRaidPlan(snapshot.records, size);
  const panels = plan.map((group) => `<section class="parchment-panel raid-panel"><div class="panel-heading"><div><span>${escapeHtml(group.faction)} muster</span><h2>${group.total} ${group.total === 1 ? "adventurer" : "adventurers"}</h2></div></div>
    <h3>Roles</h3><table><thead><tr><th>Role</th><th>Have / aim</th><th>Status</th></tr></thead><tbody>${group.roles.map((row) => planRow(ROLE_LABELS[row.role], "", row.have, row.need, row.status)).join("")}</tbody></table>${group.flex ? `<p class="quiet">${group.flex} flexible ${group.flex === 1 ? "player" : "players"} could fill a gap.</p>` : ""}
    <h3>Class coverage</h3><table><thead><tr><th>Class</th><th>Have / aim</th><th>Status</th></tr></thead><tbody>${group.utility.map((row) => planRow(row.label, row.note, row.have, row.need, row.status)).join("")}</tbody></table></section>`).join("");
  const content = snapshot.records.length
    ? `${sizeTabs}<p class="quiet">Factions cannot group together, so each side is planned separately. Targets are a rough guide from community raid advice, not a rule.</p><div class="statistics-grid">${panels}</div>`
    : emptyPanel();
  return shell({ title: "Raid Planner", active: "/raid", snapshot, content, scripts: ["/assets/live-refresh.js"] });
}

export function renderProfessions(snapshot, memberData) {
  const directory = professionDirectory(memberData.members);
  const cards = directory.map((entry) => `<section class="parchment-panel profession-card"><h2>${escapeHtml(entry.profession)} <small>${entry.crafters.length}</small></h2><ul>${entry.crafters.map((member) => `<li><strong>${escapeHtml(member.name)}</strong> <span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span></li>`).join("")}</ul></section>`).join("");
  const content = directory.length
    ? `<p class="quiet">Who can craft or gather what. Professions listed on the Form only — skill levels are not tracked.</p><div class="statistics-grid">${cards}</div>`
    : `<section class="parchment-panel empty-ledger"><h2>No professions recorded yet</h2><p>They appear after the next successful census sync.</p></section>`;
  return shell({ title: "Profession Directory", active: "/members/professions", snapshot, content });
}
