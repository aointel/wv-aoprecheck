# Upload video to Railway volume
Write-Host "🚀 Uploading video to Railway..." -ForegroundColor Green
Write-Host "Make sure you've created the 'attached_assets' volume in Railway dashboard first!" -ForegroundColor Yellow
Write-Host ""

# Link to Railway project
railway link

# Get the video file path
$videoFile = "attached_assets\ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4"

if (Test-Path $videoFile) {
    Write-Host "✅ Video file found, uploading..." -ForegroundColor Green
    
    # Use railway shell to upload
    # This opens an interactive shell where you can manually upload
    Write-Host "Opening Railway shell..." -ForegroundColor Cyan
    Write-Host "Once inside, run:" -ForegroundColor Yellow
    Write-Host "  mkdir -p /app/attached_assets" -ForegroundColor White
    Write-Host "Then upload the file using your preferred method (SCP/SFTP)" -ForegroundColor White
    
    railway shell
} else {
    Write-Host "❌ Video file not found at: $videoFile" -ForegroundColor Red
}



