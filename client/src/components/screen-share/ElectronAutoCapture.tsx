import { useEffect, useState, useRef } from 'react';
import { startScreenCapture } from '@/lib/capture/screenCapture';
import { useAuth } from '@/hooks/use-auth';

interface ElectronAutoCaptureProps {
  onCaptureStart?: (stream: MediaStream) => void;
  onCaptureStop?: () => void;
  enabled?: boolean;
}

/**
 * ElectronAutoCapture - Automatically captures screen when presentation detected
 * This component ONLY works in the Electron app
 * Updated: Debugging session creation
 */
export function ElectronAutoCapture({
  onCaptureStart,
  onCaptureStop,
  enabled = true
}: ElectronAutoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string>('Waiting for presentation...');
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { authState } = useAuth();

  // Send user email to Electron EVERY TIME auth state changes
  useEffect(() => {
    if (!window.isElectron || !window.aoiCapture || !enabled) {
      return;
    }

    const sendEmailToElectron = async () => {
      // Try multiple sources for email (in order of reliability)
      let userEmail = authState.user?.email;
      
      // Check localStorage authState
      if (!userEmail) {
        try {
          const storedAuth = localStorage.getItem('authState');
          if (storedAuth) {
            const parsed = JSON.parse(storedAuth);
            userEmail = parsed.user?.email;
            console.log('📧 Found email in localStorage authState:', userEmail);
          }
        } catch (e) {
          console.error('Failed to parse localStorage authState');
        }
      }

      // Check Supabase auth
      if (!userEmail) {
        try {
          const supabaseAuth = localStorage.getItem('sb-vhkrnsjlowrxzujwpgks-auth-token');
          if (supabaseAuth) {
            const parsed = JSON.parse(supabaseAuth);
            userEmail = parsed.user?.email;
            console.log('📧 Found email in Supabase token:', userEmail);
          }
        } catch (e) {
          console.error('Failed to parse Supabase auth token');
        }
      }

      // ERROR: If we still don't have an email, something is wrong
      if (!userEmail) {
        console.error('❌ NO USER EMAIL FOUND - Cannot track presentation!');
        console.error('Auth state:', authState);
        return; // Don't start recording without knowing who the user is
      }

      await window.aoiCapture.setUserEmail(userEmail);
      console.log('✅ Sent REAL user email to Electron main process:', userEmail);
    };

    sendEmailToElectron();
  }, [authState?.user?.email, enabled]); // 🔥 Re-send email whenever auth changes

  useEffect(() => {
    // Only run in Electron
    if (!window.isElectron || !window.aoiCapture) return;
    if (!enabled) return;

    // Listen for presentation window opened - Start Windows native recording
    window.aoiCapture.onPresentationWindowOpened(async (data) => {
      console.log('🎯 PRESENTATION WINDOW OPENED:', data);
      setCaptureStatus('Presentation detected - starting native recording...');
      
      // Start backend session first
      try {
        const sessionId = await startPresentationSession(
          data.url, 
          data.isHppro, 
          data.userEmail
        );
        
        if (sessionId) {
          // Notify Live Board that presentation started
          try {
            await fetch('/api/live-call-board/presentations/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                agentEmail: data.userEmail || authState.user?.email,
                agentName: authState.profile?.firstName && authState.profile?.lastName 
                  ? `${authState.profile.firstName} ${authState.profile.lastName}`
                  : data.userEmail?.split('@')[0] || 'Unknown',
                presentationType: data.isHppro ? 'hppro' : 'other',
                presentationUrl: data.url
              })
            });
            console.log('📊 Live Board: Notified of presentation start');
          } catch (error) {
            console.error('❌ Failed to notify Live Board:', error);
          }

          // Start Windows native recording (bypasses Chrome permissions)
          console.log('🎬 Starting Windows native recording for session:', sessionId);
          const result = await window.aoiCapture.startNativeRecording(sessionId);
          
          if (result.success) {
            sessionIdRef.current = sessionId;
            setCaptureStatus('Recording active ✅');
            console.log('✅ Native recording started:', result.outputPath);
            
            // Screenshots are being captured automatically by Electron every 30 seconds
            console.log('📸 Screenshot capture running in background...');
          } else {
            console.error('❌ Failed to start native recording:', result.error);
            setCaptureStatus('Recording failed ❌');
          }
        }
      } catch (error) {
        console.error('❌ Error starting presentation:', error);
        setCaptureStatus('Failed to start ❌');
      }
    });

    // Listen for presentation window closed
    window.aoiCapture.onPresentationWindowClosed(async (data) => {
      console.log('❌ PRESENTATION WINDOW CLOSED:', data);
      setCaptureStatus('Presentation ended - uploading recording...');
      
      // Stop screenshot capture
      if (window.aoiCapture.stopNativeRecording) {
        const result = await window.aoiCapture.stopNativeRecording();
        if (result.success) {
          console.log(`✅ Screenshot capture stopped: ${result.count} screenshots in ${result.directory}`);
          // NOTE: Screenshots are already uploaded via 30-second interval, no need to bulk upload
        }
      }
      
      // End session in backend
      if (sessionIdRef.current) {
        await endPresentationSession();
        
        // Notify Live Board that presentation ended
        try {
          await fetch('/api/live-call-board/presentations/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current
            })
          });
          console.log('📊 Live Board: Notified of presentation end');
        } catch (error) {
          console.error('❌ Failed to notify Live Board:', error);
        }
      }
      
      // Clear screenshot interval
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
      
      sessionIdRef.current = null;
      setCaptureStatus('Recording uploaded ✅');
    });

    // Listen for presentation iframe detected
    window.aoiCapture.onPresentationIframeDetected((data) => {
      console.log('🎯 PRESENTATION IFRAME DETECTED:', data);
      setCaptureStatus('Presentation iframe detected - starting capture...');
      startCapture('screen', data); // Use screen capture for iframes
    });

    // Check if presentation is already active on mount
    window.aoiCapture.isPresentationActive().then((isActive) => {
      if (isActive) {
        console.log('🎯 Presentation already active on mount');
        startCapture('window');
      }
    });

    // Cleanup listeners on unmount
    return () => {
      console.log('🧹 Cleaning up ElectronAutoCapture');
      window.aoiCapture?.removeListener('presentation-window-opened');
      window.aoiCapture?.removeListener('presentation-window-closed');
      window.aoiCapture?.removeListener('presentation-iframe-detected');
      stopCapture();
    };
  }, [enabled]);

  // Helper function to capture screenshot from stream
  // Capture screenshot from video stream
  const captureScreenshot = async (): Promise<string | null> => {
    if (!streamRef.current || !videoRef.current || !canvasRef.current) {
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return null;

      // Set canvas size to match video
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG
      const screenshot = canvas.toDataURL('image/jpeg', 0.8);
      return screenshot;
    } catch (error) {
      console.error('❌ Error capturing screenshot:', error);
      return null;
    }
  };

  // Start video recording
  const startVideoRecording = (stream: MediaStream) => {
    try {
      // Use webm format with VP9 codec for better compression
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('📹 Video chunk recorded:', (event.data.size / 1024 / 1024).toFixed(2), 'MB');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎬 Recording stopped, uploading video...');
        await uploadVideo();
      };

      // Record in chunks every 10 seconds for reliability
      mediaRecorder.start(10000);
      console.log('🔴 Video recording started');
    } catch (error) {
      console.error('❌ Error starting video recording:', error);
    }
  };

  // Upload all screenshots from a directory
  const uploadScreenshots = async (directory: string, count: number) => {
    if (!sessionIdRef.current) {
      console.log('⚠️ No session ID');
      return;
    }

    try {
      console.log(`📤 Uploading ${count} screenshots from:`, directory);

      // Upload each screenshot
      for (let i = 1; i <= count; i++) {
        const filename = `screenshot-${String(i).padStart(4, '0')}.png`;
        const filepath = `${directory}\\${filename}`;
        
        try {
          // Use Electron IPC to read file (bypasses security restrictions)
          const result = await window.aoiCapture.readScreenshotFile(filepath);
          
          if (!result.success || !result.data) {
            console.error(`❌ Failed to read screenshot ${i}:`, result.error);
            continue;
          }
          
          // Send to backend for REAL-TIME AI analysis
          const uploadResponse = await fetch('/api/presentations/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionIdRef.current,
              screenshot_data: result.data
            })
          });

          if (uploadResponse.ok) {
            console.log(`✅ Screenshot ${i}/${count} uploaded and analyzed`);
          } else {
            console.error(`❌ Failed to upload screenshot ${i}:`, uploadResponse.statusText);
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err) {
          console.error(`❌ Error uploading screenshot ${i}:`, err);
        }
      }
      
      console.log(`✅ All ${count} screenshots uploaded and queued for AI analysis`);
    } catch (error) {
      console.error('❌ Error uploading screenshots:', error);
    }
  };

  // Upload recorded video to backend (legacy browser method)
  const uploadVideo = async () => {
    if (recordedChunksRef.current.length === 0 || !sessionIdRef.current) {
      console.log('⚠️ No recording data to upload');
      return;
    }

    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log('📤 Uploading video:', sizeMB, 'MB');

      const formData = new FormData();
      formData.append('video', blob, `presentation-${sessionIdRef.current}.webm`);
      formData.append('sessionId', sessionIdRef.current);

      const response = await fetch('/api/presentations/upload-video', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Video uploaded successfully:', data.videoUrl);
      } else {
        console.error('❌ Failed to upload video:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error uploading video:', error);
    }
  };

  // Start presentation session in backend
  const startPresentationSession = async (url: string, isHppro: boolean, userEmailFromEvent?: string) => {
    console.log('🔍 AUTH STATE:', {
      hasUser: !!authState.user,
      email: authState.user?.email,
      emailFromEvent: userEmailFromEvent,
      profile: authState.profile
    });

    // Priority: 1) Email from Electron event, 2) authState, 3) localStorage
    let userEmail = userEmailFromEvent || authState.user?.email;
    
    if (!userEmail) {
      try {
        const storedAuth = localStorage.getItem('authState');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          userEmail = parsed.user?.email;
          console.log('📧 Retrieved email from localStorage:', userEmail);
        }
      } catch (e) {
        console.error('❌ Failed to parse stored auth:', e);
      }
    }

    if (!userEmail) {
      console.error('❌ No user email - cannot start session (checked event, authState, and localStorage)');
      return null;
    }

    console.log('✅ Using email:', userEmail);

    try {
      console.log('🎬 Starting presentation session for:', userEmail);
      
      // Get Producer Name from profile or just use email
      const agentName = authState.profile 
        ? `${authState.profile.firstName || ''} ${authState.profile.lastName || ''}`.trim() || userEmail
        : userEmail;

      const requestBody = {
        agent_email: userEmail,
        agent_name: agentName,
        presentation_url: url,
        presentation_type: isHppro ? 'hppro' : 'other',
        window_title: 'HPPRO Presentation'
      };

      console.log('📤 Sending request:', requestBody);

      const response = await fetch('/api/presentations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error starting session:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('✅ Session started:', data.sessionId);
      return data.sessionId;
    } catch (error) {
      console.error('❌ Failed to start presentation session:', error);
      return null;
    }
  };

  // Send screenshot to backend
  const sendScreenshot = async (screenshot: string) => {
    if (!sessionIdRef.current) return;

    try {
      await fetch('/api/presentations/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          screenshot_data: screenshot
        })
      });
      console.log('📸 Screenshot sent to backend');
    } catch (error) {
      console.error('❌ Failed to send screenshot:', error);
    }
  };

  const startCapture = async (type: 'screen' | 'window', presentationData?: any) => {
    if (isCapturing) {
      console.log('⚠️ Already capturing');
      return;
    }

    try {
      console.log(`🔴 Starting ${type} capture...`);
      setCaptureStatus(`Starting ${type} capture...`);

      const stream = await startScreenCapture({
        fps: 30,
        width: 1920,
        height: 1080,
        withSystemAudio: true,
        preferWindow: type === 'window'
      });

      streamRef.current = stream;
      
      // Create hidden video element to play stream (needed for screenshots)
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        videoRef.current = video;
      }
      
      // Create hidden canvas for screenshot capture
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
        canvasRef.current = canvas;
      }
      
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Start presentation session in backend
      const sessionId = await startPresentationSession(
        presentationData?.url || 'unknown',
        presentationData?.isHppro || false,
        presentationData?.userEmail // Pass user email from Electron event
      );
      
      sessionIdRef.current = sessionId;
      setIsCapturing(true);
      setCaptureStatus('🔴 LIVE - Recording presentation');

      console.log('✅ Capture started successfully - Session ID:', sessionId);

      // Start video recording (full presentation capture)
      startVideoRecording(stream);

      // Start screenshot interval (every 30 seconds for AI analysis)
      screenshotIntervalRef.current = setInterval(async () => {
        const screenshot = await captureScreenshot();
        if (screenshot && sessionIdRef.current) {
          await sendScreenshot(screenshot);
        }
      }, 30000); // 30 seconds

      // Take first screenshot immediately
      setTimeout(async () => {
        const screenshot = await captureScreenshot();
        if (screenshot && sessionIdRef.current) {
          await sendScreenshot(screenshot);
        }
      }, 2000);

      // Notify parent component
      if (onCaptureStart) {
        onCaptureStart(stream);
      }
    } catch (error) {
      console.error('❌ Failed to start capture:', error);
      setCaptureStatus(`Error: ${error instanceof Error ? error.message : 'Failed to start capture'}`);
      setIsCapturing(false);
    }
  };

  const stopCapture = async () => {
    if (!isCapturing || !streamRef.current) {
      return;
    }

    console.log('⏹️ Stopping capture...');
    setCaptureStatus('Stopping capture...');

    // Stop screenshot interval
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
      screenshotIntervalRef.current = null;
    }

    // Stop video recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('⏹️ Stopped video recording');
    }

    // End presentation session in backend
    if (sessionIdRef.current) {
      try {
        await fetch('/api/presentations/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionIdRef.current
          })
        });
        console.log('✅ Presentation session ended:', sessionIdRef.current);
      } catch (error) {
        console.error('❌ Failed to end session:', error);
      }
      sessionIdRef.current = null;
    }

    // Stop all tracks
    streamRef.current.getTracks().forEach((track) => {
      track.stop();
      console.log(`Stopped track: ${track.kind}`);
    });

    // Cleanup video and canvas elements
    if (videoRef.current && videoRef.current.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
      videoRef.current = null;
    }
    if (canvasRef.current && canvasRef.current.parentNode) {
      canvasRef.current.parentNode.removeChild(canvasRef.current);
      canvasRef.current = null;
    }

    streamRef.current = null;
    setIsCapturing(false);
    setCaptureStatus('Capture stopped');

    // Notify parent component
    if (onCaptureStop) {
      onCaptureStop();
    }
  };

  // Don't render anything - capture happens silently in background
  return null;
}

