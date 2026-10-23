$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root "example.env"
$webEnv = Join-Path $root ".env.local"
$mobileEnv = Join-Path $root "mobile\.env"

if (-not (Test-Path $example)) {
  throw "example.env is missing. Add Supabase keys there first."
}

if (-not (Test-Path $webEnv)) {
  Copy-Item $example $webEnv
  Write-Host "Created $webEnv from example.env"
} else {
  Write-Host "Keeping existing $webEnv"
}

$lan = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Sort-Object -Property PrefixOrigin -Descending |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lan) { $lan = "127.0.0.1" }

$keys = @{}
Get-Content $webEnv | ForEach-Object {
  if ($_ -match "^\s*([A-Za-z0-9_]+)=(.*)$") {
    $keys[$matches[1]] = $matches[2].Trim()
  }
}

$supabaseUrl = $keys["NEXT_PUBLIC_SUPABASE_URL"]
$anon = $keys["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
@"
EXPO_PUBLIC_API_URL=http://${lan}:3000
EXPO_PUBLIC_SUPABASE_URL=$supabaseUrl
EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon
"@ | Set-Content -Path $mobileEnv -Encoding utf8

Write-Host "Wrote $mobileEnv"
Write-Host "Phone/emulator API URL: http://${lan}:3000"
Write-Host "Android emulator alternative: http://10.0.2.2:3000"
Write-Host ""
Write-Host "Next: npm install && npm run dev"
Write-Host "Then on the same Wi-Fi phone: cd mobile && npm install && npx expo run:android"
