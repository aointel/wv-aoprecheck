import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix paths
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DISPOSITIONS_PATTERN = /Mandella 1 Hour Report Dispositions \(\d+\)\.csv$/i;

// Add directory constants
const DISPOSITIONS_FILE = 'Dispositions.csv';
const CAMPAIGN_LIST_FILE = 'CampaignList.csv';
const PROCESSED_FILE = './uploads/processed_dispositions.json';
const PROCESSED_DIR = './processed';
const ARCHIVED_DIR = './archived';

// Create directories if they don't exist
[UPLOADS_DIR, PROCESSED_DIR, ARCHIVED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const TAALK_API_CONFIG = {
    base_url: "https://lets.taalk.ai/api/campaign2s",
    api_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
};

// Add new disposition types
const DISPOSITION_TYPES = {
    DNC: 'DNC',
    NOT_INTERESTED: 'Not Interested',
    CALLBACK: 'Call Back',
    NO_ANSWER: 'No Answer',
    WRONG_NUMBER: 'Wrong Number',
    LANGUAGE_BARRIER: 'Language Barrier',
    QUALIFIED: 'Qualified',
    NOT_QUALIFIED: 'Not Qualified'
};

// Add at top with other constants
const RATE_LIMIT = {
    maxRequests: 5,  // Max 5 requests
    perSeconds: 1,   // Per second
    retryDelay: 2000 // Wait 2 seconds on 429
};

// File paths
const EXPORTS_DIR = './exports';
const DISPOSITIONS_DIR = './dispositions';  // Where dispositions are saved

// Load campaign mappings from CSV
async function loadCampaignMappings() {
    const mappings = {};
    return new Promise((resolve, reject) => {
        try {
            const fileContent = fs.readFileSync(CAMPAIGN_LIST_FILE, 'utf8');
            const records = parse(fileContent, { columns: true });
            
            records.forEach((row) => {
                const state = row.State;
                const market = row.Market;
                const campaign = row.Campaign;

                if (!mappings[state]) mappings[state] = {};
                mappings[state][market] = campaign;
            });
            
            resolve(mappings);
        } catch (error) {
            reject(error);
        }
    });
}

function getMarketFromGroupCode(groupCode) {
    if (groupCode.includes('PAVET') || groupCode.includes('VET')) {
        return 'Vet';
    }
    if (groupCode.includes('NCL')) {
        return 'Will Kit';
    }
    return null;
}

// Modify updateDisposition function to handle rate limits
async function updateDisposition(campaignId, phone, success = true) {
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await fetch(`${TAALK_API_CONFIG.base_url}/${campaignId}/contacts/${phone}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TAALK_API_CONFIG.api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "Taalk_Success": success
                })
            });

            if (response.status === 429) {
                console.log(`Rate limited, waiting ${RATE_LIMIT.retryDelay}ms before retry...`);
                await new Promise(r => setTimeout(r, RATE_LIMIT.retryDelay));
                retries--;
                continue;
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            console.log(`Updated disposition for ${phone} in campaign ${campaignId}`);
            
            // Add delay between requests
            await new Promise(r => setTimeout(r, (1000 / RATE_LIMIT.maxRequests)));
            
            return true;

        } catch (error) {
            if (retries === 0) throw error;
            console.error(`Failed attempt for ${phone}, retrying...`);
            retries--;
            await new Promise(r => setTimeout(r, RATE_LIMIT.retryDelay));
        }
    }
}

async function processDispositionsFile(file, campaignMappings) {
    try {
        const filePath = path.join(UPLOADS_DIR, file);
        console.log(`Processing dispositions from: ${filePath}`);

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const records = parse(fileContent, { 
            columns: true,
            skip_empty_lines: true,    // Skip empty lines
            relax_column_count: true,  // Don't error on inconsistent columns
            trim: true                 // Trim whitespace
        });

        console.log(`Found ${records.length} valid records to process`);

        // Process each valid record
        for (const row of records) {
            // Skip if missing required fields
            if (!row.Textbox7 || !row.Textbox9) {
                console.log('Skipping invalid record:', row);
                continue;
            }

            const phone = row.Textbox7.trim();
            const state = row.Textbox9.trim();
            const groupCode = row.Textbox11;
            const success = true;

            if (phone && state && groupCode) {
                const market = getMarketFromGroupCode(groupCode);
                const campaignId = market ? campaignMappings[state]?.[market] : null;

                if (campaignId) {
                    await updateDisposition(campaignId, phone, success);
                } else {
                    console.log(`No campaign found for state ${state} and market ${market}`);
                }
            }
        }

        // Move processed file to archive
        const archiveDir = path.join(UPLOADS_DIR, 'archived');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir);
        }
        const archivePath = path.join(archiveDir, file);
        console.log(`Moving ${filePath} to ${archivePath}`);
        fs.renameSync(filePath, archivePath);
        console.log(`✓ Archived processed file: ${file}`);

    } catch (error) {
        console.error(`Error processing ${file}:`, error);
        throw error;
    }
}

// Load already processed files
function loadProcessedFiles() {
    try {
        if (fs.existsSync(PROCESSED_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE)));
        }
    } catch (error) {
        console.error('Error loading processed files:', error);
    }
    return new Set();
}

// Save processed files
function saveProcessedFiles(processedFiles) {
    try {
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...processedFiles]));
    } catch (error) {
        console.error('Error saving processed files:', error);
    }
}

// Add a reset function
function resetProcessedFiles() {
    try {
        if (fs.existsSync(PROCESSED_FILE)) {
            fs.unlinkSync(PROCESSED_FILE);
            console.log('Reset processed files tracking');
        }
    } catch (error) {
        console.error('Error resetting processed files:', error);
    }
}

// Function to process dispositions
async function processDispositions() {
    try {
        // First load campaign mappings
        const campaignMappings = await loadCampaignMappings();
        console.log('Campaign mappings loaded');

        // Find ALL disposition files
        const files = fs.readdirSync(UPLOADS_DIR)
            .filter(f => DISPOSITIONS_PATTERN.test(f))
            .sort((a, b) => b.localeCompare(a));

        console.log(`\nFound ${files.length} disposition files to process`);

        // Process ALL files
        for (const file of files) {
            console.log(`\n=== Processing ${file} ===`);
            try {
                await processDispositionsFile(file, campaignMappings);
                console.log(`✓ Completed processing ${file}`);
            } catch (error) {
                console.error(`× Failed to process ${file}:`, error.message);
                continue;
            }
        }
        
        console.log('\nAll files processed');

    } catch (error) {
        console.error('Error processing dispositions:', error);
        throw error;
    }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    processDispositions().catch(console.error);
}

export { processDispositions };

