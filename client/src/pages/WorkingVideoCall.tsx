import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    Twilio: any;
  }
}

export default function WorkingVideoCall() {
  const [status, setStatus] = useState('Ready to start');
  const [room, setRoom] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const roomName = new URLSearchParams(window.location.search).get('room') || 'test-room';
  const userName = new URLSearchParams(window.location.search).get('name') || 'User';

  const startCall = async () => {
    try {
      setStatus('Starting camera...');
      
      // Get user media first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setStatus('Getting token...');
      
      // Get Twilio token
      const tokenResponse = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: userName, room: roomName })
      });
      
      const tokenData = await tokenResponse.json();
      console.log('Token received:', tokenData);
      
      setStatus('Checking Twilio SDK...');
      
      // Wait for SDK to be available (loaded in HTML)
      let attempts = 0;
      while ((!window.Twilio || !window.Twilio.Video) && attempts < 20) {
        console.log('Waiting for Twilio SDK... attempt', attempts + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // Verify SDK is available
      if (!window.Twilio || !window.Twilio.Video) {
        throw new Error('Twilio Video SDK not available');
      }
      
      console.log('Twilio SDK available:', !!window.Twilio.Video);
      
      setStatus('Connecting to room...');
      console.log('Connecting with token:', tokenData.token);
      
      // Connect to room
      const twilioRoom = await window.Twilio.Video.connect(tokenData.token, {
        name: roomName,
        audio: true,
        video: true
      });
      
      setRoom(twilioRoom);
      setStatus(`Connected to ${roomName}`);
      console.log('Connected to room:', twilioRoom);
      
      // Handle remote participants
      twilioRoom.participants.forEach(addRemoteParticipant);
      twilioRoom.on('participantConnected', addRemoteParticipant);
      twilioRoom.on('participantDisconnected', removeRemoteParticipant);
      
    } catch (error) {
      console.error('Call error:', error);
      setStatus('Error: ' + (error as Error).message);
    }
  };
  
  const addRemoteParticipant = (participant: any) => {
    console.log('Remote participant connected:', participant.identity);
    
    participant.tracks.forEach((publication: any) => {
      if (publication.isSubscribed) {
        attachTrack(publication.track);
      }
    });
    
    participant.on('trackSubscribed', attachTrack);
  };
  
  const removeRemoteParticipant = (participant: any) => {
    console.log('Remote participant disconnected:', participant.identity);
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
    setStatus('Call ended');
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold mb-2">Video Call: {roomName}</h1>
          <p className="text-gray-400">User: {userName}</p>
          <p className="text-sm text-green-400">{status}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Local Video */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <h3 className="p-2 text-sm font-medium">You</h3>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-64 object-cover"
            />
          </div>
          
          {/* Remote Video */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <h3 className="p-2 text-sm font-medium">Remote</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-64 object-cover bg-gray-700"
            />
          </div>
        </div>
        
        <div className="flex justify-center space-x-4">
          {!room ? (
            <Button onClick={startCall} className="bg-green-600 hover:bg-green-700 px-8 py-3">
              Start Video Call
            </Button>
          ) : (
            <Button onClick={endCall} className="bg-red-600 hover:bg-red-700 px-8 py-3">
              End Call
            </Button>
          )}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Share this URL with others to join:</p>
          <p className="font-mono bg-gray-800 p-2 rounded mt-2">
            https://aoirail-production.up.railway.app/working-video?room={roomName}&name=TheirName
          </p>
        </div>
      </div>
    </div>
  );
}
