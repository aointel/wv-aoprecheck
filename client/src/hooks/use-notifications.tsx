import { useState, useEffect, useCallback } from 'react';
import { Notification } from '@/components/notifications/NotificationCenter';

interface NotificationService {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  checkWaitingRoomJoins: () => void;
  checkUpcomingAppointments: () => void;
  checkLowCredits: (credits: number) => void;
}

export const useNotifications = (userEmail?: string): NotificationService => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-dismiss non-urgent notifications after 10 seconds
    if (!newNotification.urgent) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 10000);
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const checkWaitingRoomJoins = useCallback(() => {
    // This would be called when someone joins the waiting room
    // Implementation would check WebSocket events or API
    const checkForWaitingClients = async () => {
      try {
        const response = await fetch('/api/video/waiting-clients');
        if (response.ok) {
          const clients = await response.json();
          
          clients.forEach((client: any) => {
            // Check if we already notified about this client
            const existingNotification = notifications.find(n => 
              n.type === 'waiting_room' && 
              n.metadata?.clientId === client.id
            );

            if (!existingNotification) {
              addNotification({
                type: 'waiting_room',
                title: 'Client Waiting',
                message: `${client.name} has joined your video waiting room`,
                urgent: true,
                actionUrl: `/video-waiting-room?room=${client.roomId}`,
                metadata: { clientId: client.id, clientName: client.name }
              });
            }
          });
        }
      } catch (error) {
        console.error('Failed to check waiting room:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkForWaitingClients, 30000);
    checkForWaitingClients(); // Check immediately

    return () => clearInterval(interval);
  }, [addNotification, notifications]);

  const checkUpcomingAppointments = useCallback(() => {
    const checkAppointments = async () => {
      try {
        const url = userEmail
          ? `/api/appointments/upcoming?agentEmail=${encodeURIComponent(userEmail)}`
          : '/api/appointments/upcoming';
        const response = await fetch(url, {
          credentials: 'include',
        });
        if (response.ok) {
          const appointments = await response.json();
          
          appointments.forEach((appointment: any) => {
            const appointmentTime = new Date(appointment.dateTime);
            const now = new Date();
            const timeDiff = appointmentTime.getTime() - now.getTime();
            const minutesUntil = Math.floor(timeDiff / (1000 * 60));

            // Notify 15 minutes before appointment
            if (minutesUntil === 15 || minutesUntil === 5) {
              addNotification({
                type: 'appointment',
                title: 'Upcoming Appointment',
                message: `Meeting with ${appointment.clientName} in ${minutesUntil} minutes`,
                urgent: minutesUntil <= 5,
                actionUrl: `/appointments`,
                metadata: { appointmentId: appointment.id, clientName: appointment.clientName }
              });
            }
          });
        }
      } catch (error) {
        console.error('Failed to check appointments:', error);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkAppointments, 5 * 60 * 1000);
    checkAppointments(); // Check immediately

    return () => clearInterval(interval);
  }, [addNotification, userEmail]);

  const checkLowCredits = useCallback((credits: number, forceCheck = false) => {
    // Enhanced logging to debug false triggers
    console.log('🔍 checkLowCredits called with credits:', credits, 'force:', forceCheck);
    
    // Validate credits is a valid number
    if (typeof credits !== 'number' || isNaN(credits) || credits < 0) {
      console.log('❌ Invalid credits value, skipping notification');
      return;
    }

    // Disable automatic credit warnings unless explicitly forced
    if (!forceCheck) {
      console.log('🚫 Automatic credit checks disabled to prevent false notifications');
      return;
    }

    // Don't spam notifications - only show if credits just hit threshold
    const existingLowCreditsNotification = notifications.find(n => 
      n.type === 'low_credits' && !n.read
    );

    console.log('📊 Credit check:', {
      credits,
      hasExistingNotification: !!existingLowCreditsNotification,
      shouldTriggerLowWarning: credits <= 10 && credits > 0,
      shouldTriggerZeroWarning: credits === 0
    });

    // Only trigger notifications for genuinely low credits
    if (credits <= 10 && credits > 0 && !existingLowCreditsNotification) {
      console.log('⚠️ Triggering low credits notification for', credits, 'credits');
      addNotification({
        type: 'low_credits',
        title: 'Low Credits Warning',
        message: `You have ${credits} credits remaining. Consider purchasing more to avoid service interruption.`,
        urgent: credits <= 5,
        actionUrl: '/dashboard/billing-dashboard',
        metadata: { creditsRemaining: credits }
      });
    } else if (credits === 0 && !existingLowCreditsNotification) {
      console.log('🚨 Triggering zero credits notification');
      addNotification({
        type: 'low_credits',
        title: 'No Credits Remaining',
        message: 'Your credits have been depleted. Purchase more credits to continue using services.',
        urgent: true,
        actionUrl: '/dashboard/billing-dashboard',
        metadata: { creditsRemaining: 0 }
      });
    } else {
      console.log('✅ Credits sufficient (' + credits + '), no notification needed');
    }
  }, [addNotification, notifications]);

  // WebSocket for real-time notifications - DISABLED due to false notification triggers
  // The WebSocket connection was causing false credit warnings and other notification issues
  useEffect(() => {
    console.log('📢 WebSocket notifications disabled to prevent false triggers');
    return () => {}; // No cleanup needed
  }, []);

  // Clean up old notifications (older than 24 hours)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setNotifications(prev => 
        prev.filter(n => n.timestamp > oneDayAgo)
      );
    }, 60 * 60 * 1000); // Clean up every hour

    return () => clearInterval(cleanup);
  }, []);

  return {
    notifications,
    addNotification,
    markAsRead,
    dismiss,
    clearAll,
    checkWaitingRoomJoins,
    checkUpcomingAppointments,
    checkLowCredits
  };
};

export default useNotifications;