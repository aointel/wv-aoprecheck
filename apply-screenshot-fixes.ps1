# PowerShell script to apply screenshot capture fixes

Write-Host "Applying server-side screenshot fixes..." -ForegroundColor Cyan

# Save any unsaved files in Cursor
Write-Host "`n⚠️  IMPORTANT: Save all files in Cursor first (Ctrl+K S to save all)" -ForegroundColor Yellow
Write-Host "Press Enter when files are saved..." -ForegroundColor Yellow
$null = Read-Host

# Check git status
Write-Host "`nChecking git status..." -ForegroundColor Cyan
git status

# Commit if there are changes
$status = git status --porcelain
if ($status) {
    Write-Host "`nFound changes to commit:" -ForegroundColor Green
    git add server/presentation-tracker.ts server/routes.ts electron/main.cjs
    git commit -m "Fix: Screenshot capture bugs - session ID mismatch and logging

- Fix session_id query to use UUID (session.id) instead of string (sessionId)
- Fix fileName variable scope in screenshot upload
- Add comprehensive logging to both screenshot endpoints  
- Add debug logging to Electron main process"
    
    Write-Host "`nPushing to origin..." -ForegroundColor Cyan
    git push origin master
    
    Write-Host "`n✅ Fixes committed and pushed!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  No changes detected. Files may not be saved yet." -ForegroundColor Yellow
    Write-Host "Make sure to save all files in Cursor, then run git commands manually." -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green

