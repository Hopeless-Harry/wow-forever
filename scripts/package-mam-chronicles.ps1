[CmdletBinding()]
param([string]$OutputRoot)
$ErrorActionPreference='Stop'
$repositoryRoot=Split-Path -Parent $PSScriptRoot
$sourceRoot=Join-Path $repositoryRoot 'addons\MAMChronicles'
if(-not $OutputRoot){$OutputRoot=Join-Path $repositoryRoot 'dist'}
$allowlist=@('MAMChronicles.toc','Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua','UI.lua','Launcher.lua','SettingsPanel.lua','README.md')
$manifestPath=Join-Path $sourceRoot 'MAMChronicles.toc'
if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw "Addon manifest is missing: $manifestPath"}
$manifest=Get-Content -Raw -LiteralPath $manifestPath
if($manifest -notmatch '(?m)^## Interface:\s*([^\r\n]+)\s*$'){throw 'Addon manifest has no interface list.'}
$interfaces=@($Matches[1]-split ','|ForEach-Object{$_.Trim()})
foreach($required in @('120100','120105','16001')){if($required -notin $interfaces){throw "Addon manifest must target interface $required."}}
if($manifest -notmatch '(?m)^## Version: ([A-Za-z0-9._-]+)\s*$'){throw 'Addon manifest has no package-safe version.'}
$version=$Matches[1]
foreach($name in $allowlist){if(-not(Test-Path -LiteralPath (Join-Path $sourceRoot $name) -PathType Leaf)){throw "Required addon file is missing: $name"}}
$tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());$stage=Join-Path $tempBase ("mam-chronicles-package-"+[Guid]::NewGuid().ToString('N'));$resolved=[IO.Path]::GetFullPath($stage)
if(-not $resolved.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase)){throw "Unsafe staging path: $resolved"}
try{
  $addonStage=Join-Path $resolved 'MAMChronicles';New-Item -ItemType Directory -Path $addonStage -Force|Out-Null
  foreach($name in $allowlist){Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $addonStage $name)}
  New-Item -ItemType Directory -Path $OutputRoot -Force|Out-Null;$archive=Join-Path ([IO.Path]::GetFullPath($OutputRoot)) "MAMChronicles-$version.zip"
  if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force}
  Compress-Archive -LiteralPath $addonStage -DestinationPath $archive -CompressionLevel Optimal
  $hash=Get-FileHash -LiteralPath $archive -Algorithm SHA256
  Write-Output "Package: $archive";Write-Output "SHA256: $($hash.Hash)"
}finally{if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}}
