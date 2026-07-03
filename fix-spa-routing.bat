@echo off
echo.
echo ================================================
echo 🔧 FIX: SPA Routing Issue (Blank on First Load)
echo ================================================
echo.
echo This fixes the issue where /signup doesn't load
echo until you refresh the page.
echo.
echo Changes made:
echo   ✅ Updated server/vite.ts catch-all handler
echo   ✅ Changed app.get to app.use for better routing
echo   ✅ Added logging to track SPA route serving
echo.
echo ================================================
echo.
pause
echo.
echo 📦 Step 1: Building production bundle...
call npm run build:production
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)
echo ✅ Build successful
echo.
echo 📤 Step 2: Committing and pushing changes...
git add server/vite.ts
git add fix-spa-routing.bat
git commit -m "Fix SPA routing: /signup now loads on first visit"
git push origin master
echo.
echo ✅ Pushed to GitHub
echo.
echo ================================================
echo 📋 NEXT STEPS:
echo ================================================
echo.
echo 1. Wait 2-3 minutes for Railway to deploy
echo.
echo 2. Test the signup page:
echo    https://aoirail-production.up.railway.app/signup
echo.
echo 3. It should now load immediately without refresh!
echo.
echo 4. Check Railway logs for debug messages:
echo    Look for: "📄 Serving SPA route: /signup"
echo.
echo ================================================
pause

