# Registers the companion to start when you log in to Windows (hidden). Run once from PowerShell in this folder.
# Review before running: it creates one scheduled task named "MAM Chronicles Hub Companion" for the current user.
$ErrorActionPreference = 'Stop'
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $folder 'config.json'))) { throw 'Create config.json first (copy config.example.json and fill it in).' }
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$folder\run.cmd`"" -WorkingDirectory $folder
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'MAM Chronicles Hub Companion' -Action $action -Trigger $trigger -Settings $settings -Description 'Uploads Moms Against Magic Chronicles gateway data to the home hub.' -Force | Out-Null
Write-Host 'Registered. It starts at your next logon. To start it now: Start-ScheduledTask -TaskName "MAM Chronicles Hub Companion"'
