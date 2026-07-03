import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface VersionInfo {
  version: string;
  timestamp: string;
  needsRefresh: boolean;
  buildTime: number;
}

export function VersionChecker() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const { toast } = useToast();

  const checkVersion = async () => {
    try {
      const response = await fetch('/api/version');
      const versionInfo: VersionInfo = await response.json();
      
      if (currentVersion === null) {
        // First time loading - store the version
        setCurrentVersion(versionInfo.version);
        console.log(`🔄 App version initialized: ${versionInfo.version}`);
      } else if (currentVersion !== versionInfo.version) {
        // Version has changed - user needs to refresh
        console.log(`🆕 New version detected! Current: ${currentVersion}, New: ${versionInfo.version}`);
        setShowRefreshPrompt(true);
        
        // Show toast notification
        toast({
          title: "New Update Available!",
          description: "A new version of the app is available. Please refresh to get the latest features.",
          duration: 10000,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('❌ Failed to check app version:', error);
    }
  };

  const handleRefresh = () => {
    console.log('🔄 User manually refreshing page for new version');
    window.location.reload();
  };

  useEffect(() => {
    // Check version immediately on mount
    checkVersion();
    
    // Check version every 30 seconds
    const interval = setInterval(checkVersion, 30000);
    
    return () => clearInterval(interval);
  }, [currentVersion]);

  // Show refresh prompt banner
  if (showRefreshPrompt) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 shadow-lg z-50 border-b-2 border-blue-400">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-300" />
            <div>
              <div className="font-semibold text-sm">New Update Available!</div>
              <div className="text-xs text-blue-100">
                Please refresh to get the latest features and improvements
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => setShowRefreshPrompt(false)}
              className="text-white hover:bg-white/20"
            >
              Later
            </Button>
            <Button 
              variant="secondary"
              size="sm" 
              onClick={handleRefresh}
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}