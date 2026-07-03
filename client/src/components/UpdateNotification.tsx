import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, X, AlertCircle, CheckCircle } from 'lucide-react';

interface UpdateInfo {
  hasUpdate: boolean;
  versionInfo?: {
    version: string;
    buildDate: string;
    downloadUrl: string;
    releaseNotes: string[];
  };
  updateRequired: boolean;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  useEffect(() => {
    // Enhanced desktop app detection
    const userproducer = navigator.userproducer;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasDesktopParam = window.location.search.includes('desktop=true');
    const isAppMode = userproducer.includes('ConnectNow') || 
                     !!(window as any).chrome?.app || 
                     !!(window.navigator as any).standalone ||
                     isStandalone;
    
    // Check for Chrome app mode indicators
    const isChromeApp = !!(window as any).chrome && 
                       (!!(window as any).chrome.app || 
                        window.location.protocol === 'chrome-extension:' ||
                        window.outerWidth === window.innerWidth);
    
    const isDesktop = hasDesktopParam || isAppMode || isChromeApp;
    
    setIsDesktopApp(isDesktop);
    
    // Only check for updates if not in desktop app (desktop app handles its own updates)
    if (!isDesktop) {
      checkForUpdates();
    }
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/version/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVersion: '1.0.1' })
      });

      if (response.ok) {
        const data = await response.json();
        setUpdateInfo(data);
      }
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = () => {
    if (updateInfo?.versionInfo) {
      const link = document.createElement('a');
      link.href = updateInfo.versionInfo.downloadUrl;
      link.download = 'ConnectNow-Setup.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (!updateInfo.updateRequired) {
        setDismissed(true);
      }
    }
  };

  if (checking) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Checking for updates...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show update notification if they're already using the desktop app
  if (!updateInfo?.hasUpdate || dismissed || isDesktopApp) {
    return null;
  }

  const { versionInfo, updateRequired } = updateInfo;

  return (
    <Card className={`border-2 ${updateRequired ? 'border-red-200 bg-red-50 dark:bg-red-950' : 'border-green-200 bg-green-50 dark:bg-green-950'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {updateRequired ? (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
            <CardTitle className={`text-lg ${updateRequired ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
              {updateRequired ? 'Required Update Available' : 'Update Available'}
            </CardTitle>
            {updateRequired && (
              <Badge variant="destructive" className="ml-2">
                Required
              </Badge>
            )}
          </div>
          {!updateRequired && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription className={updateRequired ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>
          ConnectNow Desktop v{versionInfo?.version} is now available
        </CardDescription>
      </CardHeader>
      <CardContent>
        {versionInfo?.releaseNotes && versionInfo.releaseNotes.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium mb-2 text-sm">What's New:</h4>
            <ul className="space-y-1">
              {versionInfo.releaseNotes.slice(0, 3).map((note, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="flex gap-3">
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Update
          </Button>
          <Button variant="outline" onClick={checkForUpdates} disabled={checking}>
            Check Again
          </Button>
        </div>
        
        {updateRequired && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3">
            This update contains critical fixes and must be installed to continue using ConnectNow.
          </p>
        )}
      </CardContent>
    </Card>
  );
}