import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface CallTrackingData {
  trackingId: string | null;
  isTracking: boolean;
  duration: number;
  startTime: Date | null;
}

interface UseCallTrackingReturn {
  callTracking: CallTrackingData;
  startCallTracking: (callType: 'voice' | 'video' | 'conference', callId: string, options?: {
    leadPhone?: string;
    leadName?: string;
    platform?: string;
  }) => Promise<void>;
  endCallTracking: () => Promise<void>;
  startVideoTracking: (meetingId: string, meetingType: 'whereby' | 'zoom' | 'aoi-meet', options?: {
    roomUrl?: string;
    hostRoomUrl?: string;
    leadName?: string;
    leadPhone?: string;
  }) => Promise<void>;
  endVideoTracking: () => Promise<void>;
}

export function useCallTracking(): UseCallTrackingReturn {
  const { user } = useAuth();
  const { toast } = useToast();

  const [callTracking, setCallTracking] = useState<CallTrackingData>({
    trackingId: null,
    isTracking: false,
    duration: 0,
    startTime: null,
  });

  const [videoTracking, setVideoTracking] = useState<CallTrackingData>({
    trackingId: null,
    isTracking: false,
    duration: 0,
    startTime: null,
  });

  const startCallTracking = useCallback(async (
    callType: 'voice' | 'video' | 'conference',
    callId: string,
    options: {
      leadPhone?: string;
      leadName?: string;
      platform?: string;
    } = {}
  ) => {
    if (!user?.email) {
      console.warn('⚠️ No user email available for call tracking');
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/billing/call/start', {
        callType,
        callId,
        userEmail: user.email,
        leadPhone: options.leadPhone,
        leadName: options.leadName,
        platform: options.platform || 'twilio',
      });

      const { trackingId } = response;
      const startTime = new Date();

      setCallTracking({
        trackingId,
        isTracking: true,
        duration: 0,
        startTime,
      });

      console.log(`📞 Started call tracking: ${trackingId}`);
    } catch (error) {
      console.error('❌ Failed to start call tracking:', error);
      toast({
        title: 'Call Tracking Error',
        description: 'Failed to start call minute tracking',
        variant: 'destructive',
      });
    }
  }, [user?.email, toast]);

  const endCallTracking = useCallback(async () => {
    if (!callTracking.trackingId) {
      console.warn('⚠️ No active call tracking to end');
      return;
    }

    try {
      await apiRequest('POST', `/api/billing/call/end/${callTracking.trackingId}`, {});

      const endTime = new Date();
      const duration = callTracking.startTime
        ? Math.floor((endTime.getTime() - callTracking.startTime.getTime()) / 1000)
        : 0;

      setCallTracking({
        trackingId: null,
        isTracking: false,
        duration,
        startTime: null,
      });

      const minutes = Math.ceil(duration / 60);
      console.log(`📞 Ended call tracking: ${minutes} minutes`);

      toast({
        title: 'Call Completed',
        description: `Call duration: ${minutes} minute${minutes !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('❌ Failed to end call tracking:', error);
      toast({
        title: 'Call Tracking Error',
        description: 'Failed to end call tracking',
        variant: 'destructive',
      });
    }
  }, [callTracking.trackingId, callTracking.startTime, toast]);

  const startVideoTracking = useCallback(async (
    meetingId: string,
    meetingType: 'whereby' | 'zoom' | 'aoi-meet',
    options: {
      roomUrl?: string;
      hostRoomUrl?: string;
      leadName?: string;
      leadPhone?: string;
    } = {}
  ) => {
    if (!user?.email) {
      console.warn('⚠️ No user email available for video tracking');
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/billing/video/start', {
        meetingId,
        meetingType,
        userEmail: user.email,
        roomUrl: options.roomUrl,
        hostRoomUrl: options.hostRoomUrl,
        leadName: options.leadName,
        leadPhone: options.leadPhone,
      });

      const { trackingId } = response;
      const startTime = new Date();

      setVideoTracking({
        trackingId,
        isTracking: true,
        duration: 0,
        startTime,
      });

      console.log(`🎥 Started video tracking: ${trackingId}`);
    } catch (error) {
      console.error('❌ Failed to start video tracking:', error);
      toast({
        title: 'Video Tracking Error',
        description: 'Failed to start video minute tracking',
        variant: 'destructive',
      });
    }
  }, [user?.email, toast]);

  const endVideoTracking = useCallback(async () => {
    if (!videoTracking.trackingId) {
      console.warn('⚠️ No active video tracking to end');
      return;
    }

    try {
      await apiRequest('POST', `/api/billing/video/end/${videoTracking.trackingId}`, {});

      const endTime = new Date();
      const duration = videoTracking.startTime
        ? Math.floor((endTime.getTime() - videoTracking.startTime.getTime()) / 1000)
        : 0;

      setVideoTracking({
        trackingId: null,
        isTracking: false,
        duration,
        startTime: null,
      });

      const minutes = Math.ceil(duration / 60);
      console.log(`🎥 Ended video tracking: ${minutes} minutes`);

      toast({
        title: 'Video Meeting Completed',
        description: `Meeting duration: ${minutes} minute${minutes !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('❌ Failed to end video tracking:', error);
      toast({
        title: 'Video Tracking Error',
        description: 'Failed to end video tracking',
        variant: 'destructive',
      });
    }
  }, [videoTracking.trackingId, videoTracking.startTime, toast]);

  return {
    callTracking: callTracking.isTracking ? callTracking : videoTracking,
    startCallTracking,
    endCallTracking,
    startVideoTracking,
    endVideoTracking,
  };
}

// Usage Statistics Hook
export function useUsageStats(userEmail?: string) {
  const { user } = useAuth();
  const email = userEmail || user?.email;

  const fetchUsageStats = async () => {
    if (!email) return null;

    try {
      const response = await apiRequest('GET', `/api/billing/current-usage/${email}`, {});
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch usage stats:', error);
      return null;
    }
  };

  return { fetchUsageStats };
}