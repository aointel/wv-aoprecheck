import { readFileSync, writeFileSync } from 'fs';

const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json'));

const updatedTokens = {
    ...tokens,
    client_id: '1000.J997V5CGG0NS742VQA401ZFKTI5MJF',
    client_secret: 'b60187effb9b211d02853c974b5f82ae3f51e53f54'
};

writeFileSync('zoho_tokens_voice.json', JSON.stringify(updatedTokens, null, 2));
console.log('Updated tokens with client credentials'); 