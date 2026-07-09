import * as csvParse from 'csv-parse';
import { processRecord, TTaalkRecord, ImportResult } from './taalkImportService';
import { recordingCache } from './recordingCacheService';

interface WebhookResult {
  processed: number;
  errors: string[];
}

/**
 * Process a CSV webhook payload received from an external system
 * This function handles CSV data sent directly to our webhook endpoint
 */
export async function processCsvWebhook(
  csvData: string,
  source: string = 'webhook'
): Promise<WebhookResult> {
  const result: WebhookResult = {
    processed: 0,
    errors: []
  };

  try {
    // Parse the CSV string directly
    // Using the parser from csv-parse with a Promise-based approach
    const records: TTaalkRecord[] = await new Promise((resolve, reject) => {
      const results: TTaalkRecord[] = [];
      csvParse.parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
      .on('data', (data) => results.push(data as TTaalkRecord))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
    });

    console.log(`Webhook received ${records.length} CSV records from ${source}`);
    
    // Collect TaalkUIDs for recording preloading
    const processedTaalkUIDs: string[] = [];
    
    // Process each record
    for (const record of records) {
      try {
        // Import tracking object
        const importResult: ImportResult = {
          imported: 0,
          synced: 0,
          errors: []
        };
        
        // Process the record - reuse our existing function
        await processRecord(record, false, importResult);
        result.processed++;
        
        // Extract TaalkUID for recording preloading
        const recordingId = record.Recording ? 
          record.Recording.split('/').pop()?.split('?')[0] : null;
        if (recordingId) {
          processedTaalkUIDs.push(recordingId);
        }
        
        // Add any errors from the import result
        if (importResult.errors.length > 0) {
          result.errors.push(...importResult.errors);
        }
      } catch (error) {
        const recordingId = record.Recording ? 
          record.Recording.split('/').pop()?.split('?')[0] : 'unknown';
          
        result.errors.push(`Error processing record (ID: ${recordingId}): ${error}`);
      }
    }
    
    // Download and cache recordings in the background after processing all records
    if (processedTaalkUIDs.length > 0) {
      console.log(`Starting background download of ${processedTaalkUIDs.length} recordings from CSV import`);
      recordingCache.preloadRecordingsForCalls(processedTaalkUIDs).catch(error => {
        console.error('Error preloading recordings from CSV import:', error);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error processing CSV webhook:', error);
    result.errors.push(`Failed to parse CSV data: ${error}`);
    return result;
  }
}