import { csvDataProcessor } from './csv-data-processor';
import * as path from 'path';

async function processCsvData() {
  try {
    console.log('🚀 Starting CSV data processing for 9/1-9/5 VDP events...');
    
    // Path to the uploaded CSV file
    const csvFilePath = path.join(process.cwd(), 'attached_assets', 'd0d9d3a8-6890-4796-9ca2-86d03d41108b_1757176969107.csv');
    
    // Process the CSV and populate VDP tables
    await csvDataProcessor.processCsvFile(csvFilePath);
    
    console.log('✅ CSV processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error processing CSV data:', error);
  }
}

// Run the processor
processCsvData();