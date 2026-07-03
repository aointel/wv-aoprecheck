import fs from 'fs';
import path from 'path';
import { storage } from '../storage-office';

export class RecordingCacheService {
  private static instance: RecordingCacheService;
  private cacheDir: string;
  private downloadQueue: Set<string> = new Set();

  private constructor() {
    this.cacheDir = path.resolve('public/recordings');
    this.ensureCacheDirectory();
  }

  public static getInstance(): RecordingCacheService {
    if (!RecordingCacheService.instance) {
      RecordingCacheService.instance = new RecordingCacheService();
    }
    return RecordingCacheService.instance;
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log(`Created recordings cache directory: ${this.cacheDir}`);
    }
  }

  public isRecordingCached(taalkUID: string): boolean {
    const filePath = path.join(this.cacheDir, `${taalkUID}.mp3`);
    return fs.existsSync(filePath);
  }

  public getCachedRecordingPath(taalkUID: string): string | null {
    const filePath = path.join(this.cacheDir, `${taalkUID}.mp3`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  public async downloadAndCacheRecording(taalkUID: string): Promise<boolean> {
    // Prevent duplicate downloads
    if (this.downloadQueue.has(taalkUID)) {
      console.log(`Recording ${taalkUID} is already being downloaded`);
      return false;
    }

    // Check if already cached
    if (this.isRecordingCached(taalkUID)) {
      console.log(`Recording ${taalkUID} is already cached`);
      return true;
    }

    this.downloadQueue.add(taalkUID);

    try {
      console.log(`Starting download for recording: ${taalkUID}`);
      
      // Get the call to find the original recording URL
      const call = await storage.getCallByTaalkUID(taalkUID);
      if (!call || !call.recordingUrl) {
        console.log(`No call found or no recording URL for ${taalkUID}`);
        return false;
      }

      const filePath = path.join(this.cacheDir, `${taalkUID}.mp3`);
      
      // Download the recording from the original URL
      const response = await fetch(call.recordingUrl);
      if (!response.ok) {
        console.log(`Failed to fetch recording from ${call.recordingUrl}: ${response.status}`);
        return false;
      }
      
      // Save to local file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      
      console.log(`Successfully cached recording: ${taalkUID}`);
      return true;
    } catch (error) {
      console.error(`Error downloading recording ${taalkUID}:`, error);
      return false;
    } finally {
      this.downloadQueue.delete(taalkUID);
    }
  }

  public async preloadRecordingsForCalls(taalkUIDs: string[]): Promise<void> {
    console.log(`Preloading ${taalkUIDs.length} recordings...`);
    
    const downloadPromises = taalkUIDs
      .filter(taalkUID => !this.isRecordingCached(taalkUID))
      .map(taalkUID => this.downloadAndCacheRecording(taalkUID));

    if (downloadPromises.length > 0) {
      console.log(`Starting download of ${downloadPromises.length} uncached recordings`);
      await Promise.allSettled(downloadPromises);
    }
  }

  public getCacheStats(): { totalFiles: number; totalSize: number } {
    try {
      const files = fs.readdirSync(this.cacheDir).filter(file => file.endsWith('.mp3'));
      let totalSize = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return {
        totalFiles: files.length,
        totalSize: totalSize
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  public cleanupExpiredCache(maxAgeInDays: number = 30): void {
    try {
      const files = fs.readdirSync(this.cacheDir).filter(file => file.endsWith('.mp3'));
      const cutoffTime = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted expired cache file: ${file}`);
        }
      });

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired cache files`);
      }
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}

export const recordingCache = RecordingCacheService.getInstance();