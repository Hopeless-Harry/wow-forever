[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ClientRoot,

    [Parameter(Mandatory)]
    [string]$BackupRoot,

    [string]$SourceRoot,

    [scriptblock]$ProcessProbe = { @(Get-Process -Name 'Wow', 'WowB' -ErrorAction SilentlyContinue).Count -gt 0 }
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $SourceRoot) {
    $SourceRoot = Join-Path $repositoryRoot 'addons\MAMChroniclesDiagnostics'
}

$allowlist = @(
    'MAMChroniclesDiagnostics.toc',
    'Core.lua',
    'Capabilities.lua',
    'Events.lua',
    'UI.lua',
    'README.md'
)

if (-not (Test-Path -LiteralPath $ClientRoot -PathType Container)) {
    throw "WoW client root does not exist: $ClientRoot"
}
$resolvedClient = (Resolve-Path -LiteralPath $ClientRoot).Path
$clientName = Split-Path -Leaf $resolvedClient
$requiredInterface = switch ($clientName) {
    '_retail_' { '120100' }
    '_classic_beta_' { '16001' }
    default { throw "ClientRoot must be a supported _retail_ or _classic_beta_ directory: $resolvedClient" }
}

if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    throw "Addon source directory is missing: $SourceRoot"
}
$resolvedSource = (Resolve-Path -LiteralPath $SourceRoot).Path
$manifestPath = Join-Path $resolvedSource 'MAMChroniclesDiagnostics.toc'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Addon manifest is missing: $manifestPath"
}
$manifest = Get-Content -Raw -LiteralPath $manifestPath
if ($manifest -notmatch '(?m)^## Interface:\s*([^\r\n]+)\s*$') {
    throw 'Addon manifest has no interface list.'
}
$interfaces = @($Matches[1] -split ',' | ForEach-Object { $_.Trim() })
if ($requiredInterface -notin $interfaces) {
    throw "Addon manifest must target $clientName interface $requiredInterface."
}
foreach ($name in $allowlist) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedSource $name) -PathType Leaf)) {
        throw "Required addon file is missing: $name"
    }
}

if (& $ProcessProbe) {
    throw 'A WoW client is running. Fully exit WoW before installing this addon.'
}

$addOnsRoot = Join-Path $resolvedClient 'Interface\AddOns'
New-Item -ItemType Directory -Path $addOnsRoot -Force | Out-Null
$resolvedAddOns = [IO.Path]::GetFullPath($addOnsRoot)
$target = Join-Path $resolvedAddOns 'MAMChroniclesDiagnostics'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = $null

if (Test-Path -LiteralPath $target -PathType Container) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    $backupPath = Join-Path ([IO.Path]::GetFullPath($BackupRoot)) "MAMChroniclesDiagnostics-$stamp.zip"
    Compress-Archive -LiteralPath $target -DestinationPath $backupPath -CompressionLevel Optimal
}

$token = [Guid]::NewGuid().ToString('N')
$stage = Join-Path $resolvedAddOns ".MAMChroniclesDiagnostics-stage-$token"
$rollback = Join-Path $resolvedAddOns ".MAMChroniclesDiagnostics-rollback-$token"
foreach ($candidate in @($stage, $rollback)) {
    $resolvedCandidate = [IO.Path]::GetFullPath($candidate)
    if (-not $resolvedCandidate.StartsWith($resolvedAddOns + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing unsafe install path: $resolvedCandidate"
    }
}

try {
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    foreach ($name in $allowlist) {
        Copy-Item -LiteralPath (Join-Path $resolvedSource $name) -Destination (Join-Path $stage $name)
    }

    if (Test-Path -LiteralPath $target) {
        Move-Item -LiteralPath $target -Destination $rollback
    }
    Move-Item -LiteralPath $stage -Destination $target

    if (Test-Path -LiteralPath $rollback) {
        Remove-Item -LiteralPath $rollback -Recurse -Force
    }
}
catch {
    if (-not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $rollback)) {
        Move-Item -LiteralPath $rollback -Destination $target
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}

Write-Output "Installed: $target"
if ($backupPath) {
    Write-Output "Backup: $backupPath"
}
else {
    Write-Output 'Backup: no existing addon'
}
