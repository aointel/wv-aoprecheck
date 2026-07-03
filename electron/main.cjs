const { app, BrowserWindow, shell, Menu, dialog, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const screenshotCapture = require('./screenshotCapture.cjs');
const isDev = process.env.NODE_ENV === 'development';

// Track presentation windows and auto-capture state
let presentationWindows = new Set();
let mainWindow = null;
let currentUserEmail = null; // Store the logged-in user's email
let currentSessionId = null; // Track active presentation session
let lastServerVersion = null; // Track server version for auto-reload
let versionCheckInterval = null; // Store interval ID for cleanup

// Configure auto-updater for GitHub releases (cross-platform)
// Disable auto-updates until releases are published
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

console.log('🔄 Auto-updater configured for platform:', process.platform);
console.log('📦 Current app version:', app.getVersion());
console.log('ℹ️  Auto-updates disabled until GitHub releases are published');

// Check for updates on startup (only in production with releases)
if (!isDev && process.env.ENABLE_AUTO_UPDATE === 'true') {
  setTimeout(() => {
    console.log('🔍 Running initial update check...');
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);

  // Check for updates every 10 minutes
  setInterval(() => {
    console.log('🔍 Running periodic update check...');
    autoUpdater.checkForUpdatesAndNotify();
  }, 10 * 60 * 1000);
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('🚨 MANDATORY UPDATE AVAILABLE - Version:', info.version);
  
  // FORCE the update - no "Later" option
  dialog.showMessageBox({
    type: 'warning',
    title: '⚠️ Update Required',
    message: `A critical update is available (v${info.version}). The app will download and install it now.`,
    detail: 'This update includes important bug fixes and improvements. The app will restart after the update.',
    buttons: ['Download Now']
  }).then(() => {
    // Automatically download - no choice
    autoUpdater.downloadUpdate();
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('✅ App is up to date. Current version:', info.version);
});

autoUpdater.on('error', (err) => {
  console.log('❌ Error in auto-updater:');
  console.log('   Message:', err.message);
  console.log('   Stack:', err.stack);
  
  // Don't show error to user for 404 (no releases yet)
  if (!err.message.includes('404')) {
    dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded - FORCING RESTART');
  
  // FORCE restart - no "Later" option
  dialog.showMessageBox({
    type: 'info',
    title: '✅ Update Ready',
    message: 'Update installed successfully. The app will restart now.',
    buttons: ['Restart Now']
  }).then(() => {
    // Force quit and install immediately
    setImmediate(() => autoUpdater.quitAndInstall());
  });
});

/**
 * Start checking server version periodically and reload if it changes
 * This ensures the Electron app always has the latest web code when master changes
 */
function startVersionChecking(serverUrl) {
  console.log('🔄 Starting server version checking for auto-reload...');
  
  // Initial check after 5 seconds (give server time to load)
  setTimeout(() => {
    checkServerVersion(serverUrl, true);
  }, 5000);
  
  // Then check every 60 seconds
  versionCheckInterval = setInterval(() => {
    checkServerVersion(serverUrl, false);
  }, 60000); // Check every 60 seconds
}

/**
 * Check server version and reload if it changed
 */
async function checkServerVersion(serverUrl, isInitial = false) {
  try {
    const { net } = require('electron');
    const url = new URL('/api/version', serverUrl);
    
    const request = net.request({
      method: 'GET',
      url: url.toString()
    });
    
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        try {
          const versionInfo = JSON.parse(data);
          const currentVersion = versionInfo.version || versionInfo.buildTime || versionInfo.timestamp;
          
          if (isInitial) {
            // Store initial version
            lastServerVersion = currentVersion;
            console.log('✅ Server version check initialized:', currentVersion);
          } else if (lastServerVersion && currentVersion !== lastServerVersion) {
            // Version changed - force reload!
            console.log('🚨 SERVER VERSION CHANGED!');
            console.log('   Old version:', lastServerVersion);
            console.log('   New version:', currentVersion);
            console.log('   🔄 Force reloading web contents...');
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              // Force reload the web contents
              mainWindow.webContents.reload();
              
              // Update stored version
              lastServerVersion = currentVersion;
              
              console.log('✅ Web contents reloaded with new version');
            }
          } else {
            // Same version, just log for debugging (occasionally)
            if (Math.random() < 0.1) { // Log 10% of checks to reduce noise
              console.log('✅ Server version unchanged:', currentVersion);
            }
          }
        } catch (parseError) {
          console.error('❌ Failed to parse version response:', parseError);
        }
      });
    });
    
    request.on('error', (error) => {
      // Don't log errors for initial check (server might still be loading)
      if (!isInitial) {
        console.error('❌ Version check request failed:', error.message);
      }
    });
    
    request.end();
  } catch (error) {
    console.error('❌ Error checking server version:', error);
  }
}

function shouldOpenExternally(url) {
  // ONLY these patterns open externally - everything else stays in Electron
  const externalPatterns = [
    /^https?:\/\/(www\.)?google\.com\/(?!meet)/i, // Google but not Meet
    /^https?:\/\/(www\.)?(facebook|twitter|linkedin|instagram)\.com/i,
    /^https?:\/\/(www\.)?youtube\.com\/watch/i, // YouTube videos
    /^mailto:/i,
    /^tel:/i,
    // Add other external-only domains here
  ];
  
  return externalPatterns.some(pattern => pattern.test(url));
}

/**
 * Clear all renderer caches on every launch to prevent stale bundle issues
 * This ensures users always get the latest code, especially after deployments
 * CRITICAL: Also clears cache on navigation to force fresh loads
 */
async function nukeRendererCachesEveryLaunch() {
  try {
    const ses = session.defaultSession;
    // Only clear service workers - preserve HTTP cache/localStorage/cookies for performance
    await ses.clearStorageData({ storages: ['serviceworkers'] });
    console.log('Service workers cleared');
  } catch (error) {
    console.error('Error clearing renderer caches:', error);
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
      nativeWindowOpen: true // Enable window.open handling
    },
    icon: path.join(__dirname, '../ConnectNow.png'),
    title: 'AO Intelligence powered by ConnectNow',
    titleBarStyle: 'default',
    show: false // Don't show until ready
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // CRITICAL: Handle permission requests from web content (getUserMedia, etc.)
  // This checks system permissions FIRST before granting web permissions
  // 🍎 MAC ELECTRON: This is CRITICAL for microphone access on Mac
  mainWindow.webContents.session.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    console.log('🔐 Permission requested from web content:', permission, details);
    
    // For media permissions, check system-level permission first (macOS)
    if (permission === 'media' || permission === 'microphone' || permission === 'camera') {
      if (process.platform === 'darwin') {
        try {
          const { systemPreferences } = require('electron');
          const micStatus = systemPreferences.getMediaAccessStatus('microphone');
          console.log('🎤 System microphone permission status:', micStatus);
          
          // If not granted, request it NOW
          if (micStatus !== 'granted') {
            console.log('📢 Requesting system microphone permission NOW...');
            const granted = await systemPreferences.askForMediaAccess('microphone');
            console.log('🎤 System permission result:', granted);
            
            if (!granted) {
              console.error('❌ System microphone permission denied - cannot grant web permission');
              callback(false);
              return;
            }
          }
          
          // 🍎 MAC ELECTRON: ALWAYS grant web content permission if system permission is granted
          console.log('✅ System microphone permission granted - granting web content permission');
          callback(true);
          return;
        } catch (error) {
          console.error('❌ Error checking system permissions:', error);
          // Even on error, try to grant permission (might work)
          console.log('⚠️ Granting web content permission despite error (may work)');
          callback(true);
          return;
        }
      }
      
      // For non-Mac platforms, always grant
      console.log('✅ Granting web content media permission:', permission);
      callback(true);
    } else {
      // Deny other permissions by default
      console.log('❌ Denying permission:', permission);
      callback(false);
    }
  });
  
  // Handle permission check results (for permission queries)
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('🔍 Permission check:', permission, requestingOrigin);
    
    // Check system permission status for media
    if (permission === 'media' || permission === 'microphone' || permission === 'camera') {
      if (process.platform === 'darwin') {
        try {
          const { systemPreferences } = require('electron');
          const micStatus = systemPreferences.getMediaAccessStatus('microphone');
          const hasPermission = micStatus === 'granted';
          console.log('🔍 System microphone permission check:', micStatus, '->', hasPermission);
          return hasPermission;
        } catch (error) {
          console.error('❌ Error checking system permission:', error);
          return false;
        }
      }
      return true;
    }
    
    return false;
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Reset zoom to 100% on startup (fixes users being too zoomed in)
    mainWindow.webContents.setZoomLevel(0);
    
    // Focus on window
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Add x-desktop-app header to all requests (for browser login blocking)
  // CRITICAL: Also add cache-busting headers to prevent stale content
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Only inject x-desktop-app for our own server — NOT for third-party domains (Twilio, Supabase, etc.)
    // Injecting custom headers into Twilio WSS handshakes can cause WebSocket connection failures.
    const isOurServer = details.url.includes('aoirail-production.up.railway.app') || details.url.includes('localhost');
    if (isOurServer) {
      details.requestHeaders['x-desktop-app'] = 'true';
      // Assets use normal browser caching for performance
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Load app URL (configurable for local Electron testing).
  // Default remains production unless ELECTRON_SERVER_URL is set.
  const serverUrl = process.env.ELECTRON_SERVER_URL || 'https://aoirail-production.up.railway.app';
  mainWindow.loadURL(serverUrl);
  
  // Start version checking for auto-reload on master changes
  startVersionChecking(serverUrl);

  // Handle window.open() - FORCE ALL POPUPS TO OPEN IN ELECTRON (for capture)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('🔔 Window open requested:', url);
    
    // Check if this should open externally (rare cases)
    if (shouldOpenExternally(url)) {
      console.log('⬅️ Opening externally (explicitly allowed):', url);
      shell.openExternal(url);
      return { action: 'deny' };
    }
    
    // EVERYTHING ELSE opens inside Electron for automatic capture
    console.log('✅ Opening internally (FORCE CAPTURE):', url);
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 800,
        title: 'AOI Presentation', // Consistent title for capture detection
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.cjs'),
          nativeWindowOpen: true,
          webSecurity: true
        }
      }
    };
  });

  // Track presentation windows (HPPRO and other presentations)
  app.on('browser-window-created', (event, window) => {
    // Wait a bit for the window to load and get its URL
    setTimeout(() => {
      const title = window.getTitle();
      const url = window.webContents.getURL();
      
      console.log('🔍 NEW WINDOW CREATED:');
      console.log('   Title:', title);
      console.log('   URL:', url);
      
      // Check if it's HPPRO or other presentation tool
      const isPresentation = 
        title.includes('Presentation') || 
        title.includes('Present') ||
        title.includes('AOI Presentation') ||
        url.includes('hppro.planetaltig.com') ||
        url.includes('present') ||
        url.includes('deck') ||
        url.includes('slide');
      
      console.log('   Is Presentation?', isPresentation);
      
      if (isPresentation) {
        console.log('🎯 PRESENTATION WINDOW DETECTED!');
        console.log('   Title:', title);
        console.log('   URL:', url);
        presentationWindows.add(window);
        
        // AUTO-START SCREENSHOT CAPTURE (don't wait for frontend!)
        console.log('🔍 CHECKING AUTO-START CONDITIONS:');
        console.log('   currentSessionId:', currentSessionId);
        console.log('   currentUserEmail:', currentUserEmail);
        console.log('   !currentSessionId:', !currentSessionId);
        console.log('   Has user email:', !!currentUserEmail);
        
        if (!currentSessionId && currentUserEmail) {
          console.log('✅ CONDITIONS MET - STARTING AUTO-CAPTURE');
          
          // Start presentation session via API FIRST to get the real session ID
          const { net } = require('electron');
          const serverUrl = 'https://aoirail-production.up.railway.app';
          
          const startSessionPayload = JSON.stringify({
            agent_email: currentUserEmail,
            agent_name: currentUserEmail.split('@')[0],
            presentation_url: url,
            presentation_type: url.includes('hppro') ? 'hppro' : 'other',
            window_title: title,
            app_version: app.getVersion(),
            platform: process.platform,
            os_version: `${process.platform} ${process.arch}`
          });
          
          const startRequest = net.request({
            method: 'POST',
            url: `${serverUrl}/api/presentations/start`
          });
          
          startRequest.setHeader('Content-Type', 'application/json');
          startRequest.setHeader('X-App-Version', app.getVersion());
          startRequest.setHeader('user-email', currentUserEmail);
          startRequest.on('response', (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk.toString(); });
            response.on('end', () => {
              // Handle 426 Upgrade Required - Force user to download new version
              if (response.statusCode === 426) {
                console.error('❌ APP VERSION TOO OLD - UPDATE REQUIRED');
                try {
                  const error = JSON.parse(data);
                  console.error('   Server message:', error.message);
                  console.error('   Your version:', error.yourVersion);
                  console.error('   Required version:', error.minimumVersion);
                  console.error('   Download URL:', error.downloadUrl);
                  
                  // Show dialog to user
                  dialog.showMessageBox({
                    type: 'error',
                    title: 'Update Required',
                    message: 'Your app version is outdated',
                    detail: `${error.message}\n\nThe app will now open the download page. Please download and install the latest version.`,
                    buttons: ['Open Download Page', 'Quit']
                  }).then((result) => {
                    if (result.response === 0) {
                      // Open download page
                      shell.openExternal(error.downloadUrl);
                    }
                    // Quit the app
                    app.quit();
                  });
                } catch (e) {
                  console.error('Failed to parse error response:', e);
                  dialog.showErrorBox('Update Required', 'Your app version is outdated. Please download the latest version from the website.');
                  app.quit();
                }
                return;
              }
              
              if (response.statusCode === 200) {
                try {
                  const result = JSON.parse(data);
                  const apiSessionId = result.sessionId;
                  
                  console.log('✅ Got session ID from API:', apiSessionId);
                  currentSessionId = apiSessionId; // Set the global session ID
                  console.log('✅ Backend session created:', apiSessionId);
                  console.log('   Full response:', result);
                  
                  // Wait 2 seconds to ensure database insert completes
                  console.log('⏳ Waiting 2 seconds for database to sync...');
                  setTimeout(() => {
                    // Now start screenshot capture - PASS THE WINDOW!
                    console.log('🚀 Starting screenshot capture with session ID:', apiSessionId);
                    screenshotCapture.startCapture(apiSessionId, window).then(outputPath => {
                      currentSessionId = apiSessionId;
                      console.log('✅ Screenshot capture started automatically');
                      console.log('   Output path:', outputPath);
                      console.log('   Session ID stored:', currentSessionId);
                    }).catch(err => {
                      console.error('❌ Failed to start screenshot capture:', err);
                    });
                    
                    // START PAGE SCRAPING
                    console.log('🔍 Starting page scraping with session ID:', apiSessionId);
                    
                    // Function to start scraping (used immediately or after load)
                    const initScraper = () => {
                      console.log('✅ HP Pro page loaded - injecting scraper');
                      
                      // Function to scrape and send data
                      const scrapeAndSend = async () => {
                        try {
                          const scrapedData = await window.webContents.executeJavaScript(`
                            (function() {
                              const data = {
                                url: window.location.href,
                                title: document.title,
                                textContent: document.body.innerText.substring(0, 5000), // Limit to 5KB
                                htmlContent: document.body.innerHTML.substring(0, 10000), // Limit to 10KB
                                forms: Array.from(document.querySelectorAll('form')).map(form => ({
                                  id: form.id,
                                  action: form.action,
                                  method: form.method,
                                  fields: Array.from(form.elements).map(el => ({
                                    name: el.name,
                                    type: el.type,
                                    value: el.type === 'password' ? '[REDACTED]' : el.value?.substring(0, 100)
                                  }))
                                })),
                                links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
                                  text: a.innerText.substring(0, 100),
                                  href: a.href
                                })),
                                images: Array.from(document.querySelectorAll('img')).slice(0, 20).map(img => ({
                                  alt: img.alt,
                                  src: img.src
                                })),
                                headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                                  tag: h.tagName,
                                  text: h.innerText
                                })),
                                timestamp: new Date().toISOString()
                              };
                              return data;
                            })();
                          `);
                          
                          // Send to server
                          const { net } = require('electron');
                          const scrapeRequest = net.request({
                            method: 'POST',
                            url: serverUrl + '/api/presentations/scrape-data'
                          });
                          
                          scrapeRequest.setHeader('Content-Type', 'application/json');
                          
                          scrapeRequest.on('response', (response) => {
                            let responseData = '';
                            response.on('data', (chunk) => { responseData += chunk.toString(); });
                            response.on('end', () => {
                              if (response.statusCode === 200) {
                                console.log('✅ Scraped data sent to server');
                              } else {
                                console.error('❌ Failed to send scraped data:', response.statusCode, responseData);
                              }
                            });
                          });
                          
                          scrapeRequest.on('error', (error) => {
                            console.error('❌ Error sending scraped data:', error.message);
                          });
                          
                          const payload = JSON.stringify({
                            sessionId: currentSessionId, // Use the global currentSessionId that was set from API
                            scrapedData: scrapedData,
                            timestamp: new Date().toISOString()
                          });
                          
                          scrapeRequest.write(payload);
                          scrapeRequest.end();
                          
                        } catch (error) {
                          console.error('❌ Error scraping page:', error.message);
                        }
                      };
                      
                      // Scrape immediately
                      scrapeAndSend();
                      
                      // Then scrape every 10 seconds
                      const scrapeInterval = setInterval(() => {
                        if (window && !window.isDestroyed()) {
                          scrapeAndSend();
                        } else {
                          clearInterval(scrapeInterval);
                          console.log('🛑 Page scraping stopped - window destroyed');
                        }
                      }, 10000);
                      
                      // Clean up interval when window closes
                      window.on('closed', () => {
                        clearInterval(scrapeInterval);
                        console.log('🛑 Page scraping stopped - window closed');
                      });
                    };
                    
                    // Check if page is already loaded, or wait for load event
                    if (window.webContents.isLoading()) {
                      console.log('⏳ Page still loading - waiting for did-finish-load event');
                      window.webContents.once('did-finish-load', initScraper);
                    } else {
                      console.log('✅ Page already loaded - starting scraper immediately');
                      // Add a small delay to ensure DOM is fully ready
                      setTimeout(initScraper, 1000);
                    }
                  }, 2000);
                } catch (parseError) {
                  console.error('❌ Failed to parse server response:', parseError);
                  console.error('   Response data:', data);
                }
              } else if (response.statusCode === 426) {
                // UPDATE REQUIRED - Server rejected old version
                console.error('🚨 SERVER REJECTED OLD APP VERSION!');
                console.error('   Response:', data);
                
                try {
                  const updateInfo = JSON.parse(data);
                  dialog.showErrorBox(
                    '⚠️ Critical Update Required',
                    `Your app version is outdated and no longer supported by the server.\n\nRequired: ${updateInfo.minimumVersion}\nYour version: ${app.getVersion()}\n\nPlease download the latest version from:\n${updateInfo.downloadUrl}\n\nThe app will close now.`
                  );
                  app.quit();
                } catch (e) {
                  console.error('Failed to parse update info:', e);
                }
              } else {
                console.error('❌ Failed to create backend session');
                console.error('   Status:', response.statusCode);
                console.error('   Response:', data);
              }
            });
          });
          
          startRequest.on('error', (error) => {
            console.error('❌ Error creating backend session:', error.message);
          });
          
          startRequest.write(startSessionPayload);
          startRequest.end();
        } else {
          console.log('❌ CONDITIONS NOT MET - AUTO-CAPTURE BLOCKED');
          if (currentSessionId) {
            console.log('   ⚠️ Reason: Session already active:', currentSessionId);
            console.log('   💡 Fix: Session may be stuck. Close and restart app to clear it.');
          }
          if (!currentUserEmail) {
            console.log('   ⚠️ Reason: No user email set');
            console.log('   💡 Fix: Make sure you are logged in BEFORE opening HPPRO');
            console.log('   💡 Check: ElectronAutoCapture component should log "✅ Sent REAL user email to Electron"');
          }
        }
        
        // Notify renderer that presentation started (for AUTO-CAPTURE)
        if (mainWindow) {
          console.log('📤 Sending presentation-window-opened event to main window');
          mainWindow.webContents.send('presentation-window-opened', {
            windowId: window.id,
            title: window.getTitle(),
            url: url,
            isHppro: url.includes('hppro'),
            userEmail: currentUserEmail // Pass the stored user email
          });
          console.log('✅ Event sent successfully (user:', currentUserEmail, ')');
        } else {
          console.log('❌ No mainWindow to send event to!');
        }
        
        window.on('closed', () => {
          console.log('❌ Presentation window closed');
          presentationWindows.delete(window);
          
          // AUTO-STOP SCREENSHOT CAPTURE
          if (currentSessionId) {
            console.log('🛑 AUTO-STOPPING screenshot capture for session:', currentSessionId);
            screenshotCapture.stopCapture();
            
            // End presentation session via API
            const { net } = require('electron');
            const serverUrl = 'https://aoirail-production.up.railway.app';
            
            const endRequest = net.request({
              method: 'POST',
              url: `${serverUrl}/api/presentations/end`
            });
            
            endRequest.setHeader('Content-Type', 'application/json');
            endRequest.on('response', (response) => {
              if (response.statusCode === 200) {
                console.log('✅ Backend session ended:', currentSessionId);
              } else {
                console.error('❌ Failed to end backend session:', response.statusCode);
              }
            });
            
            endRequest.on('error', (error) => {
              console.error('❌ Error ending backend session:', error.message);
            });
            
            endRequest.write(JSON.stringify({ session_id: currentSessionId }));
            endRequest.end();
            
            currentSessionId = null;
          }
          
          // Notify renderer that presentation ended (STOP CAPTURE)
          if (mainWindow) {
            mainWindow.webContents.send('presentation-window-closed', {
              windowId: window.id
            });
          }
        });
      }
    }, 500); // Wait 500ms for window to load
  });

  // Allow most navigation in main window (for app functionality)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    let configuredOrigin = '';
    try {
      configuredOrigin = new URL(serverUrl).origin;
    } catch (_) {
      configuredOrigin = '';
    }
    const allowedOrigins = new Set([
      'http://localhost:5000',
      'http://localhost:5001',
      'https://aoirail-production.up.railway.app',
      configuredOrigin,
    ]);
    
    // Only block if it's explicitly external
    if (!allowedOrigins.has(parsedUrl.origin)) {
      if (shouldOpenExternally(navigationUrl)) {
        console.log('⬅️ Blocking navigation, opening externally:', navigationUrl);
        event.preventDefault();
        shell.openExternal(navigationUrl);
      } else {
        // Allow all other navigation within Electron
        console.log('✅ Allowing internal navigation:', navigationUrl);
      }
    }
  });

  // Monitor iframe creation in the main window
  mainWindow.webContents.on('did-frame-navigate', (event, url, httpResponseCode, httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
    if (!isMainFrame) {
      // This is an iframe
      console.log('🔍 Iframe detected:', url);
      
      // Check if it's a presentation iframe
      if (url.includes('present') || url.includes('deck') || url.includes('slide') || url.includes('zoom')) {
        console.log('🎯 PRESENTATION IFRAME DETECTED - Auto-capture should start');
        mainWindow.webContents.send('presentation-iframe-detected', { url });
      }
    }
  });
}

// Request microphone and camera permissions on macOS
async function requestMediaPermissions() {
  if (process.platform === 'darwin') {
    try {
      const { systemPreferences } = require('electron');
      
      // Check microphone permission status
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      console.log('🎤 Microphone permission status:', micStatus);
      
      if (micStatus !== 'granted') {
        console.log('📢 Requesting microphone permission...');
        const micGranted = await systemPreferences.askForMediaAccess('microphone');
        console.log('🎤 Microphone permission granted:', micGranted);
        
        if (!micGranted) {
          console.warn('⚠️ Microphone permission denied - audio features may not work');
        }
      } else {
        console.log('✅ Microphone permission already granted');
      }
      
      // Check camera permission status
      const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
      console.log('📷 Camera permission status:', cameraStatus);
      
      if (cameraStatus !== 'granted') {
        console.log('📢 Requesting camera permission...');
        const cameraGranted = await systemPreferences.askForMediaAccess('camera');
        console.log('📷 Camera permission granted:', cameraGranted);
        
        if (!cameraGranted) {
          console.warn('⚠️ Camera permission denied - video features may not work');
        }
      } else {
        console.log('✅ Camera permission already granted');
      }
    } catch (error) {
      console.error('❌ Error requesting media permissions:', error);
    }
  }
}

// IPC handler to request permissions on-demand (works immediately without rebuild)
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      const { systemPreferences } = require('electron');
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      
      if (micStatus === 'granted') {
        return { success: true, alreadyGranted: true, message: 'Microphone permission already granted' };
      }
      
      console.log('📢 Requesting microphone permission via IPC...');
      const micGranted = await systemPreferences.askForMediaAccess('microphone');
      console.log('🎤 Microphone permission result:', micGranted);
      
      return { 
        success: micGranted, 
        granted: micGranted,
        message: micGranted ? 'Microphone permission granted' : 'Microphone permission denied'
      };
    } catch (error) {
      console.error('❌ Error requesting microphone permission:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Not macOS' };
});

// App event handlers
app.whenReady().then(async () => {
  // Clear all renderer caches FIRST to prevent stale bundle issues
  await nukeRendererCachesEveryLaunch();
  
  // Request media permissions BEFORE creating window (required on macOS)
  await requestMediaPermissions();
  
  createWindow();
  
  // Check for updates after app is ready (only in production)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000);
  }
});

app.on('window-all-closed', () => {
  // Clean up version checking interval
  if (versionCheckInterval) {
    clearInterval(versionCheckInterval);
    versionCheckInterval = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up version checking interval before quitting
  if (versionCheckInterval) {
    clearInterval(versionCheckInterval);
    versionCheckInterval = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});

// Open macOS System Settings to Microphone permissions
ipcMain.handle('open-microphone-settings', async (event) => {
  if (process.platform === 'darwin') {
    try {
      // Open System Settings > Privacy & Security > Microphone
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to open microphone settings:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Not macOS' };
});

// Open Terminal app
ipcMain.handle('open-terminal', async (event) => {
  if (process.platform === 'darwin') {
    try {
      // Open Terminal app
      shell.openExternal('terminal://');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to open Terminal:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Not macOS' };
});


ipcMain.handle('get-version', async (event) => {
  return app.getVersion();
});

ipcMain.handle('check-updates', async (event) => {
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Get available capture sources (screens and windows)
ipcMain.handle('get-capture-sources', async (event, types) => {
  const { desktopCapturer } = require('electron');
  const sources = await desktopCapturer.getSources({ 
    types: types || ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 }
  });
  
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

// Check if presentation is active
ipcMain.handle('is-presentation-active', async (event) => {
  return presentationWindows.size > 0;
});

// Get presentation window info
ipcMain.handle('get-presentation-windows', async (event) => {
  return Array.from(presentationWindows).map(win => ({
    id: win.id,
    title: win.getTitle(),
    bounds: win.getBounds()
  }));
});

// Store user email for presentation tracking
ipcMain.handle('set-user-email', async (event, email) => {
  console.log('📧 SET-USER-EMAIL CALLED');
  console.log('   Previous email:', currentUserEmail);
  console.log('   New email:', email);
  currentUserEmail = email;
  console.log('   ✅ Stored user email for presentation tracking:', email);
  return true;
});

// Start screenshot capture
ipcMain.handle('start-native-recording', async (event, sessionId) => {
  try {
    currentSessionId = sessionId;
    const outputPath = await screenshotCapture.startCapture(sessionId);
    console.log('✅ Screenshot capture started for session:', sessionId);
    return { success: true, outputPath };
  } catch (error) {
    console.error('❌ Failed to start screenshot capture:', error);
    return { success: false, error: error.message };
  }
});

// Stop screenshot capture
ipcMain.handle('stop-native-recording', async (event) => {
  try {
    const result = screenshotCapture.stopCapture();
    console.log('✅ Screenshot capture stopped:', result);
    currentSessionId = null;
    return { success: true, ...result };
  } catch (error) {
    console.error('❌ Failed to stop screenshot capture:', error);
    return { success: false, error: error.message };
  }
});

// Read screenshot file as base64
ipcMain.handle('read-screenshot-file', async (event, filepath) => {
  try {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filepath);
    const base64 = fileBuffer.toString('base64');
    const mimeType = 'image/png';
    return { success: true, data: `data:${mimeType};base64,${base64}` };
  } catch (error) {
    console.error('❌ Failed to read screenshot file:', error);
    return { success: false, error: error.message };
  }
});

// Volume Control Functions
ipcMain.handle('get-system-volume', async (event) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    if (process.platform === 'win32') {
      // Windows: Get volume using PowerShell
      const { stdout } = await execAsync('powershell -Command "[audio]::Volume * 100"');
      const volume = Math.round(parseFloat(stdout.trim()));
      return { success: true, volume: Math.max(0, Math.min(100, volume)) };
    } else if (process.platform === 'darwin') {
      // macOS: Get volume using osascript
      const { stdout } = await execAsync('osascript -e "output volume of (get volume settings)"');
      const volume = parseInt(stdout.trim());
      return { success: true, volume: Math.max(0, Math.min(100, volume)) };
    } else {
      // Linux: Use amixer or pactl
      try {
        const { stdout } = await execAsync('amixer sget Master | grep -o "[0-9]*%" | head -1 | sed "s/%//"');
        const volume = parseInt(stdout.trim());
        return { success: true, volume: Math.max(0, Math.min(100, volume)) };
      } catch {
        return { success: false, error: 'Volume control not supported on this Linux system' };
      }
    }
  } catch (error) {
    console.error('❌ Failed to get system volume:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-system-volume', async (event, volume) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Ensure volume is between 0 and 100
    const clampedVolume = Math.max(0, Math.min(100, volume));
    
    if (process.platform === 'win32') {
      // Windows: Set volume using PowerShell
      await execAsync(`powershell -Command "[audio]::Volume = ${clampedVolume / 100}"`);
      return { success: true, volume: clampedVolume };
    } else if (process.platform === 'darwin') {
      // macOS: Set volume using osascript
      await execAsync(`osascript -e "set volume output volume ${clampedVolume}"`);
      return { success: true, volume: clampedVolume };
    } else {
      // Linux: Use amixer
      try {
        await execAsync(`amixer sset Master ${clampedVolume}%`);
        return { success: true, volume: clampedVolume };
      } catch {
        return { success: false, error: 'Volume control not supported on this Linux system' };
      }
    }
  } catch (error) {
    console.error('❌ Failed to set system volume:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mute-system', async (event) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    if (process.platform === 'win32') {
      // Windows: Mute using PowerShell
      await execAsync('powershell -Command "[audio]::Mute = $true"');
    } else if (process.platform === 'darwin') {
      // macOS: Mute using osascript
      await execAsync('osascript -e "set volume with output muted"');
    } else {
      // Linux: Mute using amixer
      await execAsync('amixer sset Master mute');
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to mute system:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unmute-system', async (event) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    if (process.platform === 'win32') {
      // Windows: Unmute using PowerShell
      await execAsync('powershell -Command "[audio]::Mute = $false"');
    } else if (process.platform === 'darwin') {
      // macOS: Unmute using osascript
      await execAsync('osascript -e "set volume without output muted"');
    } else {
      // Linux: Unmute using amixer
      await execAsync('amixer sset Master unmute');
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to unmute system:', error);
    return { success: false, error: error.message };
  }
});

// Zoom Control Functions
ipcMain.handle('get-zoom-level', async (event) => {
  try {
    if (mainWindow) {
      const zoomLevel = mainWindow.webContents.getZoomLevel();
      // Convert zoom level to percentage (0 = 100%, 1 = 110%, -1 = 90%, etc.)
      const zoomPercent = Math.round((Math.pow(1.2, zoomLevel)) * 100);
      return { success: true, zoom: zoomPercent };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('❌ Failed to get zoom level:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-zoom-level', async (event, zoomPercent) => {
  try {
    if (mainWindow) {
      // Clamp zoom between 25% and 500%
      const clampedZoom = Math.max(25, Math.min(500, zoomPercent));
      // Convert percentage to zoom level (100% = 0, 110% = 1, 90% = -1, etc.)
      const zoomLevel = Math.log(clampedZoom / 100) / Math.log(1.2);
      mainWindow.webContents.setZoomLevel(zoomLevel);
      return { success: true, zoom: clampedZoom };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('❌ Failed to set zoom level:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('zoom-in', async (event) => {
  try {
    if (mainWindow) {
      const currentLevel = mainWindow.webContents.getZoomLevel();
      const newLevel = Math.min(currentLevel + 0.5, Math.log(5) / Math.log(1.2)); // Max 500%
      mainWindow.webContents.setZoomLevel(newLevel);
      const zoomPercent = Math.round((Math.pow(1.2, newLevel)) * 100);
      return { success: true, zoom: zoomPercent };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('❌ Failed to zoom in:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('zoom-out', async (event) => {
  try {
    if (mainWindow) {
      const currentLevel = mainWindow.webContents.getZoomLevel();
      const newLevel = Math.max(currentLevel - 0.5, Math.log(0.25) / Math.log(1.2)); // Min 25%
      mainWindow.webContents.setZoomLevel(newLevel);
      const zoomPercent = Math.round((Math.pow(1.2, newLevel)) * 100);
      return { success: true, zoom: zoomPercent };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('❌ Failed to zoom out:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reset-zoom', async (event) => {
  try {
    if (mainWindow) {
      mainWindow.webContents.setZoomLevel(0); // 0 = 100%
      return { success: true, zoom: 100 };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('❌ Failed to reset zoom:', error);
    return { success: false, error: error.message };
  }
});

// FORCE ALL POPUPS INTO ELECTRON - Global handler for all web contents
app.on('web-contents-created', (event, contents) => {
  // console.log('🌐 New web contents created'); // Commented out to prevent EPIPE error
  
  // Set window open handler for ALL web contents (including iframes, child windows, etc.)
  contents.setWindowOpenHandler(({ url }) => {
    // console.log('🔔 Popup requested:', url); // Commented out to prevent EPIPE error
    
    // Only open externally if explicitly on the external list
    if (shouldOpenExternally(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    
    // FORCE EVERYTHING ELSE INTO ELECTRON
    // console.log('✅ FORCING INTO ELECTRON:', url); // Commented out to prevent EPIPE error
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 800,
        title: 'AOI Presentation', // Consistent title for auto-capture
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.cjs'),
          nativeWindowOpen: true,
          webSecurity: true
        }
      }
    };
  });

  // Allow navigation unless explicitly external
  contents.on('will-navigate', (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle new-window event (legacy support)
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    
    if (shouldOpenExternally(url)) {
      shell.openExternal(url);
    } else {
      // Force into Electron window
      const newWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'AOI Presentation',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.cjs'),
          nativeWindowOpen: true,
          webSecurity: true
        }
      });
      newWindow.loadURL(url);
    }
  });
});