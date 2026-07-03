const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  
  // Volume Control
  getSystemVolume: () => ipcRenderer.invoke('get-system-volume'),
  setSystemVolume: (volume) => ipcRenderer.invoke('set-system-volume', volume),
  muteSystem: () => ipcRenderer.invoke('mute-system'),
  unmuteSystem: () => ipcRenderer.invoke('unmute-system'),
  
  // Zoom Control
  getZoomLevel: () => ipcRenderer.invoke('get-zoom-level'),
  setZoomLevel: (level) => ipcRenderer.invoke('set-zoom-level', level),
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  resetZoom: () => ipcRenderer.invoke('reset-zoom'),
  
  // Microphone Permission (macOS - works immediately without rebuild)
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  
  // Open macOS System Settings > Microphone
  openMicrophoneSettings: () => ipcRenderer.invoke('open-microphone-settings'),
  
  // Open Terminal app
  openTerminal: () => ipcRenderer.invoke('open-terminal')
});

// AUTO-CAPTURE API - for mandatory screen sharing
contextBridge.exposeInMainWorld('aoiCapture', {
  // Get available capture sources (screens and windows)
  getSources: (types) => ipcRenderer.invoke('get-capture-sources', types),
  
  // Check if a presentation window is currently open
  isPresentationActive: () => ipcRenderer.invoke('is-presentation-active'),
  
  // Get info about presentation windows
  getPresentationWindows: () => ipcRenderer.invoke('get-presentation-windows'),
  
  // Set user email for presentation tracking
  setUserEmail: (email) => ipcRenderer.invoke('set-user-email', email),
  
  // Windows native recording (ALWAYS works)
  startNativeRecording: (sessionId) => ipcRenderer.invoke('start-native-recording', sessionId),
  stopNativeRecording: () => ipcRenderer.invoke('stop-native-recording'),
  readScreenshotFile: (filepath) => ipcRenderer.invoke('read-screenshot-file', filepath),
  
  // Listen for presentation events
  onPresentationWindowOpened: (callback) => {
    ipcRenderer.on('presentation-window-opened', (event, data) => callback(data));
  },
  
  onPresentationWindowClosed: (callback) => {
    ipcRenderer.on('presentation-window-closed', (event, data) => callback(data));
  },
  
  onPresentationIframeDetected: (callback) => {
    ipcRenderer.on('presentation-iframe-detected', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Check if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

// Prevent context menu (optional - remove if you want right-click)
window.addEventListener('contextmenu', (e) => {
  // e.preventDefault(); // Commented out for debugging
});

// Prevent drag and drop
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
});