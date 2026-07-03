import { readFileSync } from 'fs';

// Read files
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');
const queueMappings = readFileSync('queue_mappings.csv', 'utf8').split('\n');

// Get all queue names we're trying to assign to
const assignmentQueues = new Set();
assignments.forEach(line => {
    if (line === assignments[0]) return; // Skip header
    const queueName = line.split(',')[4];
    assignmentQueues.add(queueName);
});

// Get all queues that exist in mappings
const existingQueues = new Set();
queueMappings.forEach(line => {
    if (line === queueMappings[0]) return; // Skip header
    const queueName = line.split(',')[0];
    existingQueues.add(queueName);
});

// Find missing queues
console.log('Queues we\'re trying to assign but don\'t exist in mappings:');
[...assignmentQueues].sort().forEach(queue => {
    if (!existingQueues.has(queue)) {
        console.log(queue);
    }
});

// Also show stats
console.log('\nStats:');
console.log('Total queues we\'re trying to assign to:', assignmentQueues.size);
console.log('Total queues in mappings:', existingQueues.size); 