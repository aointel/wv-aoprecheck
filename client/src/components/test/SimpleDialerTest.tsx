'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

let device: any = null;

export default function SimpleDialerTest() {
  const [status, setStatus] = useState('Not Connected');

  async function powerOn() {
    try {
      console.log('🔌 Power button clicked!');
      
      // Check if Twilio SDK is loaded
      if (!(window as any).Twilio) {
        console.error('❌ Twilio SDK not loaded');
        setStatus('Twilio SDK not loaded');
        return;
      }
      
      console.log('✅ Twilio SDK found, getting token...');
          const identity = "producer123";
    const res = await fetch(`/api/token?identity=${identity}`);
    const token = await res.text();
      console.log('✅ Token received:', token?.substring(0, 50) + '...');
      console.log('✅ Token length:', token?.length);

      const Device = (window as any).Twilio.Device;
      device = new Device(token, { debug: true });
      device.on('ready', () => {
        console.log('WebRTC Ready');
        setStatus('WebRTC Ready');
      });
      device.on('error', (err: any) => {
        console.log(`Error: ${err.message}`);
        setStatus(`Error: ${err.message}`);
      });
      device.on('disconnect', () => {
        console.log('Disconnected');
        setStatus('Disconnected');
      });

      console.log('🔌 Registering device...');
      device.register();
    } catch (err) {
      console.error('❌ PowerOn error:', err);
      setStatus('Error powering on');
    }
  }

  async function callLead() {
    if (!device) return alert('Not ready');
    device.connect({ To: '+15032018470' });
    setStatus('Calling Lead...');
  }

  return (
    <div style={{ padding: '2rem', border: '2px solid blue', margin: '1rem' }}>
      <h2>Simple Dialer Test (Copy of TestCall)</h2>
      <p>Status: {status}</p>
      <Button onClick={powerOn} className="mr-4">Power On</Button>
      <Button onClick={callLead}>Call Lead</Button>
    </div>
  );
}