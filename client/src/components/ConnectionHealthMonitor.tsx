import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Wifi, Shield, Clock, RefreshCw } from 'lucide-react';

interface HealthStatus {
  timestamp: string;
  email: string;
  overall_status: 'healthy' | 'warning' | 'error';
  issues: string[];
  recommendations: string[];
  tests: {
    api_connectivity: 'pass' | 'fail' | 'warning';
    database_access: 'pass' | 'fail' | 'warning';
    websocket_support: 'pass' | 'fail' | 'warning';
    browser_compatibility: 'pass' | 'fail' | 'warning';
    network_latency: 'normal' | 'slow' | 'warning';
  };
}

interface ConnectionHealthMonitorProps {
  email: string;
  autoCheck?: boolean;
  showMinimal?: boolean;
}

export function ConnectionHealthMonitor({ 
  email, 
  autoCheck = true, 
  showMinimal = false 
}: ConnectionHealthMonitorProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [failedRequests, setFailedRequests] = useState(0);
  const [requestTimes, setRequestTimes] = useState<number[]>([]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'normal':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
      case 'error':
      case 'slow':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const runHealthCheck = async () => {
    if (!email) return;
    
    setIsChecking(true);
    const startTime = Date.now();
    
    try {
      // Track request timing for latency analysis
      const response = await fetch('/api/connection-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userproducer: navigator.userproducer,
          timestamp: new Date().toISOString(),
          testResults: {
            failedRequests,
            requestTime: requestTimes.length > 0 ? requestTimes[requestTimes.length - 1] : 0
          }
        }),
      });

      const requestTime = Date.now() - startTime;
      setRequestTimes(prev => [...prev.slice(-9), requestTime]); // Keep last 10 request times

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const status = await response.json();
      setHealthStatus(status);
      setLastCheck(new Date());
      setFailedRequests(0); // Reset on successful request
      
    } catch (error) {
      console.error('Health check failed:', error);
      setFailedRequests(prev => prev + 1);
      
      // Only create error status if we have multiple failures (be less aggressive)
      if (failedRequests >= 2) {
        setHealthStatus({
          timestamp: new Date().toISOString(),
          email,
          overall_status: 'warning', // Use warning instead of error for less drama
          issues: ['Connection issues detected'],
          recommendations: [
            'Multiple connection attempts failed',
            '1. Check your internet connection',
            '2. Try refreshing the page',
            '3. Contact support if issues persist'
          ],
          tests: {
            api_connectivity: 'warning',
            database_access: 'warning',
            websocket_support: 'warning',
            browser_compatibility: 'pass',
            network_latency: 'warning'
          }
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check connection health periodically
  useEffect(() => {
    if (autoCheck && email) {
      runHealthCheck();
      
      // Check every 2 minutes
      const interval = setInterval(runHealthCheck, 120000);
      return () => clearInterval(interval);
    }
  }, [email, autoCheck]);

  // Ping test every 30 seconds for quick connectivity check
  useEffect(() => {
    if (!email) return;

    const pingTest = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch('/api/ping');
        const requestTime = Date.now() - startTime;
        
        if (response.ok) {
          setRequestTimes(prev => [...prev.slice(-9), requestTime]);
          // Reset failed requests on successful ping
          if (failedRequests > 0) {
            setFailedRequests(0);
          }
        } else {
          setFailedRequests(prev => prev + 1);
        }
      } catch (error) {
        // Only increment on actual errors, not JSON parsing issues
        if (error.message && !error.message.includes('json')) {
          setFailedRequests(prev => prev + 1);
        }
      }
    };

    const pingInterval = setInterval(pingTest, 30000);
    return () => clearInterval(pingInterval);
  }, [email, failedRequests]);

  if (showMinimal) {
    // Minimal display - just show status badge
    if (!healthStatus) return null;
    
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon(healthStatus.overall_status)}
        <Badge className={getStatusColor(healthStatus.overall_status)}>
          {healthStatus.overall_status === 'healthy' ? 'Connected' : 
           healthStatus.overall_status === 'warning' ? 'Issues Detected' : 
           'Connection Problem'}
        </Badge>
        {(healthStatus.overall_status === 'warning' || healthStatus.overall_status === 'error') && (
          <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={isChecking}>
            {isChecking ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Fix'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="connection-health-monitor">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Connection Health
        </h3>
        <div className="flex items-center gap-2">
          {lastCheck && (
            <span className="text-sm text-gray-500">
              Last check: {lastCheck.toLocaleTimeString()}
            </span>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={runHealthCheck} 
            disabled={isChecking}
            data-testid="button-health-check"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isChecking ? 'Checking...' : 'Check Now'}
          </Button>
        </div>
      </div>

      {healthStatus && (
        <div className="space-y-4">
          {/* Overall Status */}
          <Alert className={`border-2 ${getStatusColor(healthStatus.overall_status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(healthStatus.overall_status)}
              <AlertDescription className="font-medium">
                {healthStatus.overall_status === 'healthy' && 'All systems operational'}
                {healthStatus.overall_status === 'warning' && 'Minor issues detected'}
                {healthStatus.overall_status === 'error' && 'Connection issues detected'}
              </AlertDescription>
            </div>
          </Alert>

          {/* Test Results */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 border rounded">
              {getStatusIcon(healthStatus.tests.api_connectivity)}
              <span className="text-sm">API Connection</span>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              {getStatusIcon(healthStatus.tests.database_access)}
              <span className="text-sm">Database Access</span>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              {getStatusIcon(healthStatus.tests.browser_compatibility)}
              <span className="text-sm">Browser Support</span>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              {getStatusIcon(healthStatus.tests.network_latency)}
              <span className="text-sm">Network Speed</span>
            </div>
          </div>

          {/* Issues and Recommendations */}
          {healthStatus.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Issues Detected:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                {healthStatus.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {healthStatus.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-blue-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Troubleshooting Steps:
              </h4>
              <div className="space-y-1 text-sm">
                {healthStatus.recommendations.map((rec, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded ${
                      rec.includes('🔥') ? 'bg-red-50 text-red-700 font-medium' : 
                      rec.includes('✅') ? 'bg-green-50 text-green-700' : 
                      'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Stats */}
          {requestTimes.length > 0 && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Average response time: {Math.round(requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length)}ms
              {failedRequests > 0 && (
                <span className="text-red-500 font-medium">
                  • {failedRequests} failed request{failedRequests > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}