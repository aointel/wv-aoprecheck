import { readFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read all queue data
const queueMappings = parse(readFileSync('queue_mappings.csv'), { columns: true });
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

console.log('\nQueues never updated successfully:');
failedQueues.forEach(queue => {
    console.log(`${queue.QueueName} (ID: ${queue.QueueID})`);
});

console.log(`\nTotal failed queues: ${failedQueues.length}`); 