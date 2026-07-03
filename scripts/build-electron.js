#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🔨 Building ConnectNow Electron App...');

// Step 1: Build the web application
console.log('📦 Building web application...');
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
  
  // Step 2: Build Electron app
  console.log('🖥️ Building Electron application...');
  const buildElectron = spawn('npx', ['electron-builder', '--config', 'electron-builder.json'], {
    stdio: 'inherit',
    shell: true
  });
  
  buildElectron.on('close', (electronCode) => {
    if (electronCode !== 0) {
      console.error('❌ Electron build failed');
      process.exit(1);
    }
    
    console.log('✅ Electron build complete!');
    console.log('📁 Check dist-electron/ for installers');
  });
});