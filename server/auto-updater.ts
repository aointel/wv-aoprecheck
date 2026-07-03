import fs from 'fs';
import path from 'path';

export interface VersionInfo {
  version: string;
  buildDate: string;
  downloadUrl: string;
  forceUpdate: boolean;
  releaseNotes: string[];
}

export class AutoUpdater {
  private static instance: AutoUpdater;
  private currentVersion = '1.0.1';
  private versionCheckUrl = '/api/version/check';

  static getInstance(): AutoUpdater {
    if (!AutoUpdater.instance) {
      AutoUpdater.instance = new AutoUpdater();
    }
    return AutoUpdater.instance;
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getVersionInfo(): VersionInfo {
    const installerInfoPath = path.join(process.cwd(), 'uploads/installers/installer-info.json');
    let versionInfo: VersionInfo = {
      version: this.currentVersion,
      buildDate: new Date().toISOString(),
      downloadUrl: '/uploads/installers/ConnectNow-Setup.exe',
      forceUpdate: false,
      releaseNotes: []
    };

    try {
      if (fs.existsSync(installerInfoPath)) {
        const installerInfo = JSON.parse(fs.readFileSync(installerInfoPath, 'utf8'));
        versionInfo.version = installerInfo.version || this.currentVersion;
        versionInfo.buildDate = installerInfo.buildDate || new Date().toISOString();
        versionInfo.releaseNotes = installerInfo.features || [];
      }
    } catch (error) {
      console.error('Failed to read installer info:', error);
    }

    return versionInfo;
  }

  updateVersion(newVersion: string, forceUpdate = false) {
    this.currentVersion = newVersion;
    
    // Update installer info
    const installerInfoPath = path.join(process.cwd(), 'uploads/installers/installer-info.json');
    try {
      let installerInfo: any = {};
      if (fs.existsSync(installerInfoPath)) {
        installerInfo = JSON.parse(fs.readFileSync(installerInfoPath, 'utf8'));
      }
      
      installerInfo.version = newVersion;
      installerInfo.buildDate = new Date().toISOString();
      installerInfo.forceUpdate = forceUpdate;
      
      fs.writeFileSync(installerInfoPath, JSON.stringify(installerInfo, null, 2));
      console.log(`✅ Version updated to ${newVersion}${forceUpdate ? ' (force update)' : ''}`);
    } catch (error) {
      console.error('Failed to update version info:', error);
    }
  }

  checkForUpdates(currentClientVersion: string): { 
    hasUpdate: boolean; 
    versionInfo?: VersionInfo; 
    updateRequired: boolean;
  } {
    const serverVersion = this.getVersionInfo();
    const hasUpdate = this.compareVersions(serverVersion.version, currentClientVersion) > 0;
    
    return {
      hasUpdate,
      versionInfo: hasUpdate ? serverVersion : undefined,
      updateRequired: serverVersion.forceUpdate && hasUpdate
    };
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }
}