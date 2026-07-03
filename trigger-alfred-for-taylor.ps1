$body = @{
    firstName = "ALFRED"
    lastName = "BURGESS"
    phone = "+12486328783"
    agentId = "2233111"
    market = "aorecruit"
} | ConvertTo-Json

Write-Host "🎬 Simulating VDP call: ALFRED BURGESS → Taylor (agent 2233111)..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://aoirail-production.up.railway.app/api/recruit/simulate-vdp-call" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host $response.message -ForegroundColor Yellow
    Write-Host "`n⏳ Waiting 15 seconds for recruit poller to process..." -ForegroundColor Cyan
    Start-Sleep -Seconds 15
    Write-Host "`n🎉 Taylor should now see ALFRED BURGESS in their AORecruit candidates list!" -ForegroundColor Green
    Write-Host "   Tell Taylor to refresh the AORecruit page." -ForegroundColor Yellow
}
catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

