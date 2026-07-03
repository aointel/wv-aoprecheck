import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import path from 'path';

const TAALK_API_CONFIG = {
    baseUrl: "https://lets.taalk.ai/api/campaign2s",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
};

// Load campaign mappings
const campaignList = parse(fs.readFileSync('CampaignList.csv', 'utf8'), { columns: true });

function getCampaignId(state, market) {
    const campaign = campaignList.find(c => 
        c.State === state && 
        c.Market === market
    );
    return campaign?.Campaign || null;
}

// Add sent tracking
const SENT_LEADS_FILE = './sent_to_taalk.json';

// Load already sent leads
function loadSentLeads() {
    try {
        if (fs.existsSync(SENT_LEADS_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(SENT_LEADS_FILE)));
        }
    } catch (error) {
        console.error('Error loading sent leads:', error);
    }
    return new Set();
}

// Track what we've sent
const sentLeads = loadSentLeads();

// Add rate limit config
const RATE_LIMIT = {
    batchSize: 10,      // Send 10 leads at a time
    delayMs: 1000       // Wait 1 second between batches
};

async function sendToTaalk(lead, campaignId, market) {
    // Don't send if already sent
    const leadKey = `${lead.LeadID}-${lead.PrimaryPhone}`;
    if (sentLeads.has(leadKey)) {
        console.log(`Already sent lead ${lead.LeadID}`);
        return;
    }

    const url = `${TAALK_API_CONFIG.baseUrl}/${campaignId}/contacts`;
    
    const payload = {
        append: [{
            Taalk_LeadId: lead.LeadID,
            firstName: lead.FirstName,
            lastName: lead.LastName,
            phone: lead.PrimaryPhone,
            state: lead.State,
            campaignId: campaignId,
            Taalk_Market: market,  // Use actual market
            Taalk_State: lead.State,
            Taalk_GroupCode: lead.GroupCode,
            email: lead.PrimaryEmail,
            address: lead.Address1,
            city: lead.City,
            zip: lead.Zip,
            language: lead.Language,
            languageDescription: lead.LanguageDescription,
            securityKeyword: lead.SecurityKeyword
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TAALK_API_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        console.log(`✓ Sent lead ${lead.LeadID} to campaign ${campaignId}`);

        // Track that we sent it
        sentLeads.add(leadKey);
        fs.writeFileSync(SENT_LEADS_FILE, JSON.stringify([...sentLeads]));
        return true;
    } catch (error) {
        console.error(`Failed to send lead ${lead.LeadID}:`, error.message);
        return false;
    }
}

async function removeFromTaalk(phone, campaignId) {
    const url = `${TAALK_API_CONFIG.baseUrl}/${campaignId}/contacts`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TAALK_API_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                remove: [phone]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        console.log(`✓ Removed phone ${phone} from campaign ${campaignId}`);
        return true;
    } catch (error) {
        console.error(`Failed to remove phone ${phone}:`, error.message);
        return false;
    }
}

function getMarketFromGroupCode(groupCode) {
    if (groupCode.includes('PAVET') || groupCode.includes('VET')) {
        return 'Vet';
    }
    if (groupCode.includes('NCL') || groupCode.includes('Womens')) {
        return 'Will Kit';  // Both NCL and Womens map to Will Kit
    }
    if (groupCode.includes('GLOBE') || groupCode.includes('VN125')) {
        return 'Globe';
    }
    return null;
}

// Only log campaign not found for leads we actually want to send
async function processLeadsFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const leads = parse(fileContent, { columns: true });
        
        console.log(`\nProcessing ${leads.length} leads from ${path.basename(filePath)}`);

        let batchCount = 0;
        
        // Process each lead
        for (const lead of leads) {
            const market = getMarketFromGroupCode(lead.GroupCode);
            const campaignId = getCampaignId(lead.State, market);
            
            if (market && campaignId && lead.PrimaryPhone) {
                console.log(`${lead.FirstName} ${lead.LastName} -> ${market}`);
                await sendToTaalk(lead, campaignId, market);
                
                // Add rate limiting
                batchCount++;
                if (batchCount % RATE_LIMIT.batchSize === 0) {
                    console.log(`Pausing for rate limit...`);
                    await new Promise(r => setTimeout(r, RATE_LIMIT.delayMs));
                }
            }
        }

    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
}

async function processLeadsForRemoval(filePath) {
    try {
        // Read and parse the CSV
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const allLeads = parse(fileContent, { columns: true });
        
        // Filter for only NCL leads
        const nclLeads = allLeads.filter(lead => lead.GroupCode?.includes('NCL'));
        
        console.log(`Found ${allLeads.length} total leads`);
        console.log(`Found ${nclLeads.length} NCL leads to remove`);

        // Remove each NCL lead
        for (const lead of nclLeads) {
            if (lead.CampaignID && lead.PrimaryPhone) {
                console.log(`\nRemoving NCL lead:`);
                console.log(`Name: ${lead.FirstName} ${lead.LastName}`);
                console.log(`Phone: ${lead.PrimaryPhone}`);
                console.log(`State: ${lead.State}`);
                console.log(`Group: ${lead.GroupCode}`);
                console.log(`From Campaign: ${lead.CampaignID}`);
                
                await removeFromTaalk(lead.PrimaryPhone, lead.CampaignID);
                // Small delay between API calls
                await new Promise(r => setTimeout(r, 100));
            } else {
                console.log(`Skipping NCL lead ${lead.LeadID} - missing campaign or phone`);
            }
        }

    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
}

const EXPORTS_DIR = './exports';

// Remove command line arguments and replace with this:
console.log('Starting lead processing...');

// Get all export files from exports directory
const files = fs.readdirSync(EXPORTS_DIR)
    .filter(f => f.startsWith('airtable_export_') && f.endsWith('.csv'))
    .sort(); // Process in order

console.log(`Found ${files.length} export files to process`);

// Process each export file
for (const file of files) {
    const filePath = path.join(EXPORTS_DIR, file);
    console.log(`\nProcessing file: ${file}`);
    await processLeadsFile(filePath);
} 