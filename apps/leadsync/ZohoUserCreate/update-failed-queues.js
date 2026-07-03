import { readFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { updateQueue, refreshToken } from './update-queue-members.js';

async function updateFailedQueues() {
    try {
        // Read all necessary files
        const queueMappings = parse(readFileSync('queue_mappings.csv'), { columns: true });
        const assignments = parse(readFileSync('queue_assignments.csv'), { 
            columns: true,
            skip_empty_lines: true,
            relax_quotes: true
        });
        const tokens = JSON.parse(readFileSync('zoho_tokens_voice.json'));

        // Get list of failed queues
        const queueHistory = existsSync('queue_update_history.json') 
            ? JSON.parse(readFileSync('queue_update_history.json'))
            : {};
        const largeQueues = existsSync('large_queues.csv')
            ? parse(readFileSync('large_queues.csv'), { columns: true })
            : [];

        // Find queues that haven't been updated
        const failedQueues = queueMappings.filter(queue => {
            const wasUpdated = queueHistory[queue.QueueName];
            const isLarge = largeQueues.some(lq => lq.QueueName === queue.QueueName);
            return !wasUpdated && !isLarge;
        });

        console.log(`Found ${failedQueues.length} queues to update`);

        // Group assignments by queue
        const queueMembers = new Map();
        assignments.forEach(assignment => {
            if (failedQueues.some(q => q.QueueName === assignment.QueueName)) {
                if (!queueMembers.has(assignment.QueueName)) {
                    queueMembers.set(assignment.QueueName, new Set());
                }
                queueMembers.get(assignment.QueueName).add(assignment.ZohoAgentID);
            }
        });

        // Update each failed queue
        let updated = 0;
        let failed = 0;

        for (const queue of failedQueues) {
            const members = queueMembers.get(queue.QueueName) || new Set();
            console.log(`\nProcessing ${queue.QueueName} with ${members.size} members`);

            try {
                const success = await updateQueue(queue.QueueName, members, queue, tokens.access_token);
                if (success) {
                    updated++;
                    console.log(`Successfully updated ${queue.QueueName}`);
                } else {
                    failed++;
                    console.log(`Failed to update ${queue.QueueName}`);
                }

                // Wait 3 minutes between queues
                if (updated + failed < failedQueues.length) {
                    console.log('Waiting 3 minutes before next queue...');
                    await new Promise(resolve => setTimeout(resolve, 180000));
                }
            } catch (error) {
                console.error(`Error updating ${queue.QueueName}:`, error);
                failed++;
            }
        }

        console.log('\nAll updates complete!');
        console.log(`Updated: ${updated} queues`);
        console.log(`Failed: ${failed} queues`);

    } catch (error) {
        console.error('Error:', error);
    }
}

updateFailedQueues(); 