import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Monitor, 
  Wifi, 
  Server, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Shield,
  Database
} from 'lucide-react';

interface DiagnosticData {
  timestamp: string;
  userproducer: string;
  windowsVersion?: string;
  firewallStatus: 'enabled' | 'disabled' | 'unknown';
  antivirusActive: boolean;
  networkLatency: number;
  serverResponse: number;
  databaseConnection: boolean;
  webrtcSupport: boolean;
  consecutiveFailures: number;
  lastError?: string;
}

interface AdminDiagnosticPanelProps {
  email: string;
  isVisible: boolean;
}

export function AdminDiagnosticPanel({ email, isVisible }: AdminDiagnosticPanelProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedproducer, setSelectedproducer] = useState<string>(email);

  const runDiagnostics = async () => {
    if (!selectedproducer) return;
    
    setIsRunning(true);
    const startTime = Date.now();
    
    try {
      // Comprehensive diagnostics for admin view
      const diagnosticTests = await Promise.allSettled([
        // Test 1: Server connectivity
        fetch('/api/ping').then(r => ({ server: r.ok, time: Date.now() - startTime })),
        
        // Test 2: Database connection
        fetch(`/api/connectnow/user-credits/${selectedproducer}`).then(r => ({ database: r.ok || r.status === 304 })),
        
        // Test 3: WebRTC support check
        Promise.resolve({ webrtc: !!(window as any).RTCPeerConnection }),
        
        // Test 4: Connection health
        fetch('/api/connection-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: selectedproducer, userproducer: navigator.userproducer })
        }).then(r => r.ok ? r.json() : null)
      ]);

      const results = diagnosticTests.map(test => 
        test.status === 'fulfilled' ? test.value : null
      );

      const newDiagnostic: DiagnosticData = {
        timestamp: new Date().toISOString(),
        userproducer: navigator.userproducer,
        firewallStatus: 'unknown',
        antivirusActive: false,
        networkLatency: results[0]?.time || 0,
        serverResponse: results[0]?.server ? 200 : 500,
        databaseConnection: results[1]?.database || false,
        webrtcSupport: results[2]?.webrtc || false,
        consecutiveFailures: results.filter(r => !r).length,
        lastError: results.some(r => !r) ? 'Connection test failed' : undefined
      };

      setDiagnostics(prev => [newDiagnostic, ...prev.slice(0, 9)]); // Keep last 10 diagnostics
      
    } catch (error) {
      console.error('Diagnostic test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run diagnostics when panel opens
  useEffect(() => {
    if (isVisible && selectedproducer) {
      runDiagnostics();
      
      // Auto-refresh every 30 seconds when visible
      const interval = setInterval(runDiagnostics, 30000);
      return () => clearInterval(interval);
    }
  }, [isVisible, selectedproducer]);

  if (!isVisible) return null;

  const latestDiagnostic = diagnostics[0];
  const hasIssues = latestDiagnostic && (
    latestDiagnostic.consecutiveFailures > 0 || 
    !latestDiagnostic.databaseConnection ||
    latestDiagnostic.networkLatency > 3000
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          System Diagnostics
          <Badge variant="outline" className="ml-2">Admin Only</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={selectedproducer}
            onChange={(e) => setSelectedproducer(e.target.value)}
            placeholder="Producer Email to test"
            className="px-3 py-1 border rounded text-sm flex-1"
          />
          <Button size="sm" onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Run Test'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {latestDiagnostic && (
              <>
                {hasIssues && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Issues detected for {selectedproducer}</strong>
                      <div className="mt-2 text-sm">
                        {!latestDiagnostic.databaseConnection && '• Database connection failed'}
                        {latestDiagnostic.networkLatency > 3000 && '• High network latency detected'}
                        {latestDiagnostic.consecutiveFailures > 2 && '• Multiple consecutive failures'}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 p-3 border rounded">
                    <Server className={`h-4 w-4 ${latestDiagnostic.serverResponse === 200 ? 'text-green-500' : 'text-red-500'}`} />
                    <div>
                      <div className="text-sm font-medium">Server</div>
                      <div className="text-xs text-gray-500">
                        {latestDiagnostic.serverResponse === 200 ? 'Online' : 'Error'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded">
                    <Database className={`h-4 w-4 ${latestDiagnostic.databaseConnection ? 'text-green-500' : 'text-red-500'}`} />
                    <div>
                      <div className="text-sm font-medium">Database</div>
                      <div className="text-xs text-gray-500">
                        {latestDiagnostic.databaseConnection ? 'Connected' : 'Failed'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded">
                    <Clock className={`h-4 w-4 ${latestDiagnostic.networkLatency < 1000 ? 'text-green-500' : 'text-yellow-500'}`} />
                    <div>
                      <div className="text-sm font-medium">Latency</div>
                      <div className="text-xs text-gray-500">
                        {latestDiagnostic.networkLatency}ms
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded">
                    <Wifi className={`h-4 w-4 ${latestDiagnostic.webrtcSupport ? 'text-green-500' : 'text-red-500'}`} />
                    <div>
                      <div className="text-sm font-medium">WebRTC</div>
                      <div className="text-xs text-gray-500">
                        {latestDiagnostic.webrtcSupport ? 'Supported' : 'Not supported'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {latestDiagnostic && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>User producer:</strong>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs break-all">
                      {latestDiagnostic.userproducer}
                    </div>
                  </div>
                  <div>
                    <strong>Last Test:</strong>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                      {new Date(latestDiagnostic.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                {latestDiagnostic.lastError && (
                  <div>
                    <strong className="text-red-600">Error Details:</strong>
                    <div className="mt-1 p-2 bg-red-50 rounded text-xs text-red-600">
                      {latestDiagnostic.lastError}
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <h4 className="font-medium text-blue-800 mb-2">Troubleshooting Recommendations:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {!latestDiagnostic.databaseConnection && (
                      <li>• Database connection issue - check producer's network connectivity</li>
                    )}
                    {latestDiagnostic.networkLatency > 3000 && (
                      <li>• High latency detected - producer may have slow internet connection</li>
                    )}
                    {!latestDiagnostic.webrtcSupport && (
                      <li>• WebRTC not supported - producer needs to update browser</li>
                    )}
                    {latestDiagnostic.consecutiveFailures > 2 && (
                      <li>• Multiple failures - possible firewall/antivirus blocking</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-2">
              {diagnostics.map((diagnostic, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {diagnostic.consecutiveFailures === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(diagnostic.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {diagnostic.networkLatency}ms • {diagnostic.consecutiveFailures} failures
                      </div>
                    </div>
                  </div>
                  <Badge variant={diagnostic.consecutiveFailures === 0 ? "default" : "secondary"}>
                    {diagnostic.consecutiveFailures === 0 ? 'Healthy' : 'Issues'}
                  </Badge>
                </div>
              ))}
              {diagnostics.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No diagnostic data available. Click "Run Test" to start monitoring.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}