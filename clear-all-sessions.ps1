# Clear All Sessions on Live Server
# Run this script after Railway deployment completes

$url = "https://aoirail-production.up.railway.app/api/admin/sessions/clear"

Write-Host "🔄 Clearing all active sessions on live server..." -ForegroundColor Yellow
Write-Host "URL: $url" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -ErrorAction Stop
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✅ SUCCESS: All sessions cleared!" -ForegroundColor Green
        Write-Host "   Message: $($result.message)" -ForegroundColor Gray
        Write-Host "   Timestamp: $($result.timestamp)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🔒 All users will be forced to log in again on their next request." -ForegroundColor Cyan
    } else {
        Write-Host "❌ FAILED: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: Failed to clear sessions" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible reasons:" -ForegroundColor Yellow
    Write-Host "   1. Railway deployment not complete yet (wait 2-3 minutes)" -ForegroundColor Gray
    Write-Host "   2. Endpoint not deployed (check Railway logs)" -ForegroundColor Gray
    Write-Host "   3. Server is down or unreachable" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Try again in a few minutes, or check Railway deployment status." -ForegroundColor Yellow
}
