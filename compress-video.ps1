# Compress video to under 100MB using ffmpeg
# Install ffmpeg first: winget install ffmpeg

$inputFile = "attached_assets\ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4"
$outputFile = "client\public\videos\recruit-overview-compressed.mp4"

Write-Host "🎬 Compressing video from 108MB to under 100MB..." -ForegroundColor Yellow
Write-Host "This will take 2-3 minutes..." -ForegroundColor Cyan

# Create output directory
New-Item -ItemType Directory -Force -Path "client\public\videos" | Out-Null

# Compress with H.264, reduce bitrate to fit under 100MB
# 14 minutes * 60 seconds = 840 seconds
# Target: 95MB = 95 * 8 * 1024 = 778240 Kbits
# Bitrate: 778240 / 840 = ~926 Kbps (video + audio)
# Use 850k video bitrate + 64k audio bitrate = 914k total

ffmpeg -i $inputFile `
  -c:v libx264 `
  -b:v 850k `
  -c:a aac `
  -b:a 64k `
  -preset medium `
  -movflags +faststart `
  $outputFile

if (Test-Path $outputFile) {
    $size = (Get-Item $outputFile).Length / 1MB
    Write-Host "✅ Compression complete! New size: $([math]::Round($size, 2)) MB" -ForegroundColor Green
    
    if ($size -lt 100) {
        Write-Host "✅ File is under 100MB - safe to push to git!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ File is still over 100MB - need more compression" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Compression failed" -ForegroundColor Red
}



