/**
 * RecruitInboundPanel — real WebRTC inbound panel for /aorecruit.
 * Registers Twilio Device, accepts calls, shows PositionTracker.
 * No Taalk VDP dependency.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { PositionTracker } from '../connectnow/PositionTracker';
import {
  MdPhone,
  MdPerson,
  MdLocationOn,
  MdPhoneInTalk,
} from 'react-icons/md';

interface RecruitInboundPanelProps {
  userEmail: string;
}

export function RecruitInboundPanel({ userEmail }: RecruitInboundPanelProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<'offline'|'registering'|'registered'|'error'>('offline');
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const deviceRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Credits
  const { data: creditData } = useQuery({
    queryKey: ['/api/connectnow/user-credits', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/connectnow/user-credits/${encodeURIComponent(userEmail)}`);
      return res.ok ? res.json() : null;
    },
  });
  const creditsRemaining = (creditData as any)?.credits_remaining ?? '—';

  // Queue position
  const { data: queuePos } = useQuery({
    queryKey: ['/api/connectnow/queue-position', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/connectnow/queue-position/${encodeURIComponent(userEmail)}`);
      return res.ok ? res.json() : null;
    },
    enabled: isOnline,
    refetchInterval: 10000,
  });
  const myPosition = (queuePos as any)?.position ?? 0;
  const myMarket = (queuePos as any)?.market ?? 'aorecruit';
  const totalInMarket = (queuePos as any)?.totalInMarket ?? 0;

  // Register Twilio Device
  const registerDevice = useCallback(async () => {
    try {
      setDeviceStatus('registering');
      
      // Get token from server
      const tokenRes = await fetch(`/api/twilio/token?identity=${encodeURIComponent(userEmail)}`, {
        credentials: 'include',
      });
      if (!tokenRes.ok) {
        console.error('Failed to get Twilio token:', tokenRes.status);
        setDeviceStatus('error');
        return;
      }
      const { token } = await tokenRes.json();
      if (!token) { setDeviceStatus('error'); return; }

      // Load Twilio Device dynamically
      const { Device } = await import('@twilio/voice-sdk');
      
      const device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'] as any,
        enableRingingState: true,
      });

      device.on('registered', () => {
        console.log('✅ Recruit WebRTC: Device registered');
        setDeviceStatus('registered');
      });

      device.on('error', (err: any) => {
        console.error('❌ Recruit WebRTC error:', err);
        setDeviceStatus('error');
      });

      device.on('incoming', (call: any) => {
        console.log('📞 Recruit: Incoming call!', call.parameters);
        setIncomingCall(call);
        
        call.on('accept', () => {
          setActiveCall(call);
          setIncomingCall(null);
          setCallDuration(0);
          timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        });
        
        call.on('disconnect', () => {
          setActiveCall(null);
          setIncomingCall(null);
          if (timerRef.current) clearInterval(timerRef.current);
        });

        call.on('cancel', () => {
          setIncomingCall(null);
        });
      });

      device.on('unregistered', () => {
        setDeviceStatus('offline');
      });

      await device.register();
      deviceRef.current = device;

    } catch (err) {
      console.error('❌ Recruit WebRTC: Failed to register:', err);
      setDeviceStatus('error');
    }
  }, [userEmail]);

  // Toggle online/offline
  const handleToggle = async (online: boolean) => {
    setIsOnline(online);
    try {
      if (online) {
        await fetch('/api/agents/voice-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
        });
        await registerDevice();
      } else {
        await fetch('/api/agents/voice-offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail }),
        });
        if (deviceRef.current) {
          deviceRef.current.unregister();
          deviceRef.current.destroy();
          deviceRef.current = null;
        }
        setDeviceStatus('offline');
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // Heartbeat
  useEffect(() => {
    if (!isOnline || !userEmail) return;
    const send = async () => {
      await fetch('/api/vdp/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) }).catch(() => {});
      await fetch('/api/call-connector-pro/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) }).catch(() => {});
    };
    send();
    const interval = setInterval(send, 30000);
    return () => clearInterval(interval);
  }, [isOnline, userEmail]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.unregister();
        deviceRef.current.destroy();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const acceptCall = () => {
    if (incomingCall) {
      incomingCall.accept();
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
    }
  };

  const hangup = () => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="space-y-3">
      {/* Status + Toggle */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent font-bold">
              Recruit Inbound
            </CardTitle>
            <Badge variant={isOnline ? 'default' : 'secondary'} className={isOnline ? (deviceStatus === 'registered' ? 'bg-green-500' : 'bg-amber-500') : ''}>
              {!isOnline ? '⚫ Offline' : deviceStatus === 'registered' ? '🟢 Online' : deviceStatus === 'registering' ? '🟡 Connecting...' : '🔴 Error'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Accept Recruit Calls</span>
            <Switch checked={isOnline} onCheckedChange={handleToggle} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-bold text-lg">${creditsRemaining}</span>
          </div>
        </CardContent>
      </Card>

      {/* Position Tracker */}
      {isOnline && (
        <Card>
          <CardContent className="pt-4 pb-2">
            <PositionTracker position={myPosition} market={myMarket} totalInMarket={totalInMarket} />
          </CardContent>
        </Card>
      )}

      {/* Incoming Call */}
      {incomingCall && (
        <Card className="border-2 border-green-400 animate-pulse">
          <CardContent className="pt-4 space-y-3">
            <div className="text-center">
              <MdPhoneInTalk className="w-10 h-10 text-green-500 mx-auto animate-bounce" />
              <div className="font-bold text-lg mt-2">Incoming Recruit Call</div>
              <div className="text-sm text-muted-foreground">{incomingCall.parameters?.From || 'Unknown'}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={acceptCall} className="flex-1 bg-green-600 hover:bg-green-700">Accept</Button>
              <Button onClick={rejectCall} variant="destructive" className="flex-1">Decline</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Call */}
      {activeCall && (
        <Card className="border-2 border-green-500">
          <CardContent className="pt-4 space-y-3">
            <div className="text-center">
              <MdPhone className="w-8 h-8 text-green-500 mx-auto" />
              <div className="font-bold text-lg mt-1">Call Connected</div>
              <div className="text-2xl font-mono font-bold text-green-600">{formatDuration(callDuration)}</div>
            </div>
            <Badge className="w-full justify-center bg-green-100 text-green-700">RECRUIT — <span className="line-through text-gray-400">$5.00</span> <span className="ml-1 font-bold text-green-700">$0</span></Badge>
            <Button onClick={hangup} variant="destructive" className="w-full">Hang Up</Button>
          </CardContent>
        </Card>
      )}

      {/* Idle state */}
      {isOnline && !incomingCall && !activeCall && (
        <div className="text-center text-sm text-muted-foreground py-2">
          {deviceStatus === 'registered' ? 'Waiting for recruit transfers...' : 'Connecting to call system...'}
        </div>
      )}
      {!isOnline && (
        <div className="text-center text-sm text-muted-foreground py-2">
          Toggle online to receive recruit candidates
        </div>
      )}
    </div>
  );
}
