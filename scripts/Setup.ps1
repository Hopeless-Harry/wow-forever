param(
    [switch]$InstallBridge
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

Write-Output 'Installing locked dependencies...'
npm ci

Write-Output 'Checking types...'
npm run typecheck

Write-Output 'Running tests...'
npm test

Write-Output 'Building packages...'
npm run build

if ($InstallBridge) {
    Write-Output 'Installing ForeverBridge with backup protection...'
    npm run install:addon -- ForeverBridge
} else {
    Write-Output 'Setup complete. Nothing was installed into WoW.'
}

