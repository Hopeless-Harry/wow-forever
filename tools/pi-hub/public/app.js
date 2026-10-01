// Behaviour for the dashboard. Loaded as an external file because the Content-Security-Policy forbids inline scripts.
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mam' }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({ ok: false, error: 'bad response' })));

const filter = document.getElementById('filter');
if (filter) filter.addEventListener('input', () => {
  const q = filter.value.toLowerCase();
  document.querySelectorAll('#members tbody tr').forEach((row) => { row.hidden = q !== '' && !row.textContent.toLowerCase().includes(q); });
});

const composer = document.getElementById('composer');
if (composer) {
  const show = () => composer.querySelectorAll('[data-kind]').forEach((el) => { el.hidden = !el.dataset.kind.split(' ').includes(composer.kind.value); });
  composer.kind.addEventListener('change', show); show();
  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = composer; const kind = f.kind.value; const out = document.getElementById('result');
    const body = { kind };
    if (kind === 'announce') body.text = f.text.value;
    if (kind === 'award' || kind === 'revoke') { body.target = f.target.value.trim(); body.medal = f.medal.value; }
    if (kind === 'quests') { body.week = Number(f.week.value); body.slots = [f.slot1.value, f.slot2.value, f.slot3.value]; }
    if (kind === 'config') { body.key = 'motd'; body.text = f.motd.value; }
    const r = await post('/api/ui/commands', body);
    out.textContent = r.ok ? `Queued as #${r.id}. It is sent when the gateway reloads.` : (r.error || 'Failed');
    if (r.ok) setTimeout(() => location.reload(), 900);
  });
}

const userform = document.getElementById('userform');
if (userform) {
  userform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await post('/api/ui/users', { action: 'save', name: userform.name.value.trim(), role: userform.role.value, password: userform.password.value });
    document.getElementById('result').textContent = r.ok ? 'Saved.' : (r.error || 'Failed');
    if (r.ok) setTimeout(() => location.reload(), 600);
  });
  document.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Remove the login for ${b.dataset.remove}?`)) return;
    const r = await post('/api/ui/users', { action: 'remove', name: b.dataset.remove });
    if (r.ok) location.reload(); else alert(r.error || 'Failed');
  }));
}
