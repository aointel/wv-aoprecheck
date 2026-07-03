import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

async function getVoiceToken() {
    const params = new URLSearchParams({
        code: '1000.810872f521fdd4318a2aa433b6307738.d2368de36af4ba41d0d7fec13db68955',
        client_id: '1000.J997V5CGG0NS742VQA401ZFKTI5MJF',
        client_secret: 'b60187effb9b211d02853c974b5f82ae3f51e53f54',
        grant_type: 'authorization_code',
        scope: 'zohovoice.queues.ALL'
    });

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    const data = await response.json();
    console.log('Token response:', data);

    if (data.access_token) {
        writeFileSync('zoho_tokens_voice.json', JSON.stringify(data, null, 2));
        console.log('Saved tokens to zoho_tokens_voice.json');
    } else {
        console.error('Failed to get token:', data);
    }
}

getVoiceToken(); 