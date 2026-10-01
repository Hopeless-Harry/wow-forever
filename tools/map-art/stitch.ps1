# Stitches exported map tiles into one JPEG per piece of map art, plus index.json mapping UiMap ids to images.
# Usage: pwsh -File stitch.ps1 -OutDir out\retail -Types '2,3' [-MaxWidth 1024] [-Quality 82]
# Needs plan.json (plan.py) and tiles\<fileDataID>.png (fetch_tiles.py). Writes <OutDir>\maps\<art>.jpg and <OutDir>\maps\index.json.
# The images are Blizzard's art from the owner's own game files for a private dashboard: do not commit or publish them.
param(
  [Parameter(Mandatory)][string]$OutDir,
  [string]$Types = '2,3',
  [int]$MaxWidth = 1024,
  [int]$Quality = 82
)
$ErrorActionPreference = 'Stop'
$wanted = @($Types -split ',' | ForEach-Object { [int]$_ })
Add-Type -AssemblyName System.Drawing
$plan = Get-Content (Join-Path $OutDir 'plan.json') -Raw | ConvertFrom-Json
$mapsDir = Join-Path $OutDir 'maps'
New-Item -ItemType Directory -Force $mapsDir | Out-Null
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoder = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoder.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

$index = @{}
$made = 0; $skipped = 0; $incomplete = 0
foreach ($entry in $plan) {
  $lowest = ($entry.maps | Measure-Object -Property type -Minimum).Minimum
  if ($wanted -notcontains $lowest) { continue }
  $file = "$($entry.art).jpg"; $target = Join-Path $mapsDir $file
  $scale = [Math]::Min(1.0, $MaxWidth / [double]$entry.width)
  $outW = [int][Math]::Round($entry.width * $scale); $outH = [int][Math]::Round($entry.height * $scale)
  if (-not (Test-Path $target)) {
    $missing = 0
    foreach ($t in $entry.tiles) { if (-not (Test-Path (Join-Path $OutDir "tiles\$($t[2]).png"))) { $missing++ } }
    if ($missing -gt 0) { $incomplete++; continue }
    $canvas = New-Object System.Drawing.Bitmap([int]$entry.width, [int]$entry.height)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::Black)
    foreach ($t in $entry.tiles) {
      $img = [System.Drawing.Image]::FromFile((Join-Path $OutDir "tiles\$($t[2]).png"))
      $g.DrawImage($img, [int]($t[1] * $entry.tileW), [int]($t[0] * $entry.tileH), $img.Width, $img.Height)
      $img.Dispose()
    }
    $g.Dispose()
    $final = New-Object System.Drawing.Bitmap($outW, $outH)
    $fg = [System.Drawing.Graphics]::FromImage($final)
    $fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fg.DrawImage($canvas, 0, 0, $outW, $outH)
    $fg.Dispose(); $canvas.Dispose()
    $final.Save($target, $jpeg, $encoder); $final.Dispose()
    $made++
  } else { $skipped++ }
  foreach ($m in $entry.maps) { $index["$($m.id)"] = @{ file = $file; w = $outW; h = $outH; name = $m.name } }
}
[System.IO.File]::WriteAllText((Join-Path (Resolve-Path $mapsDir) 'index.json'), ($index | ConvertTo-Json -Depth 4 -Compress), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "made $made, kept $skipped, incomplete $incomplete, indexed $($index.Count) maps in $mapsDir"
