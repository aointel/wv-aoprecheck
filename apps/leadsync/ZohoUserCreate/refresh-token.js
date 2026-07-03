import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

export async function refreshToken() {
    try {
        const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json'));
        const clientId = tokens.client_id;
        const clientSecret = tokens.client_secret;
        const refreshToken = tokens.refresh_token;

        const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token'
            })
        });

        const newTokens = await response.json();
        console.log('Response from Zoho:', newTokens);

        if (!newTokens.access_token) {
            console.error('No access token in response:', newTokens);
            return null;
        }
        
        // Merge new access token with existing tokens
        const updatedTokens = {
            ...tokens,
            access_token: newTokens.access_token
        };

        writeFileSync('zoho_tokens_voice.json', JSON.stringify(updatedTokens, null, 2));
        console.log('Token refreshed successfully!');

        return newTokens.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
    }
}

// Only run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
    refreshToken();
} 