import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Terminal, Settings, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MicrophonePermissionRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MicrophonePermissionRecoveryModal({ open, onOpenChange }: MicrophonePermissionRecoveryModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Terminal command to reset microphone permissions
  const resetCommand = `tccutil reset Microphone`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(resetCommand);
    setCopied(true);
    toast({
      title: 'Command Copied',
      description: 'Paste this command in Terminal to reset microphone permissions',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenTerminal = () => {
    // Open Terminal app on Mac
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal('x-man-page://open-terminal');
    } else {
      // Fallback: try to open terminal via shell command
      window.open('terminal://', '_blank');
    }
    toast({
      title: 'Opening Terminal',
      description: 'Paste the command and press Enter',
    });
  };

  const handleOpenSystemSettings = () => {
    // Open macOS System Settings > Privacy & Security > Microphone
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
    } else {
      // Fallback: try to open system preferences
      window.open('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone', '_blank');
    }
    toast({
      title: 'Opening System Settings',
      description: 'Please allow microphone access for this app',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Microphone Permission Issue Detected
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Your microphone permission appears to be broken or denied. Follow these steps to fix it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This is a common macOS issue where microphone permissions get corrupted. The fix takes less than 30 seconds.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Quick Fix (Recommended):</h3>
            
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded border">
                    {resetCommand}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCommand}
                  className="ml-2"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={handleOpenTerminal}
                  className="flex-1"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  Open Terminal
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenSystemSettings}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Open System Settings
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Steps:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click "Open Terminal" above</li>
                  <li>Paste the command (Cmd+V) and press Enter</li>
                  <li>Enter your Mac password when prompted</li>
                  <li>Restart this app</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Alternative: Manual Fix</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. Open <strong>System Settings</strong> → <strong>Privacy & Security</strong> → <strong>Microphone</strong></p>
              <p>2. Find this app in the list</p>
              <p>3. Toggle the switch OFF, then ON again</p>
              <p>4. Restart this app</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              I'll Fix This Later
            </Button>
            <Button onClick={handleOpenSystemSettings}>
              Open System Settings Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

