import { readFileSync } from 'fs';
console.log('Current token file contents:');
console.log(JSON.parse(readFileSync('zoho_tokens_voice.json', 'utf8'))); 