@echo off
setlocal EnableDelayedExpansion

echo.
echo ================================================
echo 🚨 PRODUCTION DEPLOYMENT - APPROVAL REQUIRED
echo ================================================
echo.
echo This will deploy to LIVE PRODUCTION:
echo   https://aoirail-production.up.railway.app
echo.
echo ⚠️  STOP! Have you completed the checklist?
echo.
echo ✅ Tested in staging: aoirail-beta-staging.up.railway.app
echo ✅ Verified all features work correctly
echo ✅ Checked Railway logs for errors
echo ✅ No console errors in browser
echo ✅ Tested login/signup flows
echo ✅ Got APPROVAL from authorized person
echo.
echo ================================================
echo.

REM Check we're not already on master
git branch | findstr /C:"* master" >nul
if %ERRORLEVEL% EQU 0 (
    echo ❌ ERROR: You are already on master branch!
    echo    Please switch to staging first.
    echo.
    echo    Run: git checkout staging
    echo.
    pause
    exit /b 1
)

echo 📋 APPROVAL REQUIRED
echo.
set /p APPROVER="Enter name of person who approved this deployment: "

if "!APPROVER!"=="" (
    echo.
    echo ❌ Deployment cancelled - No approver name provided
    echo.
    pause
    exit /b 1
)

echo.
echo 🔍 Checking staging branch status...
git fetch origin
git diff staging origin/staging --quiet
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  WARNING: Local staging branch differs from remote!
    echo    Push to staging first or pull latest changes.
    echo.
    pause
    exit /b 1
)

echo.
echo ⚠️  FINAL CONFIRMATION
echo.
echo You are about to deploy to PRODUCTION
echo Approved by: !APPROVER!
echo.
set /p CONFIRM="Type 'DEPLOY TO PRODUCTION' to confirm (or anything else to cancel): "

if not "!CONFIRM!"=="DEPLOY TO PRODUCTION" (
    echo.
    echo ❌ Deployment cancelled - Confirmation text did not match
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo 🚀 Starting Production Deployment
echo ================================================
echo.

echo 📝 Step 1: Switching to master branch...
git checkout master
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to switch to master branch
    pause
    exit /b 1
)

echo.
echo 📥 Step 2: Pulling latest master...
git pull origin master
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to pull master
    pause
    exit /b 1
)

echo.
echo 🔀 Step 3: Merging staging into master...
git merge staging -m "Production deployment approved by !APPROVER!"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Merge failed! Resolve conflicts manually.
    echo.
    pause
    exit /b 1
)

echo.
echo 📤 Step 4: Pushing to production...
git push origin master
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Push to production failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ SUCCESS! Deployed to production
echo.
echo 🔄 Step 5: Switching back to staging branch...
git checkout staging

echo.
echo ================================================
echo ✅ PRODUCTION DEPLOYMENT COMPLETE
echo ================================================
echo.
echo Deployed by: !APPROVER!
echo Production URL: https://aoirail-production.up.railway.app
echo.
echo 📋 Post-Deployment Checklist:
echo   1. Wait 2-3 minutes for Railway to deploy
echo   2. Test production URL
echo   3. Check Railway production logs
echo   4. Verify critical features work
echo   5. Monitor for errors
echo.
echo Railway will auto-deploy in ~2-3 minutes
echo.
pause

