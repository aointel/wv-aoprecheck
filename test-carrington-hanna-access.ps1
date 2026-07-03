# Test Carrington Hanna's Call Connector Pro access
# Simulates what happens when carringtonhanna@aoglobelife.com visits /connect

$email = "austinrockall@aoglobelife.com"
$baseUrl = $env:API_URL
if (-not $baseUrl) {
    $baseUrl = "http://localhost:5000"
}

Write-Host "`nTesting Call Connector Pro Access for: $email" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host ("-" * 60) -ForegroundColor Gray

# Check bypass list
Write-Host "`n1. Checking Bypass List..." -ForegroundColor Yellow
$bypassEmails = @(
    'richiealtig@aoglobelife.com',
    'coopertyler@aoglobelife.com',
    'jacobnavarre@aoglobelife.com',
    'kaylar@aoglobelife.com',
    'ryancarrion@aoglobelife.com',
    'makelaoutlawalexander@aoglobelife.com'
)

$normalizedEmail = $email.ToLower().Trim()
$isBypass = $bypassEmails -contains $normalizedEmail

Write-Host "   Email: $normalizedEmail" -ForegroundColor White
Write-Host "   In Bypass List: $(if ($isBypass) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($isBypass) { 'Green' } else { 'Red' })

# Test access check endpoint
Write-Host "`n2. Testing Access Check Endpoint..." -ForegroundColor Yellow
$accessUrl = "$baseUrl/api/call-connector-pro/access-check/$email"

try {
    Write-Host "   URL: $accessUrl" -ForegroundColor Gray
    $accessResponse = Invoke-RestMethod -Uri $accessUrl -Method Get -ErrorAction Stop
    
    Write-Host "`n   Response:" -ForegroundColor White
    $accessResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    $hasAccess = $accessResponse.hasAccess -eq $true
    $source = $accessResponse.source
    $hasDismissedPrimer = $accessResponse.hasDismissedPrimer
    
    Write-Host "`n   Access Summary:" -ForegroundColor Cyan
    Write-Host "      Has Access: $(if ($hasAccess) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasAccess) { 'Green' } else { 'Red' })
    Write-Host "      Source: $source" -ForegroundColor White
    Write-Host "      Primer Dismissed: $hasDismissedPrimer" -ForegroundColor White
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
    $hasAccess = $false
    $source = "error"
}

# Simulate user experience
Write-Host "`n3. Simulating User Experience on /connect..." -ForegroundColor Yellow
Write-Host ("-" * 60) -ForegroundColor Gray

if ($isBypass) {
    Write-Host "`nRESULT: User sees FULL ACCESS (Bypass Email)" -ForegroundColor Green
    Write-Host "   -> User will see the full Call Connector Pro interface" -ForegroundColor White
    Write-Host "   -> No signup modal, no restrictions" -ForegroundColor White
    Write-Host "   -> Can immediately start dialing" -ForegroundColor White
} elseif ($hasAccess) {
    Write-Host "`nRESULT: User has ACCESS" -ForegroundColor Green
    Write-Host "   -> User will see the full Call Connector Pro interface" -ForegroundColor White
    Write-Host "   -> Access granted via: $source" -ForegroundColor White
    Write-Host "   -> Can start dialing immediately" -ForegroundColor White
} else {
    Write-Host "`nRESULT: User does NOT have access" -ForegroundColor Red
    Write-Host "   -> User will see the SIGNUP component" -ForegroundColor White
    Write-Host "   -> Shows 'Call Connector Pro' signup card" -ForegroundColor White
    Write-Host "   -> Button: 'Subscribe to Call Connector Pro'" -ForegroundColor White
    Write-Host "   -> Clicking button redirects to Stripe checkout" -ForegroundColor White
    Write-Host "   -> After payment, access is granted" -ForegroundColor White
}

Write-Host ("-" * 60) -ForegroundColor Gray

# Summary
Write-Host "`nSUMMARY:" -ForegroundColor Cyan
Write-Host "   Email: $email" -ForegroundColor White
Write-Host "   Bypass: $(if ($isBypass) { 'YES' } else { 'NO' })" -ForegroundColor White
Write-Host "   Has Access: $(if ($hasAccess) { 'YES' } else { 'NO' })" -ForegroundColor White

$whatTheySee = if ($isBypass) {
    "Full Access (Bypass)"
} elseif ($hasAccess) {
    "Full Access"
} else {
    "Signup Screen -> Stripe Checkout"
}

$color = if ($hasAccess -or $isBypass) { 'Green' } else { 'Yellow' }
Write-Host "   What They See: $whatTheySee" -ForegroundColor $color
Write-Host "`nTest Complete!`n" -ForegroundColor Green
