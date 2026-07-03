import { readFileSync, writeFileSync, existsSync } from 'fs';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import { refreshToken } from './refresh-token.js';

// Helper function to wait between requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Add shuffle function
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// At the top where we define constants
const RETRY_DELAY = 10000;    // 10 seconds between retries
const QUEUE_DELAY = 180000;   // 3 minutes between queues
const QUEUE_HISTORY_FILE = 'queue_update_history.json';
const HOURS_BEFORE_UPDATE = 24;

// Read and validate assignments first
const assignments = parse(readFileSync('queue_assignments.csv'), { 
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    rtrim: true,
    ltrim: true
});

// Debug assignments
console.log('\nChecking assignments:');
console.log('Total assignments:', assignments.length);
console.log('Sample assignment:', assignments[0]);
console.log('Sample ZohoAgentID:', assignments[0].ZohoAgentID);

// Check token
const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json'));
console.log('\nChecking token...');

// Make sure we have a valid token structure
if (!tokens.access_token) {
    console.error('Invalid token structure in zoho_tokens_voice.json');
    console.log('Current tokens:', tokens);
    process.exit(1);
}

// Log a safe version of the token
const tokenPreview = tokens.access_token.substring(0, 10) + '...';
console.log('Using token:', tokenPreview);

// Add this function to check queue history
function loadQueueHistory() {
    if (existsSync(QUEUE_HISTORY_FILE)) {
        return JSON.parse(readFileSync(QUEUE_HISTORY_FILE));
    }
    return {};
}

// Add this function to save queue history
function saveQueueHistory(history) {
    writeFileSync(QUEUE_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Add at top with other imports
const producerList = parse(readFileSync('ProducerList.csv'), { 
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true 
});

export async function updateQueue(queueName, members, queue, token) {
    try {
        console.log('\nRequest details for', queueName);
        console.log('Queue ID:', queue.QueueID);

        // Only check for valid ID format
        const validMembers = Array.from(members).filter(id => {
            const isValidFormat = /^63020000000\d{6}$/.test(id);
            if (!isValidFormat) {
                console.log(`Skipping invalid agent ID format: ${id}`);
                return false;
            }
            return true;
        });

        console.log('Total valid members:', validMembers.length);
        if (validMembers.length === 0) {
            console.log('No valid members to add to queue');
            return true;
        }

        // Keep trying forever
        while (true) {
            try {
                const data = {
                    name: queueName,
                    emailId: queue.AgentEmail || "noreply@aoglobelife.com",
                    members: validMembers,
                    isBulk: true,
                    config: {
                        "max-wait-time": 300,
                        "max-wait-time-with-no-agent": 300,
                        "strategy": "round-robin",
                        "mwtformat": "seconds",
                        "mwtwnaformat": "seconds"
                    },
                    groupid: queue.QueueID
                };

                const response = await fetch('https://voice.zoho.com/rest/json/zv/api/groups', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `data=${encodeURIComponent(JSON.stringify(data))}&agentChanged=true`
                });

                const result = await response.json();
                console.log('API Response:', result);

                // Handle unauthorized error by refreshing token
                if (result.code === 'ZVT0052' && result.message === 'Unauthorized access.') {
                    console.log('Token expired, refreshing...');
                    const newToken = await refreshToken();
                    if (newToken) {
                        console.log('Token refreshed, retrying update...');
                        token = newToken;
                        continue;
                    }
                }

                if (result.code === '500' || result.status === 'ERROR') {
                    // If we get failed agent error, return false to mark as failed
                    if (result.code === 'ZVT0083' && result.message.includes('failed agent')) {
                        console.log('Queue has failed agents, marking as failed');
                        return false; // Mark as failed, not success
                    }

                    console.log(`Error occurred, waiting 2 minutes before retry...`);
                    await delay(120000); // 2 minutes
                    continue;
                }

                return true; // Success
            } catch (error) {
                console.error(`Error in queue update:`, error);
                console.log('Waiting 2 minutes before retry...');
                await delay(120000); // 2 minutes
                continue;
            }
        }
    } catch (error) {
        console.error(`Error in queue ${queueName}:`, error);
        return false;
    }
}

async function updateQueueMembers() {
    try {
        const queues = parse(readFileSync('queue_mappings.csv'), { columns: true });
        const queueHistory = loadQueueHistory();
        const now = Date.now();

        // Group assignments by queue
        const queueMembers = new Map();
        assignments.forEach(assignment => {
            const queue = assignment.QueueName;
            const agentId = assignment.ZohoAgentID;
            
            if (!queueMembers.has(queue)) {
                queueMembers.set(queue, new Set());
            }
            queueMembers.get(queue).add(agentId);
        });

        // Filter for only failed queues
        const failedQueues = Array.from(queueMembers.keys()).filter(queueName => {
            const wasUpdated = queueHistory[queueName];
            const queue = queues.find(q => q.QueueName === queueName);
            if (!queue) return false;
            
            // Skip if recently updated
            if (wasUpdated) {
                const hoursSinceUpdate = (now - wasUpdated) / (1000 * 60 * 60);
                if (hoursSinceUpdate < HOURS_BEFORE_UPDATE) return false;
            }
            
            return true;
        });

        console.log(`\nFound ${failedQueues.length} queues to update`);

        // Track updates
        let updated = 0;
        let failed = 0;

        for (const queueName of failedQueues) {
            const members = queueMembers.get(queueName);
            const queue = queues.find(q => q.QueueName === queueName);
            
            console.log(`\nProcessing queue ${queueName} (${updated + failed + 1}/${failedQueues.length})`);
            console.log(`Members in queue: ${members.size}`);

            try {
                const success = await updateQueue(queueName, members, queue, tokens.access_token);
                if (success) {
                    queueHistory[queueName] = now;
                    saveQueueHistory(queueHistory);
                    updated++;
                    console.log(`Successfully updated ${queueName}`);
                } else {
                    failed++;
                    console.log(`Failed to update ${queueName}`);
                }

                // Wait between queues
                if (updated + failed < failedQueues.length) {
                    console.log('Waiting 3 minutes before next queue update...');
                    await delay(QUEUE_DELAY);
                }
            } catch (error) {
                console.error(`Error updating queue ${queueName}:`, error);
                failed++;
            }
        }

        console.log('\nAll updates complete!');
        console.log(`Updated: ${updated} queues`);
        console.log(`Failed: ${failed} queues`);

    } catch (error) {
        console.error('Error updating queues:', error);
    }
}

updateQueueMembers(); 