import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

async function getAvailableAgents() {
    try {
        const tokens = JSON.parse(readFileSync('zoho_tokens_queues.json'));
        const queues = parse(readFileSync('queue_mappings.csv'), { columns: true });
        const campaigns = parse(readFileSync('CampaignList.csv'), { columns: true });

        console.log('Checking campaign queue availability...\n');

        // Track availability for campaigns
        const availability = [];
        availability.push('State,Market,Campaign,Queue,Available');

        for (const campaign of campaigns) {
            const queueName = `${campaign.Market === 'Vet' ? 'PAVET' : campaign.Market}-${campaign.State}`;
            const queue = queues.find(q => q.QueueName === queueName);

            if (!queue) {
                console.log(`No queue found for ${queueName}`);
                availability.push(`${campaign.State},${campaign.Market},${campaign.Campaign},${queueName},0`);
                continue;
            }

            const response = await fetch(`https://voice.zoho.com/rest/json/zv/api/groups/${queue.QueueID}`, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${tokens.access_token}`
                }
            });

            if (!response.ok) {
                console.error(`Failed to get queue ${queueName}:`, await response.text());
                continue;
            }

            const data = await response.json();
            const members = data.group?.members || [];
            const availableCount = members.length;

            console.log(`Campaign ${campaign.Campaign} (${queueName}): ${availableCount} agents`);
            availability.push(`${campaign.State},${campaign.Market},${campaign.Campaign},${queueName},${availableCount}`);

            // Wait between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Save to CSV
        writeFileSync('campaign_availability.csv', availability.join('\n'));
        console.log('\nAvailability data saved to campaign_availability.csv');

    } catch (error) {
        console.error('Error:', error);
    }
}

getAvailableAgents(); 