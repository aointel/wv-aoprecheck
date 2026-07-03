import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

async function refreshAgentToken() {
    const tokens = JSON.parse(readFileSync('zoho_tokens_agents.json', 'utf8'));  // Separate token file
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
                grant_type: 'refresh_token',
                scope: 'ZohoVoice.agents.READ'  // Agents scope
            })
        });

        const data = await response.json();
        const updatedTokens = {
            access_token: data.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date().toISOString(),
            scope: 'ZohoVoice.agents.READ'
        };

        writeFileSync('zoho_tokens_agents.json', JSON.stringify(updatedTokens, null, 2));
        return updatedTokens.access_token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        throw error;
    }
}

async function getZohoAgents() {
    try {
        const token = await refreshAgentToken();
        const url = 'https://voice.zoho.com/rest/json/zv/api/users';

        const response = await fetch(url, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.status === 'SUCCESS') {
            console.log(`Found ${data.meta.total} agents`);
            
            // Save to CSV
            const csvRows = ['Email,Name,AgentID,UserID'];
            data.users.forEach(user => {
                csvRows.push(`${user.emailid},${user.name},${user.agentId},${user.userid}`);
            });
            
            writeFileSync('zoho_agents.csv', csvRows.join('\n'));
            console.log('Saved agent data to zoho_agents.csv');
            
            return data.users;
        } else {
            throw new Error(`Failed to get agents: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error('Error getting agents:', error);
        throw error;
    }
}

// Run it
getZohoAgents().catch(console.error); 