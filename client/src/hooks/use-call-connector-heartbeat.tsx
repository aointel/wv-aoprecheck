import { useEffect, useRef } from 'react';
import { useAuth } from './use-auth';

/**
 * Call Connector Pro Heartbeat Hook
 * Sends heartbeat to server every 30 seconds to track Active Producers
 * Use this hook in the Call Connector Pro component
 */
export function useCallConnectorHeartbeat(enabled: boolean = true) {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const sessionIdRef = useRef(Date.now().toString());

  useEffect(() => {
    if (!enabled || !user?.email) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/call-connector-pro/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail: user.email,
            sessionId: sessionIdRef.current
          })
        });
        console.log('💓 Call Connector heartbeat sent');
      } catch (error) {
        console.error('❌ Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat immediately
    sendHeartbeat();

    // Then send heartbeat every 30 seconds
    intervalRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, user?.email]);

  return {
    sessionId: sessionIdRef.current
  };
}

