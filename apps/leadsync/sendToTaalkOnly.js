import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import fetch from 'node-fetch';

// Change to archived folder
const ARCHIVED_DIR = './archived';
const FINAL_ARCH_DIR = './finalarchives';

// Load campaign mappings first
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
            .on('end', () => resolve(mappings))
            .on('error', reject);
    });
}

function getMarketFromGroupCode(groupCode) {
    if (groupCode.includes('PAVET') || groupCode.includes('VET')) return 'Vet';
    if (groupCode.includes('NCL')) return 'Will Kit';
    if (groupCode.includes('GLOBE') || groupCode.includes('VN125')) return 'Globe';
    return null;
}

async function sendLeadBatch(leads, campaignId) {
    const payload = {
        append: leads.map(lead => ({
            Taalk_LeadId: lead.LeadID,
            firstName: lead.FirstName,
            lastName: lead.LastName,
            phone: lead.PrimaryPhone,
            Taalk_Email: lead.PrimaryEmail,
            Taalk_State: lead.State,
            Taalk_City: lead.City,
            Taalk_GroupCode: lead.GroupCode,
            campaignId: campaignId,
            Taalk_secretKey: lead["SecurityKeyword"] || ""
        }))
    };

    const response = await fetch(`https://lets.taalk.ai/api/campaign2s/${campaignId}/contacts`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    console.log(`✓ Sent batch of ${leads.length} leads to campaign ${campaignId}`);
}

// Main function
async function sendToTaalk() {
    try {
        // Get ALL files from archived folder
        const files = fs.readdirSync(ARCHIVED_DIR)
            .filter(file => file.startsWith('airtable_export_'))
            .sort((a, b) => b.localeCompare(a));

        if (files.length === 0) {
            console.log('No archived files found');
            return;
        }

        console.log(`Found ${files.length} files to process`);
        const campaignMappings = await loadCampaignMappings();

        // Ensure finalarchives folder exists
        if (!fs.existsSync(FINAL_ARCH_DIR)) {
            fs.mkdirSync(FINAL_ARCH_DIR, { recursive: true });
        }

        // Process EACH file
        for (const file of files) {
            console.log(`\nProcessing ${file}...`);
            
            // Group leads by campaign
            const campaignLeads = {};
            
            // Read leads from file
            const leads = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(path.join(ARCHIVED_DIR, file))
                    .pipe(csv())
                    .on('data', (lead) => {
                        if (!lead.LeadID || !lead.State || !lead.GroupCode) return;

                        const market = getMarketFromGroupCode(lead.GroupCode);
                        const campaignId = market && lead.State ? 
                            campaignMappings[lead.State]?.[market] : '';

                        if (!campaignId) return;

                        // Group by campaign
                        if (!campaignLeads[campaignId]) {
                            campaignLeads[campaignId] = [];
                        }
                        campaignLeads[campaignId].push(lead);
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Send leads in batches by campaign
            for (const [campaignId, leads] of Object.entries(campaignLeads)) {
                // Send in batches of 50
                for (let i = 0; i < leads.length; i += 50) {
                    const batch = leads.slice(i, i + 50);
                    try {
                        await sendLeadBatch(batch, campaignId);
                        // Small delay between batches
                        await new Promise(r => setTimeout(r, 250));
                    } catch (error) {
                        console.error(`Failed to send batch to ${campaignId}:`, error.message);
                    }
                }
            }

            console.log(`Completed processing ${file}`);

            // Move file from archived/ to finalarchives/
            const sourcePath = path.join(ARCHIVED_DIR, file);
            const destPath = path.join(FINAL_ARCH_DIR, file);
            fs.renameSync(sourcePath, destPath);
            console.log(`Moved ${file} to finalarchives`);
        }

        console.log('\nFinished processing all files');

    } catch (error) {
        console.error('Error:', error);
    }
}

// ADDED: Export the function so other modules can import it
export { sendToTaalk };

// Optionally, remove or comment out the line:
// sendToTaalk().catch(console.error); 