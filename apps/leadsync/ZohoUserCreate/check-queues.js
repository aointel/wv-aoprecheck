import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read files
const assignments = parse(readFileSync('queue_assignments.csv'), { columns: true });
const mappings = parse(readFileSync('queue_mappings.csv'), { columns: true });

// Get all unique queue names from assignments
const assignmentQueues = new Set(assignments.map(a => a.QueueName));
const mappingQueues = new Set(mappings.map(m => m.QueueName));

console.log('Queues in assignments but not in mappings:');
for (const queue of assignmentQueues) {
    if (!mappingQueues.has(queue)) {
        console.log(queue);
    }
} 