import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function VideoDebug() {
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [roomId] = useState('debug-room');
  
  useEffect(() => {
    // Test WebSocket connection - use same server as web page
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('🔍 Connecting to WebSocket:', wsUrl);
    
    try {
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setWsStatus('connected');
        setWsMessages(prev => [...prev, 'WebSocket connected']);
        
        // Test join room
        socket.send(JSON.stringify({
          type: 'join-room',
          roomId: roomId,
          participantName: 'Debug User',
          participantType: 'debug'
        }));
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📡 WebSocket message:', data);
        setWsMessages(prev => [...prev, `Received: ${data.type} - ${JSON.stringify(data)}`]);
      };
      
      socket.onclose = (event) => {
        console.log('❌ WebSocket closed:', event.code, event.reason);
        setWsStatus('disconnected');
        setWsMessages(prev => [...prev, `WebSocket closed: ${event.code} ${event.reason}`]);
      };
      
      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setWsStatus('error');
        setWsMessages(prev => [...prev, `WebSocket error: ${error}`]);
      };
      
      return () => {
        socket.close();
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setWsStatus('error');
      setWsMessages(prev => [...prev, `Failed to create WebSocket: ${error}`]);
    }
  }, [roomId]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Video Connection Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Connection Status */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  wsStatus === 'connected' ? 'bg-green-500' : 
                  wsStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span>WebSocket: {wsStatus}</span>
              </div>
              <div className="text-sm text-gray-400">
                Room ID: {roomId}
              </div>
              <div className="text-sm text-gray-400">
                WebSocket URL: {window.location.protocol === "https:" ? "wss:" : "ws:"}//{window.location.host}/ws
              </div>
            </div>
          </div>
          
          {/* Camera Test */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Camera Test</h2>
            <video
              autoPlay
              muted
              playsInline
              className="w-full aspect-video bg-gray-700 rounded"
              ref={(video) => {
                if (video) {
                  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(stream => {
                      video.srcObject = stream;
                    })
                    .catch(err => console.error('Camera error:', err));
                }
              }}
            />
          </div>
        </div>
        
        {/* Message Log */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">WebSocket Messages</h2>
          <div className="bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
            {wsMessages.map((msg, i) => (
              <div key={i} className="mb-1 text-green-400">
                [{new Date().toLocaleTimeString()}] {msg}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <Button 
            onClick={() => window.location.href = '/video-test'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Open VideoTest (producer)
          </Button>
          <Button 
            onClick={() => window.location.href = '/client-video?room=debug-room&leadName=TestClient&agentName=Testproducer'}
            className="bg-green-600 hover:bg-green-700"
          >
            Open Client Video
          </Button>
        </div>
      </div>
    </div>
  );
}