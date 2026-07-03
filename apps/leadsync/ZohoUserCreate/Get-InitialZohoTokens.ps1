# Configuration
$config = @{
    client_id     = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF"
    client_secret = "b60187effb9b211d02853c974b5f82ae3f51e53f54"
    code          = "1000.ecc2b6011afb4235c73de6c6973c316e.5f66edbf00285e7be3e88bdae0897757"
    redirect_uri  = "http://localhost:8080/callback"
    accounts_url  = "https://accounts.zoho.com"
}

# Use both READ and UPDATE scopes
$scope = "zohovoice.queues.READ,zohovoice.queues.UPDATE"

Write-Host "`nGetting tokens for Voice scope..."

$tokenUrl = "$($config.accounts_url)/oauth/v2/token"
$body = @{
    code          = $config.code
    client_id     = $config.client_id
    client_secret = $config.client_secret
    grant_type    = "authorization_code"
    redirect_uri  = $config.redirect_uri
    scope         = $scope
}

try {
    $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body

    $tokens = @{
        access_token  = $response.access_token
        refresh_token = $response.refresh_token
        expires_at    = (Get-Date).AddSeconds($response.expires_in).ToString('o')
        scope         = $scope
    }

    # Save tokens to file
    $fileName = "zoho_tokens_voice.json"
    $tokens | ConvertTo-Json | Set-Content -Path $fileName
    
    Write-Host "Tokens saved to $fileName"
    Write-Host "Access Token: $($tokens.access_token)"
    Write-Host "Refresh Token: $($tokens.refresh_token)"
    Write-Host "Expires At: $($tokens.expires_at)"
}
catch {
    Write-Error "Failed to get tokens for Voice: $_"
}

Write-Host "`nToken generation complete." 