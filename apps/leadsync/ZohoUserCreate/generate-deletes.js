import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read zoho_agents.csv
const zohoAgents = parse(readFileSync('zoho_agents.csv'), { columns: true });

// Generate DELETE statements
const deletes = zohoAgents.map(agent => {
    const name = agent.Name;
    let email = '';

    // Extract name from format like "{176832} - Julian Niewiadomski: [2]"
    // or "13447 - Michael Mandella: AO"
    const nameParts = name.split(' - ');
    if (nameParts.length > 1) {
        const fullName = nameParts[1].split(':')[0].trim();
        // Convert "Julian Niewiadomski" to "julianniewiadomski@aoglobelife.com"
        email = fullName.toLowerCase().replace(/\s/g, '') + '@aoglobelife.com';
    }

    if (email) {
        return `DELETE FROM auth.users WHERE email = '${email}';`;
    }
    return null;
}).filter(sql => sql);

// Write to SQL file
writeFileSync('delete-users.sql', deletes.join('\n')); 