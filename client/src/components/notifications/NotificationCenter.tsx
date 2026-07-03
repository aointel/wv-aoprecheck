import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  X, 
  Video, 
  Calendar, 
  DollarSign, 
  UserPlus, 
  Clock,
  AlertTriangle,
  Check,
  MessageCircle
} from 'lucide-react';

export interface Notification {
  id: string;
  type: 'waiting_room' | 'appointment' | 'low_credits' | 'message' | 'system' | 'recruit' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  urgent: boolean;
  actionUrl?: string;
  metadata?: any;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'waiting_room':
      return <Video className="w-4 h-4 text-blue-600" />;
    case 'appointment':
      return <Calendar className="w-4 h-4 text-green-600" />;
    case 'low_credits':
      return <DollarSign className="w-4 h-4 text-orange-600" />;
    case 'message':
      return <MessageCircle className="w-4 h-4 text-purple-600" />;
    case 'recruit':
      return <UserPlus className="w-4 h-4 text-indigo-600" />;
    case 'success':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'system':
    default:
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  }
};

const getNotificationColor = (type: Notification['type'], urgent: boolean) => {
  if (urgent) return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20';
  
  switch (type) {
    case 'waiting_room':
      return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20';
    case 'appointment':
      return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20';
    case 'low_credits':
      return 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20';
    case 'message':
      return 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20';
    case 'recruit':
      return 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/20';
    case 'success':
      return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20';
    default:
      return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
  }
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onDismiss,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => n.urgent && !n.read).length;

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge 
            variant={urgentCount > 0 ? "destructive" : "default"}
            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notification Panel */}
          <Card className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden z-50 shadow-lg border">
            <div className="p-4 border-b bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Notifications</h3>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearAll}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No new notifications</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                        getNotificationColor(notification.type, notification.urgent)
                      } ${!notification.read ? 'opacity-100' : 'opacity-75'}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1 ml-2">
                              {notification.urgent && (
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                              )}
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(notification.timestamp)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(notification.id);
                              }}
                              className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;