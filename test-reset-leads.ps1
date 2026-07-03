# Wait for server to be ready and then reset pending leads
Write-Host "⏳ Waiting for server to be ready..."
Start-Sleep -Seconds 5

try {
    Write-Host "🔄 Calling admin reset endpoint..."
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/reset-pending-leads" -Method POST -UseBasicParsing
    Write-Host "✅ Response: $($response.Content)"
} catch {
    Write-Host "❌ Error: $_"
    exit 1
}

