# Load the existing voice token
$tokenFile = "zoho_tokens_voice.json"
$tokens = Get-Content -Path $tokenFile | ConvertFrom-Json

$baseUrl = "https://voice.zoho.com/rest/json/zv/api/queues"
$headers = @{
    'Authorization' = "Bearer $($tokens.access_token)"
    'Content-Type' = 'application/json'
}

# Build query parameters
$queryParams = @{
    from = 0
    offset = 100
}

# Build query string
$queryString = ($queryParams.GetEnumerator() | ForEach-Object { 
    "$($_.Key)=$([System.Web.HttpUtility]::UrlEncode($_.Value))" 
}) -join '&'

$url = "$baseUrl`?$queryString"

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
    
    Write-Host "`nAvailable Queues:"
    Write-Host "================="
    
    $response.data | ForEach-Object {
        Write-Host "`nQueue Name: $($_.name)"
        Write-Host "Queue ID: $($_.groupid)"
        Write-Host "Extension: $($_.extension)"
        Write-Host "Member Count: $($_.members.Count)"
        Write-Host "-------------------"
    }
} catch {
    Write-Error "Error fetching queues: $_"
} 