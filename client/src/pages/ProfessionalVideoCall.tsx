import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

declare global {
  interface Window {
    Twilio: any;
  }
}

interface ProfessionalVideoCallProps {
  roomName?: string;
  userName?: string;
  branding?: 'producer' | 'client';
}

export default function ProfessionalVideoCall({ 
  roomName = 'consultation-room',
  userName = 'producer',
  branding = 'producer'
}: ProfessionalVideoCallProps) {
  const [status, setStatus] = useState('Ready to connect');
  const [room, setRoom] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Branding configuration
  const brandingConfig = {
    producer: {
      title: 'AO Intelligence',
      subtitle: 'powered by ConnectNow',
      primaryColor: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      theme: 'bg-gray-900 text-white'
    },
    client: {
      title: 'ConnectNow',
      subtitle: 'Video Consultation',
      primaryColor: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      theme: 'bg-white text-gray-900'
    }
  };
  
  const config = brandingConfig[branding];

  const startCall = async () => {
    try {
      setStatus('Initializing camera...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setStatus('Connecting to video service...');
      
      // Get Twilio token
      const tokenResponse = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: userName, room: roomName })
      });
      
      const tokenData = await tokenResponse.json();
      
      setStatus('Establishing secure connection...');
      
      // Wait for Twilio SDK
      let attempts = 0;
      while ((!window.Twilio || !window.Twilio.Video) && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.Twilio?.Video) {
        throw new Error('Video service unavailable');
      }
      
      // Connect to room
      const twilioRoom = await window.Twilio.Video.connect(tokenData.token, {
        name: roomName,
        audio: audioEnabled,
        video: videoEnabled
      });
      
      setRoom(twilioRoom);
      setIsConnected(true);
      setStatus('Connected - Video consultation active');
      
      // Handle participants
      setParticipants(Array.from(twilioRoom.participants.values()));
      twilioRoom.participants.forEach(addRemoteParticipant);
      twilioRoom.on('participantConnected', (participant: any) => {
        addRemoteParticipant(participant);
        setParticipants(Array.from(twilioRoom.participants.values()));
      });
      twilioRoom.on('participantDisconnected', (participant: any) => {
        setParticipants(Array.from(twilioRoom.participants.values()));
      });
      
    } catch (error) {
      console.error('Video call error:', error);
      setStatus('Connection failed: ' + (error as Error).message);
    }
  };
  
  const addRemoteParticipant = (participant: any) => {
    participant.tracks.forEach((publication: any) => {
      if (publication.isSubscribed) {
        attachTrack(publication.track);
      }
    });
    
    participant.on('trackSubscribed', attachTrack);
  };
  
  const attachTrack = (track: any) => {
    if (track.kind === 'video' && remoteVideoRef.current) {
      track.attach(remoteVideoRef.current);
    }
  };
  
  const endCall = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsConnected(false);
    setStatus('Call ended');
  };
  
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };
  
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  return (
    <div className={`min-h-screen ${config.theme} relative`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{config.title}</h1>
            <p className="text-sm opacity-75">{config.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-75">Room: {roomName}</p>
            <p className="text-xs opacity-60">{status}</p>
          </div>
        </div>
      </div>
      
      {/* Main Video Area */}
      <div className="flex h-screen">
        {/* Remote Video (Main) */}
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
          />
          {participants.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-gray-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Video className="w-16 h-16 text-gray-400" />
                </div>
                <p className="text-lg">Waiting for other participants...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Local Video (Corner) */}
        <div className="absolute bottom-20 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
            You
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex justify-center space-x-4">
          {!isConnected ? (
            <Button
              onClick={startCall}
              className={`${config.primaryColor} ${config.hoverColor} px-8 py-3 rounded-full`}
              size="lg"
            >
              <Phone className="w-5 h-5 mr-2" />
              Start Video Call
            </Button>
          ) : (
            <>
              <Button
                onClick={toggleAudio}
                variant={audioEnabled ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full"
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              
              <Button
                onClick={toggleVideo}
                variant={videoEnabled ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full"
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
              
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="rounded-full px-8"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Participant Count */}
      {isConnected && (
        <div className="absolute top-20 right-4 bg-black bg-opacity-50 px-3 py-1 rounded text-sm">
          {participants.length + 1} participant{participants.length === 0 ? '' : 's'}
        </div>
      )}
    </div>
  );
}