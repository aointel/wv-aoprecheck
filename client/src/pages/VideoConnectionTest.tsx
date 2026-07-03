import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

declare global {
  interface Window {
    Twilio: any;
  }
}

export default function VideoConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState('Not Started');
  const [testResult, setTestResult] = useState('');
  const [tokenResult, setTokenResult] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<any>(null);
  
  // Test 1: Load Twilio Video SDK
  const testLoadSDK = async () => {
    try {
      setConnectionStatus('Loading Twilio Video SDK...');
      
      if (!window.Twilio) {
        const script = document.createElement('script');
        script.src = 'https://media.twiliocdn.com/sdk/js/video/releases/2.20.0/twilio-video.min.js';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }
      
      setSdkLoaded(true);
      setConnectionStatus('✅ Twilio Video SDK Loaded');
      setTestResult(prev => prev + '\n✅ SDK loaded successfully');
      
      // Small delay to ensure SDK is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      setConnectionStatus('❌ Failed to load SDK');
      setTestResult(prev => prev + '\n❌ SDK loading failed: ' + error);
      console.error('SDK loading error:', error);
    }
  };
  
  // Test 2: Get video token
  const testGetToken = async () => {
    try {
      setConnectionStatus('Getting video token...');
      setTestResult(prev => prev + '\n🔄 Requesting token from /api/video/token...');
      
      const requestBody = { 
        identity: 'TestUser',
        room: 'test-connection' 
      };
      
      console.log('Token request:', requestBody);
      
      const response = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Token response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Token error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Token response data:', data);
      
      setTokenResult(JSON.stringify(data, null, 2));
      setConnectionStatus('✅ Token received');
      setTestResult(prev => prev + '\n✅ Token received successfully');
      
      return data.token;
      
    } catch (error) {
      setConnectionStatus('❌ Failed to get token');
      setTestResult(prev => prev + '\n❌ Token request failed: ' + error);
      console.error('Token error:', error);
      return null;
    }
  };
  
  // Test 3: Connect to video room
  const testConnectRoom = async (token: string) => {
    try {
      setConnectionStatus('Connecting to video room...');
      
      const room = await window.Twilio.Video.connect(token, {
        name: 'test-connection',
        audio: false,
        video: { width: 320, height: 240 }
      });
      
      roomRef.current = room;
      setRoomConnected(true);
      setConnectionStatus('✅ Connected to video room');
      setTestResult(prev => prev + '\n✅ Connected to room successfully');
      
      // Handle local video
      const localParticipant = room.localParticipant;
      localParticipant.videoTracks.forEach((publication: any) => {
        if (localVideoRef.current && publication.track) {
          const videoElement = publication.track.attach();
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          localVideoRef.current.appendChild(videoElement);
        }
      });
      
      // Handle room events
      room.on('disconnected', () => {
        setRoomConnected(false);
        setConnectionStatus('Disconnected');
      });
      
    } catch (error) {
      setConnectionStatus('❌ Failed to connect to room');
      setTestResult(prev => prev + '\n❌ Room connection failed: ' + error);
      console.error('Room connection error:', error);
    }
  };
  
  // Run full test
  const runFullTest = async () => {
    setTestResult('Starting connection test...\n');
    
    try {
      // Test 1: Load SDK
      await testLoadSDK();
      if (!window.Twilio) {
        setTestResult(prev => prev + '\n❌ SDK not loaded, stopping test');
        return;
      }
      
      // Test 2: Get Token
      const token = await testGetToken();
      if (!token) {
        setTestResult(prev => prev + '\n❌ No token received, stopping test');
        return;
      }
      
      // Test 3: Connect Room
      await testConnectRoom(token);
      
    } catch (error) {
      setTestResult(prev => prev + '\n❌ Test failed: ' + error);
      setConnectionStatus('❌ Test failed');
    }
  };
  
  const disconnect = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoomConnected(false);
    setConnectionStatus('Disconnected');
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Twilio Video Connection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={runFullTest} 
                disabled={roomConnected}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Run Full Test
              </Button>
              
              {roomConnected && (
                <Button 
                  onClick={disconnect}
                  variant="destructive"
                >
                  Disconnect
                </Button>
              )}
              
              <div className={`px-3 py-1 rounded text-sm ${
                connectionStatus.includes('✅') ? 'bg-green-100 text-green-800' :
                connectionStatus.includes('❌') ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {connectionStatus}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                    {testResult || 'No tests run yet'}
                  </pre>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Local Video</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    ref={localVideoRef}
                    className="w-full h-48 bg-gray-800 rounded flex items-center justify-center text-white"
                  >
                    {!roomConnected && 'Video will appear here when connected'}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {tokenResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Token Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                    {tokenResult}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}