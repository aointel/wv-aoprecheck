import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor } from 'lucide-react';

export default function VideoClient() {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('connecting');
  const [leadName, setLeadName] = useState('');
  const [agentName, setAgentName] = useState('');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Auto-join from URL parameter and get names
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    setLeadName(urlParams.get('leadName') || 'Client');
    setAgentName(urlParams.get('agentName') || 'producer');
    
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
      initializeCall(roomFromUrl);
    }
  }, []);

  const initializeCall = async (roomId: string) => {
    try {
      setStatus('requesting_permissions');
      
      // Request camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setStatus('connecting_to_room');
      
      // Connect to WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
      const wsUrl = `${protocol}//${host}/ws`;
      socketRef.current = new WebSocket(wsUrl);
      
      socketRef.current.onopen = () => {
        setStatus('joined');
        setIsConnected(true);
        // Join room
        socketRef.current?.send(JSON.stringify({
          type: 'join-room',
          roomId: roomId
        }));
      };

      socketRef.current.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await handleWebSocketMessage(message);
      };

    } catch (error) {
      console.error('Error initializing call:', error);
      setStatus('error');
    }
  };

  const handleWebSocketMessage = async (message: any) => {
    switch (message.type) {
      case 'user-joined':
        await createOffer();
        break;
      case 'offer':
        await handleOffer(message.offer);
        break;
      case 'answer':
        await handleAnswer(message.answer);
        break;
      case 'ice-candidate':
        await handleIceCandidate(message.candidate);
        break;
    }
  };

  const createOffer = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    peerConnectionRef.current = pc;
    
    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          roomId
        }));
      }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socketRef.current?.send(JSON.stringify({
      type: 'offer',
      offer,
      roomId
    }));
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    peerConnectionRef.current = pc;
    
    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          roomId
        }));
      }
    };
    
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socketRef.current?.send(JSON.stringify({
      type: 'answer',
      answer,
      roomId
    }));
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(answer);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(candidate);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track in peer connection
        if (peerConnectionRef.current && localStreamRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        
        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        
        // Handle screen share ending
        screenStream.getVideoTracks()[0].addEventListener('ended', async () => {
          await stopScreenShare();
        });
        
      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const stopScreenShare = async () => {
    try {
      // Get camera stream back
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Replace screen track with camera track
      if (peerConnectionRef.current) {
        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
      
      // Update local stream and video
      localStreamRef.current = cameraStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStream;
      }
      
      setIsScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    window.close();
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'connecting': return 'Initializing video call...';
      case 'requesting_permissions': return 'Requesting camera access...';
      case 'connecting_to_room': return 'Connecting to room...';
      case 'joined': return 'Connected';
      case 'error': return 'Unable to connect. Please check camera permissions.';
      default: return 'Connecting...';
    }
  };

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Connection Error</h1>
          <p className="text-gray-300 mb-6">Please allow camera and microphone access, then refresh the page.</p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Status Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-center text-white">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
            <span className="text-xs font-bold">AO</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
          <span className="font-medium">{getStatusMessage()}</span>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Remote Video (producer) - Full screen */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          {agentName}
        </div>

        {/* Local Video (Client) - Picture in Picture */}
        <div className="absolute top-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover bg-gray-700"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
            You
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 flex justify-center gap-4 border-t border-gray-700">
        <Button
          variant={isVideoEnabled ? "default" : "destructive"}
          onClick={toggleVideo}
          size="lg"
          className={`rounded-full w-12 h-12 ${isVideoEnabled 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' 
            : 'bg-red-600 hover:bg-red-700'}`}
        >
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
        
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          onClick={toggleAudio}
          size="lg"
          className={`rounded-full w-12 h-12 ${isAudioEnabled 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' 
            : 'bg-red-600 hover:bg-red-700'}`}
        >
          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={isScreenSharing ? "default" : "outline"}
          onClick={toggleScreenShare}
          size="lg"
          className={`rounded-full w-12 h-12 ${isScreenSharing 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
            : 'border-gray-500 text-gray-300 hover:bg-gray-700'}`}
        >
          <Monitor className="w-5 h-5" />
        </Button>
        
        <Button
          variant="destructive"
          onClick={endCall}
          size="lg"
          className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}