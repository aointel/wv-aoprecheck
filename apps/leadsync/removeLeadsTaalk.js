import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const TAALK_API_CONFIG = {
    baseUrl: "https://lets.taalk.ai/api/campaign2s",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
};

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

async function processArchivedFiles() {
    try {
        const archivedDir = './archived';
        
        // Get all CSV files from archived directory
        const files = fs.readdirSync(archivedDir)
            .filter(file => file.startsWith('airtable_export_') && file.endsWith('.csv'))
            .sort((a, b) => b.localeCompare(a)); // Process newest first
            
        console.log(`Found ${files.length} archived files to process`);

        let totalLeads = 0;
        let totalNCLLeads = 0;

        // Process each archived file
        for (const file of files) {
            console.log(`\nProcessing ${file}...`);
            const filePath = path.join(archivedDir, file);
            
            // Read and parse the CSV
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const allLeads = parse(fileContent, { columns: true });
            
            // Filter for only NCL leads
            const nclLeads = allLeads.filter(lead => lead.GroupCode?.includes('NCL'));
            
            console.log(`- File has ${allLeads.length} total leads`);
            console.log(`- Found ${nclLeads.length} NCL leads to remove`);
            
            totalLeads += allLeads.length;
            totalNCLLeads += nclLeads.length;

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
                }
            }
        }

        console.log('\nRemoval Summary:');
        console.log(`Total files processed: ${files.length}`);
        console.log(`Total leads found: ${totalLeads}`);
        console.log(`Total NCL leads removed: ${totalNCLLeads}`);

    } catch (error) {
        console.error('Error processing archived files:', error);
        throw error;
    }
}

// Run the removal process
console.log('Starting NCL lead removal from archived files...');
processArchivedFiles().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
}); 