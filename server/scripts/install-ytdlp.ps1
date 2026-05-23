$binDir = Join-Path $PSScriptRoot "..\bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$out = Join-Path $binDir "yt-dlp.exe"
Write-Host "Downloading yt-dlp to $out"
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $out -UseBasicParsing
Write-Host "Done. Start server: npm run dev"
