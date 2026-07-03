import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

async function updateQueue(token) {
    const url = 'https://voice.zoho.com/rest/json/zv/api/groups';

    // Match exact format from curl example
    const data = {
        "name": "PAVET-NY",
        "emailId": "queue@company.com",
        "qapId": "",
        "members": ["63020000000027055"],  // Note: as string
        "emailNotificationConfig": "2",
        "queueWaitMusic": {
            "mode": "audio",
            "audioId": "",
            "enableDefaultAnnouncements": true
        },
        "isBulk": false,
        "extension": "6000",
        "config": {
            "max-wait-time": 60,
            "max-wait-time-with-no-agent": 60,
            "strategy": "round-robin",
            "mwtformat": "seconds",
            "mwtwnaformat": "seconds"
        },
        "groupid": "63020000000032543"  // Note: as string
    };

    // URL encode exactly like curl example
    const formData = new URLSearchParams();
    formData.append('data', JSON.stringify(data));
    formData.append('agentChanged', 'false');

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const result = await response.json();
        console.log('API Response:', result);

        if (!response.ok) {
            throw new Error(`Failed to update queue: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function refreshToken() {
    const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json', 'utf8'));
    const config = {
        client_id: "1000.J997V5CGG0NS742VQA401ZFKTI5MJF",
        client_secret: "b60187effb9b211d02853c974b5f82ae3f51e53f54",
        accounts_url: "https://accounts.zoho.com"
    };

    try {
        const response = await fetch(`${config.accounts_url}/oauth/v2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: tokens.refresh_token,
                client_id: config.client_id,
                client_secret: config.client_secret,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();
        const updatedTokens = {
            access_token: data.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date().toISOString(),
            scope: tokens.scope
        };

        writeFileSync('zoho_tokens_voice.json', JSON.stringify(updatedTokens, null, 2));
        return updatedTokens.access_token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        throw error;
    }
}

async function main() {
    try {
        const token = await refreshToken();
        await updateQueue(token);
    } catch (error) {
        console.error('Error:', error);
    }
}

main(); 