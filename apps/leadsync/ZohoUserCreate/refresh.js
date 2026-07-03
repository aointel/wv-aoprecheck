import { writeFileSync } from 'fs';
import fetch from 'node-fetch';

const AUTH_CODE = '1000.0879071b22a09959f2faa5f3d25213ab.22af851c9eeed465e6a614e57458313e';
const CLIENT_ID = '1000.J997V5CGG0NS742VQA401ZFKTI5MJF';
const CLIENT_SECRET = 'b60187effb9b211d02853c974b5f82ae3f51e53f54';
const REFRESH_URL = 'https://accounts.zoho.com/oauth/v2/token';

async function refresh() {
    const response = await fetch(REFRESH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            code: AUTH_CODE,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code'
        })
    });

    const data = await response.json();
    console.log('Response:', data);

    writeFileSync('zoho_tokens_voice.json', JSON.stringify(data, null, 2));
}

refresh(); 