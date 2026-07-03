#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Creating ConnectNow.exe and Professional Installer...');

// Step 1: Create the renamed ConnectNow.exe
const enhancedLauncher = `
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('='.repeat(60));
console.log('    AO Intelligence powered by ConnectNow v1.0.1');
console.log('    Professional Desktop Application');
console.log('='.repeat(60));
console.log();
console.log('🚀 Initializing ConnectNow Desktop Experience...');

// Create application directory
const appDir = path.join(os.homedir(), 'AppData', 'Local', 'ConnectNow');
try {
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
    console.log('📁 Application directory created:', appDir);
  }
} catch (e) {
  console.log('📁 Using temporary directory for this session');
}

// Enhanced Chrome detection with multiple fallbacks
const chromePaths = [
  'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
  'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\\\Users\\\\' + os.userInfo().username + '\\\\AppData\\\\Local\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'
];

function findChrome() {
  for (const chromePath of chromePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    } catch (e) {}
  }
  return null;
}

const chromePath = findChrome();
const appUrl = 'https://aointelligence.replit.app';

if (chromePath) {
  console.log('🌐 Launching ConnectNow in optimized desktop mode...');
  console.log('📱 URL:', appUrl);
  
  const chromeArgs = [
    '--app=' + appUrl,
    '--window-size=1400,900',
    '--disable-web-security',
    '--user-data-dir=' + path.join(os.tmpdir(), 'ConnectNow-' + Date.now()),
    '--disable-features=TranslateUI',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-networking',
    '--new-window'
  ];
  
  const chrome = spawn(chromePath, chromeArgs, {
    detached: true,
    stdio: 'ignore'
  });
  
  chrome.unref();
  
  console.log('✅ ConnectNow desktop application is now running!');
  console.log('💼 Professional calling platform ready for use');
  console.log();
  console.log('This window will close automatically in 5 seconds...');
  
  setTimeout(() => {
    console.log('🎉 Enjoy using ConnectNow!');
    process.exit(0);
  }, 5000);
  
} else {
  console.log('🔍 Chrome not found, opening in default browser...');
  console.log('💡 For best experience, install Google Chrome');
  
  const { exec } = require('child_process');
  exec('start ' + appUrl, (error) => {
    if (error) {
      console.error('Error opening browser:', error);
    } else {
      console.log('✅ ConnectNow opened in browser');
    }
    setTimeout(() => process.exit(0), 3000);
  });
}
`;

// Write the launcher
fs.writeFileSync('desktop-launcher/connectnow-app.js', enhancedLauncher);

console.log('📦 Building ConnectNow.exe...');

// Build the main executable
const pkgBuild = spawn('npx', [
  'pkg',
  'desktop-launcher/connectnow-app.js',
  '--targets',
  'node18-win-x64',
  '--output',
  'uploads/installers/ConnectNow.exe'
], {
  stdio: 'inherit',
  shell: true
});

pkgBuild.on('close', (code) => {
  if (code === 0) {
    console.log('✅ ConnectNow.exe created successfully!');
    createInstaller();
  } else {
    console.error('❌ Failed to create ConnectNow.exe');
  }
});

function createInstaller() {
  console.log('🔧 Creating professional installer...');
  
  // Create installer script
  const installerScript = `
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

console.log('='.repeat(70));
console.log('    ConnectNow Professional Installer v1.0.1');
console.log('    AO Intelligence powered by ConnectNow');
console.log('='.repeat(70));
console.log();
console.log('🚀 Installing ConnectNow Desktop Application...');
console.log();

// Installation paths
const programFiles = process.env['ProgramFiles'] || 'C:\\\\Program Files';
const installDir = path.join(programFiles, 'ConnectNow');
const userInstallDir = path.join(os.homedir(), 'AppData', 'Local', 'ConnectNow');
const desktopPath = path.join(os.homedir(), 'Desktop', 'ConnectNow.lnk');
const startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ConnectNow.lnk');

console.log('📁 Installation directory:', userInstallDir);

// Create installation directory
try {
  if (!fs.existsSync(userInstallDir)) {
    fs.mkdirSync(userInstallDir, { recursive: true });
    console.log('✅ Installation directory created');
  }
} catch (error) {
  console.error('❌ Failed to create installation directory:', error.message);
  process.exit(1);
}

// Download and install ConnectNow.exe
console.log('📥 Downloading ConnectNow application...');

const exeUrl = 'https://aointelligence.replit.app/uploads/installers/ConnectNow.exe';
const exePath = path.join(userInstallDir, 'ConnectNow.exe');

https.get(exeUrl, (response) => {
  if (response.statusCode === 200) {
    const fileStream = fs.createWriteStream(exePath);
    response.pipe(fileStream);
    
    fileStream.on('finish', () => {
      fileStream.close();
      console.log('✅ ConnectNow.exe downloaded successfully');
      createShortcuts();
    });
  } else {
    console.error('❌ Failed to download ConnectNow.exe');
    process.exit(1);
  }
}).on('error', (error) => {
  console.error('❌ Download error:', error.message);
  process.exit(1);
});

function createShortcuts() {
  console.log('🔗 Creating desktop shortcuts...');
  
  // Create batch file to launch ConnectNow
  const launcherBat = \`@echo off
echo Starting ConnectNow...
cd /d "\${userInstallDir}"
start "" "ConnectNow.exe"
\`;
  
  const batPath = path.join(userInstallDir, 'Launch-ConnectNow.bat');
  fs.writeFileSync(batPath, launcherBat);
  
  console.log('✅ Launcher created');
  console.log();
  console.log('🎉 Installation Complete!');
  console.log();
  console.log('📍 ConnectNow has been installed to:');
  console.log('   ' + userInstallDir);
  console.log();
  console.log('🚀 To launch ConnectNow:');
  console.log('   - Run: ' + exePath);
  console.log('   - Or use: ' + batPath);
  console.log();
  console.log('💼 ConnectNow is ready for professional use!');
  console.log();
  
  setTimeout(() => {
    console.log('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
  }, 2000);
}
`;

  // Write installer script
  fs.writeFileSync('desktop-launcher/installer.js', installerScript);
  
  console.log('🔨 Building ConnectNow-Setup.exe installer...');
  
  // Build the installer
  const installerBuild = spawn('npx', [
    'pkg',
    'desktop-launcher/installer.js',
    '--targets',
    'node18-win-x64',
    '--output',
    'uploads/installers/ConnectNow-Setup.exe'
  ], {
    stdio: 'inherit',
    shell: true
  });
  
  installerBuild.on('close', (installerCode) => {
    if (installerCode === 0) {
      console.log('✅ ConnectNow-Setup.exe installer created!');
      updateDownloadSystem();
    } else {
      console.error('❌ Failed to create installer');
    }
  });
}

function updateDownloadSystem() {
  console.log('📋 Updating download system...');
  
  // Update installer info
  const installerInfo = {
    version: '1.0.1',
    buildDate: new Date().toISOString(),
    description: 'AO Intelligence powered by ConnectNow Desktop Application',
    features: [
      'Professional calling interface',
      'WebRTC technology integration', 
      'Lead management system',
      'Video conferencing capabilities',
      'Appointment scheduling',
      'Real-time collaboration tools'
    ],
    systemRequirements: {
      windows: {
        os: 'Windows 10 or later',
        memory: '4 GB RAM minimum',
        storage: '200 MB available space',
        browser: 'Google Chrome (recommended)'
      }
    },
    files: {
      'ConnectNow.exe': {
        size: '~37MB',
        type: 'Standalone Application',
        description: 'Complete desktop application with Node.js runtime'
      },
      'ConnectNow-Setup.exe': {
        size: '~37MB',
        type: 'Professional Installer',
        description: 'Automated installer that downloads and configures ConnectNow'
      }
    }
  };
  
  fs.writeFileSync('uploads/installers/installer-info.json', JSON.stringify(installerInfo, null, 2));
  
  console.log('🎉 Complete installer system ready!');
  console.log('📋 Available files:');
  console.log('   - ConnectNow.exe (Direct executable)');
  console.log('   - ConnectNow-Setup.exe (Professional installer)');
  console.log('   - ConnectNow-1.0.1-Mac (Mac version)');
  console.log();
  console.log('🚀 Your professional installer system is complete!');
}