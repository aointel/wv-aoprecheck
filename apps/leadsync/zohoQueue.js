const fetch = require('node-fetch');

// Configuration
const ZOHO_CONFIG = {
    baseUrl: 'https://voice.zoho.com/rest/json/zv/api',
    queueId: '2069000000407011', // Your queue ID
};

async function addMembersToQueue(memberIds) {
    try {
        const url = `${ZOHO_CONFIG.baseUrl}/groups`;
        
        // Prepare queue update payload
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

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.status === 'SUCCESS') {
            console.log('Successfully updated queue members');
            return true;
        } else {
            console.error('Failed to update queue:', data.message);
            return false;
        }

    } catch (error) {
        console.error('Error updating queue members:', error);
        throw error;
    }
}

async function updateQueueFromLeads(queueId) {
    try {
        // Read leads from processed/archived files
        const leads = await getLeadsFromFiles();
        
        // Format leads as queue members
        const memberIds = leads.map(lead => lead.LeadID);
        
        // Update Zoho queue
        const response = await fetch(`${ZOHO_CONFIG.baseUrl}/groups`, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                name: "Sales Queue",
                members: memberIds,
                groupid: queueId,
                isBulk: false,
                config: {
                    "strategy": "top-down",
                    // ... other config
                }
            })
        });

        return response.json();
    } catch (error) {
        console.error('Failed to update queue:', error);
        throw error;
    }
}

module.exports = {
    addMembersToQueue
}; 