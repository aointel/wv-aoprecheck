#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔨 Building ConnectNow Desktop Application...');

// Step 1: Build the web application first
console.log('📦 Building web application...');

const buildProcess = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true 
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Web build failed');
    process.exit(1);
  }
  
  console.log('✅ Web build complete');
  
  // Step 2: Build Electron applications
  console.log('🖥️ Building Electron applications...');
  
  const electronBuild = spawn('npx', ['electron-builder', '--win', '--mac', '--publish=never'], {
    stdio: 'inherit',
    shell: true
  });
  
  electronBuild.on('close', (electronCode) => {
    if (electronCode !== 0) {
      console.error('❌ Electron build failed');
      process.exit(1);
    }
    
    console.log('✅ Electron build complete!');
    console.log('📁 Check dist-electron/ for installers');
    console.log('🎉 Desktop applications ready for distribution!');
  });
});