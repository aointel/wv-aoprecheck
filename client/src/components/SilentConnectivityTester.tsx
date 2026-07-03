import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ConnectivityStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  consecutiveFailures: number;
  averageResponseTime: number;
  windowsAccessOk: boolean;
  serverReachable: boolean;
}

interface SilentConnectivityTesterProps {
  email: string;
  onIssueDetected?: (issueType: 'windows' | 'network' | 'server') => void;
}

export function SilentConnectivityTester({ email, onIssueDetected }: SilentConnectivityTesterProps) {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isHealthy: true,
    lastCheck: null,
    consecutiveFailures: 0,
    averageResponseTime: 0,
    windowsAccessOk: true,
    serverReachable: true,
  });

  const [isTestingNow, setIsTestingNow] = useState(false);

  const runSilentTest = async (showResults: boolean = false) => {
    if (!email) return;

    const startTime = Date.now();
    let testResults = {
      windowsAccessOk: true,
      serverReachable: true,
      responseTime: 0,
      error: null as string | null
    };

    try {
      // Test 1: Basic server ping (lightweight)
      const pingResponse = await fetch('/api/ping', { 
        method: 'GET',
        cache: 'no-cache'
      });
      
      testResults.responseTime = Date.now() - startTime;
      testResults.serverReachable = pingResponse.ok;

      // Test 2: Check if we can access user data (Windows permissions test)
      if (pingResponse.ok) {
        try {
          const userTest = await fetch(`/api/connectnow/user-credits/${email}`, {
            method: 'GET',
            cache: 'no-cache'
          });
          testResults.windowsAccessOk = userTest.ok || userTest.status === 304; // 304 is OK (cached)
        } catch (error) {
          testResults.windowsAccessOk = false;
          testResults.error = 'Windows access test failed';
        }
      }

    } catch (error) {
      testResults.serverReachable = false;
      testResults.windowsAccessOk = false;
      testResults.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Update status based on results
    const isHealthy = testResults.serverReachable && testResults.windowsAccessOk;
    const consecutiveFailures = isHealthy ? 0 : status.consecutiveFailures + 1;

    setStatus(prev => ({
      isHealthy,
      lastCheck: new Date(),
      consecutiveFailures,
      averageResponseTime: Math.round((prev.averageResponseTime + testResults.responseTime) / 2),
      windowsAccessOk: testResults.windowsAccessOk,
      serverReachable: testResults.serverReachable,
    }));

    // Only alert admin/support if there are persistent issues (3+ failures)
    if (consecutiveFailures >= 3 && onIssueDetected) {
      if (!testResults.windowsAccessOk && testResults.serverReachable) {
        onIssueDetected('windows'); // Windows/local computer issue
      } else if (!testResults.serverReachable) {
        onIssueDetected('network'); // Network connectivity issue
      } else {
        onIssueDetected('server'); // Server issue
      }
    }

    return { ...testResults, isHealthy, consecutiveFailures };
  };

  const runManualTest = async () => {
    setIsTestingNow(true);
    await runSilentTest(true);
    setIsTestingNow(false);
  };

  // Run silent background tests every 2 minutes
  useEffect(() => {
    if (!email) return;

    // Initial test
    runSilentTest();

    // Background testing every 2 minutes
    const interval = setInterval(() => {
      runSilentTest();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [email]);

  // Simple status badge - no scary messages
  return (
    <div className="flex items-center gap-2" data-testid="silent-connectivity-tester">
      <div className="flex items-center gap-1">
        {status.isHealthy ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : status.consecutiveFailures > 2 ? (
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
        ) : (
          <div className="h-3 w-3 rounded-full bg-gray-300" />
        )}
        
        <Badge 
          variant={status.isHealthy ? "default" : status.consecutiveFailures > 2 ? "secondary" : "outline"}
          className="text-xs"
        >
          {status.isHealthy ? 'Online' : status.consecutiveFailures > 2 ? 'Checking' : 'Testing'}
        </Badge>
      </div>

      {/* Manual test button (small, unobtrusive) */}
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={runManualTest} 
        disabled={isTestingNow}
        className="h-6 px-2 text-xs"
        data-testid="button-manual-test"
      >
        {isTestingNow ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </Button>

      {/* Show last check time (subtle) */}
      {status.lastCheck && (
        <span className="text-xs text-gray-400">
          {status.lastCheck.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      )}
    </div>
  );
}