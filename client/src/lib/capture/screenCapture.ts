// Electron Screen Capture
// Captures screen or window in Electron desktop app

interface ScreenCaptureOptions {
  fps?: number;
  width?: number;
  height?: number;
  withSystemAudio?: boolean;
  preferWindow?: boolean; // Try to capture specific window instead of full screen
}

export async function startScreenCapture(opts?: ScreenCaptureOptions): Promise<MediaStream> {
  const { 
    fps = 30, 
    width = 1920, 
    height = 1080, 
    withSystemAudio = true,
    preferWindow = false 
  } = opts || {};
  
  console.log('📹 Starting screen capture with browser API (Windows compatible)');

  try {
    // Use browser's native getDisplayMedia API (always works on Windows)
    const videoStream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: {
        width: { ideal: width, max: width },
        height: { ideal: height, max: height },
        frameRate: { ideal: fps, max: fps }
      },
      audio: false // We'll add audio separately
    });

    console.log('✅ Video capture started:', videoStream.getVideoTracks()[0]?.getSettings());

    // Try to add system audio if requested
    if (withSystemAudio) {
      try {
        const audioStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: false,
          audio: true
        });
        
        // Combine video and audio tracks
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          videoStream.addTrack(audioTrack);
          console.log('✅ System audio capture started');
        }
      } catch (audioError) {
        console.warn('⚠️ Could not capture system audio (optional):', audioError);
      }
    }

    console.log('✅ Screen capture complete:', {
      video: videoStream.getVideoTracks().length > 0,
      audio: videoStream.getAudioTracks().length > 0,
      videoSettings: videoStream.getVideoTracks()[0]?.getSettings()
    });

    return videoStream;
  } catch (error) {
    console.error('❌ Screen capture failed:', error);
    throw new Error('Screen capture permission denied or not supported');
  }
}

export function stopScreenCapture(stream: MediaStream): void {
  console.log('⏹️ Stopping screen capture...');
  stream.getTracks().forEach(track => {
    track.stop();
    console.log(`Stopped ${track.kind} track`);
  });
}

export async function getAvailableSources(types: Array<'screen' | 'window'> = ['screen', 'window']) {
  if (!window.aoiCapture) {
    throw new Error('Screen capture is only available in the desktop app');
  }
  
  return await window.aoiCapture.getSources(types);
}

