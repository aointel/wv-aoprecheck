import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Monitor, Zap, Shield, X, Laptop } from 'lucide-react';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DesktopAppModal({ isOpen, onClose }: DesktopAppModalProps) {
  const currentVersion = "1.0.1";
  const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'mac'>('windows');
  
  const downloadUrls = {
    windows: `https://github.com/mmandella/PolicyVerify/releases/download/v${currentVersion}/ConnectNow-Setup-${currentVersion}.exe`,
    mac: `https://github.com/mmandella/PolicyVerify/releases/download/v${currentVersion}/ConnectNow-${currentVersion}.dmg`
  };
  
  const handleDownload = (platform: 'windows' | 'mac' = selectedPlatform) => {
    const currentVersion = "1.0.1";
    const downloadUrls = {
      windows: `/uploads/installers/ConnectNow-Setup.exe`,
      mac: `/uploads/installers/ConnectNow-${currentVersion}-Mac`
    };
    
    console.log(`Downloading ConnectNow for ${platform}`);
    window.open(downloadUrls[platform], '_blank');
    onClose();
  };

  const features = [
    {
      icon: <Monitor className="w-5 h-5" />,
      title: "Desktop Experience",
      description: "Native desktop app with better performance"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Faster Loading",
      description: "No browser limitations or loading delays"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Enhanced Security",
      description: "Local processing with secure connections"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              🎉 Desktop App Now Available!
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hero Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 px-4 py-2 rounded-full">
              <Badge variant="secondary" className="bg-green-500 text-white">
                NEW
              </Badge>
              <span className="text-sm font-medium">Download the desktop version for the best experience</span>
            </div>
            
            <p className="text-muted-foreground">
              Get the full AO Intelligence experience with our new desktop application. 
              Faster, more secure, and designed specifically for your calling campaigns.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Platform Selection */}
          <div className="space-y-4">
            <h4 className="font-semibold text-center">Choose Your Platform</h4>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setSelectedPlatform('windows')}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                  selectedPlatform === 'windows' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Monitor className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-medium">Windows</div>
                  <div className="text-sm text-muted-foreground">Windows 10/11</div>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedPlatform('mac')}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                  selectedPlatform === 'mac' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Laptop className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-medium">macOS</div>
                  <div className="text-sm text-muted-foreground">macOS 10.15+</div>
                </div>
              </button>
            </div>
          </div>

          {/* Download Section */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Ready to upgrade?
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Download the desktop app and start calling with enhanced performance
                </p>
              </div>
              <Button
                onClick={() => handleDownload()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Download for {selectedPlatform === 'windows' ? 'Windows' : 'macOS'}
              </Button>
            </div>
          </div>

          {/* Continue with Web */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Or continue using the web version
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="text-sm"
            >
              Continue with Web Version
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <p>• {selectedPlatform === 'windows' ? 'Windows 10/11' : 'macOS 10.15+'} compatible</p>
            <p>• ~90MB download • Free installation • Digitally signed</p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 