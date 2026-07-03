import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function ClientVideoCall() {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  const [leadName, setLeadName] = useState('');
  const [roomId, setRoomId] = useState('');
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setLeadName(urlParams.get('leadName') || 'You');
    setRoomId(urlParams.get('room') || 'video-room');
  }, []);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Auto-hide controls after 4 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 4000);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);
  
  // Initialize camera and WebSocket connection
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        console.log(`🎥 Client joined video conference: ${roomId}`);
        
        // Connect to video WebSocket - use same server as web page
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log(`🔗 Client connecting to WebSocket: ${wsUrl}`);
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('🔌 Client WebSocket connected to:', wsUrl);
          const joinMessage = {
            type: 'join-room',
            roomId,
            participantName: leadName || 'Client',
            participantType: 'client'
          };
          console.log('📤 Client sending join message:', joinMessage);
          socket.send(JSON.stringify(joinMessage));
        };
        
        // Initialize WebRTC
        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        // Add local stream to peer connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStreamRef.current!);
          });
        }
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
          console.log('📹 Client received remote stream');
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate
            }));
          }
        };
        
        socket.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          console.log('📡 Client received:', data);
          
          switch (data.type) {
            case 'webrtc-offer':
              console.log('📹 Client received offer');
              try {
                await peerConnection.setRemoteDescription(data.offer);
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.send(JSON.stringify({
                  type: 'webrtc-answer',
                  answer: answer
                }));
                console.log('📤 Client sent answer');
              } catch (error) {
                console.error('❌ Error handling offer:', error);
              }
              break;
              
            case 'webrtc-ice-candidate':
              console.log('🧊 Client received ICE candidate');
              try {
                await peerConnection.addIceCandidate(data.candidate);
                console.log('✅ Client added ICE candidate');
              } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
              }
              break;
          }
        };
        
        socket.onclose = () => {
          console.log('🔌 Client WebSocket disconnected');
        };
        
        socket.onerror = (error) => {
          console.error('❌ Client WebSocket error:', error);
          console.error('❌ WebSocket connection failed to:', wsUrl);
          // Try to reconnect after 2 seconds
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            // Recursive reconnection logic would go here
          }, 2000);
        };
        
        // Show waiting status initially
        setTimeout(() => {
          if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#1f2937';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#9ca3af';
              ctx.font = '24px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Other Participant', canvas.width/2, canvas.height/2 - 20);
              ctx.font = '16px Arial';
              ctx.fillText('Will appear here when connected', canvas.width/2, canvas.height/2 + 10);
              ctx.fillText('(Screen sharing will also display here)', canvas.width/2, canvas.height/2 + 30);
              
              const placeholderStream = canvas.captureStream();
              remoteVideoRef.current.srcObject = placeholderStream;
            }
          }
        }, 1000);
        
      } catch (error) {
        console.error('Camera access needed for video consultation:', error);
      }
    };
    
    initCamera();
    
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);
  
  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };
  
  const toggleAudio = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  };
  
  const endCall = () => {
    window.close();
  };
  
  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      {/* Main video area - consultant fills entire screen */}
      <div className="absolute inset-0">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
      </div>
      
      {/* Your video - changes position when producer screen shares */}
      <div className="absolute top-4 right-4 w-32 h-24 z-20 bg-gray-900 rounded-lg overflow-hidden shadow-xl transition-all duration-300">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
          {leadName}
        </div>
      </div>
      
      {/* producer video - appears next to yours when they screen share */}
      <div className="absolute top-4 right-40 w-32 h-24 z-20 bg-gray-900 rounded-lg overflow-hidden shadow-xl transition-all duration-300">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
        <div className="absolute bottom-1 left-1 bg-blue-600 bg-opacity-90 text-white text-xs px-1 py-0.5 rounded">
          Participant
        </div>
      </div>
      
      {/* Simple consultation indicator */}
      <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg">
        <span className="text-sm font-medium">Video Conference</span>
      </div>
      
      {/* Screen sharing indicator - only show when active */}
      <div className="absolute top-4 right-80 z-20 bg-blue-600 bg-opacity-90 text-white px-2 py-1 rounded-lg">
        <span className="text-xs font-medium">Screen Share</span>
      </div>
      
      {/* Basic controls - only essentials */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
      }`}>
        <div className="bg-gray-900 bg-opacity-95">
          <div className="flex items-center justify-center gap-4 py-3">
            {/* Mute */}
            <button
              onClick={toggleAudio}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isAudioEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            {/* Video */}
            <button
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            
            {/* End Call */}
            <button
              onClick={endCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors ml-4"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}