const { screen, desktopCapturer, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');

/**
 * Simple Screenshot Capturer
 * Takes screenshots of the desktop every N seconds
 */
class ScreenshotCapture {
  constructor() {
    this.isCapturing = false;
    this.intervalId = null;
    this.sessionId = null;
    this.screenshotCount = 0;
    this.captureInterval = 30000; // 30 seconds
    this.lastScreenshotHash = null; // Track if screen changed
    this.unchangedCount = 0; // Count consecutive unchanged screenshots
    this.maxUnchanged = 3; // Stop after 3 unchanged screenshots (90 seconds idle)
  }

  /**
   * Start capturing screenshots
   */
  async startCapture(sessionId, targetWindow = null) {
    if (this.isCapturing) {
      console.log('⚠️ Already capturing');
      return;
    }

    this.sessionId = sessionId;
    this.screenshotCount = 0;
    this.isCapturing = true;

    // Create output directory
    const outputDir = path.join(process.cwd(), 'recordings', 'screenshots', sessionId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('📸 Starting screenshot capture...');
    console.log('📁 Output:', outputDir);

    // Take first screenshot immediately
    await this.captureScreenshot(outputDir, targetWindow);

    // Then capture every 30 seconds
    this.intervalId = setInterval(async () => {
      if (this.isCapturing) {
        await this.captureScreenshot(outputDir, targetWindow);
      }
    }, this.captureInterval);

    return outputDir;
  }

  /**
   * Capture a single screenshot
   */
  async captureScreenshot(outputDir, targetWindow = null) {
    try {
      // Get all available sources
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });

      let source;
      
      // ONLY capture the HPPRO window - NEVER capture entire screen
      source = sources.find(s => 
        s.name.toLowerCase().includes('hp-pro') || 
        s.name.toLowerCase().includes('hppro') ||
        s.name.toLowerCase().includes('aoi presentation') ||
        s.name.toLowerCase().includes('presentation')
      );
      
      // If HPPRO window not found, log available windows for debugging
      if (!source) {
        console.log('⚠️ HPPRO window not found. Available windows:');
        sources.filter(s => s.id.startsWith('window:')).forEach(s => {
          console.log(`   - ${s.name}`);
        });
        console.log('❌ Skipping screenshot - HPPRO window not detected');
        return null;
      }
      
      console.log(`✅ Capturing HPPRO window: ${source.name}`);

      if (!source || !source.thumbnail) {
        console.error('❌ No screenshot source available');
        return null;
      }

      // Get the thumbnail (screenshot) as PNG
      const screenshot = source.thumbnail.toPNG();
      
      // Create hash of screenshot to detect changes
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(screenshot).digest('hex');
      
      // Skip if screenshot hasn't changed (no activity)
      if (this.lastScreenshotHash === hash) {
        this.unchangedCount++;
        console.log(`⏸️ Screenshot unchanged (${this.unchangedCount}/${this.maxUnchanged}) - skipping upload`);
        
        // Stop capturing after too many unchanged screenshots (idle presentation)
        if (this.unchangedCount >= this.maxUnchanged) {
          console.log(`🛑 No activity for ${this.maxUnchanged * 30} seconds - pausing capture until activity resumes`);
          // Don't fully stop, just skip uploads until screen changes
        }
        return null;
      }
      
      // Screen changed - reset counter and save
      this.unchangedCount = 0;
      this.lastScreenshotHash = hash;
      
      // Save to file
      this.screenshotCount++;
      const filename = `screenshot-${String(this.screenshotCount).padStart(4, '0')}.png`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, screenshot);
      console.log(`📸 Screenshot ${this.screenshotCount}: ${filename} (${(screenshot.length / 1024).toFixed(1)} KB) ✅ CHANGED`);

      // Upload screenshot to server for Live Board
      if (this.sessionId) {
        this.uploadScreenshotToServer(filepath, screenshot).catch(err => {
          console.error('❌ Failed to upload screenshot to server:', err);
        });
      }

      return filepath;
    } catch (error) {
      console.error('❌ Screenshot capture error:', error);
      return null;
    }
  }

  /**
   * Stop capturing
   */
  stopCapture() {
    if (!this.isCapturing) {
      console.log('⚠️ Not capturing');
      return null;
    }

    console.log('⏹️ Stopping screenshot capture...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isCapturing = false;
    const count = this.screenshotCount;
    this.screenshotCount = 0;

    console.log(`✅ Capture stopped - ${count} screenshots taken`);
    
    return {
      sessionId: this.sessionId,
      count: count,
      directory: path.join(process.cwd(), 'recordings', 'screenshots', this.sessionId)
    };
  }

  /**
   * Upload screenshot to server
   */
  async uploadScreenshotToServer(filepath, screenshotBuffer) {
    return new Promise((resolve) => {
      try {
        // Convert buffer to base64 data URL
        const base64 = screenshotBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        
        console.log(`📤 Uploading screenshot ${this.screenshotCount} to server...`);
        console.log(`   Session ID: ${this.sessionId}`);
        console.log(`   Screenshot size: ${(screenshotBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`   Base64 length: ${base64.length} chars`);
        
        // Get server URL from environment or use production
        const serverUrl = process.env.VITE_API_URL || 'https://aoirail-production.up.railway.app';
        
        // Upload to the correct Live Board endpoint
        const url = `${serverUrl}/api/live-call-board/presentations/screenshot`;
        console.log(`🌐 Uploading to: ${url}`);
        
        const payload = JSON.stringify({
          sessionId: this.sessionId,
          screenshotUrl: dataUrl
        });
        
        console.log(`📦 Payload size: ${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(2)} MB`);
        
        // Use Node's https module for HTTP requests
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'X-App-Version': app.getVersion() // Send app version to server
          }
        };
        
        const request = https.request(options, (response) => {
          let data = '';
          
          response.on('data', (chunk) => {
            data += chunk.toString();
          });
          
          response.on('end', () => {
            if (response.statusCode === 200) {
              console.log(`✅ Screenshot ${this.screenshotCount} uploaded successfully!`);
              console.log(`   Response: ${data.substring(0, 200)}`);
              resolve({ success: true });
            } else if (response.statusCode === 426) {
              // UPDATE REQUIRED - Server rejected old version
              console.error(`🚨 UPDATE REQUIRED - Server rejected old app version!`);
              console.error(`   Response: ${data}`);
              
              try {
                const updateInfo = JSON.parse(data);
                const { dialog } = require('electron');
                dialog.showErrorBox(
                  '⚠️ Update Required',
                  `Your app version is outdated.\n\nPlease download the latest version from:\n${updateInfo.downloadUrl || 'GitHub releases'}\n\nThe app will close now.`
                );
                
                // Force quit the app
                const { app } = require('electron');
                app.quit();
              } catch (e) {
                console.error('Failed to parse update info:', e);
              }
              
              resolve({ success: false, error: 'UPDATE_REQUIRED' });
            } else {
              console.error(`❌ Screenshot upload failed!`);
              console.error(`   Status: ${response.statusCode}`);
              console.error(`   Response: ${data}`);
              console.error(`   Session ID used: ${this.sessionId}`);
              resolve({ success: false, error: data });
            }
          });
        });
        
        request.on('error', (error) => {
          console.error(`❌ Network error uploading screenshot:`);
          console.error(`   Error: ${error.message}`);
          console.error(`   Session ID: ${this.sessionId}`);
          console.error(`   URL: ${url}`);
          resolve({ success: false, error: error.message });
        });
        
        request.write(payload);
        request.end();
      } catch (error) {
        console.error(`❌ Exception uploading screenshot:`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Check if capturing
   */
  isActive() {
    return this.isCapturing;
  }
}

module.exports = new ScreenshotCapture();

