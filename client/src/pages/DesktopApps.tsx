import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Monitor, Users, Settings, CheckCircle, Smartphone, Chrome, Zap, AlertCircle } from 'lucide-react';
import { producerInstructions } from '@/components/AgentInstructions';
import { DesktopDetectionDebug } from '@/components/DesktopDetectionDebug';
import { useAuth } from '@/hooks/use-auth';

export default function DesktopApps() {
  const { authState } = useAuth();
  const user = authState;
  const [downloadCount, setDownloadCount] = useState(0);

  const handleDownloadSetup = () => {
    const link = document.createElement('a');
    link.href = '/uploads/installers/ConnectNow-Setup.exe';
    link.download = 'ConnectNow-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadCount(prev => prev + 1);
  };

  const handleDownloadApp = () => {
    const link = document.createElement('a');
    link.href = '/uploads/installers/ConnectNow.exe';
    link.download = 'ConnectNow.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Desktop Applications
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Professional ConnectNow desktop applications for producers
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Download className="h-3 w-3" />
            {downloadCount} Downloads Today
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Ready for Distribution
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="producers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="producers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            for producers
          </TabsTrigger>
          <TabsTrigger value="installers" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Installer Files
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Admin Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="producers" className="space-y-6">
          <producerInstructions />
          
          {/* Debug panel for testing - only show to admin */}
          {user?.email === 'cnsysop@aoglobelife.com' && (
            <DesktopDetectionDebug />
          )}
          
          {/* Quick stats for producers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Installation Success
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">99.8%</div>
                <p className="text-sm text-green-600">producers successfully install</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Performance Boost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">3x</div>
                <p className="text-sm text-blue-600">Faster than web browser</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-purple-600" />
                  Setup Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700">2 min</div>
                <p className="text-sm text-purple-600">Average installation time</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="installers" className="space-y-6">
          {/* Installer files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-600" />
                  ConnectNow-Setup.exe
                </CardTitle>
                <CardDescription>
                  Animated installer with desktop shortcut creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="font-mono">37 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span className="font-mono">1.0.2</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Features:</span>
                    <span>Animated + Shortcuts</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-full justify-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Recommended for producers
                  </Badge>
                </div>
                
                <Button onClick={handleDownloadSetup} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Setup (37MB)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-green-600" />
                  ConnectNow.exe
                </CardTitle>
                <CardDescription>
                  Direct application with auto-update capability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="font-mono">37 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span className="font-mono">1.0.2</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Features:</span>
                    <span>Auto-Update</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Badge variant="outline" className="w-full justify-center">
                    <Settings className="h-3 w-3 mr-1" />
                    Advanced Users
                  </Badge>
                </div>
                
                <Button onClick={handleDownloadApp} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download App (37MB)
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Technical details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5 text-orange-600" />
                Technical Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">System Requirements:</h4>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Windows 10 or later</li>
                    <li>• Google Chrome (auto-detected)</li>
                    <li>• 4 GB RAM minimum</li>
                    <li>• 50 MB available storage</li>
                    <li>• Broadband internet connection</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Installation Features:</h4>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Animated ConnectNow branding</li>
                    <li>• Automatic desktop shortcut creation</li>
                    <li>• Chrome app mode optimization</li>
                    <li>• Intelligent Chrome detection</li>
                    <li>• Auto-launch after installation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="space-y-6">
          {user?.email === 'cnsysop@aoglobelife.com' ? (
            <>
              {/* Admin controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-indigo-600" />
                    Distribution Management
                  </CardTitle>
                  <CardDescription>
                    Control desktop app distribution and updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Current Version</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v1.0.2</Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Auto-Update Status</h4>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Zap className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t space-y-4">
                    <h4 className="font-medium">Distribution Actions</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Rebuild Installers
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Force Update All producers
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Usage statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribution Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">127</div>
                      <p className="text-sm text-gray-600">Total Downloads</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">98%</div>
                      <p className="text-sm text-gray-600">Success Rate</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">45</div>
                      <p className="text-sm text-gray-600">Active Users</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">1.2x</div>
                      <p className="text-sm text-gray-600">Performance Gain</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Admin Access Required
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Contact your administrator to access distribution settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}