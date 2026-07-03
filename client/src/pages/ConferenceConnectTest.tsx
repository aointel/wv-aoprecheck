import React, { useState, useRef, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';

export default function ConferenceConnectTest() {
  const [agentId, setAgentId] = useState('test-agent');
  const [sessionId] = useState(() => `test-${Date.now()}`);
  const [phoneNumber, setPhoneNumber] = useState('+15032018470');
  const [agentAudioStatus, setAgentAudioStatus] = useState<'offline'|'token_loading'|'device_ready'|'connecting'|'connected'|'disconnected'|'failed'>('offline');
  const [leadCallStatus, setLeadCallStatus] = useState<'idle'|'dialing'|'ringing'|'connected'|'completed'|'failed'>('idle');
  const [conferenceName, setConferenceName] = useState('');
  const [activeLeadCallSid, setActiveLeadCallSid] = useState('');
  const [lastEvent, setLastEvent] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const deviceRef = useRef<Device | null>(null);
  const pollRef = useRef<any>(null);

  const log = (msg: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(entry);
    setLogs(prev => [entry, ...prev].slice(0, 200));
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/connect/status?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`);
        const d = await r.json();
        if (d.ok) {
          setLeadCallStatus(d.leadCallStatus);
          setActiveLeadCallSid(d.activeLeadCallSid || '');
          setConferenceName(d.conferenceName || '');
          setLastEvent(d.lastEvent || '');
        }
      } catch {}
    }, 1000);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handlePowerOn = async () => {
    try {
      setAgentAudioStatus('token_loading');
      log('Fetching Twilio token...');
      const tokenRes = await fetch(`/api/twilio/token?identity=${encodeURIComponent(agentId)}`);
      const tokenData = await tokenRes.json();
      const token = tokenData.token || tokenData.accessToken;
      if (!token) throw new Error('No token returned: ' + JSON.stringify(tokenData));
      log('Token received, creating Device...');
      setAgentAudioStatus('device_ready');

      const device = new Device(token, { logLevel: 1 });
      deviceRef.current = device;

      device.on('error', (err: any) => {
        log('Device error: ' + err.message);
        setAgentAudioStatus('failed');
        stopPolling();
      });

      await device.register();
      log('Device registered, connecting to conference...');
      setAgentAudioStatus('connecting');

      const call = await device.connect({
        params: { agentId, sessionId }
      });

      call.on('accept', () => {
        log('Call accepted - agent connected to conference');
        setAgentAudioStatus('connected');
        startPolling();
      });
      call.on('disconnect', () => {
        log('Call disconnected');
        setAgentAudioStatus('disconnected');
        stopPolling();
      });
      call.on('error', (err: any) => {
        log('Call error: ' + err.message);
        setAgentAudioStatus('failed');
        stopPolling();
      });

    } catch (err: any) {
      log('Power On error: ' + err.message);
      setAgentAudioStatus('failed');
    }
  };

  const handleDial = async () => {
    if (!phoneNumber) { log('Enter a phone number first'); return; }
    try {
      setLeadCallStatus('dialing');
      log(`Dialing ${phoneNumber}...`);
      const r = await fetch('/api/connect/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionId, phoneNumber }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Dial failed');
      setActiveLeadCallSid(d.callSid || '');
      setConferenceName(d.conferenceName || '');
      log(`Dial initiated - callSid: ${d.callSid}`);
    } catch (err: any) {
      log('Dial error: ' + err.message);
      setLeadCallStatus('failed');
    }
  };

  const handleEndLead = async () => {
    try {
      log('Ending lead call...');
      const r = await fetch('/api/connect/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionId }),
      });
      const d = await r.json();
      log('End lead response: ' + JSON.stringify(d));
    } catch (err: any) {
      log('End lead error: ' + err.message);
    }
  };

  const handleRefresh = async () => {
    try {
      const r = await fetch(`/api/connect/status?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`);
      const d = await r.json();
      if (d.ok) {
        setLeadCallStatus(d.leadCallStatus);
        setActiveLeadCallSid(d.activeLeadCallSid || '');
        setConferenceName(d.conferenceName || '');
        setLastEvent(d.lastEvent || '');
        log('Status refreshed: ' + JSON.stringify({ leadCallStatus: d.leadCallStatus, agentStatus: d.agentStatus, lastEvent: d.lastEvent }));
      }
    } catch (err: any) {
      log('Refresh error: ' + err.message);
    }
  };

  const handlePowerOff = async () => {
    try {
      stopPolling();
      log('Powering off...');
      await fetch('/api/connect/power-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionId }),
      });
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      setAgentAudioStatus('offline');
      setLeadCallStatus('idle');
      setActiveLeadCallSid('');
      log('Powered off');
    } catch (err: any) {
      log('Power off error: ' + err.message);
    }
  };

  const canDial = agentAudioStatus === 'connected' && ['idle','completed','failed'].includes(leadCallStatus);
  const canEnd = ['dialing','ringing','connected'].includes(leadCallStatus);
  const canPowerOn = ['offline','disconnected','failed'].includes(agentAudioStatus);

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '800px' }}>
      <h2>Conference Connect Test</h2>

      <section style={{ marginBottom: '16px', border: '1px solid #ccc', padding: '12px' }}>
        <h3>Agent Session</h3>
        <div>agentId: <input value={agentId} onChange={e => setAgentId(e.target.value)} style={{ width: '200px' }} /></div>
        <div>sessionId: <code>{sessionId}</code></div>
        <div>agentAudioStatus: <strong>{agentAudioStatus}</strong></div>
        <div>conferenceName: <code>{conferenceName || '(none)'}</code></div>
      </section>

      <section style={{ marginBottom: '16px', border: '1px solid #ccc', padding: '12px' }}>
        <h3>Lead Call</h3>
        <div>phoneNumber: <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder='+12065551234' style={{ width: '200px' }} /></div>
        <div>leadCallStatus: <strong>{leadCallStatus}</strong></div>
        <div>activeLeadCallSid: <code>{activeLeadCallSid || '(none)'}</code></div>
        <div>lastEvent: <code>{lastEvent || '(none)'}</code></div>
      </section>

      <section style={{ marginBottom: '16px' }}>
        <h3>Controls</h3>
        <button onClick={handlePowerOn} disabled={!canPowerOn} style={{ marginRight: '8px' }}>Power On</button>
        <button onClick={handlePowerOff} disabled={agentAudioStatus === 'offline'} style={{ marginRight: '8px' }}>Power Off</button>
        <button onClick={handleDial} disabled={!canDial} style={{ marginRight: '8px' }}>Dial Number</button>
        <button onClick={handleEndLead} disabled={!canEnd} style={{ marginRight: '8px' }}>End Lead Call</button>
        <button onClick={handleRefresh} style={{ marginRight: '8px' }}>Refresh Status</button>
      </section>

      <section>
        <h3>Logs</h3>
        <div style={{ height: '300px', overflow: 'auto', background: '#f5f5f5', padding: '8px', fontSize: '12px' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </section>
    </div>
  );
}
