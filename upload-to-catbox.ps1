# Upload to catbox.moe (free, no account needed, supports large files)
$filePath = "C:\Users\mmand\OneDrive\Desktop\AOI\electron-dist\AO Intelligence 1.0.3.exe"
$uploadUrl = "https://catbox.moe/user/api.php"

Write-Host "📤 Uploading ConnectNow.exe to catbox.moe..."
Write-Host "   File: $filePath"
Write-Host "   Size: $([math]::Round((Get-Item $filePath).Length/1MB, 2)) MB"
Write-Host ""

# Create form data
$form = @{
    reqtype = "fileupload"
    fileToUpload = Get-Item $filePath
}

try {
    $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Form $form
    Write-Host "✅ Upload successful!"
    Write-Host ""
    Write-Host "📥 Download URL:"
    Write-Host "   $response"
    Write-Host ""
    Write-Host "📋 Update Downloads.tsx with this URL"
    
    # Copy URL to clipboard
    Set-Clipboard -Value $response
    Write-Host "✅ URL copied to clipboard!"
    
} catch {
    Write-Host "❌ Upload failed: $_"
    Write-Host ""
    Write-Host "Alternative: Use file.io instead"
}

