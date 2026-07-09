import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  AlertCircle, 
  ArrowDownToLine, 
  ArrowUpToLine, 
  Check, 
  CloudOff, 
  Database, 
  FileText,
  RefreshCw, 
  Server, 
  Upload,
  X
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface SupabaseStatusResponse {
  connected: boolean;
  tables: Record<string, boolean>;
  message: string;
}

interface TableSetupResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    status: 'success' | 'error';
    message?: string;
  }>;
}

interface TtaalkImportResponse {
  success: boolean;
  message: string;
  result: {
    imported: number;
    synced: number;
    errors: string[];
  };
}

const CallSyncPanel = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncToSupabase, setSyncToSupabase] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    inProgress: false,
    completed: 0,
    total: 0,
    message: ""
  });

  // Query to get Supabase connection status
  const { 
    data: statusData, 
    isLoading: statusLoading, 
    error: statusError,
    refetch: refetchStatus
  } = useQuery<SupabaseStatusResponse>({
    queryKey: ["/api/sync/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sync/status");
      return await response.json();
    }
  });
  
  // Mutation for setting up the Supabase tables
  const setupTablesMutation = useMutation<TableSetupResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/setup-tables");
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Tables setup complete" : "Tables setup completed with errors",
        description: `${data.successful} of ${data.total} statements executed successfully.`,
        variant: data.success ? "default" : "destructive"
      });
      refetchStatus();
    },
    onError: (error) => {
      toast({
        title: "Tables setup failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation for syncing calls to Supabase
  const syncCallsMutation = useMutation<{success: boolean, count: number}, Error>({
    mutationFn: async () => {
      setSyncStatus({ inProgress: true, completed: 0, total: 0, message: "Starting sync..." });
      const response = await apiRequest("POST", "/api/sync/calls");
      return await response.json();
    },
    onSuccess: (data) => {
      setSyncStatus({ inProgress: false, completed: 0, total: 0, message: "" });
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.count} calls to Supabase.`,
        variant: "default"
      });
      refetchStatus();
    },
    onError: (error) => {
      setSyncStatus({ inProgress: false, completed: 0, total: 0, message: "" });
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation for importing TTaalk CSV data
  const importTtaalkMutation = useMutation<TtaalkImportResponse, Error>({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }
      
      setSyncStatus({ 
        inProgress: true, 
        completed: 0, 
        total: 0, 
        message: "Uploading and processing TTaalk CSV..." 
      });
      
      const formData = new FormData();
      formData.append('csvFile', selectedFile);
      formData.append('syncToSupabase', syncToSupabase.toString());
      
      const response = await fetch('/api/sync/import-ttaalk', {
        method: 'POST',
        body: formData,
      });
      
      return await response.json();
    },
    onSuccess: (data) => {
      setSyncStatus({ inProgress: false, completed: 0, total: 0, message: "" });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "TTaalk Import Completed",
        description: `Imported: ${data.result.imported} calls, Synced to Supabase: ${data.result.synced}`,
        variant: data.success ? "default" : "destructive",
      });
      
      if (data.result.errors.length > 0) {
        console.error("Import errors:", data.result.errors);
      }
      
      // Refresh data after import
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
    },
    onError: (error) => {
      setSyncStatus({ inProgress: false, completed: 0, total: 0, message: "" });
      toast({
        title: "TTaalk Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };
  
  // Trigger file input click
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Listen for progress updates from the server using EventSource
  useEffect(() => {
    if (syncStatus.inProgress) {
      const eventSource = new EventSource("/api/sync/progress");
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          setSyncStatus({
            inProgress: true,
            completed: data.completed,
            total: data.total,
            message: data.message || ""
          });
        } else if (data.type === "complete") {
          eventSource.close();
          setSyncStatus({
            inProgress: false,
            completed: data.total,
            total: data.total,
            message: "Complete"
          });
        }
      };
      
      eventSource.onerror = () => {
        console.error("EventSource error");
        eventSource.close();
        setSyncStatus(prev => ({...prev, inProgress: false}));
      };
      
      return () => {
        eventSource.close();
      };
    }
  }, [syncStatus.inProgress]);
  
  const isConnected = statusData?.connected || false;
  const tableStatus = statusData?.tables || {};
  const tablesExist = Object.values(tableStatus).some(exists => exists);
  const allTablesExist = Object.values(tableStatus).every(exists => exists);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-purple-500" />
            <span>Supabase Integration</span>
          </CardTitle>
          <CardDescription>
            Manage synchronization between local database and Supabase
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Import TTaalk CSV Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Import TTaalk CSV Data</h3>
            
            <div className="border border-dashed border-border rounded-lg p-6 bg-muted/30 space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  type="button"
                  onClick={handleFileSelect}
                  disabled={importTtaalkMutation.isPending}
                  variant="secondary"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {selectedFile ? 'Change File' : 'Select CSV File'}
                </Button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
                
                {selectedFile && (
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                )}
              </div>
              
              {selectedFile && (
                <>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-to-supabase"
                      checked={syncToSupabase}
                      onCheckedChange={setSyncToSupabase}
                    />
                    <Label htmlFor="sync-to-supabase">
                      Also sync imported calls to Supabase
                    </Label>
                  </div>
                  
                  <Button
                    onClick={() => importTtaalkMutation.mutate()}
                    disabled={importTtaalkMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {importTtaalkMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import TTaalk Data
                      </>
                    )}
                  </Button>
                </>
              )}
              
              {!selectedFile && (
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    Upload a TTaalk CSV file to import call data. This will create or update calls in the local database.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />
          
          {/* Connection Status */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              {isConnected ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <CloudOff className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => refetchStatus()}
              disabled={statusLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${statusLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {statusError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Connection Error</p>
                <p className="text-sm text-red-600">{statusError.message}</p>
              </div>
            </div>
          )}
          
          {/* Table Status */}
          {isConnected && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Supabase Tables Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(tableStatus).map(([table, exists]) => (
                  <div key={table} className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-md">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{table}</span>
                    </div>
                    {exists ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 hover:bg-green-500/10">
                        <Check className="h-3 w-3 mr-1" /> Exists
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-700 hover:bg-red-500/10">
                        <X className="h-3 w-3 mr-1" /> Missing
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Setup Tables Section */}
          {isConnected && !allTablesExist && (
            <div className="space-y-3 pt-4">
              <Separator />
              <h3 className="text-sm font-medium text-muted-foreground">Database Setup</h3>
              <p className="text-sm text-muted-foreground">
                Some tables are missing in Supabase. You need to set up the tables before you can sync data.
              </p>
              <Button 
                onClick={() => setupTablesMutation.mutate()}
                disabled={setupTablesMutation.isPending}
                className="w-full sm:w-auto"
              >
                {setupTablesMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Setting up tables...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Create Supabase Tables
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Sync Controls */}
          {isConnected && tablesExist && (
            <div className="space-y-4 pt-4">
              <Separator />
              <h3 className="text-sm font-medium text-muted-foreground">Sync Controls</h3>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => syncCallsMutation.mutate()}
                  disabled={syncCallsMutation.isPending || !allTablesExist}
                >
                  <ArrowUpToLine className="h-4 w-4 mr-2" />
                  Sync Calls to Supabase
                </Button>
                
                <Button 
                  variant="outline"
                  disabled={true}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Import from Supabase
                </Button>
              </div>
              
              {syncStatus.inProgress && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Syncing data to Supabase...</span>
                    <span>{syncStatus.completed} of {syncStatus.total}</span>
                  </div>
                  <Progress 
                    value={syncStatus.total ? (syncStatus.completed / syncStatus.total) * 100 : 0} 
                    className="h-2" 
                  />
                  <p className="text-xs text-muted-foreground">
                    {syncStatus.message}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 items-start sm:items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Last sync status check: {new Date().toLocaleTimeString()}
          </p>
          <Button variant="ghost" size="sm" onClick={() => refetchStatus()}>Refresh Status</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CallSyncPanel;