const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const REPORTS_DIR = path.join(__dirname, 'reports');
const TRACKING_FILE = path.join(REPORTS_DIR, 'taalk_sent_leads.csv');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Create tracking file if it doesn't exist
if (!fs.existsSync(TRACKING_FILE)) {
    const headers = [
        'LeadID',
        'FirstName',
        'LastName',
        'PrimaryPhone',
        'State',
        'GroupCode',
        'CampaignID',
        'SentTimestamp',
        'Status',
        'SourceFile'
    ].join(',') + '\n';
    
    fs.writeFileSync(TRACKING_FILE, headers);
}

async function trackLeadSent(lead, status = 'SENT', sourceFile = '') {
    try {
        const timestamp = new Date().toISOString();
        const leadData = [
            lead.LeadID || '',
            lead.FirstName || '',
            lead.LastName || '',
            lead.PrimaryPhone || '',
            lead.State || '',
            lead.GroupCode || '',
            lead.CampaignID || '',
            timestamp,
            status,
            sourceFile
        ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';

        fs.appendFileSync(TRACKING_FILE, leadData);
        
        console.log(`Tracked lead ${lead.LeadID} sent to campaign ${lead.CampaignID}`);
        return true;
    } catch (error) {
        console.error('Error tracking lead:', error);
        return false;
    }
}

function getTrackedLeads() {
    try {
        const leads = [];
        if (fs.existsSync(TRACKING_FILE)) {
            const fileContent = fs.readFileSync(TRACKING_FILE, 'utf8');
            const rows = fileContent.split('\n').slice(1); // Skip header
            rows.forEach(row => {
                if (row.trim()) {
                    const [
                        LeadID, FirstName, LastName, PrimaryPhone,
                        State, GroupCode, CampaignID, SentTimestamp,
                        Status, SourceFile
                    ] = row.split(',').map(field => field.replace(/^"|"$/g, ''));
                    
                    leads.push({
                        LeadID, FirstName, LastName, PrimaryPhone,
                        State, GroupCode, CampaignID, 
                        SentTimestamp: new Date(SentTimestamp),
                        Status, SourceFile
                    });
                }
            });
        }
        return leads;
    } catch (error) {
        console.error('Error reading tracked leads:', error);
        return [];
    }
}

module.exports = {
    trackLeadSent,
    getTrackedLeads
}; 