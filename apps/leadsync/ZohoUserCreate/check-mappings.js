import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const mappings = parse(readFileSync('queue_mappings.csv'), { columns: true });
console.log('Sample queue mapping:', mappings[0]); 