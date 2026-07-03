import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function VideoTest() {
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const addMessage = (message: string) => {
    console.log(message);
    setMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
    const wsUrl = `${protocol}//${host}/ws`;
    
    addMessage(`Connecting to: ${wsUrl}`);
    setWsStatus('Connecting...');
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setWsStatus('Connected');
      addMessage('WebSocket connected successfully');
      
      // Test join room message
      const joinMessage = {
        type: 'join-room',
        roomId: 'test-room-' + Date.now(),
        participantName: 'Test User',
        participantType: 'test'
      };
      
      addMessage(`Sending join message: ${JSON.stringify(joinMessage)}`);
      ws.send(JSON.stringify(joinMessage));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addMessage(`Received: ${JSON.stringify(data)}`);
    };
    
    ws.onclose = (event) => {
      setWsStatus('Disconnected');
      addMessage(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'none'}`);
    };
    
    ws.onerror = (error) => {
      setWsStatus('Error');
      addMessage(`WebSocket error: ${JSON.stringify(error)}`);
      console.error('WebSocket detailed error:', error);
    };
    
    setSocket(ws);
  };

  const disconnectWebSocket = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  useEffect(() => {
    // Auto-connect on component mount
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Video WebSocket Test</h1>
        
        <Card className="bg-gray-800 border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Connection Status</h2>
              <p className={`text-lg ${
                wsStatus === 'Connected' ? 'text-green-400' : 
                wsStatus === 'Error' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {wsStatus}
              </p>
            </div>
            <div className="space-x-2">
              <Button 
                onClick={connectWebSocket} 
                disabled={wsStatus === 'Connected'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Connect
              </Button>
              <Button 
                onClick={disconnectWebSocket} 
                disabled={wsStatus === 'Disconnected'}
                variant="destructive"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Card>

        <Card className="bg-gray-800 border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Messages Log</h2>
          <div className="bg-gray-900 p-4 rounded max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-400">No messages yet...</p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className="text-sm mb-1 font-mono">
                  {message}
                </div>
              ))
            )}
          </div>
          <Button 
            onClick={() => setMessages([])} 
            variant="outline" 
            className="mt-4"
          >
            Clear Log
          </Button>
        </Card>

        <div className="mt-6">
          <Card className="bg-gray-800 border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
            <div className="space-y-2 text-sm">
              <p>1. Check if WebSocket connects successfully</p>
              <p>2. Verify server responds to join-room messages</p>
              <p>3. Test with multiple browser tabs for full WebRTC flow</p>
              <p>4. If this works, the video call pages should work too</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}