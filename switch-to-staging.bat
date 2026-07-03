@echo off
echo.
echo ================================================
echo 🔄 Switching to Staging Branch
echo ================================================
echo.

REM Check if staging branch exists locally
git rev-parse --verify staging >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Staging branch exists locally
    git checkout staging
    git pull origin staging
    echo.
    echo ✅ Now on staging branch and up to date!
) else (
    echo ⚠️  Staging branch doesn't exist locally
    echo.
    echo Creating staging branch...
    git checkout -b staging
    
    REM Try to pull if it exists remotely
    git pull origin staging 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Pulled existing staging branch from remote
    ) else (
        echo 📤 Pushing new staging branch to remote
        git push -u origin staging
    )
    echo.
    echo ✅ Created and switched to staging branch!
)

echo.
echo ================================================
echo 📋 YOU ARE NOW ON STAGING BRANCH
echo ================================================
echo.
echo All your changes will go to staging server
echo.
echo To push changes:
echo   git add .
echo   git commit -m "your message"
echo   git push
echo.
echo To deploy to production later:
echo   git checkout master
echo   git merge staging
echo   git push
echo.
pause

