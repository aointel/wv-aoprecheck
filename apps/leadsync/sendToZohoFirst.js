console.log('\n=== sendToZohoFirst.js loaded ===');

import fs from 'fs';
import csv from 'csv-parser';
import fetch from 'node-fetch';
import path from 'path';
import { parse } from 'csv-parse';
import { readFile } from 'fs/promises';

const BATCH_SIZE = 200;
const API_DELAY = 100;
const MAX_RETRIES = 3;
const EXPORTS_DIR = './exports';

const WEBHOOK_CONFIG = {
    url: "https://hooks.zapier.com/hooks/catch/2467580/2fxhzfp/",
    rateLimit: {
        maxRequests: 50,    // Send 50 leads
        perSeconds: 10,     // Every 10 seconds
        batchDelay: 10000   // Wait 10 seconds between batches
    }
};

// Add tracking for both Zoho and Taalk
const SENT_LEADS_FILE = './exports/sent_leads.json';
const SENT_TO_TAALK_FILE = './exports/sent_to_taalk.json';

// Load sent leads (for either service)
function loadSentLeads(filename) {
    try {
        if (fs.existsSync(filename)) {
            return new Set(JSON.parse(fs.readFileSync(filename)));
        }
    } catch (error) {
        console.error(`Error loading from ${filename}:`, error);
    }
    return new Set();
}

// Save sent leads (for either service)
function saveSentLeads(sentLeads, filename) {
    try {
        fs.writeFileSync(filename, JSON.stringify([...sentLeads]));
    } catch (error) {
        console.error(`Error saving to ${filename}:`, error);
    }
}

// First load campaign mappings
async function loadCampaignMappings() {
    const mappings = {};
    return new Promise((resolve, reject) => {
        fs.createReadStream('CampaignList.csv')
            .pipe(csv())
            .on('data', (row) => {
                const state = row.State;
                const market = row.Market;
                const campaign = row.Campaign;

                if (!mappings[state]) mappings[state] = {};
                mappings[state][market] = campaign;
            })
            .on('end', () => {
                console.log('Campaign mappings loaded:', mappings); // Debug
                resolve(mappings);
            })
            .on('error', reject);
    });
}

function getMarketFromGroupCode(groupCode) {
    if (groupCode.includes('PAVET') || groupCode.includes('VET')) {
        return 'Vet';  // Changed from 'Veteran' to 'Vet' to match CampaignList.csv
    }
    if (groupCode.includes('NCL')) {
        return 'Will Kit';
    }
    if (groupCode.includes('GLOBE') || groupCode.includes('VN125')) {
        return 'Globe';
    }
    return null;
}

async function sendWithRetry(lead, retries = MAX_RETRIES) {
    console.log('\n=== Sending Lead to Taalk ===');
    console.log({
        leadId: lead.append[0].Taalk_LeadId,
        name: `${lead.append[0].firstName} ${lead.append[0].lastName}`,
        market: lead.append[0].Taalk_Market,
        state: lead.append[0].Taalk_State,
        campaignId: lead.append[0].campaignId,
        groupCode: lead.append[0].Taalk_GroupCode
    });

    for (let i = 0; i < retries; i++) {
        try {
            const url = `https://lets.taalk.ai/api/campaign2s/${lead.append[0].campaignId}/contacts`;
            console.log(`Sending to: ${url}`);
            
            const market = getMarketFromGroupCode(lead.append[0].Taalk_GroupCode);
            const campaignId = market && lead.append[0].Taalk_State ? 
                campaignMappings[lead.append[0].Taalk_State]?.[market] : '';

            // Skip leads without campaign ID
            if (!campaignId) {
                console.log(`Skipping lead ${lead.append[0].LeadID} - no campaign ID found for ${lead.append[0].Taalk_State}/${market}`);
                continue;
            }

            const payload = {
                append: [{
                    Taalk_LeadId: lead.append[0].LeadID,
                    firstName: lead.append[0].firstName,
                    lastName: lead.append[0].lastName,
                    phone: lead.append[0].PrimaryPhone,
                    Taalk_Email: lead.append[0].PrimaryEmail,
                    Taalk_State: lead.append[0].State,
                    Taalk_GroupCode: lead.append[0].GroupCode,
                    campaignId: campaignId,
                    Taalk_secretKey: lead.append[0].SecurityKeyword  // Use the SecurityKeyword from the lead data
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.TAALK_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            // Only try to parse JSON if response was ok
            const responseData = await response.json();
            console.log(`Taalk API Response:`, responseData);
            
            return response;

        } catch (error) {
            console.error(`Attempt ${i + 1}/${retries} failed:`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function sendLeadsToTaalk(filePath) {
    try {
        console.log('Reading leads from:', filePath);
        
        // Load leads from CSV
        const leads = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (lead) => leads.push(lead))
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Found ${leads.length} total leads`);

        // Load campaign mappings
        const campaignMappings = await loadCampaignMappings();

        // Process each lead
        for (const lead of leads) {
            const market = getMarketFromGroupCode(lead.GroupCode);
            const campaignId = market && lead.State ? 
                campaignMappings[lead.State]?.[market] : '';

            // Skip leads without campaign ID
            if (!campaignId) {
                console.log(`Skipping lead ${lead.LeadID} - no campaign ID found for ${lead.State}/${market}`);
                continue;
            }

            const payload = {
                append: [{
                    Taalk_LeadId: lead.LeadID,
                    firstName: lead.FirstName,
                    lastName: lead.LastName,
                    phone: lead.PrimaryPhone,
                    Taalk_Email: lead.PrimaryEmail,
                    Taalk_State: lead.State,
                    Taalk_GroupCode: lead.GroupCode,
                    campaignId: campaignId,
                    Taalk_secretKey: lead.SecurityKeyword
                }]
            };

            await sendWithRetry(payload);
            await new Promise(r => setTimeout(r, 100));
        }

    } catch (error) {
        console.error('Error sending to Taalk:', error);
        throw error;
    }
}

// Re-add the webhook function
async function sendLeadToWebhook(lead) {
    const response = await fetch(WEBHOOK_CONFIG.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(lead)
    });

    if (!response.ok) {
        throw new Error(`Webhook Error: ${response.status}`);
    }

    console.log(`✓ Sent lead ${lead.LeadID} to webhook`);
}

// Re-add the Zoho function
async function sendLeadsToZohoCRM() {
    try {
        console.log('\n=== Starting Zoho Sync ===');
        
        // Load already sent leads
        const sentLeads = loadSentLeads(SENT_LEADS_FILE);
        console.log(`Already sent ${sentLeads.size} leads to webhook`);

        const files = fs.readdirSync(EXPORTS_DIR)
            .filter(file => file.startsWith('airtable_export_'));
        
        let totalSent = 0;

        for (const file of files) {
            try {
                const leads = [];
                await new Promise((resolve, reject) => {
                    fs.createReadStream(path.join(EXPORTS_DIR, file))
                        .pipe(csv())
                        .on('data', (lead) => {
                            // Only add if not already sent
                            if (!sentLeads.has(lead.LeadID)) {
                                leads.push(lead);
                            }
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });

                console.log(`Found ${leads.length} new leads in ${file}`);

                // Send in batches
                for (let i = 0; i < leads.length; i += WEBHOOK_CONFIG.rateLimit.maxRequests) {
                    const batch = leads.slice(i, i + WEBHOOK_CONFIG.rateLimit.maxRequests);
                    
                    for (const lead of batch) {
                        await sendLeadToWebhook(lead);
                        sentLeads.add(lead.LeadID);  // Track sent lead
                        totalSent++;
                    }

                    if (batch.length > 0) {
                        saveSentLeads(sentLeads, SENT_LEADS_FILE);  // Save after each batch
                        console.log(`Sent ${totalSent} leads. Waiting ${WEBHOOK_CONFIG.rateLimit.perSeconds} seconds...`);
                        await new Promise(r => setTimeout(r, WEBHOOK_CONFIG.rateLimit.batchDelay));
                    }
                }

                // After successfully sending all leads from this file
                if (totalSent > 0) {
                    // Create archived dir if needed
                    const archivedDir = './archived';
                    if (!fs.existsSync(archivedDir)) {
                        fs.mkdirSync(archivedDir);
                    }

                    // Move file to archived
                    console.log(`\nMoving processed file to archived: ${file}`);
                    fs.renameSync(
                        path.join(EXPORTS_DIR, file),
                        path.join(archivedDir, file)
                    );
                }

            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }

        console.log(`Successfully sent ${totalSent} new leads to webhook`);
        return true;

    } catch (error) {
        console.error('Error in sendLeadsToZohoCRM:', error);
        return false;
    }
}

// Export both functions
export { sendLeadsToTaalk, sendLeadsToZohoCRM };