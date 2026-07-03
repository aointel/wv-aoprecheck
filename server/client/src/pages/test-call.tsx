'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

let device: any = null;

export default function TestCall() {
  const [status, setStatus] = useState('Not Connected');

  async function powerOn() {
    try {
      console.log('🔌 Power On clicked - starting...');
      setStatus('Fetching token...');
      
      const res = await fetch('https://fa855ff1-b744-4328-a040-2d5dabde8d4e-00-2d2vz6z45709c.spock.replit.dev/api/twilio/token');
      const { token } = await res.json();
      console.log('✅ Token received:', token?.slice(0, 50) + '...');
      setStatus('Token received, initializing...');

      // Use global Twilio Device from CDN
      const Device = (window as any).Twilio?.Device;
      console.log('🔍 Twilio SDK check:', { Device, Twilio: (window as any).Twilio });
      
      if (!Device) {
        console.error('❌ Twilio SDK not found');
        setStatus('Twilio SDK not loaded');
        return;
      }

      console.log('🚀 Creating Twilio Device...');
      device = new Device(token, { debug: true });
      
      // Set up event listeners BEFORE registering
      device.on('ready', () => {
        console.log('✅ WebRTC Device Ready');
        setStatus('✅ WebRTC Device Registered');
      });
      
      device.on('error', (err: any) => {
        console.error('❌ Device Error:', err);
        setStatus(`Error: ${err.message}`);
      });
      
      device.on('disconnect', () => {
        console.log('📞 Device Disconnected');
        setStatus('Disconnected');
      });

      device.on('connect', (call: any) => {
        console.log('📞 Device connect event:', call);
        setStatus('Call in progress...');
      });

      device.on('incoming', (call: any) => {
        console.log('📞 Incoming call:', call);
      });

      device.on('registered', () => {
        console.log('🎯 Device registered successfully');
        setStatus('Device Registered - Ready to Call');
      });

      device.on('unregistered', () => {
        console.log('📴 Device unregistered');
        setStatus('Device Unregistered');
      });

      // Add registration timeout
      const registrationTimeout = setTimeout(() => {
        console.error('⏰ Registration timeout after 10 seconds');
        setStatus('Registration timeout - check network/firewall');
      }, 10000);

      console.log('📡 Registering device...');
      setStatus('Registering device...');
      
      // Call register() but don't await it - events will handle success/failure
      device.register();
      
      // Clear timeout when ready event fires
      device.on('ready', () => {
        clearTimeout(registrationTimeout);
      });
    } catch (err) {
      console.error('💥 Power On Error:', err);
      setStatus(`Error powering on: ${err}`);
    }
  }

  async function callLead() {
    if (!device) {
      console.error('❌ Device not ready for calling');
      alert('Device not ready - click Power On first');
      return;
    }
    
    console.log('📞 Starting call to +15032018470...');
    setStatus('Calling Lead...');
    
    try {
      // For Twilio Voice SDK v2, device.connect returns a call object
      const call = device.connect({ To: '+15032018470' });
      console.log('✅ Call initiated:', call);
      
      // Set up call event listeners if the call object exists
      if (call && typeof call.on === 'function') {
        console.log('✅ Call object has event listeners');
        call.on('accept', () => {
          console.log('✅ Call accepted');
          setStatus('Call Connected');
        });
        
        call.on('disconnect', () => {
          console.log('📞 Call ended');
          setStatus('Call Ended');
        });
        
        call.on('cancel', () => {
          console.log('📞 Call cancelled');
          setStatus('Call Cancelled');
        });
        
        call.on('error', (err: any) => {
          console.error('❌ Call Error:', err);
          setStatus(`Call Error: ${err.message}`);
        });
        
        call.on('ringing', () => {
          console.log('📞 Call ringing');
          setStatus('Call Ringing...');
        });
      } else {
        // If no call object returned, check device events
        console.log('📋 No call object returned, listening on device events');
        setStatus('Call initiated - waiting for TwiML response');
      }
      
    } catch (err) {
      console.error('💥 Call Error:', err);
      setStatus(`Call failed: ${err}`);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Simple WebRTC Test</h2>
      <p>Status: {status}</p>
      <div className="mb-4">
        <p>Network Info:</p>
        <p>Protocol: {window.location.protocol}</p>
        <p>Host: {window.location.host}</p>
        <p>User Agent: {navigator.userAgent.slice(0, 100)}...</p>
      </div>
      <Button onClick={powerOn} className="mr-4 bg-blue-500 hover:bg-blue-600">Power On</Button>
      <Button onClick={callLead} className="bg-green-500 hover:bg-green-600">Call Lead</Button>
      <Button 
        onClick={() => {
          if (device) {
            console.log('Device state:', device.state);
            console.log('Device status:', device.status);
            setStatus(`Device state: ${device.state}, Status: ${device.status}`);
          } else {
            setStatus('No device created yet');
          }
        }} 
        className="ml-4 bg-yellow-500 hover:bg-yellow-600"
      >
        Check Status
      </Button>
    </div>
  );
}