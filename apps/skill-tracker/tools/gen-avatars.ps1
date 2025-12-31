param(
  [string]$Root = (Resolve-Path "$PSScriptRoot/..").Path
)

$ErrorActionPreference = "Stop"

$avatarsDir = Join-Path $Root "profile/avatars"
$outFile    = Join-Path $Root "profile/avatars.json"

if (-not (Test-Path $avatarsDir)) {
  throw "Avatar folder not found: $avatarsDir"
}

$files = Get-ChildItem -Path $avatarsDir -File |
  Where-Object { $_.Name -notmatch '^\.' } |
  Where-Object { $_.Name -ne 'default.svg' } |
  Where-Object { $_.Extension -match '\.(png|jpg|jpeg|webp|gif|svg)$' } |
  Sort-Object Name |
  ForEach-Object { $_.Name }

# Always include default.svg first
$all = @("default.svg") + $files

$json = @{
  files = $all
} | ConvertTo-Json -Depth 5

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $json + "`n", $utf8NoBom)

Write-Host "Wrote $outFile"
Write-Host ("Count: " + $all.Count)
