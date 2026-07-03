@echo off
setlocal EnableDelayedExpansion

echo 🔄 Force Rebuild and Deploy to Production
echo ==========================================
echo.

REM Step 1: Clean all build artifacts
echo 🧹 Step 1: Cleaning all build artifacts...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist client\node_modules\.vite rmdir /s /q client\node_modules\.vite

REM Step 2: Fresh build
echo.
echo 📦 Step 2: Building fresh production bundle...
call npm run build:production

REM Step 3: Verify build
echo.
echo ✅ Step 3: Verifying build output...
if exist dist\public\index.html (
    echo ✅ index.html exists
) else (
    echo ❌ index.html missing!
    exit /b 1
)

if exist dist\index.js (
    echo ✅ Server bundle exists
) else (
    echo ❌ Server bundle missing!
    exit /b 1
)

REM Step 4: Test build locally
echo.
echo 🧪 Step 4: You can test locally with: npm start
echo.

REM Step 5: Deploy to production
echo 🚀 Step 5: Deploying to production...
echo.
echo ⚠️  This will deploy to PRODUCTION!
echo.
set /p CONFIRM="Continue with production deployment? (y/N): "
if /i "%CONFIRM%"=="y" (
    echo Deploying...
    git add .
    git commit -m "Force rebuild: Fix blank signup page" --allow-empty
    git push origin master
    echo.
    echo ✅ Pushed to GitHub. Railway will auto-deploy.
    echo.
) else (
    echo ❌ Deployment cancelled
    exit /b 0
)

echo.
echo 📝 Next steps:
echo   1. Wait for Railway deployment to complete (~2-3 minutes^)
echo   2. Check Railway logs for any errors
echo   3. Test: https://aoirail-production.up.railway.app/signup
echo   4. Hard refresh (Ctrl+Shift+R^) to clear browser cache
echo.

pause

