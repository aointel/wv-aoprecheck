import { readFileSync } from 'fs';

// Read current tokens
const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json'));
console.log('Current tokens:', tokens);

// Expected structure:
const expectedStructure = {
    client_id: '1000.xxx', // Should be here
    client_secret: 'xxx',  // Should be here
    refresh_token: tokens.refresh_token,
    access_token: 'xxx',   // Will get this from refresh
    scope: tokens.scope,
    api_domain: tokens.api_domain,
    token_type: tokens.token_type
};

console.log('\nMissing fields:', 
    Object.keys(expectedStructure).filter(key => !tokens[key])); 