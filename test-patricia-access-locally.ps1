# Test Patricia's Call Connector Pro access on localhost
$email = "patriciasantamarina@aoglobelife.com"

Write-Host "`n🔒 Testing CCPRO Access Check..." -ForegroundColor Cyan
$accessResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/call-connector-pro/access-check/$email" -Method Get
$accessResponse | ConvertTo-Json -Depth 10

Write-Host "`n📋 Fetching Leads..." -ForegroundColor Cyan
$leadsResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/outbound-dialer/leads?userEmail=$email&market=Veteran&queueType=plus&limit=50" -Method Get
Write-Host "Leads returned: $($leadsResponse.leads.Count)" -ForegroundColor Yellow
$leadsResponse.leads[0..2] | ConvertTo-Json -Depth 3

