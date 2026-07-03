#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🖥️ Building Real Electron Desktop Application...');

// Step 1: First build the web application
const buildWeb = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true 
});

buildWeb.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Web build failed');
    process.exit(1);
  }
  
  console.log('✅ Web build complete');
  
  // Step 2: Create a custom electron-builder config that bypasses dependency issues
  const electronConfig = {
    "appId": "com.aointelligence.connectnow",
    "productName": "AO Intelligence ConnectNow",
    "copyright": "Copyright © 2025 AO Intelligence",
    "directories": {
      "output": "uploads/installers"
    },
    "files": [
      "electron/main.js",
      "electron/preload.js", 
      "ConnectNow.png"
    ],
    "win": {
      "target": "nsis",
      "icon": "ConnectNow.png"
    },
    "mac": {
      "target": "dmg",
      "icon": "ConnectNow.png"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "ConnectNow.png",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "ConnectNow"
    }
  };
  
  // Write temporary config
  fs.writeFileSync('electron-builder-temp.json', JSON.stringify(electronConfig, null, 2));
  
  // Step 3: Run electron-builder with the temp config
  console.log('🔨 Building Electron executables...');
  
  const electronBuild = spawn('npx', [
    'electron-builder', 
    '--config', 
    'electron-builder-temp.json',
    '--win',
    '--publish=never'
  ], {
    stdio: 'inherit',
    shell: true
  });
  
  electronBuild.on('close', (electronCode) => {
    // Clean up temp config
    try {
      fs.unlinkSync('electron-builder-temp.json');
    } catch (e) {}
    
    if (electronCode !== 0) {
      console.error('❌ Electron build failed');
      console.log('📝 Creating fallback executable...');
      createFallbackExecutable();
    } else {
      console.log('✅ Electron build complete!');
      console.log('📁 Check uploads/installers/ for .exe file');
    }
  });
});

// Fallback function to create a working executable
function createFallbackExecutable() {
  console.log('🔧 Creating Node.js-based executable...');
  
  // Use the desktop launcher we created earlier
  const pkgBuild = spawn('npx', [
    'pkg',
    'desktop-launcher/app.js',
    '--targets',
    'node18-win-x64',
    '--output',
    'uploads/installers/ConnectNow-Setup-1.0.1.exe'
  ], {
    stdio: 'inherit',
    shell: true
  });
  
  pkgBuild.on('close', (pkgCode) => {
    if (pkgCode === 0) {
      console.log('✅ Fallback executable created successfully!');
      console.log('📁 Windows executable ready at uploads/installers/ConnectNow-Setup-1.0.1.exe');
    } else {
      console.error('❌ All build methods failed');
    }
  });
}