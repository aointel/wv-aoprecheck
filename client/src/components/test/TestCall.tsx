'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

let device: any = null;

export default function TestCall() {
  const [status, setStatus] = useState('Not Connected');

  async function powerOn() {
    try {
          const identity = "producer123";
    const res = await fetch(`/api/token?identity=${identity}`);
    const token = await res.text();
      console.log('TestCall Token:', token?.substring(0, 50) + '...');
      console.log('TestCall Token length:', token?.length);

      const Device = (window as any).Twilio.Device;
      device = new Device(token, { debug: true });
      device.on('ready', () => setStatus('WebRTC Ready'));
      device.on('error', (err: any) => setStatus(`Error: ${err.message}`));
      device.on('disconnect', () => setStatus('Disconnected'));

      device.register();
    } catch (err) {
      console.error(err);
      setStatus('Error powering on');
    }
  }

  async function callLead() {
    if (!device) return alert('Not ready');
    device.connect({ To: '+15032018470' }); // Replace with dynamic number if needed
    setStatus('Calling Lead...');
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Simple WebRTC Test</h2>
      <p>Status: {status}</p>
      <Button onClick={powerOn} className="mr-4">Power On</Button>
      <Button onClick={callLead}>Call Lead</Button>
    </div>
  );
}