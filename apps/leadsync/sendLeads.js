const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');
const leadTracker = require('./leadTracker');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const cliProgress = require('cli-progress');

// Configuration
const EXPORTS_DIR = path.join(__dirname, 'exports');
const PROCESSED_DIR = path.join(__dirname, 'processed');
const ARCHIVE_DIR = path.join(__dirname, 'archived');
const TAALK_API_CONFIG = {
    base_url: "https://lets.taalk.ai/api/campaign2s",
    api_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay43NWVlNDkzMy0yZGVkLTRkOGUtYWE4ZC1iNThkMDAxNDNhMmEiLCJleHAiOjIwMjE3NzcyMTd9.hFSckjPzzfWm1PKnheHHwfUQwi-L9VEytvStRXgLvRk"
};

// Update configuration for more conservative rate limits
const WEBHOOK_CONFIG = {
    url: "https://hooks.zapier.com/hooks/catch/2467580/2k13nvf/",
    rateLimit: {
        maxRequests: 10,    // 10 requests
        perSeconds: 30      // per 30 seconds
    }
};

// Update configuration for maximum speed to Taalk
const BATCH_SIZE = 4;      // Increased to 200 leads per batch
const BATCH_DELAY = 500;     // Reduced to 500ms between batches
const API_DELAY = 100;       // Reduced to 100ms between API calls
const MAX_RETRIES = 3;
const BACKOFF_DELAY = 5000;

// Add tracking file configuration
const PROCESSED_LEADS_FILE = path.join(__dirname, 'processed_leads.json');

// Add this near the top with other constants
const MAX_WEBHOOK_FAILURES = 3; // Stop processing after 3 consecutive failures
let consecutiveWebhookFailures = 0;

// Add at top with other constants
const SESSION_LOG_DIR = path.join(__dirname, 'session_logs');
const sessionLeads = []; // Track leads sent this session

const ZOHO_API_CONFIG = {
    base_url: "https://www.zohoapis.com/crm/v2/leads",
    access_token: process.env.ZOHO_ACCESS_TOKEN
};

// Load processed leads from file
function loadProcessedLeads() {
    try {
        if (fs.existsSync(PROCESSED_LEADS_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(PROCESSED_LEADS_FILE, 'utf8')));
        }
    } catch (error) {
        console.error('Error loading processed leads:', error);
    }
    return new Set();
}

// Save processed leads to file
function saveProcessedLeads(processedLeads) {
    try {
        fs.writeFileSync(PROCESSED_LEADS_FILE, JSON.stringify([...processedLeads]));
    } catch (error) {
        console.error('Error saving processed leads:', error);
    }
}

// Helper function for exponential backoff
async function retryWithBackoff(fn, retries = MAX_RETRIES, delay = BACKOFF_DELAY) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0 || !error.message.includes('429')) {
            throw error;
        }
        console.log(`Rate limited. Waiting ${delay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

// Helper function for delays
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Send Lead to Taalk API
async function sendLeadToTaalk(requestBody, campaignId) {
    return retryWithBackoff(async () => {
        const url = `${TAALK_API_CONFIG.base_url}/${campaignId}/contacts`;
        console.log('Sending lead to Taalk API:', { url, body: requestBody });

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TAALK_API_CONFIG.api_key}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Lead successfully sent to Taalk API:', data);
        return data;
    });
}

// Add throttle helper
let lastWebhookBatch = Date.now();
const webhookQueue = [];

// Modified webhook sending function
async function sendLeadToWebhook(lead) {
    try {
        const webhookData = {
            LeadID: lead.LeadID,
            FirstName: lead.FirstName,
            LastName: lead.LastName,
            PrimaryPhone: lead.PrimaryPhone,
            PrimaryEmail: lead.PrimaryEmail,
            Address1: lead.Address1,
            Zip: lead.Zip,
            City: lead.City,
            State: lead.State,
            GroupCode: lead.GroupCode,
            SecurityKeyword: lead.SecurityKeyword,
            Beneficiary: lead.Beneficiary,
            Relationship: lead.Relationship,
            MarketName: lead.MarketName,
            CampaignID: lead.CampaignID
        };

        const response = await fetch(WEBHOOK_CONFIG.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
        });

        if (!response.ok) {
            throw new Error(`Webhook Error: ${response.status}`);
        }
        console.log(`✓ Sent lead ${lead.LeadID} to Zapier webhook`);
        return true;
    } catch (error) {
        console.error(`Failed to send lead ${lead.LeadID} to webhook:`, error);
        throw error;
    }
}

// Modify processBatch to log successful sends
async function processBatch(leads, startIndex, filepath) {
    const batchLeads = leads.slice(startIndex, startIndex + BATCH_SIZE);
    
    try {
        for (const lead of batchLeads) {
            if (!lead.CampaignID) continue;
            
            const requestBody = {
                "append": [{
                    "phone": lead.PrimaryPhone,
                    "firstName": lead.FirstName,
                    "lastName": lead.LastName,
                    "Taalk_Email": lead.PrimaryEmail,
                    "Taalk_State": lead.State,
                    "Taalk_Zip": lead.Zip,
                    "Taalk_GroupCode": lead.GroupCode,
                    "Taalk_Address": lead.Address1,
                    "Taalk_City": lead.City,
                    "Taalk_Market": lead.MarketName,
                    "Taalk_Lead_Source": lead.SecurityKeyword || "none",
                    "Taalk_LeadId": lead.LeadID,
                    "Taalk_secretKey": lead.SecurityKeyword || "none",
                    "campaignId": lead.CampaignID
                }]
            };

            await sendLeadToTaalk(requestBody, lead.CampaignID);
            await leadTracker.trackLeadSent(lead, 'SENT', filepath);
            
            // Add to session log
            sessionLeads.push({
                LeadID: lead.LeadID,
                FirstName: lead.FirstName,
                LastName: lead.LastName,
                Email: lead.PrimaryEmail,
                Phone: lead.PrimaryPhone,
                State: lead.State,
                CampaignID: lead.CampaignID,
                SentAt: new Date().toISOString()
            });
            
            await delay(API_DELAY);
        }

        await delay(BATCH_DELAY);
        
    } catch (error) {
        console.error('Batch processing error:', error.message);
        throw error;
    }
}

// Add function to write session log
async function writeSessionLog() {
    if (sessionLeads.length === 0) {
        console.log('No leads sent this session');
        return;
    }

    // Create session_logs directory if it doesn't exist
    if (!fs.existsSync(SESSION_LOG_DIR)) {
        fs.mkdirSync(SESSION_LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(SESSION_LOG_DIR, `taalk_sent_${timestamp}.csv`);

    const csvWriter = createCsvWriter({
        path: logPath,
        header: [
            {id: 'LeadID', title: 'Lead ID'},
            {id: 'FirstName', title: 'First Name'},
            {id: 'LastName', title: 'Last Name'},
            {id: 'Email', title: 'Email'},
            {id: 'Phone', title: 'Phone'},
            {id: 'State', title: 'State'},
            {id: 'CampaignID', title: 'Campaign ID'},
            {id: 'SentAt', title: 'Sent At'}
        ]
    });

    await csvWriter.writeRecords(sessionLeads);
    console.log(`Session log written to: ${logPath}`);
}

// Process CSV File
async function processFile(filepath) {
    console.log('Processing file:', filepath);
    const processedLeads = loadProcessedLeads();

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
        format: 'Sending to Taalk API |{bar}| {percentage}% | {value}/{total} Leads',
        barCompleteChar: '=',
        barIncompleteChar: '-'
    });

    return new Promise((resolve, reject) => {
        const leads = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => leads.push(row))
            .on('end', async () => {
                try {
                    console.log(`Parsed ${leads.length} leads from file: ${filepath}`);
                    let allLeadsProcessed = true;

                    // Filter out already processed leads and those without campaign IDs
                    const validLeads = leads.filter(lead => {
                        if (!lead.LeadID) {
                            console.log('Skipping lead - missing LeadID');
                            return false;
                        }
                        if (processedLeads.has(lead.LeadID)) {
                            console.log(`Skipping lead ${lead.LeadID} - already processed`);
                            return false;
                        }
                        if (!lead.CampaignID) {
                            console.log(`Skipping lead ${lead.LeadID} - missing campaign ID`);
                            return false;
                        }
                        return true;
                    });

                    console.log(`Found ${validLeads.length} new valid leads to process`);

                    // Process valid leads in batches
                    if (validLeads.length > 0) {
                        progressBar.start(validLeads.length, 0);
                        for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
                            try {
                                await processBatch(validLeads, i, filepath);
                                
                                // Mark batch as processed only after successful sending
                                validLeads.slice(i, i + BATCH_SIZE).forEach(lead => {
                                    processedLeads.add(lead.LeadID);
                                });
                                saveProcessedLeads(processedLeads);
                                progressBar.update(i + BATCH_SIZE);
                            } catch (error) {
                                console.error('Batch processing failed:', error);
                                allLeadsProcessed = false;
                                break;
                            }
                        }
                        progressBar.stop();
                        console.log(`✓ Sent ${validLeads.length} leads to Taalk API`);
                    }

                    // Only archive if all leads were processed successfully
                    if (allLeadsProcessed) {
                        const filename = path.basename(filepath);
                        const archivePath = path.join(ARCHIVE_DIR, filename);
                        fs.renameSync(filepath, archivePath);
                        console.log(`File successfully processed and archived: ${archivePath}`);
                    } else {
                        console.log(`File ${filepath} not archived due to processing errors`);
                    }
                    
                    resolve();
                } catch (error) {
                    progressBar.stop();
                    reject(error);
                }
            });
    });
}

// Create all required directories
[EXPORTS_DIR, PROCESSED_DIR, ARCHIVE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.log(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Modify main function to write session log when done
async function main() {
    try {
        console.log('Checking directory:', PROCESSED_DIR);
        const files = fs.readdirSync(PROCESSED_DIR)
            .filter(file => file.endsWith('.csv'))
            .map(file => path.join(PROCESSED_DIR, file));

        if (files.length === 0) {
            console.log('No CSV files found in:', PROCESSED_DIR);
            return;
        }

        for (const file of files) {
            try {
                await processFile(file);
            } catch (error) {
                console.error(`Failed to process file ${file}:`, error.message);
            }
        }

        // Write session log after processing all files
        await writeSessionLog();
        
    } catch (error) {
        console.error('Unhandled error:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('Unhandled error in main execution:', error.message);
    process.exit(1);
});

async function processLeads() {
    try {
        // Get files from processed directory
        const files = fs.readdirSync(PROCESSED_DIR)
            .filter(file => file.startsWith('airtable_export_'));

        console.log(`\nFound ${files.length} files to process`);
        let totalSent = 0;

        for (const file of files) {
            const filePath = path.join(PROCESSED_DIR, file);
            console.log(`\nProcessing ${file}...`);
            
            const leads = await processFile(filePath);
            console.log(`Found ${leads.length} leads in file`);

            // Send leads in batches
            for (const lead of leads) {
                try {
                    // First send to Taalk
                    await sendLeadToTaalk(lead, lead.CampaignID);
                    
                    // Then send to Zapier webhook
                    await sendLeadToWebhook(lead);

                    totalSent++;
                    console.log(`✓ Lead ${lead.LeadID} processed successfully`);
                } catch (error) {
                    console.error(`Error processing lead ${lead.LeadID}:`, error);
                }
            }

            console.log(`\nProcessed ${totalSent} leads from ${file}`);
        }

        console.log(`\nTotal leads processed: ${totalSent}`);
        return totalSent > 0;

    } catch (error) {
        console.error('Error processing leads:', error);
        return false;
    }
}

// Export the correct function
module.exports = {
    processLeads
};

async function sendToZoho(lead) {
    try {
        const response = await fetch(ZOHO_API_CONFIG.base_url, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_API_CONFIG.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: [{
                    First_Name: lead.FirstName,
                    Last_Name: lead.LastName,
                    Phone: lead.PrimaryPhone,
                    Email: lead.PrimaryEmail,
                    State: lead.StateCode,
                    Zip_Code: lead.Zip,
                    Group_Code: lead.GroupCode,
                    Address: lead.Address1,
                    City: lead.LeadCityName,
                    Lead_Source: lead['Security Keyword'] || "none",
                    Lead_ID: lead.LeadID
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Zoho API Error: ${response.status}`);
        }

        console.log(`✓ Sent lead ${lead.LeadID} to Zoho`);
        return true;

    } catch (error) {
        console.error(`Failed to send lead ${lead.LeadID} to Zoho:`, error);
        throw error;
    }
}
