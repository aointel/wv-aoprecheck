import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

// Simple device management following TestCall pattern exactly
let device: any = null;

export default function OutboundDialerInterface() {
  const { toast } = useToast();
  const { authState } = useAuth();
  const [status, setStatus] = useState('Not Connected');
  const [leads, setLeads] = useState<any[]>([]);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);

  // Fetch leads
  const { data: leadsData } = useQuery({
    queryKey: ['/api/outbound-dialer/leads'],
    queryFn: async () => {
      const response = await fetch('/api/outbound-dialer/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markets: ['masterlead'],
          userEmail: authState.user?.email || 'cnsysop@aoglobelife.com'
        })
      });
      const data = await response.json();
      return data.leads || [];
    }
  });

  useEffect(() => {
    if (leadsData) {
      setLeads(leadsData);
    }
  }, [leadsData]);

  async function powerOn() {
    try {
      const res = await fetch('/api/twilio/token');
      const { token } = await res.json();

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
    if (!device) return toast({ title: 'Not Ready', description: 'Device not ready', variant: 'destructive' });
    
    const currentLead = leads[currentLeadIndex];
    if (!currentLead) return toast({ title: 'No Lead', description: 'No lead available', variant: 'destructive' });

    device.connect({ To: currentLead.phone });
    setStatus('Calling Lead...');
    toast({ title: 'Calling', description: `Calling ${currentLead.first_name} ${currentLead.last_name}` });
  }

  const currentLead = leads[currentLeadIndex];

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Call Connector Pro</h2>
      <p>Status: {status}</p>
      
      <div className="flex gap-4">
        <Button onClick={powerOn}>Power On</Button>
        <Button onClick={callLead}>Call Lead</Button>
      </div>

      {currentLead && (
        <div className="p-4 border rounded">
          <h3 className="font-semibold">{currentLead.first_name} {currentLead.last_name}</h3>
          <p>{currentLead.phone}</p>
          <p>{currentLead.city}, {currentLead.state}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={() => setCurrentLeadIndex(Math.max(0, currentLeadIndex - 1))}
          disabled={currentLeadIndex === 0}
        >
          Previous
        </Button>
        <Button 
          onClick={() => setCurrentLeadIndex(Math.min(leads.length - 1, currentLeadIndex + 1))}
          disabled={currentLeadIndex >= leads.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}