#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

console.log('🖥️ Creating ConnectNow Desktop Application...');

// Create a simple HTML wrapper that acts as a desktop app
const createDesktopHTML = () => {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AO Intelligence powered by ConnectNow</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
            font-family: Arial, sans-serif;
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            flex-direction: column;
        }
        .loading h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        .loading p {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        #app-frame {
            width: 100%;
            height: 100vh;
            border: none;
            display: none;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <h1>AO Intelligence powered by ConnectNow</h1>
        <div class="spinner"></div>
        <p>Loading your professional calling platform...</p>
    </div>
    <iframe id="app-frame" src="https://aointelligence.replit.app"></iframe>
    
    <script>
        // Hide loading screen when iframe loads
        document.getElementById('app-frame').onload = function() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app-frame').style.display = 'block';
        };
        
        // Show iframe after 3 seconds even if not fully loaded
        setTimeout(function() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app-frame').style.display = 'block';
        }, 3000);
    </script>
</body>
</html>`;

  if (!fs.existsSync('uploads/installers')) {
    fs.mkdirSync('uploads/installers', { recursive: true });
  }
  
  fs.writeFileSync('uploads/installers/ConnectNow-Desktop.html', htmlContent);
  console.log('✅ Desktop HTML application created');
};

// Create Windows batch launcher
const createWindowsLauncher = () => {
  const batchContent = `@echo off
title AO Intelligence powered by ConnectNow
echo.
echo ==========================================
echo  AO Intelligence powered by ConnectNow
echo  Desktop Application v1.0.1
echo ==========================================
echo.
echo Starting ConnectNow...
echo.

REM Try to find Chrome first
set CHROME_PATH=""
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    set CHROME_PATH="%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    set CHROME_PATH="%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" (
    set CHROME_PATH="%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"
)

REM Launch in Chrome if available, otherwise default browser
if not %CHROME_PATH%=="" (
    echo Launching ConnectNow in Chrome...
    start %CHROME_PATH% --app=https://aointelligence.replit.app --window-size=1400,900 --disable-web-security --user-data-dir="%TEMP%\\ConnectNow"
) else (
    echo Launching ConnectNow in default browser...
    start https://aointelligence.replit.app
)

echo.
echo ConnectNow is now running!
echo Close this window to continue using the application.
echo.
timeout /t 3 /nobreak >nul
exit`;

  fs.writeFileSync('uploads/installers/ConnectNow-Setup-1.0.1.exe', batchContent);
  
  // Also create a .bat version for compatibility
  fs.writeFileSync('uploads/installers/ConnectNow-Desktop.bat', batchContent);
  
  console.log('✅ Windows launcher created');
};

// Create Mac launcher
const createMacLauncher = () => {
  const shellContent = `#!/bin/bash
echo ""
echo "=========================================="
echo " AO Intelligence powered by ConnectNow"
echo " Desktop Application v1.0.1"
echo "=========================================="
echo ""
echo "Starting ConnectNow..."
echo ""

# Try to find Chrome first
CHROME_PATH=""
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -f "/System/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    CHROME_PATH="/System/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

# Launch in Chrome if available, otherwise default browser
if [ -n "$CHROME_PATH" ]; then
    echo "Launching ConnectNow in Chrome..."
    "$CHROME_PATH" --app=https://aointelligence.replit.app --window-size=1400,900 &
else
    echo "Launching ConnectNow in default browser..."
    open https://aointelligence.replit.app
fi

echo ""
echo "ConnectNow is now running!"
echo "You can close this terminal window."
echo ""
sleep 3`;

  fs.writeFileSync('uploads/installers/ConnectNow-1.0.1.dmg', shellContent);
  
  // Make it executable
  try {
    fs.chmodSync('uploads/installers/ConnectNow-1.0.1.dmg', '755');
  } catch (e) {
    console.log('Note: Could not set executable permissions on Mac launcher');
  }
  
  console.log('✅ Mac launcher created');
};

// Create all desktop applications
createDesktopHTML();
createWindowsLauncher();
createMacLauncher();

console.log('🎉 Desktop applications created successfully!');
console.log('📁 Files available in uploads/installers/');
console.log('');
console.log('Windows users: Run ConnectNow-Setup-1.0.1.exe');
console.log('Mac users: Run ConnectNow-1.0.1.dmg');
console.log('All platforms: Open ConnectNow-Desktop.html in any browser');