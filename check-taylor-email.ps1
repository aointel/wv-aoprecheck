# Check if we can find Taylor's email from associate ID 2233111

Write-Host "Checking Taylor's email lookup..." -ForegroundColor Cyan
Write-Host ""

# First, let's see what the server logs say
Write-Host "Check Railway logs for these messages:" -ForegroundColor Yellow
Write-Host "  - '🔍 Looking up email for associate ID: 2233111'" -ForegroundColor Gray
Write-Host "  - '✅ Found email in producerlist:' or '❌ Could not find email'" -ForegroundColor Gray
Write-Host ""

# Let's also manually check what's in recruit_candidates for Taylor
Write-Host "Let's check what candidates exist for Taylor..." -ForegroundColor Yellow
Write-Host "Navigate to: https://aoirail-production.up.railway.app/api/recruit/candidates?email=taylorermis@aoglobelife.com" -ForegroundColor Cyan
Write-Host ""

Write-Host "OR check Railway server logs for:" -ForegroundColor Yellow
Write-Host "  '📞 Found X potential recruit calls'" -ForegroundColor Gray
Write-Host "  '🔍 Looking up email for associate ID: 2233111'" -ForegroundColor Gray
Write-Host "  '❌ CRITICAL: No email found for associate ID 2233111'" -ForegroundColor Gray
Write-Host "  '✅ Candidate created with ID:'" -ForegroundColor Gray

