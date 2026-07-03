import { processRecord, TTaalkRecord, ImportResult } from './taalkImportService';

interface WebhookResult {
  processed: number;
  errors: string[];
}

/**
 * Process a direct call record received from an external system
 * This function handles individual call data sent directly to our webhook endpoint
 */
export async function processCallWebhook(
  callData: Partial<TTaalkRecord>,
  source: string = 'direct-webhook'
): Promise<WebhookResult> {
  const result: WebhookResult = {
    processed: 0,
    errors: []
  };

  try {
    if (!callData) {
      throw new Error('No call data provided');
    }

    // Create import tracking object
    const importResult: ImportResult = {
      imported: 0,
      synced: 0,
      errors: []
    };

    // Convert to TTaalkRecord format
    // This ensures we have all required fields with proper types
    const record: TTaalkRecord = {
      Date: callData.Date || new Date().toLocaleDateString(),
      Time: callData.Time || new Date().toLocaleTimeString(),
      Phone: callData.Phone || '',
      Name: callData.Name || '',
      Duration: callData.Duration || '00:00:00',
      Voicemail: callData.Voicemail || 'No',
      'Picked By': callData['Picked By'] || 'System',
      SMS: callData.SMS || 'No',
      Clicked: callData.Clicked || 'No',
      Transferred: callData.Transferred || 'No',
      'Duration After Transfer': callData['Duration After Transfer'] || '00:00:00',
      'Transfer Delay': callData['Transfer Delay'] || '00:00:00',
      'Transfer Status': callData['Transfer Status'] || 'N/A',
      Persona: callData.Persona || '',
      Taalk_PrimaryFirstName: callData.Taalk_PrimaryFirstName || '',
      Taalk_AgentLastName: callData.Taalk_AgentLastName || '',
      Taalk_MonthlyPremium: callData.Taalk_MonthlyPremium || '0.00',
      Taalk_AgentFirstName: callData.Taalk_AgentFirstName || '',
      Taalk_ClientHomeP: callData.Taalk_ClientHomeP || callData.Phone || '',
      Recording: callData.Recording || '',
    };

    // Process the record using the existing function
    await processRecord(record, false, importResult);
    result.processed++;
      
    // Add any errors from the import result
    if (importResult.errors.length > 0) {
      result.errors.push(...importResult.errors);
    }
    
    // Trigger automatic transcription if recording URL exists
    if (record.Recording && record.Recording.trim() !== '') {
      try {
        console.log(`Starting automatic transcription for new call: ${record.Phone}`);
        
        // Import storage and transcription service
        const { storage } = await import('../storage');
        const { transcribeCallRecording } = await import('./transcriptionService');
        
        // Find the call by phone number and recent timestamp to get the taalkUID
        const recentCalls = await storage.getCalls(10, 0); // Get recent calls
        const matchingCall = recentCalls.find(call => 
          call.phone === record.Phone && 
          call.recordingUrl && 
          call.recordingUrl.includes('recording')
        );
        
        if (matchingCall) {
          // Start transcription in background (don't wait for completion)
          transcribeCallRecording(matchingCall.taalkUID, storage).catch(error => {
            console.error(`Background transcription failed for ${matchingCall.taalkUID}:`, error);
          });
          
          console.log(`Automatic transcription started for call ${matchingCall.taalkUID}`);
        }
      } catch (error) {
        console.error('Error starting automatic transcription:', error);
        // Don't fail the webhook processing if transcription fails
      }
    }
      
    return result;
  } catch (error) {
    console.error('Error processing call webhook data:', error);
    result.errors.push(`Failed to process call data: ${error}`);
    return result;
  }
}

/**
 * Process multiple call records received from an external system
 */
export async function processBatchCallWebhook(
  callDataArray: Partial<TTaalkRecord>[],
  source: string = 'batch-webhook'
): Promise<WebhookResult> {
  const result: WebhookResult = {
    processed: 0,
    errors: []
  };

  try {
    if (!callDataArray || !Array.isArray(callDataArray) || callDataArray.length === 0) {
      throw new Error('No call data array provided or empty array');
    }

    console.log(`Webhook received ${callDataArray.length} call records from ${source}`);
    
    // Process each record
    for (const callData of callDataArray) {
      try {
        const recordResult = await processCallWebhook(callData, source);
        result.processed += recordResult.processed;
        
        if (recordResult.errors.length > 0) {
          result.errors.push(...recordResult.errors);
        }
      } catch (error) {
        const recordingId = callData.Recording ? 
          callData.Recording.split('/').pop()?.split('?')[0] : 'unknown';
          
        result.errors.push(`Error processing record (ID: ${recordingId}): ${error}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error processing batch call webhook:', error);
    result.errors.push(`Failed to process batch call data: ${error}`);
    return result;
  }
}