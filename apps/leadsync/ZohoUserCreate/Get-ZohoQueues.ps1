# First refresh the token
Write-Host "`nRefreshing token..."
.\Refresh-ZohoToken.ps1

# Wait a moment for token to settle
Start-Sleep -Seconds 2

# Show current token status
Write-Host "`nVerifying token..."
.\Get-CurrentTokens.ps1

# Wait a moment before using the token
Start-Sleep -Seconds 2

# Now get the queues
Write-Host "`nFetching all queues..."
npm run list

# Read the file to see what URL works
$content = Get-Content -Path Get-ZohoQueues.ps1 -Raw
Write-Host $content 