import { Call } from '@shared/schema';
import { storage } from '../storage';
import { fetchCallsFromSupabase, syncCallToSupabase, deleteCallFromSupabase } from '../supabase';

/**
 * Service for synchronizing calls between our application and Supabase
 */
export class CallSyncService {
  // Singleton instance
  private static instance: CallSyncService;
  
  // Whether a sync is currently in progress
  private isSyncing: boolean = false;
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): CallSyncService {
    if (!CallSyncService.instance) {
      CallSyncService.instance = new CallSyncService();
    }
    return CallSyncService.instance;
  }
  
  /**
   * Pull all calls from Supabase and sync them to our local database
   */
  public async pullFromSupabase(): Promise<{success: boolean, synced: number, errors: number}> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping');
      return { success: false, synced: 0, errors: 0 };
    }
    
    this.isSyncing = true;
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    let synced = 0;
    let errors = 0;
    
    try {
      console.log('Starting call sync from Supabase...');
      
      while (hasMore) {
        const { calls, count } = await fetchCallsFromSupabase(limit, offset);
        
        if (!calls || calls.length === 0) {
          hasMore = false;
          break;
        }
        
        console.log(`Processing batch of ${calls.length} calls (offset: ${offset})`);
        
        for (const call of calls) {
          try {
            // Format as needed for our local database
            const formattedCall = this.formatCallForLocalDb(call);
            
            // Check if call exists and update or create accordingly
            const existingCall = await storage.getCallById(call.id);
            
            if (existingCall) {
              await storage.updateCall(call.id, formattedCall);
            } else {
              await storage.createCall(formattedCall);
            }
            
            synced++;
          } catch (err) {
            console.error(`Error syncing call id ${call.id}:`, err);
            errors++;
          }
        }
        
        offset += calls.length;
        hasMore = calls.length === limit && offset < count;
      }
      
      console.log(`Call sync completed. Synced: ${synced}, Errors: ${errors}`);
      return { success: true, synced, errors };
    } catch (err) {
      console.error('Exception during call sync:', err);
      return { success: false, synced, errors };
    } finally {
      this.isSyncing = false;
    }
  }
  
  /**
   * Push a specific call to Supabase
   */
  public async pushCallToSupabase(call: Call): Promise<boolean> {
    try {
      // Format for Supabase
      const formattedCall = this.formatCallForSupabase(call);
      
      // Sync to Supabase
      const result = await syncCallToSupabase(formattedCall);
      
      return !!result;
    } catch (err) {
      console.error(`Error pushing call id ${call.id} to Supabase:`, err);
      return false;
    }
  }
  
  /**
   * Delete a call from both local storage and Supabase
   */
  public async deleteCall(callId: number): Promise<boolean> {
    try {
      // Delete from local storage
      const localDeleted = await storage.deleteCall(callId);
      
      if (!localDeleted) {
        console.warn(`Call id ${callId} not found in local storage for deletion`);
      }
      
      // Delete from Supabase
      const supabaseDeleted = await deleteCallFromSupabase(callId);
      
      return localDeleted && supabaseDeleted;
    } catch (err) {
      console.error(`Error deleting call id ${callId}:`, err);
      return false;
    }
  }
  
  /**
   * Format a call from Supabase for our local database
   */
  private formatCallForLocalDb(supabaseCall: any): Partial<Call> {
    // Transform fields as needed
    return {
      id: supabaseCall.id,
      status: supabaseCall.status || 'pending',
      teamId: supabaseCall.team_id,
      agentId: supabaseCall.agent_id,
      taalkUID: supabaseCall.taalkuid || '',
      phone: supabaseCall.phone || '',
      firstName: supabaseCall.first_name || '',
      lastName: supabaseCall.last_name || '',
      monthlyPremium: supabaseCall.monthly_premium || '',
      recordingUrl: supabaseCall.recording_url,
      transcriptionText: supabaseCall.transcription_text,
      screenshotUrl: supabaseCall.screenshot_url,
      callDate: supabaseCall.call_date ? new Date(supabaseCall.call_date) : null,
      callDuration: supabaseCall.call_duration,
      isFlagged: !!supabaseCall.is_flagged,
      // Only set created/updated dates if they exist
      createdAt: supabaseCall.created_at ? new Date(supabaseCall.created_at) : new Date(),
      updatedAt: supabaseCall.updated_at ? new Date(supabaseCall.updated_at) : new Date(),
    };
  }
  
  /**
   * Format a call from our local database for Supabase
   */
  private formatCallForSupabase(call: Call): any {
    // Transform fields for Supabase's snake_case convention
    return {
      id: call.id,
      status: call.status,
      team_id: call.teamId,
      agent_id: call.agentId,
      taalkuid: call.taalkUID,
      phone: call.phone,
      first_name: call.firstName,
      last_name: call.lastName,
      monthly_premium: call.monthlyPremium,
      recording_url: call.recordingUrl,
      transcription_text: call.transcriptionText,
      screenshot_url: call.screenshotUrl,
      call_date: call.callDate,
      call_duration: call.callDuration,
      is_flagged: call.isFlagged,
      created_at: call.createdAt,
      updated_at: new Date(),
    };
  }
}

// Export the singleton instance
export const callSyncService = CallSyncService.getInstance();