import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, resolve } from 'node:path'; import { spawnSync } from 'node:child_process';
import { repositoryRoot, createHarness } from './harness.js';

const script = resolve(repositoryRoot, 'tools', 'mam-chronicles', 'docs', 'build-html.mjs');
const out = mkdtempSync(join(tmpdir(), 'mam-html-'));
const run = spawnSync('node', [script, out], { encoding: 'utf8' });
const read = name => readFileSync(join(out, name), 'utf8');

test('the HTML documents build without errors', () => {
  assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /wrote TESTER-CHECKLIST\.html and MOM-MEDALS-CATALOGUE\.html/);
});
test('the checklist has an interactive item for every checkbox in the markdown', () => {
  const md = readFileSync(resolve(repositoryRoot, 'docs', 'testing', 'mam-chronicles-phase1-tester-checklist.md'), 'utf8');
  const expected = (md.match(/^- \[ \] /gm) || []).length; const html = read('TESTER-CHECKLIST.html');
  assert.ok(expected > 100); assert.equal((html.match(/class="item"/g) || []).length, expected);
  for (const marker of ['data-v="pass"', 'data-v="fail"', 'data-v="skip"', 'id="copy"', 'localStorage', 'Copy results']) assert.ok(html.includes(marker), marker);
});
test('the checklist includes the newest sections and is self-contained', () => {
  const html = read('TESTER-CHECKLIST.html');
  assert.match(html, /Modern look/); assert.match(html, /Weekly Mom Quests|Quests, holidays, characters/);
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//.test(html.replace(/<code>.*?<\/code>/g, '')), 'no external resources');
});
test('the catalogue lists every medal the addon defines, with titles and filters', () => {
  const h = createHarness(); h.load(['Core.lua', 'Database.lua', 'EventStore.lua', 'Collectors.lua', 'Statistics.lua', 'AchievementStats.lua', 'Medals.lua']);
  const total = h.get('#MAMChronicles.Medals:GetDefinitions()'); const html = read('MOM-MEDALS-CATALOGUE.html');
  const data = JSON.parse(/const M=(\[.*?\]);const CATS/s.exec(html)[1]);
  assert.equal(data.length, total); assert.ok(total >= 300); assert.ok(data.every(m => m.name && m.tier && m.points > 0 && m.category && m.title));
  assert.ok(data.some(m => m.name === "Wine O'Clock I" && m.title === 'Wine Mom')); assert.ok(data.some(m => m.category === 'seasonal')); assert.ok(data.some(m => m.client === 'forever'));
  for (const marker of ['id="q"', 'id="cat"', 'id="tier"', 'id="client"']) assert.ok(html.includes(marker), marker);
  assert.match(html, new RegExp(`${total} medals in \\d+ families`));
});
test('the generated pages contain valid JavaScript', () => {
  for (const name of ['TESTER-CHECKLIST.html', 'MOM-MEDALS-CATALOGUE.html']) {
    const js = [...read(name).matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
    assert.doesNotThrow(() => new Function(js), name);
  }
});
test('the send-to-testers note points at the HTML files', () => {
  const t = readFileSync(resolve(repositoryRoot, 'docs', 'release', 'SEND-TO-TESTERS.template.txt'), 'utf8');
  assert.match(t, /TESTER-CHECKLIST\.html/); assert.match(t, /MOM-MEDALS-CATALOGUE\.html/); assert.ok(!/TESTER-CHECKLIST\.md|MOM-MEDALS-CATALOGUE\.md/.test(t));
});
