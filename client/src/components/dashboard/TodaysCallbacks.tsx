import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { 
  Phone, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
// import { useAuth } from '@/lib/auth';

interface Callback {
  id: string;
  leadName: string;
  leadPhone: string;
  leadState: string;
  notes: string;
  scheduledFor: string;
  status: string;
  priority: string;
  agentEmail: string;
  createdAt: string;
}

interface TodaysCallbacksProps {
  className?: string;
}

export function TodaysCallbacks({ className = "" }: TodaysCallbacksProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Get user email from multiple auth sources
  const getUserEmail = () => {
    try {
      // Method 1: Try Supabase session storage
      const authData = sessionStorage.getItem('supabase.auth.token');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.user?.email) return parsed.user.email;
      }
      
      // Method 2: Try localStorage
      const localAuth = localStorage.getItem('supabase.auth.token');
      if (localAuth) {
        const parsed = JSON.parse(localAuth);
        if (parsed.user?.email) return parsed.user.email;
      }
      
      // Method 3: Check global auth state
      if (typeof window !== 'undefined' && (window as any).__auth_user__) {
        const user = (window as any).__auth_user__;
        if (user?.email) return user.email;
      }
      
      console.log('📞 No auth found, using fallback email');
    } catch (e) {
      console.log('📞 Auth error:', e);
    }
    return 'martintoma@aoglobelife.com'; // Default for testing
  };
  
  const userEmail = getUserEmail();
  console.log('📞 TodaysCallbacks using email:', userEmail);

  // Fetch callbacks from API
  const { data: callbacks = [], isLoading } = useQuery({
    queryKey: ['/api/callbacks', userEmail],
    queryFn: async (): Promise<Callback[]> => {
      if (!userEmail) return [];
      
      const response = await fetch('/api/callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEmail: userEmail })
      });
      
      if (!response.ok) throw new Error('Failed to fetch callbacks');
      
      const result = await response.json();
      return Array.isArray(result.callbacks) ? result.callbacks : [];
    },
    enabled: !!userEmail
  });

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'Time TBD';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch {
      return 'Date TBD';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-3 w-3" />;
      case 'medium': return <Clock className="h-3 w-3" />;
      default: return <CheckCircle className="h-3 w-3" />;
    }
  };

  const handleCallCallback = (callback: Callback) => {
    // Open dialer with this lead's phone number
    window.open(`/dashboard?call=${callback.leadPhone}`, '_blank');
  };

  const markCallbackComplete = async (callbackId: string) => {
    try {
      const response = await fetch('/api/callbacks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          callbackId,
          status: 'completed'
        })
      });
      
      if (response.ok) {
        // Refresh the callbacks list
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update callback:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            Today's Callbacks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">Loading callbacks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5 text-blue-600" />
          Today's Callbacks
          {callbacks.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {callbacks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {callbacks.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Phone className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No callbacks scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {callbacks.map((callback) => (
              <div
                key={callback.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {callback.leadName}
                      </h4>
                      <Badge 
                        className={`text-xs px-2 py-0.5 ${getPriorityColor(callback.priority)}`}
                      >
                        {getPriorityIcon(callback.priority)}
                        <span className="ml-1 capitalize">{callback.priority}</span>
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {callback.leadPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {callback.leadState}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(callback.scheduledFor)} at {formatTime(callback.scheduledFor)}
                      </div>
                    </div>

                    {callback.notes && (
                      <p className="text-sm text-gray-600 mb-2">
                        {callback.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleCallCallback(callback)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markCallbackComplete(callback.id)}
                    >
                      Complete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}