$url = "https://aoirail-production.up.railway.app/api/admin/sessions/clear"
Write-Host "Clearing all active sessions..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json"
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "SUCCESS: All sessions cleared!" -ForegroundColor Green
        Write-Host $result.message -ForegroundColor Gray
    } else {
        Write-Host "FAILED: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
