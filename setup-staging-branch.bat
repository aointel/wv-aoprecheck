@echo off
echo.
echo ================================================
echo 🌳 Setting Up Staging Branch
echo ================================================
echo.
echo This will:
echo   1. Commit current changes
echo   2. Create staging branch
echo   3. Push to GitHub
echo   4. Set up branch tracking
echo.
pause
echo.

echo 📝 Step 1: Committing current changes...
git add .
git commit -m "Setup: Add staging deployment and SPA routing fixes"
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Nothing to commit or commit failed
)
echo.

echo 🌿 Step 2: Creating staging branch...
git checkout -b staging
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Staging branch may already exist, switching to it...
    git checkout staging
)
echo.

echo 📤 Step 3: Pushing staging branch to GitHub...
git push -u origin staging
echo.

echo ✅ Staging branch created and pushed!
echo.
echo ================================================
echo 📋 NEXT STEPS:
echo ================================================
echo.
echo 1. Configure Railway Staging Service:
echo    - Go to Railway dashboard
echo    - Create new service: "staging"
echo    - Connect to GitHub repo
echo    - Deploy from: "staging" branch
echo    - Set environment variables
echo.
echo 2. Your branch structure:
echo    - master  = Production (never touch directly)
echo    - staging = Development (work here)
echo.
echo 3. Daily workflow:
echo    git checkout staging
echo    git pull
echo    [make changes]
echo    git add .
echo    git commit -m "message"
echo    git push origin staging
echo.
echo 4. Deploy to production (after testing):
echo    git checkout master
echo    git merge staging
echo    git push origin master
echo    git checkout staging
echo.
echo 📖 Full documentation: GIT_BRANCHING_WORKFLOW.md
echo.
echo ================================================
pause

