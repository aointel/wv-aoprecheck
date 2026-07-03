import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { google } from 'googleapis';
import { processDispositions } from './processDispositions.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config();

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure paths - SIMPLIFIED FOR LOCAL FILES
const WATCH_FOLDER = 'G:\\My Drive\\BB';  // Double backslash for Windows
const EXPORTS_DIR = './exports';
const UPLOADS_DIR = './uploads';
const ARCHIVED_DIR = path.join(UPLOADS_DIR, 'archived');

// Use patterns instead
const LEAD_PATTERN = '1 Hour Report';
const DISPOSITION_PATTERN = 'Dispositions';

const CAMPAIGN_MAPPING = {
    // Copy the campaign mapping from LeadDBmgmt.js
    'AL-NCL07': '67847e2c477432a7c853f1a4',
    'FL-NCL07': '67847e69477432a7c853f1c3',
    'GA-NCL07': '67847e86477432a7c853f1df',
    'NC-NCL07': '67847e9f477432a7c853f1f5',
    'PA-NCL07': '67847eb7477432a7c853f203',
    'TX-NCL07': '67847eca477432a7c853f446',
    // ... rest of mappings
};

// Add function to get campaign ID
function getCampaignId(matchKey) {
    return CAMPAIGN_MAPPING[matchKey] || '';
}

// Google Drive setup
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

async function listFiles() {
    try {
        const response = await drive.files.list({
            q: "'your_folder_id' in parents and trashed=false",
            fields: 'files(id, name)',
            orderBy: 'createdTime desc'
        });
        return response.data.files;
    } catch (error) {
        console.error('Error listing files:', error);
        throw error;
    }
}

async function downloadFile(fileId, destPath) {
    try {
        const dest = fs.createWriteStream(destPath);
        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        return new Promise((resolve, reject) => {
            response.data
                .pipe(dest)
                .on('finish', resolve)
                .on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

async function moveToArchive(fileId) {
    try {
        await drive.files.update({
            fileId: fileId,
            addParents: 'your_archive_folder_id',
            removeParents: 'your_folder_id'
        });
    } catch (error) {
        console.error('Error moving file to archive:', error);
        throw error;
    }
}

async function processFile(filepath) {
    console.log('\n=== Processing Latest Report ===');
    
    try {
        // Create processed directory if it doesn't exist
        if (!fs.existsSync(EXPORTS_DIR)) {
            fs.mkdirSync(EXPORTS_DIR, { recursive: true });
        }

        // Read leads from the file
        const leads = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => {
                    // Clean up field names by removing BOM and whitespace
                    const cleanRow = {};
                    Object.entries(row).forEach(([key, value]) => {
                        // Remove BOM and trim whitespace
                        const cleanKey = key.replace(/^\uFEFF/, '').trim();
                        cleanRow[cleanKey] = value;
                    });

                    // Add MatchKey and CampaignID
                    if (cleanRow.State && cleanRow.GroupCode) {
                        cleanRow.MatchKey = `${cleanRow.State}-${cleanRow.GroupCode}`;
                        cleanRow.CampaignID = getCampaignId(cleanRow.MatchKey);
                    }
                    leads.push(cleanRow);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Found ${leads.length} leads`);
            
        // If we have leads, write them to a new airtable export file
        if (leads.length > 0) {
            try {
                const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0] + 'Z';
                const outputFile = path.join(EXPORTS_DIR, `airtable_export_${timestamp}.csv`);
                
                const writeStream = fs.createWriteStream(outputFile);
                
                // Get all fields from first lead
                const fields = Object.keys(leads[0]);
                
                // Write headers
                writeStream.write(fields.join(',') + '\n');

                // Write leads
                for (const lead of leads) {
                    const row = fields.map(field => {
                        const value = lead[field] || '';
                        // Escape quotes and wrap in quotes
                        return `"${value.toString().replace(/"/g, '""')}"`;
                    }).join(',') + '\n';
                    writeStream.write(row);
                }

                // Close the stream properly
                await new Promise((resolve, reject) => {
                    writeStream.end();
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });

                console.log(`Successfully wrote ${leads.length} leads to ${outputFile}`);

            } catch (writeError) {
                console.error('Error writing to file:', writeError);
                throw writeError;
            }
        } else {
            console.log('No leads to process');
        }

        console.log('=== Processing Complete ===\n');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// File patterns
const FILE_PATTERNS = {
    leads: /Mandella 1 Hour Report/i,
    dispositions: /Mandella 1 Hour Report Dispositions \(\d+\)\.csv$/i
};

// Try common Google Drive paths
const POSSIBLE_DRIVE_PATHS = [
    'G:\\My Drive\\BB',
    'C:\\Users\\mmand\\Google Drive\\BB',
    'C:\\Users\\mmand\\My Drive\\BB',
    'C:\\Users\\mmand\\Drive\\BB',
    './BB'  // Local fallback
];

function findBBFolder() {
    for (const drivePath of POSSIBLE_DRIVE_PATHS) {
        console.log(`Checking path: ${drivePath}`);
        if (fs.existsSync(drivePath)) {
            console.log(`Found BB folder at: ${drivePath}`);
            return drivePath;
        }
    }
    // If no path found, create local BB folder
    const localPath = './BB';
    if (!fs.existsSync(localPath)) {
        console.log('Creating local BB folder');
        fs.mkdirSync(localPath, { recursive: true });
    }
    return localPath;
}

async function processAllFiles() {
    const processedDispositions = [];
    const processedLeads = [];

    try {
        if (!fs.existsSync(WATCH_FOLDER)) {
            console.error(`ERROR: Folder not found: ${WATCH_FOLDER}`);
            return [];
        }

        console.log(`Checking folder: ${WATCH_FOLDER}`);
        const files = fs.readdirSync(WATCH_FOLDER);
        const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));
        console.log('Found CSVs:', csvFiles);

        for (const file of csvFiles) {
            const filePath = path.join(WATCH_FOLDER, file);

            // Disposition files
            if (file.toLowerCase().includes('dispositions')) {
                const uploadPath = path.join(UPLOADS_DIR, file);
                fs.copyFileSync(filePath, uploadPath);
                console.log(`Processed disposition file: ${file}`);
                processedDispositions.push(file);

                // Delete dispositions from BB
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted disposition file from BB: ${filePath}`);
                } catch (error) {
                    console.error(`Error deleting file ${filePath}:`, error);
                }

            // Lead files
            } else if (file.toLowerCase().includes('1 hour report')) {
                console.log('Attempting to process lead file:', file);
                await processFile(filePath);
                console.log('Finished processFile for:', file);
                processedLeads.push(file);

                // Delete leads from BB
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted lead file from BB: ${filePath}`);
                } catch (error) {
                    console.error(`Error deleting file ${filePath}:`, error);
                }

            } else {
                console.log(`Skipping CSV (unknown type): ${file}`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }

    return {
        dispositions: processedDispositions,
        leads: processedLeads
    };
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Start monitoring
async function startMonitoring() {
    console.log('Starting lead monitoring system...');
    console.log(`Watching folder: ${WATCH_FOLDER}`);
    console.log('Press Ctrl+C to stop\n');

    // Run immediately
    await processAllFiles();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});

export {
    processAllFiles,
    processLatestFile
};

// Add function to process disposition files
async function processDispositionFiles(auth) {
    try {
        const drive = google.drive({ version: 'v3', auth });
        
        // Search for disposition files
        const response = await drive.files.list({
            q: `name contains 'Mandella 1 Hour Report Dispositions' and mimeType='text/csv'`,
            fields: 'files(id, name)',
            orderBy: 'createdTime desc'
        });

        const files = response.data.files;
        if (files.length === 0) {
            console.log('No new disposition files found.');
            return;
        }

        // Download and process each file
        for (const file of files) {
            const dest = path.join(UPLOADS_DIR, file.name);
            await downloadFile(drive, file.id, dest);
            console.log(`Downloaded disposition file: ${file.name}`);
        }

        // Process the dispositions
        await processDispositions();

    } catch (error) {
        console.error('Error processing disposition files:', error);
        throw error;
    }
}

// Add this at the bottom to run when called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    processAllFiles().catch(console.error);
}

/**
 * Placeholder for processing the "latest file" from Google Drive
 * Adjust as needed for your real logic.
 */
async function processLatestFile() {
    console.log('[DriveSync] processLatestFile() called');
    // Example: pretend to download "latest" file from Drive
    return { success: true, message: 'Downloaded 1 file' };
}
