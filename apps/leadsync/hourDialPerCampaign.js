const axios = require('axios');

// Use the same Taalk API configuration as sendLeads.js
const taalkApi = axios.create({
    baseURL: 'https://api.taalk.com',
    headers: {
        'Authorization': 'Bearer 6c1a63be-f87d-4c3d-a35d-c2c73d49a06d',
        'Content-Type': 'application/json'
    }
});

async function getHourlyDialsPerCampaign() {
    try {
        // Use the same API endpoint structure
        const response = await taalkApi.get('/campaign2s/stats/hourly');
        return response.data;
    } catch (error) {
        console.error('Error fetching hourly dials:', error);
        throw error;
    }
}

async function trackLeadSent(leadId, campaignId) {
    // Implementation of lead tracking
    console.log(`Tracking lead ${leadId} sent to campaign ${campaignId}`);
    // Add your tracking logic here
}

module.exports = {
    getHourlyDialsPerCampaign,
    trackLeadSent
}; 