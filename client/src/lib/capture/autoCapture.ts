// Automatic Screen Capture - No opt-in, mandatory monitoring
// Detects when producer is presenting and auto-starts capture

import { startScreenCapture } from './screenCapture';

interface AutoCaptureConfig {
  onCaptureStart?: (stream: MediaStream) => void;
  onCaptureStop?: () => void;
  onError?: (error: Error) => void;
}

export class AutoCaptureManager {
  private isCapturing: boolean = false;
  private currentStream: MediaStream | null = null;
  private config: AutoCaptureConfig;
  private iframeObserver: MutationObserver | null = null;
  private captureCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: AutoCaptureConfig = {}) {
    this.config = config;
  }

  /**
   * Start monitoring for presentation iframes
   * Automatically starts capture when iframe is detected
   */
  startMonitoring() {
    console.log('📹 Auto-capture monitoring started');

    // Check for existing iframes
    this.checkForPresentationIframes();

    // Watch for new iframes being added
    this.iframeObserver = new MutationObserver(() => {
      this.checkForPresentationIframes();
    });

    this.iframeObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Periodic check every 5 seconds
    this.captureCheckInterval = setInterval(() => {
      this.checkForPresentationIframes();
    }, 5000);

    // Also monitor for presentation routes (if using client-side routing)
    this.monitorRouteChanges();
  }

  private checkForPresentationIframes() {
    // Look for iframes that might contain presentations
    const iframes = document.querySelectorAll('iframe');
    const hasPresentationIframe = Array.from(iframes).some((iframe) => {
      const src = iframe.src || '';
      // Add your presentation vendor domains here
      return (
        src.includes('present') ||
        src.includes('deck') ||
        src.includes('slide') ||
        src.includes('zoom') ||
        iframe.id.includes('presentation') ||
        iframe.className.includes('presentation')
      );
    });

    if (hasPresentationIframe && !this.isCapturing) {
      console.log('🎯 Presentation iframe detected - starting auto-capture');
      this.startCapture();
    } else if (!hasPresentationIframe && this.isCapturing) {
      console.log('❌ No presentation iframe - stopping capture');
      this.stopCapture();
    }
  }

  private monitorRouteChanges() {
    // Monitor URL changes for presentation routes
    let lastUrl = window.location.href;

    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        
        // Check if we're on a presentation page
        if (this.isPresentationRoute(currentUrl)) {
          console.log('🎯 Presentation route detected:', currentUrl);
          setTimeout(() => this.checkForPresentationIframes(), 1000);
        } else if (this.isCapturing) {
          this.stopCapture();
        }
      }
    };

    // Check on navigation events
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('pushstate', checkUrlChange);
    window.addEventListener('replacestate', checkUrlChange);

    // Override history methods to detect client-side routing
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      checkUrlChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      checkUrlChange();
    };
  }

  private isPresentationRoute(url: string): boolean {
    // Add your presentation route patterns
    return (
      url.includes('/presentation') ||
      url.includes('/deck') ||
      url.includes('/present') ||
      url.includes('/call') // If presentations happen during calls
    );
  }

  private async startCapture() {
    if (this.isCapturing) {
      return; // Already capturing
    }

    try {
      console.log('🔴 Starting automatic screen capture...');
      
      // Start screen capture
      this.currentStream = await startScreenCapture({
        fps: 30,
        width: 1920,
        height: 1080,
        withSystemAudio: true,
      });

      this.isCapturing = true;

      // Notify parent component
      if (this.config.onCaptureStart) {
        this.config.onCaptureStart(this.currentStream);
      }

      console.log('✅ Auto-capture started successfully');
    } catch (error) {
      console.error('❌ Failed to start auto-capture:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }

  private stopCapture() {
    if (!this.isCapturing || !this.currentStream) {
      return;
    }

    console.log('⏹️ Stopping automatic screen capture...');

    // Stop all tracks
    this.currentStream.getTracks().forEach((track) => track.stop());
    this.currentStream = null;
    this.isCapturing = false;

    // Notify parent component
    if (this.config.onCaptureStop) {
      this.config.onCaptureStop();
    }

    console.log('✅ Auto-capture stopped');
  }

  stopMonitoring() {
    console.log('🛑 Auto-capture monitoring stopped');

    if (this.iframeObserver) {
      this.iframeObserver.disconnect();
      this.iframeObserver = null;
    }

    if (this.captureCheckInterval) {
      clearInterval(this.captureCheckInterval);
      this.captureCheckInterval = null;
    }

    this.stopCapture();
  }

  getCaptureStatus(): {
    isCapturing: boolean;
    hasStream: boolean;
  } {
    return {
      isCapturing: this.isCapturing,
      hasStream: this.currentStream !== null,
    };
  }

  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Force start capture (for testing or manual override)
   */
  async forceStartCapture() {
    await this.startCapture();
  }

  /**
   * Force stop capture
   */
  forceStopCapture() {
    this.stopCapture();
  }
}

// Singleton instance for global use
let autoCaptureManager: AutoCaptureManager | null = null;

export function getAutoCaptureManager(config?: AutoCaptureConfig): AutoCaptureManager {
  if (!autoCaptureManager) {
    autoCaptureManager = new AutoCaptureManager(config);
  }
  return autoCaptureManager;
}


