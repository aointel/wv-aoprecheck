import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaWindows, FaApple, FaDownload, FaRocket, FaBolt, FaLock } from 'react-icons/fa';
import { MdSpeed, MdNotifications, MdOfflineBolt } from 'react-icons/md';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DesktopAppModal({ isOpen, onClose }: DesktopAppModalProps) {
  const handleDownload = (platform: 'windows' | 'mac') => {
    // In production, these would be actual download links
    const downloadUrls = {
      windows: '/downloads/AO-Intelligence-Setup.exe',
      mac: '/downloads/AO-Intelligence.dmg'
    };
    
    // For now, show download in progress
    console.log(`Downloading AO Intelligence for ${platform}`);
    // window.open(downloadUrls[platform], '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Gradient Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-blue-700/80 animate-pulse" />
          <div className="relative">
            <DialogHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <FaRocket className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">
                    Desktop App Available!
                  </DialogTitle>
                  <p className="text-blue-100 mt-1">
                    Download AO Intelligence for the ultimate experience
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Benefits Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              <MdSpeed className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm mb-1">Lightning Fast</h3>
              <p className="text-xs text-muted-foreground">Native performance with instant loading</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
              <MdNotifications className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm mb-1">Push Notifications</h3>
              <p className="text-xs text-muted-foreground">Never miss important calls or updates</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
              <MdOfflineBolt className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm mb-1">Audio Issues Resolved</h3>
              <p className="text-xs text-muted-foreground">Bypass Chrome audio issues completely</p>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FaBolt className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Pro Tip</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Desktop apps eliminate Chrome audio permission issues, provide crystal-clear call quality, and offer native system integration.
                </p>
              </div>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-center bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              Choose Your Platform
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Windows Download */}
              <Button
                onClick={() => handleDownload('windows')}
                className="h-16 flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              >
                <div className="flex items-center space-x-3">
                  <FaWindows className="w-8 h-8" />
                  <div className="text-left">
                    <div className="font-semibold">Windows</div>
                    <div className="text-xs opacity-90">Windows 10/11</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    Free
                  </Badge>
                  <FaDownload className="w-4 h-4" />
                </div>
              </Button>

              {/* Mac Download */}
              <Button
                onClick={() => handleDownload('mac')}
                className="h-16 flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
              >
                <div className="flex items-center space-x-3">
                  <FaApple className="w-8 h-8" />
                  <div className="text-left">
                    <div className="font-semibold">macOS</div>
                    <div className="text-xs opacity-90">macOS 10.15+</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    Free
                  </Badge>
                  <FaDownload className="w-4 h-4" />
                </div>
              </Button>
            </div>
          </div>

          {/* Security Note */}
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <FaLock className="w-4 h-4 text-green-600" />
            <span>Digitally signed and verified by AO Intelligence</span>
          </div>

          {/* Close Button */}
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={onClose} className="w-32">
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}