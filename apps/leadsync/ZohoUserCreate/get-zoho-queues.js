import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

async function fetchQueuesPage(tokens, from, offset) {
    // Go back to the original working endpoint
    const baseUrl = 'https://voice.zoho.com/rest/json/zv/api/queues';
    const params = new URLSearchParams({
        from: from.toString(),
        offset: offset.toString()
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`Fetching queues from index ${from} with offset ${offset}`);

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response body:', text);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw API Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function fetchQueueMembers(tokens, queueId) {
    const baseUrl = `https://voice.zoho.com/rest/json/zv/api/queues/${queueId}/members`;
    
    try {
        const response = await fetch(baseUrl, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Failed to get members for queue ${queueId}`);
            return null;
        }

        const data = await response.json();
        return data.members || [];
    } catch (error) {
        console.error(`Error fetching members for queue ${queueId}:`, error);
        return null;
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getZohoQueues() {
    try {
        const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json', 'utf8'));
        let allQueues = new Map();

        // Try to get all queues in one request with a very large offset
        console.log('\nFetching all queues...');
        const response = await fetchQueuesPage(tokens, 0, 999999); // Set offset to effectively unlimited
        
        if (response.status === 'SUCCESS' && response.queues) {
            response.queues.forEach(queue => {
                allQueues.set(queue.id, queue);
                console.log(`Found queue: ${queue.name} (${queue.id})`);
            });
            console.log(`Batch returned ${response.queues.length} queues`);
        } else {
            console.error('Failed to get queues:', response);
        }

        const uniqueQueues = Array.from(allQueues.values());
        console.log(`\nFound total of ${uniqueQueues.length} unique queues`);

        // Save mappings
        const mappingRows = ['QueueName,QueueID,Extension,MemberCount,AgentEmail,AgentID,AgentName,AgentRoles,Markets,State,MarketType'];
        uniqueQueues
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(queue => {
                mappingRows.push(`${queue.name},${queue.id},${queue.extension || ''},${queue.members?.length || 0},,,,,,Active,`);
            });
        writeFileSync('queue_mappings.csv', mappingRows.join('\n'));
        
        // Save detailed data
        const headers = [
            'name',
            'id',
            'queueStrategy',
            'enableDefaultAnnouncements',
            'queueWaitMusic_mode',
            'queueWaitMusic_audioId'
        ];
        
        const queueRows = [headers.join(',')];
        uniqueQueues.forEach(queue => {
            const row = [
                queue.name || '',
                queue.id || '',
                queue.queueStrategy || '',
                queue.enableDefaultAnnouncements || false,
                queue.queueWaitMusic?.mode || '',
                queue.queueWaitMusic?.audioId || ''
            ];
            queueRows.push(row.join(','));
        });
        
        writeFileSync('zohoqueues.csv', queueRows.join('\n'));
        console.log('Saved detailed queue data to zohoqueues.csv');
        
        return uniqueQueues;
    } catch (error) {
        console.error('Error getting queues:', error);
        throw error;
    }
}

async function main() {
    try {
        // 1. Refresh token
        console.log('\nRefreshing token...');
        execSync('powershell -File .\\Refresh-ZohoToken.ps1');

        // 2. Verify token
        console.log('\nVerifying token...');
        execSync('powershell -File .\\Get-CurrentTokens.ps1');

        // 3. Get all queues and save to CSV
        console.log('\nFetching all queues...');
        await getZohoQueues();
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main(); 