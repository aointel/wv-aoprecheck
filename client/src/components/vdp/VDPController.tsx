import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface VDPStatus {
  producer: string;
  shouldBeOffline: boolean;
  reason: string;
  action: string;
  vdpCommand: string;
}

interface VDPControllerProps {
  agentEmail: string;
  agentId: string;
  states?: string[];
  onStatusChange?: (online: boolean) => void;
}

export function VDPController({ agentEmail, agentId, states = ['NC', 'CA'], onStatusChange }: VDPControllerProps) {
  const [vdpStatus, setVdpStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [lastReason, setLastReason] = useState<string>('');

  // Check VDP status every 30 seconds
  const { data: statusCheck } = useQuery<VDPStatus>({
    queryKey: ['/api/vdp/check-status', agentEmail],
    queryFn: () => fetch(`/api/vdp/check-status/${agentEmail}`, { method: 'POST' }).then(r => r.json()),
    refetchInterval: 30000, // Check every 30 seconds
    enabled: !!agentEmail
  });

  useEffect(() => {
    if (statusCheck) {
      const newStatus = statusCheck.shouldBeOffline ? 'offline' : 'online';
      
      if (newStatus !== vdpStatus) {
        console.log(`🎯 VDP Status Change: ${agentEmail} -> ${newStatus} (${statusCheck.reason})`);
        
        // Execute VDP commands based on status
        if (statusCheck.shouldBeOffline) {
          // Take producer offline
          if (window.TaalkVDP) {
            window.TaalkVDP.close();
            console.log('🎯 Executed: TaalkVDP.close()');
          }
          setVdpStatus('offline');
          setLastReason(statusCheck.reason);
          onStatusChange?.(false);
        } else {
          // Bring producer online
          if (window.TaalkVDP) {
            window.TaalkVDP.open(agentId, { states });
            console.log(`🎯 Executed: TaalkVDP.open('${agentId}', {states: ${JSON.stringify(states)}})`);
          }
          setVdpStatus('online');
          setLastReason(statusCheck.reason);
          onStatusChange?.(true);
        }
      }
    }
  }, [statusCheck, agentEmail, agentId, states, vdpStatus, onStatusChange]);

  // Initialize Taalk VDP script
  useEffect(() => {
    if (!window.TaalkVDPSettings) {
      window.TaalkVDPSettings = {
        APIKey: "pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68",
        container: "#mount-vdp-selector",
        onLoad: function() {
          console.log('🎯 Taalk VDP loaded, opening for producer:', agentId);
          if (window.TaalkVDP) {
            window.TaalkVDP.open(agentId, { states });
          }
        },
        onStatusChange: function(online: boolean) {
          console.log(`🎯 Taalk VDP status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
          setVdpStatus(online ? 'online' : 'offline');
          onStatusChange?.(online);
        }
      };

      // Load Taalk VDP script if not already loaded
      if (!document.getElementById('Taalk_VDP_script')) {
        const script = document.createElement('script');
        script.defer = true;
        script.id = 'Taalk_VDP_script';
        script.src = 'https://lets.taalk.ai/sdk/vdp_client/michaelmandella';
        document.head.appendChild(script);
        
        script.onload = () => {
          console.log('🎯 Taalk VDP script loaded successfully');
        };
      }
    }
  }, [agentId, states, onStatusChange]);

  return (
    <div className="vdp-controller">
      {/* Hidden container for Taalk VDP iframe */}
      <div id="mount-vdp-selector" style={{ display: 'none' }}></div>
      
      {/* VDP Status Display */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${
          vdpStatus === 'online' ? 'bg-green-500' : 
          vdpStatus === 'offline' ? 'bg-red-500' : 
          'bg-gray-400'
        }`}></div>
        <span className="text-gray-600">
          VDP: {vdpStatus.toUpperCase()}
          {lastReason && ` (${lastReason})`}
        </span>
      </div>
    </div>
  );
}

// Extend window object to include Taalk VDP types
declare global {
  interface Window {
    TaalkVDPSettings?: {
      APIKey: string;
      container: string;
      onLoad: () => void;
      onStatusChange: (online: boolean) => void;
    };
    TaalkVDP?: {
      open: (agentId: string, params: { states: string[], market?: any, first_name?: string, last_name?: string }) => void;
      close: () => void;
      disconnect: () => void;
      connect: () => void;
      updateParams: (params: { states: string[] }) => void;
    };
  }
}