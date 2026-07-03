'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Device } from 'twilio-client';
import { useAuth } from '@/hooks/use-auth';

let device: Device | null = null;

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  market: string;
}

export default function CallConnectorPro() {
  const { authState } = useAuth();
  
  // Restrict CallConnectorPro to specific users only
  const allowedUsers = [
    'fayesaad',
    'cnsysop', 
    'chrislafond',
    'leynatran',
    'diankablash',
    'rochellemagpantay',
    'matthewbostic',
    'davidfulfer',
    'melissaelam'
  ];
  
  const currentUserEmail = authState?.user?.email?.toLowerCase();
  const currentUsername = currentUserEmail?.split('@')[0];
  
  if (!currentUsername || !allowedUsers.includes(currentUsername)) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">
          Call Connector Pro is only available to authorized users.
        </p>
      </div>
    );
  }
  
  const [status, setStatus] = useState('Not Connected');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const { toast } = useToast();

  // Fetch leads when markets are selected
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['/api/outbound-dialer/leads', selectedMarkets],
    enabled: selectedMarkets.length > 0,
    select: (data: any) => data.leads || []
  });

  // Power On - exactly like TestCall
  async function powerOn() {
    try {
      const res = await fetch('/api/twilio/token');
      const { token } = await res.json();

      device = new Device(token, { debug: true });
      device.on('ready', () => setStatus('WebRTC Ready'));
      device.on('error', (err: any) => setStatus(`Error: ${err.message}`));
      device.on('disconnect', () => setStatus('Disconnected'));

      (device as any).register();
    } catch (err) {
      console.error(err);
      setStatus('Error powering on');
    }
  }

  // Start Dialing - exactly like TestCall
  async function startDialing() {
    if (!device) return alert('Not ready');
    if (leads.length === 0) return alert('No leads available');
    
    const currentLead = leads[currentLeadIndex];
    if (!currentLead) return;

    device.connect({ To: currentLead.phone });
    setStatus('Calling Lead...');
  }

  // Market selection
  const handleMarketChange = (market: string) => {
    setSelectedMarkets(prev => 
      prev.includes(market) 
        ? prev.filter(m => m !== market)
        : [...prev, market]
    );
  };

  const currentLead = leads[currentLeadIndex];
  const isReady = status === 'WebRTC Ready';
  const canDial = isReady && leads.length > 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Call Connector Pro</h1>
          <div className="flex items-center gap-3">
            <Badge variant={isReady ? "default" : "secondary"}>
              {status}
            </Badge>
            <Button 
              onClick={powerOn}
              variant="secondary"
              size="sm"
              className={`${isReady ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white border-0`}
            >
              {isReady ? 'Power Off' : 'Power On'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Markets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {['Veteran', 'Globe Market', 'Plus', 'Will Kit'].map(market => (
              <label key={market} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedMarkets.includes(market)}
                  onChange={() => handleMarketChange(market)}
                  className="rounded"
                />
                <span>{market}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Current Lead */}
        <Card>
          <CardHeader>
            <CardTitle>Current Lead</CardTitle>
          </CardHeader>
          <CardContent>
            {currentLead ? (
              <div className="space-y-2">
                <p><strong>Name:</strong> {currentLead.firstName} {currentLead.lastName}</p>
                <p><strong>Phone:</strong> {currentLead.phone}</p>
                <p><strong>State:</strong> {currentLead.state}</p>
                <p><strong>Market:</strong> {currentLead.market}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {selectedMarkets.length === 0 ? 'Select markets to load leads' : 'No leads available'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={startDialing}
                disabled={!canDial}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {canDial ? 'Start Dialing' : 'Not Ready'}
              </Button>
              
              {leads.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Lead {currentLeadIndex + 1} of {leads.length}
                </span>
              )}
            </div>

            {leads.length > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentLeadIndex(Math.max(0, currentLeadIndex - 1))}
                  disabled={currentLeadIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentLeadIndex(Math.min(leads.length - 1, currentLeadIndex + 1))}
                  disabled={currentLeadIndex === leads.length - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}