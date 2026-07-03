# PowerShell script to test agent_live_call_status updates
# Usage: .\test-agent-status-api.ps1 -AgentEmail "test@example.com" -Status "ready"

param(
    [string]$AgentEmail = "test@aoglobelife.com",
    [string]$Status = "ready",
    [string]$ServerUrl = "http://localhost:3000"
)

Write-Host "🧪 Testing agent_live_call_status updates" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: $ServerUrl"
Write-Host "Agent Email: $AgentEmail"
Write-Host "Status: $Status"
Write-Host ""

# Test 1: Presence endpoint
Write-Host "📡 Test 1: POST /agent/presence" -ForegroundColor Yellow
try {
    $body = @{
        agent_email = $AgentEmail
        status = $Status
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$ServerUrl/agent/presence" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    Write-Host "   Status: 200" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Depth 3)"
    
    if ($response.success) {
        Write-Host "   ✅ SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Start-Sleep -Seconds 1

# Test 2: Heartbeat endpoint
Write-Host "💓 Test 2: POST /api/call-connector-pro/heartbeat" -ForegroundColor Yellow
try {
    $body = @{
        agentEmail = $AgentEmail
        status = $Status
        sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$ServerUrl/api/call-connector-pro/heartbeat" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    Write-Host "   Status: 200" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Depth 3)"
    
    if ($response.success) {
        Write-Host "   ✅ SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Check server logs for update confirmations"
Write-Host "   2. Run SQL query in Supabase to verify record exists:"
Write-Host "      SELECT * FROM agent_live_call_status WHERE agent_email = '$AgentEmail';"
Write-Host "   3. Check that agent has CCPRO = true in customers table:"
Write-Host "      SELECT * FROM customers WHERE company_email = '$AgentEmail' OR personal_email = '$AgentEmail';"
Write-Host ""

