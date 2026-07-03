import { supabaseAdmin } from '../supabase.js';

/**
 * Validates that an associate_id exists in agent_hierarchy or producerlist
 * Returns true if valid, false otherwise
 */
export async function validateAssociateId(associateId: string | number | null | undefined): Promise<boolean> {
  if (!associateId) {
    return false;
  }
  
  const associateIdStr = String(associateId).trim();
  
  // Block fake IDs that start with 333
  if (associateIdStr.startsWith('333')) {
    console.log(`❌ BLOCKED: Fake associate_id detected: ${associateIdStr} (starts with 333)`);
    return false;
  }
  
  try {
    // Check agent_hierarchy first
    const { data: hierarchyData, error: hierarchyError } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_associate_id')
      .eq('agent_associate_id', parseInt(associateIdStr))
      .maybeSingle();
    
    if (!hierarchyError && hierarchyData) {
      console.log(`✅ Validated associate_id ${associateIdStr} in agent_hierarchy`);
      return true;
    }
    
    // Check producerlist as fallback (if available)
    try {
      const { data: producerData, error: producerError } = await supabaseAdmin
        .from('producerlist')
        .select('associate_id')
        .eq('associate_id', parseInt(associateIdStr))
        .maybeSingle();
      
      if (!producerError && producerData) {
        console.log(`✅ Validated associate_id ${associateIdStr} in producerlist`);
        return true;
      }
    } catch (e) {
      // producerlist might not exist, ignore
    }
    
    console.log(`❌ Invalid associate_id: ${associateIdStr} not found in agent_hierarchy or producerlist`);
    return false;
  } catch (error) {
    console.error(`❌ Error validating associate_id ${associateIdStr}:`, error);
    return false;
  }
}
