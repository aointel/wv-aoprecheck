#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔄 Auto-Updating ConnectNow Desktop Applications...');

// Enhanced launcher with auto-update capability
const enhancedLauncherWithUpdate = `
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

console.log('='.repeat(60));
console.log('    AO Intelligence powered by ConnectNow v1.0.2');
console.log('    Professional Desktop Application');
console.log('='.repeat(60));
console.log();

// Check for updates first
async function checkForUpdates() {
  console.log('🔍 Checking for updates...');
  const currentVersion = '1.0.2';
  
  try {
    const updateCheck = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ currentVersion });
      
      const req = https.request({
        hostname: 'aointelligence.replit.app',
        port: 443,
        path: '/api/version/check',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
      
      setTimeout(() => reject(new Error('Update check timeout')), 10000);
    });

    if (updateCheck.hasUpdate) {
      console.log('📥 Update available! Version:', updateCheck.versionInfo.version);
      console.log('📋 Release notes:');
      updateCheck.versionInfo.releaseNotes.forEach(note => {
        console.log('   • ' + note);
      });
      
      if (updateCheck.updateRequired) {
        console.log('⚠️  This is a required update. Downloading...');
        await downloadUpdate(updateCheck.versionInfo.downloadUrl);
        return;
      } else {
        console.log('✅ Update available but not required. Continuing with current version...');
      }
    } else {
      console.log('✅ You have the latest version');
    }
  } catch (error) {
    console.log('⚠️  Update check failed, continuing with current version');
    console.log('   Error:', error.message);
  }
  
  launchApplication();
}

async function downloadUpdate(downloadUrl) {
  console.log('📥 Downloading update...');
  
  const updatePath = path.join(os.tmpdir(), 'ConnectNow-Update.exe');
  const file = fs.createWriteStream(updatePath);
  
  https.get(\`https://aointelligence.replit.app\${downloadUrl}\`, (response) => {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('✅ Update downloaded successfully');
      console.log('🚀 Launching updated version...');
      
      // Launch the updated version
      spawn(updatePath, [], { detached: true, stdio: 'ignore' }).unref();
      process.exit(0);
    });
  }).on('error', (error) => {
    console.error('❌ Update download failed:', error.message);
    console.log('📱 Launching current version...');
    launchApplication();
  });
}

function launchApplication() {
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
}

// Start the application with update check
checkForUpdates();
`;

// Write the updated launcher
fs.writeFileSync('desktop-launcher/connectnow-auto-update.js', enhancedLauncherWithUpdate);

console.log('📦 Building updated ConnectNow.exe with auto-update...');

// Build the updated executable
const pkgBuild = spawn('npx', [
  'pkg',
  'desktop-launcher/connectnow-auto-update.js',
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
    console.log('✅ Auto-updating ConnectNow.exe created successfully!');
    updateVersionInfo();
  } else {
    console.error('❌ Failed to create updated ConnectNow.exe');
  }
});

function updateVersionInfo() {
  console.log('📋 Updating version information...');
  
  const installerInfo = {
    version: '1.0.2',
    buildDate: new Date().toISOString(),
    description: 'AO Intelligence powered by ConnectNow Desktop Application',
    features: [
      'Professional calling interface',
      'WebRTC technology integration', 
      'Lead management system',
      'Video conferencing capabilities',
      'Appointment scheduling',
      'Real-time collaboration tools',
      'Automatic update system',
      'Enhanced Chrome detection'
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
        type: 'Auto-Updating Application',
        description: 'Complete desktop application with auto-update capability and Node.js runtime'
      },
      'ConnectNow-Setup.exe': {
        size: '~37MB',
        type: 'Professional Installer',
        description: 'Automated installer that downloads and configures ConnectNow'
      }
    },
    autoUpdate: {
      enabled: true,
      checkUrl: '/api/version/check',
      forceUpdateSupported: true,
      updateCheckInterval: 'on startup'
    }
  };
  
  fs.writeFileSync('uploads/installers/installer-info.json', JSON.stringify(installerInfo, null, 2));
  
  console.log('🎉 Auto-updating desktop application system complete!');
  console.log('📋 Features:');
  console.log('   - Checks for updates on startup');
  console.log('   - Downloads and installs updates automatically');
  console.log('   - Supports forced updates for critical patches');
  console.log('   - Enhanced Chrome detection and optimization');
  console.log('');
  console.log('🚀 Your agents will now always have the latest version!');
}