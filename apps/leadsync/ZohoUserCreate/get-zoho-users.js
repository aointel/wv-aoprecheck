import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

async function getZohoAgents() {
    try {
        const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json', 'utf8'));
        
        // Get first page to see data structure
        const response = await fetch(`https://voice.zoho.com/rest/json/zv/api/users?from=0&offset=1`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${tokens.access_token}`,
                'Accept': 'application/json'  // Add required header
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to get agents: ${response.statusText}\n${text}`);
        }

        const data = await response.json();
        console.log('Raw API response:', JSON.stringify(data, null, 2));
        console.log('First user example:', data.users?.[0]);

        // Get all agents with pagination
        let allAgents = [];
        let from = 0;
        const limit = 50;  // API max limit
        
        while (true) {
            // Get users from Voice API with pagination
            const response = await fetch(`https://voice.zoho.com/rest/json/zv/api/users?from=${from}&offset=${limit}&status=1`, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${tokens.access_token}`,
                    'Accept': 'application/json'  // Add required header
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to get agents: ${response.statusText}\n${text}`);
            }

            const data = await response.json();
            console.log(`Found ${data.users?.length || 0} agents in batch starting at ${from}`);

            if (!data.users || data.users.length === 0) break;

            allAgents = allAgents.concat(data.users);
            from += limit;

            if (data.users.length < limit) break;  // Last page
        }

        console.log(`Total agents found: ${allAgents.length}`);

        // Create CSV content
        const rows = ['Email,Name,AgentID,UserID'];
        allAgents.forEach(user => {
            rows.push([
                user.emailId || '',  
                user.displayName || user.name,
                user.agentId,
                user.userId || user.id
            ].join(','));
        });

        writeFileSync('zoho_agents.csv', rows.join('\n'));
        console.log('Saved to zoho_agents.csv');

    } catch (error) {
        console.error('Error getting Zoho agents:', error);
    }
}

// Run it
getZohoAgents(); 