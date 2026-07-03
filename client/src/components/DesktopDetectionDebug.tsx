import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Chrome, Smartphone } from 'lucide-react';

export function DesktopDetectionDebug() {
  const [detectionData, setDetectionData] = useState<any>({});

  useEffect(() => {
    const userproducer = navigator.userproducer;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasDesktopParam = window.location.search.includes('desktop=true');
    const isAppMode = userproducer.includes('ConnectNow') || 
                     !!(window as any).chrome?.app || 
                     !!(window.navigator as any).standalone ||
                     isStandalone;
    
    const isChromeApp = !!(window as any).chrome && 
                       (!!(window as any).chrome.app || 
                        window.location.protocol === 'chrome-extension:' ||
                        window.outerWidth === window.innerWidth);
    
    const isDesktop = hasDesktopParam || isAppMode || isChromeApp;
    const hasDismissed = localStorage.getItem('connectnow-desktop-promo-dismissed');

    setDetectionData({
      userproducer,
      isStandalone,
      hasDesktopParam,
      isAppMode,
      isChromeApp,
      isDesktop,
      hasDismissed,
      windowWidth: window.outerWidth,
      innerWidth: window.innerWidth,
      chromeApp: !!(window as any).chrome?.app,
      navigatorStandalone: !!(window.navigator as any).standalone,
      protocol: window.location.protocol
    });
  }, []);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Desktop App Detection Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Detection Status:</h4>
            <div className="space-y-2">
              <Badge variant={detectionData.isDesktop ? "default" : "secondary"}>
                {detectionData.isDesktop ? "Desktop App Detected" : "Web Browser"}
              </Badge>
              <Badge variant={detectionData.hasDismissed ? "outline" : "secondary"}>
                {detectionData.hasDismissed ? "Promo Dismissed" : "Promo Active"}
              </Badge>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Detection Methods:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Desktop Param:</span>
                <Badge variant={detectionData.hasDesktopParam ? "default" : "outline"} className="text-xs">
                  {detectionData.hasDesktopParam ? "✓" : "✗"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Chrome App:</span>
                <Badge variant={detectionData.isChromeApp ? "default" : "outline"} className="text-xs">
                  {detectionData.isChromeApp ? "✓" : "✗"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Standalone:</span>
                <Badge variant={detectionData.isStandalone ? "default" : "outline"} className="text-xs">
                  {detectionData.isStandalone ? "✓" : "✗"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Technical Details:</h4>
          <div className="text-xs space-y-1 font-mono bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <div><strong>User producer:</strong> {detectionData.userproducer}</div>
            <div><strong>Protocol:</strong> {detectionData.protocol}</div>
            <div><strong>Window Size:</strong> {detectionData.windowWidth} x {detectionData.innerWidth}</div>
            <div><strong>Chrome App:</strong> {String(detectionData.chromeApp)}</div>
            <div><strong>Navigator Standalone:</strong> {String(detectionData.navigatorStandalone)}</div>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Expected Behavior:</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {detectionData.isDesktop ? (
              <div className="flex items-center gap-2 text-green-600">
                <Monitor className="h-4 w-4" />
                Desktop app detected - promo will NOT show
              </div>
            ) : (
              <div className="flex items-center gap-2 text-blue-600">
                <Chrome className="h-4 w-4" />
                Web browser detected - promo may show
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}