/**
 * Backfill script to migrate Twilio call data into call_log table
 * 
 * This script:
 * 1. Fetches calls from Twilio API (or existing twilio_call_logs table)
 * 2. Matches calls to leads by phone number
 * 3. Determines agent email from call metadata or lookup
 * 4. Inserts into call_log table with proper source/direction
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { logCallStarted, logCallCompleted } from './call-log-tracker';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';

interface TwilioCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration?: string;
  startTime?: Date;
  endTime?: Date;
  dateCreated?: Date;
  dateUpdated?: Date;
  price?: string;
  priceUnit?: string;
}

interface CallLogEntry {
  call_sid: string;
  owner_email?: string;
  agent_email?: string;
  from_number?: string;
  to_number?: string;
  call_status?: string;
  call_duration?: number;
  call_started_at?: string;
  call_ended_at?: string;
  metadata?: any;
}

/**
 * Fetch calls from existing twilio_call_logs table
 */
async function fetchCallsFromDatabase(startDate?: Date, endDate?: Date) {
  console.log('📊 Fetching calls from twilio_call_logs table...');
  
  let query = supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email, agent_identity, from_number, to_number, call_status, call_duration, call_started_at, call_ended_at, call_direction, call_source, metadata')
    .order('call_started_at', { ascending: false });
  
  if (startDate) {
    query = query.gte('call_started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('call_started_at', endDate.toISOString());
  }
  
  const { data, error } = await query.limit(10000); // Adjust limit as needed
  
  if (error) {
    console.error('❌ Error fetching calls from database:', error);
    return [];
  }
  
  console.log(`✅ Found ${data?.length || 0} calls in twilio_call_logs`);
  return data || [];
}

/**
 * Fetch calls directly from Twilio API
 */
async function fetchCallsFromTwilio(startDate?: Date, endDate?: Date, limit: number = 1000) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not configured');
    return [];
  }
  
  console.log('📞 Fetching calls from Twilio API...');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  
  try {
    const calls: TwilioCall[] = [];
    let page = await client.calls.list({
      limit: limit,
      startTimeAfter: startDate,
      startTimeBefore: endDate,
    });
    
    calls.push(...page);
    
    // Fetch additional pages if needed
    while (page.hasNextPage() && calls.length < limit) {
      page = await page.nextPage();
      calls.push(...page);
    }
    
    console.log(`✅ Fetched ${calls.length} calls from Twilio API`);
    return calls;
  } catch (error) {
    console.error('❌ Error fetching calls from Twilio:', error);
    return [];
  }
}

/**
 * Find lead by phone number
 */
async function findLeadByPhone(phoneNumber: string): Promise<{ id: number; taalk_market: string | null } | null> {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Try exact match first
  const { data: exactMatch } = await masterleadClient.from('masterlead')
    .select('id, taalk_market')
    .eq('phone', cleanPhone)
    .maybeSingle();
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try with +1 prefix
  const { data: plusOneMatch } = await masterleadClient.from('masterlead')
    .select('id, taalk_market')
    .eq('phone', `1${cleanPhone}`)
    .maybeSingle();
  
  if (plusOneMatch) {
    return plusOneMatch;
  }
  
  // Try without country code
  if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
    const { data: noCountryCode } = await masterleadClient.from('masterlead')
      .select('id, taalk_market')
      .eq('phone', cleanPhone.substring(1))
      .maybeSingle();
    
    if (noCountryCode) {
      return noCountryCode;
    }
  }
  
  return null;
}

/**
 * Determine agent email from call data
 */
function getAgentEmailFromCall(call: CallLogEntry | TwilioCall): string | null {
  // Check metadata first (for CallLogEntry)
  if ('metadata' in call && call.metadata) {
    const metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
    if (metadata.agent_email) {
      return metadata.agent_email;
    }
  }
  
  // Check owner_email (for CallLogEntry)
  if ('owner_email' in call && call.owner_email) {
    return call.owner_email;
  }
  
  // Check agent_identity (for CallLogEntry) - extract email from client:email format
  if ('agent_identity' in call && call.agent_identity) {
    const identity = String(call.agent_identity);
    if (identity.startsWith('client:')) {
      return identity.replace('client:', '');
    }
  }
  
  // Check if from number is a client: identity (WebRTC)
  const fromNumber = 'from_number' in call ? call.from_number : ('from' in call ? call.from : null);
  if (fromNumber && fromNumber.startsWith('client:')) {
    return fromNumber.replace('client:', '');
  }
  
  return null;
}

/**
 * Determine call source and direction
 */
function getCallSourceAndDirection(
  call: CallLogEntry | TwilioCall,
  agentEmail: string | null
): { source: 'dialer' | 'twilio' | 'vdp' | 'meet' | 'manual' | 'hotlead'; direction: 'outbound' | 'inbound' | 'vdp' | 'meet' } {
  const direction = 'direction' in call ? call.direction : ('call_direction' in call ? call.call_direction : null);
  const fromNumber = 'from_number' in call ? call.from_number : ('from' in call ? call.from : null);
  const callSource = 'call_source' in call ? call.call_source : null;
  
  // Check if it's a WebRTC call (dialer)
  if (fromNumber && fromNumber.startsWith('client:')) {
    return { source: 'dialer', direction: 'outbound' };
  }
  
  // Check call_source field directly
  if (callSource) {
    const sourceMap: Record<string, any> = {
      'call_connector_pro': 'dialer',
      'webrtc_device': 'dialer',
      'dialer': 'dialer',
      'vdp': 'vdp',
      'meet': 'meet',
      'hotlead': 'hotlead',
    };
    const mappedSource = sourceMap[callSource.toLowerCase()];
    if (mappedSource) {
      return {
        source: mappedSource,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
      };
    }
  }
  
  // Check metadata for source
  if ('metadata' in call && call.metadata) {
    try {
      const metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
      if (metadata.call_source) {
        const sourceMap: Record<string, any> = {
          'call_connector_pro': 'dialer',
          'dialer': 'dialer',
          'vdp': 'vdp',
          'meet': 'meet',
          'hotlead': 'hotlead',
        };
        const mappedSource = sourceMap[metadata.call_source.toLowerCase()];
        if (mappedSource) {
          return {
            source: mappedSource,
            direction: direction === 'inbound' ? 'inbound' : 'outbound',
          };
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  // Default based on direction
  if (direction === 'inbound') {
    return { source: 'manual', direction: 'inbound' };
  }
  
  return { source: 'dialer', direction: 'outbound' };
}

/**
 * Backfill calls from database
 */
export async function backfillCallsFromDatabase(startDate?: Date, endDate?: Date) {
  console.log('🚀 Starting call log backfill from database...');
  console.log(`📅 Date range: ${startDate?.toISOString() || 'all'} to ${endDate?.toISOString() || 'all'}`);
  
  const calls = await fetchCallsFromDatabase(startDate, endDate);
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const call of calls) {
    try {
      const callSid = call.twilio_call_sid || call.call_sid || call.sid;
      if (!callSid) {
        skipped++;
        continue;
      }
      
      // Check if already in call_log
      const { data: existing } = await supabaseAdmin
        .from('call_log')
        .select('id')
        .eq('call_sid', callSid)
        .maybeSingle();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Get agent email
      const agentEmail = getAgentEmailFromCall(call);
      if (!agentEmail) {
        console.warn(`⚠️ No agent email found for call ${callSid}`);
        skipped++;
        continue;
      }
      
      // Get lead
      const toNumber = call.to_number || call.to;
      if (!toNumber) {
        skipped++;
        continue;
      }
      
      const lead = await findLeadByPhone(toNumber);
      if (!lead) {
        // Skip calls without matching leads (could be test calls, etc.)
        skipped++;
        continue;
      }
      
      // Get source and direction
      const { source, direction } = getCallSourceAndDirection(call, agentEmail);
      
      // Determine isPlusLead
      const taalkMarket = lead.taalk_market || null;
      const isPlusLead = taalkMarket && (
        taalkMarket.toLowerCase() === 'plus lead' || 
        taalkMarket.toLowerCase() === 'plus leads'
      );
      
      // Get call status
      const callStatus = call.call_status || call.status || 'completed';
      const reached = callStatus === 'completed' || callStatus === 'answered' || callStatus === 'in-progress';
      
      // Get durations
      const durationSeconds = call.call_duration || call.duration ? parseInt(String(call.call_duration || call.duration), 10) : null;
      
      // Get timestamps
      const startedAt = call.call_started_at || call.startTime?.toISOString() || new Date().toISOString();
      const endedAt = call.call_ended_at || call.endTime?.toISOString() || null;
      
      // Insert into call_log
      await logCallStarted(supabaseAdmin, {
        leadId: lead.id,
        agentEmail: agentEmail,
        taalkMarket: taalkMarket,
        isPlusLead: isPlusLead,
        callSid: callSid,
        source: source,
        direction: direction as any,
        startedAt: startedAt,
      });
      
      // Update with completion data if available
      if (callStatus !== 'started' && callStatus !== 'ringing' && callStatus !== 'queued' && callStatus !== 'initiated') {
        // Look up disposition from masterlead.cnresolution
        let disposition: string | null = null;
        try {
          const { data: leadData } = await masterleadClient.from('masterlead')
            .select('cnresolution')
            .eq('id', lead.id)
            .maybeSingle();
          
          if (leadData?.cnresolution) {
            disposition = leadData.cnresolution;
          }
        } catch (dispositionError) {
          // Ignore - disposition lookup is optional
        }
        
        await logCallCompleted(supabaseAdmin, {
          callSid: callSid,
          callStatus: callStatus,
          reached: reached,
          disposition: disposition,
          notes: null,
          connectedAt: reached ? startedAt : null,
          endedAt: endedAt || new Date().toISOString(),
          durationSeconds: durationSeconds,
          talkSeconds: durationSeconds,
        });
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`📊 Processed ${processed} calls...`);
      }
    } catch (error) {
      console.error(`❌ Error processing call ${call.twilio_call_sid || call.call_sid}:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Backfill complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  return { processed, skipped, errors };
}

/**
 * Backfill calls from Twilio API
 */
export async function backfillCallsFromTwilio(startDate?: Date, endDate?: Date, limit: number = 1000) {
  console.log('🚀 Starting call log backfill from Twilio API...');
  console.log(`📅 Date range: ${startDate?.toISOString() || 'all'} to ${endDate?.toISOString() || 'all'}`);
  
  const calls = await fetchCallsFromTwilio(startDate, endDate, limit);
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const call of calls) {
    try {
      // Check if already in call_log
      const { data: existing } = await supabaseAdmin
        .from('call_log')
        .select('id')
        .eq('call_sid', call.sid)
        .maybeSingle();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Get agent email (try to find in existing twilio_call_logs)
      let agentEmail: string | null = null;
      const { data: existingCall } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email, agent_identity, metadata')
        .eq('twilio_call_sid', call.sid)
        .maybeSingle();
      
      if (existingCall) {
        agentEmail = getAgentEmailFromCall(existingCall);
      }
      
      if (!agentEmail) {
        // Try to infer from from number (client: identity)
        if (call.from && call.from.startsWith('client:')) {
          agentEmail = call.from.replace('client:', '');
        }
      }
      
      if (!agentEmail) {
        console.warn(`⚠️ No agent email found for call ${call.sid}`);
        skipped++;
        continue;
      }
      
      // Get lead
      if (!call.to) {
        skipped++;
        continue;
      }
      
      const lead = await findLeadByPhone(call.to);
      if (!lead) {
        console.warn(`⚠️ No lead found for phone ${call.to}`);
        skipped++;
        continue;
      }
      
      // Get source and direction
      const { source, direction } = getCallSourceAndDirection(call, agentEmail);
      
      // Determine isPlusLead
      const taalkMarket = lead.taalk_market || null;
      const isPlusLead = taalkMarket && (
        taalkMarket.toLowerCase() === 'plus lead' || 
        taalkMarket.toLowerCase() === 'plus leads'
      );
      
      // Get call status
      const callStatus = call.status || 'completed';
      const reached = callStatus === 'completed';
      
      // Get durations
      const durationSeconds = call.duration ? parseInt(call.duration, 10) : null;
      
      // Insert into call_log
      await logCallStarted(supabaseAdmin, {
        leadId: lead.id,
        agentEmail: agentEmail,
        taalkMarket: taalkMarket,
        isPlusLead: isPlusLead,
        callSid: call.sid,
        source: source,
        direction: direction as any,
        startedAt: call.startTime?.toISOString() || call.dateCreated?.toISOString() || new Date().toISOString(),
      });
      
      // Update with completion data if available
      if (callStatus !== 'started' && callStatus !== 'ringing' && callStatus !== 'queued' && callStatus !== 'initiated') {
        // Look up disposition from masterlead.cnresolution
        let disposition: string | null = null;
        try {
          const { data: leadData } = await masterleadClient.from('masterlead')
            .select('cnresolution')
            .eq('id', lead.id)
            .maybeSingle();
          
          if (leadData?.cnresolution) {
            disposition = leadData.cnresolution;
          }
        } catch (dispositionError) {
          // Ignore - disposition lookup is optional
        }
        
        await logCallCompleted(supabaseAdmin, {
          callSid: call.sid,
          callStatus: callStatus,
          reached: reached,
          disposition: disposition,
          notes: null,
          connectedAt: reached ? (call.startTime?.toISOString() || null) : null,
          endedAt: call.endTime?.toISOString() || call.dateUpdated?.toISOString() || new Date().toISOString(),
          durationSeconds: durationSeconds,
          talkSeconds: durationSeconds,
        });
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`📊 Processed ${processed} calls...`);
      }
    } catch (error) {
      console.error(`❌ Error processing call ${call.sid}:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Backfill complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  return { processed, skipped, errors };
}

// Note: CLI execution moved to run-backfill-call-log.mjs for ES module compatibility

