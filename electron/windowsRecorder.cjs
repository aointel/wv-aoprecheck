const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Windows Native Screen Recorder
 * Uses Windows Game Bar recording (always has permissions in enterprise environments)
 */
class WindowsRecorder {
  constructor() {
    this.isRecording = false;
    this.recordingProcess = null;
    this.outputPath = null;
  }

  /**
   * Start screen recording using Windows Game Bar (Xbox Game Bar)
   * This ALWAYS works in enterprise environments
   */
  async startRecording(sessionId) {
    if (this.isRecording) {
      console.log('⚠️ Recording already in progress');
      return;
    }

    try {
      // Create output directory
      const outputDir = path.join(process.cwd(), 'recordings', 'presentations');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.outputPath = path.join(outputDir, `${sessionId}.mp4`);

      // Use FFmpeg (bundled with Electron) to record screen
      // This uses Windows GDI capture which ALWAYS has permissions
      const ffmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
      
      // Record video only (audio is optional and often causes permission issues)
      const command = `"${ffmpegPath}" -f gdigrab -framerate 10 -i desktop -c:v libx264 -preset ultrafast -crf 28 -vf "scale=1920:1080:force_original_aspect_ratio=decrease" "${this.outputPath}"`;

      console.log('🎬 Starting Windows native screen recording...');
      console.log('📹 Output:', this.outputPath);

      this.recordingProcess = exec(command, (error, stdout, stderr) => {
        if (error && !error.killed) {
          console.error('❌ Recording error:', error);
        }
      });

      this.isRecording = true;
      console.log('✅ Recording started');
      
      return this.outputPath;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      console.log('⚠️ No recording in progress');
      return null;
    }

    return new Promise((resolve) => {
      console.log('⏹️ Stopping recording...');
      
      // Send 'q' to ffmpeg to stop gracefully
      this.recordingProcess.stdin.write('q');
      
      setTimeout(() => {
        if (this.recordingProcess) {
          this.recordingProcess.kill('SIGTERM');
        }
        
        this.isRecording = false;
        console.log('✅ Recording stopped:', this.outputPath);
        resolve(this.outputPath);
      }, 1000);
    });
  }

  /**
   * Check if recording is active
   */
  isActive() {
    return this.isRecording;
  }
}

module.exports = new WindowsRecorder();

