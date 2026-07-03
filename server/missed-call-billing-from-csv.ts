/**
 * Missed Call Billing from vdp_calls_BLASTPICK Database Table
 * 
 * 🚨 DISABLED - Missed call billing is currently disabled
 * 
 * Reads BLASTER events from the vdp_calls_BLASTPICK database table and creates billing transactions
 * for missed calls at $4.00 per missed call, then sends notifications to agents.
 * 
 * A missed call is identified as: BLASTER event with no PICK_UP event for the same phone/date
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { format, parse, subDays } from 'date-fns';
import { supabaseAdmin } from './supabase';

const MISSED_CALL_AMOUNT = 4.00;

interface CSVEvent {
  Date: string;
  Time: string;
  Event: string;
  Phone: string;
  Agent: string;
  Params: string;
}

interface MissedCall {
  phone: string;
  agentId: string;
  date: string;
  time: string;
  leadName: string;
  leadPhone: string;
  blasterCount: number;
  timestamp: string;
}

// Parse CSV line with proper quote handling (same as analytics service)
function parseCsvLine(line: string, headers: string[]): Record<string, string> {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  let fieldIndex = 0;
  let i = 0;
  
  while (i < line.length && fieldIndex < 5) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i-1] === ',')) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (i === line.length - 1 || line[i+1] === ',') {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      fieldIndex++;
      i++;
      continue;
    } else {
      currentValue += char;
    }
    i++;
  }
  
  // Everything remaining is the Params field
  if (i < line.length) {
    const paramsStr = line.substring(i).replace(/^,/, '');
    values.push(paramsStr);
  } else if (currentValue) {
    values.push(currentValue);
  } else {
    values.push('');
  }
  
  const result: Record<string, string> = {};
  headers.forEach((header, index) => {
    result[header] = values[index] || '';
  });
  return result;
}

// Parse params JSON
function parseParams(paramsStr: string): any {
  try {
    if (!paramsStr || paramsStr === '{}') return {};
    let cleaned = paramsStr.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    return JSON.parse(cleaned);
  } catch (error) {
    return {};
  }
}

// Parse date/time to timestamp
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const fullDatetime = `${dateStr} ${timeStr}`;
    return new Date(fullDatetime);
  } catch (error) {
    return null;
  }
}

// Group events by phone number
function groupEventsByPhone(events: CSVEvent[]): Record<string, CSVEvent[]> {
  const groups: Record<string, CSVEvent[]> = {};
  
  for (const event of events) {
    if (event.Phone) {
      if (!groups[event.Phone]) {
        groups[event.Phone] = [];
      }
      groups[event.Phone].push(event);
    }
  }
  
  // Sort each group by date/time
  for (const phone in groups) {
    groups[phone].sort((a, b) => {
      const timeA = parseDateTime(a.Date, a.Time);
      const timeB = parseDateTime(b.Date, b.Time);
      return (timeA?.getTime() || 0) - (timeB?.getTime() || 0);
    });
  }
  
  return groups;
}

// Find missed calls: BLASTER events with no PICK_UP/PICKED event
function findMissedCalls(phoneGroups: Record<string, CSVEvent[]>): MissedCall[] {
  const missedCalls: MissedCall[] = [];
  
  for (const [phone, events] of Object.entries(phoneGroups)) {
    let hasBlaster = false;
    let hasPickup = false;
    let agentId = '';
    let firstBlasterDate = '';
    let firstBlasterTime = '';
    let blasterCount = 0;
    let leadName = 'Unknown Lead';
    let leadPhone = phone;
    
    // Check all events for this phone
    for (const event of events) {
      // Track BLASTER events
      if (event.Event === 'BLASTER') {
        hasBlaster = true;
        blasterCount++;
        if (!firstBlasterDate) {
          firstBlasterDate = event.Date;
          firstBlasterTime = event.Time;
        }
        // Get agent ID from BLASTER event
        if (event.Agent && !agentId) {
          agentId = event.Agent.trim();
        }
      }
      
      // Track PICK_UP or PICKED events (means call was answered)
      if (event.Event === 'PICK_UP' || event.Event === 'PICKED' || event.Event === 'CONNECT') {
        hasPickup = true;
      }
      
      // Extract lead name from Params if available
      if (event.Params && leadName === 'Unknown Lead') {
        const params = parseParams(event.Params);
        if (params['First Name'] || params['Last Name']) {
          leadName = `${params['First Name'] || ''} ${params['Last Name'] || ''}`.trim() || 'Unknown Lead';
        }
        if (params.phone || params.Phone) {
          leadPhone = params.phone || params.Phone || phone;
        }
      }
    }
    
    // Missed call criteria: Has BLASTER events but no PICK_UP/PICKED
    // AND has an agent ID (means agent was assigned)
    if (hasBlaster && !hasPickup && agentId && blasterCount > 0) {
      const timestamp = parseDateTime(firstBlasterDate, firstBlasterTime);
      missedCalls.push({
        phone,
        agentId,
        date: firstBlasterDate,
        time: firstBlasterTime,
        leadName,
        leadPhone,
        blasterCount,
        timestamp: timestamp?.toISOString() || new Date().toISOString(),
      });
    }
  }
  
  return missedCalls;
}

// Resolve agent info from email or associate ID
async function resolveAgentInfo(
  agentEmail: string | null | undefined,
  agentId: string | null | undefined
): Promise<{ email: string; associateId: number | null; name: string }> {
  if (!supabaseAdmin) {
    return { email: '', associateId: null, name: 'Unknown Agent' };
  }

  // Try by email first
  if (agentEmail) {
    const { data: userByEmail } = await supabaseAdmin
      .from('user_credits')
      .select('email, associate_id, name')
      .eq('email', agentEmail.toLowerCase())
      .limit(1)
      .single();

    if (userByEmail) {
      return {
        email: userByEmail.email || agentEmail.toLowerCase(),
        associateId: userByEmail.associate_id,
        name: userByEmail.name || 'Unknown Agent',
      };
    }
  }

  // Try by associate ID (check both user_credits and customers table)
  // Handle comma-separated IDs (e.g., "205289,108762")
  if (agentId) {
    const idsToTry = agentId.split(',').map(id => id.trim()).filter(id => id);
    
    for (const idStr of idsToTry) {
      const associateIdNum = parseInt(idStr, 10);
      if (isNaN(associateIdNum)) continue;

      // Try user_credits first
      const { data: userById } = await supabaseAdmin
        .from('user_credits')
        .select('email, associate_id, name')
        .eq('associate_id', associateIdNum)
        .limit(1)
        .maybeSingle();

      if (userById && userById.email) {
        return {
          email: userById.email || '',
          associateId: userById.associate_id,
          name: userById.name || 'Unknown Agent',
        };
      }

      // Fallback to customers table (use company_email)
      const { data: customerById } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name')
        .eq('associate_id', associateIdNum)
        .limit(1)
        .maybeSingle();

      if (customerById && (customerById.company_email || customerById.personal_email)) {
        return {
          email: customerById.company_email || customerById.personal_email || '',
          associateId: customerById.associate_id,
          name: `${customerById.first_name || ''} ${customerById.last_name || ''}`.trim() || 'Unknown Agent',
        };
      }
    }
  }

  // Fallback
  return {
    email: agentEmail?.toLowerCase() || '',
    associateId: agentId ? parseInt(agentId, 10) || null : null,
    name: 'Unknown Agent',
  };
}

// Create billing transaction for missed call
async function createMissedCallBillingTransaction(missedCall: MissedCall): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return false;
  }

  try {
    // Resolve agent info
    const agentInfo = await resolveAgentInfo(null, missedCall.agentId);
    
    // Require email - associate ID alone is not enough for billing
    if (!agentInfo.email) {
      return false;
    }

    // Check if transaction already exists (duplicate prevention)
    // Use phone + date + time as unique identifier
    const transactionId = `missed-call-${missedCall.phone}-${missedCall.date}-${missedCall.time}`.replace(/[^a-zA-Z0-9-]/g, '-');
    
    const { data: existing } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id')
      .eq('transaction_id', transactionId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Duplicate exists - skip silently (this is expected behavior)
      return false;
    }

    // Create billing transaction
    const transactionDate = parseDateTime(missedCall.date, missedCall.time)?.toISOString() || new Date().toISOString();
    
    const { error: insertError } = await supabaseAdmin
      .from('billing_transactions')
      .insert({
        transaction_id: transactionId,
        transaction_type: 'missed_call',
        agent_email: agentInfo.email, // Required - already validated above
        agent_associate_id: agentInfo.associateId,
        agent_name: agentInfo.name,
        transaction_date: transactionDate,
        amount_usd: MISSED_CALL_AMOUNT,
        credits_charged: MISSED_CALL_AMOUNT,
        lead_name: missedCall.leadName,
        lead_phone: missedCall.leadPhone,
        source_table: 'vdp_calls_BLASTPICK',
        source_id: null,
        description: `Missed call charge (${missedCall.blasterCount} blaster cycles)`,
        metadata: {
          phone: missedCall.phone,
          blaster_count: missedCall.blasterCount,
          date: missedCall.date,
          time: missedCall.time,
          agent_id: missedCall.agentId,
        },
      });

    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate key - already exists
        return false;
      }
      return false;
    }

    // Pause account - disable VDP/inbound connections to prevent further missed call charges
    await pauseAccountForMissedCall(agentInfo.email);

    // Create missed call notification record (triggers VDP alert)
    await createMissedCallNotificationRecord(
      agentInfo.email,
      missedCall,
      agentInfo.name,
      agentInfo.associateId
    );

    // Create billing notification
    await createBillingNotification(
      agentInfo.email || '',
      'missed_call',
      MISSED_CALL_AMOUNT,
      MISSED_CALL_AMOUNT,
      missedCall.leadName,
      transactionId
    );

    return true;
  } catch (error) {
    console.error(`❌ Error creating billing transaction for ${missedCall.phone}:`, error);
    return false;
  }
}

// Pause account by disabling VDP/inbound connections
async function pauseAccountForMissedCall(agentEmail: string): Promise<void> {
  if (!supabaseAdmin || !agentEmail) return;

  try {
    // Disable VDP by setting VDPACTIVE to INACTIVE in customers table
    const { error } = await supabaseAdmin
      .from('customers')
      .update({ VDPACTIVE: 'INACTIVE' })
      .ilike('company_email', agentEmail.toLowerCase());

    if (error) {
      console.error(`❌ Failed to pause account for ${agentEmail}:`, error);
    } else {
      console.log(`✅ Account paused (VDP disabled) for ${agentEmail} due to missed call`);
    }
  } catch (error) {
    console.error(`❌ Error pausing account for ${agentEmail}:`, error);
  }
}

// Create missed call notification record (triggers VDP alert)
async function createMissedCallNotificationRecord(
  agentEmail: string,
  missedCall: MissedCall,
  agentName: string,
  associateId: number | null
): Promise<void> {
  if (!supabaseAdmin || !agentEmail) return;

  try {
    // Import missed call notification service
    const { MissedCallNotificationService } = await import('./missed-call-notification-service');

    // Create missed call notification record
    await MissedCallNotificationService.createMissedCallNotification({
      agent_id: associateId?.toString() || missedCall.agentId || 'unknown',
      agent_name: agentName,
      agent_email: agentEmail,
      phone: missedCall.phone,
      lead_name: missedCall.leadName || undefined,
      date: missedCall.date,
      time: missedCall.time,
      credit_deduction: MISSED_CALL_AMOUNT,
    });

    console.log(`✅ Created missed call notification record for ${agentEmail}`);
  } catch (error) {
    console.error(`❌ Error creating missed call notification record for ${agentEmail}:`, error);
  }
}

// Create billing notification
async function createBillingNotification(
  agentEmail: string,
  transactionType: 'missed_call',
  amountUsd: number,
  creditsCharged: number,
  leadName: string | null,
  transactionId: string
): Promise<void> {
  if (!supabaseAdmin) return;

  if (!agentEmail) {
    return;
  }

  const serviceName = 'Missed Call';
  const leadDisplay = leadName ? ` for ${leadName}` : '';

  const { error } = await supabaseAdmin
    .from('agent_notifications')
    .insert({
      agent_email: agentEmail.toLowerCase(),
      notification_type: 'billing_transaction',
      title: `🚨 Account Paused - Missed Call Charge`,
      message: `Your account has been paused to prevent further missed call charges. You were charged $${amountUsd.toFixed(2)} (${creditsCharged} credits)${leadDisplay}. Please review the missed call policy to enable inbound connections.`,
      read: false,
      metadata: {
        transaction_type: transactionType,
        transaction_id: transactionId,
        amount_usd: amountUsd,
        credits_charged: creditsCharged,
        lead_name: leadName,
        account_paused: true,
        requires_policy_review: true,
      },
    });

  if (error) {
    // Don't throw - notification failure shouldn't break billing
    return;
  }
}

// Query vdp_calls_BLASTPICK for BLASTER events and check for PICK_UP
async function queryMissedCallsFromDatabase(dateFilter?: string): Promise<MissedCall[]> {
  try {
    if (!supabaseAdmin) {
      return [];
    }

    // If no date filter, process last 7 days only (was 30 - too much data!)
    const cutoffDate = dateFilter ? null : subDays(new Date(), 7);
    const startDate = dateFilter 
      ? new Date(dateFilter + 'T00:00:00')
      : cutoffDate || subDays(new Date(), 7);
    const endDate = new Date();

    // Get ALL BLASTER events in the date range (paginate to get all)
    const blasterEvents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalCount = 0;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: batch, error: blasterError, count } = await supabaseAdmin
        .from('vdp_calls_BLASTPICK')
        .select('*', { count: 'exact' })
        .eq('event', 'BLASTER')
        .gte('time', startDate.toISOString())
        .lte('time', endDate.toISOString())
        .order('time', { ascending: true })
        .range(from, to);

      if (blasterError) {
        break;
      }

      if (count) totalCount = count;

      if (batch && batch.length > 0) {
        blasterEvents.push(...batch);
        // Removed excessive logging - was causing rate limits
        hasMore = batch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    if (blasterEvents.length === 0) {
      return [];
    }

    // Get ALL PICK_UP events in the same date range (paginate to get all)
    const pickupEvents: any[] = [];
    let pickupPage = 0;
    const pickupPageSize = 1000;
    let hasMorePickups = true;
    let pickupError: any = null;

    while (hasMorePickups) {
      const from = pickupPage * pickupPageSize;
      const to = from + pickupPageSize - 1;

      const { data: batch, error: error } = await supabaseAdmin
        .from('vdp_calls_BLASTPICK')
        .select('phone, time, agent')
        .eq('event', 'PICK_UP')
        .gte('time', startDate.toISOString())
        .lte('time', endDate.toISOString())
        .order('time', { ascending: true })
        .range(from, to);

      if (error) {
        pickupError = error;
        break;
      }

      if (batch && batch.length > 0) {
        pickupEvents.push(...batch);
        hasMorePickups = batch.length === pickupPageSize;
        pickupPage++;
      } else {
        hasMorePickups = false;
      }
    }

    // Continue with available data even if error

    // Create a map of PICK_UP events by phone and time for efficient lookup
    // Format: phone -> array of pickup timestamps
    const pickupEventsByPhone = new Map<string, Date[]>();
    if (pickupEvents) {
      for (const pickup of pickupEvents) {
        const phone = (pickup.phone || '').trim();
        const pickupTime = pickup.time ? new Date(pickup.time) : null;
        if (phone && pickupTime) {
          if (!pickupEventsByPhone.has(phone)) {
            pickupEventsByPhone.set(phone, []);
          }
          pickupEventsByPhone.get(phone)!.push(pickupTime);
        }
      }
    }

    // Removed log to reduce rate limits

    // Process BLASTER events to find missed calls
    const missedCalls: MissedCall[] = [];
    const processedCalls = new Set<string>(); // Track phone-date-time to avoid duplicates

    // Limit processing to avoid memory issues - process in batches
    const MAX_EVENTS_TO_PROCESS = 10000;
    const eventsToProcess = blasterEvents.slice(0, MAX_EVENTS_TO_PROCESS);
    
    // Time window for matching BLASTER to PICK_UP (10 minutes in milliseconds)
    const PICKUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    
    // Minimum call duration to be considered a missed call (10 seconds)
    const MIN_CALL_DURATION_MS = 10 * 1000; // 10 seconds

    for (const blaster of eventsToProcess) {
      const phone = (blaster.phone || '').trim();
      const agentId = (blaster.agent || '').trim();
      const blasterTime = blaster.time ? new Date(blaster.time) : null;

      if (!phone || !agentId || !blasterTime) {
        continue;
      }

      // Check if this phone was picked up within the time window after this BLASTER event
      const pickupTimes = pickupEventsByPhone.get(phone) || [];
      let wasPickedUp = false;
      for (const pickupTime of pickupTimes) {
        const timeDiff = pickupTime.getTime() - blasterTime.getTime();
        // PICK_UP must be after BLASTER and within the time window
        if (timeDiff >= 0 && timeDiff <= PICKUP_WINDOW_MS) {
          wasPickedUp = true;
          break;
        }
      }

      if (wasPickedUp) {
        // This call was picked up within the time window - not a missed call
        continue;
      }

      // Check if we already processed this exact missed call (phone-date-time)
      const dateKey = format(blasterTime, 'yyyy-MM-dd');
      const timeKey = format(blasterTime, 'HH:mm:ss');
      const uniqueKey = `${phone}-${dateKey}-${timeKey}`;
      if (processedCalls.has(uniqueKey)) {
        continue;
      }
      processedCalls.add(uniqueKey);

      // Count BLASTER events that are part of THIS call sequence
      // A call sequence is BLASTER events for the same phone/agent within 2 minutes of each other
      let blasterCount = 1;
      const callSequenceWindow = 2 * 60 * 1000; // 2 minutes for call sequence
      let lastBlasterInSequence = blasterTime;
      let callEndTime = blasterTime;
      
      // Sort blaster events by time to process in order
      const sortedBlasters = blasterEvents
        .filter(b => b.phone === phone && b.agent === agentId && b.event === 'BLASTER')
        .map(b => ({ ...b, time: b.time ? new Date(b.time) : null }))
        .filter(b => b.time && b.time > blasterTime)
        .sort((a, b) => a.time!.getTime() - b.time!.getTime());
      
      for (const b of sortedBlasters) {
        const bTime = b.time!;
        const timeDiff = bTime.getTime() - lastBlasterInSequence.getTime();
        if (timeDiff <= callSequenceWindow) {
          // This BLASTER is part of the same call sequence
          blasterCount++;
          lastBlasterInSequence = bTime;
          callEndTime = bTime;
        } else {
          // This is a new call sequence, stop counting
          break;
        }
      }
      
      // Verify the call attempt lasted at least the minimum duration
      const callDuration = callEndTime.getTime() - blasterTime.getTime();
      
      if (callDuration < MIN_CALL_DURATION_MS) {
        // Call attempt was too short, skip it
        continue;
      }

      // Extract lead info from params if available
      let leadName = null;
      let leadPhone = phone;
      try {
        if (blaster.params) {
          const params = typeof blaster.params === 'string' ? JSON.parse(blaster.params) : blaster.params;
          const firstName = params['First Name'] || params.firstName || '';
          const lastName = params['Last Name'] || params.lastName || '';
          if (firstName || lastName) {
            leadName = `${firstName} ${lastName}`.trim();
          }
        }
      } catch (e) {
        // Ignore parse errors
      }

      missedCalls.push({
        phone,
        agentId,
        date: dateKey,
        time: timeKey,
        leadName: leadName || '',
        leadPhone,
        blasterCount,
        timestamp: blasterTime.toISOString(),
      });
    }

    return missedCalls;
  } catch (error: any) {
    // Return empty array on error to prevent crashes
    return [];
  }
}

// Main processing function
async function processMissedCallBilling(dateFilter?: string): Promise<void> {
  // 🚨 DISABLED - Missed call billing is currently disabled
  console.log('⚠️ Missed call billing is DISABLED - skipping processing');
  return;
  
  /* DISABLED CODE - Uncomment to re-enable
  try {
    // Query missed calls from database
    const missedCalls = await queryMissedCallsFromDatabase(dateFilter);

    if (missedCalls.length === 0) {
      return;
    }

    // Process missed calls and create billing transactions
    let processed = 0;
    let skipped = 0;

    for (const missedCall of missedCalls) {
      const success = await createMissedCallBillingTransaction(missedCall);
      if (success) {
        processed++;
      } else {
        skipped++;
      }
      
      // Small delay to avoid overwhelming the database
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Single summary log instead of multiple
    if (processed > 0) {
      console.log(`✅ Missed call billing: ${processed} transactions, ${skipped} skipped`);
    }
  } catch (error: any) {
    // Log error but don't throw - scheduler will handle gracefully
    // Re-throw so scheduler can catch it
    throw error;
  }
  */
}

// CLI interface
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url === pathToFileURL(process.argv[1]).href;

function pathToFileURL(filePath: string): URL {
  return new URL(`file://${path.resolve(filePath)}`);
}

if (isMainModule || process.argv[1]?.endsWith('missed-call-billing-from-csv.ts')) {
  const dateFilter = process.argv[2]; // Optional date filter (YYYY-MM-DD format)
  
  if (dateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-12-10)');
    process.exit(1);
  }

  processMissedCallBilling(dateFilter)
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { processMissedCallBilling, findMissedCalls };

