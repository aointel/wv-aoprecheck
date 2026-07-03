// Manual hotlead assignment utility for specific agents
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

export class ManualHotleadAssignment {
  
  // Assign veteran hotleads specifically to an agent
  static async assignVeteranHotleadsToAgent(
    agentEmail: string, 
    count: number = 50
  ): Promise<{ success: boolean; assigned: number; hotleads: any[]; errors: string[] }> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    
    try {
      console.log(`🎯 Manually assigning ${count} veteran hotleads to ${agentEmail}...`);
      
      // Get unassigned hotleads (ANY market for Chris to get him 25 leads)
      const { data: veteranHotleads, error } = await masterleadClient.from('masterlead')
        .select('*')
        .or('cn_email.is.null,owned_by_user_id.is.null')
        .in('cnresolution', ['pending', 'null'])
        .limit(count)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching veteran hotleads:', error);
        return { success: false, assigned: 0, hotleads: [], errors: [error.message] };
      }
      
      if (!veteranHotleads || veteranHotleads.length === 0) {
        console.log('📭 No veteran hotleads found for assignment');
        
        // Try to get any available hotleads if no veteran-specific ones exist
        const { data: anyHotleads, error: anyError } = await masterleadClient.from('masterlead')
          .select('*')
          .or('cn_email.is.null,owned_by_user_id.is.null')
          .in('cnresolution', ['pending', 'null'])
          .limit(count)
          .order('created_at', { ascending: false });
        
        if (anyError) {
          return { success: false, assigned: 0, hotleads: [], errors: [anyError.message] };
        }
        
        if (!anyHotleads || anyHotleads.length === 0) {
          return { success: false, assigned: 0, hotleads: [], errors: ['No hotleads available for assignment'] };
        }
        
        console.log(`📋 Found ${anyHotleads.length} general hotleads, proceeding with assignment...`);
        return this.performAssignment(agentEmail, anyHotleads);
      }
      
      console.log(`🎯 Found ${veteranHotleads.length} veteran hotleads for assignment`);
      return this.performAssignment(agentEmail, veteranHotleads);
      
    } catch (error) {
      console.error('❌ Error in manual veteran hotlead assignment:', error);
      return { 
        success: false, 
        assigned: 0, 
        hotleads: [], 
        errors: [error instanceof Error ? error.message : String(error)] 
      };
    }
  }
  
  // Perform the actual assignment updates
  private static async performAssignment(
    agentEmail: string, 
    hotleads: any[]
  ): Promise<{ success: boolean; assigned: number; hotleads: any[]; errors: string[] }> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    
    const assigned: any[] = [];
    const errors: string[] = [];
    
    for (const hotlead of hotleads) {
      try {
        // Update ownership in Supabase
        const { error: updateError } = await supabaseAdmin
          .from('hotlead')
          .update({
            cn_email: agentEmail,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', hotlead.id);
        
        if (updateError) {
          console.error(`❌ Failed to assign hotlead ${hotlead.id}:`, updateError);
          errors.push(`Failed to assign ${hotlead.phone}: ${updateError.message}`);
        } else {
          console.log(`✅ Assigned hotlead ${hotlead.first_name} ${hotlead.last_name} (${hotlead.phone}) to ${agentEmail}`);
          assigned.push({
            id: hotlead.id,
            phone: hotlead.phone,
            firstName: hotlead.first_name,
            lastName: hotlead.last_name,
            market: hotlead.taalk_market || hotlead.taalk_groupname || 'Hot Lead',
            state: hotlead.taalk_state || 'Unknown'
          });
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (hotleadError) {
        console.error(`❌ Error assigning hotlead ${hotlead.id}:`, hotleadError);
        errors.push(`Error assigning ${hotlead.phone}: ${hotleadError instanceof Error ? hotleadError.message : String(hotleadError)}`);
      }
    }
    
    console.log(`✅ Manual assignment completed: ${assigned.length} assigned, ${errors.length} errors`);
    return {
      success: assigned.length > 0,
      assigned: assigned.length,
      hotleads: assigned,
      errors
    };
  }
  
  // Get current assignments for an agent
  static async getAgentAssignments(agentEmail: string): Promise<{ success: boolean; hotleads: any[]; total: number }> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    
    try {
      const { data: assignments, error } = await supabaseAdmin
        .from('hotleads')
        .select('*')
        .eq('cn_email', agentEmail)
        .in('cnresolution', ['pending', 'null'])
        .order('assigned_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        hotleads: assignments || [],
        total: assignments?.length || 0
      };
    } catch (error) {
      console.error('❌ Error fetching agent assignments:', error);
      return {
        success: false,
        hotleads: [],
        total: 0
      };
    }
  }
}