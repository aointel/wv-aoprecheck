import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Download, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HotleadStats {
  totalActive: number;
  assigned: number;
  unassigned: number;
  syncInProgress: boolean;
}

interface SyncResult {
  success: boolean;
  message: string;
  newCount: number;
  updateCount: number;
  error?: string;
}

export default function HotleadAdmin() {
  const [stats, setStats] = useState<HotleadStats>({
    totalActive: 0,
    assigned: 0,
    unassigned: 0,
    syncInProgress: false
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const { toast } = useToast();

  // Fetch current stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/hotleads/status');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching hotlead stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual sync
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/hotleads/sync', {
        method: 'POST'
      });
      const data: SyncResult = await response.json();
      
      if (data.success) {
        toast({
          title: "Sync Completed",
          description: data.message,
          variant: "default"
        });
        setLastSync(new Date().toLocaleTimeString());
        fetchStats(); // Refresh stats
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: "Failed to connect to sync service",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Force sync
  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/hotleads/force-sync', {
        method: 'POST'
      });
      const data: SyncResult = await response.json();
      
      if (data.success) {
        toast({
          title: "Force Sync Completed",
          description: data.message,
          variant: "default"
        });
        setLastSync(new Date().toLocaleTimeString());
        fetchStats(); // Refresh stats
      } else {
        toast({
          title: "Force Sync Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Force Sync Error",
        description: "Failed to connect to sync service",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Hotlead Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor and manage Taalk API hotlead synchronization
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground">
              Active hotleads in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Badge variant="secondary">{stats.assigned}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.assigned}
            </div>
            <p className="text-xs text-muted-foreground">
              Hotleads assigned to producers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Badge variant="outline">{stats.unassigned}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.unassigned}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            {stats.syncInProgress && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={stats.syncInProgress ? "default" : "secondary"}>
                {stats.syncInProgress ? "Running" : "Idle"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated sync status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Controls
          </CardTitle>
          <CardDescription>
            Manually trigger hotlead synchronization from Taalk API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleManualSync}
              disabled={syncing || stats.syncInProgress}
              variant="default"
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Manual Sync
            </Button>
            
            <Button 
              onClick={handleForceSync}
              disabled={syncing || stats.syncInProgress}
              variant="outline"
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Force Sync
            </Button>
            
            <Button 
              onClick={fetchStats}
              variant="ghost"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Stats
            </Button>
          </div>
          
          {lastSync && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last sync: {lastSync}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Info */}
      <Card>
        <CardHeader>
          <CardTitle>Automated Scheduler</CardTitle>
          <CardDescription>
            Hotleads are automatically synchronized every 15 minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Sync Frequency:</span>
              <Badge variant="secondary">Every 15 minutes</Badge>
            </div>
            <div className="flex justify-between">
              <span>Assignment Frequency:</span>
              <Badge variant="secondary">Every hour</Badge>
            </div>
            <div className="flex justify-between">
              <span>API Source:</span>
              <Badge variant="outline">Taalk API</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}