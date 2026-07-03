import { writeFileSync } from 'fs';
import fetch from 'node-fetch';

async function getNewToken() {
    try {
        const config = {
            client_id: "1000.J997V5CGG0NS742VQA401ZFKTI5MJF",
            client_secret: "b60187effb9b211d02853c974b5f82ae3f51e53f54",
            code: "1000.4002d7890495fabb98291af9ee7bff2c.f6603b94e9208af66f6db08cb146db0a",
            accounts_url: "https://accounts.zoho.com"
        };

        // Exchange code for tokens
        const response = await fetch(`${config.accounts_url}/oauth/v2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: config.client_id,
                client_secret: config.client_secret,
                code: config.code,
                scope: 'zohovoice.agents.ALL'
            })
        });

        const data = await response.json();
        console.log('Token response:', data);

        if (data.refresh_token) {
            // Save tokens
            const tokens = {
                scope: data.scope,
                expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
                refresh_token: data.refresh_token,
                access_token: data.access_token
            };

            writeFileSync('zoho_tokens_voice.json', JSON.stringify(tokens, null, 2));
            console.log('New tokens saved to zoho_tokens_voice.json');
        } else {
            throw new Error(`Failed to get tokens: ${JSON.stringify(data)}`);
        }

    } catch (error) {
        console.error('Error getting new token:', error);
    }
}

getNewToken(); 