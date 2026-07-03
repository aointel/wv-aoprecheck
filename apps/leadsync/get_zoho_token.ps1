$clientId = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF"
$clientSecret = "b60187effb9b211d02853c974b5f82ae3f51e53f54"
$authCode = "1000.b32c8ab14be8c0a958975a1ac48f05d5.aae2d5f1aa5430ed2c368a368c337fed"

$body = @{
    code = $authCode
    client_id = $clientId
    client_secret = $clientSecret
    grant_type = "authorization_code"
    redirect_uri = "http://localhost"
}

Write-Host "Getting Zoho token..."

$response = Invoke-RestMethod -Method Post `
    -Uri "https://accounts.zoho.com/oauth/v2/token" `
    -Body $body `
    -ContentType "application/x-www-form-urlencoded"

Write-Host "`nAccess Token: $($response.access_token)"
Write-Host "Refresh Token: $($response.refresh_token)"
Write-Host "Expires in: $($response.expires_in) seconds" 