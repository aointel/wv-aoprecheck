import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Directory where builds will be stored
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');
const UPDATES_DIR = path.join(DOWNLOADS_DIR, 'updates');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
    await fs.mkdir(UPDATES_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create download directories:', error);
  }
}

// Initialize directories on startup
ensureDirectories();

// Get available downloads
router.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(DOWNLOADS_DIR);
    const downloads = [];
    
    for (const file of files) {
      if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage')) {
        const stats = await fs.stat(path.join(DOWNLOADS_DIR, file));
        const platform = file.endsWith('.exe') ? 'windows' : 
                        file.endsWith('.dmg') ? 'mac' : 'linux';
        
        downloads.push({
          filename: file,
          platform,
          size: stats.size,
          created: stats.birthtime,
          downloadUrl: `/downloads/${file}`
        });
      }
    }
    
    // Sort by creation date (newest first)
    downloads.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    res.json({ downloads });
  } catch (error) {
    console.error('Failed to list downloads:', error);
    res.status(500).json({ error: 'Failed to list downloads' });
  }
});

// Serve download files
router.get('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(DOWNLOADS_DIR, filename);
    
    // Security check - ensure file is within downloads directory
    if (!filePath.startsWith(DOWNLOADS_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists
    await fs.access(filePath);
    
    // Set appropriate headers
    const stats = await fs.stat(filePath);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (filename.endsWith('.exe')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filename.endsWith('.dmg')) {
      res.setHeader('Content-Type', 'application/x-apple-diskimage');
    } else if (filename.endsWith('.AppImage')) {
      res.setHeader('Content-Type', 'application/x-executable');
    }
    
    // Stream the file
    const stream = require('fs').createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Failed to serve download:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Auto-update endpoint - serves latest.yml for Windows and latest-mac.yml for Mac
router.get('/updates/latest.yml', async (req, res) => {
  try {
    const latestPath = path.join(UPDATES_DIR, 'latest.yml');
    const data = await fs.readFile(latestPath, 'utf-8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(data);
  } catch (error) {
    console.error('Failed to serve Windows update manifest:', error);
    res.status(404).json({ error: 'Update manifest not found' });
  }
});

router.get('/updates/latest-mac.yml', async (req, res) => {
  try {
    const latestMacPath = path.join(UPDATES_DIR, 'latest-mac.yml');
    const data = await fs.readFile(latestMacPath, 'utf-8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(data);
  } catch (error) {
    console.error('Failed to serve Mac update manifest:', error);
    res.status(404).json({ error: 'Update manifest not found' });
  }
});

// Serve update files
router.get('/updates/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(UPDATES_DIR, filename);
    
    // Security check
    if (!filePath.startsWith(UPDATES_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists
    await fs.access(filePath);
    
    // Set appropriate headers
    const stats = await fs.stat(filePath);
    res.setHeader('Content-Length', stats.size);
    
    if (filename.endsWith('.exe') || filename.endsWith('.nsis.7z')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filename.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    } else if (filename.endsWith('.dmg')) {
      res.setHeader('Content-Type', 'application/x-apple-diskimage');
    }
    
    // Stream the file
    const stream = require('fs').createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Failed to serve update file:', error);
    res.status(404).json({ error: 'Update file not found' });
  }
});

// Upload endpoint for build automation (secured)
router.post('/upload', async (req, res) => {
  // This would need proper authentication in production
  try {
    // For now, return success - actual upload logic would be implemented here
    res.json({ success: true, message: 'Upload endpoint ready' });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;