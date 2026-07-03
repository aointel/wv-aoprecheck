import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Monitor, Users, CheckCircle, ArrowRight } from 'lucide-react';

export function producerInstructions() {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/uploads/installers/ConnectNow-Setup.exe';
    link.download = 'ConnectNow-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="h-6 w-6 text-indigo-600" />
            <div>
              <CardTitle className="text-xl text-indigo-800 dark:text-indigo-200">
                ConnectNow Desktop App for producers
              </CardTitle>
              <CardDescription className="text-indigo-700 dark:text-indigo-300">
                Super simple installation - no tech skills needed!
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <Users className="h-3 w-3 mr-1" />
            producer Friendly
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Step-by-step instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            3 Easy Steps (Even Your Grandma Can Do It!)
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-medium">Download & Run the Installer</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click the big download button below. Run the file when it downloads. 
                  You'll see cool ConnectNow animations during installation!
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-medium">Look for the Desktop Shortcut</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  After installation, you'll see a "ConnectNow" shortcut on your desktop. 
                  It looks like a small icon you can double-click.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-medium">Double-Click & Start Calling!</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Double-click the ConnectNow shortcut. Login with your AO credentials. 
                  You're ready to make professional calls!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What producers get */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
              ✅ What You Get:
            </h4>
            <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
              <li>• Desktop shortcut (no bookmarks needed)</li>
              <li>• Faster calling performance</li>
              <li>• Professional interface</li>
              <li>• Automatic updates</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              🎯 Super Simple:
            </h4>
            <ul className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
              <li>• Works on any Windows computer</li>
              <li>• No technical knowledge required</li>
              <li>• Creates shortcuts automatically</li>
              <li>• Same login you already use</li>
            </ul>
          </div>
        </div>

        {/* Download button */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t">
          <Button 
            onClick={handleDownload} 
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-lg"
          >
            <Download className="h-5 w-5 mr-2" />
            Download ConnectNow Desktop App
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          
          <p className="text-sm text-center text-gray-600 dark:text-gray-400 max-w-md">
            <strong>File Size:</strong> 37MB • <strong>System:</strong> Windows 10+ • <strong>Setup Time:</strong> 2 minutes
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 text-center">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>producers:</strong> After installation, just look for "ConnectNow" on your desktop and double-click it!
            </p>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
}