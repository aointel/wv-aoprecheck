import fs from 'fs';
import csvParser from 'csv-parser';
import { storage } from '../storage';
import { supabase, saveTTaalkRawDataToSupabase } from '../supabase';
import { InsertCall, InsertTTaalkRawData } from '@shared/schema';
import { db } from '../db';
import { ttaalkRawData } from '@shared/schema';
import { parseCSVHeaders, mapCSVRowToCall, validateCSVMapping } from './csvMappingService';

export interface TTaalkRecord {
  Date: string;
  Time: string;
  Phone: string;
  Name: string;
  Duration: string;
  Voicemail: string;
  'Picked By': string;
  SMS: string;
  Clicked: string;
  Transferred: string;
  'Duration After Transfer': string;
  'Transfer Delay': string;
  'Transfer Status': string;
  Persona: string;
  Taalk_PrimaryFirstName: string;
  Taalk_AgentLastName: string;
  Taalk_MonthlyPremium: string;
  Taalk_AgentFirstName: string;
  Taalk_ClientHomeP: string;
  Recording: string;
  [key: string]: string;
}

export interface ImportResult {
  imported: number;
  synced: number;
  errors: string[];
}

/**
 * Process a TTaalk CSV file and import the data into our system
 */
export async function processUploadedTaalkCSV(
  fileData: Buffer,
  fileName: string,
  syncToSupabase: boolean = false
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const result: ImportResult = {
      imported: 0,
      synced: 0,
      errors: []
    };
    
    // Create a temp file to store the uploaded CSV
    const tempPath = `./tmp-${Date.now()}.csv`;
    
    try {
      // Write the uploaded file to disk temporarily
      fs.writeFileSync(tempPath, fileData);
      
      const records: any[] = [];
      let headers: string[] = [];
      let headerMapping: Record<string, any> = {};
      let isFirstRow = true;
      
      // Parse the CSV file
      fs.createReadStream(tempPath)
        .pipe(csvParser())
        .on('headers', (csvHeaders) => {
          headers = csvHeaders;
          headerMapping = parseCSVHeaders(headers);
          
          // Validate the CSV structure
          const validation = validateCSVMapping(headerMapping);
          if (!validation.isValid) {
            result.errors.push(`Missing required fields: ${validation.missingFields.join(', ')}`);
          }
          
          // Add warnings for missing recommended fields
          validation.warnings.forEach(warning => {
            result.errors.push(`Warning: ${warning}`);
          });
          
          console.log(`CSV Analysis - Headers found: ${headers.length}`);
          console.log(`Mapped fields: ${Object.keys(headerMapping).length}`);
        })
        .on('data', (data) => {
          records.push(data);
        })
        .on('end', async () => {
          console.log(`Processing ${records.length} records from CSV`);
          
          // Process each record using the enhanced mapping
          for (let i = 0; i < records.length; i++) {
            try {
              const record = records[i];
              
              // Skip empty rows
              if (!record || Object.values(record).every(val => !val || !String(val).trim())) {
                continue;
              }
              
              // Map CSV row to call data using the new mapping service
              const callData = mapCSVRowToCall(record, headerMapping);
              
              // Validate required fields are present
              if (!callData.phone || !callData.phone.trim()) {
                result.errors.push(`Row ${i + 1}: Missing phone number`);
                continue;
              }
              
              if (!callData.firstName && !callData.lastName) {
                result.errors.push(`Row ${i + 1}: Missing name information`);
                continue;
              }
              
              // Save the raw data first
              try {
                const taalkUIDForRaw = callData.taalkUID || `CSV-${Date.now()}-${i}`;
                const recordingId = `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                const rawData: InsertTTaalkRawData = {
                  recordingId: recordingId,
                  dateRecorded: String(record.Date || record.date || new Date().toLocaleDateString()),
                  timeRecorded: String(record.Time || record.time || new Date().toLocaleTimeString()),
                  phone: String(record.Phone || record.phone || ''),
                  name: String(record.Name || record.name || ''),
                  duration: String(record.Duration || record.duration || '00:00:00'),
                  voicemail: String(record.Voicemail || record.voicemail || 'No'),
                  pickedBy: String(record['Picked By'] || record.pickedBy || record.agent || 'CSV Import'),
                  sms: String(record.SMS || record.sms || 'No'),
                  clicked: String(record.Clicked || record.clicked || 'No'),
                  transferred: String(record.Transferred || record.transferred || 'No'),
                  durationAfterTransfer: String(record['Duration After Transfer'] || record.durationAfterTransfer || '00:00:00'),
                  transferDelay: String(record['Transfer Delay'] || record.transferDelay || '00:00:00'),
                  transferStatus: String(record['Transfer Status'] || record.transferStatus || 'N/A'),
                  persona: String(record.Persona || record.persona || ''),
                  clientFirstName: String(record.Taalk_PrimaryFirstName || record.firstName || record.clientFirstName || ''),
                  agentLastName: String(record.Taalk_AgentLastName || record.lastName || record.agentLastName || ''),
                  monthlyPremium: String(record.Taalk_MonthlyPremium || record.monthlyPremium || record.premium || '0.00'),
                  agentFirstName: String(record.Taalk_AgentFirstName || record.agentFirstName || ''),
                  clientHomePhone: String(record.Taalk_ClientHomeP || record.homePhone || record.clientPhone || ''),
                  recordingUrl: String(record.Recording || record.recordingUrl || ''),
                  processed: false,
                  taalkUID: String(taalkUIDForRaw),
                  notes: String(`Raw CSV record saved from import.`)
                };
                
                await db.insert(ttaalkRawData).values(rawData);
              } catch (error) {
                result.errors.push(`Row ${i + 1}: Failed to save raw data - ${error}`);
              }
              
              // Check if record already exists
              const existingCall = await storage.getCallByTaalkUID(callData.taalkUID!);
              
              if (existingCall) {
                // Update existing call
                const updatedCall = await storage.updateCall(existingCall.id, callData);
                if (updatedCall) {
                  result.imported++;
                  
                  if (syncToSupabase) {
                    try {
                      await syncCallToSupabase(updatedCall.id);
                      result.synced++;
                    } catch (error) {
                      result.errors.push(`Row ${i + 1}: Failed to sync to Supabase - ${error}`);
                    }
                  }
                }
              } else {
                // Create new call
                try {
                  const newCall = await storage.createCall(callData as InsertCall);
                  result.imported++;
                  
                  if (syncToSupabase) {
                    try {
                      await syncCallToSupabase(newCall.id);
                      result.synced++;
                    } catch (error) {
                      result.errors.push(`Row ${i + 1}: Failed to sync to Supabase - ${error}`);
                    }
                  }
                } catch (error) {
                  result.errors.push(`Row ${i + 1}: Failed to create call - ${error}`);
                }
              }
            } catch (error) {
              result.errors.push(`Row ${i + 1}: Processing error - ${error}`);
            }
          }
          
          // Clean up the temp file
          fs.unlinkSync(tempPath);
          
          console.log(`CSV Import completed: ${result.imported} imported, ${result.errors.length} errors`);
          resolve(result);
        })
        .on('error', (error) => {
          // Clean up the temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          reject(error);
        });
    } catch (error) {
      // Clean up the temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      reject(error);
    }
  });
}

/**
 * Process a single TTaalk record and save it to the database
 */


/**
 * Save the raw TTaalk record to the database
 */
async function saveRawTTaalkRecord(
  record: TTaalkRecord,
  taalkUID: string
): Promise<number> {
  const recordingUrl = record.Recording || '';
  const recordingId = recordingUrl ? recordingUrl.split('/').pop()?.split('?')[0] : '';
  
  // Map TTaalk record to our schema
  const rawData: InsertTTaalkRawData = {
    recordingId: recordingId || `unknown-${Date.now()}`,
    dateRecorded: String(record.Date || ''),
    timeRecorded: String(record.Time || ''),
    phone: String(record.Phone || ''),
    name: String(record.Name || ''),
    duration: String(record.Duration || ''),
    voicemail: String(record.Voicemail || ''),
    pickedBy: String(record['Picked By'] || ''),
    sms: String(record.SMS || ''),
    clicked: String(record.Clicked || ''),
    transferred: String(record.Transferred || ''),
    durationAfterTransfer: String(record['Duration After Transfer'] || ''),
    transferDelay: String(record['Transfer Delay'] || ''),
    transferStatus: String(record['Transfer Status'] || ''),
    persona: String(record.Persona || ''),
    clientFirstName: String(record.Taalk_PrimaryFirstName || ''),
    agentLastName: String(record.Taalk_AgentLastName || ''),
    monthlyPremium: String(record.Taalk_MonthlyPremium || ''),
    agentFirstName: String(record.Taalk_AgentFirstName || ''),
    clientHomePhone: String(record.Taalk_ClientHomeP || ''),
    recordingUrl: String(record.Recording || ''),
    processed: false,
    taalkUID: String(taalkUID),
    notes: String(`Raw TTaalk record saved for future processing.`)
  };
  
  // Insert into our database using Drizzle
  const [result] = await db.insert(ttaalkRawData).values(rawData).returning({ id: ttaalkRawData.id });
  
  // Attempt to save to Supabase, but only if explicitly requested
  // Otherwise, we'll rely on our local database which is more reliable
  if (process.env.SYNC_TTAALK_TO_SUPABASE === 'true') {
    try {
      console.log('Attempting to save TTaalk raw data to Supabase (optional)...');
      const supabaseResult = await saveTTaalkRawDataToSupabase({
        recording_id: rawData.recordingId,
        date_recorded: rawData.dateRecorded,
        time_recorded: rawData.timeRecorded,
        phone: rawData.phone,
        name: rawData.name,
        duration: rawData.duration,
        voicemail: rawData.voicemail,
        picked_by: rawData.pickedBy,
        sms: rawData.sms,
        clicked: rawData.clicked,
        transferred: rawData.transferred,
        duration_after_transfer: rawData.durationAfterTransfer,
        transfer_delay: rawData.transferDelay,
        transfer_status: rawData.transferStatus,
        persona: rawData.persona,
        client_first_name: rawData.clientFirstName,
        agent_last_name: rawData.agentLastName,
        monthly_premium: rawData.monthlyPremium,
        agent_first_name: rawData.agentFirstName,
        client_home_phone: rawData.clientHomePhone,
        recording_url: rawData.recordingUrl,
        processed: rawData.processed,
        taalkuid: rawData.taalkUID,
        notes: rawData.notes,
        imported_at: new Date().toISOString()
      });
      
      if (supabaseResult) {
        console.log('Successfully saved TTaalk raw data to Supabase');
      } else {
        console.warn('Failed to save TTaalk raw data to Supabase, but continuing with local database storage');
      }
    } catch (error) {
      console.error('Error saving raw TTaalk data to Supabase:', error);
      console.log('Continuing with local database storage only');
    }
  } else {
    console.log('Skipping Supabase sync for TTaalk raw data (not enabled)');
  }
  
  return result.id;
}

/**
 * Process a single TTaalk record and save it to the database
 */
export async function processRecord(
  record: TTaalkRecord,
  syncToSupabase: boolean,
  result: ImportResult
): Promise<void> {
  // Extract recording ID from the URL - format example: https://api.taalk.ai/api/calls/6814ebba9ec9dc0418a413bb/recording?db=michaelmandella
  const recordingUrl = record.Recording || null;
  const recordingId = recordingUrl ? recordingUrl.split('/').pop()?.split('?')[0] : null;
  
  // If we extracted recordingId from URL, use it; otherwise generate a unique ID
  const taalkUID = recordingId || `TAALK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // First, save the raw TTaalk record to our database for future reference
  try {
    await saveRawTTaalkRecord(record, taalkUID);
  } catch (error) {
    result.errors.push(`Failed to save raw TTaalk data for recording ${record.Recording || 'N/A'}: ${error}`);
    // Continue with processing even if raw data saving fails
  }
  
  // Check if this record already exists using the generated TaalkUID
  const existingCall = await storage.getCallByTaalkUID(taalkUID);
  
  // Parse call date from the record
  const dateParts = record.Date.split('/');
  const callDate = new Date(`${dateParts[2]}-${dateParts[0]}-${dateParts[1]}T${record.Time}`);
  
  // Map the TTaalk data to our call model
  const callData: Partial<InsertCall> = {
    taalkUID: taalkUID,
    phone: String(record.Taalk_ClientHomeP || record.Phone?.split(',')[0] || ''),
    firstName: String(record.Taalk_PrimaryFirstName || ''),
    lastName: String(record.Taalk_AgentLastName || ''),
    monthlyPremium: String(record.Taalk_MonthlyPremium || '0.00'),
    agentName: String(`${record.Taalk_AgentFirstName || ''} ${record.Taalk_AgentLastName || ''}`.trim()),
    status: 'pending',
    isFlagged: false,
    flagReason: undefined,
    callDate: callDate,
    recordingUrl: String(record.Recording || ''),
    callDuration: String(record.Duration || ''),
    transcriptionText: undefined,
    screenshotUrl: undefined,
    teamId: undefined,
    agentId: undefined,
    notes: String(`Imported from TTaalk. Persona: ${record.Persona || 'N/A'}. Client Home: ${record.Taalk_ClientHomeP || 'N/A'}`)
  };
  
  if (existingCall) {
    // Update existing call
    const updatedCall = await storage.updateCall(existingCall.id, callData);
    if (updatedCall) {
      result.imported++;
      
      // Sync to Supabase if requested
      if (syncToSupabase) {
        try {
          await syncCallToSupabase(updatedCall.id);
          result.synced++;
        } catch (error) {
          result.errors.push(`Failed to sync call ${updatedCall.id} to Supabase: ${error}`);
        }
      }
    }
  } else {
    // Create new call
    try {
      const newCall = await storage.createCall(callData as InsertCall);
      result.imported++;
      
      // Sync to Supabase if requested
      if (syncToSupabase) {
        try {
          await syncCallToSupabase(newCall.id);
          result.synced++;
        } catch (error) {
          result.errors.push(`Failed to sync call ${newCall.id} to Supabase: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to create call for recording ${record.Recording || 'N/A'}: ${error}`);
    }
  }
}

/**
 * Sync a call to Supabase
 */
async function syncCallToSupabase(callId: number): Promise<void> {
  const call = await storage.getCallById(callId);
  if (!call) {
    throw new Error(`Call with ID ${callId} not found`);
  }
  
  // Insert or update the call in Supabase
  const { error } = await supabase
    .from('calls')
    .upsert({
      id: call.id,
      status: call.status,
      team_id: call.teamId,
      created_at: call.createdAt,
      taalkuid: call.taalkUID,
      phone: call.phone,
      first_name: call.firstName,
      last_name: call.lastName,
      monthly_premium: call.monthlyPremium,
      recording_url: call.recordingUrl,
      transcription_text: call.transcriptionText,
      screenshot_url: call.screenshotUrl,
      is_flagged: call.isFlagged,
      flag_reason: call.flagReason,
      call_date: call.callDate,
      call_duration: call.callDuration,
      agent_id: call.agentId,
      notes: call.notes
    });
  
  if (error) {
    throw new Error(`Supabase sync error: ${error.message}`);
  }
}