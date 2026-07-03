@echo off
echo 🚂 Railway Deployment Script
echo ============================
echo.

REM Check if Railway CLI is installed
where railway >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
) else (
    echo ✅ Railway CLI is installed
)

echo.
echo 📝 Steps to deploy:
echo.
echo 1. Login to Railway:
echo    railway login
echo.
echo 2. Initialize project:
echo    railway init
echo.
echo 3. Deploy:
echo    railway up
echo.
echo 4. Create public domain:
echo    railway domain create
echo.
echo Ready to start? Run: railway login
pause

