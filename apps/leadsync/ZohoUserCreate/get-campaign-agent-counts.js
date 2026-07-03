import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

async function refreshToken(tokens) {
    const config = {
        client_id: "1000.J997V5CGG0NS742VQA401ZFKTI5MJF",
        client_secret: "b60187effb9b211d02853c974b5f82ae3f51e53f54",
        accounts_url: "https://accounts.zoho.com"
    };

    const response = await fetch(`${config.accounts_url}/oauth/v2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            refresh_token: tokens.refresh_token,
            client_id: config.client_id,
            client_secret: config.client_secret,
            grant_type: 'refresh_token',
            scope: 'zohovoice.queues.ALL,zohovoice.agents.ALL'
        })
    });

    const data = await response.json();
    if (data.access_token) {
        tokens.access_token = data.access_token;
        writeFileSync('zoho_tokens_queues.json', JSON.stringify(tokens, null, 2));
        console.log('Token refreshed');
        return tokens;
    }
    throw new Error('Failed to refresh token');
}

async function getCampaignAgentCounts() {
    try {
        let tokens = JSON.parse(readFileSync('zoho_tokens_queues.json'));
        tokens = await refreshToken(tokens);

        // Get raw queue data
        const response = await fetch('https://voice.zoho.com/rest/json/zv/api/queues', {
            headers: {
                'Authorization': `Zoho-oauthtoken ${tokens.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get queues: ${await response.text()}`);
        }

        const data = await response.json();
        console.log('Raw API Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

getCampaignAgentCounts();

export { getCampaignAgentCounts }; 