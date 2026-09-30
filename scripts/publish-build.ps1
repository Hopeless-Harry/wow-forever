[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipTests,
  [string]$ReleaseRoot = 'C:\Users\44750\Documents\ChatGPT\WoW\tester-releases',
  [string]$WowRoot = 'C:\Program Files (x86)\World of Warcraft',
  [string]$BackupRoot = 'C:\Users\44750\Documents\ChatGPT\WoW\addon-backups'
)
# One command for the standing rule "update my install AND the CurseForge package every time":
#   1. run all automated suites (stops on any failure)
#   2. package the addon and build the release folder (ZIP, tester notes, manual, checklist, catalogue, CurseForge material)
#   3. verify the ZIP against the source files without extracting anything
#   4. install to Retail and WoW Forever (a client is skipped, with a message, while its game process is running) and verify hashes
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$addon = Join-Path $repo 'addons\MAMChronicles'

function Invoke-Suite($name, $prefix) {
  $lines = & npm test --prefix $prefix 2>&1 | ForEach-Object { "$_" }
  $pass = [int](($lines | Select-String '^ℹ pass (\d+)').Matches[0].Groups[1].Value)
  $fail = [int](($lines | Select-String '^ℹ fail (\d+)').Matches[0].Groups[1].Value)
  Write-Host ("{0}: {1} passed, {2} failed" -f $name, $pass, $fail)
  if ($fail -ne 0) { throw "$name has failing tests; nothing was published." }
  return $pass
}

$total = 0
if (-not $SkipTests) {
  $total += Invoke-Suite 'Chronicles' 'tools/mam-chronicles'
  $total += Invoke-Suite 'Diagnostics' 'tools/mam-chronicles-diagnostics'
  $total += Invoke-Suite 'Guild dashboard' 'guild-dashboard'
  Write-Output "All suites green: $total tests"
}

$toc = Get-Content -Raw -LiteralPath (Join-Path $addon 'MAMChronicles.toc')
if ($toc -notmatch '(?m)^## Version: (\S+)') { throw 'No version in the TOC.' }
$version = $Matches[1]
$release = Join-Path $ReleaseRoot "MAMChronicles-$version"
New-Item -ItemType Directory -Force $release | Out-Null

$packageOutput = & (Join-Path $repo 'scripts\package-mam-chronicles.ps1') -OutputRoot $release
$hash = (($packageOutput | Where-Object { $_ -match '^SHA256: ' }) -replace 'SHA256: ', '').Trim()
$zip = Join-Path $release "MAMChronicles-$version.zip"
if (-not (Test-Path -LiteralPath $zip)) { throw "Package was not created: $zip" }

# Release folder contents
$template = Get-Content -Raw -LiteralPath (Join-Path $repo 'docs\release\SEND-TO-TESTERS.template.txt')
Set-Content -LiteralPath (Join-Path $release 'SEND-TO-TESTERS.txt') ($template.Replace('{{VERSION}}', $version).Replace('{{SHA256}}', $hash)) -NoNewline
Copy-Item (Join-Path $repo 'docs\testing\mam-chronicles-phase1-tester-checklist.md') (Join-Path $release 'TESTER-CHECKLIST.md') -Force
Copy-Item (Join-Path $repo 'docs\manuals\mam-chronicles-user-manual.md') (Join-Path $release 'USER-MANUAL.md') -Force
Copy-Item (Join-Path $repo 'docs\manuals\mom-medals-catalogue.md') (Join-Path $release 'MOM-MEDALS-CATALOGUE.md') -Force
$curseforge = Join-Path $release 'curseforge'
New-Item -ItemType Directory -Force $curseforge | Out-Null
Copy-Item (Join-Path $repo 'docs\release\curseforge\*') $curseforge -Force
Copy-Item (Join-Path $addon 'CHANGELOG.md') (Join-Path $curseforge 'CHANGELOG.md') -Force

# Verify the ZIP against the source without extracting it
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $mismatch = 0; $count = 0
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName.EndsWith('/')) { continue }
    $count++
    $name = Split-Path -Leaf $entry.FullName
    $stream = $entry.Open()
    try { $zipHash = (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash } finally { $stream.Dispose() }
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $addon $name) -Algorithm SHA256).Hash
    if ($zipHash -ne $sourceHash) { $mismatch++; Write-Output "MISMATCH in ZIP: $name" }
  }
} finally { $archive.Dispose() }
Write-Output ("ZIP: {0} files, {1} differ from source, {2} KB, SHA-256 {3}" -f $count, $mismatch, [math]::Round((Get-Item -LiteralPath $zip).Length / 1KB), $hash)
if ($mismatch -ne 0) { throw 'The ZIP does not match the source files.' }

# Install to both clients
$installed = @()
if (-not $SkipInstall) {
  $clients = @(
    @{ Folder = '_retail_'; Process = 'Wow' },
    @{ Folder = '_classic_beta_'; Process = 'WowB' }
  )
  foreach ($client in $clients) {
    $clientRoot = Join-Path $WowRoot $client.Folder
    if (-not (Test-Path -LiteralPath $clientRoot)) { Write-Output "$($client.Folder): not found, skipped"; continue }
    if (Get-Process -Name $client.Process -ErrorAction SilentlyContinue) {
      Write-Output "$($client.Folder): SKIPPED because $($client.Process).exe is running. Close the game and run this script again."
      continue
    }
    $probe = [scriptblock]::Create("@(Get-Process -Name '$($client.Process)' -ErrorAction SilentlyContinue).Count -gt 0")
    $null = & (Join-Path $repo 'scripts\install-mam-chronicles.ps1') -ClientRoot $clientRoot -BackupRoot $BackupRoot -ProcessProbe $probe
    $target = Join-Path $clientRoot 'Interface\AddOns\MAMChronicles'
    $bad = 0; $files = Get-ChildItem -LiteralPath $target -File
    foreach ($file in $files) {
      if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath (Join-Path $addon $file.Name)).Hash) { $bad++ }
    }
    $installedVersion = ((Select-String -Path (Join-Path $target 'MAMChronicles.toc') -Pattern '^## Version: (.+)$').Matches[0].Groups[1].Value)
    Write-Output ("{0}: installed {1}, {2} files, {3} differ from source" -f $client.Folder, $installedVersion, $files.Count, $bad)
    if ($bad -ne 0) { throw "$($client.Folder) install does not match the source." }
    $installed += $client.Folder
  }
}

Write-Output ''
Write-Output "Version:   $version"
Write-Output "Release:   $release"
Write-Output "SHA-256:   $hash"
Write-Output ("Installed: {0}" -f $(if ($installed.Count) { $installed -join ', ' } else { 'none' }))
