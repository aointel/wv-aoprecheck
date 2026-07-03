import { useEffect, useRef } from 'react';
import { useAuth } from './use-auth';

export type CallConnectorActivity = 'idle' | 'dialing' | 'ringing' | 'live' | 'wrapping_up';

interface ActivityUpdate {
  agentEmail: string;
  activity: CallConnectorActivity;
  callDetails?: {
    phoneNumber?: string;
    clientName?: string;
    duration?: number;
    direction?: 'inbound' | 'outbound';
  };
}

/**
 * Hook to track Call Connector Pro activity and send updates to backend
 */
export const useCallConnectorActivity = () => {
  const { authState } = useAuth();
  const currentUserEmail = authState?.user?.email?.toLowerCase();
  const currentActivityRef = useRef<CallConnectorActivity>('idle');
  const lastUpdateRef = useRef<number>(0);

  const sendActivityUpdate = async (update: ActivityUpdate) => {
    // Throttle updates - don't send more than once per second
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) {
      return;
    }
    lastUpdateRef.current = now;

    try {
      await fetch('/api/call-connector-pro/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      console.log(`📊 Call Connector Activity: ${update.activity}`, update.callDetails);
    } catch (error) {
      console.error('❌ Failed to send Call Connector activity:', error);
    }
  };

  const updateActivity = (
    activity: CallConnectorActivity, 
    callDetails?: ActivityUpdate['callDetails']
  ) => {
    if (!currentUserEmail) return;

    // Only send if activity actually changed
    if (currentActivityRef.current === activity && activity === 'idle') {
      return;
    }

    currentActivityRef.current = activity;
    
    sendActivityUpdate({
      agentEmail: currentUserEmail,
      activity,
      callDetails
    });
  };

  // Clean up on unmount - send idle status
  useEffect(() => {
    return () => {
      if (currentUserEmail && currentActivityRef.current !== 'idle') {
        sendActivityUpdate({
          agentEmail: currentUserEmail,
          activity: 'idle'
        });
      }
    };
  }, [currentUserEmail]);

  return {
    updateActivity,
    currentActivity: currentActivityRef.current
  };
};

