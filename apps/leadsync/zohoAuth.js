const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Only handle CRM tokens
const CRM_TOKENS_FILE = path.join(__dirname, 'zoho_crm_tokens.json');

async function refreshAccessToken() {
    try {
        const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: process.env.ZOHO_CRM_REFRESH_TOKEN,
                client_id: process.env.ZOHO_CRM_CLIENT_ID,
                client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();
        
        if (data.access_token) {
            const tokens = {
                access_token: data.access_token,
                expires_at: Date.now() + (data.expires_in * 1000),
                refresh_token: process.env.ZOHO_CRM_REFRESH_TOKEN
            };
            
            fs.writeFileSync(CRM_TOKENS_FILE, JSON.stringify(tokens, null, 2));
            return tokens.access_token;
        } else {
            throw new Error('Failed to refresh token: ' + JSON.stringify(data));
        }
    } catch (error) {
        console.error('Error refreshing CRM token:', error);
        throw error;
    }
}

async function getAccessToken() {
    try {
        if (fs.existsSync(CRM_TOKENS_FILE)) {
            const tokens = JSON.parse(fs.readFileSync(CRM_TOKENS_FILE));
            if (tokens.expires_at > Date.now() + 60000) {
                return tokens.access_token;
            }
        }
        return await refreshAccessToken();
    } catch (error) {
        console.error('Error getting CRM access token:', error);
        throw error;
    }
}

module.exports = {
    getAccessToken,
    refreshAccessToken
};
