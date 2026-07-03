#!/usr/bin/env node

const { spawn } = require('child_process');
const waitOn = require('wait-on');

console.log('🚀 Starting ConnectNow in development mode...');

// Start the web server
console.log('🌐 Starting web server...');
const webServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Wait for server to be ready, then start Electron
waitOn({
  resources: ['http://localhost:5000'],
  delay: 1000,
  timeout: 30000
}).then(() => {
  console.log('🖥️ Starting Electron...');
  const electron = spawn('npx', ['electron', 'electron/main.js'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  electron.on('close', () => {
    console.log('👋 Electron closed, stopping web server...');
    webServer.kill();
    process.exit(0);
  });
}).catch((err) => {
  console.error('❌ Failed to start:', err);
  webServer.kill();
  process.exit(1);
});