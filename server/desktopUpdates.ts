import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const router = Router();
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Desktop app downloads and auto-update endpoints

// Get latest version info for auto-updater
router.get('/api/desktop/updates/latest.yml', async (req: Request, res: Response) => {
  try {
    const platform = req.query.platform as string || 'win32';
    const arch = req.query.arch as string || 'x64';
    
    const releasesDir = path.join(process.cwd(), 'electron-dist');
    
    // Check if releases directory exists
    if (!fs.existsSync(releasesDir)) {
      return res.status(404).json({ error: 'No releases available' });
    }

    // Get the latest release info
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    const version = packageJson.version;
    
    // Platform-specific file patterns
    const filePatterns = {
      win32: {
        file: `AOIntelligence-Setup-${version}.exe`,
        sha512: `AOIntelligence-Setup-${version}.exe.blockmap`
      },
      darwin: {
        file: `AO Intelligence-${version}.dmg`,
        sha512: `AO Intelligence-${version}.dmg.blockmap`
      }
    };

    const platformFiles = filePatterns[platform as keyof typeof filePatterns];
    if (!platformFiles) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const filePath = path.join(releasesDir, platformFiles.file);
    const sha512Path = path.join(releasesDir, platformFiles.sha512);

    // Check if files exist
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Release files not found' });
    }

    // Get file stats
    const fileStats = await stat(filePath);
    
    // Read SHA512 if exists
    let sha512 = '';
    if (fs.existsSync(sha512Path)) {
      sha512 = await readFile(sha512Path, 'utf8');
    }

    // Return update manifest
    const updateInfo = {
      version,
      files: [
        {
          url: `https://aoirail-production-baa2.up.railway.app/api/desktop/download/${platformFiles.file}`,
          sha512,
          size: fileStats.size
        }
      ],
      path: platformFiles.file,
      sha512,
      releaseDate: fileStats.mtime.toISOString()
    };

    res.setHeader('Content-Type', 'application/x-yaml');
    res.send(`version: ${version}
files:
  - url: https://aoirail-production-baa2.up.railway.app/api/desktop/download/${platformFiles.file}
    sha512: ${sha512}
    size: ${fileStats.size}
path: ${platformFiles.file}
sha512: ${sha512}
releaseDate: '${fileStats.mtime.toISOString()}'`);
    
  } catch (error) {
    console.error('Error serving update info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download specific release file
router.get('/api/desktop/download/:filename', async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    
    // Security: Only allow specific file patterns
    if (!filename.match(/^AOIntelligence-Setup-[\d.]+\.exe$/) && 
        !filename.match(/^AO Intelligence-[\d.]+\.dmg$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(process.cwd(), 'electron-dist', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available downloads
router.get('/api/desktop/releases', async (req: Request, res: Response) => {
  try {
    const releasesDir = path.join(process.cwd(), 'electron-dist');
    
    if (!fs.existsSync(releasesDir)) {
      return res.json({ releases: [] });
    }

    const files = await readdir(releasesDir);
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    const version = packageJson.version;
    
    const releases = [];
    
    // Windows installer
    const windowsFile = files.find(f => f.endsWith('.exe'));
    if (windowsFile && fs.existsSync(path.join(releasesDir, windowsFile))) {
      const stats = await stat(path.join(releasesDir, windowsFile));
      releases.push({
        platform: 'Windows',
        filename: windowsFile,
        version: version,
        size: stats.size,
        downloadUrl: `/api/desktop/download/${windowsFile}`,
        releaseDate: stats.mtime.toISOString()
      });
    }
    
    // Mac installer
    const macFile = files.find(f => f.endsWith('.dmg'));
    if (macFile && fs.existsSync(path.join(releasesDir, macFile))) {
      const stats = await stat(path.join(releasesDir, macFile));
      releases.push({
        platform: 'macOS',
        filename: macFile,
        version: version,
        size: stats.size,
        downloadUrl: `/api/desktop/download/${macFile}`,
        releaseDate: stats.mtime.toISOString()
      });
    }

    res.json({
      currentVersion: version,
      releases: releases.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    });
    
  } catch (error) {
    console.error('Error getting releases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Force check for updates (for testing)
router.post('/api/desktop/check-updates', async (req: Request, res: Response) => {
  try {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    res.json({
      currentVersion: packageJson.version,
      hasUpdate: false, // This would check against a newer version in real implementation
      updateAvailable: false
    });
  } catch (error) {
    console.error('Error checking updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;