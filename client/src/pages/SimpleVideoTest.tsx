import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function SimpleVideoTest() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const connectWebSocket = () => {
    try {
      // In Replit, we always connect to the same server serving the web page
      // The WebSocket server is on the same host and port as the web server
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
      const wsUrl = `${protocol}//${host}/ws`;
      
      addMessage(`Attempting to connect to: ${wsUrl}`);
      addMessage(`Protocol: ${protocol}, Host: ${window.location.host}`);
      addMessage(`Current location: ${window.location.href}`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('🎉 Client: WebSocket opened successfully!');
        addMessage('✅ WebSocket connected successfully!');
        setConnectionStatus('connected');
        setSocket(ws);
        
        // Send join room message
        const joinMsg = {
          type: 'join-room',
          roomId: 'simple-test-room',
          participantName: 'Simple Test User',
          participantType: 'test'
        };
        
        addMessage(`Sending join message: ${JSON.stringify(joinMsg)}`);
        ws.send(JSON.stringify(joinMsg));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addMessage(`📡 Received: ${data.type} - ${JSON.stringify(data)}`);
      };
      
      ws.onclose = (event) => {
        console.log('🚪 Client: WebSocket closed:', event.code, event.reason);
        addMessage(`❌ WebSocket closed: ${event.code} ${event.reason}`);
        setConnectionStatus('disconnected');
        setSocket(null);
      };
      
      ws.onerror = (error) => {
        console.error('❌ Client: WebSocket error:', error);
        addMessage(`❌ WebSocket error: ${error}`);
        setConnectionStatus('error');
      };
      
    } catch (error) {
      addMessage(`❌ Failed to create WebSocket: ${error}`);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple WebSocket Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Connection Status</h2>
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm">{connectionStatus}</span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={connectWebSocket}
                disabled={connectionStatus === 'connected'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Connect
              </Button>
              <Button 
                onClick={disconnect}
                disabled={connectionStatus === 'disconnected'}
                className="bg-red-600 hover:bg-red-700"
              >
                Disconnect
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-gray-400">
            <div>WebSocket URL: {window.location.protocol === "https:" ? "wss:" : "ws:"}//{window.location.host}/ws</div>
            <div>Current Host: {window.location.host}</div>
            <div>Protocol: {window.location.protocol}</div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Message Log</h2>
          <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="text-gray-500">No messages yet. Click Connect to start.</div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="mb-1 text-green-400">{msg}</div>
              ))
            )}
          </div>
          <Button 
            onClick={() => setMessages([])}
            className="mt-4 bg-gray-600 hover:bg-gray-700"
          >
            Clear Log
          </Button>
        </div>
      </div>
    </div>
  );
}