import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Monitor, X, Smartphone, Chrome, Zap } from 'lucide-react';

export function DesktopAppPromo() {
  const [dismissed, setDismissed] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  useEffect(() => {
    // Multiple detection methods for desktop app usage
    const userproducer = navigator.userproducer;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasDesktopParam = window.location.search.includes('desktop=true');
    const isAppMode = userproducer.includes('ConnectNow') || 
                     !!(window as any).chrome?.app || 
                     !!(window.navigator as any).standalone ||
                     isStandalone;
    
    // Check for Chrome app mode specific indicators
    const isChromeApp = !!(window as any).chrome && 
                       (!!(window as any).chrome.app || 
                        window.location.protocol === 'chrome-extension:' ||
                        window.outerWidth === window.innerWidth); // Chrome app mode indicator
    
    const isDesktop = hasDesktopParam || isAppMode || isChromeApp;
    
    setIsDesktopApp(isDesktop);
    
    // Always dismiss the popup - don't show on load anymore
    setDismissed(true);
    localStorage.setItem('connectnow-desktop-promo-dismissed', 'true');
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('connectnow-desktop-promo-dismissed', 'true');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/uploads/installers/ConnectNow-Setup.exe';
    link.download = 'ConnectNow-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    handleDismiss();
  };

  // Don't show if they're already using desktop app or dismissed
  if (isDesktopApp || dismissed) {
    return null;
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-6 w-6 text-blue-600" />
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-800 dark:text-blue-200">
                Get the ConnectNow Desktop App
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Professional calling experience optimized for producers
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              Recommended
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Chrome className="h-4 w-4 text-blue-600" />
              Why Desktop App?
            </h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Dynamic audio support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Desktop shortcuts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Automatic updates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Always available</span>
              </li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Super Easy Installation
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                <span>Click "Download App"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                <span>Run the installer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                <span>Look for desktop shortcut</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={handleDownload} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4" />
            Download App (37MB)
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Maybe Later
          </Button>
        </div>
        
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>for producers:</strong> The installer creates a desktop shortcut called "ConnectNow". 
            Double-click it to launch your professional calling interface instantly.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}