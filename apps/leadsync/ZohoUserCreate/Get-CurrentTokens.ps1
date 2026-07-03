# Load and display current tokens
$tokenFile = "zoho_tokens_voice.json"
try {
    $tokens = Get-Content -Path $tokenFile | ConvertFrom-Json
    
    Write-Host "`nCurrent Tokens:"
    Write-Host "=============="
    Write-Host "Access Token: $($tokens.access_token)"
    Write-Host "Refresh Token: $($tokens.refresh_token)"
    Write-Host "Expires At: $($tokens.expires_at)"
    Write-Host "Scope: $($tokens.scope)"

    # Check if token is expired or about to expire (within 5 minutes)
    $expiresAt = [DateTime]::Parse($tokens.expires_at)
    $timeUntilExpiry = $expiresAt - (Get-Date)
    
    Write-Host "`nToken Status:"
    Write-Host "============"
    Write-Host "Time until expiry: $([Math]::Round($timeUntilExpiry.TotalMinutes)) minutes"
    
    if ((Get-Date) -ge $expiresAt) {
        Write-Host "Status: EXPIRED" -ForegroundColor Red
    } elseif ($timeUntilExpiry.TotalMinutes -lt 5) {
        Write-Host "Status: EXPIRING SOON" -ForegroundColor Yellow
    } else {
        Write-Host "Status: VALID" -ForegroundColor Green
    }
}
catch {
    Write-Error "Failed to read tokens: $_"
} 