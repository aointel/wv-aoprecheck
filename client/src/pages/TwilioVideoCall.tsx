import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';

declare global {
  interface Window {
    Twilio: any;
  }
}

export default function TwilioVideoCall() {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [participantCount, setParticipantCount] = useState(0);
  
  // Get params from URL
  const [leadName, setLeadName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [roomId, setRoomId] = useState('');
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<any>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setLeadName(urlParams.get('leadName') || 'Client');
    setAgentName(urlParams.get('agentName') || 'producer');
    setRoomId(urlParams.get('room') || 'video-room-' + Date.now());
  }, []);
  
  // Auto-hide controls after 3 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);
  
  // Auto-join when room details are available
  useEffect(() => {
    if (roomId && agentName) {
      joinVideoRoom();
    }
    
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [roomId, agentName]);
  
  const joinVideoRoom = async () => {
    try {
      setConnectionStatus('Starting camera...');
      
      // Get user media first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled ? { width: 640, height: 480 } : false,
        audio: isAudioEnabled
      });
      
      setConnectionStatus('Getting access token...');
      
      // Get video token from our server
      const response = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identity: agentName || 'producer',
          room: roomId 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get video token');
      }
      
      const data = await response.json();
      console.log('🎥 Got Twilio Video token:', data);
      
      setConnectionStatus('Connecting to room...');
      
      // Wait for Twilio SDK (loaded in HTML)
      let attempts = 0;
      while ((!window.Twilio || !window.Twilio.Video) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.Twilio?.Video) {
        throw new Error('Video service unavailable');
      }
      
      // Connect to video room with detailed configuration
      const room = await window.Twilio.Video.connect(data.token, {
        name: roomId,
        audio: isAudioEnabled,
        video: isVideoEnabled ? { width: 640, height: 480 } : false,
        // Ensure reliable connection
        networkQuality: {
          local: 1,
          remote: 1
        },
        // Auto-subscribe to tracks
        automaticSubscription: true
      });
      
      roomRef.current = room;
      setConnectionStatus('Connected');
      console.log('✅ Connected to Twilio Video room:', roomId);
      
      // Handle local participant (self)
      const localParticipant = room.localParticipant;
      console.log('🎥 Local participant connected:', localParticipant.identity);
      
      // Attach local video tracks
      localParticipant.videoTracks.forEach((publication: any) => {
        if (localVideoRef.current && publication.track) {
          console.log('📹 Attaching local video track');
          const videoElement = publication.track.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoElement.muted = true; // Mute local video to prevent feedback
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          localVideoRef.current.appendChild(videoElement);
        }
      });
      
      // Handle existing remote participants
      console.log('🔍 Checking for existing participants:', room.participants.size);
      room.participants.forEach(addRemoteParticipant);
      setParticipantCount(room.participants.size + 1);
      
      // CRITICAL: Also listen for track publications from existing participants
      room.participants.forEach((participant: any) => {
        participant.on('trackPublished', (publication: any) => {
          console.log('📢 Existing participant published track:', publication.kind);
          if (publication.isSubscribed && publication.track) {
            attachTrack(publication.track);
          }
        });
      });
      
      // Handle new participants joining
      room.on('participantConnected', (participant: any) => {
        console.log('👥 Participant joined:', participant.identity);
        addRemoteParticipant(participant);
        setParticipantCount(room.participants.size + 1);
      });
      
      // Handle participants leaving
      room.on('participantDisconnected', (participant: any) => {
        console.log('👋 Participant left:', participant.identity);
        setParticipantCount(room.participants.size + 1);
      });
      
      // Handle room disconnection
      room.on('disconnected', () => {
        console.log('🔌 Disconnected from room');
        setConnectionStatus('Disconnected');
        setParticipantCount(0);
      });
      
    } catch (error) {
      console.error('❌ Error joining video room:', error);
      setConnectionStatus('Error');
    }
  };
  
  const addRemoteParticipant = (participant: any) => {
    console.log('📹 Adding remote participant:', participant.identity);
    console.log('📹 Participant tracks available:', participant.tracks.size);
    console.log('📹 Participant publications:', Array.from(participant.tracks.values()));
    
    // Handle existing tracks
    participant.tracks.forEach((publication: any) => {
      console.log('📡 Processing existing track:', publication.kind, 'subscribed:', publication.isSubscribed);
      if (publication.isSubscribed && publication.track) {
        console.log('✅ Attaching existing track:', publication.track.kind);
        attachTrack(publication.track);
      } else if (publication.track) {
        console.log('⚠️ Track exists but not subscribed yet:', publication.track.kind);
      }
    });
    
    // Handle new tracks
    participant.on('trackSubscribed', (track: any) => {
      console.log('📡 NEW Track subscribed:', track.kind, track);
      attachTrack(track);
    });
    
    participant.on('trackUnsubscribed', (track: any) => {
      console.log('📡 Track unsubscribed:', track.kind);
      detachTrack(track);
    });

    // Handle track publication events
    participant.on('trackPublished', (publication: any) => {
      console.log('📢 Track published:', publication.kind);
    });

    participant.on('trackUnpublished', (publication: any) => {
      console.log('📢 Track unpublished:', publication.kind);
    });
  };
  
  const attachTrack = (track: any) => {
    console.log('🎬 Attaching track:', track.kind, track);
    if (track.kind === 'video' && remoteVideoRef.current) {
      // Clear any existing video elements first
      const existingVideos = remoteVideoRef.current.querySelectorAll('video');
      existingVideos.forEach(video => video.remove());
      
      const videoElement = track.attach();
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      console.log('📺 Video element created and configured:', videoElement);
      remoteVideoRef.current.appendChild(videoElement);
      
      // Force play to ensure video starts
      videoElement.play().catch((error: any) => {
        console.error('❌ Video play error:', error);
      });
    }
  };
  
  const detachTrack = (track: any) => {
    track.detach().forEach((element: any) => element.remove());
  };
  
  const toggleVideo = async () => {
    if (roomRef.current && roomRef.current.localParticipant) {
      const videoTrack = Array.from(roomRef.current.localParticipant.videoTracks.values())[0];
      if (videoTrack?.track) {
        if (isVideoEnabled) {
          videoTrack.track.disable();
        } else {
          videoTrack.track.enable();
        }
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };
  
  const toggleAudio = async () => {
    if (roomRef.current && roomRef.current.localParticipant) {
      const audioTrack = Array.from(roomRef.current.localParticipant.audioTracks.values())[0];
      if (audioTrack?.track) {
        if (isAudioEnabled) {
          audioTrack.track.disable();
        } else {
          audioTrack.track.enable();
        }
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };
  
  const toggleScreenShare = async () => {
    try {
      if (!roomRef.current) {
        console.error('❌ No room connected for screen sharing');
        return;
      }

      if (isScreenSharing) {
        // Stop screen sharing
        console.log('🛑 Stopping screen share...');
        const screenTrack = Array.from(roomRef.current.localParticipant.videoTracks.values())
          .find((track: any) => track.trackName === 'screen');
        
        if (screenTrack) {
          roomRef.current.localParticipant.unpublishTrack(screenTrack.track);
          screenTrack.track.stop();
        }
        
        // Re-enable camera
        if (isVideoEnabled) {
          const videoConstraints = { width: 640, height: 480 };
          const cameraTrack = await window.Twilio.Video.createLocalVideoTrack(videoConstraints);
          await roomRef.current.localParticipant.publishTrack(cameraTrack);
          
          // Attach to local video
          if (localVideoRef.current) {
            localVideoRef.current.innerHTML = '';
            const videoElement = cameraTrack.attach();
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            videoElement.muted = true;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            localVideoRef.current.appendChild(videoElement);
          }
        }
        
        setIsScreenSharing(false);
        console.log('✅ Screen sharing stopped');
      } else {
        // Start screen sharing
        console.log('🖥️ Starting screen share...');
        
        const screenTrack = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Stop existing video track
        const existingVideoTrack = Array.from(roomRef.current.localParticipant.videoTracks.values())[0];
        if (existingVideoTrack) {
          roomRef.current.localParticipant.unpublishTrack(existingVideoTrack.track);
          existingVideoTrack.track.stop();
        }
        
        // Create Twilio screen track
        const twilioScreenTrack = new window.Twilio.Video.LocalVideoTrack(screenTrack.getVideoTracks()[0], {
          name: 'screen'
        });
        
        // Publish screen track
        await roomRef.current.localParticipant.publishTrack(twilioScreenTrack);
        
        // Attach to local video
        if (localVideoRef.current) {
          localVideoRef.current.innerHTML = '';
          const videoElement = twilioScreenTrack.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'contain';
          videoElement.muted = true;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          localVideoRef.current.appendChild(videoElement);
        }
        
        // Handle screen share ending
        screenTrack.getVideoTracks()[0].onended = () => {
          console.log('🛑 Screen share ended by user');
          setIsScreenSharing(false);
          // Auto-restart camera when screen share ends
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
        console.log('✅ Screen sharing started');
      }
    } catch (error) {
      console.error('❌ Screen sharing error:', error);
      setIsScreenSharing(false);
    }
  };

  const endCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionStatus('Disconnected');
    window.close();
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* AO Intelligence Branding */}
      <div className="absolute top-4 left-4 z-20">
        <div className="text-2xl font-bold text-blue-400">AO Intelligence</div>
        <div className="text-sm text-gray-400">powered by ConnectNow</div>
      </div>
      
      {/* Connection Status */}
      <div className="absolute top-4 right-4 z-20">
        <Card className="bg-black/60 border-gray-700 px-3 py-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'Connected' ? 'bg-green-400' : 
              connectionStatus === 'Connecting...' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            <span className="text-sm">{connectionStatus}</span>
            {participantCount > 1 && (
              <span className="text-xs text-gray-400">({participantCount} participants)</span>
            )}
          </div>
        </Card>
      </div>
      
      {/* Main Video Area */}
      <div className="relative w-full h-screen">
        {/* Remote Video (Main Screen) */}
        <div ref={remoteVideoRef} className="w-full h-full bg-gray-900 flex items-center justify-center">
          {participantCount === 1 && (
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <div className="text-xl text-gray-400">Waiting for {leadName} to join...</div>
              <div className="text-sm text-gray-500 mt-2">Room ID: {roomId}</div>
            </div>
          )}
        </div>
        
        {/* Local Video (Corner) */}
        <div className="absolute bottom-20 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          <div ref={localVideoRef} className="w-full h-full">
            {!isVideoEnabled && (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls (Auto-hide) */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="flex justify-center space-x-4">
          <Button
            onClick={toggleAudio}
            className={`rounded-full p-4 ${
              isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            className={`rounded-full p-4 ${
              isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={toggleScreenShare}
            className={`rounded-full p-4 ${
              isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={endCall}
            className="rounded-full p-4 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}