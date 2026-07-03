import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const queues = parse(readFileSync('queue_mappings.csv'), { columns: true });
const queue = queues.find(q => q.QueueName === 'WILLKIT-VA');

console.log('Queue details:', queue);

// Also check what fields we're sending
const members = ['63020000000529857']; // Sample member
const data = {
    name: 'WILLKIT-VA',
    members: members,
    isBulk: false,
    config: {
        "strategy": "top-down",
        "max-wait-time": 60,
        "max-wait-time-with-no-agent": 60,
        "mwtformat": "seconds",
        "mwtwnaformat": "seconds"
    },
    groupid: queue.QueueID
};

console.log('\nAPI request data:', JSON.stringify(data, null, 2)); 