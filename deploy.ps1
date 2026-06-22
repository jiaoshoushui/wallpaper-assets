# wallpaper-assets deploy (UTF-8 safe)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host ' wallpaper-assets deploy'
Write-Host ' ======================='
Write-Host ''

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'ERROR: npm not found.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing dependencies...'
  npm install
}

node scripts/deploy.mjs @args
$code = $LASTEXITCODE

Write-Host ''
if ($code -eq 0) { Write-Host 'Done.' -ForegroundColor Green }
else { Write-Host "Failed: $code" -ForegroundColor Red }
Write-Host ''
Read-Host 'Press Enter to exit'
exit $code
