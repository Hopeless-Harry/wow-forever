// Builds the two tester documents as standalone HTML files (no network, no libraries):
//   TESTER-CHECKLIST.html  interactive checklist (Pass / Fail / Skip, notes, saved in the browser, copy results)
//   MOM-MEDALS-CATALOGUE.html  searchable and filterable list of every medal, generated from the addon's own definitions
// Usage: node tools/mam-chronicles/docs/build-html.mjs <output folder>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness, repositoryRoot } from '../test/harness.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] || resolve(repositoryRoot, 'dist', 'html'));
mkdirSync(outDir, { recursive: true });
const version = /## Version: (\S+)/.exec(readFileSync(resolve(repositoryRoot, 'addons', 'MAMChronicles', 'MAMChronicles.toc'), 'utf8'))[1];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/_{6,}/g, '<input class="blank" type="text" aria-label="fill in">');

const baseCss = `
:root{--bg:#16120e;--panel:#1d1812;--raised:#2a2116;--line:#6b5530;--text:#f2ead8;--muted:#b9ab86;--gold:#ffd100;--red:#7a1c1c;--green:#4caf50;--bad:#e05a4f}
@media (prefers-color-scheme: light){:root{--bg:#f6f0e2;--panel:#fffaf0;--raised:#efe4c8;--line:#a8843f;--text:#2a2116;--muted:#6b5a36;--gold:#8a5a00;--red:#9b2424;--green:#2e7d32;--bad:#b3261e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 "Segoe UI",system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 18px 80px}
h1{font-family:Georgia,serif;color:var(--gold);font-weight:500;font-size:28px;margin:0 0 4px}
h2{font-family:Georgia,serif;color:var(--gold);font-weight:500;font-size:20px;margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)}
h3{color:var(--gold);font-weight:500;font-size:16px}
p,li{color:var(--text)}.muted{color:var(--muted);font-size:14px}code{background:var(--raised);padding:1px 6px;border-radius:4px;font-size:.92em}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}
button,select,input[type=search],input[type=text]{font:inherit;color:var(--text);background:var(--raised);border:1px solid var(--line);border-radius:6px;padding:6px 10px}
button{cursor:pointer}button:hover{border-color:var(--gold)}button.primary{background:var(--red);border-color:#c9a227;color:#ffe9b0}
input.blank{width:170px;padding:2px 8px;margin:0 2px}
@media print{body{background:#fff;color:#000}.noprint{display:none!important}}
`;

// ---------------------------------------------------------------- checklist
function buildChecklist() {
  const md = readFileSync(resolve(repositoryRoot, 'docs', 'testing', 'mam-chronicles-phase1-tester-checklist.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  let title = 'Tester checklist', body = [], inList = false, section = 0, item = 0;
  const closeList = () => { if (inList) { body.push('</ul>'); inList = false; } };
  for (const line of md) {
    let m;
    if ((m = /^# (.+)/.exec(line))) title = m[1];
    else if ((m = /^## (.+)/.exec(line))) { closeList(); section++; body.push(`<h2>${inline(m[1])}</h2>`); }
    else if ((m = /^- \[ \] (.+)/.exec(line))) {
      if (!inList) { body.push('<ul class="items">'); inList = true; }
      item++;
      body.push(`<li class="item" data-id="i${item}" data-text="${esc(m[1])}"><div class="row"><span class="txt">${inline(m[1])}</span><span class="btns noprint"><button data-v="pass">Pass</button><button data-v="fail">Fail</button><button data-v="skip">Skip</button></span></div><input class="note noprint" type="text" placeholder="Note (what happened?)" aria-label="note"></li>`);
    }
    else if ((m = /^- (.+)/.exec(line))) { if (!inList) { body.push('<ul>'); inList = true; } body.push(`<li>${inline(m[1])}</li>`); }
    else if (line.trim() === '') closeList();
    else if (!/^#/.test(line)) { closeList(); body.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  const css = baseCss + `
.items{list-style:none;padding:0;margin:8px 0}.item{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:6px;padding:8px 10px;margin:6px 0}
.row{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.txt{flex:1}.btns{display:flex;gap:4px;flex:none}.btns button{padding:3px 10px;font-size:13px}
.item.pass{border-left-color:var(--green)}.item.fail{border-left-color:var(--bad)}.item.skip{border-left-color:var(--muted);opacity:.8}
.item[data-state=pass] [data-v=pass]{background:var(--green);color:#fff;border-color:var(--green)}.item[data-state=fail] [data-v=fail]{background:var(--bad);color:#fff;border-color:var(--bad)}.item[data-state=skip] [data-v=skip]{background:var(--muted);color:var(--bg)}
.note{display:none;width:100%;margin-top:6px}.item.fail .note,.item.hasnote .note{display:block}
.bar{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.meter{flex:1;min-width:160px;height:10px;background:var(--raised);border-radius:6px;overflow:hidden}.meter i{display:block;height:100%;background:var(--green);width:0}
`;
  const script = `
const KEY='mam-checklist-${version}';let data={};try{data=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const items=[...document.querySelectorAll('.item')];
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}}
function paint(li){const d=data[li.dataset.id]||{};li.dataset.state=d.v||'';li.classList.toggle('pass',d.v==='pass');li.classList.toggle('fail',d.v==='fail');li.classList.toggle('skip',d.v==='skip');const n=li.querySelector('.note');n.value=d.n||'';li.classList.toggle('hasnote',!!d.n)}
function tally(){let p=0,f=0,s=0;for(const li of items){const v=(data[li.dataset.id]||{}).v;if(v==='pass')p++;else if(v==='fail')f++;else if(v==='skip')s++}const done=p+f+s;document.getElementById('tally').textContent=p+' passed, '+f+' failed, '+s+' skipped, '+(items.length-done)+' to do';document.querySelector('.meter i').style.width=(items.length?done/items.length*100:0)+'%'}
items.forEach(li=>{paint(li);li.querySelectorAll('.btns button').forEach(b=>b.addEventListener('click',()=>{const id=li.dataset.id;const cur=data[id]||{};cur.v=cur.v===b.dataset.v?'':b.dataset.v;data[id]=cur;save();paint(li);tally()}));li.querySelector('.note').addEventListener('input',e=>{const id=li.dataset.id;const cur=data[id]||{};cur.n=e.target.value;data[id]=cur;save();li.classList.toggle('hasnote',!!cur.n)})});
document.querySelectorAll('input.blank').forEach((inp,i)=>{const k='blank'+i;inp.value=data[k]||'';inp.addEventListener('input',()=>{data[k]=inp.value;save()})});
document.getElementById('copy').addEventListener('click',async()=>{const lines=['MAM Chronicles ${version} tester results','Tester: '+(document.getElementById('who').value||'?')+'   Client: '+(document.getElementById('client').value||'?'),document.getElementById('tally').textContent,''];for(const li of items){const d=data[li.dataset.id]||{};if(d.v==='fail'||d.n)lines.push((d.v==='fail'?'FAIL: ':(d.v?d.v.toUpperCase()+': ':'NOTE: '))+li.dataset.text+(d.n?'  ->  '+d.n:''))}const t=lines.join('\\n');try{await navigator.clipboard.writeText(t);document.getElementById('msg').textContent='Copied. Paste it into your message.'}catch(e){window.prompt('Copy this:',t)}});
document.getElementById('reset').addEventListener('click',()=>{if(confirm('Clear every answer on this page?')){data={};save();items.forEach(paint);document.querySelectorAll('input.blank').forEach(i=>i.value='');tally()}});
tally();`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAM Chronicles tester checklist</title><style>${css}</style></head><body><main>
<h1>${esc(title)}</h1><p class="muted">Version ${esc(version)}. Your answers are saved in this browser. When you finish, press Copy results and paste them to Harry together with <code>/mam diag</code>.</p>
<div class="bar noprint"><span id="tally" class="muted"></span><span class="meter"><i></i></span><button class="primary" id="copy">Copy results</button><button id="reset">Clear all</button><span id="msg" class="muted"></span></div>
<div class="card noprint"><label>Your name <input id="who" type="text" placeholder="Name"></label> &nbsp; <label>Client <select id="client"><option value="">choose</option><option>WoW Forever</option><option>Retail</option></select></label></div>
${body.join('\n')}
</main><script>${script}</script></body></html>`;
  writeFileSync(resolve(outDir, 'TESTER-CHECKLIST.html'), html);
}

// ---------------------------------------------------------------- catalogue
function buildCatalogue() {
  const h = createHarness();
  h.load(['Core.lua', 'Database.lua', 'EventStore.lua', 'Collectors.lua', 'Statistics.lua', 'AchievementStats.lua', 'Medals.lua']);
  const n = h.get('#MAMChronicles.Medals:GetDefinitions()');
  const medals = [];
  for (let i = 1; i <= n; i++) {
    const p = `MAMChronicles.Medals:GetDefinitions()[${i}]`;
    const titles = h.get(`MAMChronicles.Medals.titles[${p}.family]`);
    medals.push({ id: h.get(`${p}.id`), family: h.get(`${p}.family`), name: h.get(`${p}.name`), tier: h.get(`${p}.tier`), points: h.get(`${p}.points`), description: h.get(`${p}.description`), tracking: h.get(`${p}.tracking`), category: h.get(`${p}.category`), client: h.get(`${p}.client`) || 'both', needsStat: !!h.get(`${p}.needsStat`), title: titles || '' });
  }
  const cats = []; const c = h.get('#MAMChronicles.Medals.categories');
  for (let i = 1; i <= c; i++) cats.push({ key: h.get(`MAMChronicles.Medals.categories[${i}].key`), label: h.get(`MAMChronicles.Medals.categories[${i}].label`) });
  const families = new Set(medals.map(m => m.family)).size; const total = medals.reduce((s, m) => s + m.points, 0);
  const css = baseCss + `
.filters{position:sticky;top:0;z-index:2;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap;align-items:center}.filters input[type=search]{flex:1;min-width:200px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14.5px}th{position:sticky;top:58px;background:var(--panel);text-align:left;color:var(--gold);font-weight:500;padding:8px;border-bottom:1px solid var(--line)}td{padding:7px 8px;border-bottom:1px solid color-mix(in srgb,var(--line) 40%,transparent);vertical-align:top}
.t{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:6px;border:1px solid rgba(0,0,0,.4)}.bronze{background:#cd7f32}.silver{background:#c0c8d4}.gold{background:#f0c040}.platinum{background:#7fe0f0}
.tag{font-size:12px;padding:1px 7px;border:1px solid var(--line);border-radius:10px;color:var(--muted);white-space:nowrap}.fam td{background:var(--panel)}
.sub{color:var(--muted);font-size:13px}@media (max-width:700px){th:nth-child(5),td:nth-child(5){display:none}}
`;
  const data = JSON.stringify(medals).replace(/</g, '\\u003c');
  const script = `
const M=${data};const CATS=${JSON.stringify(cats)};const label=Object.fromEntries(CATS.map(c=>[c.key,c.label]));
const $=id=>document.getElementById(id);const body=$('rows');
function render(){const q=$('q').value.toLowerCase().trim(),cat=$('cat').value,tier=$('tier').value,cl=$('client').value;let shown=0,pts=0;const out=[];
for(const m of M){if(cat&&m.category!==cat)continue;if(tier&&m.tier!==tier)continue;if(cl==='forever'&&m.client!=='forever')continue;if(cl==='retail'&&m.client==='forever')continue;if(cl==='both'&&m.client!=='both')continue;
const hay=(m.name+' '+m.description+' '+m.title+' '+m.tracking).toLowerCase();if(q&&!hay.includes(q))continue;shown++;pts+=m.points;
const notes=[m.client==='forever'?'WoW Forever only':(m.client==='retail'?'Retail only':''),m.needsStat?'needs a game statistic':''].filter(Boolean).map(t=>'<span class="tag">'+t+'</span>').join(' ');
out.push('<tr><td><span class="t '+m.tier+'"></span><strong>'+esc(m.name)+'</strong><div class="sub">'+esc(m.title)+'</div></td><td>'+esc(m.description)+'<div class="sub">'+esc(m.tracking)+'</div></td><td>+'+m.points+'</td><td>'+esc(label[m.category]||m.category)+'</td><td>'+notes+'</td></tr>')}
body.innerHTML=out.join('');$('count').textContent=shown+' of '+M.length+' medals, '+pts+' Mom Money'}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
for(const c of CATS){const o=document.createElement('option');o.value=c.key;o.textContent=c.label;$('cat').appendChild(o)}
['q','cat','tier','client'].forEach(id=>$(id).addEventListener('input',render));render();`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mom Medals catalogue</title><style>${css}</style></head><body><main>
<h1>Mom Medals catalogue</h1><p class="muted">Version ${esc(version)}. ${medals.length} medals in ${families} families, worth ${total} Mom Money across both clients. Tiers: bronze 10, silver 25, gold 50, platinum 100. Level medals only appear when the client's level cap allows them (WoW Forever caps at 60), WoW Forever medals are hidden on Retail, Retail-only medals are hidden on Forever, and medals that need a game statistic stay locked if the client does not report it. Holiday dates are approximate.</p>
<div class="filters"><input id="q" type="search" placeholder="Search medals, titles or how they are tracked" aria-label="search"><select id="cat" aria-label="category"><option value="">All categories</option></select><select id="tier" aria-label="tier"><option value="">All tiers</option><option>bronze</option><option>silver</option><option>gold</option><option>platinum</option></select><select id="client" aria-label="client"><option value="">Both clients</option><option value="both">Works on both</option><option value="forever">WoW Forever only</option><option value="retail">Retail only</option></select><span id="count" class="muted"></span></div>
<table><thead><tr><th>Medal and title</th><th>What it needs and how it is tracked</th><th>Mom Money</th><th>Category</th><th>Notes</th></tr></thead><tbody id="rows"></tbody></table>
</main><script>${script}</script></body></html>`;
  writeFileSync(resolve(outDir, 'MOM-MEDALS-CATALOGUE.html'), html);
  return { medals: medals.length, families, total };
}

buildChecklist();
const stats = buildCatalogue();
console.log(`wrote TESTER-CHECKLIST.html and MOM-MEDALS-CATALOGUE.html (${stats.medals} medals, ${stats.families} families, ${stats.total} Mom Money) to ${outDir}`);
