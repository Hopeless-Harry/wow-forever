[CmdletBinding()]
param(
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repositoryRoot 'addons\MAMChroniclesDiagnostics'
if (-not $OutputRoot) {
    $OutputRoot = Join-Path $repositoryRoot 'dist'
}

$allowlist = @(
    'MAMChroniclesDiagnostics.toc',
    'Core.lua',
    'Capabilities.lua',
    'Events.lua',
    'UI.lua',
    'README.md'
)

$manifestPath = Join-Path $sourceRoot 'MAMChroniclesDiagnostics.toc'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Addon manifest is missing: $manifestPath"
}
$manifest = Get-Content -Raw -LiteralPath $manifestPath
if ($manifest -notmatch '(?m)^## Interface: 16001\s*$') {
    throw 'Addon manifest must target interface 16001.'
}
if ($manifest -notmatch '(?m)^## Version: ([A-Za-z0-9._-]+)\s*$') {
    throw 'Addon manifest has no package-safe version.'
}
$version = $Matches[1]

foreach ($name in $allowlist) {
    $path = Join-Path $sourceRoot $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required addon file is missing: $name"
    }
}

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$stagingRoot = Join-Path $temporaryBase ("mam-chronicles-package-" + [Guid]::NewGuid().ToString('N'))
$resolvedStaging = [IO.Path]::GetFullPath($stagingRoot)
if (-not $resolvedStaging.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase) -or
    -not (Split-Path -Leaf $resolvedStaging).StartsWith('mam-chronicles-package-', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing unsafe staging directory: $resolvedStaging"
}

try {
    $addonStage = Join-Path $resolvedStaging 'MAMChroniclesDiagnostics'
    New-Item -ItemType Directory -Path $addonStage -Force | Out-Null
    foreach ($name in $allowlist) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $addonStage $name)
    }

    New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
    $archivePath = Join-Path ([IO.Path]::GetFullPath($OutputRoot)) "MAMChroniclesDiagnostics-$version.zip"
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    Compress-Archive -LiteralPath $addonStage -DestinationPath $archivePath -CompressionLevel Optimal
    $hash = Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
    Write-Output "Package: $archivePath"
    Write-Output "SHA256: $($hash.Hash)"
}
finally {
    if (Test-Path -LiteralPath $resolvedStaging) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
