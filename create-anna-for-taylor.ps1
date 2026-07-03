# Create Anna Perez candidate for Taylor Ermis manually
# VDP Call: 2025-10-21 20:23:43.204+00

$body = @{
    firstName = "ANNA"
    lastName = "PEREZ"
    phone = "+15036790874"
    agentId = "2233111"
    market = "aorecruit"
} | ConvertTo-Json

Write-Host "Creating Anna Perez candidate for Taylor Ermis (Associate ID: 2233111)..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri "https://aoirail-production.up.railway.app/api/recruit/simulate-vdp-call" -Method Post -Body $body -ContentType "application/json"

Write-Host ""
Write-Host "Response:" -ForegroundColor Yellow
$response | ConvertTo-Json -Depth 10

if ($response.success) {
    Write-Host ""
    Write-Host "✅ SUCCESS! Anna Perez created for Taylor!" -ForegroundColor Green
    Write-Host "Tell Taylor to check their AO Recruit page." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ FAILED: $($response.message)" -ForegroundColor Red
}

