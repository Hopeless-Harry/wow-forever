import { classRoleMatrix } from "../domain/stats.js";
import { ERROR_COPY } from "../data/errors.js";
import { groupPlan, groupsToText } from "../domain/groups.js";
import { possibleDuplicates } from "../domain/members.js";
import { buildSummary } from "../domain/summary.js";
import { buildRaidPlan, factionProfessionGaps, gapCandidates, missingProfessions, professionDirectory, raidReadiness, rulesetVote } from "../domain/raid.js";
import { LAUNCH_AT, RAID_SIZES, answerFlags, comboWarning, factionOf, forRuleset, roleWarning, rulesetOptions } from "../domain/wow-data.js";
import { escapeHtml } from "./escape.js";

const CLASS_NAMES = new Set(["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid"]);

function classToken(value) {
  return CLASS_NAMES.has(value) ? ` class-${value.toLowerCase()}` : "";
}

function statusCopy(snapshot) {
  if (snapshot.status === "empty") return "Awaiting the first guild census sync";
  if (snapshot.lastRefreshFailed) return ERROR_COPY[snapshot.lastErrorKind] ?? ERROR_COPY.unreachable;
  if (snapshot.status === "stale") return "Showing an older safe copy while the ledger reconnects";
  return "Guild census synced";
}

function navLink(href, label, active) {
  const current = active === href ? ' aria-current="page"' : "";
  return `<a href="${href}"${current}>${label}</a>`;
}

const SITE_NAME = "Moms Against Magic";
const PAGE_DESCRIPTIONS = {
  "/": "Moms Against Magic guild ledger: raid readiness, class and role balance, and a roster summary for WoW Forever.",
  "/responses": "Every guild plan by entry number: class, role, race, ruleset and professions.",
  "/statistics": "Class, role, race, faction and profession breakdowns for the Moms Against Magic guild.",
  "/raid": "Raid planner for Moms Against Magic: role balance, class coverage and suggested groups of five by faction and ruleset.",
  "/members": "The Moms Against Magic roster: who plays what, with faction, ruleset and professions.",
  "/members/chronicle": "Who joined, left or changed their plans in the Moms Against Magic guild.",
  "/members/professions": "Who can craft or gather each profession in the Moms Against Magic guild, by faction.",
  default: "Moms Against Magic guild ledger for WoW Forever."
};

function shell({ title, active, snapshot, content, scripts = [], previewTitle = title }) {
  // Static text only, never guild data, so a link preview cached by Discord cannot go stale or leak anything.
  const description = PAGE_DESCRIPTIONS[active] ?? PAGE_DESCRIPTIONS.default;
  const scriptTags = [...scripts, "/assets/sync-time.js"].map((source) => `<script src="${source}" defer></script>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#120f0b">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(previewTitle)} · ${SITE_NAME}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta name="twitter:card" content="summary">
  <title>${escapeHtml(title)} · Moms Against Magic</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23171612'/%3E%3Ctext x='16' y='23' font-size='20' font-family='Georgia,serif' text-anchor='middle' fill='%23d2a743'%3EM%3C/text%3E%3C/svg%3E">
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
      <p class="privacy-mark">Names are public<br>to all visitors</p>
    </aside>
    <main id="main-content" class="ledger-main">
      <header class="ledger-topbar">
        <div><span class="realm-mark">WoW Forever</span><h1>${escapeHtml(title)}</h1></div>
        <div class="sync-rune"><span class="sync-dot" aria-hidden="true"></span><span role="status">${escapeHtml(statusCopy(snapshot))}</span>${snapshot.fetchedAt ? ` <time class="sync-time" data-sync-time datetime="${escapeHtml(snapshot.fetchedAt)}">updated ${escapeHtml(String(snapshot.fetchedAt).slice(11, 16))} UTC</time>` : ""}</div>
      </header>
      ${content}
      <footer>Emails, comments and response metadata are never read by this ledger.${snapshot.rejectedRows ? ` ${snapshot.rejectedRows} incomplete ${snapshot.rejectedRows === 1 ? "response was" : "responses were"} skipped.` : ""}</footer>
    </main>
  </div>
</body>
</html>`;
}

function filterForm(label, placeholder, firstSort, { faction = false } = {}) {
  return `<form class="census-tools" data-census-filters><label>${label}<input type="search" name="search" placeholder="${placeholder}"></label><label>Class<select name="class"><option value="">All classes</option></select></label><label>Role<select name="role"><option value="">All roles</option></select></label>${faction ? '<label>Faction<select name="faction"><option value="">Both</option></select></label>' : ""}<label>Ruleset<select name="server"><option value="">All rulesets</option></select></label><label>Sort<select name="sort"><option value="name">${firstSort}</option><option value="class">Class</option><option value="role">Role</option></select></label></form>`;
}

function rowAttrs({ search, characterClass, role, server, sort, faction = "" }) {
  return `${faction ? `data-faction="${escapeHtml(faction)}" ` : ""}data-search="${escapeHtml(search.toLowerCase())}" data-class="${escapeHtml(characterClass)}" data-role="${escapeHtml(role)}" data-server="${escapeHtml(server)}" data-sort="${escapeHtml(sort)}"`;
}

function count(total, one, many) {
  return `${total} ${total === 1 ? one : many}`;
}

function groupsSharePanel(text) {
  if (!text) return "";
  const over = text.length > 2000;
  return `<section class="parchment-panel summary-panel"><div class="panel-heading"><div><span>Share it</span><h2>Raid groups for Discord</h2><p>Names and classes of the suggested groups above, ready to paste.</p></div><button class="wow-button" type="button" data-copy-target="raid-groups-text" data-copy-status="raid-copy-status">Copy for Discord</button></div><label for="raid-groups-text" class="summary-label">Group list</label><textarea id="raid-groups-text" class="summary-text" readonly rows="8">${escapeHtml(text)}</textarea><p id="raid-copy-status" class="quiet" role="status"></p><p class="quiet">${text.length} characters${over ? ". That is over Discord's 2,000-character message limit, so paste it in two messages." : "."}</p></section>`;
}

function matrixPanel(records) {
  const { rows, totals } = classRoleMatrix(records);
  const cell = (value) => `<td class="${value ? "" : "zero"}">${value}</td>`;
  const body = rows.map((row) => `<tr><th scope="row"><span class="class-chip${classToken(row.characterClass)}">${escapeHtml(row.characterClass)}</span></th>${cell(row.tank)}${cell(row.healer)}${cell(row.dps)}${cell(row.flex)}<td><strong>${row.total}</strong></td></tr>`).join("");
  return `<section class="parchment-panel matrix-panel wide"><div class="panel-heading"><div><span>Who plays what</span><h2>Class by role</h2><p>How many players of each class chose each role. Counts only.</p></div></div><div class="table-scroll"><table aria-label="Players by class and role"><thead><tr><th scope="col">Class</th><th scope="col">Tank</th><th scope="col">Healer</th><th scope="col">DPS</th><th scope="col">Flexible</th><th scope="col">Total</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th scope="row">All classes</th><td>${totals.tank}</td><td>${totals.healer}</td><td>${totals.dps}</td><td>${totals.flex}</td><td><strong>${totals.total}</strong></td></tr></tfoot></table></div></section>`;
}

function emptyPanel(snapshot = {}) {
  if (snapshot.status && snapshot.status !== "empty") return `<section class="parchment-panel empty-ledger"><h2>No responses yet</h2><p>Nobody has filled in the roster Form yet. Entries appear here automatically.</p></section>`;
  return `<section class="parchment-panel empty-ledger"><h2>Waiting for the first sync</h2><p>The ledger has not received any guild data yet. It fills in automatically once the first sync completes. If it stays empty, ask a guild officer to check the response sheet connection.</p></section>`;
}

function rulesetCard(records) {
  const vote = rulesetVote(records);
  if (!vote.leader) {
    if (!vote.total) return leaderCard("Favoured ruleset", null);
    return `<article class="ledger-stat"><span>Favoured ruleset</span><strong>Any</strong><small>Everyone is happy with either</small></article>`;
  }
  const { leader, runnerUp, flexible, total } = vote;
  const detail = `${leader.canPlay} of ${total} could play it (${leader.chose} chose it${flexible ? ` + ${flexible} happy with either` : ""})`;
  const closeNote = vote.close ? `<small class="vote-close">Close call: ${escapeHtml(runnerUp.name)} has ${runnerUp.canPlay} of ${total}</small>` : "";
  return `<article class="ledger-stat"><span>Favoured ruleset</span><strong>${escapeHtml(leader.name)}</strong><small>${detail}</small>${closeNote}</article>`;
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

function readinessPanel(records) {
  const plan = raidReadiness(records);
  if (!plan.length) return "";
  const head = RAID_SIZES.map((size) => `<th scope="col">${size}-player</th>`).join("");
  const rows = plan.map((group) => `<tr><th scope="row">${escapeHtml(group.label)}<small>${count(group.total, "player", "players")}</small></th>${group.sizes.map((item) => `<td class="${item.ready ? "plan-ready" : "plan-short"}"><span class="plan-badge">${item.ready ? "Ready" : `Needs ${escapeHtml(item.needs.join(", "))}`}</span>${!item.ready && item.flexHelp ? `<small class="flex-help">${item.flexHelp} flexible ${item.flexHelp === 1 ? "player" : "players"} could help</small>` : ""}</td>`).join("")}</tr>`).join("");
  return `<section class="parchment-panel readiness-panel"><div class="panel-heading"><div><span>Raid readiness</span><h2>Can we raid?</h2><p>What each faction can field today, using rough role targets. Flexible players can close some gaps.</p></div><a class="wow-button" href="/raid">Open raid planner</a></div><div class="table-scroll"><table aria-label="Raid readiness by faction and raid size"><thead><tr><th scope="col">Faction</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function summaryPanel(snapshot, memberData) {
  const text = buildSummary(snapshot, memberData);
  return `<section class="parchment-panel summary-panel"><div class="panel-heading"><div><span>Share it</span><h2>Guild summary for Discord</h2><p>Counts only, no names. Paste it into your channel.</p></div><button class="wow-button" type="button" data-copy-target="guild-summary" data-copy-status="copy-status">Copy for Discord</button></div><label for="guild-summary" class="summary-label">Summary text</label><textarea id="guild-summary" class="summary-text" readonly rows="9">${escapeHtml(text)}</textarea><p id="copy-status" class="quiet" role="status"></p></section>`;
}

function activityPanel(events = []) {
  const recent = [...events].filter((event) => event.type !== "baseline").slice(-5).reverse();
  if (!recent.length) return "";
  const items = recent.map((event) => `<li class="chronicle-entry chronicle-${escapeHtml(event.type)}"><time datetime="${escapeHtml(event.at)}" data-local-time="date">${escapeHtml(event.at.slice(0, 10))}</time><p>${memberEventText(event)}</p></li>`).join("");
  return `<section class="parchment-panel chronicle-panel"><div class="panel-heading"><div><span>Latest news</span><h2>Recent activity</h2></div><a class="wow-button" href="/members/chronicle">Open chronicle</a></div><ol class="chronicle-list">${items}</ol></section>`;
}

export function renderDashboard(snapshot, memberData = { members: [], events: [] }) {
  if (!snapshot.records.length) return shell({ title: "Guild Ledger", active: "/", snapshot, content: emptyPanel(snapshot), scripts: ["/assets/live-refresh.js"] });
  const { leaders, distributions, totalResponses } = snapshot.stats;
  const flagCount = answerFlags(memberData.members ?? []).length;
  const duplicateCount = possibleDuplicates(memberData.members ?? []).length;
  const noticeParts = [
    flagCount ? (flagCount === 1 ? "1 roster answer looks unusual." : `${flagCount} roster answers look unusual.`) : "",
    duplicateCount ? (duplicateCount === 1 ? "1 possible duplicate entry." : `${duplicateCount} possible duplicate entries.`) : ""
  ].filter(Boolean);
  const noticeTotal = flagCount + duplicateCount;
  const content = `${noticeTotal ? `<p class="check-notice" role="note"><strong>${noticeParts.join(" ")}</strong> <a href="/members#check-panel">Review ${noticeTotal === 1 ? "it" : "them"} on the roster</a></p>` : ""}<aside class="launch-banner" data-launch="${escapeHtml(LAUNCH_AT)}"><span>WoW Forever launches</span><strong id="launch-countdown">4 November 2026, 3 PM PST</strong><small>Reported launch date</small></aside>
  <section class="ledger-overview" aria-labelledby="muster-heading">
    <div class="muster-count"><span>Responses received</span><strong>${totalResponses}</strong><h2 id="muster-heading">Adventurers mustered</h2></div>
    <div class="stat-rack">${rulesetCard(snapshot.records)}${leaderCard("Largest class", leaders.characterClass, "class-ledger")}${leaderCard("Main calling", leaders.role)}${leaderCard("Top profession", leaders.professions)}</div>
  </section>
  ${readinessPanel(snapshot.records)}
  <section class="dashboard-grid">${bars("Class muster", distributions.characterClass, "wide")}${bars("Role balance", distributions.role)}${bars("Ruleset preference", distributions.server)}</section>
  ${summaryPanel(snapshot, memberData)}
  ${activityPanel(memberData.events)}
  <section class="parchment-panel recent-panel"><div class="panel-heading"><div><span>Latest entries</span><h2>Recent roster entries</h2></div><a class="wow-button" href="/responses">Open full census</a></div><div class="table-scroll"><table aria-label="Recent roster entries"><thead><tr><th>Entry</th><th>Class</th><th>Role</th><th>Race</th><th>Professions</th></tr></thead><tbody>${recentRows(snapshot.records)}</tbody></table></div></section>`;
  return shell({ title: "Guild Ledger", active: "/", snapshot, content, scripts: ["/assets/countdown.js", "/assets/copy-summary.js", "/assets/local-time.js", "/assets/live-refresh.js"] });
}

export function renderResponses(snapshot) {
  const rows = snapshot.records.map((record, index) => `<tr ${rowAttrs({ search: Object.values(record).join(" "), characterClass: record.characterClass, role: record.role, server: record.server, sort: String(index + 1).padStart(6, "0") })}><th scope="row">${escapeHtml(record.anonymousId)}</th><td><span class="class-chip${classToken(record.characterClass)}">${escapeHtml(record.characterClass)}</span></td><td>${escapeHtml(record.role)}</td><td>${escapeHtml(record.race)}</td><td>${escapeHtml(record.server)}</td><td>${escapeHtml(record.profession1)}</td><td>${escapeHtml(record.profession2)}</td></tr>`).join("");
  const content = `<section class="parchment-panel census-panel"><div class="panel-heading"><div><span>By entry number</span><h2>Guild Census</h2><p>Aggregate plans by entry number. Named listings are in the roster.</p></div><strong id="visible-count" aria-live="polite" aria-atomic="true" data-singular="entry" data-plural="entries">${count(snapshot.records.length, "entry", "entries")}</strong></div>
    ${filterForm("Search the census", "Class, role, race or profession", "Response number")}
    <div class="table-scroll"><table id="census-table" aria-label="Guild census entries"><thead><tr><th>Entry</th><th>Class</th><th>Role</th><th>Race</th><th>Ruleset</th><th>Profession 1</th><th>Profession 2</th></tr></thead><tbody>${rows}</tbody></table></div><p class="no-results" role="status" hidden>No roster entries match those filters.</p>
  </section>`;
  return shell({ title: "Guild Census", active: "/responses", snapshot, content, scripts: ["/assets/table-filters.js", "/assets/live-refresh.js"] });
}

export function renderStatistics(snapshot) {
  const d = snapshot.stats.distributions;
  const content = snapshot.records.length ? `<section class="statistics-intro"><p>${count(snapshot.stats.totalResponses, "plan", "plans")}, counted exactly as submitted.</p></section><section class="statistics-grid">${bars("Class distribution", d.characterClass)}${bars("Role distribution", d.role)}${bars("Race distribution", d.race)}${bars("Faction split", d.faction)}${bars("Ruleset preference", d.server)}${matrixPanel(snapshot.records)}${bars("Profession demand", d.professions, "wide")}</section>` : emptyPanel(snapshot);
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
  const rows = members.map((member) => { const warning = comboWarning(member.race, member.characterClass); const roleNote = roleWarning(member.characterClass, member.role); const change = lastChange(memberData.events, member.name); return `<tr ${rowAttrs({ search: [member.name, member.characterClass, member.role, member.race, factionOf(member.race), member.server, member.profession1, member.profession2, change].join(" "), characterClass: member.characterClass, role: member.role, server: member.server, sort: member.name, faction: factionOf(member.race) })}><th scope="row"><a href="/member?name=${encodeURIComponent(member.name)}">${escapeHtml(member.name)}</a></th><td><span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span></td><td>${escapeHtml(member.role)}</td><td>${escapeHtml(member.race)}</td><td>${escapeHtml(factionOf(member.race))}</td><td>${escapeHtml(member.server)}</td><td>${escapeHtml(member.profession1)}</td><td>${escapeHtml(member.profession2)}</td><td>${escapeHtml(change)}${warning ? `<br><small class="combo-flag">⚠ ${escapeHtml(warning)} — check the form answer</small>` : ""}${roleNote ? `<br><small class="combo-flag">⚠ ${escapeHtml(roleNote)} — check the form answer</small>` : ""}</td></tr>`; }).join("");
    const flagged = answerFlags(members);
  const duplicates = possibleDuplicates(members);
  const link = (name) => `<a href="/member?name=${encodeURIComponent(name)}">${escapeHtml(name)}</a>`;
  const joinNames = (names) => (names.length === 2 ? `${link(names[0])} and ${link(names[1])}` : `${names.slice(0, -1).map(link).join(", ")} and ${link(names.at(-1))}`);
  const flagList = flagged.length ? `<ul class="check-list">${flagged.map(({ member, reason }) => `<li>${link(member.name)} — ${escapeHtml(reason)}</li>`).join("")}</ul>` : "";
  const duplicateList = duplicates.length ? `<h3 class="check-subheading">Possible duplicates</h3><p class="quiet">The same person may have filled in the Form twice. Ask them which entry to keep, then remove the other row from the response sheet.</p><ul class="check-list">${duplicates.map((names) => `<li>${joinNames(names)} may be the same person</li>`).join("")}</ul>` : "";
  const checkHeading = flagged.length ? `${count(flagged.length, "answer", "answers")} to double-check` : "Possible duplicates";
  const checkIntro = flagged.length ? "These look unusual. Ask the member to confirm; nothing is changed automatically." : "Nothing is changed automatically.";
  const checkPanel = flagged.length || duplicates.length ? `<section class="parchment-panel check-panel" id="check-panel" aria-labelledby="check-heading"><div class="panel-heading"><div><span>Worth a second look</span><h2 id="check-heading">${checkHeading}</h2><p>${checkIntro}</p></div></div>${flagList}${flagged.length ? duplicateList : duplicateList.replace(/<h3[^>]*>.*?<\/h3>/, "")}</section>` : "";
  const content = `${memberData.error ? `<p class="combo-flag" role="status">Names could not be refreshed (${escapeHtml(memberData.error === "mapping" ? "the name question changed on the Form" : "the last sync failed")}). Showing the last saved roster.</p>` : ""}${checkPanel}${members.length ? `<section class="parchment-panel census-panel"><div class="panel-heading"><div><span>Named roster</span><h2>Guild Roster</h2><p>Everyone's current plans, with their latest change. <a href="/members.csv">Download CSV</a></p></div><strong id="visible-count" aria-live="polite" aria-atomic="true" data-singular="member" data-plural="members">${members.length} ${members.length === 1 ? "member" : "members"}</strong></div>${filterForm("Search the roster", "Name, class, race or profession", "Name", { faction: true })}<p class="copy-names"><button class="wow-button" type="button" data-copy-names>Copy names</button> <span id="copy-names-status" class="quiet" role="status"></span></p><div class="table-scroll"><table id="census-table" aria-label="Guild roster"><thead><tr><th>Name</th><th>Class</th><th>Role</th><th>Race</th><th>Faction</th><th>Ruleset</th><th>Profession 1</th><th>Profession 2</th><th>Latest change</th></tr></thead><tbody>${rows}</tbody></table></div><p class="no-results" role="status" hidden>No members match those filters.</p></section>` : `<section class="parchment-panel empty-ledger"><h2>No members on the roll yet</h2><p>Members appear after the next successful census sync.</p></section>`}`;
  return shell({ title: "Guild Roster", active: "/members", snapshot, content, scripts: ["/assets/table-filters.js", "/assets/live-refresh.js"] });
}

function memberEventText(event) {
  const name = escapeHtml(event.name);
  switch (event.type) {
    case "baseline": return `The roll opened with ${escapeHtml(event.name)} ${Number(event.name) === 1 ? "adventurer" : "adventurers"}.`;
    case "joined": return `<strong>${name}</strong> joined as a ${escapeHtml(event.entry.race)} ${escapeHtml(event.entry.characterClass)} (${escapeHtml(event.entry.role)}) with ${escapeHtml(event.entry.profession1)} and ${escapeHtml(event.entry.profession2)}.`;
    case "left": return `<strong>${name}</strong> left the roll.`;
    case "changed": return `<strong>${name}</strong> changed ${escapeHtml(event.field)} from ${escapeHtml(event.from)} to ${escapeHtml(event.to)}.`;
    default: return "";
  }
}

const CHRONICLE_FILTERS = [["all", "All"], ["joined", "Joined"], ["left", "Left"], ["changed", "Changed"]];
const CHRONICLE_EMPTY = { joined: "Nobody has joined since the roll opened.", left: "Nobody has left the roll.", changed: "Nobody has changed their plans yet." };

export function renderMemberChronicle(snapshot, memberData, filter = "all") {
  const active = CHRONICLE_FILTERS.some(([key]) => key === filter) ? filter : "all";
  const all = [...memberData.events].reverse();
  const countOf = (key) => (key === "all" ? all.length : all.filter((event) => event.type === key).length);
  const events = active === "all" ? all : all.filter((event) => event.type === active);
  const tabs = `<nav class="member-tabs" aria-label="Filter the chronicle">${CHRONICLE_FILTERS.map(([key, label]) => `<a href="${key === "all" ? "/members/chronicle" : `/members/chronicle?type=${key}`}"${key === active ? ' aria-current="page"' : ""}>${label} (${countOf(key)})</a>`).join("")}</nav>`;
  const items = events.map((event) => `<li class="chronicle-entry chronicle-${escapeHtml(event.type)}"><time datetime="${escapeHtml(event.at)}" data-local-time="datetime">${escapeHtml(event.at.slice(0, 16).replace("T", " "))} UTC</time><p>${memberEventText(event)}</p></li>`).join("");
  const body = events.length
    ? `<ol class="chronicle-list">${items}</ol>`
    : `<p class="quiet">${active === "all" ? "Changes are recorded after the next successful census sync." : CHRONICLE_EMPTY[active]}</p>`;
  const content = all.length
    ? `${tabs}<section class="parchment-panel chronicle-panel"><div class="panel-heading"><div><span>Guild history</span><h2>Roster changes</h2><p>Who joined, who left and who changed their plans.</p></div><strong>${count(events.length, "entry", "entries")}</strong></div>${body}</section>`
    : `<section class="parchment-panel empty-ledger"><h2>The Chronicle awaits its first page</h2><p>Changes are recorded after the next successful census sync.</p></section>`;
  return shell({ title: "Guild Chronicle", active: "/members/chronicle", snapshot, content, scripts: ["/assets/local-time.js"] });
}

const ROLE_LABELS = { tank: "Tanks", healer: "Healers", dps: "Damage dealers" };

function gapNote(group, gaps) {
  if (gaps?.length) {
    const items = gaps.map((gap) => `<li><strong>${ROLE_LABELS[gap.role]} (short ${gap.short}):</strong> ${gap.candidates.map((member) => `<a href="/member?name=${encodeURIComponent(member.name)}">${escapeHtml(member.name)}</a> <span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span>`).join(", ")}</li>`).join("");
    return `<h3>Flexible players who could fill the gaps</h3><ul class="gap-list">${items}</ul>`;
  }
  return group.flex ? `<p class="quiet">${group.flex} flexible ${group.flex === 1 ? "player" : "players"} could fill a gap.</p>` : "";
}
const STATUS_LABELS = { ready: "Covered", short: "Short", missing: "Missing" };

function planRow(label, note, have, need, state) {
  return `<tr class="plan-${escapeHtml(state)}"><th scope="row">${escapeHtml(label)}${note ? `<small>${escapeHtml(note)}</small>` : ""}</th><td>${have} / ${need}</td><td><span class="plan-badge">${STATUS_LABELS[state]}</span></td></tr>`;
}

export function renderRaidPlan(snapshot, size = 40, memberData = { members: [] }, ruleset = "") {
  const query = (nextSize, nextRuleset) => `/raid?size=${nextSize}${nextRuleset ? `&ruleset=${encodeURIComponent(nextRuleset)}` : ""}`;
  const sizeTabs = `<nav class="member-tabs" aria-label="Raid size">${RAID_SIZES.map((option) => `<a href="${escapeHtml(query(option, ruleset))}"${option === size ? ' aria-current="page"' : ""}>${option}-player</a>`).join("")}</nav>`;
  const options = rulesetOptions([...snapshot.records, ...memberData.members]);
  const rulesetTabs = options.length > 1 ? `<nav class="member-tabs" aria-label="Ruleset"><a href="${escapeHtml(query(size, ""))}"${!ruleset ? ' aria-current="page"' : ""}>All rulesets</a>${options.map((option) => `<a href="${escapeHtml(query(size, option))}"${option === ruleset ? ' aria-current="page"' : ""}>${escapeHtml(option)}</a>`).join("")}</nav>` : "";
  const plan = buildRaidPlan(forRuleset(snapshot.records, ruleset), size);
  const gapsByFaction = gapCandidates(forRuleset(memberData.members, ruleset), size);
  const panels = plan.map((group) => `<section class="parchment-panel raid-panel"><div class="panel-heading"><div><span>${escapeHtml(group.faction)} muster</span><h2>${group.total} ${group.total === 1 ? "adventurer" : "adventurers"}</h2></div></div>
    <h3>Roles</h3><div class="table-scroll"><table aria-label="${escapeHtml(group.faction)} role balance"><thead><tr><th>Role</th><th>Have / aim</th><th>Status</th></tr></thead><tbody>${group.roles.map((row) => planRow(ROLE_LABELS[row.role], "", row.have, row.need, row.status)).join("")}</tbody></table></div>${gapNote(group, gapsByFaction.get(group.faction))}
    <h3>Class coverage</h3><div class="table-scroll"><table aria-label="${escapeHtml(group.faction)} class coverage"><thead><tr><th>Class</th><th>Have / aim</th><th>Status</th></tr></thead><tbody>${group.utility.map((row) => planRow(row.label, row.note, row.have, row.need, row.status)).join("")}</tbody></table></div></section>`).join("");
  const groupData = groupPlan(forRuleset(memberData.members, ruleset), size);
  const groups = groupData.map((faction) => `<section class="parchment-panel raid-panel wide"><div class="panel-heading"><div><span>${escapeHtml(faction.faction)} suggested groups</span><h2>${faction.groups.reduce((sum, group) => sum + group.members.length, 0)} placed${faction.bench.length ? `, ${faction.bench.length} on the bench` : ""}</h2></div></div><p class="quiet">Ruleset preferences: ${faction.rulesets.map((item) => `${escapeHtml(item.label)} (${item.count})`).join(" · ")}. Players can only group within one faction and one ruleset.</p><div class="group-grid">${faction.groups.map((group, index) => `<article class="group-card"><h3>Group ${index + 1}</h3><ul>${group.members.map((member) => `<li><strong>${escapeHtml(member.name)}</strong><span class="member-meta"><span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span> <span aria-hidden="true">·</span> ${escapeHtml(member.role)}</span></li>`).join("") || '<li class="quiet">Open slots</li>'}</ul></article>`).join("")}</div>${faction.bench.length ? `<p class="quiet">Bench: ${faction.bench.map((member) => escapeHtml(member.name)).join(", ")}</p>` : ""}</section>`).join("");
  const content = snapshot.records.length
    ? `${sizeTabs}${rulesetTabs}<p class="quiet">Factions cannot group together, so each side is planned separately.${ruleset ? ` Showing players who chose ${escapeHtml(ruleset)} or are happy with either.` : ""}${options.length > 1 && !ruleset ? ' <strong class="pool-warning">Members chose different rulesets, so these totals pool everyone. Pick a ruleset above to plan a group that can really play together.</strong>' : ""} Targets are a rough guide from community raid advice, not a rule.</p><div class="statistics-grid">${panels}</div>${groups}${groupsSharePanel(groupsToText(groupData, size, ruleset))}`
    : emptyPanel(snapshot);
  return shell({ title: "Raid Planner", active: "/raid", snapshot, content, scripts: ["/assets/copy-summary.js", "/assets/live-refresh.js"] });
}

export function renderProfessions(snapshot, memberData) {
  const directory = professionDirectory(memberData.members);
  const cards = directory.map((entry) => `<section class="parchment-panel profession-card"><h2>${escapeHtml(entry.profession)} <small>${entry.crafters.length} ${entry.crafters.length === 1 ? "crafter" : "crafters"}</small></h2><ul>${entry.crafters.map((member) => `<li><a href="/member?name=${encodeURIComponent(member.name)}"><strong>${escapeHtml(member.name)}</strong></a> <span aria-hidden="true">·</span> <span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span> <span aria-hidden="true">·</span> <small class="faction-tag">${escapeHtml(factionOf(member.race))}</small></li>`).join("")}</ul></section>`).join("");
  const gaps = missingProfessions(memberData.members);
  const gapPanel = directory.length && (gaps.primary.length || gaps.secondary.length)
    ? `<section class="parchment-panel profession-card"><h2>Nobody yet</h2><p>${[...gaps.primary, ...gaps.secondary].map((name) => escapeHtml(name)).join(", ")}</p></section>`
    : "";
  const sideGaps = factionProfessionGaps(memberData.members);
  const sidePanel = sideGaps.length
    ? `<section class="parchment-panel profession-card"><h2>Only one faction has these</h2><p>Horde and Alliance cannot trade, so these sides still need a crafter:</p><ul>${sideGaps.map((entry) => `<li><strong>${escapeHtml(entry.faction)}</strong> has no ${entry.missing.map((name) => escapeHtml(name)).join(", ")}</li>`).join("")}</ul></section>`
    : "";
  const content = directory.length
    ? `<p class="quiet">Who can craft or gather what. Professions listed on the Form only — skill levels are not tracked.</p><div class="statistics-grid">${gapPanel}${sidePanel}${cards}</div>`
    : `<section class="parchment-panel empty-ledger"><h2>No professions recorded yet</h2><p>They appear after the next successful census sync.</p></section>`;
  return shell({ title: "Profession Directory", active: "/members/professions", snapshot, content });
}

export function renderMemberProfile(snapshot, memberData, name) {
  const key = String(name || "").toLowerCase();
  const member = memberData.members.find((entry) => entry.name.toLowerCase() === key);
  if (!member) {
    return shell({ title: "Member not found", active: "/members", snapshot, content: `<section class="parchment-panel empty-ledger"><h2>No such adventurer</h2><p>That name is not on the roll. <a href="/members">Back to the roster</a>.</p></section>` });
  }
  const notes = [comboWarning(member.race, member.characterClass), roleWarning(member.characterClass, member.role)].filter(Boolean);
  const history = memberData.events.filter((event) => event.type !== "baseline" && event.name.toLowerCase() === key).reverse();
  const items = history.map((event) => `<li class="chronicle-entry chronicle-${escapeHtml(event.type)}"><time datetime="${escapeHtml(event.at)}" data-local-time="datetime">${escapeHtml(event.at.slice(0, 16).replace("T", " "))} UTC</time><p>${memberEventText(event)}</p></li>`).join("");
  const content = `<section class="parchment-panel census-panel"><div class="panel-heading"><div><span>${escapeHtml(factionOf(member.race))} adventurer</span><h2>${escapeHtml(member.name)}</h2><p><span class="class-chip${classToken(member.characterClass)}">${escapeHtml(member.characterClass)}</span> · ${escapeHtml(member.role)} · ${escapeHtml(member.race)}</p></div><a class="wow-button" href="/members">Back to roster</a></div>
    <dl class="profile-facts"><div><dt>Ruleset preference</dt><dd>${escapeHtml(member.server)}</dd></div><div><dt>Profession 1</dt><dd>${escapeHtml(member.profession1)}</dd></div><div><dt>Profession 2</dt><dd>${escapeHtml(member.profession2)}</dd></div></dl>
    ${notes.map((note) => `<p class="combo-flag">⚠ ${escapeHtml(note)} — check the form answer</p>`).join("")}</section>
  <section class="parchment-panel chronicle-panel"><div class="panel-heading"><div><span>History</span><h2>${escapeHtml(member.name)}'s chronicle</h2></div></div>${items ? `<ol class="chronicle-list">${items}</ol>` : '<p class="quiet">No changes recorded since the roll opened.</p>'}</section>`;
  // The page title shows the name, but link previews are cached by other services, so they stay generic.
  return shell({ title: member.name, previewTitle: "Guild member profile", active: "/members", snapshot, content, scripts: ["/assets/local-time.js"] });
}

const ERROR_PAGES = {
  404: { title: "Page not found", heading: "That page isn't here", text: "The link may be old or mistyped." },
  4: { title: "Link problem", heading: "That link doesn't look right", text: "Check the address and try again." },
  5: { title: "Something went wrong", heading: "The ledger hit a problem", text: "Please try again in a minute. If it keeps happening, tell a guild officer." }
};

// Friendly error page. It never repeats the requested address or any error detail.
export function renderErrorPage(snapshot, status) {
  const page = ERROR_PAGES[status] ?? ERROR_PAGES[Math.floor(status / 100)] ?? ERROR_PAGES[5];
  const content = `<section class="parchment-panel empty-ledger"><h2>${escapeHtml(page.heading)}</h2><p>${escapeHtml(page.text)}</p><p><a class="wow-button" href="/">Back to the dashboard</a></p><p>Or go to the <a href="/members">roster</a>, the <a href="/raid">raid planner</a> or the <a href="/statistics">statistics</a>.</p></section>`;
  return shell({ title: page.title, active: "", snapshot: snapshot ?? { status: "fresh", fetchedAt: null, lastRefreshFailed: false, records: [] }, content });
}
