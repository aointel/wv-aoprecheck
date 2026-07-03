// Utility to fix missing state data in existing hotleads
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

export class HotleadStateFixer {
  
  // Extract state from various sources in hotlead records
  static extractStateFromRecord(lead: any): string | null {
    // 1. Check if taalk_state already has valid data
    if (lead.taalk_state && lead.taalk_state !== 'null' && lead.taalk_state.length === 2) {
      return lead.taalk_state.toUpperCase();
    }
    
    // 2. Extract from notes field - multiple patterns
    if (lead.notes) {
      const statePatterns = [
        /"Taalk_State"\s*:\s*"([A-Z]{2})"/i,          // JSON: "Taalk_State":"OH"
        /Taalk_State[:\s]+"([A-Z]{2})"/i,             // Mixed: Taalk_State: "OH"
        /Taalk_State[:\s]+([A-Z]{2})/i,               // Simple: Taalk_State: OH
        /"state"\s*:\s*"([A-Z]{2})"/i,                // Alt JSON: "state":"OH"
        /\bstate[:\s]+([A-Z]{2})\b/i,                 // Simple: state: OH
        /([A-Z]{2})\s+state/i,                        // Reverse: OH state
        /\b([A-Z]{2})\b.*veteran/i,                   // State before veteran context
        /veteran.*\b([A-Z]{2})\b/i                    // State after veteran context
      ];
      
      for (const pattern of statePatterns) {
        const match = lead.notes.match(pattern);
        if (match && match[1] && match[1].length === 2) {
          const state = match[1].toUpperCase();
          // Validate it's a real US state abbreviation
          const validStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
          ];
          if (validStates.includes(state)) {
            return state;
          }
        }
      }
    }
    
    // 3. Extract from taalk_lead_id or other reference fields if they contain location data
    // This would require additional API calls to Taalk to get the original lead data
    
    return null;
  }
  
  // Update hotleads with missing state information
  static async fixMissingStates(): Promise<{ success: boolean; updated: number; errors: number }> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    
    try {
      console.log('🔧 Starting hotlead state fixing process...');
      
      // Get all hotleads with null or missing taalk_state
      const { data: hotleads, error } = await masterleadClient.from('masterlead')
        .select('id, first_name, last_name, phone, taalk_state, notes, taalk_lead_id')
        .or('taalk_state.is.null,taalk_state.eq.null')
        .limit(1000);
      
      if (error) {
        throw error;
      }
      
      if (!hotleads || hotleads.length === 0) {
        console.log('📋 No hotleads found with missing state information');
        return { success: true, updated: 0, errors: 0 };
      }
      
      console.log(`🔍 Found ${hotleads.length} hotleads with missing state data`);
      
      let updated = 0;
      let errors = 0;
      
      // Process each hotlead
      for (const lead of hotleads) {
        try {
          const extractedState = this.extractStateFromRecord(lead);
          
          if (extractedState) {
            console.log(`🔧 Extracted state ${extractedState} for ${lead.first_name} ${lead.last_name} (${lead.phone})`);
            
            // Update the record
            const { error: updateError } = await supabaseAdmin
              .from('hotleads')
              .update({ 
                taalk_state: extractedState,
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);
            
            if (updateError) {
              console.error(`❌ Failed to update ${lead.first_name}: ${updateError.message}`);
              errors++;
            } else {
              updated++;
            }
          } else {
            console.log(`⏭️ No state data found for ${lead.first_name} ${lead.last_name} (${lead.phone})`);
          }
        } catch (leadError) {
          console.error(`❌ Error processing ${lead.first_name}:`, leadError);
          errors++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`✅ State fixing complete: ${updated} updated, ${errors} errors`);
      return { success: true, updated, errors };
      
    } catch (error) {
      console.error('❌ Error during state fixing:', error);
      return { success: false, updated: 0, errors: 1 };
    }
  }
  
  // Get statistics about current state data quality
  static async getStateDataStats(): Promise<any> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    
    try {
      // Total hotleads
      const { count: total } = await supabaseAdmin
        .from('hotleads')
        .select('*', { count: 'exact', head: true });
      
      // Hotleads with valid state data  
      const { count: withState } = await supabaseAdmin
        .from('hotleads')
        .select('*', { count: 'exact', head: true })
        .not('taalk_state', 'is', null)
        .neq('taalk_state', 'null');
      
      // Hotleads missing state data
      const { count: missingState } = await supabaseAdmin
        .from('hotleads')
        .select('*', { count: 'exact', head: true })
        .or('taalk_state.is.null,taalk_state.eq.null');
      
      return {
        total: total || 0,
        withState: withState || 0,
        missingState: missingState || 0,
        completionRate: total ? Math.round((withState || 0) / total * 100) : 0
      };
    } catch (error) {
      console.error('❌ Error getting state data stats:', error);
      return { total: 0, withState: 0, missingState: 0, completionRate: 0 };
    }
  }
}