import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read zoho_agents.csv to understand relationships
const zohoAgents = parse(readFileSync('zoho_agents.csv'), { columns: true });

// Get all emails from the previous SQL results
const emails = [
  'dwhite@ailpdx.com',
  'tdavis@ailpdx.com',
  // ... etc
];

// Split into batches of 25
const batches = [];
for (let i = 0; i < emails.length; i += 25) {
  batches.push(emails.slice(i, i + 25));
}

// Generate SQL for each batch
const sql = batches.map(batch => {
  const emailList = batch.map(email => `'${email}'`).join(',\n    ');
  return `
-- Delete customers first
DELETE FROM public.customers 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN (
        ${emailList}
    )
);

-- Then delete users
DELETE FROM auth.users 
WHERE email IN (
    ${emailList}
);
`;
}).join('\n');

writeFileSync('delete-batches.sql', sql); 