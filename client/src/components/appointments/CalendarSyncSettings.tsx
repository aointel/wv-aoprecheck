import React, { useState } from 'react';
import { Calendar, ExternalLink, Settings, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface CalendarSyncSettingsProps {
  onClose?: () => void;
}

interface CalendarConnection {
  provider: 'outlook' | 'gmail' | 'zoom';
  connected: boolean;
  email?: string;
  lastSync?: string;
  syncEnabled: boolean;
}

export function CalendarSyncSettings({ onClose }: CalendarSyncSettingsProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Fetch current calendar connections
  const { data: connections, isLoading } = useQuery<CalendarConnection[]>({
    queryKey: ['/api/calendar/connections', authState.user?.email],
    enabled: !!authState.user?.email,
  });

  // Connect to external calendar
  const connectCalendarMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      setIsConnecting(provider);
      const response = await apiRequest('POST', '/api/calendar/connect', { provider });
      return response;
    },
    onSuccess: (data, variables) => {
      if (data.authUrl) {
        // Open OAuth flow in new window
        const popup = window.open(data.authUrl, 'calendar-auth', 'width=600,height=600');
        
        // Listen for completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(null);
            queryClient.invalidateQueries({ queryKey: ['/api/calendar/connections'] });
            toast({
              title: "Calendar Connected",
              description: `Successfully connected to ${variables.provider}`,
            });
          }
        }, 1000);
      }
    },
    onError: (error) => {
      setIsConnecting(null);
      toast({
        title: "Connection Failed",
        description: "Could not connect to calendar provider",
        variant: "destructive",
      });
    },
  });

  // Disconnect calendar
  const disconnectCalendarMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      return apiRequest('DELETE', `/api/calendar/disconnect/${provider}`);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/connections'] });
      toast({
        title: "Calendar Disconnected",
        description: `Disconnected from ${variables.provider}`,
      });
    },
  });

  // Toggle sync
  const toggleSyncMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/calendar/sync-settings`, { provider, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/connections'] });
    },
  });

  // Manual sync
  const manualSyncMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      return apiRequest('POST', `/api/calendar/sync/${provider}`);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/connections'] });
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${variables.provider} calendar`,
      });
    },
  });

  const getConnectionStatus = (provider: string) => {
    return connections?.find(conn => conn.provider === provider);
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading calendar settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Calendar Sync Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your external calendars to sync appointments and avoid conflicts
        </p>
      </div>

      {/* Outlook Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Microsoft Outlook</CardTitle>
                <CardDescription>
                  Sync with Outlook calendar and meetings
                </CardDescription>
              </div>
            </div>
            {getConnectionStatus('outlook')?.connected ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {getConnectionStatus('outlook')?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="outlook-sync">Enable automatic sync</Label>
                <Switch
                  id="outlook-sync"
                  checked={getConnectionStatus('outlook')?.syncEnabled || false}
                  onCheckedChange={(enabled) => 
                    toggleSyncMutation.mutate({ provider: 'outlook', enabled })
                  }
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Connected: {getConnectionStatus('outlook')?.email}<br />
                Last sync: {formatLastSync(getConnectionStatus('outlook')?.lastSync)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => manualSyncMutation.mutate({ provider: 'outlook' })}
                  disabled={manualSyncMutation.isPending}
                >
                  {manualSyncMutation.isPending ? (
                    <Loader className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Calendar className="h-3 w-3 mr-1" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectCalendarMutation.mutate({ provider: 'outlook' })}
                  disabled={disconnectCalendarMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => connectCalendarMutation.mutate({ provider: 'outlook' })}
              disabled={isConnecting === 'outlook'}
              className="w-full"
            >
              {isConnecting === 'outlook' ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Outlook Calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Gmail Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle>Google Calendar</CardTitle>
                <CardDescription>
                  Add appointments directly to Google Calendar
                </CardDescription>
              </div>
            </div>
            {getConnectionStatus('gmail')?.connected ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {getConnectionStatus('gmail')?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="gmail-sync">Enable automatic sync</Label>
                <Switch
                  id="gmail-sync"
                  checked={getConnectionStatus('gmail')?.syncEnabled || false}
                  onCheckedChange={(enabled) => 
                    toggleSyncMutation.mutate({ provider: 'gmail', enabled })
                  }
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Connected: {getConnectionStatus('gmail')?.email}<br />
                Last sync: {formatLastSync(getConnectionStatus('gmail')?.lastSync)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => manualSyncMutation.mutate({ provider: 'gmail' })}
                  disabled={manualSyncMutation.isPending}
                >
                  {manualSyncMutation.isPending ? (
                    <Loader className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Calendar className="h-3 w-3 mr-1" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectCalendarMutation.mutate({ provider: 'gmail' })}
                  disabled={disconnectCalendarMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => connectCalendarMutation.mutate({ provider: 'gmail' })}
              disabled={isConnecting === 'gmail'}
              className="w-full"
            >
              {isConnecting === 'gmail' ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Google Calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Zoom Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Zoom Meetings</CardTitle>
                <CardDescription>
                  Connect Zoom account for video meetings
                </CardDescription>
              </div>
            </div>
            {getConnectionStatus('zoom')?.connected ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {getConnectionStatus('zoom')?.connected ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Connected: {getConnectionStatus('zoom')?.email}<br />
                Zoom meetings available for scheduling
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectCalendarMutation.mutate({ provider: 'zoom' })}
                disabled={disconnectCalendarMutation.isPending}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => connectCalendarMutation.mutate({ provider: 'zoom' })}
              disabled={isConnecting === 'zoom'}
              className="w-full"
            >
              {isConnecting === 'zoom' ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Zoom Account
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Close Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}