const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const REPORTS_DIR = path.join(__dirname, 'reports');
const TRACKING_FILE = path.join(REPORTS_DIR, 'taalk_sent_leads.csv');
const ZOHO_REPORT_FILE = path.join(REPORTS_DIR, 'zoho_leads_report.csv');

// Sample data structure
const sampleLeads = [
    {
        LeadID: "16918921",
        FirstName: "John",
        LastName: "Smith",
        PrimaryPhone: "5551234567",
        State: "FL",
        GroupCode: "NCL07",
        CampaignID: "67847e69477432a7c853f1c3",
        SentTimestamp: new Date().toISOString(),
        Status: "SENT",
        SourceFile: "airtable_export_2025-01-30T16-22-44-975Z.csv"
    },
    // Add more sample leads...
];

// Create reports directory if it doesn't exist
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Generate tracking file with sample data
function generateTrackingFile() {
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

    const rows = sampleLeads.map(lead => {
        return [
            lead.LeadID,
            lead.FirstName,
            lead.LastName,
            lead.PrimaryPhone,
            lead.State,
            lead.GroupCode,
            lead.CampaignID,
            lead.SentTimestamp,
            lead.Status,
            lead.SourceFile
        ].map(field => `"${field}"`).join(',');
    }).join('\n');

    fs.writeFileSync(TRACKING_FILE, headers + rows);
    console.log(`Generated tracking file: ${TRACKING_FILE}`);
}

// Generate Zoho-formatted report
function generateZohoReport() {
    const zohoHeaders = [
        'Lead ID',
        'First Name',
        'Last Name',
        'Phone',
        'State',
        'Group Code',
        'Campaign ID',
        'Sent Date',
        'Lead Status',
        'Source'
    ].join(',') + '\n';

    const zohoRows = sampleLeads.map(lead => {
        return [
            lead.LeadID,
            lead.FirstName,
            lead.LastName,
            lead.PrimaryPhone,
            lead.State,
            lead.GroupCode,
            lead.CampaignID,
            new Date(lead.SentTimestamp).toLocaleString(),
            lead.Status,
            'Taalk'
        ].map(field => `"${field}"`).join(',');
    }).join('\n');

    fs.writeFileSync(ZOHO_REPORT_FILE, zohoHeaders + zohoRows);
    console.log(`Generated Zoho report: ${ZOHO_REPORT_FILE}`);
}

// Run the generators
generateTrackingFile();
generateZohoReport(); 