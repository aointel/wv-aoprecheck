/**
 * Backfill Script: Fetch AI Summaries and Agent Emails for Recruit Candidates
 * 
 * This script finds all recruit_candidates without ai_summary or with missing/incorrect agent_email and attempts to:
 * 1. Look up their phone numbers in vdp_calls_BLASTPICK to find call records
 * 2. Extract sessionid/LeadId from those records
 * 3. Fetch AI summary from Taalk API using the call ID
 * 4. Look up agent_email from agent_id using customers, producerlist, and agent_profiles tables
 * 5. Update recruit_candidates with both AI summary and agent_email
 * 
 * Run with: tsx server/backfill-recruit-ai-summaries.ts
 * 
 * Options:
 *   --limit N        Process only first N candidates (for testing)
 *   --force          Re-fetch even if ai_summary already exists
 */

import { supabaseAdmin } from './supabase';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

/**
 * Fetch AI summary from Taalk API using call ID
 */
async function fetchAISummaryFromTaalk(callId: string): Promise<string | null> {
  if (!callId) {
    return null;
  }

  try {
    const summaryUrl = `https://api.taalk.ai/api/calls/${callId}/summary?db=michaelmandella`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (summaryResponse.ok) {
      const summaryJson = await summaryResponse.json();
      const aiSummaryData = summaryJson.payload?.summary || summaryJson.summary || [];
      
      // Convert array to string format (same as webhook)
      if (Array.isArray(aiSummaryData)) {
        return JSON.stringify(aiSummaryData);
      } else if (typeof aiSummaryData === 'string') {
        return aiSummaryData;
      } else {
        return JSON.stringify(aiSummaryData);
      }
    } else {
      console.log(`  ⚠️ Taalk API returned ${summaryResponse.status} for call ${callId}`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error fetching AI summary from Taalk for ${callId}:`, error);
    return null;
  }
}

/**
 * Look up agent email from associate_id by checking multiple tables
 */
async function getAgentEmailFromAssociateId(associateId: string): Promise<string | null> {
  if (!associateId) {
    return null;
  }

  try {
    // HARDCODED: Taylor Ermis
    if (associateId === '2233111') {
      return 'taylorermis@aoglobelife.com';
    }
    
    // Convert to integer for database lookup
    const associateIdInt = parseInt(associateId);
    if (isNaN(associateIdInt)) {
      return null;
    }
    
    // Try producerlist table first
    const { data: producer } = await supabaseAdmin
      .from('producerlist')
      .select('company_email, associate_id')
      .eq('associate_id', associateIdInt)
      .maybeSingle();

    if (producer?.company_email) {
      return producer.company_email;
    }

    // Try agent_profiles table
    const { data: agentProfile } = await supabaseAdmin
      .from('agent_profiles')
      .select('email, agent_id')
      .eq('agent_id', associateId)
      .maybeSingle();

    if (agentProfile?.email) {
      return agentProfile.email;
    }

    // Try customers table as last resort
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id')
      .eq('associate_id', associateIdInt)
      .maybeSingle();

    if (customer?.company_email) {
      return customer.company_email;
    }

    if (customer?.personal_email) {
      return customer.personal_email;
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Error looking up email for associate ID ${associateId}:`, error);
    return null;
  }
}

/**
 * Find Taalk call ID from phone number by looking up in vdp_calls_BLASTPICK
 * Tries multiple approaches: sessionid, leadid, and checking vdp_calls table
 */
async function findTaalkCallIdFromPhone(phone: string): Promise<string | null> {
  if (!phone) {
    return null;
  }

  try {
    // Normalize phone number (remove +, spaces, dashes)
    const normalizedPhone = phone.replace(/[\s\-+()]/g, '');
    const last10Digits = normalizedPhone.slice(-10);
    
    // Approach 1: Look up in vdp_calls_BLASTPICK table - try exact match first
    const { data: exactMatch } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .select('sessionid, leadid, phone, market, querystring')
      .eq('phone', phone)
      .ilike('market', '%aorecruit%')
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactMatch?.sessionid) {
      console.log(`  📞 Found sessionid from vdp_calls_BLASTPICK: ${exactMatch.sessionid}`);
      // Try using sessionid as Taalk call ID
      return exactMatch.sessionid;
    }

    // Approach 2: Try with normalized phone (last 10 digits)
    const { data: normalizedMatch } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .select('sessionid, leadid, phone, market, querystring')
      .ilike('phone', `%${last10Digits}%`)
      .ilike('market', '%aorecruit%')
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (normalizedMatch?.sessionid) {
      console.log(`  📞 Found sessionid from normalized phone: ${normalizedMatch.sessionid}`);
      return normalizedMatch.sessionid;
    }

    // Approach 3: Check vdp_calls table for LeadId (might have Taalk call ID stored)
    const { data: vdpCall } = await supabaseAdmin
      .from('vdp_calls')
      .select('leadid, phone, market')
      .eq('phone', phone)
      .ilike('market', '%aorecruit%')
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vdpCall?.leadid) {
      console.log(`  📞 Found leadid from vdp_calls: ${vdpCall.leadid}`);
      // LeadId might be the Taalk call ID
      return vdpCall.leadid;
    }

    console.log(`  ⚠️ No call ID found for phone ${phone}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error looking up call ID for phone ${phone}:`, error);
    return null;
  }
}

/**
 * Main backfill function
 */
async function backfillRecruitAISummaries(limit?: number, force: boolean = false) {
  console.log('🔄 Starting recruit AI summary and agent email backfill...');
  console.log('📋 Processing recruit_candidates missing ai_summary or with incorrect agent_email\n');
  
  try {
    // Get all candidates - we'll filter in code to find those needing updates
    console.log('📊 Fetching candidates to check for missing AI summary or agent_email...');
    let query = supabaseAdmin
      .from('recruit_candidates')
      .select('id, first_name, last_name, phone, agent_id, agent_email, ai_summary, created_at')
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
      console.log(`   Limiting to first ${limit} candidates`);
    }
    
    const { data: candidates, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('❌ Error fetching candidates:', fetchError);
      return;
    }
    
    if (!candidates || candidates.length === 0) {
      console.log('✅ No candidates missing AI summary or agent_email');
      return;
    }
    
    console.log(`✅ Found ${candidates.length} candidates to process\n`);
    
    let successCount = 0;
    let emailUpdatedCount = 0;
    let summaryUpdatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const progress = `[${i + 1}/${candidates.length}]`;
      
      // Check if candidate needs updates
      const needsSummary = !candidate.ai_summary || candidate.ai_summary.trim() === '';
      const needsEmail = !candidate.agent_email || 
                        candidate.agent_email.includes('unknown-agent') ||
                        candidate.agent_email.trim() === '';
      
      // Skip if nothing needs updating (unless force mode)
      if (!force && !needsSummary && !needsEmail) {
        if ((i + 1) % 100 === 0) {
          console.log(`${progress} Skipping ${i + 1} candidates (already have all data)...`);
        }
        skippedCount++;
        continue;
      }
      
      if ((i + 1) % 50 === 0 || i === 0) {
        console.log(`${progress} Processing candidate ${candidate.id}: ${candidate.first_name} ${candidate.last_name} (${candidate.phone})...`);
      }
      
      try {
        const updateData: any = {
          updated_at: new Date().toISOString()
        };
        let hasUpdates = false;

        // Step 1: Look up agent email from agent_id if missing or incorrect
        const needsEmailUpdate = !candidate.agent_email || 
                                 candidate.agent_email.includes('unknown-agent') ||
                                 candidate.agent_email.trim() === '';
        
        if (needsEmailUpdate && candidate.agent_id) {
          console.log(`  🔍 Looking up agent email for agent_id: ${candidate.agent_id}`);
          const agentEmail = await getAgentEmailFromAssociateId(candidate.agent_id);
          
          if (agentEmail) {
            updateData.agent_email = agentEmail;
            hasUpdates = true;
            console.log(`  ✅ Found agent email: ${agentEmail}`);
          } else {
            console.log(`  ⚠️ No agent email found for agent_id: ${candidate.agent_id}`);
          }
        }

        // Step 2: Find Taalk call ID from phone number and fetch AI summary
        const needsSummary = !candidate.ai_summary || candidate.ai_summary.trim() === '';
        
        if (needsSummary || force) {
          const callId = await findTaalkCallIdFromPhone(candidate.phone);
          
          if (callId) {
            console.log(`  📞 Found call ID: ${callId}`);
            
            // Fetch AI summary from Taalk API
            const aiSummary = await fetchAISummaryFromTaalk(callId);
            
            if (aiSummary) {
              updateData.ai_summary = aiSummary;
              hasUpdates = true;
              console.log(`  ✅ AI Summary fetched (${aiSummary.length} chars)`);
            } else {
              console.log(`  ⚠️ No AI summary available for call ${callId}`);
            }
          } else {
            console.log(`  ⚠️ No call ID found for phone ${candidate.phone}`);
          }
        }

        // Step 3: Update candidate if we have any updates
        if (hasUpdates) {
          const { error: updateError } = await supabaseAdmin
            .from('recruit_candidates')
            .update(updateData)
            .eq('id', candidate.id);
          
          if (updateError) {
            console.error(`  ❌ Failed to update candidate ${candidate.id}:`, updateError);
            errorCount++;
          } else {
            const updates = [];
            if (updateData.agent_email) {
              updates.push('agent_email');
              emailUpdatedCount++;
            }
            if (updateData.ai_summary) {
              updates.push('ai_summary');
              summaryUpdatedCount++;
            }
            console.log(`  ✅ ✅ ✅ Updated candidate ${candidate.id} with: ${updates.join(', ')}`);
            successCount++;
          }
        } else {
          console.log(`  ⏭️ No updates needed for candidate ${candidate.id}`);
          skippedCount++;
        }
        
        // Rate limiting: Wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Error processing candidate ${candidate.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 BACKFILL COMPLETE:`);
    console.log(`   ✅ Successfully updated: ${successCount} candidates`);
    console.log(`   📧 Agent emails updated: ${emailUpdatedCount} candidates`);
    console.log(`   🤖 AI summaries updated: ${summaryUpdatedCount} candidates`);
    console.log(`   ⚠️ Skipped (no updates needed): ${skippedCount} candidates`);
    console.log(`   ⚠️ No call ID/summary found: ${notFoundCount} candidates`);
    console.log(`   ❌ Errors: ${errorCount} candidates`);
    
  } catch (error) {
    console.error('❌ Error in backfill:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let limit: number | undefined;
let force = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1], 10);
  } else if (args[i] === '--force') {
    force = true;
  }
}

// Export the function for use in API endpoints
export { backfillRecruitAISummaries };

// Run backfill if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  backfillRecruitAISummaries(limit, force)
    .then(() => {
      console.log('\n✅ Backfill script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Backfill script failed:', error);
      process.exit(1);
    });
}










