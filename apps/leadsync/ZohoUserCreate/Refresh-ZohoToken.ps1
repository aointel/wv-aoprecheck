# Configuration - NEVER CHANGE THESE
$config = @{
    client_id     = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF"
    client_secret = "b60187effb9b211d02853c974b5f82ae3f51e53f54"
    accounts_url  = "https://accounts.zoho.com"
}

# Load existing token
$tokenFile = "zoho_tokens_voice.json"
try {
    $tokens = Get-Content -Path $tokenFile | ConvertFrom-Json
    
    # KEEP THE ORIGINAL SCOPE - NEVER CHANGE IT
    $originalScope = $tokens.scope
    
    $tokenUrl = "$($config.accounts_url)/oauth/v2/token"
    $body = @{
        refresh_token = $tokens.refresh_token
        client_id     = $config.client_id
        client_secret = $config.client_secret
        grant_type    = "refresh_token"
        scope         = "zohovoice.agents.ALL"
    }

    $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body
    
    # Keep everything the same, just update access token and expiry
    $updatedTokens = @{
        access_token  = $response.access_token
        refresh_token = $tokens.refresh_token
        expires_at    = (Get-Date).AddSeconds($response.expires_in).ToString('o')
        scope         = $originalScope  # Keep original scope
    }

    # Save updated tokens
    $updatedTokens | ConvertTo-Json | Set-Content -Path $tokenFile
    
    Write-Host "Tokens refreshed successfully"
    Write-Host "New Access Token: $($updatedTokens.access_token)"
    Write-Host "Expires At: $($updatedTokens.expires_at)"
    Write-Host "Scope: $($originalScope) (unchanged)"
}
catch {
    Write-Error "Failed to refresh token: $_"
} 