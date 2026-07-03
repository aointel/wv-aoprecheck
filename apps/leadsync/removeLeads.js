const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const ARCHIVE_DIR = path.join(__dirname, 'archived');
const TAALK_API_CONFIG = {
    base_url: "https://lets.taalk.ai/api/campaign2s",
    api_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay43NWVlNDkzMy0yZGVkLTRkOGUtYWE4ZC1iNThkMDAxNDNhMmEiLCJleHAiOjIwMjE3NzcyMTd9.hFSckjPzzfWm1PKnheHHwfUQwi-L9VEytvStRXgLvRk"
};

async function findLeadInArchivedFiles(leadId, phone) {
    // Get most recent archived file
    const files = fs.readdirSync(ARCHIVE_DIR)
        .filter(file => file.endsWith('.csv'))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first

    for (const file of files) {
        const filePath = path.join(ARCHIVE_DIR, file);
        const leads = [];
        
        await new Promise((resolve) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => leads.push(row))
                .on('end', resolve);
        });

        // Find matching lead
        const lead = leads.find(l => 
            l.LeadID === leadId && 
            l.PrimaryPhone === phone
        );

        if (lead) {
            return {
                campaignId: lead.CampaignID,
                leadData: lead
            };
        }
    }
    return null;
}

async function removeLeadFromCampaign(leadId, phone, campaignId) {
    const url = `${TAALK_API_CONFIG.base_url}/${campaignId}/contacts/${leadId}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${TAALK_API_CONFIG.api_key}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to remove lead: ${response.statusText}`);
        }

        console.log(`Successfully removed lead ${leadId} from campaign ${campaignId}`);
        return true;
    } catch (error) {
        console.error(`Error removing lead ${leadId}:`, error);
        return false;
    }
}

async function processLeadRemoval(leadId, phone) {
    console.log(`Processing removal for lead ${leadId} (${phone})`);

    // Find lead in archived files
    const leadInfo = await findLeadInArchivedFiles(leadId, phone);
    
    if (!leadInfo) {
        console.log(`Lead ${leadId} not found in archived files`);
        return false;
    }

    // Remove from Taalk campaign
    return await removeLeadFromCampaign(leadId, phone, leadInfo.campaignId);
}

module.exports = {
    processLeadRemoval
}; 