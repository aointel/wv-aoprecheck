# Zoho OAuth Configuration
$clientId = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF"
$clientSecret = "b60187effb9b211d02853c974b5f82ae3f51e53f54"
$code = "1000.f2a09543f76e49faa615b989aa093b5c.486deea87e86ef578d49c771faa77568"

# Encode client credentials
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${clientId}:${clientSecret}"))

try {
    # Get access token
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "https://accounts.zoho.com/oauth/v2/token" `
        -Headers @{
            "Authorization" = "Basic $base64Auth"
            "Content-Type" = "application/x-www-form-urlencoded"
        } `
        -Body @{
            grant_type = "authorization_code"
            code = $code
            redirect_uri = "http://localhost:8000/callback"
        }

    # Output tokens
    Write-Host "Access Token: $($tokenResponse.access_token)"
    Write-Host "Refresh Token: $($tokenResponse.refresh_token)"
    Write-Host "Expires in: $($tokenResponse.expires_in) seconds"

    # Save tokens to file
    $tokens = @{
        access_token = $tokenResponse.access_token
        refresh_token = $tokenResponse.refresh_token
        expires_in = $tokenResponse.expires_in
        generated_at = Get-Date -Format "o"
    }

    $tokens | ConvertTo-Json | Out-File "zoho_tokens.json"
    Write-Host "Tokens saved to zoho_tokens.json"

} catch {
    Write-Host "Error getting tokens: $_"
    Write-Host "Response: $($_.Exception.Response.GetResponseStream())"
} 