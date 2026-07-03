# PowerShell API Endpoint Testing Script for Usage Tracking
# Tests all usage tracking API endpoints

$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$TEST_AGENT_EMAIL = if ($env:TEST_AGENT_EMAIL) { $env:TEST_AGENT_EMAIL } else { "test-agent@aoglobelife.com" }
$TEST_SESSION_ID = "test-session-$(Get-Date -UFormat %s)"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Usage Tracking API Test Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL"
Write-Host "Test Agent: $TEST_AGENT_EMAIL"
Write-Host "Session ID: $TEST_SESSION_ID"
Write-Host ""

$PASSED = 0
$FAILED = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null
    )
    
    Write-Host "🧪 Testing: $Name" -ForegroundColor Blue
    Write-Host "   $Method $Endpoint"
    
    try {
        if ($Method -eq "POST") {
            $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" `
                -Method Post `
                -ContentType "application/json" `
                -Body $Data `
                -ErrorAction Stop
        } else {
            $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" `
                -Method Get `
                -ErrorAction Stop
        }
        
        Write-Host "✅ PASSED" -ForegroundColor Green
        Write-Host "   Response: $($response | ConvertTo-Json -Compress)"
        $script:PASSED++
        return $true
    }
    catch {
        Write-Host "❌ FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)"
        $script:FAILED++
        return $false
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. VDP Available Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$vdpStartData = @{
    agentEmail = $TEST_AGENT_EMAIL
    sessionId = $TEST_SESSION_ID
} | ConvertTo-Json
Test-Endpoint -Name "VDP Available Start" -Method "POST" -Endpoint "/api/usage/vdp-available-start" -Data $vdpStartData

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "2. VDP Available End" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$vdpEndData = @{
    agentEmail = $TEST_AGENT_EMAIL
    sessionId = $TEST_SESSION_ID
} | ConvertTo-Json
Test-Endpoint -Name "VDP Available End" -Method "POST" -Endpoint "/api/usage/vdp-available-end" -Data $vdpEndData

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "3. Call Connector Pro Call Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$CALL_ID = "test-call-$(Get-Date -UFormat %s)"
$ccproStartData = @{
    agentEmail = $TEST_AGENT_EMAIL
    sessionId = $TEST_SESSION_ID
    callId = $CALL_ID
} | ConvertTo-Json
Test-Endpoint -Name "CCPro Call Start" -Method "POST" -Endpoint "/api/usage/ccpro-call-start" -Data $ccproStartData

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "4. Call Connector Pro Call End" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$ccproEndData = @{
    agentEmail = $TEST_AGENT_EMAIL
    sessionId = $TEST_SESSION_ID
    callId = $CALL_ID
    duration = 300
} | ConvertTo-Json
Test-Endpoint -Name "CCPro Call End" -Method "POST" -Endpoint "/api/usage/ccpro-call-end" -Data $ccproEndData

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "5. Get Weekly Stats" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Test-Endpoint -Name "Get Weekly Stats" -Method "GET" -Endpoint "/api/usage/weekly-stats/$TEST_AGENT_EMAIL"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $PASSED" -ForegroundColor Green
Write-Host "❌ Failed: $FAILED" -ForegroundColor Red

if ($FAILED -eq 0) {
    Write-Host ""
    Write-Host "🎉 All API tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠️  Some API tests failed" -ForegroundColor Red
    exit 1
}
