import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CameraPermissionTest() {
  const [permissionStatus, setPermissionStatus] = useState('Not requested');
  const [streamActive, setStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestPermissions = async () => {
    try {
      setPermissionStatus('Requesting permissions...');
      console.log('Requesting camera permissions...');
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      
      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      
      console.log('Camera permissions granted, stream:', stream);
      streamRef.current = stream;
      setPermissionStatus('✅ Permissions granted');
      setStreamActive(true);
      
      // Display video stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('Video playing');
      }
      
    } catch (error: any) {
      console.error('Permission error:', error);
      
      if (error.name === 'NotAllowedError') {
        setPermissionStatus('❌ Camera access denied - Please allow camera access in browser settings');
      } else if (error.name === 'NotFoundError') {
        setPermissionStatus('❌ No camera found');
      } else if (error.name === 'NotSupportedError') {
        setPermissionStatus('❌ Camera not supported');
      } else {
        setPermissionStatus('❌ Error: ' + error.message);
      }
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
    setPermissionStatus('Stream stopped');
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const testTwilioVideo = async () => {
    if (!streamActive) {
      alert('Please enable camera first');
      return;
    }
    
    try {
      setPermissionStatus('Testing Twilio Video...');
      
      // Get token
      const response = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identity: 'TestUser',
          room: 'permission-test' 
        })
      });
      
      const data = await response.json();
      
      // Load Twilio SDK if not loaded
      if (!window.Twilio) {
        const script = document.createElement('script');
        script.src = 'https://media.twiliocdn.com/sdk/js/video/releases/2.20.0/twilio-video.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }
      
      // Connect to room
      const room = await window.Twilio.Video.connect(data.token, {
        name: 'permission-test',
        audio: true,
        video: { width: 640, height: 480 }
      });
      
      setPermissionStatus('✅ Twilio Video connected successfully!');
      
      // Auto disconnect after 5 seconds
      setTimeout(() => {
        room.disconnect();
        setPermissionStatus('✅ Twilio Video test completed');
      }, 5000);
      
    } catch (error) {
      setPermissionStatus('❌ Twilio Video failed: ' + error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Camera Permission & Video Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button 
                onClick={requestPermissions} 
                disabled={streamActive}
                className="bg-green-600 hover:bg-green-700"
              >
                {streamActive ? 'Camera Active' : 'Enable Camera'}
              </Button>
              
              {streamActive && (
                <>
                  <Button 
                    onClick={stopStream}
                    variant="destructive"
                  >
                    Stop Camera
                  </Button>
                  
                  <Button 
                    onClick={testTwilioVideo}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Test Twilio Video
                  </Button>
                </>
              )}
            </div>
            
            <div className={`p-3 rounded text-sm ${
              permissionStatus.includes('✅') ? 'bg-green-100 text-green-800' :
              permissionStatus.includes('❌') ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              Status: {permissionStatus}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Camera Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <video 
                    ref={videoRef}
                    className="w-full h-48 bg-gray-800 rounded"
                    muted
                    playsInline
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Instructions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>1. Click "Enable Camera" to request permissions</p>
                  <p>2. Your browser will ask for camera/mic access - click "Allow"</p>
                  <p>3. You should see your camera feed in the preview</p>
                  <p>4. Click "Test Twilio Video" to test the full video calling system</p>
                  <p className="text-gray-600 mt-4">
                    If camera access is denied, you'll need to:
                    • Click the camera icon in your browser's address bar
                    • Select "Always allow" for this site
                    • Refresh the page and try again
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    Twilio: any;
  }
}