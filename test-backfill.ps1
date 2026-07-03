# PowerShell script to test backfill endpoint

Write-Host "`n🔧 Testing backfill endpoint..." -ForegroundColor Cyan

# First check how many system calls exist
Write-Host "`n1️⃣ Checking count of system@aoglobelife.com calls..." -ForegroundColor Yellow
try {
    $countResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/twilio-calls/system-calls-count" -Method GET
    Write-Host "   Found $($countResponse.count) calls with system@aoglobelife.com" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
    exit 1
}

# Run dry run first
Write-Host "`n2️⃣ Running DRY RUN (no changes)..." -ForegroundColor Yellow
$dryRunBody = @{
    limit = 100
    dryRun = $true
    batchSize = 50
} | ConvertTo-Json

try {
    $dryRunResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/twilio-calls/backfill-owner-email" -Method POST -Body $dryRunBody -ContentType "application/json"
    Write-Host "   ✅ Dry run completed!" -ForegroundColor Green
    Write-Host "   Total: $($dryRunResponse.stats.total)" -ForegroundColor White
    Write-Host "   Would update: $($dryRunResponse.stats.updated)" -ForegroundColor White
    Write-Host "   Would skip: $($dryRunResponse.stats.skipped)" -ForegroundColor White
    Write-Host "   Errors: $($dryRunResponse.stats.errors)" -ForegroundColor White
    
    if ($dryRunResponse.updates.Count -gt 0) {
        Write-Host "`n   Sample updates:" -ForegroundColor Cyan
        $dryRunResponse.updates | Select-Object -First 5 | ForEach-Object {
            Write-Host "     $($_.callSid) → $($_.newEmail) ($($_.source))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
    Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

# Ask if user wants to run real update
Write-Host "`n3️⃣ Ready to run REAL update?" -ForegroundColor Yellow
$confirm = Read-Host "   Type 'yes' to proceed with real update (will modify database)"

if ($confirm -eq 'yes') {
    Write-Host "`n🔥 Running REAL backfill (updating database)..." -ForegroundColor Red
    $realBody = @{
        limit = 10000
        dryRun = $false
        batchSize = 100
    } | ConvertTo-Json
    
    try {
        $realResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/twilio-calls/backfill-owner-email" -Method POST -Body $realBody -ContentType "application/json"
        Write-Host "   ✅ Real backfill completed!" -ForegroundColor Green
        Write-Host "   Total: $($realResponse.stats.total)" -ForegroundColor White
        Write-Host "   Updated: $($realResponse.stats.updated)" -ForegroundColor Green
        Write-Host "   Skipped: $($realResponse.stats.skipped)" -ForegroundColor Yellow
        Write-Host "   Errors: $($realResponse.stats.errors)" -ForegroundColor $(if ($realResponse.stats.errors -gt 0) { "Red" } else { "Green" })
    } catch {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   Skipped real update." -ForegroundColor Yellow
}

Write-Host "`n✅ Done!" -ForegroundColor Green


