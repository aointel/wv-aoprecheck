import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

interface AppVolumeControlProps {
  className?: string;
}

export default function AppVolumeControl({ className = '' }: AppVolumeControlProps) {
  const [volume, setVolume] = useState([30]); // Default 30% (reduced from 75%)
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState([30]);

  // Load volume from localStorage on mount
  useEffect(() => {
    const savedVolume = localStorage.getItem('appVolume');
    const savedMuted = localStorage.getItem('appMuted');
    
    if (savedVolume) {
      const vol = parseInt(savedVolume);
      setVolume([vol]);
      setPreviousVolume([vol]);
    }
    
    if (savedMuted === 'true') {
      setIsMuted(true);
    }
    
    // Apply initial volume to all audio elements  
    applyVolumeToAllAudio(savedVolume ? parseInt(savedVolume) : 30, savedMuted === 'true');
  }, []);

  // Apply volume to ALL audio sources in the entire app (Electron-optimized)
  const applyVolumeToAllAudio = (volumeLevel: number, muted: boolean) => {
    const actualVolume = muted ? 0 : volumeLevel / 100;
    
    console.log(`🎵 MASTER VOLUME: Setting ALL app audio to ${actualVolume * 100}% (muted: ${muted})`);
    
    // 1. Control ALL HTML audio elements (with Electron safety check)
    const audioElements = document.querySelectorAll('audio');
    console.log(`🎵 HTML AUDIO: Found ${audioElements.length} audio elements`);
    audioElements.forEach((audio, index) => {
      try {
        // Electron-safe volume setting
        if (audio.volume !== undefined) {
          audio.volume = actualVolume;
        }
        if (audio.muted !== undefined) {
          audio.muted = muted;
        }
        console.log(`🎵 HTML AUDIO ${index}: Set volume ${actualVolume}, muted ${muted}`);
      } catch (error) {
        console.log(`🎵 HTML AUDIO ${index}: Error setting volume in Electron:`, error);
      }
    });

    // 2. Control ALL video elements (they can have audio)
    const videoElements = document.querySelectorAll('video');
    console.log(`🎵 VIDEO AUDIO: Found ${videoElements.length} video elements`);
    videoElements.forEach((video, index) => {
      video.volume = actualVolume;
      video.muted = muted;
      console.log(`🎵 VIDEO AUDIO ${index}: Set volume ${actualVolume}, muted ${muted}`);
    });

    // 3. Control browser's MediaElementAudioSourceNode volume (Web Audio API) - Electron optimized
    try {
      if (typeof window !== 'undefined' && (window as any).AudioContext) {
        // Check if we're in Electron
        const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        console.log(`🎵 WEB AUDIO API: Running in ${isElectron ? 'Electron' : 'Browser'}`);
        
        const audioContext = (window as any).globalAudioContext || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        
        // In Electron, be more cautious about audio context state
        if (audioContext.state === 'suspended') {
          console.log('🎵 WEB AUDIO API: Context suspended, attempting resume...');
          audioContext.resume().catch((err: any) => console.log('Resume failed:', err));
        }
        
        if (!((window as any).globalAudioContext)) {
          (window as any).globalAudioContext = audioContext;
        }

        // Set master gain for the entire audio context
        if (!((window as any).masterGainNode)) {
          const masterGain = audioContext.createGain();
          masterGain.connect(audioContext.destination);
          (window as any).masterGainNode = masterGain;
        }
        
        const masterGain = (window as any).masterGainNode;
        // Use exponential ramp for smoother volume changes in Electron
        if (isElectron) {
          masterGain.gain.exponentialRampToValueAtTime(Math.max(actualVolume, 0.001), audioContext.currentTime + 0.1);
        } else {
          masterGain.gain.setValueAtTime(actualVolume, audioContext.currentTime);
        }
        console.log(`🎵 WEB AUDIO API: Set master gain to ${actualVolume}`);
      }
    } catch (webAudioError) {
      console.log('🎵 WEB AUDIO API: Not available or error:', webAudioError);
    }

    // Set global volume for Twilio WebRTC calls
    if (typeof window !== 'undefined') {
      try {
        // Try multiple ways to access Twilio device
        const device = (window as any).twilioDevice || (window as any).Device || (window as any).device;
        
        if (device) {
          console.log(`🎵 TWILIO DEVICE: Found device, state: ${device.state}`);
          
          // For Twilio JS SDK, use audio controls
          if (device.audio) {
            // Set speaker volume for ongoing calls
            if (typeof device.audio.speakerDevices?.set === 'function') {
              device.audio.speakerDevices.set('default');
              console.log('🎵 TWILIO VOLUME: Set speaker device to default');
            }
            
            // Set outgoing volume
            if (typeof device.audio.outgoing === 'function') {
              device.audio.outgoing(actualVolume);
              console.log(`🎵 TWILIO VOLUME: Set outgoing volume to ${actualVolume}`);
            }
            
            // Set incoming volume  
            if (typeof device.audio.incoming === 'function') {
              device.audio.incoming(actualVolume);
              console.log(`🎵 TWILIO VOLUME: Set incoming volume to ${actualVolume}`);
            }
            
            // Set master audio volume if available
            if (typeof device.audio.volume === 'function') {
              device.audio.volume(actualVolume);
              console.log(`🎵 TWILIO VOLUME: Set master volume to ${actualVolume}`);
            }
          }
          
          // Also try to control any active connections
          const connections = device.connections || [];
          connections.forEach((conn: any, index: number) => {
            if (conn && conn.volume && typeof conn.volume === 'function') {
              conn.volume(actualVolume);
              console.log(`🎵 TWILIO CONNECTION ${index}: Set volume to ${actualVolume}`);
            }
            
            // Control hold music volume specifically
            if (conn && conn.mute && typeof conn.mute === 'function') {
              if (muted) {
                conn.mute(true);
                console.log(`🎵 TWILIO CONNECTION ${index}: Muted hold music`);
              } else {
                conn.mute(false);
                console.log(`🎵 TWILIO CONNECTION ${index}: Unmuted hold music`);
              }
            }
          });
          
        } else {
          console.log('🎵 TWILIO VOLUME: No Twilio device found');
        }
        
        // Also try to control active WebRTC connection
        const activeConnection = (window as any).twilioConnection;
        if (activeConnection) {
          if (typeof activeConnection.volume === 'function') {
            activeConnection.volume(actualVolume);
            console.log(`🎵 ACTIVE CONNECTION: Set volume to ${actualVolume}`);
          }
          
          // Specifically control hold music/waitUrl audio
          if (typeof activeConnection.mute === 'function') {
            activeConnection.mute(muted);
            console.log(`🎵 ACTIVE CONNECTION: Set mute to ${muted} (hold music control)`);
          }
          
          // Try to control the remote audio (waitUrl music)
          if (activeConnection.remoteStream) {
            const audioTracks = activeConnection.remoteStream.getAudioTracks();
            audioTracks.forEach((track: any, trackIndex: number) => {
              track.enabled = !muted;
              console.log(`🎵 REMOTE AUDIO TRACK ${trackIndex}: Set enabled ${!muted} (waitUrl control)`);
            });
          }
        }
        
      } catch (error) {
        console.log('🎵 TWILIO VOLUME: Error setting Twilio volume:', error);
      }
    }

    // 4. Control MediaStream audio tracks (for getUserMedia, WebRTC streams)
    try {
      // Find all MediaStream tracks
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach((element: any, index) => {
        if (element.srcObject && element.srcObject.getAudioTracks) {
          const audioTracks = element.srcObject.getAudioTracks();
          audioTracks.forEach((track: any, trackIndex: number) => {
            if (track.enabled !== undefined) {
              track.enabled = !muted;
              console.log(`🎵 MEDIA STREAM ${index}-${trackIndex}: Set enabled ${!muted}`);
            }
          });
        }
      });
    } catch (streamError) {
      console.log('🎵 MEDIA STREAMS: Error controlling streams:', streamError);
    }

    // 5. Set global window volume property for other scripts to check
    (window as any).globalAudioVolume = actualVolume;
    (window as any).globalAudioMuted = muted;
    console.log(`🎵 GLOBAL STATE: Set window volume ${actualVolume}, muted ${muted}`);

    // 6. Control any iframe audio (if accessible)
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, index) => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeAudio = iframeDoc.querySelectorAll('audio, video');
            iframeAudio.forEach((media: any) => {
              media.volume = actualVolume;
              media.muted = muted;
            });
            console.log(`🎵 IFRAME ${index}: Controlled ${iframeAudio.length} media elements`);
          }
        } catch (iframeError) {
          // Cross-origin iframes can't be accessed - this is expected
        }
      });
    } catch (iframeGlobalError) {
      console.log('🎵 IFRAME CONTROL: Error accessing iframes:', iframeGlobalError);
    }

    // Set HTML5 audio context volume if available
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        // Don't create new context, just try to get existing ones
        console.log('🎵 VOLUME CONTROL: HTML5 Audio support available');
      }
    } catch (error) {
      console.log('🎵 VOLUME CONTROL: Web Audio not available:', error);
    }
    
    // Also dispatch a custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('volumeChange', { 
      detail: { volume: actualVolume, muted } 
    }));
    
    console.log(`🎵 VOLUME CONTROL: Volume change complete - ${actualVolume * 100}%`);
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume([vol]);
    
    if (vol > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem('appMuted', 'false');
    }
    
    localStorage.setItem('appVolume', vol.toString());
    applyVolumeToAllAudio(vol, isMuted && vol > 0 ? false : isMuted);
  };

  // Toggle mute
  const toggleMute = () => {
    if (isMuted) {
      // Unmute - restore previous volume
      setIsMuted(false);
      setVolume(previousVolume);
      localStorage.setItem('appMuted', 'false');
      applyVolumeToAllAudio(previousVolume[0], false);
    } else {
      // Mute - save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
      localStorage.setItem('appMuted', 'true');
      applyVolumeToAllAudio(volume[0], true);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="app-volume-control">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMute}
        title={isMuted ? "Unmute" : "Mute"}
        data-testid="button-volume-toggle"
        className="p-2 h-8 w-8"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Volume2 className="h-4 w-4 text-foreground" />
        )}
      </Button>
      
      <div className="flex items-center gap-2 min-w-[120px]">
        <Slider
          value={isMuted ? [0] : volume}
          onValueChange={handleVolumeChange}
          max={100}
          step={1}
          className="flex-1"
          data-testid="slider-app-volume"
          disabled={isMuted}
        />
        <span className="text-xs text-muted-foreground w-8 text-right">
          {isMuted ? '0%' : `${volume[0]}%`}
        </span>
      </div>
    </div>
  );
}