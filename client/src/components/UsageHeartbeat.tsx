/**
 * Usage Heartbeat Component
 * Sends heartbeat every 60 seconds to track online time
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function UsageHeartbeat() {
  const { authState } = useAuth();
  const hasCalledOnlineRef = useRef(false);

  useEffect(() => {
    console.log(`💓 UsageHeartbeat: useEffect triggered, user:`, authState.user?.email || 'none');
    
    if (!authState.user?.email) {
      console.warn('⚠️ UsageHeartbeat: No user email, component will not send heartbeats');
      return;
    }

    const sessionId = `session-${Date.now()}`;
    
    // CRITICAL: Call explicit "agent online" endpoint when user first logs in
    // This is the missing piece - explicit "I'm online" event
    if (!hasCalledOnlineRef.current) {
      hasCalledOnlineRef.current = true;
      
      const setAgentOnline = async () => {
        try {
          const response = await fetch('/api/agent/online', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent_email: authState.user?.email
            })
          });
          
          const data = await response.json();
          if (data.success) {
            console.log(`✅ Agent ONLINE status sent to Supabase: ${authState.user?.email}`);
          } else {
            console.warn(`⚠️ Agent online status skipped: ${data.message || 'Unknown reason'}`);
          }
        } catch (error) {
          console.error('❌ Failed to set agent online:', error);
        }
      };
      
      // Call immediately when user is detected
      setAgentOnline();
    }
    
    // Send initial heartbeat
    const sendHeartbeat = async () => {
      if (!authState.user?.email) {
        console.warn('⚠️ UsageHeartbeat: No user email, skipping heartbeat');
        return;
      }
      
      try {
        console.log(`💓 UsageHeartbeat: Sending heartbeat for ${authState.user.email}`);
        const response = await fetch('/api/usage/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail: authState.user.email,
            sessionId
          })
        });
          
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ UsageHeartbeat failed: ${response.status} - ${errorText}`);
          return;
        }
        
        const data = await response.json();
        console.log(`✅ UsageHeartbeat sent successfully:`, data);
      } catch (error) {
        console.error('❌ UsageHeartbeat error:', error);
      }
    };

    // Send heartbeat immediately
    console.log(`💓 UsageHeartbeat: Component mounted for ${authState.user?.email || 'no user'}`);
    sendHeartbeat();

    // Then every 60 seconds
    const interval = setInterval(sendHeartbeat, 60 * 1000);
    console.log(`💓 UsageHeartbeat: Interval set for 60 seconds`);

    return () => {
      clearInterval(interval);
      // Reset flag when user logs out
      hasCalledOnlineRef.current = false;
    };
  }, [authState.user?.email]);

  return null; // This component doesn't render anything
}

