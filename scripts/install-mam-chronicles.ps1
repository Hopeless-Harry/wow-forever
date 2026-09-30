[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ClientRoot,
  [Parameter(Mandatory)][string]$BackupRoot,
  [string]$SourceRoot,
  [scriptblock]$ProcessProbe={@(Get-Process -Name 'Wow','WowB' -ErrorAction SilentlyContinue).Count -gt 0},
  [scriptblock]$BeforeActivate={}
)
$ErrorActionPreference='Stop';$repositoryRoot=Split-Path -Parent $PSScriptRoot
if(-not $SourceRoot){$SourceRoot=Join-Path $repositoryRoot 'addons\MAMChronicles'}
$allowlist=@('MAMChronicles.toc','Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Export.lua','UI.lua','Launcher.lua','SettingsPanel.lua','MAMChroniclesIcon.tga','LICENSE.txt','README.md')
if(-not(Test-Path -LiteralPath $ClientRoot -PathType Container)){throw "WoW client root does not exist: $ClientRoot"}
$client=(Resolve-Path -LiteralPath $ClientRoot).Path;if((Split-Path -Leaf $client) -notin @('_retail_','_classic_beta_')){throw "ClientRoot must be a supported _retail_ or _classic_beta_ directory: $client"}
if(-not(Test-Path -LiteralPath $SourceRoot -PathType Container)){throw "Addon source directory is missing: $SourceRoot"};$source=(Resolve-Path -LiteralPath $SourceRoot).Path
$manifestPath=Join-Path $source 'MAMChronicles.toc';if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw "Addon manifest is missing: $manifestPath"}
$manifest=Get-Content -Raw -LiteralPath $manifestPath;if($manifest -notmatch '(?m)^## Interface:\s*([^\r\n]+)\s*$'){throw 'Addon manifest has no interface list.'};$interfaces=@($Matches[1]-split ','|ForEach-Object{$_.Trim()})
foreach($required in @('120100','120105','16001')){if($required -notin $interfaces){throw "Addon manifest must target supported interface $required."}}
foreach($name in $allowlist){if(-not(Test-Path -LiteralPath (Join-Path $source $name) -PathType Leaf)){throw "Required addon file is missing: $name"}}
if(& $ProcessProbe){throw 'A WoW client is running. Fully exit WoW before installing this addon.'}
$backup=[IO.Path]::GetFullPath($BackupRoot);if($backup.Equals($client,[StringComparison]::OrdinalIgnoreCase) -or $backup.StartsWith($client+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'BackupRoot must be outside the WoW client directory.'}
$addOns=Join-Path $client 'Interface\AddOns';New-Item -ItemType Directory -Path $addOns -Force|Out-Null;$addOns=[IO.Path]::GetFullPath($addOns);$target=Join-Path $addOns 'MAMChronicles'
$token=[Guid]::NewGuid().ToString('N');$stage=Join-Path $addOns ".MAMChronicles-stage-$token";$rollback=Join-Path $addOns ".MAMChronicles-rollback-$token"
foreach($candidate in @($target,$stage,$rollback)){if(-not([IO.Path]::GetFullPath($candidate)).StartsWith($addOns+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Unsafe install path: $candidate"}}
$backupPath=$null
if(Test-Path -LiteralPath $target -PathType Container){New-Item -ItemType Directory -Path $backup -Force|Out-Null;$backupPath=Join-Path $backup ("MAMChronicles-"+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.zip');Compress-Archive -LiteralPath $target -DestinationPath $backupPath -CompressionLevel Optimal}
try{
  New-Item -ItemType Directory -Path $stage -Force|Out-Null;foreach($name in $allowlist){Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $stage $name)}
  if(Test-Path -LiteralPath $target){Move-Item -LiteralPath $target -Destination $rollback}
  & $BeforeActivate
  Move-Item -LiteralPath $stage -Destination $target
  if(Test-Path -LiteralPath $rollback){Remove-Item -LiteralPath $rollback -Recurse -Force}
}catch{
  if(-not(Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $rollback)){Move-Item -LiteralPath $rollback -Destination $target}
  throw
}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}}
Write-Output "Installed: $target";if($backupPath){Write-Output "Backup: $backupPath"}else{Write-Output 'Backup: no existing addon'}
