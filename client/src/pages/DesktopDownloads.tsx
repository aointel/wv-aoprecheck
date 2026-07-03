import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Monitor, Apple, Smartphone, Zap, Shield, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Release {
  platform: string;
  filename: string;
  version: string;
  size: number;
  downloadUrl: string;
  releaseDate: string;
}

interface ReleasesData {
  currentVersion: string;
  releases: Release[];
}

export default function DesktopDownloads() {
  const { toast } = useToast();
  
  const { data: releasesData, isLoading, refetch } = useQuery<ReleasesData>({
    queryKey: ['/api/desktop/releases'],
  });

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = (downloadUrl: string, filename: string) => {
    toast({
      title: "Download Started",
      description: `Downloading ${filename}...`,
    });
    
    // Create a link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'windows':
        return <Monitor className="h-6 w-6" />;
      case 'macos':
        return <Apple className="h-6 w-6" />;
      default:
        return <Smartphone className="h-6 w-6" />;
    }
  };

  if (isLoading) {
    return (
      <div className="downloads-page-root h-[100dvh] overflow-y-auto overflow-x-hidden bg-background p-6 pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading desktop apps...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="downloads-page-root h-[100dvh] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-background pb-28">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 px-4 py-2 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300 mb-6">
              <Zap className="h-4 w-4" />
              Desktop Applications
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent mb-6">
              AO Intelligence Desktop
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Download our native desktop application for Windows and Mac. 
              Get the full AO Intelligence experience with automatic updates and enhanced performance.
            </p>

            {releasesData?.currentVersion && (
              <div className="flex items-center justify-center gap-2 mb-8">
                <Badge variant="outline" className="px-3 py-1">
                  Current Version: v{releasesData.currentVersion}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Downloads Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {releasesData?.releases && releasesData.releases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {releasesData.releases.map((release, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    {getPlatformIcon(release.platform)}
                    <div>
                      <CardTitle className="text-xl">{release.platform}</CardTitle>
                      <CardDescription>
                        Version {release.version} • {formatFileSize(release.size)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Released: {new Date(release.releaseDate).toLocaleDateString()}
                    </div>
                    
                    <Button 
                      onClick={() => handleDownload(release.downloadUrl, release.filename)}
                      className="w-full"
                      size="lg"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      Download for {release.platform}
                    </Button>
                    
                    <div className="text-xs text-muted-foreground">
                      Filename: {release.filename}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Desktop Apps Available</h3>
              <p className="text-muted-foreground mb-6">
                Desktop applications are currently being prepared. Please check back soon!
              </p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Again
              </Button>
            </CardContent>
          </Card>
        )}

        <Separator className="my-16" />

        {/* Features Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose Desktop?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our desktop applications provide enhanced performance, native integration, and automatic updates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">
              Native performance with optimized resource usage for the best calling experience.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-100 dark:bg-green-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Auto Updates</h3>
            <p className="text-sm text-muted-foreground">
              Automatic updates ensure you always have the latest features and security improvements.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-100 dark:bg-purple-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Monitor className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Native Experience</h3>
            <p className="text-sm text-muted-foreground">
              Seamless integration with your operating system for the best user experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}