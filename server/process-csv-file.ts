import { csvDataProcessor } from './csv-data-processor';
import * as path from 'path';
import * as fs from 'fs';

async function processCsvFile() {
  try {
    // Get CSV file path from command line argument or use default
    const csvFileName = process.argv[2] || '3c4b684f-daa5-407c-8248-fe43bfbbfddf.csv';
    const csvFilePath = path.join(process.cwd(), 'server', csvFileName);
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      console.log(`\nUsage: tsx server/process-csv-file.ts <csv-filename>`);
      console.log(`Example: tsx server/process-csv-file.ts 3c4b684f-daa5-407c-8248-fe43bfbbfddf.csv`);
      process.exit(1);
    }
    
    console.log(`📄 Processing CSV file: ${csvFileName}`);
    console.log(`📁 Full path: ${csvFilePath}\n`);
    
    // Process the CSV and populate VDP tables
    await csvDataProcessor.processCsvFile(csvFilePath);
    
    console.log('\n✅ CSV processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error processing CSV data:', error);
    process.exit(1);
  }
}

// Run the processor
processCsvFile();

