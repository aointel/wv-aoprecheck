import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneOff, Phone, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MissedCallNotification {
  id: string;
  leadName: string;
  phone: string;
  timestamp: string;
  agentId: string;
}

interface MissedCallNotificationProps {
  notification: MissedCallNotification;
  onDismiss: (id: string) => void;
  onCallNow: (phone: string) => void;
}

export function MissedCallNotificationCard({ 
  notification, 
  onDismiss, 
  onCallNow 
}: MissedCallNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleCallNow = () => {
    onCallNow(notification.phone);
    onDismiss(notification.id);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(notification.id), 300); // Allow animation to complete
  };

  if (!isVisible) return null;

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 shadow-lg animate-in slide-in-from-right duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <PhoneOff className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-red-700 dark:text-red-400">
                Missed Call - {notification.leadName}
              </h4>
              <p className="text-sm text-red-600 dark:text-red-500">
                {notification.phone}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handleCallNow}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid={`button-call-now-${notification.phone}`}
            >
              <Phone className="h-3 w-3 mr-1" />
              Call
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-red-600"
              data-testid={`button-dismiss-${notification.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MissedCallNotificationCenter() {
  const [notifications, setNotifications] = useState<MissedCallNotification[]>([]);
  const { toast } = useToast();

  // Simulate receiving missed call notifications
  useEffect(() => {
    const simulateNotifications = () => {
      // In real implementation, this would come from WebSocket or polling
      const newNotification: MissedCallNotification = {
        id: `missed-${Date.now()}`,
        leadName: 'John Doe',
        phone: '+15551234567',
        timestamp: new Date().toISOString(),
        agentId: 'current-producer'
      };

      setNotifications(prev => [newNotification, ...prev].slice(0, 5)); // Keep only 5 most recent
      
      // Show toast notification
      toast({
        title: "Missed Call Alert",
        description: `You missed a call from ${newNotification.leadName} (${newNotification.phone})`,
        variant: "destructive"
      });
    };

    // For demo purposes, don't auto-generate notifications
    // Uncomment to test: const interval = setInterval(simulateNotifications, 30000);
    // return () => clearInterval(interval);
  }, [toast]);

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleCallNow = (phone: string) => {
    // Trigger call
    window.location.href = `tel:${phone}`;
    
    toast({
      title: "Initiating Call",
      description: `Calling ${phone}...`
    });
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map(notification => (
        <MissedCallNotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
          onCallNow={handleCallNow}
        />
      ))}
    </div>
  );
}