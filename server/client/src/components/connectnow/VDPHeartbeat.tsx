import React, { useEffect, useRef } from 'react';

interface VDPHeartbeatProps {
  userEmail: string;
  isActive: boolean;
}

export default function VDPHeartbeat({ userEmail, isActive }: VDPHeartbeatProps): JSX.Element | null {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const sendHeartbeat = async () => {
    if (!isActive || !userEmail) return;

    try {
      const response = await fetch('/api/vdp/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        lastHeartbeatRef.current = Date.now();
        console.log('🟢 VDP Heartbeat sent successfully');
      } else {
        console.error('❌ VDP Heartbeat failed:', response.status);
      }
    } catch (error) {
      console.error('❌ VDP Heartbeat error:', error);
    }
  };

  const handleVisibilityChange = () => {
    const isVisible = !document.hidden;
    isVisibleRef.current = isVisible;

    if (isVisible && isActive) {
      // Window regained focus - send immediate heartbeat
      console.log('🔄 Window focused - sending immediate heartbeat');
      sendHeartbeat();
      
      // Restart regular interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(sendHeartbeat, 30000); // 30 seconds
    } else if (!isVisible) {
      // Window lost focus - reduce heartbeat frequency but don't stop
      console.log('⏸️ Window unfocused - reducing heartbeat frequency');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Send heartbeat every 2 minutes when window is not visible
      intervalRef.current = setInterval(sendHeartbeat, 120000); // 2 minutes
    }
  };

  const handleWindowFocus = () => {
    if (isActive) {
      console.log('🔄 Window focus event - sending heartbeat');
      sendHeartbeat();
    }
  };

  const handleWindowBlur = () => {
    console.log('⏸️ Window blur event');
  };

  useEffect(() => {
    if (!isActive || !userEmail) return;

    // Initial heartbeat
    sendHeartbeat();

    // Set up regular heartbeat interval
    intervalRef.current = setInterval(sendHeartbeat, 30000); // 30 seconds

    // Listen for window visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isActive, userEmail]);

  // This component doesn't render anything visible
  return null;
}