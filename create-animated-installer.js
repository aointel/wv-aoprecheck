#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🎨 Creating Animated ConnectNow Installer...');

// Create animated installer with ConnectNow loading animation
const animatedInstaller = `
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

// ConnectNow branded loading animation
function showLoadingAnimation(message, duration = 3000) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  console.log();
  console.log('    ' + '='.repeat(60));
  console.log('      🚀 AO Intelligence powered by ConnectNow 🚀');
  console.log('    ' + '='.repeat(60));
  console.log();
  
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      process.stdout.write('\\r    ' + frames[i++ % frames.length] + ' ' + message);
    }, 100);
    
    setTimeout(() => {
      clearInterval(interval);
      process.stdout.write('\\r    ✅ ' + message + ' Complete!\\n');
      resolve();
    }, duration);
  });
}

async function createDesktopShortcut() {
  try {
    console.log('\\n📍 Creating desktop shortcut...');
    
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'ConnectNow.lnk');
    
    // For Windows, create a batch file that launches Chrome
    const launcherPath = path.join(os.homedir(), 'AppData', 'Local', 'ConnectNow', 'launch.bat');
    const launcherDir = path.dirname(launcherPath);
    
    // Create launcher directory
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
    }
    
    // Create launcher batch file
    const launcherContent = \`@echo off
title ConnectNow - Professional Calling Platform
echo.
echo =============================================================
echo    🚀 AO Intelligence powered by ConnectNow v1.0.2
echo    Professional Desktop Application
echo =============================================================
echo.
echo ⚡ Launching ConnectNow Desktop Experience...
echo.

REM Find Chrome installation
set "chrome_path="
if exist "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe" (
    set "chrome_path=C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"
) else if exist "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe" (
    set "chrome_path=C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"
) else (
    echo ❌ Google Chrome not found. Please install Chrome for the best experience.
    echo Opening in default browser...
    start https://aointelligence.replit.app?desktop=true
    goto end
)

REM Launch in app mode
"%chrome_path%" --app=https://aointelligence.replit.app?desktop=true --window-size=1400,900 --disable-web-security --user-data-dir="%TEMP%\\\\ConnectNow-%RANDOM%" --disable-features=TranslateUI --no-first-run --disable-default-apps --new-window

:end
echo.
echo ✅ ConnectNow is now running!
timeout /t 2 /nobreak >nul
exit
\`;
    
    fs.writeFileSync(launcherPath, launcherContent);
    
    // Create desktop shortcut (Windows .url file)
    const shortcutContent = \`[InternetShortcut]
URL=file:///${launcherPath.replace(/\\\\/g, '/')}
IconFile=%SystemRoot%\\\\system32\\\\shell32.dll
IconIndex=13
\`;
    
    fs.writeFileSync(path.join(desktopPath, 'ConnectNow.url'), shortcutContent);
    
    console.log('✅ Desktop shortcut created: ' + path.join(desktopPath, 'ConnectNow.url'));
    console.log('✅ Launcher created: ' + launcherPath);
    
    return true;
  } catch (error) {
    console.log('⚠️  Could not create desktop shortcut:', error.message);
    return false;
  }
}

async function main() {
  try {
    // Welcome animation
    await showLoadingAnimation('Initializing ConnectNow Installer', 2000);
    await showLoadingAnimation('Preparing Professional Calling Platform', 2000);
    await showLoadingAnimation('Configuring Desktop Integration', 2000);
    
    // Create desktop shortcut
    const shortcutCreated = await createDesktopShortcut();
    
    await showLoadingAnimation('Finalizing Installation', 1500);
    
    console.log();
    console.log('    ' + '='.repeat(60));
    console.log('    🎉 ConnectNow Installation Complete! 🎉');
    console.log('    ' + '='.repeat(60));
    console.log();
    
    if (shortcutCreated) {
      console.log('    ✅ Desktop shortcut created');
      console.log('    ✅ Click "ConnectNow" on your desktop to launch');
    }
    
    console.log('    ✅ Professional calling interface ready');
    console.log('    ✅ WebRTC technology enabled');
    console.log('    ✅ Automatic updates configured');
    console.log();
    console.log('    📋 For Agents:');
    console.log('       1. Look for "ConnectNow" shortcut on your desktop');
    console.log('       2. Double-click to launch your calling platform');
    console.log('       3. Login with your AO Intelligence credentials');
    console.log();
    console.log('    💡 Need help? Contact your supervisor');
    console.log();
    
    // Auto-launch after installation
    console.log('    🚀 Launching ConnectNow now...');
    
    setTimeout(() => {
      // Launch the application
      const launcherPath = path.join(os.homedir(), 'AppData', 'Local', 'ConnectNow', 'launch.bat');
      if (fs.existsSync(launcherPath)) {
        spawn('cmd', ['/c', launcherPath], { detached: true, stdio: 'ignore' }).unref();
      } else {
        // Fallback to direct browser launch
        const { exec } = require('child_process');
        exec('start https://aointelligence.replit.app?desktop=true');
      }
      
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.log('');
    console.log('📞 Please contact support for assistance');
    process.exit(1);
  }
}

main();
`;

// Write the animated installer
if (!fs.existsSync('desktop-launcher')) {
  fs.mkdirSync('desktop-launcher', { recursive: true });
}

fs.writeFileSync('desktop-launcher/animated-installer.js', animatedInstaller);

console.log('🎨 Building ConnectNow-Setup.exe with animation...');

// Build the animated installer
const pkgBuild = spawn('npx', [
  'pkg',
  'desktop-launcher/animated-installer.js',
  '--targets',
  'node18-win-x64',
  '--output',
  'uploads/installers/ConnectNow-Setup.exe'
], {
  stdio: 'inherit',
  shell: true
});

pkgBuild.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Animated ConnectNow-Setup.exe created successfully!');
    updateInstallerManifest();
  } else {
    console.error('❌ Failed to create animated installer');
  }
});

function updateInstallerManifest() {
  console.log('📋 Updating installer manifest...');
  
  const manifest = {
    name: 'ConnectNow Professional Desktop Application',
    version: '1.0.2',
    description: 'AO Intelligence powered by ConnectNow - Professional calling platform for insurance agents',
    buildDate: new Date().toISOString(),
    installer: {
      animated: true,
      features: [
        '🎨 Animated installation with ConnectNow branding',
        '📍 Automatic desktop shortcut creation',
        '🚀 Chrome app mode optimization',
        '⚡ Professional loading animations',
        '🔧 Intelligent Chrome detection',
        '📋 Agent-friendly instructions',
        '✅ Auto-launch after installation'
      ],
      instructions: {
        forAgents: [
          'Download ConnectNow-Setup.exe',
          'Run the installer (it will show cool animations)',
          'Look for ConnectNow shortcut on your desktop',
          'Double-click the shortcut to launch',
          'Login with your AO credentials'
        ],
        forSupervisors: [
          'Distribute ConnectNow-Setup.exe to agents',
          'Installer creates desktop shortcuts automatically',
          'Agents just need to double-click desktop shortcut',
          'System works on any Windows computer with Chrome',
          'Updates happen automatically when agents launch'
        ]
      }
    },
    systemRequirements: {
      os: 'Windows 10 or later',
      browser: 'Google Chrome (automatically detected)',
      storage: '50 MB available space',
      internet: 'Broadband connection for calling features'
    }
  };
  
  fs.writeFileSync('uploads/installers/installer-manifest.json', JSON.stringify(manifest, null, 2));
  
  console.log('🎉 Animated installer system complete!');
  console.log('📋 Key Features:');
  console.log('   - Animated installation with ConnectNow branding');
  console.log('   - Automatic desktop shortcut creation');
  console.log('   - Agent-friendly instructions during install');
  console.log('   - Professional loading animations');
  console.log('   - Auto-launch after installation');
  console.log('');
  console.log('💡 For Agents: Just run the installer, look for desktop shortcut, done!');
}