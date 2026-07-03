require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

// Configuration
const ARCHIVE_DIR = path.join(__dirname, 'archived');
const ZOHO_CONFIG = {
    baseUrl: 'https://voice.zoho.com/rest/json/zv/api',
    queueId: '2069000000407011',
    auth: {
        client_id: process.env.ZOHO_QUEUE_CLIENT_ID,
        client_secret: process.env.ZOHO_QUEUE_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_QUEUE_REFRESH_TOKEN,
        auth_token: null
    }
};

// Add refresh token function
async function refreshQueueToken() {
    try {
        const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: ZOHO_CONFIG.auth.refresh_token,
                client_id: ZOHO_CONFIG.auth.client_id,
                client_secret: ZOHO_CONFIG.auth.client_secret,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();
        if (data.access_token) {
            ZOHO_CONFIG.auth.auth_token = data.access_token;
            return data.access_token;
        } else {
            throw new Error('Failed to refresh token: ' + JSON.stringify(data));
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
        throw error;
    }
}

async function getLeadsFromArchive() {
    try {
        // Get most recent archived file
        const files = fs.readdirSync(ARCHIVE_DIR)
            .filter(file => file.endsWith('.csv'))
            .sort((a, b) => b.localeCompare(a));

        if (files.length === 0) {
            console.log('No archived files found');
            return [];
        }

        const filePath = path.join(ARCHIVE_DIR, files[0]);
        const leads = [];

        await new Promise((resolve) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => leads.push(row))
                .on('end', resolve);
        });

        return leads;
    } catch (error) {
        console.error('Error reading archived leads:', error);
        throw error;
    }
}

async function updateQueue(leads) {
    try {
        // Format leads for Zoho queue
        const memberIds = leads.map(lead => lead.LeadID);

        const payload = {
            name: "Sales Queue",
            members: memberIds,
            isBulk: false,
            config: {
                "max-wait-time": 60,
                "max-wait-time-with-no-agent": 60,
                "strategy": "top-down",
                "mwtformat": "seconds",
                "mwtwnaformat": "seconds"
            },
            groupid: ZOHO_CONFIG.queueId
        };

        const response = await fetch(`${ZOHO_CONFIG.baseUrl}/groups`, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Queue update response:', data);
        return data;

    } catch (error) {
        console.error('Error updating queue:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Starting Zoho queue update...');
        
        // Get leads from archive
        const leads = await getLeadsFromArchive();
        console.log(`Found ${leads.length} leads to add to queue`);

        // Update queue
        if (leads.length > 0) {
            const result = await updateQueue(leads);
            console.log('Queue update complete:', result);
        }

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// Run the script
main(); 