import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Bug, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZoomControlProps {
  className?: string;
}

export default function ZoomControl({ className = '' }: ZoomControlProps) {
  const [zoom, setZoom] = useState(100);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Check if running in Electron and electronAPI is available
    const isElectron = typeof window !== 'undefined' && 
                      window.isElectron === true && 
                      window.electronAPI && 
                      typeof window.electronAPI.getZoomLevel === 'function';
    
    if (isElectron) {
      // Get current zoom level
      window.electronAPI.getZoomLevel().then((result: any) => {
        if (result && result.success) {
          setZoom(result.zoom);
        }
      }).catch((error: any) => {
        console.error('Error getting zoom level:', error);
        // Fallback to localStorage
        const savedZoom = localStorage.getItem('appZoom');
        if (savedZoom) {
          const zoomValue = parseInt(savedZoom);
          setZoom(zoomValue);
        }
      });
    } else {
      // Browser fallback: use document.body.style.zoom
      const savedZoom = localStorage.getItem('appZoom');
      if (savedZoom) {
        const zoomValue = parseInt(savedZoom);
        setZoom(zoomValue);
        document.body.style.zoom = `${zoomValue}%`;
      }
    }
  }, []);

  const handleZoomIn = async () => {
    const isElectron = typeof window !== 'undefined' && 
                      window.isElectron === true && 
                      window.electronAPI && 
                      typeof window.electronAPI.zoomIn === 'function';
    
    if (isElectron) {
      try {
        const result = await window.electronAPI.zoomIn();
        if (result && result.success) {
          setZoom(result.zoom);
        }
      } catch (error) {
        console.error('Error zooming in:', error);
        // Fallback to browser zoom
        const newZoom = Math.min(zoom + 10, 200);
        setZoom(newZoom);
        document.body.style.zoom = `${newZoom}%`;
        localStorage.setItem('appZoom', newZoom.toString());
      }
    } else {
      // Browser fallback
      const newZoom = Math.min(zoom + 10, 200);
      setZoom(newZoom);
      document.body.style.zoom = `${newZoom}%`;
      localStorage.setItem('appZoom', newZoom.toString());
    }
  };

  const handleZoomOut = async () => {
    const isElectron = typeof window !== 'undefined' && 
                      window.isElectron === true && 
                      window.electronAPI && 
                      typeof window.electronAPI.zoomOut === 'function';
    
    if (isElectron) {
      try {
        const result = await window.electronAPI.zoomOut();
        if (result && result.success) {
          setZoom(result.zoom);
        }
      } catch (error) {
        console.error('Error zooming out:', error);
        // Fallback to browser zoom
        const newZoom = Math.max(zoom - 10, 50);
        setZoom(newZoom);
        document.body.style.zoom = `${newZoom}%`;
        localStorage.setItem('appZoom', newZoom.toString());
      }
    } else {
      // Browser fallback
      const newZoom = Math.max(zoom - 10, 50);
      setZoom(newZoom);
      document.body.style.zoom = `${newZoom}%`;
      localStorage.setItem('appZoom', newZoom.toString());
    }
  };

  const handleResetZoom = () => {
    // Refresh the entire app
    window.location.reload();
  };

  const getCurrentUserEmail = (): string => {
    try {
      const raw = localStorage.getItem('current_producer');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.email || '';
    } catch {
      return '';
    }
  };

  const buildSystemInfo = async () => {
    let electronVersion = '';
    try {
      if (window.electronAPI?.getVersion) {
        electronVersion = await window.electronAPI.getVersion();
      }
    } catch {
      electronVersion = '';
    }

    return {
      appVersion: window.__APP_VERSION__ || 'unknown',
      buildTime: window.__BUILD_TIME__ || 'unknown',
      electronVersion: electronVersion || 'n/a',
      isElectron: !!window.isElectron,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      currentUrl: window.location.href,
      referrer: document.referrer || '',
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      currentZoom: zoom,
      localTime: new Date().toISOString(),
      email: getCurrentUserEmail(),
    };
  };

  const handleSubmitBugReport = async () => {
    if (!bugDescription.trim()) {
      toast({
        title: 'Please add details',
        description: 'Describe what you were doing and any errors you noticed.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingBug(true);
    try {
      const systemInfo = await buildSystemInfo();
      const consoleLogs = (window.__bugConsoleBuffer || []).slice(-200);

      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          description: bugDescription.trim(),
          systemInfo,
          consoleLogs,
          source: 'zoom-control-modal',
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `HTTP ${response.status}`);
      }

      toast({
        title: 'Bug report sent',
        description: 'Thank you - your report was sent to AO Intelligence support.',
      });
      setBugDescription('');
      setIsBugModalOpen(false);
    } catch (error: any) {
      console.error('Failed to send bug report:', error);
      toast({
        title: 'Failed to send report',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingBug(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomOut}
        disabled={zoom <= 25}
        className="h-8 w-8 p-0"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomIn}
        disabled={zoom >= 500}
        className="h-8 w-8 p-0"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResetZoom}
        className="h-8 w-8 p-0"
        title="Refresh App"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Dialog open={isBugModalOpen} onOpenChange={setIsBugModalOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Report a bug"
          >
            <Bug className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>We value your feedback!</DialogTitle>
            <DialogDescription>
              Please tell us what you were doing and any error messages you encountered.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="What were you doing right before the issue happened? Include any error text you saw."
            className="min-h-[150px]"
          />
          <p className="text-xs text-muted-foreground">
            System details and recent console logs are attached automatically.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBugModalOpen(false)}
              disabled={isSubmittingBug}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitBugReport} disabled={isSubmittingBug}>
              {isSubmittingBug ? 'Sending...' : 'Send Bug Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

