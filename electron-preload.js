const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  
  // Update functionality
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  // Update event listeners
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Desktop app identification
  isDesktopApp: true,
  platform: process.platform,

  // Open Windows Firewall settings so agent can allow the app
  openFirewallSettings: () => ipcRenderer.invoke('open-firewall-settings'),
});

// Notify the web app that it's running in desktop mode
window.addEventListener('DOMContentLoaded', () => {
  // Add desktop app class to body for styling
  document.body.classList.add('desktop-app');
  
  // Set desktop app flag
  window.isDesktopApp = true;
  
  console.log('🖥️ AO Intelligence Desktop App loaded');
});