import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { pool } from './db';
import { outboundDialerLeadCache } from './outbound-dialer-lead-cache';

// State timezone mappings
const stateTimezones: Record<string, string> = {
  // Eastern Time
  'FL': 'America/New_York', 'GA': 'America/New_York', 'SC': 'America/New_York',
  'NC': 'America/New_York', 'VA': 'America/New_York', 'WV': 'America/New_York',
  'MD': 'America/New_York', 'DE': 'America/New_York', 'PA': 'America/New_York',
  'NJ': 'America/New_York', 'NY': 'America/New_York', 'CT': 'America/New_York',
  'RI': 'America/New_York', 'MA': 'America/New_York', 'VT': 'America/New_York',
  'NH': 'America/New_York', 'ME': 'America/New_York', 'OH': 'America/New_York',
  'MI': 'America/New_York', 'IN': 'America/New_York', 'KY': 'America/New_York',
  
  // Central Time
  'TX': 'America/Chicago', 'OK': 'America/Chicago', 'KS': 'America/Chicago',
  'NE': 'America/Chicago', 'SD': 'America/Chicago', 'ND': 'America/Chicago',
  'MN': 'America/Chicago', 'IA': 'America/Chicago', 'MO': 'America/Chicago',
  'AR': 'America/Chicago', 'LA': 'America/Chicago', 'MS': 'America/Chicago',
  'AL': 'America/Chicago', 'TN': 'America/Chicago', 'WI': 'America/Chicago',
  'IL': 'America/Chicago',
  
  // Mountain Time
  'MT': 'America/Denver', 'WY': 'America/Denver', 'CO': 'America/Denver',
  'NM': 'America/Denver', 'UT': 'America/Denver', 'ID': 'America/Denver',
  
  // Pacific Time
  'CA': 'America/Los_Angeles', 'WA': 'America/Los_Angeles', 'OR': 'America/Los_Angeles',
  'NV': 'America/Los_Angeles',
  
  // Alaska
  'AK': 'America/Anchorage',
  
  // Hawaii
  'HI': 'Pacific/Honolulu',
  
  // Arizona (no DST)
  'AZ': 'America/Phoenix'
};

function isCallPermissible(leadState: string): boolean {
  const timezone = stateTimezones[leadState];
  if (!timezone) return true; // Unknown state, allow

  try {
    // FIXED: Use Intl.DateTimeFormat to correctly get time in lead's timezone
    // The old method (new Date().toLocaleString()) was parsing as server local time, not lead's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // FTC allows 8 AM (480 minutes) to 9 PM (1260 minutes) in LEAD'S timezone
    return currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;
  } catch (error) {
    console.error(`❌ FTC check error for ${leadState}:`, error);
    return true; // On error, allow the call
  }
}

/**
 * FTC Queue Cleaner - Runs hourly to mark leads outside calling hours
 * Sets FTCRESTRICTED='YES' for leads outside calling hours (8 AM - 9 PM local time)
 * Sets FTCRESTRICTED='NO' when they become callable again
 * NOTE: Does NOT modify cnresolution - that field is for lead disposition only
 */
export async function cleanFTCQueues() {
  try {
    if (ftcColumnMissing) return;

    console.log('🕐 FTC QUEUE CLEANER: Starting hourly cleanup...');

    // Probe: try selecting FTCRESTRICTED to detect if column exists (read-only, no data change)
    const { error: probeError } = await masterleadClient.from('masterlead')
      .select('id, FTCRESTRICTED')
      .limit(1)
      .maybeSingle();
    if (probeError && (probeError as { code?: string }).code === '42703') {
      ftcColumnMissing = true;
      if (ftcCleanerInterval) {
        clearInterval(ftcCleanerInterval);
        ftcCleanerInterval = null;
      }
      console.log('⚠️ FTC queue cleaner disabled - FTCRESTRICTED column does not exist');
      return;
    }

    // Get all pending leads with state info
    // NOTE: FTCRESTRICTED column may not exist in all deployments - omit from select to avoid 42703 error
    const { data: pendingLeads, error: fetchError } = await masterleadClient.from('masterlead')
      .select('id, first_name, last_name, state, taalk_state, cn_email, cnresolution')
      .eq('cnresolution', 'pending')
      .not('cn_email', 'is', null);
    
    if (fetchError) {
      console.error('❌ Error fetching pending leads:', fetchError);
      return;
    }
    
    if (!pendingLeads || pendingLeads.length === 0) {
      console.log('✅ No pending leads to check');
      return;
    }
    
    console.log(`📊 Checking ${pendingLeads.length} pending leads for FTC compliance...`);
    
    // Build restrict/unrestrict ID lists in JS, then do two bulk UPDATEs instead of N individual ones
    const restrictIds: bigint[] = [];
    const unrestrictIds: bigint[] = [];

    for (const lead of pendingLeads) {
      const leadState = lead.state || lead.taalk_state;
      if (!leadState) continue;
      const isPermissible = isCallPermissible(leadState);
      const ftcRestricted = (lead as { FTCRESTRICTED?: string }).FTCRESTRICTED;
      if (!isPermissible && ftcRestricted !== 'YES') {
        restrictIds.push(BigInt(lead.id));
      } else if (isPermissible && ftcRestricted === 'YES') {
        unrestrictIds.push(BigInt(lead.id));
      }
    }

    let restrictedCount = 0;
    let unrestrictedCount = 0;

    if (restrictIds.length > 0) {
      try {
        await pool.query(
          `UPDATE masterlead SET "FTCRESTRICTED"='YES', updated_at=NOW() WHERE id = ANY($1::bigint[])`,
          [restrictIds]
        );
        restrictedCount = restrictIds.length;
      } catch (e: any) {
        if (e?.code === '42703') { console.log('⚠️ FTCRESTRICTED column not found - skipping'); return; }
        console.error('❌ Bulk restrict failed:', e);
      }
    }

    if (unrestrictIds.length > 0) {
      try {
        await pool.query(
          `UPDATE masterlead SET "FTCRESTRICTED"='NO', updated_at=NOW() WHERE id = ANY($1::bigint[])`,
          [unrestrictIds]
        );
        unrestrictedCount = unrestrictIds.length;
      } catch (e: any) {
        if (e?.code === '42703') { console.log('⚠️ FTCRESTRICTED column not found - skipping'); return; }
        console.error('❌ Bulk unrestrict failed:', e);
      }
    }
    
    console.log(`🎉 FTC QUEUE CLEANUP COMPLETE:`);
    console.log(`   🚫 Restricted: ${restrictedCount} leads (outside calling hours)`);
    console.log(`   ✅ Unrestricted: ${unrestrictedCount} leads (now callable)`);
    console.log(`   📌 NOTE: cnresolution field was NOT modified - only FTCRESTRICTED column updated`);
    
    // Clear lead cache for affected agents so they get fresh data
    if (restrictedCount > 0 || unrestrictedCount > 0) {
      console.log(`🔄 Clearing lead cache for affected agents to resync with masterlead...`);
      const affectedEmails = new Set<string>();
      pendingLeads.forEach(lead => {
        if (lead.cn_email) {
          affectedEmails.add(lead.cn_email.toLowerCase());
        }
      });
      
      // Clear cache for all affected agents
      affectedEmails.forEach(email => {
        outboundDialerLeadCache.clearCache(email);
        console.log(`   🗑️ Cleared cache for ${email}`);
      });
      
      console.log(`✅ Cleared cache for ${affectedEmails.size} agents - cache will refresh on next request`);
    }
    
  } catch (error) {
    console.error('❌ Error in FTC queue cleaner:', error);
  }
}

// Cron job - run every hour
let ftcCleanerInterval: NodeJS.Timeout | null = null;
// When FTCRESTRICTED column doesn't exist, stop running to avoid repeated errors
let ftcColumnMissing = false;

export function startFTCQueueCleaner() {
  if (ftcCleanerInterval) {
    console.log('⚠️ FTC queue cleaner already running');
    return;
  }
  
  console.log('🚀 Starting FTC queue cleaner (every 60 minutes)');
  
  const runCleanup = () => {
    if (ftcColumnMissing) return;
    cleanFTCQueues().catch(() => {});
  };
  
  // Run immediately on startup
  runCleanup();
  
  // Then run every hour
  ftcCleanerInterval = setInterval(runCleanup, 60 * 60 * 1000); // 60 minutes
}

export function stopFTCQueueCleaner() {
  if (ftcCleanerInterval) {
    clearInterval(ftcCleanerInterval);
    ftcCleanerInterval = null;
    console.log('🛑 FTC queue cleaner stopped');
  }
}

