import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { addonRoot, repositoryRoot } from './harness.js';

const packageScript = resolve(repositoryRoot, 'scripts', 'package-mam-chronicles-diagnostics.ps1');
const installScript = resolve(repositoryRoot, 'scripts', 'install-mam-chronicles-diagnostics.ps1');

function runPowerShell(args) {
  return spawnSync('pwsh', ['-NoProfile', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function invokeInstaller({ clientRoot, backupRoot, sourceRoot = addonRoot, running = false }) {
  const escaped = (value) => value.replaceAll("'", "''");
  const command = `& '${escaped(installScript)}' -ClientRoot '${escaped(clientRoot)}' -BackupRoot '${escaped(backupRoot)}' -SourceRoot '${escaped(sourceRoot)}' -ProcessProbe { $${running ? 'true' : 'false'} }`;
  return runPowerShell(['-Command', command]);
}

function makeFakeClient(root) {
  const clientRoot = join(root, '_classic_beta_');
  mkdirSync(join(clientRoot, 'Interface', 'AddOns'), { recursive: true });
  return clientRoot;
}

test('package archive contains only the six allowlisted addon files', () => {
  const root = mkdtempSync(join(tmpdir(), 'mam-package-'));
  const outputRoot = join(root, 'dist');
  const result = runPowerShell(['-File', packageScript, '-OutputRoot', outputRoot]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const archives = readdirSync(outputRoot).filter((name) => name.endsWith('.zip'));
  assert.deepEqual(archives, ['MAMChroniclesDiagnostics-0.1.0-phase0.zip']);
  const extractRoot = join(root, 'extract');
  const expand = runPowerShell(['-Command', `Expand-Archive -LiteralPath '${join(outputRoot, archives[0]).replaceAll("'", "''")}' -DestinationPath '${extractRoot.replaceAll("'", "''")}'`]);
  assert.equal(expand.status, 0, expand.stderr);
  const packagedFiles = readdirSync(join(extractRoot, 'MAMChroniclesDiagnostics')).sort();
  assert.deepEqual(packagedFiles, [
    'Capabilities.lua',
    'Core.lua',
    'Events.lua',
    'MAMChroniclesDiagnostics.toc',
    'README.md',
    'UI.lua',
  ]);
  assert.equal(packagedFiles.includes('node_modules'), false);
});

test('installer rejects missing and incompatible manifests', () => {
  const root = mkdtempSync(join(tmpdir(), 'mam-install-invalid-'));
  const clientRoot = makeFakeClient(root);
  const backupRoot = join(root, 'backups');
  const missingSource = join(root, 'missing-source');
  mkdirSync(missingSource);

  const missing = invokeInstaller({ clientRoot, backupRoot, sourceRoot: missingSource });
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}${missing.stderr}`, /manifest/i);

  const incompatibleSource = join(root, 'incompatible-source');
  cpSync(addonRoot, incompatibleSource, { recursive: true });
  const tocPath = join(incompatibleSource, 'MAMChroniclesDiagnostics.toc');
  writeFileSync(tocPath, readFileSync(tocPath, 'utf8').replace('## Interface: 16001', '## Interface: 99999'));
  const incompatible = invokeInstaller({ clientRoot, backupRoot, sourceRoot: incompatibleSource });
  assert.notEqual(incompatible.status, 0);
  assert.match(`${incompatible.stdout}${incompatible.stderr}`, /16001/i);
});

test('installer refuses a running client', () => {
  const root = mkdtempSync(join(tmpdir(), 'mam-install-running-'));
  const clientRoot = makeFakeClient(root);
  const result = invokeInstaller({
    clientRoot,
    backupRoot: join(root, 'backups'),
    running: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /WowB\.exe.*running/i);
  assert.equal(existsSync(join(clientRoot, 'Interface', 'AddOns', 'MAMChroniclesDiagnostics')), false);
});

test('installer backs up and replaces only the diagnostic addon', () => {
  const root = mkdtempSync(join(tmpdir(), 'mam-install-success-'));
  const clientRoot = makeFakeClient(root);
  const addOnsRoot = join(clientRoot, 'Interface', 'AddOns');
  const target = join(addOnsRoot, 'MAMChroniclesDiagnostics');
  const unrelated = join(addOnsRoot, 'UnrelatedAddon');
  mkdirSync(target);
  mkdirSync(unrelated);
  writeFileSync(join(target, 'old.txt'), 'old diagnostic');
  writeFileSync(join(unrelated, 'keep.txt'), 'keep me');
  const backupRoot = join(root, 'backups');

  const result = invokeInstaller({ clientRoot, backupRoot });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(join(target, 'MAMChroniclesDiagnostics.toc')), true);
  assert.equal(existsSync(join(target, 'old.txt')), false);
  assert.equal(readFileSync(join(unrelated, 'keep.txt'), 'utf8'), 'keep me');
  const backups = readdirSync(backupRoot).filter((name) => name.endsWith('.zip'));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^MAMChroniclesDiagnostics-\d{8}-\d{6}\.zip$/u);
});
