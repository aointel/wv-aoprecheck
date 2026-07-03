import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, Phone, Calendar, Share, Monitor, PhoneOff, Layout } from 'lucide-react';

// Twilio Video Room component with real remote tracks
function VideoRoom({ roomName, identity, canJoin, isproducer = false, clientView = false, producerView = false }: { roomName: string; identity: string; canJoin: boolean; isproducer?: boolean; clientView?: boolean; producerView?: boolean }) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<number>(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Media control functions
  const toggleMic = async () => {
    if (roomRef.current) {
      roomRef.current.localParticipant.audioTracks.forEach((pub: any) => {
        if (micMuted) {
          pub.track.enable();
        } else {
          pub.track.disable();
        }
      });
      setMicMuted(!micMuted);
    }
  };

  const toggleVideo = async () => {
    if (roomRef.current) {
      roomRef.current.localParticipant.videoTracks.forEach((pub: any) => {
        if (videoMuted) {
          pub.track.enable();
        } else {
          pub.track.disable();
        }
      });
      setVideoMuted(!videoMuted);
    }
  };

  const startScreenShare = async () => {
    try {
      if (!roomRef.current) {
        console.error('❌ No room available for screen sharing');
        alert('Video room not ready. Please try again.');
        return;
      }

      if (isSharing) {
        console.log('🛑 Screen sharing already active');
        return;
      }

      console.log('🖥️ Starting screen share...');
      
      // Request screen capture with high quality
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: true
      });

      console.log('📱 Screen stream obtained:', screenStream.getVideoTracks().length, 'video tracks');

      // Import Twilio Video to create proper track
      const Video = (await import('twilio-video')).default;
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      
      if (screenVideoTrack) {
        console.log('🔄 Creating Twilio LocalVideoTrack from screen...');
        
        // Unpublish existing camera track first
        const existingVideoPublication = Array.from(roomRef.current.localParticipant.videoTracks.values())[0];
        if (existingVideoPublication) {
          await roomRef.current.localParticipant.unpublishTrack(existingVideoPublication.track);
          console.log('📹 Unpublished camera track for screen share');
        }
        
        const twilioScreenTrack = new Video.LocalVideoTrack(screenVideoTrack);
        
        try {
          // Publish the screen share track
          await roomRef.current.localParticipant.publishTrack(twilioScreenTrack, {
            name: 'screen-share',
            priority: 'high'
          });
          console.log('✅ Screen share published successfully');
          setIsSharing(true);
          
          // Listen for when user stops sharing
          screenVideoTrack.onended = async () => {
            console.log('📱 Screen share ended by user');
            setIsSharing(false);
            
            // Unpublish the screen track
            await roomRef.current?.localParticipant.unpublishTrack(twilioScreenTrack);
            
            // Re-enable camera
            try {
              const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
              const cameraTrack = cameraStream.getVideoTracks()[0];
              const twilioCameraTrack = new Video.LocalVideoTrack(cameraTrack);
              await roomRef.current?.localParticipant.publishTrack(twilioCameraTrack);
              console.log('📹 Camera re-enabled after screen share');
            } catch (cameraError) {
              console.error('❌ Failed to re-enable camera:', cameraError);
            }
          };
        } catch (publishError) {
          console.error('❌ Failed to publish screen track:', publishError);
          alert('Failed to start screen sharing. Please try again.');
        }
      } else {
        console.error('❌ No screen video track found');
        alert('No screen video available. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Screen share failed:', error);
      if (error.name === 'NotAllowedError') {
        console.log('🚫 User denied screen share permission');
        alert('Screen sharing permission denied. Please allow screen sharing and try again.');
      } else if (error.name === 'NotReadableError') {
        alert('Screen sharing not available. Please close other apps using screen capture and try again.');
      } else {
        alert('Screen sharing failed. Please try again.');
      }
    }
  };

  const disconnectRoom = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      // Navigate back to dashboard
      window.location.href = '/dashboard';
    }
  };

  useEffect(() => {
    // Listen for screen share trigger from producerView
    const handleScreenShareTrigger = () => {
      startScreenShare();
    };
    
    window.addEventListener('trigger-screen-share', handleScreenShareTrigger);
    
    return () => {
      window.removeEventListener('trigger-screen-share', handleScreenShareTrigger);
    };
  }, []);

  useEffect(() => {
    if (!canJoin) return;
    
    const connectToRoom = async () => {
      try {
        console.log(`🎥 Connecting to Twilio Video room: ${roomName} as ${identity}`);
        
        // 1) Get Twilio token first
        const res = await fetch('/api/video/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, roomName })
        });
        
        if (!res.ok) {
          console.error('❌ Failed to get Twilio token');
          return;
        }
        
        const { token } = await res.json();
        console.log(`✅ Got Twilio token for room: ${roomName}`);

        // 2) Import Twilio Video dynamically
        const Video = (await import('twilio-video')).default;
        
        // 3) Connect to room with media
        const room = await Video.connect(token, {
          audio: true,
          video: true,
          name: roomName
        });
        
        roomRef.current = room;
        setConnected(true);
        setMediaReady(true);
        
        console.log(`🔌 CONNECTED`, { 
          myIdentity: room.localParticipant.identity, 
          roomName: room.name, 
          roomSid: room.sid 
        });

        // 4) Attach local tracks with proper attributes
        room.localParticipant.videoTracks.forEach(pub => {
          if (pub.track && localVideoRef.current) {
            const videoElement = pub.track.attach() as HTMLVideoElement;
            videoElement.playsInline = true;
            videoElement.muted = true; // Local video should be muted
            // Ensure local video fills its container
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            videoElement.style.transform = 'scaleX(-1)'; // Mirror local video
            localVideoRef.current.appendChild(videoElement);
          }
        });
        room.localParticipant.audioTracks.forEach(pub => {
          if (pub.track && localVideoRef.current) {
            const audioElement = pub.track.attach();
            audioElement.muted = true; // Local audio should be muted
            localVideoRef.current.appendChild(audioElement);
          }
        });

        // 5) Wire up remote participants with enhanced track attachment
        const attachParticipant = (participant: any) => {
          console.log(`🎥 REMOTE participant connected:`, participant.identity);
          
          setRemoteParticipants(prev => [...prev, participant]);
          setParticipants(prev => prev + 1);
          
          // Attach all existing tracks immediately with proper attributes
          participant.tracks.forEach((pub: any) => {
            console.log(`🎵 Existing track:`, pub.trackName, 'subscribed:', pub.isSubscribed);
            if (pub.isSubscribed && pub.track && remoteVideoRef.current) {
              console.log(`✅ Attaching existing ${pub.track.kind} track`);
              const element = pub.track.attach();
              if (element.tagName === 'VIDEO') {
                element.playsInline = true;
                element.autoplay = true;
                // Force full viewport coverage
                element.style.width = '100%';
                element.style.height = '100%';
                element.style.objectFit = 'cover';
                element.style.position = 'absolute';
                element.style.top = '0';
                element.style.left = '0';
              }
              remoteVideoRef.current.appendChild(element);
            }
          });
          
          // Listen for newly subscribed tracks with proper attributes
          participant.on('trackSubscribed', (track: any) => {
            console.log(`🎵 NEW track subscribed:`, track.kind, track.name);
            if (remoteVideoRef.current) {
              console.log(`✅ Attaching new ${track.kind} track`);
              const element = track.attach();
              if (element.tagName === 'VIDEO') {
                element.playsInline = true;
                element.autoplay = true;
                // Force full viewport coverage
                element.style.width = '100%';
                element.style.height = '100%';
                element.style.objectFit = 'cover';
                element.style.position = 'absolute';
                element.style.top = '0';
                element.style.left = '0';
              }
              remoteVideoRef.current.appendChild(element);
            }
          });
          
          // Handle track unsubscription 
          participant.on('trackUnsubscribed', (track: any) => {
            console.log(`🔇 Track unsubscribed:`, track.kind, track.name);
            track.detach().forEach((el: any) => el.remove());
          });
        };

        // Attach existing participants in the room
        room.participants.forEach(attachParticipant);
        
        // Listen for new participants joining
        room.on('participantConnected', attachParticipant);
        
        // Handle participant disconnect
        room.on('participantDisconnected', (participant: any) => {
          console.log(`❌ Participant disconnected:`, participant.identity);
          setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
          setParticipants(prev => prev - 1);
          
          participant.tracks.forEach((pub: any) => {
            if (pub.track) {
              pub.track.detach().forEach((el: any) => el.remove());
            }
          });
        });
        
        setParticipants(room.participants.size + 1); // +1 for local

      } catch (error) {
        console.error('❌ Failed to connect to video room:', error);
      }
    };

    connectToRoom();

    return () => {
      // Cleanup room connection
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      
      // Clear DOM containers
      if (localVideoRef.current) {
        localVideoRef.current.replaceChildren();
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.replaceChildren();
      }
    };
  }, [canJoin, identity, roomName]);

  // Mobile-first layout logic
  const isSingleParticipant = participants <= 1;
  const hasRemoteParticipant = remoteParticipants.length > 0;

  if (clientView) {
    // CLIENT VIEW: Full-screen producer video only, minimal controls
    return (
      <div className="h-full w-full relative bg-black">
        {/* Full-screen remote (producer) video */}
        <div className="absolute inset-0 bg-black" style={{ width: '100vw', height: '100vh' }}>
          <div 
            ref={remoteVideoRef} 
            className="w-full h-full" 
            style={{ 
              width: '100vw', 
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0
            }} 
          />
          {!hasRemoteParticipant && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <div className="text-xl font-semibold mb-2">Waiting for producer...</div>
                <p className="text-sm text-gray-300">You'll see your producer here once they join</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Hidden local video (still connects but not shown to client) */}
        <div ref={localVideoRef} className="hidden" />
        
        {/* Client controls - mic, camera, and leave */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-4 py-3">
            <Button
              onClick={toggleMic}
              size="sm"
              className={`rounded-full w-12 h-12 p-0 ${micMuted ? 'bg-red-600/90 hover:bg-red-700' : 'bg-green-600/80 hover:bg-green-700'}`}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            
            <Button
              onClick={toggleVideo}
              size="sm"
              className={`rounded-full w-12 h-12 p-0 ${videoMuted ? 'bg-red-600/90 hover:bg-red-700' : 'bg-blue-600/80 hover:bg-blue-700'}`}
            >
              {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>

            <Button
              onClick={disconnectRoom}
              size="sm"
              className="rounded-full w-12 h-12 p-0 bg-red-600/90 hover:bg-red-700"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (producerView) {
    // Producer View: Full-screen client video with small producer PiP
    return (
      <div className="h-full w-full relative bg-black">
        {/* Full-screen remote (client) video */}
        <div className="absolute inset-0 bg-black" style={{ width: '100vw', height: '100vh' }}>
          <div 
            ref={remoteVideoRef} 
            className="w-full h-full" 
            style={{ 
              width: '100vw', 
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0
            }} 
          />
          {!hasRemoteParticipant && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <div className="text-xl font-semibold mb-2">Waiting for client...</div>
                <p className="text-sm text-gray-300">You'll see your client here once they join</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Small producer PiP (top right corner) */}
        <div className="absolute top-4 right-4 w-40 h-30 bg-gray-800 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
          <div
            ref={localVideoRef}
            className="w-full h-full"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-1 left-1 text-white text-xs bg-black/75 px-1 rounded">
            You (producer)
          </div>
        </div>
        
        {/* producer controls (more comprehensive than client) */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <Button
              onClick={toggleMic}
              size="sm"
              className={`rounded-full w-10 h-10 p-0 ${micMuted ? 'bg-red-600/80 hover:bg-red-700' : 'bg-green-600/80 hover:bg-green-700'}`}
            >
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={toggleVideo}
              size="sm"
              className={`rounded-full w-10 h-10 p-0 ${videoMuted ? 'bg-red-600/80 hover:bg-red-700' : 'bg-green-600/80 hover:bg-green-700'}`}
            >
              {videoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={startScreenShare}
              size="sm"
              className={`rounded-full w-10 h-10 p-0 ${isSharing ? 'bg-blue-600/80 hover:bg-blue-700' : 'bg-gray-600/80 hover:bg-gray-700'}`}
              disabled={isSharing}
            >
              <Share className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={disconnectRoom}
              size="sm"
              className="rounded-full w-10 h-10 p-0 bg-red-600/80 hover:bg-red-700"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Producer View: Regular layout with both videos
  return (
    <div className="video-shell h-full bg-gray-900 overflow-hidden relative">
      {/* Desktop: 50/50 when 2 participants, full-bleed when 1 */}
      {/* Mobile: spotlight layout (remote full + local PiP) */}
      
      {isSingleParticipant ? (
        // Single participant: full-bleed
        <div className="h-full">
          <div className="bg-gray-800 relative overflow-hidden h-full">
            <div
              ref={localVideoRef}
              className="w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
              {identity} (You)
            </div>
            
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-white text-xs bg-black bg-opacity-75 px-2 py-1 rounded">
                {connected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            
            {!mediaReady && (
              <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Video className="w-16 h-16 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Two participants: responsive layout
        <>
          {/* Desktop: 50/50 grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-4 h-full p-4">
            {/* Local video */}
            <div className="bg-gray-800 rounded-lg relative overflow-hidden">
              <div
                ref={localVideoRef}
                className="w-full h-full"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                {identity} (You)
              </div>
            </div>
            
            {/* Remote video */}
            <div className="bg-gray-700 rounded-lg relative overflow-hidden">
              <div ref={remoteVideoRef} className="w-full h-full" />
              {hasRemoteParticipant && (
                <div className="absolute bottom-3 left-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                  {remoteParticipants[0].identity}
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Spotlight + PiP */}
          <div className="md:hidden h-full relative">
            {/* Remote video (full screen) */}
            <div className="absolute inset-0 bg-gray-700">
              <div ref={remoteVideoRef} className="w-full h-full" />
              {hasRemoteParticipant && (
                <div className="absolute bottom-3 left-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                  {remoteParticipants[0].identity}
                </div>
              )}
              {!hasRemoteParticipant && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-6xl mb-4">👤</div>
                    <p className="text-sm">Waiting for other participant...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Local video (PiP bubble) */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <div
                ref={localVideoRef}
                className="w-full h-full"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute bottom-1 left-1 text-white text-xs bg-black bg-opacity-75 px-1 rounded">
                You
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Media Controls Bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-2 bg-black bg-opacity-80 backdrop-blur-sm rounded-full px-4 py-2">
          {/* Mic Control */}
          <Button
            onClick={toggleMic}
            size="sm"
            className={`rounded-full w-10 h-10 p-0 ${micMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          {/* Video Control */}
          <Button
            onClick={toggleVideo}
            size="sm"
            className={`rounded-full w-10 h-10 p-0 ${videoMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {videoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </Button>
          
          {/* producer-only controls */}
          {isproducer && (
            <>
              <Button
                onClick={startScreenShare}
                size="sm"
                className={`rounded-full w-10 h-10 p-0 ${isSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                disabled={isSharing}
              >
                <Share className="w-4 h-4" />
              </Button>
            </>
          )}
          
          {/* Leave/Disconnect Button */}
          <Button
            onClick={disconnectRoom}
            size="sm"
            className="rounded-full w-10 h-10 p-0 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Producer View with session-based room management
function producerView({ session, leadName }: { session: string; leadName: string }) {
  const [meetingActive, setMeetingActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleScreenShare = () => {
    // Trigger screen share in the VideoRoom component by sending a custom event
    window.dispatchEvent(new CustomEvent('trigger-screen-share'));
  };
  
  const endMeeting = () => {
    if (confirm('Are you sure you want to end this meeting?')) {
      // Try to close window first, fallback to navigation
      if (window.opener || window.history.length === 1) {
        window.close();
      } else {
        // Navigate back to dashboard
        window.location.href = '/dashboard';
      }
    }
  };

  const startMeeting = async () => {
    setIsStarting(true);
    try {
      console.log('[producer] StartMeeting clicked for sessionId:', session);
      console.log('[producer] POST /api/video/admit payload:', { sessionId: session });
      
      const r = await fetch('/api/video/admit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId: session }),
        credentials: 'include'
      });
      
      console.log('[producer] admit status:', r.status);
      const j = await r.json().catch(()=>({}));
      console.log('[producer] admit response body:', j);
      
      if (r.ok) {
        console.log(`✅ [producer] Client admitted to session: ${session}`);
        setMeetingActive(true);
      } else {
        console.error('❌ [producer] Failed to admit client', r.status, j);
      }
    } catch (error) {
      console.error('❌ [producer] Error starting meeting:', error);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 relative overflow-hidden">
      <div className="flex h-full">
        {/* Video area */}
        <div className="flex-1 p-4">
          {meetingActive ? (
            <VideoRoom roomName={session} identity={`producer-ConnectNow`} canJoin={true} isproducer={true} producerView={true} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-white">
                <div className="text-6xl mb-6">🎯</div>
                <h2 className="text-3xl font-bold mb-4">producer Interface</h2>
                <div className="bg-green-800 bg-opacity-50 p-6 rounded-lg max-w-md">
                  <p className="text-green-200 mb-2"><strong>Session:</strong> {session}</p>
                  <p className="text-green-200 mb-2"><strong>Lead:</strong> {leadName}</p>
                  <p className="text-green-200 text-sm">Ready to start the video meeting</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Control panel */}
        <div className="w-80 p-6 bg-black bg-opacity-30 backdrop-blur-sm text-white">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">AO</span>
              </div>
              <div>
                <div className="font-semibold">AO Intelligence</div>
                <div className="text-sm text-green-200">producer Interface</div>
              </div>
            </div>
            
            <h2 className="text-xl font-bold mb-2">Meeting with {leadName}</h2>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-800 bg-opacity-50">
              <div className={`w-3 h-3 rounded-full ${meetingActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              <span className="text-sm">
                {meetingActive ? 'Meeting Active' : 'Ready to Start'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {!meetingActive ? (
              <Button 
                onClick={startMeeting}
                disabled={isStarting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isStarting ? 'Starting...' : '🎯 Start / Admit Client'}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={endMeeting}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  ❌ End for All
                </Button>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleScreenShare}
                  >
                    <Share className="w-4 h-4 mr-1" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Layout className="w-4 h-4 mr-1" />
                    Layout
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white border-opacity-20">
            <div className="text-xs text-gray-400 space-y-1">
              <div><strong>Session:</strong> {session}</div>
              <div><strong>Status:</strong> {meetingActive ? 'Active' : 'Waiting'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client view with admission polling
function ClientView({ session, leadName }: { session: string; leadName: string }) {
  const [admitted, setAdmitted] = useState(false);
  const [showTrouble, setShowTrouble] = useState(false);
  
  const leaveMeeting = () => {
    // Try to close window first, fallback to navigation
    if (window.opener || window.history.length === 1) {
      window.close();
    } else {
      // Navigate back or to dashboard
      window.location.href = '/dashboard';
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const checkAccess = async () => {
      try {
        console.log('[CLIENT] polling session:', session);
        const url = `/api/video/check-access?sessionId=${encodeURIComponent(session)}`;
        console.log('[CLIENT] GET request URL:', url);
        
        const response = await fetch(url, { 
          credentials: "include" 
        });
        
        if (response.ok) {
          const { admitted } = await response.json();
          console.log('[CLIENT] admitted change', admitted, session);
          
          if (admitted) {
            console.log('🎯 [CLIENT] ADMITTED! Stopping polling and joining video...');
            clearInterval(interval); // STOP POLLING IMMEDIATELY
            setAdmitted(true); // This triggers video join via VideoRoom component
          } else {
            console.log('⏳ [CLIENT] Still waiting for admission...');
          }
        } else {
          console.error('[CLIENT] Poll failed with status:', response.status);
        }
      } catch (error) {
        console.error('❌ [CLIENT] Error checking access:', error);
      }
    };

    // Only start polling if not already admitted
    if (!admitted) {
      // Poll for admission every 2 seconds
      interval = setInterval(checkAccess, 2000);
      
      // Check immediately
      checkAccess();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session, admitted]); // Include admitted in dependencies

  const sendSMSFallback = () => {
    alert('SMS fallback would be sent to client');
  };

  const rescheduleAppointment = () => {
    alert('Reschedule functionality would be triggered');
  };

  if (admitted) {
    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        {/* Full-screen producer video feed only */}
        <VideoRoom roomName={session} identity={`Client-${leadName}`} canJoin={true} clientView={true} />
        
        {/* Minimal floating controls - bottom right */}
        <div className="absolute bottom-4 right-4 z-50">
          <Button 
            onClick={() => setShowTrouble(!showTrouble)}
            size="sm"
            variant="outline"
            className="bg-black/50 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
          >
            Help
          </Button>
          
          {showTrouble && (
            <div className="absolute bottom-12 right-0 bg-black/80 backdrop-blur-sm rounded-lg p-4 min-w-48">
              <div className="space-y-2">
                <Button 
                  onClick={sendSMSFallback}
                  size="sm"
                  variant="outline" 
                  className="w-full text-xs border-white/30 text-white hover:bg-white/10"
                >
                  <Phone className="w-3 h-3 mr-2" />
                  Call me instead
                </Button>
                
                <Button 
                  onClick={rescheduleAppointment}
                  size="sm"
                  variant="outline" 
                  className="w-full text-xs border-white/30 text-white hover:bg-white/10"
                >
                  <Calendar className="w-3 h-3 mr-2" />
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 relative overflow-hidden flex items-center justify-center">
      <div className="text-center text-white p-8">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">AO</span>
            </div>
            <div>
              <div className="font-semibold">AO Intelligence</div>
              <div className="text-sm text-blue-200">Video Meeting</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome, {leadName}!</h2>
          <p className="text-blue-200 mb-6">Waiting to be admitted to your meeting...</p>
          
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm">producer will admit you shortly</span>
          </div>

          <div className="pt-4 border-t border-white border-opacity-20">
            <button 
              onClick={() => setShowTrouble(!showTrouble)}
              className="text-blue-200 hover:text-white text-sm underline"
            >
              Having trouble?
            </button>
            
            {showTrouble && (
              <div className="mt-3 space-y-2">
                <Button 
                  onClick={sendSMSFallback}
                  variant="outline" 
                  className="w-full text-sm border-blue-400 text-blue-200 hover:bg-blue-800"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call me instead
                </Button>
                
                <Button 
                  onClick={rescheduleAppointment}
                  variant="outline" 
                  className="w-full text-sm border-blue-400 text-blue-200 hover:bg-blue-800"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Reschedule appointment
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function VideoCall() {
  const [location] = useLocation();

  // Parse URL parameters - session-based approach
  const params = React.useMemo(() => {
    return new URLSearchParams(window.location.search);
  }, [location]);

  const rawRole = (params.get("role") || "").toLowerCase();
  const session = params.get("session") || params.get("room") || `lead-${Date.now()}`;
  const leadName = params.get("leadName") || "Guest";

  // Role is ONLY from query param, never inferred from room name
  const role = rawRole || "client";

  console.log("ROLE(from URL):", role, "session:", session, "leadName:", leadName);
  console.log("🌐 FULL URL:", window.location.href);
  
  return role === "producer" ? (
    <producerView session={session} leadName={leadName} />
  ) : (
    <ClientView session={session} leadName={leadName} />
  );
}